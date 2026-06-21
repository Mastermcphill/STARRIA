import { createHmac } from 'crypto';
import type { ConfigService } from '@nestjs/config';
import { TipaltiPayoutProvider, mapPayee } from './tipalti-payout.provider';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cfg = (env: Record<string, string>): ConfigService =>
  ({ get: (k: string) => env[k] }) as any;

// Tipalti signs webhooks with a plain hex HMAC-SHA256 of the raw body.
const tipaltiSig = (secret: string, body: string) =>
  createHmac('sha256', secret).update(body).digest('hex');

describe('TipaltiPayoutProvider', () => {
  const provider = new TipaltiPayoutProvider(cfg({
    TIPALTI_PAYER_NAME: 'STARRIA',
    TIPALTI_API_KEY: 'apikey',
    TIPALTI_WEBHOOK_SECRET: 'whsec_tipalti',
  }));

  describe('payee → status mapping', () => {
    it('payable ⇒ active + payable', () => {
      expect(mapPayee({ isPayable: true })).toMatchObject({ status: 'active', payable: true });
    });
    it('blocked ⇒ rejected (takes precedence over payable)', () => {
      expect(mapPayee({ isPayable: true, isBlocked: true })).toMatchObject({ status: 'rejected', payable: false });
    });
    it('suspended ⇒ restricted', () => {
      expect(mapPayee({ isSuspended: true })).toMatchObject({ status: 'restricted', payable: false });
    });
    it('not payable yet, no block ⇒ onboarding', () => {
      expect(mapPayee({ isPayable: false })).toMatchObject({ status: 'onboarding', payable: false });
      expect(mapPayee({})).toMatchObject({ status: 'onboarding', payable: false });
    });
  });

  describe('onboarding link', () => {
    it('builds a signed iframe URL keyed by the recipient idap, no API call', async () => {
      const res = await provider.createOnboardingLink({
        userId: 'u', recipientId: 'rec-1', returnUrl: 'https://x/return', email: 'p@x.io',
      });
      expect(res.providerRef).toBe('rec-1');
      expect(res.ready).toBe(false);
      const url = new URL(res.url!);
      expect(url.searchParams.get('idap')).toBe('rec-1');
      expect(url.searchParams.get('payer')).toBe('STARRIA');
      expect(url.searchParams.get('hashkey')).toMatch(/^[0-9a-f]{64}$/);
    });

    it('throws when unconfigured', async () => {
      const unconfigured = new TipaltiPayoutProvider(cfg({}));
      await expect(
        unconfigured.createOnboardingLink({ userId: 'u', recipientId: 'rec-1', returnUrl: 'https://x' }),
      ).rejects.toThrow('tipalti_not_configured');
    });
  });

  describe('onboarding webhook (payee.*)', () => {
    const body = JSON.stringify({
      id: 'evt_1',
      type: 'payee.updated',
      data: { idap: 'rec-1', isPayable: true },
    });

    it('verifies the X-Tipalti-Signature and parses payable status', () => {
      expect(provider.verifyOnboardingWebhook(body, { 'x-tipalti-signature': tipaltiSig('whsec_tipalti', body) })).toBe(true);
      expect(provider.parseOnboardingWebhook(body)).toMatchObject({
        event: 'payee.updated',
        providerRef: 'rec-1',
        status: 'active',
        payable: true,
      });
    });

    it('rejects a bad signature and ignores non-payee events', () => {
      expect(provider.verifyOnboardingWebhook(body, { 'x-tipalti-signature': 'deadbeef' })).toBe(false);
      const payment = JSON.stringify({ type: 'payment.completed', data: { refCode: 'x' } });
      expect(provider.parseOnboardingWebhook(payment)).toBeNull();
    });
  });

  describe('settlement webhook (payment.*)', () => {
    it('maps payment.completed ⇒ success and links refCode as the reference', () => {
      const body = JSON.stringify({
        type: 'payment.completed',
        data: { refCode: 'payout-abc', idItem: 'pi_1', status: 'completed' },
      });
      expect(provider.verifyWebhookSignature(body, tipaltiSig('whsec_tipalti', body))).toBe(true);
      expect(provider.parseWebhook(body)).toMatchObject({
        reference: 'payout-abc',
        providerRef: 'pi_1',
        outcome: 'success',
      });
    });

    it('maps payment.error and payment.cancelled ⇒ failed', () => {
      const err = JSON.stringify({ type: 'payment.error', data: { refCode: 'a' } });
      const cancelled = JSON.stringify({ type: 'payment.cancelled', data: { refCode: 'b' } });
      expect(provider.parseWebhook(err)).toMatchObject({ outcome: 'failed' });
      expect(provider.parseWebhook(cancelled)).toMatchObject({ outcome: 'failed' });
    });

    it('treats other payment events as "other"', () => {
      const submitted = JSON.stringify({ type: 'payment.submitted', data: { refCode: 'c' } });
      expect(provider.parseWebhook(submitted)).toMatchObject({ outcome: 'other' });
    });
  });

  it('transfer fails closed when unconfigured', async () => {
    const unconfigured = new TipaltiPayoutProvider(cfg({}));
    const res = await unconfigured.transfer({
      reference: 'r', amountMinorUnits: 1500, currency: 'USD', destination: 'rec-1',
    });
    expect(res).toMatchObject({ accepted: false, status: 'failed', error: 'tipalti_not_configured' });
  });
});
