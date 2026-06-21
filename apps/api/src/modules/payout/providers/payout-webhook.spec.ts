import { createHmac } from 'crypto';
import type { ConfigService } from '@nestjs/config';
import { FlutterwavePayoutProvider, parseBankDestination } from './flutterwave-payout.provider';
import { KorapayPayoutProvider } from './korapay-payout.provider';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cfg = (env: Record<string, string>): ConfigService =>
  ({ get: (k: string) => env[k] }) as any;

describe('payout webhook verification', () => {
  describe('Flutterwave (verif-hash equality)', () => {
    const p = new FlutterwavePayoutProvider(cfg({ FLUTTERWAVE_WEBHOOK_SECRET: 'sek' }));
    const body = JSON.stringify({
      event: 'transfer.completed',
      data: { reference: 'po1', id: 99, status: 'SUCCESSFUL' },
    });

    it('verifies the secret hash and maps SUCCESSFUL → success', () => {
      expect(p.verifyWebhookSignature(body, 'sek')).toBe(true);
      expect(p.verifyWebhookSignature(body, 'nope')).toBe(false);
      expect(p.parseWebhook(body)).toMatchObject({ reference: 'po1', outcome: 'success' });
    });

    it('maps FAILED → failed', () => {
      const failed = JSON.stringify({ event: 'transfer.completed', data: { reference: 'po1', id: 99, status: 'FAILED' } });
      expect(p.parseWebhook(failed).outcome).toBe('failed');
    });
  });

  describe('Korapay (HMAC-SHA256 over data)', () => {
    const p = new KorapayPayoutProvider(cfg({ KORAPAY_SECRET_KEY: 'sk_kora' }));
    const data = { reference: 'po2', status: 'success' };
    const body = JSON.stringify({ event: 'transfer.success', data });

    it('verifies a signature over the data object and parses success', () => {
      const sig = createHmac('sha256', 'sk_kora').update(JSON.stringify(data)).digest('hex');
      expect(p.verifyWebhookSignature(body, sig)).toBe(true);
      expect(p.verifyWebhookSignature(body, 'bad')).toBe(false);
      expect(p.parseWebhook(body)).toMatchObject({ reference: 'po2', outcome: 'success' });
    });

    it('maps transfer.failed → failed', () => {
      const failed = JSON.stringify({ event: 'transfer.failed', data: { reference: 'po2', status: 'failed' } });
      expect(p.parseWebhook(failed).outcome).toBe('failed');
    });
  });

  describe('parseBankDestination', () => {
    it('parses "<bankCode>:<accountNumber>"', () => {
      expect(parseBankDestination('044:0690000031')).toEqual({ bankCode: '044', accountNumber: '0690000031' });
    });
    it('rejects malformed destinations', () => {
      expect(parseBankDestination('044')).toBeNull();
      expect(parseBankDestination(':123')).toBeNull();
      expect(parseBankDestination('044:')).toBeNull();
    });
  });
});
