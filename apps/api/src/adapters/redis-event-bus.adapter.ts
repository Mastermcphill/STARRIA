// ---------------------------------------------------------------------------
// Redis Streams event bus adapter — implements @starria/domain-events EventBus
//
// Uses Redis Streams (XADD / XREADGROUP / XACK) for durable, at-least-once
// delivery. Each event type maps to a stream key: "starria:events:{type}"
//
// Wire this as the EventBus in your NestJS module:
//   providers: [{ provide: EVENT_BUS, useClass: RedisEventBusAdapter }]
//
// NOT for production without additional consumer group management.
// ---------------------------------------------------------------------------

import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { Redis } from 'ioredis';
import type { DomainEvent, EventBus, EventHandler, Unsubscribe } from '@starria/domain-events';
import { randomUUID } from 'crypto';

export const REDIS_CLIENT = 'REDIS_CLIENT';

// One consumer group per service instance — all replicas share the group.
const CONSUMER_GROUP  = 'starria-api';
const STREAM_PREFIX   = 'starria:events:';
const BLOCK_MS        = 2_000;  // long-poll block duration
const BATCH_SIZE      = 10;     // events per XREADGROUP call

@Injectable()
export class RedisEventBusAdapter implements EventBus, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisEventBusAdapter.name);
  private readonly handlers = new Map<string, Set<EventHandler>>();
  private readonly consumerId = `consumer:${randomUUID()}`;
  private running = false;
  private pollLoop?: Promise<void>;

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  async onModuleInit(): Promise<void> {
    this.running = true;
    this.pollLoop = this.startConsumeLoop();
  }

  async onModuleDestroy(): Promise<void> {
    this.running = false;
    await this.pollLoop;
  }

  // ── EventBus interface ────────────────────────────────────────────────────

  async publish(event: DomainEvent<any>): Promise<void> {
    const stream = `${STREAM_PREFIX}${event.type}`;
    await this.redis.xadd(
      stream,
      '*',
      'id',          event.id,
      'type',        event.type,
      'aggregateId', event.aggregateId,
      'payload',     JSON.stringify(event.payload),
      'occurredAt',  event.occurredAt,
      'version',     String(event.version ?? 1),
    );
    this.logger.verbose(`Published ${event.type} [${event.id}]`);
  }

  subscribe<E extends DomainEvent>(type: string, handler: EventHandler<E>): Unsubscribe {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
      this.ensureStreamAndGroup(type).catch(err =>
        this.logger.error(`Failed to ensure stream for ${type}`, err),
      );
    }
    this.handlers.get(type)!.add(handler as EventHandler);
    return () => this.handlers.get(type)?.delete(handler as EventHandler);
  }

  subscribeMany<E extends DomainEvent>(types: string[], handler: EventHandler<E>): Unsubscribe {
    const unsubs = types.map(t => this.subscribe(t, handler));
    return () => unsubs.forEach(u => u());
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private async ensureStreamAndGroup(type: string): Promise<void> {
    const stream = `${STREAM_PREFIX}${type}`;
    try {
      await this.redis.xgroup('CREATE', stream, CONSUMER_GROUP, '$', 'MKSTREAM');
    } catch (err: unknown) {
      // BUSYGROUP means the group already exists — that's fine.
      if (!(err instanceof Error) || !err.message.includes('BUSYGROUP')) throw err;
    }
  }

  private async startConsumeLoop(): Promise<void> {
    while (this.running) {
      const types = [...this.handlers.keys()];
      if (types.length === 0) {
        await new Promise(r => setTimeout(r, 500));
        continue;
      }

      const streams = types.flatMap(t => [`${STREAM_PREFIX}${t}`, '>']);
      try {
        const results = await (this.redis as unknown as {
          xreadgroup(...args: unknown[]): Promise<[string, [string, string[]][]][] | null>;
        }).xreadgroup(
          'GROUP', CONSUMER_GROUP, this.consumerId,
          'COUNT', BATCH_SIZE,
          'BLOCK', BLOCK_MS,
          'STREAMS', ...streams,
        );

        if (!results) continue;

        for (const [stream, messages] of results) {
          const type = (stream as string).replace(STREAM_PREFIX, '');
          for (const [msgId, fields] of messages) {
            const event = this.parseMessage(fields);
            await this.dispatch(type, event);
            await this.redis.xack(stream, CONSUMER_GROUP, msgId);
          }
        }
      } catch (err) {
        if (this.running) {
          this.logger.error('Event consume loop error', err);
          await new Promise(r => setTimeout(r, 1_000));
        }
      }
    }
  }

  private parseMessage(fields: string[]): DomainEvent {
    const obj: Record<string, string> = {};
    for (let i = 0; i < fields.length; i += 2) obj[fields[i]] = fields[i + 1];
    return {
      id:            obj['id'],
      type:          obj['type'],
      aggregateId:   obj['aggregateId'],
      aggregateType: obj['aggregateType'] ?? '',
      occurredAt:    obj['occurredAt'],
      version:       Number(obj['version'] ?? 1),
      payload:       JSON.parse(obj['payload'] ?? '{}'),
    };
  }

  private async dispatch(type: string, event: DomainEvent): Promise<void> {
    const handlers = this.handlers.get(type);
    if (!handlers || handlers.size === 0) return;
    await Promise.allSettled([...handlers].map(h => h(event)));
  }
}
