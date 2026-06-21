/**
 * Retry an async operation with exponential backoff + jitter. Used for
 * outbound payment-provider HTTP calls, which fail transiently under load.
 *
 * Retries only on the predicate (default: network / 5xx). Non-retryable errors
 * (4xx, validation) propagate immediately so we don't hammer the provider.
 */
export interface RetryOptions {
  retries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  isRetryable?: (err: unknown) => boolean;
  onRetry?: (attempt: number, err: unknown) => void;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const retries = opts.retries ?? 3;
  const base = opts.baseDelayMs ?? 250;
  const max = opts.maxDelayMs ?? 4_000;
  const isRetryable = opts.isRetryable ?? (() => true);

  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === retries || !isRetryable(err)) break;
      opts.onRetry?.(attempt + 1, err);
      const expo = Math.min(max, base * 2 ** attempt);
      const jitter = Math.floor(Math.random() * (expo / 2));
      await new Promise((r) => setTimeout(r, expo + jitter));
    }
  }
  throw lastErr;
}

/** True for transient HTTP failures worth retrying (network errors, 408, 429, 5xx). */
export function isTransientHttpError(err: unknown): boolean {
  if (err instanceof RetryableHttpError) {
    return err.status === 408 || err.status === 429 || err.status >= 500;
  }
  // fetch network failures throw TypeError
  return err instanceof TypeError;
}

export class RetryableHttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'RetryableHttpError';
  }
}
