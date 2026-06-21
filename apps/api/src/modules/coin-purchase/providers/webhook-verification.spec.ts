import { createHmac } from 'crypto';
import type { ConfigService } from '@nestjs/config';
import { PaystackProvider } from './paystack.provider';
import { StripeProvider } from './stripe.provider';
import { FlutterwaveProvider } from './flutterwave.provider';
import { KorapayProvider } from './korapay.provider';
import { TazapayProvider } from './tazapay.provider';
import { LemonSqueezyProvider } from './lemonsqueezy.provider';
import { PaddleProvider } from './paddle.provider';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cfg = (env: Record<string, string>): ConfigService =>
  ({ get: (k: string) => env[k] }) as any;

const hmac = (algo: 'sha256' | 'sha512', secret: string, payload: string) =>
  createHmac(algo, secret).update(payload).digest('hex');

describe('checkout webhook signature verification', () => {
  describe('Paystack (HMAC-SHA512 over body)', () => {
    const provider = new PaystackProvider(cfg({ PAYSTACK_SECRET_KEY: 'sk_test' }));
    const body = JSON.stringify({
      event: 'charge.success',
      data: { reference: 'ref1', metadata: { userId: 'u1', coins: 100 } },
    });

    it('accepts a correctly signed body and parses it', () => {
      const sig = hmac('sha512', 'sk_test', body);
      expect(provider.verifyWebhook(body, { 'x-paystack-signature': sig })).toBe(true);
      const parsed = provider.parseWebhook(body);
      expect(parsed).toMatchObject({ success: true, userId: 'u1', coins: 100, reference: 'ref1' });
    });

    it('rejects a tampered body and a missing signature', () => {
      const sig = hmac('sha512', 'sk_test', body);
      expect(provider.verifyWebhook(body + 'x', { 'x-paystack-signature': sig })).toBe(false);
      expect(provider.verifyWebhook(body, {})).toBe(false);
    });
  });

  describe('Stripe (timestamped HMAC-SHA256)', () => {
    const provider = new StripeProvider(cfg({ STRIPE_WEBHOOK_SECRET: 'whsec_test' }));
    const body = JSON.stringify({
      type: 'checkout.session.completed',
      data: { object: { payment_status: 'paid', metadata: { userId: 'u1', coins: '500', reference: 'r2' } } },
    });

    it('accepts a fresh, correctly signed event', () => {
      const t = Math.floor(Date.now() / 1000);
      const sig = hmac('sha256', 'whsec_test', `${t}.${body}`);
      expect(provider.verifyWebhook(body, { 'stripe-signature': `t=${t},v1=${sig}` })).toBe(true);
      expect(provider.parseWebhook(body)).toMatchObject({ success: true, userId: 'u1', coins: 500, reference: 'r2' });
    });

    it('rejects a stale timestamp (replay) and a bad signature', () => {
      const old = Math.floor(Date.now() / 1000) - 3600;
      const sig = hmac('sha256', 'whsec_test', `${old}.${body}`);
      expect(provider.verifyWebhook(body, { 'stripe-signature': `t=${old},v1=${sig}` })).toBe(false);
      const t = Math.floor(Date.now() / 1000);
      expect(provider.verifyWebhook(body, { 'stripe-signature': `t=${t},v1=deadbeef` })).toBe(false);
    });
  });

  describe('Flutterwave (verif-hash equality)', () => {
    const provider = new FlutterwaveProvider(cfg({ FLUTTERWAVE_WEBHOOK_SECRET: 'sekrit-hash' }));
    const body = JSON.stringify({
      event: 'charge.completed',
      data: { tx_ref: 'r3', status: 'successful', meta: { userId: 'u1', coins: 100 } },
    });

    it('accepts the matching secret hash and parses success', () => {
      expect(provider.verifyWebhook(body, { 'verif-hash': 'sekrit-hash' })).toBe(true);
      expect(provider.parseWebhook(body)).toMatchObject({ success: true, userId: 'u1', coins: 100, reference: 'r3' });
    });

    it('rejects a wrong or missing hash', () => {
      expect(provider.verifyWebhook(body, { 'verif-hash': 'nope' })).toBe(false);
      expect(provider.verifyWebhook(body, {})).toBe(false);
    });
  });

  describe('Korapay (HMAC-SHA256 over data object)', () => {
    const provider = new KorapayProvider(cfg({ KORAPAY_SECRET_KEY: 'sk_kora' }));
    const data = { reference: 'r4', status: 'success', metadata: { userId: 'u1', coins: 100 } };
    const body = JSON.stringify({ event: 'charge.success', data });

    it('accepts a signature over the data object only', () => {
      const sig = hmac('sha256', 'sk_kora', JSON.stringify(data));
      expect(provider.verifyWebhook(body, { 'x-korapay-signature': sig })).toBe(true);
      expect(provider.parseWebhook(body)).toMatchObject({ success: true, userId: 'u1', coins: 100, reference: 'r4' });
    });

    it('rejects a signature computed over the whole body', () => {
      const wrong = hmac('sha256', 'sk_kora', body); // signed the whole envelope, not data
      expect(provider.verifyWebhook(body, { 'x-korapay-signature': wrong })).toBe(false);
    });
  });

  describe('Tazapay (HMAC-SHA256 over body)', () => {
    const provider = new TazapayProvider(cfg({ TAZAPAY_WEBHOOK_SECRET: 'tz_sec' }));
    const body = JSON.stringify({
      type: 'charge.succeeded',
      data: { status: 'paid', reference_id: 'r5', metadata: { userId: 'u1', coins: 100 } },
    });

    it('accepts a correctly signed body and parses success', () => {
      const sig = hmac('sha256', 'tz_sec', body);
      expect(provider.verifyWebhook(body, { 'x-tazapay-signature': sig })).toBe(true);
      expect(provider.parseWebhook(body)).toMatchObject({ success: true, userId: 'u1', coins: 100, reference: 'r5' });
    });

    it('rejects a wrong signature', () => {
      expect(provider.verifyWebhook(body, { 'x-tazapay-signature': 'nope' })).toBe(false);
    });
  });

  describe('Lemon Squeezy (X-Signature HMAC-SHA256)', () => {
    const provider = new LemonSqueezyProvider(cfg({ LEMONSQUEEZY_WEBHOOK_SECRET: 'ls_sec' }));
    const body = JSON.stringify({
      meta: { event_name: 'order_created', custom_data: { userId: 'u1', coins: '500', reference: 'r6' } },
      data: { attributes: { status: 'paid' } },
    });

    it('accepts a correctly signed order and parses success', () => {
      const sig = hmac('sha256', 'ls_sec', body);
      expect(provider.verifyWebhook(body, { 'x-signature': sig })).toBe(true);
      expect(provider.parseWebhook(body)).toMatchObject({ success: true, userId: 'u1', coins: 500, reference: 'r6' });
    });

    it('rejects a tampered body', () => {
      const sig = hmac('sha256', 'ls_sec', body);
      expect(provider.verifyWebhook(body + ' ', { 'x-signature': sig })).toBe(false);
    });
  });

  describe('Paddle (timestamped Paddle-Signature HMAC-SHA256)', () => {
    const provider = new PaddleProvider(cfg({ PADDLE_WEBHOOK_SECRET: 'pdl_sec' }));
    const body = JSON.stringify({
      event_type: 'transaction.completed',
      data: { status: 'completed', custom_data: { userId: 'u1', coins: '1500', reference: 'r7' } },
    });

    it('accepts a fresh, correctly signed event', () => {
      const ts = Math.floor(Date.now() / 1000);
      const sig = hmac('sha256', 'pdl_sec', `${ts}:${body}`);
      expect(provider.verifyWebhook(body, { 'paddle-signature': `ts=${ts};h1=${sig}` })).toBe(true);
      expect(provider.parseWebhook(body)).toMatchObject({ success: true, userId: 'u1', coins: 1500, reference: 'r7' });
    });

    it('rejects a stale timestamp', () => {
      const old = Math.floor(Date.now() / 1000) - 3600;
      const sig = hmac('sha256', 'pdl_sec', `${old}:${body}`);
      expect(provider.verifyWebhook(body, { 'paddle-signature': `ts=${old};h1=${sig}` })).toBe(false);
    });
  });
});
