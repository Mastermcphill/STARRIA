import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ProviderToggleService } from '../payments/provider-toggle.service';
import { SubscriptionProviderRegistry } from './subscription-provider.registry';
import type { SubscriptionStatus } from './ports/subscription-provider.port';

/**
 * Multi-provider recurring billing. A plan (SubscriptionPlan) names the rail and
 * its provider-side price id. createSubscription() opens a hosted checkout and
 * records a PaymentSubscription in `pending`; the provider's webhooks drive it
 * through active → past_due → cancelled/expired. Webhooks are replay-protected
 * by a unique SubscriptionWebhook.dedupeKey and matched to the local row by
 * provider subscription id, falling back to our echoed reference.
 */
@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    private readonly db: PrismaService,
    private readonly registry: SubscriptionProviderRegistry,
    private readonly toggles: ProviderToggleService,
  ) {}

  listPlans() {
    return this.db.subscriptionPlan.findMany({
      where: { active: true },
      orderBy: { priceMinorUnits: 'asc' },
    });
  }

  listForUser(userId: string) {
    return this.db.paymentSubscription.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { plan: true },
    });
  }

  async createSubscription(userId: string, planKey: string, email?: string) {
    const plan = await this.db.subscriptionPlan.findUnique({ where: { key: planKey } });
    if (!plan || !plan.active) {
      throw new NotFoundException(`Subscription plan '${planKey}' not found`);
    }
    if (!this.registry.has(plan.provider)) {
      throw new BadRequestException(`Subscription provider '${plan.provider}' is not available`);
    }
    await this.toggles.assertEnabled(plan.provider, 'subscription');

    const provider = this.registry.get(plan.provider)!;
    const idempotencyKey = `sub:${userId}:${randomUUID()}`;

    const result = await provider.createCheckout({
      userId,
      email,
      reference: idempotencyKey,
      plan: {
        key: plan.key,
        providerPlanId: plan.providerPlanId,
        priceMinorUnits: plan.priceMinorUnits,
        currency: plan.currency,
        interval: plan.interval,
      },
    });

    const sub = await this.db.paymentSubscription.create({
      data: {
        userId,
        planId: plan.id,
        provider: plan.provider,
        providerSubscriptionId: result.providerSubscriptionId ?? null,
        status: result.status,
        idempotencyKey,
      },
    });

    return {
      subscriptionId: sub.id,
      status: sub.status,
      authorizationUrl: result.authorizationUrl,
    };
  }

  async cancel(userId: string, subscriptionId: string) {
    const sub = await this.db.paymentSubscription.findUnique({ where: { id: subscriptionId } });
    if (!sub) throw new NotFoundException('Subscription not found');
    if (sub.userId !== userId) throw new ForbiddenException('Not your subscription');
    if (!sub.providerSubscriptionId) {
      throw new BadRequestException('Subscription is not active yet');
    }
    const provider = this.registry.get(sub.provider);
    if (!provider) throw new BadRequestException(`Provider '${sub.provider}' unavailable`);

    await provider.cancel(sub.providerSubscriptionId);
    // Mark intent; the provider's cancellation webhook sets the final status.
    return this.db.paymentSubscription.update({
      where: { id: sub.id },
      data: { cancelAtPeriodEnd: true },
    });
  }

  // ─── Webhooks ────────────────────────────────────────────────────────────────

  async handleWebhook(
    providerName: string,
    rawBody: Buffer | string,
    headers: Record<string, string | undefined>,
  ) {
    const provider = this.registry.get(providerName);
    if (!provider) throw new BadRequestException(`Unknown subscription provider '${providerName}'`);
    if (!provider.verifyWebhook(rawBody, headers)) {
      throw new UnauthorizedException('Invalid subscription webhook signature');
    }
    const parsed = provider.parseWebhook(rawBody);
    const payload = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');

    return this.db.$transaction(async (tx) => {
      // Replay protection — a duplicate delivery collides on dedupeKey.
      try {
        await tx.subscriptionWebhook.create({
          data: {
            provider: providerName,
            event: parsed.event,
            dedupeKey: parsed.dedupeKey,
            providerSubscriptionId: parsed.providerSubscriptionId,
            rawPayload: JSON.parse(payload) as Prisma.InputJsonValue,
          },
        });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          return { handled: true, deduped: true };
        }
        throw e;
      }

      if (!parsed.status) {
        return { handled: true, ignored: parsed.event };
      }

      // Match the local row: prefer the provider subscription id, fall back to
      // our echoed reference (set on the very first 'created' delivery).
      let sub = null as Awaited<ReturnType<typeof tx.paymentSubscription.findFirst>>;
      if (parsed.providerSubscriptionId) {
        sub = await tx.paymentSubscription.findFirst({
          where: { provider: providerName, providerSubscriptionId: parsed.providerSubscriptionId },
        });
      }
      if (!sub && parsed.reference) {
        sub = await tx.paymentSubscription.findUnique({
          where: { idempotencyKey: parsed.reference },
        });
      }
      if (!sub) return { handled: true, matched: false };

      await tx.paymentSubscription.update({
        where: { id: sub.id },
        data: {
          status: parsed.status,
          providerSubscriptionId: parsed.providerSubscriptionId ?? sub.providerSubscriptionId,
          currentPeriodEnd: parsed.currentPeriodEnd ? new Date(parsed.currentPeriodEnd) : sub.currentPeriodEnd,
          cancelledAt: isTerminal(parsed.status) ? new Date() : sub.cancelledAt,
        },
      });
      return { handled: true, matched: true, status: parsed.status, subscriptionId: sub.id };
    });
  }
}

function isTerminal(status: SubscriptionStatus): boolean {
  return status === 'cancelled' || status === 'expired';
}
