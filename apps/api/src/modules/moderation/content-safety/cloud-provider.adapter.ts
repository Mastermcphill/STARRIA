import { Injectable, Logger } from '@nestjs/common';
import type { ModerationSeverity } from '@starria/moderation-core';
import {
  ContentSafetyProvider,
  SafetyFinding,
  SafetyVerdict,
  decideFromFindings,
} from './content-safety.port';

/**
 * Shape returned by the cloud moderation endpoint. Deliberately generic so it
 * maps onto the common vision/text moderation APIs (AWS Rekognition / Google
 * Cloud Vision SafeSearch / Azure Content Safety / OpenAI moderations) — the
 * adapter normalises whichever one is configured into {@link SafetyFinding}s.
 */
interface CloudModerationResponse {
  categories?: Array<{
    name: string; // e.g. 'nudity', 'violence', 'hate', 'self-harm'
    score: number; // 0..1
  }>;
}

export interface CloudSafetyConfig {
  endpoint: string;
  apiKey: string;
  /** Score at/above which a category is treated as critical (auto-block). */
  blockThreshold: number;
  /** Score at/above which a category is routed to human review. */
  reviewThreshold: number;
  timeoutMs: number;
}

/**
 * Interface-ready adapter to an external ML content-moderation service.
 *
 * This is a real HTTP integration (no fake responses) — it is only constructed
 * by the provider factory when `CONTENT_SAFETY_PROVIDER=cloud` and the endpoint
 * + key are present. With no credentials the platform runs on
 * {@link ManualSafetyProvider} instead, so nothing here pretends to work
 * without live configuration.
 */
@Injectable()
export class CloudProviderAdapter implements ContentSafetyProvider {
  readonly name = 'cloud';
  private readonly logger = new Logger(CloudProviderAdapter.name);

  constructor(private readonly config: CloudSafetyConfig) {}

  /** Build config from env, or null when the cloud provider is not configured. */
  static fromEnv(): CloudSafetyConfig | null {
    const endpoint = process.env.CONTENT_SAFETY_CLOUD_URL;
    const apiKey = process.env.CONTENT_SAFETY_CLOUD_KEY;
    if (!endpoint || !apiKey) return null;
    return {
      endpoint,
      apiKey,
      blockThreshold: Number(process.env.CONTENT_SAFETY_BLOCK_THRESHOLD ?? 0.9),
      reviewThreshold: Number(process.env.CONTENT_SAFETY_REVIEW_THRESHOLD ?? 0.5),
      timeoutMs: Number(process.env.CONTENT_SAFETY_TIMEOUT_MS ?? 5000),
    };
  }

  async scanText(text: string): Promise<SafetyVerdict> {
    return this.call('text', { text });
  }

  async scanImage(imageUrl: string): Promise<SafetyVerdict> {
    return this.call('image', { imageUrl });
  }

  private async call(
    kind: 'text' | 'image',
    payload: Record<string, unknown>,
  ): Promise<SafetyVerdict> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    let res: Response;
    try {
      res = await fetch(this.config.endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({ kind, ...payload }),
        signal: controller.signal,
      });
    } catch (e) {
      // Network failure / timeout: fail closed to human review, never silently allow.
      this.logger.error(`Cloud moderation request failed: ${(e as Error).message}`);
      throw e;
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      throw new Error(`Cloud moderation responded ${res.status}`);
    }
    const body = (await res.json()) as CloudModerationResponse;
    return this.normalise(body);
  }

  private normalise(body: CloudModerationResponse): SafetyVerdict {
    const findings: SafetyFinding[] = [];
    for (const c of body.categories ?? []) {
      if (c.score < this.config.reviewThreshold) continue;
      const severity: ModerationSeverity =
        c.score >= this.config.blockThreshold ? 'critical' : 'high';
      findings.push({ category: c.name, severity, score: c.score });
    }
    return decideFromFindings(findings);
  }
}
