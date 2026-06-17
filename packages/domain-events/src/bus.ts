// ---------------------------------------------------------------------------
// domain-events — EventBus contract + InMemoryEventBus implementation
// ---------------------------------------------------------------------------

import type { DomainEvent } from './event';

export type EventHandler<E extends DomainEvent<any> = DomainEvent> = (event: E) => void | Promise<void>;

/** Unsubscribe function returned by EventBus.subscribe(). */
export type Unsubscribe = () => void;

// ---------------------------------------------------------------------------
// EventBus interface — implement this for Redis Streams, SQS, etc.
// ---------------------------------------------------------------------------

export interface EventBus {
  /** Publish a domain event. Fire-and-forget in most implementations. */
  publish(event: DomainEvent<any>): void | Promise<void>;

  /**
   * Subscribe to all events of the given type string.
   * Returns an unsubscribe function.
   */
  subscribe<E extends DomainEvent<any>>(
    type: string,
    handler: EventHandler<E>,
  ): Unsubscribe;

  /**
   * Subscribe to multiple event types with a single handler.
   * Returns an unsubscribe function that removes all subscriptions.
   */
  subscribeMany<E extends DomainEvent<any>>(
    types: string[],
    handler: EventHandler<E>,
  ): Unsubscribe;
}

// ---------------------------------------------------------------------------
// InMemoryEventBus — for unit tests and local dev; not for production use.
// ---------------------------------------------------------------------------

export class InMemoryEventBus implements EventBus {
  private readonly handlers = new Map<string, Set<EventHandler>>();

  subscribe<E extends DomainEvent<any>>(type: string, handler: EventHandler<E>): Unsubscribe {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler as EventHandler);
    return () => {
      this.handlers.get(type)?.delete(handler as EventHandler);
    };
  }

  subscribeMany<E extends DomainEvent<any>>(types: string[], handler: EventHandler<E>): Unsubscribe {
    const unsubs = types.map(t => this.subscribe(t, handler));
    return () => unsubs.forEach(u => u());
  }

  async publish(event: DomainEvent<any>): Promise<void> {
    const handlers = this.handlers.get(event.type);
    if (!handlers || handlers.size === 0) return;
    await Promise.all([...handlers].map(h => h(event)));
  }

  /** Test helper — how many handlers are registered for a given type. */
  listenerCount(type: string): number {
    return this.handlers.get(type)?.size ?? 0;
  }

  /** Test helper — clear all handlers. */
  clear(): void {
    this.handlers.clear();
  }
}

// ---------------------------------------------------------------------------
// NoopEventBus — drop all events silently (useful when bus is optional).
// ---------------------------------------------------------------------------

export class NoopEventBus implements EventBus {
  publish(_event: DomainEvent<any>): void { /* intentional noop */ }
  subscribe<E extends DomainEvent<any>>(_type: string, _handler: EventHandler<E>): Unsubscribe { return () => {}; }
  subscribeMany<E extends DomainEvent<any>>(_types: string[], _handler: EventHandler<E>): Unsubscribe { return () => {}; }
}
