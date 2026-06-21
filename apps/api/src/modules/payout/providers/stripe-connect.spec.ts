import { createHmac } from 'crypto';
import type { ConfigService } from '@nestjs/config';
import { StripeConnectProvider, mapAccount } from './stripe-connect.provider';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cfg = (env: Record<string, string>): ConfigService =>
  ({ get: (k: string) => env[k] }) as any;

const stripeSig = (secret: string, body: string) => {
  const t = Math.floor(Date.now() / 1000);
  const sig = createHmac('sha256', secret).update(`${t}.${body}`).digest('hex');
  return `t=${t},v1=${sig}`;
};

describe('StripeConnectProvider', () => {
  const provider = new StripeConnectProvider(cfg({
    STRIPE_SECRET_KEY: 'sk_test',
    STRIPE_CONNECT_WEBHOOK_SECRET: 'whsec_connect',
  }));

  describe('account → recipient status mapping', () => {
    it('payouts_enabled ⇒ active + payable', () => {
      expect(mapAccount({ payouts_enabled: true })).toMatchObject({ status: 'active', payable: true });
    });
    it('a rejected disabled_reason ⇒ rejected', () => {
      expect(mapAccount({ payouts_enabled: false, requirements: { disabled_reason: 'rejected.fraud' } }))
        .toMatchObject({ status: 'rejected', payable: false });
    });
    it('a non-rejected disabled_reason ⇒ restricted', () => {
      expect(mapAccount({ payouts_enabled: false, requirements: { disabled_reason: 'requirements.past_due' } }))
        .toMatchObject({ status: 'restricted', payable: false });
    });
    it('no payouts yet, no block ⇒ onboarding', () => {
      expect(mapAccount({ payouts_enabled: false, requirements: { currently_due: ['external_account'] } }))
        .toMatchObject({ status: 'onboarding', payable: false });
    });
  });

  describe('onboarding webhook (account.updated)', () => {
    const body = JSON.stringify({
      id: 'evt_1',
      type: 'account.updated',
      data: { object: { id: 'acct_123', payouts_enabled: true, charges_enabled: true } },
    });

    it('verifies the Connect signature and parses payable status', () => {
      expect(provider.verifyOnboardingWebhook(body, { 'stripe-signature': stripeSig('whsec_connect', body) })).toBe(true);
      expect(provider.parseOnboardingWebhook(body)).toMatchObject({
        providerRef: 'acct_123',
        status: 'active',
        payable: true,
      });
    });

    it('rejects a bad signature and ignores unrelated event types', () => {
      expect(provider.verifyOnboardingWebhook(body, { 'stripe-signature': 't=1,v1=deadbeef' })).toBe(false);
      const other = JSON.stringify({ id: 'e', type: 'payout.paid', data: { object: {} } });
      expect(provider.parseOnboardingWebhook(other)).toBeNull();
    });
  });

  describe('settlement webhook (transfer.*)', () => {
    it('maps transfer.created ⇒ success and links the reference', () => {
      const body = JSON.stringify({
        id: 'evt_2',
        type: 'transfer.created',
        data: { object: { id: 'tr_1', transfer_group: 'payout-abc', metadata: { reference: 'payout-abc' } } },
      });
      expect(provider.verifyWebhookSignature(body, stripeSig('whsec_connect', body))).toBe(true);
      expect(provider.parseWebhook(body)).toMatchObject({ reference: 'payout-abc', outcome: 'success' });
    });

    it('maps transfer.reversed ⇒ failed', () => {
      const body = JSON.stringify({
        id: 'evt_3',
        type: 'transfer.reversed',
        data: { object: { id: 'tr_1', transfer_group: 'payout-abc' } },
      });
      expect(provider.parseWebhook(body)).toMatchObject({ reference: 'payout-abc', outcome: 'failed' });
    });
  });

  it('transfer fails closed when unconfigured', async () => {
    const unconfigured = new StripeConnectProvider(cfg({}));
    const res = await unconfigured.transfer({
      reference: 'r', amountMinorUnits: 1999, currency: 'USD', destination: 'acct_1',
    });
    expect(res).toMatchObject({ accepted: false, status: 'failed', error: 'stripe_not_configured' });
  });
});
