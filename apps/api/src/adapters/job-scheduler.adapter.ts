// ---------------------------------------------------------------------------
// Redis-backed job scheduler adapter
//
// Uses Redis sorted sets (ZADD score=runAt, member=jobId) for delayed /
// recurring job scheduling. A polling loop picks up due jobs and dispatches
// them to registered handlers.
//
// Based on the pattern documented in docs/hail0-extraction/backend_jobs.md
// adapted for the STARRIA domain job types.
//
// Usage:
//   scheduler.register('expire_regional_boosts', handler);
//   await scheduler.enqueue({ type: 'expire_regional_boosts', payload: {} });
//   await scheduler.enqueueAt(new Date(Date.now() + 3600_000), { type: '…' });
// ---------------------------------------------------------------------------

import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { randomUUID } from 'crypto';

export const REDIS_CLIENT = 'REDIS_CLIENT';

// ── Job Types ─────────────────────────────────────────────────────────────────

export const JOB_TYPES = {
  // Notifications
  DISPATCH_PUSH_NOTIFICATION:  'dispatch_push_notification',
  SEND_EMAIL:                  'send_email',

  // Payments & settlement
  PROCESS_SETTLEMENT_TRANSFER: 'process_settlement_transfer',
  RECONCILE_WALLET_ENTRY:      'reconcile_wallet_entry',

  // Tap storms
  ACTIVATE_TAP_STORM:          'activate_tap_storm',
  END_TAP_STORM:               'end_tap_storm',

  // Creator seasons
  START_CREATOR_SEASON:        'start_creator_season',
  END_CREATOR_SEASON:          'end_creator_season',

  // Arena votes
  CLOSE_ARENA_VOTE:            'close_arena_vote',

  // Tickets
  CONFIRM_TICKET_PURCHASE:     'confirm_ticket_purchase',
  REFUND_TICKET_PURCHASE:      'refund_ticket_purchase',

  // Maintenance
  EXPIRE_REGIONAL_BOOSTS:      'expire_regional_boosts',
  EXPIRE_GOLD_STAR_PROFILES:   'expire_gold_star_profiles',
  ANALYTICS_FLUSH:             'analytics_flush',
  SEARCH_REINDEX:              'search_reindex',
} as const;

export type JobType = (typeof JOB_TYPES)[keyof typeof JOB_TYPES];

// ── Job shape ─────────────────────────────────────────────────────────────────

export interface QueueJob<TPayload = Record<string, unknown>> {
  readonly id: string;
  readonly type: JobType;
  readonly payload: TPayload;
  readonly attempts: number;
  readonly maxAttempts: number;
  readonly runAt: number; // Unix ms
  readonly createdAt: number;
}

export type JobHandler<TPayload = Record<string, unknown>> = (
  job: QueueJob<TPayload>,
) => Promise<void>;

// ── Adapter ───────────────────────────────────────────────────────────────────

const QUEUE_KEY      = 'starria:jobs:queue';
const DATA_PREFIX    = 'starria:jobs:data:';
const DLQ_KEY        = 'starria:jobs:dlq';
const POLL_INTERVAL  = 1_000;  // ms
const MAX_ATTEMPTS   = 3;

@Injectable()
export class JobSchedulerAdapter implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JobSchedulerAdapter.name);
  private readonly registry = new Map<string, JobHandler>();
  private running = false;
  private pollLoop?: Promise<void>;

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  async onModuleInit(): Promise<void> {
    this.running = true;
    this.pollLoop = this.startPollLoop();
  }

  async onModuleDestroy(): Promise<void> {
    this.running = false;
    await this.pollLoop;
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /** Register a handler for a job type. Call before onModuleInit. */
  register<TPayload>(type: JobType, handler: JobHandler<TPayload>): void {
    this.registry.set(type, handler as JobHandler);
  }

  /** Enqueue a job to run immediately (or as soon as the poller picks it up). */
  async enqueue<TPayload>(params: {
    type: JobType;
    payload: TPayload;
    maxAttempts?: number;
  }): Promise<string> {
    return this.enqueueAt(new Date(), params);
  }

  /** Enqueue a job to run at a specific future time. */
  async enqueueAt<TPayload>(
    runAt: Date,
    params: { type: JobType; payload: TPayload; maxAttempts?: number },
  ): Promise<string> {
    const id = randomUUID();
    const job: QueueJob<TPayload> = {
      id,
      type: params.type,
      payload: params.payload,
      attempts: 0,
      maxAttempts: params.maxAttempts ?? MAX_ATTEMPTS,
      runAt: runAt.getTime(),
      createdAt: Date.now(),
    };
    await this.redis.set(`${DATA_PREFIX}${id}`, JSON.stringify(job));
    await this.redis.zadd(QUEUE_KEY, runAt.getTime(), id);
    this.logger.debug(`Enqueued ${params.type} [${id}] runAt=${runAt.toISOString()}`);
    return id;
  }

  /** Cancel a pending job by id. No-op if already running/completed. */
  async cancel(id: string): Promise<void> {
    await this.redis.zrem(QUEUE_KEY, id);
    await this.redis.del(`${DATA_PREFIX}${id}`);
  }

  // ── Poll loop ─────────────────────────────────────────────────────────────

  private async startPollLoop(): Promise<void> {
    while (this.running) {
      try {
        await this.processDueJobs();
      } catch (err) {
        this.logger.error('Job poll loop error', err);
      }
      await new Promise(r => setTimeout(r, POLL_INTERVAL));
    }
  }

  private async processDueJobs(): Promise<void> {
    const now = Date.now();
    // Atomically pop jobs whose score (runAt) <= now
    const ids: string[] = await this.redis.zrangebyscore(QUEUE_KEY, '-inf', now, 'LIMIT', 0, 10);
    if (ids.length === 0) return;

    for (const id of ids) {
      const removed = await this.redis.zrem(QUEUE_KEY, id);
      if (removed === 0) continue; // another replica claimed it

      const raw = await this.redis.getdel(`${DATA_PREFIX}${id}`);
      if (!raw) continue;

      const job: QueueJob = JSON.parse(raw);
      await this.executeJob(job);
    }
  }

  private async executeJob(job: QueueJob): Promise<void> {
    const handler = this.registry.get(job.type);
    if (!handler) {
      this.logger.warn(`No handler registered for job type: ${job.type}`);
      return;
    }

    const updated: QueueJob = { ...job, attempts: job.attempts + 1 };

    try {
      await handler(updated);
      this.logger.debug(`Completed ${job.type} [${job.id}] attempt=${updated.attempts}`);
    } catch (err) {
      this.logger.error(`Failed ${job.type} [${job.id}] attempt=${updated.attempts}`, err);

      if (updated.attempts < updated.maxAttempts) {
        // Exponential backoff with jitter: 2^attempts * 1s ± 20%
        const base = Math.pow(2, updated.attempts) * 1_000;
        const jitter = base * 0.2 * (Math.random() - 0.5);
        const retryAt = Date.now() + base + jitter;

        const retried: QueueJob = { ...updated, runAt: retryAt };
        await this.redis.set(`${DATA_PREFIX}${job.id}`, JSON.stringify(retried));
        await this.redis.zadd(QUEUE_KEY, retryAt, job.id);
        this.logger.debug(`Retrying ${job.type} [${job.id}] in ${Math.round((base + jitter) / 1000)}s`);
      } else {
        // Dead-letter
        await this.redis.lpush(DLQ_KEY, JSON.stringify(updated));
        this.logger.error(`Dead-lettered ${job.type} [${job.id}] after ${updated.attempts} attempts`);
      }
    }
  }
}
