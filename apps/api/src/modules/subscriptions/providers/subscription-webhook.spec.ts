import { createHmac } from 'crypto';
import type { ConfigService } from '@nestjs/config';
import { StripeSubscriptionProvider } from './stripe-subscription.provider';
import { LemonSqueezySubscriptionProvider } from './lemonsqueezy-subscription.provider';
import { PaddleSubscriptionProvider } from './paddle-subscription.provider';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cfg = (env: Record<string, string>): ConfigService =>
  ({ get: (k: string) => env[k] }) as any;

const hmac = (secret: string, payload: string) =>
  createHmac('sha256', secret).update(payload).digest('hex');

describe('subscription webhook signature verification', () => {
  describe('Stripe (timestamped HMAC-SHA256, lifecycle)', () => {
    const provider = new StripeSubscriptionProvider(cfg({ STRIPE_WEBHOOK_SECRET: 'whsec_sub' }));

    it('links checkout.session.completed → subscription id via client_reference_id', () => {
      const body = JSON.stringify({
        id: 'evt_1',
        type: 'checkout.session.completed',
        data: { object: { subscription: 'sub_123', client_reference_id: 'sub:u1:abc' } },
      });
      const t = Math.floor(Date.now() / 1000);
      const sig = hmac('whsec_sub', `${t}.${body}`);
      expect(provider.verifyWebhook(body, { 'stripe-signature': `t=${t},v1=${sig}` })).toBe(true);
      expect(provider.parseWebhook(body)).toMatchObject({
        status: 'active',
        providerSubscriptionId: 'sub_123',
        reference: 'sub:u1:abc',
      });
    });

    it('maps customer.subscription.deleted → cancelled and rejects replays', () => {
      const body = JSON.stringify({
        id: 'evt_2',
        type: 'customer.subscription.deleted',
        data: { object: { id: 'sub_123', status: 'canceled' } },
      });
      const old = Math.floor(Date.now() / 1000) - 3600;
      const sig = hmac('whsec_sub', `${old}.${body}`);
      expect(provider.verifyWebhook(body, { 'stripe-signature': `t=${old};v1=${sig}` })).toBe(false);
      expect(provider.parseWebhook(body)).toMatchObject({ status: 'cancelled', providerSubscriptionId: 'sub_123' });
    });
  });

  describe('Lemon Squeezy (X-Signature HMAC-SHA256, lifecycle)', () => {
    const provider = new LemonSqueezySubscriptionProvider(cfg({ LEMONSQUEEZY_WEBHOOK_SECRET: 'ls_sub' }));
    const body = JSON.stringify({
      meta: { event_name: 'subscription_created', custom_data: { reference: 'sub:u1:xyz' } },
      data: { id: 'ls_sub_1', attributes: { status: 'active', renews_at: '2026-07-21T00:00:00Z' } },
    });

    it('accepts a correctly signed lifecycle event and maps active', () => {
      const sig = hmac('ls_sub', body);
      expect(provider.verifyWebhook(body, { 'x-signature': sig })).toBe(true);
      expect(provider.parseWebhook(body)).toMatchObject({
        status: 'active',
        providerSubscriptionId: 'ls_sub_1',
        reference: 'sub:u1:xyz',
        currentPeriodEnd: '2026-07-21T00:00:00Z',
      });
    });

    it('rejects a tampered body', () => {
      const sig = hmac('ls_sub', body);
      expect(provider.verifyWebhook(body + ' ', { 'x-signature': sig })).toBe(false);
    });
  });

  describe('Paddle (timestamped Paddle-Signature HMAC-SHA256, lifecycle)', () => {
    const provider = new PaddleSubscriptionProvider(cfg({ PADDLE_WEBHOOK_SECRET: 'pdl_sub' }));
    const body = JSON.stringify({
      event_id: 'evt_p1',
      event_type: 'subscription.canceled',
      data: { id: 'pdl_sub_1', status: 'canceled', custom_data: { reference: 'sub:u1:qqq' } },
    });

    it('accepts a fresh signed cancel event and maps cancelled', () => {
      const ts = Math.floor(Date.now() / 1000);
      const sig = hmac('pdl_sub', `${ts}:${body}`);
      expect(provider.verifyWebhook(body, { 'paddle-signature': `ts=${ts};h1=${sig}` })).toBe(true);
      expect(provider.parseWebhook(body)).toMatchObject({
        status: 'cancelled',
        providerSubscriptionId: 'pdl_sub_1',
        reference: 'sub:u1:qqq',
      });
    });

    it('rejects a stale timestamp (replay)', () => {
      const old = Math.floor(Date.now() / 1000) - 3600;
      const sig = hmac('pdl_sub', `${old}:${body}`);
      expect(provider.verifyWebhook(body, { 'paddle-signature': `ts=${old};h1=${sig}` })).toBe(false);
    });
  });
});
