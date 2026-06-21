export interface DomainEvent<TPayload = Record<string, unknown>> {
    /** UUID — unique per event instance. */
    readonly id: string;
    /** Dot-namespaced type string, e.g. 'tap.completed'. */
    readonly type: string;
    /** ID of the aggregate that emitted this event. */
    readonly aggregateId: string;
    /** Class name of the aggregate, e.g. 'Tap', 'StarProfile'. */
    readonly aggregateType: string;
    /** ISO 8601 timestamp when the business fact occurred. */
    readonly occurredAt: string;
    /** Payload schema version — increment on breaking payload changes. */
    readonly version: number;
    readonly payload: TPayload;
    /** Optional bag for correlation IDs, tracing headers, actor context, etc. */
    readonly metadata?: Record<string, unknown>;
}
/** Convenience builder — fills in defaults so callers only supply what varies. */
export declare function createEvent<TPayload>(params: Omit<DomainEvent<TPayload>, 'occurredAt' | 'version'> & Partial<Pick<DomainEvent<TPayload>, 'occurredAt' | 'version'>>): DomainEvent<TPayload>;
