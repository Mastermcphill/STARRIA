import { generateKeyPairSync, createSign } from 'crypto';
import { BadRequestException, UnprocessableEntityException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import type { ProviderToggleService } from '../payments/provider-toggle.service';
import { PayoutService } from './payout.service';
import { PayoutProviderRegistry } from './payout-provider.registry';
import { RecipientOnboardingRegistry } from './recipient-onboarding.registry';
import { CoinConversionService } from './coin-conversion.service';
import type { PayoutProviderPort } from './ports/payout-provider.port';
import type { RecipientOnboardingPort } from './ports/recipient-onboarding.port';
import { verifyRsaSignature } from '../coin-purchase/providers/webhook-crypto.util';

const payoutRail: PayoutProviderPort = {
  name: 'fakeonboard',
  transfer: jest.fn(),
  verifyWebhookSignature: jest.fn(() => true),
  parseWebhook: jest.fn(),
};

const onboardingRail: RecipientOnboardingPort = {
  name: 'fakeonboard',
  createOnboardingLink: jest.fn(),
  getRecipientStatus: jest.fn(),
  verifyOnboardingWebhook: jest.fn(() => true),
  parseOnboardingWebhook: jest.fn(),
};

function makeService(recipient: { providerRef: string | null; payable: boolean; status: string } | null) {
  const reserve = jest.fn();
  const db = {
    payoutRecipient: { findUnique: jest.fn().mockResolvedValue(recipient) },
    // If the gate ever fails to throw, this would run and we'd notice via reserve.
    $transaction: jest.fn(async (fn: any) => fn({ wallet: { findUnique: reserve } })),
  } as unknown as PrismaService;
  const toggles = { assertEnabled: jest.fn() } as unknown as ProviderToggleService;
  const svc = new PayoutService(
    db,
    new PayoutProviderRegistry([payoutRail]),
    toggles,
    new RecipientOnboardingRegistry([onboardingRail]),
    new CoinConversionService({ get: () => undefined } as any),
  );
  return { svc, db, reserve };
}

describe('payout recipient gate (onboarding rails)', () => {
  const input = { amount: 100, destination: 'ignored', provider: 'fakeonboard' };

  it('rejects a withdrawal with no onboarded recipient — before reserving funds', async () => {
    const { svc, reserve } = makeService(null);
    await expect(svc.requestWithdrawal('u1', input)).rejects.toBeInstanceOf(BadRequestException);
    expect(reserve).not.toHaveBeenCalled();
  });

  it('rejects a withdrawal when the recipient is not payable', async () => {
    const { svc, reserve } = makeService({ providerRef: 'acct_1', payable: false, status: 'restricted' });
    await expect(svc.requestWithdrawal('u1', input)).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(reserve).not.toHaveBeenCalled();
  });

  it('looks the recipient up by (userId, provider)', async () => {
    const { svc, db } = makeService(null);
    await svc.requestWithdrawal('u1', input).catch(() => undefined);
    expect((db.payoutRecipient.findUnique as jest.Mock)).toHaveBeenCalledWith({
      where: { userId_provider: { userId: 'u1', provider: 'fakeonboard' } },
    });
  });
});

describe('verifyRsaSignature (Wise-style webhook auth)', () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const pubPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const body = JSON.stringify({ event_type: 'transfers#state-change', data: { resource: { id: 42 } } });
  const sign = (payload: string) => {
    const s = createSign('RSA-SHA256');
    s.update(payload);
    s.end();
    return s.sign(privateKey, 'base64');
  };

  it('accepts a correctly signed body', () => {
    expect(verifyRsaSignature(pubPem, body, sign(body))).toBe(true);
  });

  it('rejects a tampered body, a wrong signature, and missing inputs', () => {
    expect(verifyRsaSignature(pubPem, body + ' ', sign(body))).toBe(false);
    expect(verifyRsaSignature(pubPem, body, 'bm90LWFzaWc=')).toBe(false);
    expect(verifyRsaSignature(pubPem, body, undefined)).toBe(false);
    expect(verifyRsaSignature('', body, sign(body))).toBe(false);
  });
});
