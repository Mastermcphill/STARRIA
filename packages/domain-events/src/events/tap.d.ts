import type { DomainEvent } from '../event';
export declare const TAP_COMPLETED = "tap.completed";
export declare const TAP_FAILED = "tap.failed";
export declare const TAP_REFUNDED = "tap.refunded";
export interface TapCompletedPayload {
    readonly tapId: string;
    readonly senderId: string;
    readonly receiverId: string;
    readonly type: 'COIN_GIFT' | 'FIAT_TIP';
    readonly currency: string;
    readonly grossAmount: number;
    readonly platformFee: number;
    readonly creatorNet: number;
    readonly reference: string;
    readonly contextType?: string;
    readonly contextId?: string;
    readonly message?: string;
}
export interface TapFailedPayload {
    readonly tapId: string;
    readonly senderId: string;
    readonly receiverId: string;
    readonly type: 'COIN_GIFT' | 'FIAT_TIP';
    readonly reason: string;
    readonly idempotencyKey: string;
}
export interface TapRefundedPayload {
    readonly tapId: string;
    readonly senderId: string;
    readonly receiverId: string;
    readonly grossAmount: number;
    readonly currency: string;
    readonly refundedAt: string;
}
export type TapCompletedEvent = DomainEvent<TapCompletedPayload>;
export type TapFailedEvent = DomainEvent<TapFailedPayload>;
export type TapRefundedEvent = DomainEvent<TapRefundedPayload>;
