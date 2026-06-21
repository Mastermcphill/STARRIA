import type { DomainEvent } from './event';
export type EventHandler<E extends DomainEvent<any> = DomainEvent> = (event: E) => void | Promise<void>;
/** Unsubscribe function returned by EventBus.subscribe(). */
export type Unsubscribe = () => void;
export interface EventBus {
    /** Publish a domain event. Fire-and-forget in most implementations. */
    publish(event: DomainEvent<any>): void | Promise<void>;
    /**
     * Subscribe to all events of the given type string.
     * Returns an unsubscribe function.
     */
    subscribe<E extends DomainEvent<any>>(type: string, handler: EventHandler<E>): Unsubscribe;
    /**
     * Subscribe to multiple event types with a single handler.
     * Returns an unsubscribe function that removes all subscriptions.
     */
    subscribeMany<E extends DomainEvent<any>>(types: string[], handler: EventHandler<E>): Unsubscribe;
}
export declare class InMemoryEventBus implements EventBus {
    private readonly handlers;
    subscribe<E extends DomainEvent<any>>(type: string, handler: EventHandler<E>): Unsubscribe;
    subscribeMany<E extends DomainEvent<any>>(types: string[], handler: EventHandler<E>): Unsubscribe;
    publish(event: DomainEvent<any>): Promise<void>;
    /** Test helper — how many handlers are registered for a given type. */
    listenerCount(type: string): number;
    /** Test helper — clear all handlers. */
    clear(): void;
}
export declare class NoopEventBus implements EventBus {
    publish(_event: DomainEvent<any>): void;
    subscribe<E extends DomainEvent<any>>(_type: string, _handler: EventHandler<E>): Unsubscribe;
    subscribeMany<E extends DomainEvent<any>>(_types: string[], _handler: EventHandler<E>): Unsubscribe;
}
