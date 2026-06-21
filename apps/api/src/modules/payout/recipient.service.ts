import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ProviderToggleService } from '../payments/provider-toggle.service';
import { getCatalogEntry } from '../payments/provider-catalog';
import { RecipientOnboardingRegistry } from './recipient-onboarding.registry';

/**
 * Manages PayoutRecipient rows for onboarding-heavy payout rails. A recipient
 * must reach `active`/payable (driven by the provider's hosted onboarding +
 * webhooks) before PayoutService will reserve funds against it.
 */
@Injectable()
export class RecipientService {
  private readonly logger = new Logger(RecipientService.name);
  private readonly returnUrl: string;
  private readonly refreshUrl: string;

  constructor(
    private readonly db: PrismaService,
    private readonly onboarding: RecipientOnboardingRegistry,
    private readonly toggles: ProviderToggleService,
    config: ConfigService,
  ) {
    this.returnUrl = config.get<string>('PAYOUT_ONBOARDING_RETURN_URL') ?? 'https://starria.com/payouts/onboarded';
    this.refreshUrl = config.get<string>('PAYOUT_ONBOARDING_REFRESH_URL') ?? 'https://starria.com/payouts/onboard';
  }

  listForUser(userId: string) {
    return this.db.payoutRecipient.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Start (or resume) onboarding for a rail. Upserts the local row, asks the
   * provider for its payee entity + hosted link, and persists the handle.
   */
  async startOnboarding(userId: string, provider: string, email?: string, country?: string) {
    const rail = this.onboarding.get(provider);
    if (!rail) {
      throw new BadRequestException(`Provider '${provider}' does not support recipient onboarding`);
    }
    if (getCatalogEntry(provider)) {
      await this.toggles.assertEnabled(provider, 'payout');
    }

    const recipient = await this.db.payoutRecipient.upsert({
      where: { userId_provider: { userId, provider } },
      create: { userId, provider, status: 'pending' },
      update: {},
    });

    const link = await rail.createOnboardingLink({
      userId,
      recipientId: recipient.id,
      returnUrl: this.returnUrl,
      refreshUrl: this.refreshUrl,
      email,
      country,
    });

    const updated = await this.db.payoutRecipient.update({
      where: { id: recipient.id },
      data: {
        providerRef: link.providerRef,
        status: link.ready ? 'active' : 'onboarding',
        payable: link.ready ?? false,
      },
    });

    return {
      recipientId: updated.id,
      provider,
      status: updated.status,
      payable: updated.payable,
      onboardingUrl: link.url,
    };
  }

  /**
   * Fetch one recipient, refreshing its status from the provider first so a
   * user returning from the hosted flow sees an up-to-date state even before
   * the webhook lands.
   */
  async getAndRefresh(userId: string, recipientId: string) {
    const recipient = await this.db.payoutRecipient.findUnique({ where: { id: recipientId } });
    if (!recipient || recipient.userId !== userId) throw new NotFoundException('Recipient not found');

    const rail = this.onboarding.get(recipient.provider);
    if (rail && recipient.providerRef) {
      try {
        const status = await rail.getRecipientStatus(recipient.providerRef);
        return this.applyStatus(recipient.id, status.status, status.payable, status.details);
      } catch (e) {
        this.logger.warn(`Recipient ${recipientId} status refresh failed: ${(e as Error).message}`);
      }
    }
    return recipient;
  }

  // ─── Onboarding webhook (replay-protected) ────────────────────────────────

  async handleOnboardingWebhook(
    providerName: string,
    rawBody: Buffer | string,
    headers: Record<string, string | undefined>,
  ) {
    const rail = this.onboarding.get(providerName);
    if (!rail) throw new BadRequestException(`Unknown onboarding provider '${providerName}'`);
    if (!rail.verifyOnboardingWebhook(rawBody, headers)) {
      throw new UnauthorizedException('Invalid onboarding webhook signature');
    }
    const parsed = rail.parseOnboardingWebhook(rawBody);
    const payload = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');

    return this.db.$transaction(async (tx) => {
      // Replay protection — duplicate deliveries collide on dedupeKey.
      const dedupeKey = parsed?.dedupeKey ?? `unparsed:${providerName}`;
      try {
        await tx.recipientOnboardingWebhook.create({
          data: {
            provider: providerName,
            event: parsed?.event ?? 'unknown',
            dedupeKey,
            providerRef: parsed?.providerRef,
            rawPayload: JSON.parse(payload) as Prisma.InputJsonValue,
          },
        });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          return { handled: true, deduped: true };
        }
        throw e;
      }

      if (!parsed || !parsed.providerRef) {
        return { handled: true, matched: false };
      }
      const recipient = await tx.payoutRecipient.findUnique({
        where: { provider_providerRef: { provider: providerName, providerRef: parsed.providerRef } },
      });
      if (!recipient) return { handled: true, matched: false };

      await tx.payoutRecipient.update({
        where: { id: recipient.id },
        data: { status: parsed.status, payable: parsed.payable },
      });
      return { handled: true, matched: true, status: parsed.status, payable: parsed.payable };
    });
  }

  private async applyStatus(
    id: string,
    status: string,
    payable: boolean,
    details?: Record<string, unknown>,
  ) {
    return this.db.payoutRecipient.update({
      where: { id },
      data: {
        status,
        payable,
        details: details ? (details as Prisma.InputJsonValue) : undefined,
      },
    });
  }
}
