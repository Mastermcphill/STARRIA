"use strict";
// ---------------------------------------------------------------------------
// domain-events — DomainEvent base type
// Every event published on the bus extends this shape.
// ---------------------------------------------------------------------------
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEvent = createEvent;
/** Convenience builder — fills in defaults so callers only supply what varies. */
function createEvent(params) {
    return {
        occurredAt: new Date().toISOString(),
        version: 1,
        ...params,
    };
}
