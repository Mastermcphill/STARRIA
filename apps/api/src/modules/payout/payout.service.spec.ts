import { UnauthorizedException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PayoutService } from './payout.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PayoutProviderRegistry } from './payout-provider.registry';
import { RecipientOnboardingRegistry } from './recipient-onboarding.registry';
import { CoinConversionService } from './coin-conversion.service';
import type { ProviderToggleService } from '../payments/provider-toggle.service';
import type { PayoutProviderPort } from './ports/payout-provider.port';

/**
 * Minimal stateful in-memory stand-in for the slice of Prisma the payout
 * service uses, so the real reservation/finalize/release logic is exercised.
 */
function makeFakeDb() {
  const wallets = new Map<string, any>(); // by userId
  const payouts = new Map<string, any>(); // by id
  const attempts: any[] = [];
  const webhooks: any[] = [];
  const entries: any[] = [];

  const db: any = {
    _wallets: wallets,
    _payouts: payouts,
    _entries: entries,
    wallet: {
      findUnique: async ({ where }: any) => {
        if (where.userId) return wallets.get(where.userId) ?? null;
        for (const w of wallets.values()) if (w.id === where.id) return w;
        return null;
      },
      update: async ({ where, data }: any) => {
        let w: any;
        for (const x of wallets.values()) if (x.id === where.id) w = x;
        if (!w) throw new Error('wallet not found');
        for (const [k, v] of Object.entries<any>(data)) {
          if (v && typeof v === 'object' && 'increment' in v) w[k] += v.increment;
          else if (v && typeof v === 'object' && 'decrement' in v) w[k] -= v.decrement;
          else w[k] = v;
        }
        return w;
      },
    },
    payoutRequest: {
      findUnique: async ({ where }: any) => {
        if (where.id) return payouts.get(where.id) ?? null;
        if (where.idempotencyKey)
          return [...payouts.values()].find((p) => p.idempotencyKey === where.idempotencyKey) ?? null;
        return null;
      },
      create: async ({ data }: any) => {
        const rec = { id: randomUUID(), providerRef: null, failureReason: null, ...data };
        payouts.set(rec.id, rec);
        return rec;
      },
      update: async ({ where, data }: any) => {
        const rec = payouts.get(where.id);
        Object.assign(rec, data);
        return rec;
      },
      findFirst: async ({ where }: any) =>
        [...payouts.values()].find((p) => (where.providerRef ? p.providerRef === where.providerRef : false)) ?? null,
      findMany: async () => [...payouts.values()],
      count: async () => payouts.size,
    },
    payoutAttempt: {
      count: async ({ where }: any) => attempts.filter((a) => a.payoutId === where.payoutId).length,
      create: async ({ data }: any) => {
        const rec = { id: randomUUID(), ...data };
        attempts.push(rec);
        return rec;
      },
    },
    payoutWebhook: {
      create: async ({ data }: any) => {
        if (webhooks.some((w) => w.dedupeKey === data.dedupeKey)) {
          throw new Prisma.PrismaClientKnownRequestError('dup', {
            code: 'P2002',
            clientVersion: 'test',
          } as any);
        }
        const rec = { id: randomUUID(), payoutId: null, ...data };
        webhooks.push(rec);
        return rec;
      },
      updateMany: async ({ where, data }: any) => {
        webhooks.filter((w) => w.dedupeKey === where.dedupeKey).forEach((w) => Object.assign(w, data));
        return { count: 1 };
      },
    },
    walletEntry: {
      findFirst: async ({ where }: any) => {
        const rows = entries.filter((e) => e.walletId === where.walletId).sort((a, b) => b.sequence - a.sequence);
        return rows[0] ?? null;
      },
      create: async ({ data }: any) => {
        entries.push(data);
        return data;
      },
    },
    $transaction: async (arg: any) => {
      if (typeof arg === 'function') return arg(db);
      return Promise.all(arg);
    },
  };
  return db;
}

function provider(overrides: Partial<PayoutProviderPort> = {}): PayoutProviderPort {
  return {
    name: 'fake',
    transfer: jest.fn(async () => ({ accepted: true, providerRef: 'tc_1', status: 'processing' as const })),
    verifyWebhookSignature: jest.fn(() => true),
    parseWebhook: jest.fn((raw: Buffer | string) => {
      const body = JSON.parse(typeof raw === 'string' ? raw : raw.toString());
      const event = body.event;
      return {
        event,
        reference: body.data?.reference,
        dedupeKey: `${event}:${body.data?.id ?? body.data?.reference}`,
        outcome: event === 'transfer.success' ? 'success' : event === 'transfer.failed' ? 'failed' : 'other',
      };
    }),
    ...overrides,
  } as PayoutProviderPort;
}

describe('PayoutService', () => {
  let db: any;

  beforeEach(() => {
    db = makeFakeDb();
    db._wallets.set('u1', { id: 'w1', userId: 'u1', coinBalance: 1000, reservedCoins: 0 });
  });

  function svcWith(p: PayoutProviderPort) {
    const registry = new PayoutProviderRegistry([p]);
    // 'fake' isn't in the provider catalog, so assertEnabled is never reached;
    // a no-op toggles stub satisfies the constructor.
    const toggles = { assertEnabled: jest.fn() } as unknown as ProviderToggleService;
    // No onboarding rails — 'fake' is not an onboarding provider, so the
    // recipient gate is skipped and destination is used as-is.
    const onboarding = new RecipientOnboardingRegistry([]);
    // Real conversion service with default rates; 'fake' rail resolves to USD.
    const conversion = new CoinConversionService({ get: () => undefined } as any);
    return new PayoutService(db as PrismaService, registry, toggles, onboarding, conversion);
  }

  it('reserves funds and initiates a payout on request', async () => {
    const svc = svcWith(provider());
    const rec = await svc.requestWithdrawal('u1', { amount: 200, provider: 'fake', destination: 'rcp_1', idempotencyKey: 'k1' });
    expect(rec!.status).toBe('PROCESSING');
    expect(db._wallets.get('u1').coinBalance).toBe(800);
    expect(db._wallets.get('u1').reservedCoins).toBe(200);
  });

  it('dedupes duplicate requests on the idempotency key (reserve once)', async () => {
    const svc = svcWith(provider());
    const first = await svc.requestWithdrawal('u1', { amount: 200, provider: 'fake', destination: 'rcp_1', idempotencyKey: 'dup' });
    const second = await svc.requestWithdrawal('u1', { amount: 200, provider: 'fake', destination: 'rcp_1', idempotencyKey: 'dup' });
    expect(second!.id).toBe(first!.id);
    expect(db._wallets.get('u1').coinBalance).toBe(800); // only one reservation
    expect(db._wallets.get('u1').reservedCoins).toBe(200);
  });

  it('rejects on insufficient balance and reserves nothing', async () => {
    const svc = svcWith(provider());
    await expect(
      svc.requestWithdrawal('u1', { amount: 5000, provider: 'fake', destination: 'rcp_1', idempotencyKey: 'k2' }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(db._wallets.get('u1').coinBalance).toBe(1000);
    expect(db._wallets.get('u1').reservedCoins).toBe(0);
  });

  it('finalizes (debits reserved) on a success webhook', async () => {
    const svc = svcWith(provider());
    const rec = await svc.requestWithdrawal('u1', { amount: 200, provider: 'fake', destination: 'rcp_1', idempotencyKey: 'k3' });
    const body = JSON.stringify({ event: 'transfer.success', data: { reference: rec!.id, id: 'evt1' } });

    const res = await svc.handleWebhook('fake', body, 'sig');
    expect(res).toMatchObject({ handled: true, outcome: 'paid' });
    const w = db._wallets.get('u1');
    expect(w.reservedCoins).toBe(0);
    expect(w.coinBalance).toBe(800); // money left the system
    expect(db._payouts.get(rec!.id).status).toBe('PAID');
    expect(db._entries.some((e: any) => e.type === 'DEBIT')).toBe(true);
  });

  it('releases reserved funds on a failed webhook', async () => {
    const svc = svcWith(provider());
    const rec = await svc.requestWithdrawal('u1', { amount: 200, provider: 'fake', destination: 'rcp_1', idempotencyKey: 'k4' });
    const body = JSON.stringify({ event: 'transfer.failed', data: { reference: rec!.id, id: 'evt2' } });

    const res = await svc.handleWebhook('fake', body, 'sig');
    expect(res).toMatchObject({ handled: true, outcome: 'failed' });
    const w = db._wallets.get('u1');
    expect(w.reservedCoins).toBe(0);
    expect(w.coinBalance).toBe(1000); // funds returned
    expect(db._payouts.get(rec!.id).status).toBe('FAILED');
  });

  it('is replay-safe: a duplicate webhook does not mutate balance twice', async () => {
    const svc = svcWith(provider());
    const rec = await svc.requestWithdrawal('u1', { amount: 200, provider: 'fake', destination: 'rcp_1', idempotencyKey: 'k5' });
    const body = JSON.stringify({ event: 'transfer.success', data: { reference: rec!.id, id: 'evtdup' } });

    await svc.handleWebhook('fake', body, 'sig');
    const balAfterFirst = db._wallets.get('u1').coinBalance;
    const debitCount = db._entries.filter((e: any) => e.type === 'DEBIT').length;

    const replay = await svc.handleWebhook('fake', body, 'sig');
    expect(replay).toMatchObject({ deduped: true });
    expect(db._wallets.get('u1').coinBalance).toBe(balAfterFirst);
    expect(db._entries.filter((e: any) => e.type === 'DEBIT').length).toBe(debitCount);
  });

  it('rejects a webhook with an invalid signature', async () => {
    const svc = svcWith(provider({ verifyWebhookSignature: jest.fn(() => false) }));
    await expect(svc.handleWebhook('fake', '{}', 'bad')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('marks FAILED and releases funds when the provider rejects the transfer', async () => {
    const svc = svcWith(
      provider({ transfer: jest.fn(async () => ({ accepted: false, status: 'failed' as const, error: 'rejected' })) }),
    );
    const rec = await svc.requestWithdrawal('u1', { amount: 200, provider: 'fake', destination: 'rcp_1', idempotencyKey: 'k6' });
    expect(rec!.status).toBe('FAILED');
    const w = db._wallets.get('u1');
    expect(w.coinBalance).toBe(1000);
    expect(w.reservedCoins).toBe(0);
  });
});
