"use strict";
// ---------------------------------------------------------------------------
// domain-events — EventBus contract + InMemoryEventBus implementation
// ---------------------------------------------------------------------------
Object.defineProperty(exports, "__esModule", { value: true });
exports.NoopEventBus = exports.InMemoryEventBus = void 0;
// ---------------------------------------------------------------------------
// InMemoryEventBus — for unit tests and local dev; not for production use.
// ---------------------------------------------------------------------------
class InMemoryEventBus {
    constructor() {
        this.handlers = new Map();
    }
    subscribe(type, handler) {
        if (!this.handlers.has(type)) {
            this.handlers.set(type, new Set());
        }
        this.handlers.get(type).add(handler);
        return () => {
            this.handlers.get(type)?.delete(handler);
        };
    }
    subscribeMany(types, handler) {
        const unsubs = types.map(t => this.subscribe(t, handler));
        return () => unsubs.forEach(u => u());
    }
    async publish(event) {
        const handlers = this.handlers.get(event.type);
        if (!handlers || handlers.size === 0)
            return;
        await Promise.all([...handlers].map(h => h(event)));
    }
    /** Test helper — how many handlers are registered for a given type. */
    listenerCount(type) {
        return this.handlers.get(type)?.size ?? 0;
    }
    /** Test helper — clear all handlers. */
    clear() {
        this.handlers.clear();
    }
}
exports.InMemoryEventBus = InMemoryEventBus;
// ---------------------------------------------------------------------------
// NoopEventBus — drop all events silently (useful when bus is optional).
// ---------------------------------------------------------------------------
class NoopEventBus {
    publish(_event) { }
    subscribe(_type, _handler) { return () => { }; }
    subscribeMany(_types, _handler) { return () => { }; }
}
exports.NoopEventBus = NoopEventBus;
