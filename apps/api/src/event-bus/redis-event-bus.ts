// ---------------------------------------------------------------------------
// RedisStreamsEventBus — durable EventBus backed by a Redis Stream.
//
// Replaces InMemoryEventBus in production. Events are persisted with XADD, so
// they survive a process crash/restart, and delivered via a consumer group
// (XREADGROUP) giving at-least-once semantics. A single consumer loop fans each
// stream entry out to the in-process handlers registered for that event type.
//
// Falls back to pure in-process delivery if the consumer connection cannot be
// established, so a Redis outage degrades gracefully rather than dropping the
// whole app.
// ---------------------------------------------------------------------------

import { Logger } from '@nestjs/common';
import type Redis from 'ioredis';
import type {
  DomainEvent,
  EventBus,
  EventHandler,
  Unsubscribe,
} from '@starria/domain-events';

const STREAM_KEY = 'starria:events';
const GROUP = 'starria-api';
const MAXLEN = 100_000; // cap stream growth (~approximate trimming)

export class RedisStreamsEventBus implements EventBus {
  private readonly logger = new Logger(RedisStreamsEventBus.name);
  private readonly handlers = new Map<string, Set<EventHandler>>();
  private consumer?: Redis;
  private running = false;
  private readonly consumerName: string;

  constructor(
    private readonly redis: Redis,
    consumerId?: string,
  ) {
    // Distinct per-instance consumer name so horizontally-scaled API pods each
    // claim their own pending entries.
    this.consumerName = consumerId ?? `api-${process.pid}`;
  }

  async start(): Promise<void> {
    try {
      // MKSTREAM creates the stream + group if absent; ignore BUSYGROUP.
      await this.redis
        .xgroup('CREATE', STREAM_KEY, GROUP, '$', 'MKSTREAM')
        .catch((e: Error) => {
          if (!String(e.message).includes('BUSYGROUP')) throw e;
        });
      this.consumer = this.redis.duplicate();
      this.running = true;
      void this.consumeLoop();
      this.logger.log(`Redis Streams event bus started (consumer=${this.consumerName})`);
    } catch (err) {
      this.logger.error(
        `Failed to start Redis Streams consumer — falling back to in-process delivery: ${(err as Error).message}`,
      );
    }
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.consumer) {
      this.consumer.disconnect();
      this.consumer = undefined;
    }
  }

  subscribe<E extends DomainEvent<any>>(type: string, handler: EventHandler<E>): Unsubscribe {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type)!.add(handler as EventHandler);
    return () => this.handlers.get(type)?.delete(handler as EventHandler);
  }

  subscribeMany<E extends DomainEvent<any>>(types: string[], handler: EventHandler<E>): Unsubscribe {
    const unsubs = types.map((t) => this.subscribe(t, handler));
    return () => unsubs.forEach((u) => u());
  }

  async publish(event: DomainEvent<any>): Promise<void> {
    try {
      await this.redis.xadd(
        STREAM_KEY,
        'MAXLEN',
        '~',
        MAXLEN,
        '*',
        'type',
        event.type,
        'event',
        JSON.stringify(event),
      );
    } catch (err) {
      // Durability failed — deliver in-process so the event is not silently lost
      // within this instance, and surface the error.
      this.logger.error(`xadd failed for ${event.type}: ${(err as Error).message}`);
      await this.dispatch(event);
    }
  }

  private async consumeLoop(): Promise<void> {
    if (!this.consumer) return;
    while (this.running) {
      try {
        const res = (await this.consumer.xreadgroup(
          'GROUP',
          GROUP,
          this.consumerName,
          'COUNT',
          10,
          'BLOCK',
          5_000,
          'STREAMS',
          STREAM_KEY,
          '>',
        )) as [string, [string, string[]][]][] | null;

        if (!res) continue;
        for (const [, entries] of res) {
          for (const [id, fields] of entries) {
            await this.handleEntry(id, fields);
          }
        }
      } catch (err) {
        if (!this.running) break;
        this.logger.error(`consume loop error: ${(err as Error).message}`);
        await new Promise((r) => setTimeout(r, 1_000));
      }
    }
  }

  private async handleEntry(id: string, fields: string[]): Promise<void> {
    try {
      const map = fieldsToObject(fields);
      const event = JSON.parse(map.event) as DomainEvent<any>;
      await this.dispatch(event);
      await this.redis.xack(STREAM_KEY, GROUP, id);
    } catch (err) {
      // Leave the entry un-acked → it stays in the PEL for retry/claim.
      this.logger.error(`failed to handle entry ${id}: ${(err as Error).message}`);
    }
  }

  private async dispatch(event: DomainEvent<any>): Promise<void> {
    const handlers = this.handlers.get(event.type);
    if (!handlers || handlers.size === 0) return;
    await Promise.all([...handlers].map((h) => h(event)));
  }
}

function fieldsToObject(fields: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < fields.length; i += 2) out[fields[i]] = fields[i + 1];
  return out;
}
