import { createHmac } from 'crypto';
import type { ConfigService } from '@nestjs/config';
import { TrolleyPayoutProvider, mapRecipient } from './trolley-payout.provider';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cfg = (env: Record<string, string>): ConfigService =>
  ({ get: (k: string) => env[k] }) as any;

// Trolley signs webhooks Stripe-style: t=<unix>,v1=<hex hmac of `${t}.${body}`>.
const trolleySig = (secret: string, body: string) => {
  const t = Math.floor(Date.now() / 1000);
  const sig = createHmac('sha256', secret).update(`${t}.${body}`).digest('hex');
  return `t=${t},v1=${sig}`;
};

describe('TrolleyPayoutProvider', () => {
  const provider = new TrolleyPayoutProvider(cfg({
    TROLLEY_ACCESS_KEY: 'AK',
    TROLLEY_SECRET_KEY: 'SK',
    TROLLEY_WEBHOOK_SECRET: 'whsec_trolley',
  }));

  describe('recipient → status mapping', () => {
    it('active ⇒ active + payable', () => {
      expect(mapRecipient({ status: 'active' })).toMatchObject({ status: 'active', payable: true });
    });
    it('blocked/suspended ⇒ rejected', () => {
      expect(mapRecipient({ status: 'blocked' })).toMatchObject({ status: 'rejected', payable: false });
      expect(mapRecipient({ status: 'suspended' })).toMatchObject({ status: 'rejected', payable: false });
    });
    it('disabled/archived ⇒ disabled', () => {
      expect(mapRecipient({ status: 'archived' })).toMatchObject({ status: 'disabled', payable: false });
    });
    it('incomplete (or unknown) ⇒ onboarding', () => {
      expect(mapRecipient({ status: 'incomplete' })).toMatchObject({ status: 'onboarding', payable: false });
      expect(mapRecipient({})).toMatchObject({ status: 'onboarding', payable: false });
    });
  });

  describe('onboarding webhook (recipient.*)', () => {
    const body = JSON.stringify({
      model: 'recipient',
      action: 'updated',
      body: { recipient: { id: 'R-123', status: 'active', referenceId: 'rec-1' } },
    });

    it('verifies the X-PR-Signature and parses payable status', () => {
      expect(provider.verifyOnboardingWebhook(body, { 'x-pr-signature': trolleySig('whsec_trolley', body) })).toBe(true);
      expect(provider.parseOnboardingWebhook(body)).toMatchObject({
        event: 'recipient.updated',
        providerRef: 'R-123',
        status: 'active',
        payable: true,
      });
    });

    it('accepts the legacy X-PaymentRails-Signature header too', () => {
      expect(
        provider.verifyOnboardingWebhook(body, { 'x-paymentrails-signature': trolleySig('whsec_trolley', body) }),
      ).toBe(true);
    });

    it('rejects a bad signature and ignores non-recipient models', () => {
      expect(provider.verifyOnboardingWebhook(body, { 'x-pr-signature': 't=1,v1=deadbeef' })).toBe(false);
      const payment = JSON.stringify({ model: 'payment', action: 'processed', body: { payment: {} } });
      expect(provider.parseOnboardingWebhook(payment)).toBeNull();
    });
  });

  describe('settlement webhook (payment.*)', () => {
    it('maps payment.processed ⇒ success and links externalId as the reference', () => {
      const body = JSON.stringify({
        model: 'payment',
        action: 'processed',
        body: { payment: { id: 'P-1', status: 'processed', externalId: 'payout-abc' } },
      });
      expect(provider.verifyWebhookSignature(body, trolleySig('whsec_trolley', body))).toBe(true);
      expect(provider.parseWebhook(body)).toMatchObject({
        reference: 'payout-abc',
        providerRef: 'P-1',
        outcome: 'success',
      });
    });

    it('maps payment.failed and payment.returned ⇒ failed', () => {
      const failed = JSON.stringify({ model: 'payment', action: 'failed', body: { payment: { id: 'P-2', externalId: 'x' } } });
      const returned = JSON.stringify({ model: 'payment', action: 'returned', body: { payment: { id: 'P-3', externalId: 'y' } } });
      expect(provider.parseWebhook(failed)).toMatchObject({ outcome: 'failed' });
      expect(provider.parseWebhook(returned)).toMatchObject({ outcome: 'failed' });
    });

    it('treats other payment events as "other"', () => {
      const created = JSON.stringify({ model: 'payment', action: 'created', body: { payment: { id: 'P-4' } } });
      expect(provider.parseWebhook(created)).toMatchObject({ outcome: 'other' });
    });
  });

  it('transfer fails closed when unconfigured', async () => {
    const unconfigured = new TrolleyPayoutProvider(cfg({}));
    const res = await unconfigured.transfer({
      reference: 'r', amountMinorUnits: 1500, currency: 'USD', destination: 'R-1',
    });
    expect(res).toMatchObject({ accepted: false, status: 'failed', error: 'trolley_not_configured' });
  });

  it('createOnboardingLink throws when unconfigured', async () => {
    const unconfigured = new TrolleyPayoutProvider(cfg({}));
    await expect(
      unconfigured.createOnboardingLink({ userId: 'u', recipientId: 'rec-1', returnUrl: 'https://x/return' }),
    ).rejects.toThrow('trolley_not_configured');
  });
});
