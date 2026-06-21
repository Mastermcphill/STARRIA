import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma, PayoutStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { appendWalletEntry } from '../wallet/wallet-ledger';
import { ProviderToggleService } from '../payments/provider-toggle.service';
import { getCatalogEntry } from '../payments/provider-catalog';
import { PayoutProviderRegistry } from './payout-provider.registry';
import { RecipientOnboardingRegistry } from './recipient-onboarding.registry';
import { CoinConversionService } from './coin-conversion.service';

const SERIALIZABLE = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
} as const;

const MAX_TRANSFER_ATTEMPTS = 3;

const DEFAULT_PAYOUT_PROVIDER = 'paystack';

export interface RequestWithdrawalInput {
  amount: number;
  currency?: string;
  destination: string;
  /** Payout rail. Defaults to paystack. Must be enabled for the payout flow. */
  provider?: string;
  idempotencyKey?: string;
}

/**
 * Production payout pipeline. The money path is:
 *   request → reserve (coinBalance → reservedCoins) → provider transfer →
 *   webhook → finalize (debit reserved) | release (reserved → coinBalance).
 *
 * Safety properties:
 *   - Reservation + finalize + release each run in a Serializable transaction.
 *   - Withdrawal requests are idempotent on idempotencyKey (unique).
 *   - Webhooks are replay-protected by a unique dedupeKey row; finalize/release
 *     are additionally guarded by the payout status so they apply at most once.
 *   - The finalize debit is written through the canonical hash-chained ledger.
 */
@Injectable()
export class PayoutService {
  private readonly logger = new Logger(PayoutService.name);

  constructor(
    private readonly db: PrismaService,
    private readonly registry: PayoutProviderRegistry,
    private readonly toggles: ProviderToggleService,
    private readonly onboarding: RecipientOnboardingRegistry,
    private readonly conversion: CoinConversionService,
  ) {}

  // ─── 1–5: request + reserve + record (idempotent, atomic) ──────────────────

  async requestWithdrawal(userId: string, input: RequestWithdrawalInput) {
    if (input.amount <= 0) {
      throw new UnprocessableEntityException('Amount must be positive');
    }
    if (input.amount < this.conversion.minWithdrawalCoins) {
      throw new UnprocessableEntityException(
        `Minimum withdrawal is ${this.conversion.minWithdrawalCoins} coins`,
      );
    }
    const idempotencyKey = input.idempotencyKey ?? `payout:${userId}:${randomUUID()}`;
    const provider = input.provider ?? DEFAULT_PAYOUT_PROVIDER;

    // Reject an unknown/disabled rail before reserving any funds. assertEnabled
    // also rejects providers that don't support the payout capability.
    if (!this.registry.has(provider)) {
      throw new BadRequestException(`Payout provider '${provider}' is not available`);
    }
    if (getCatalogEntry(provider)) {
      await this.toggles.assertEnabled(provider, 'payout');
    }

    // Onboarding-heavy rails (Stripe Connect/Wise/Trolley/Tipalti) require a
    // pre-onboarded, payable PayoutRecipient. Resolve it BEFORE reserving funds
    // and use its provider handle as the destination — never the client value.
    let destination = input.destination;
    let recipientCurrency: string | undefined;
    if (this.onboarding.has(provider)) {
      const recipient = await this.db.payoutRecipient.findUnique({
        where: { userId_provider: { userId, provider } },
      });
      if (!recipient || !recipient.providerRef) {
        throw new BadRequestException(`No onboarded ${provider} recipient — complete onboarding first`);
      }
      if (!recipient.payable) {
        throw new UnprocessableEntityException(`${provider} recipient is not payable (status: ${recipient.status})`);
      }
      destination = recipient.providerRef;
      recipientCurrency = recipient.currency ?? undefined;
    }

    // Convert coins → payout currency (USD peg + per-currency multiplier + FX),
    // deducting the creator-absorbed fee. The stored net is exactly what the rail
    // is instructed to send; reject dust that nets to nothing after fees.
    const currency = this.conversion.resolveCurrency(provider, input.currency, recipientCurrency);
    let conversion;
    try {
      conversion = this.conversion.convert(input.amount, currency);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
    if (conversion.netMinorUnits <= 0) {
      throw new UnprocessableEntityException('Payout amount is too small to cover fees');
    }

    const payout = await this.db.$transaction(async (tx) => {
      const existing = await tx.payoutRequest.findUnique({ where: { idempotencyKey } });
      if (existing) return { record: existing, deduped: true };

      const wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet) throw new NotFoundException('Wallet not found');
      if (wallet.coinBalance < input.amount) {
        throw new UnprocessableEntityException(
          `Insufficient balance: have ${wallet.coinBalance}, need ${input.amount}`,
        );
      }

      // Reserve funds: move available → reserved so they cannot be re-spent.
      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          coinBalance: { decrement: input.amount },
          reservedCoins: { increment: input.amount },
        },
      });

      const record = await tx.payoutRequest.create({
        data: {
          userId,
          amountCoins: input.amount,
          currency,
          grossMinorUnits: conversion.grossMinorUnits,
          feeMinorUnits: conversion.feeMinorUnits,
          netMinorUnits: conversion.netMinorUnits,
          fxRate: conversion.fxRate,
          destination,
          provider,
          status: PayoutStatus.REQUESTED,
          idempotencyKey,
        },
      });
      return { record, deduped: false };
    }, SERIALIZABLE);

    if (payout.deduped) {
      this.logger.log(`Withdrawal deduped on key ${idempotencyKey} → ${payout.record.id}`);
      return payout.record;
    }

    // Provider call happens AFTER the reservation commits (never hold a
    // serializable txn open across network I/O).
    await this.executePayout(payout.record.id);
    return this.db.payoutRequest.findUnique({ where: { id: payout.record.id } });
  }

  // ─── Quote (no reservation) ────────────────────────────────────────────────

  /**
   * Preview the conversion for a withdrawal so the creator can confirm the net
   * they'll receive before committing. Same math as requestWithdrawal — no funds
   * are touched. For onboarding rails the recipient's currency is used if set.
   */
  async quote(userId: string, coins: number, provider = DEFAULT_PAYOUT_PROVIDER, requestedCurrency?: string) {
    if (coins <= 0) throw new UnprocessableEntityException('Amount must be positive');
    if (coins < this.conversion.minWithdrawalCoins) {
      throw new UnprocessableEntityException(
        `Minimum withdrawal is ${this.conversion.minWithdrawalCoins} coins`,
      );
    }

    let recipientCurrency: string | undefined;
    if (this.onboarding.has(provider)) {
      const recipient = await this.db.payoutRecipient.findUnique({
        where: { userId_provider: { userId, provider } },
      });
      recipientCurrency = recipient?.currency ?? undefined;
    }
    const currency = this.conversion.resolveCurrency(provider, requestedCurrency, recipientCurrency);
    try {
      return { provider, ...this.conversion.convert(coins, currency) };
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
  }

  // ─── 6: execute provider payout (with retry) ───────────────────────────────

  async executePayout(payoutId: string): Promise<void> {
    const payout = await this.db.payoutRequest.findUnique({ where: { id: payoutId } });
    if (!payout || payout.status !== PayoutStatus.REQUESTED) return;

    const provider = this.registry.get(payout.provider);
    if (!provider) {
      // Rail was removed/renamed after the request was created. Release funds.
      await this.failAndRelease(payoutId, `provider_unavailable:${payout.provider}`, 1);
      return;
    }

    const attemptNo = (await this.db.payoutAttempt.count({ where: { payoutId } })) + 1;

    let lastError: string | undefined;
    for (let i = 0; i < MAX_TRANSFER_ATTEMPTS; i++) {
      try {
        const result = await provider.transfer({
          // Send the net (post-fee) amount in the payout currency. Fall back to
          // amountCoins only for legacy rows created before the conversion column.
          reference: payout.id,
          amountMinorUnits: payout.netMinorUnits ?? payout.amountCoins,
          currency: payout.currency,
          destination: payout.destination,
        });

        if (result.accepted) {
          await this.db.$transaction([
            this.db.payoutAttempt.create({
              data: { payoutId, attemptNo, status: 'accepted', providerRef: result.providerRef },
            }),
            this.db.payoutRequest.update({
              where: { id: payoutId },
              data: { status: PayoutStatus.PROCESSING, providerRef: result.providerRef },
            }),
          ]);
          this.logger.log(`Payout ${payoutId} accepted by provider (ref=${result.providerRef})`);
          return;
        }

        // Business failure (not transient): release funds, do not retry.
        lastError = result.error ?? 'provider_rejected';
        await this.failAndRelease(payoutId, lastError, attemptNo);
        return;
      } catch (e) {
        lastError = (e as Error).message;
        this.logger.warn(`Payout ${payoutId} transfer attempt ${i + 1} errored: ${lastError}`);
      }
    }

    // Exhausted transient retries → release funds and mark failed.
    await this.failAndRelease(payoutId, lastError ?? 'transfer_failed', attemptNo);
  }

  // ─── 7–8: webhook reconciliation (replay-protected) ────────────────────────

  async handleWebhook(providerName: string, rawBody: Buffer | string, signature?: string) {
    const provider = this.registry.get(providerName);
    if (!provider) {
      throw new BadRequestException(`Unknown payout provider '${providerName}'`);
    }
    if (!provider.verifyWebhookSignature(rawBody, signature)) {
      throw new UnauthorizedException('Invalid payout webhook signature');
    }
    const parsed = provider.parseWebhook(rawBody);
    const payload =
      typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');

    return this.db.$transaction(async (tx) => {
      // Replay protection: a duplicate delivery collides on dedupeKey.
      try {
        await tx.payoutWebhook.create({
          data: {
            event: parsed.event,
            providerRef: parsed.reference,
            dedupeKey: parsed.dedupeKey,
            rawPayload: JSON.parse(payload) as Prisma.InputJsonValue,
          },
        });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          return { handled: true, deduped: true };
        }
        throw e;
      }

      if (parsed.outcome === 'other' || (!parsed.reference && !parsed.providerRef)) {
        return { handled: true, matched: false, outcome: parsed.outcome };
      }

      // Match by our reference (PayoutRequest.id) first; fall back to the
      // provider transfer id for rails whose webhook carries only that (Wise).
      let payout = parsed.reference
        ? await tx.payoutRequest.findUnique({ where: { id: parsed.reference } })
        : null;
      if (!payout && parsed.providerRef) {
        payout = await tx.payoutRequest.findFirst({ where: { providerRef: parsed.providerRef } });
      }
      if (!payout) return { handled: true, matched: false };

      // Link the webhook row to its payout now that we have it.
      await tx.payoutWebhook.updateMany({
        where: { dedupeKey: parsed.dedupeKey },
        data: { payoutId: payout.id },
      });

      const wallet = await tx.wallet.findUnique({ where: { userId: payout.userId } });
      if (!wallet) return { handled: true, matched: false };

      if (parsed.outcome === 'success') {
        if (payout.status === PayoutStatus.PAID) return { handled: true, deduped: true };
        // Finalize: reserved funds leave the system; write the canonical debit.
        await tx.wallet.update({
          where: { id: wallet.id },
          data: { reservedCoins: { decrement: payout.amountCoins } },
        });
        await appendWalletEntry(tx, {
          walletId: wallet.id,
          type: 'DEBIT',
          coinAmount: payout.amountCoins,
          description: 'payout_settled',
          idempotencyKey: `payout_settled:${payout.id}`,
        });
        await tx.payoutRequest.update({
          where: { id: payout.id },
          data: { status: PayoutStatus.PAID },
        });
        return { handled: true, outcome: 'paid', payoutId: payout.id };
      }

      // outcome === 'failed' → release reserved funds back to spendable.
      if (payout.status === PayoutStatus.PAID || payout.status === PayoutStatus.FAILED) {
        return { handled: true, deduped: true };
      }
      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          reservedCoins: { decrement: payout.amountCoins },
          coinBalance: { increment: payout.amountCoins },
        },
      });
      await tx.payoutRequest.update({
        where: { id: payout.id },
        data: { status: PayoutStatus.FAILED, failureReason: parsed.event },
      });
      return { handled: true, outcome: 'failed', payoutId: payout.id };
    }, SERIALIZABLE);
  }

  // ─── Queries ────────────────────────────────────────────────────────────────

  async listForUser(userId: string, limit = 50, offset = 0) {
    const [items, total] = await Promise.all([
      this.db.payoutRequest.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.db.payoutRequest.count({ where: { userId } }),
    ]);
    return { items, total };
  }

  // ─── Internals ──────────────────────────────────────────────────────────────

  private async failAndRelease(payoutId: string, reason: string, attemptNo: number): Promise<void> {
    await this.db.$transaction(async (tx) => {
      const payout = await tx.payoutRequest.findUnique({ where: { id: payoutId } });
      if (!payout || payout.status !== PayoutStatus.REQUESTED) return;

      const wallet = await tx.wallet.findUnique({ where: { userId: payout.userId } });
      if (wallet) {
        await tx.wallet.update({
          where: { id: wallet.id },
          data: {
            reservedCoins: { decrement: payout.amountCoins },
            coinBalance: { increment: payout.amountCoins },
          },
        });
      }
      await tx.payoutAttempt.create({
        data: { payoutId, attemptNo, status: 'error', error: reason },
      });
      await tx.payoutRequest.update({
        where: { id: payoutId },
        data: { status: PayoutStatus.FAILED, failureReason: reason },
      });
    }, SERIALIZABLE);
    this.logger.warn(`Payout ${payoutId} failed and funds released: ${reason}`);
  }
}
