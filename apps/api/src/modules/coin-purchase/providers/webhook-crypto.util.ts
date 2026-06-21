import { createHmac, createVerify, timingSafeEqual } from 'crypto';

/** Constant-time string compare that never throws on length mismatch. */
export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/** Hex-encoded HMAC of `payload` under `secret`. */
export function hmacHex(
  algo: 'sha256' | 'sha512',
  secret: string,
  payload: Buffer | string,
): string {
  return createHmac(algo, secret)
    .update(typeof payload === 'string' ? Buffer.from(payload) : payload)
    .digest('hex');
}

/** True iff `signature` matches HMAC(algo, secret, payload), constant-time. */
export function verifyHmac(
  algo: 'sha256' | 'sha512',
  secret: string,
  payload: Buffer | string,
  signature: string | undefined,
): boolean {
  if (!secret || !signature) return false;
  return safeEqual(hmacHex(algo, secret, payload), signature);
}

/** Normalise a raw body to a UTF-8 string for JSON parsing. */
export function bodyToString(rawBody: Buffer | string): string {
  return typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
}

const DEFAULT_TOLERANCE_SECONDS = 5 * 60;

/**
 * Verify a Stripe `stripe-signature` header:
 *   t=<unix>,v1=<hex hmac sha256 of `${t}.${body}` under secret>
 * Multiple v1 entries (secret rotation) are accepted; stale timestamps rejected.
 */
export function verifyStripeSignature(
  secret: string,
  rawBody: Buffer | string,
  header: string | undefined,
  toleranceSeconds = DEFAULT_TOLERANCE_SECONDS,
): boolean {
  if (!secret || !header) return false;
  let t = '';
  const sigs: string[] = [];
  for (const part of header.split(',')) {
    const [k, v] = part.split('=');
    if (k === 't') t = v;
    else if (k === 'v1' && v) sigs.push(v);
  }
  if (!t || sigs.length === 0) return false;
  const age = Math.floor(Date.now() / 1000) - Number(t);
  if (!Number.isFinite(age) || age > toleranceSeconds) return false;
  const expected = hmacHex('sha256', secret, `${t}.${bodyToString(rawBody)}`);
  return sigs.some((s) => safeEqual(expected, s));
}

/**
 * Verify a Paddle `Paddle-Signature` header:
 *   ts=<unix>;h1=<hex hmac sha256 of `${ts}:${body}` under secret>
 */
export function verifyPaddleSignature(
  secret: string,
  rawBody: Buffer | string,
  header: string | undefined,
  toleranceSeconds = DEFAULT_TOLERANCE_SECONDS,
): boolean {
  if (!secret || !header) return false;
  let ts = '';
  let h1 = '';
  for (const part of header.split(';')) {
    const [k, v] = part.split('=');
    if (k === 'ts') ts = v;
    else if (k === 'h1') h1 = v;
  }
  if (!ts || !h1) return false;
  const age = Math.floor(Date.now() / 1000) - Number(ts);
  if (!Number.isFinite(age) || age > toleranceSeconds) return false;
  return safeEqual(hmacHex('sha256', secret, `${ts}:${bodyToString(rawBody)}`), h1);
}

/**
 * Verify an RSA public-key signature over the raw body (used by Wise, which
 * signs payout/recipient webhooks with RSA-SHA256 and sends the base64
 * signature in the `X-Signature-SHA256` header). `publicKeyPem` is the rail's
 * PEM-encoded public key. Returns false on any malformed input — never throws.
 */
export function verifyRsaSignature(
  publicKeyPem: string,
  rawBody: Buffer | string,
  signatureBase64: string | undefined,
  algorithm: 'RSA-SHA256' | 'RSA-SHA1' = 'RSA-SHA256',
): boolean {
  if (!publicKeyPem || !signatureBase64) return false;
  try {
    const verifier = createVerify(algorithm);
    verifier.update(typeof rawBody === 'string' ? Buffer.from(rawBody) : rawBody);
    verifier.end();
    return verifier.verify(publicKeyPem, signatureBase64, 'base64');
  } catch {
    return false;
  }
}
