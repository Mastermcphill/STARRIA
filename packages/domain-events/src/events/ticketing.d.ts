import type { DomainEvent } from '../event';
export declare const TICKET_CREATED = "ticket.created";
export declare const TICKET_PURCHASED = "ticket.purchased";
export declare const TICKET_REFUNDED = "ticket.refunded";
export declare const TICKET_REMINDER_SCHEDULED = "ticket.reminder.scheduled";
export declare const TICKET_ATTENDANCE_RECORDED = "ticket.attendance.recorded";
export type TicketTier = 'FREE' | 'STANDARD' | 'VIP' | 'SUPPORTER_EXCLUSIVE';
export interface TicketCreatedPayload {
    readonly ticketId: string;
    readonly eventId: string;
    readonly starId: string;
    readonly tier: TicketTier;
    readonly priceCoins: number;
    readonly priceFiatMinorUnits: number;
    readonly currency: string;
    readonly maxQuantity?: number;
    readonly createdAt: string;
}
export interface TicketPurchasedPayload {
    readonly purchaseId: string;
    readonly ticketId: string;
    readonly eventId: string;
    readonly userId: string;
    readonly starId: string;
    readonly tier: TicketTier;
    readonly quantity: number;
    readonly coinsSpent: number;
    readonly creatorCoinsPayout: number;
    readonly platformCoinsFee: number;
    readonly idempotencyKey: string;
    readonly purchasedAt: string;
}
export interface TicketRefundedPayload {
    readonly purchaseId: string;
    readonly ticketId: string;
    readonly eventId: string;
    readonly userId: string;
    readonly coinsRefunded: number;
    readonly reason?: string;
    readonly refundedAt: string;
}
export interface ReminderScheduledPayload {
    readonly purchaseId: string;
    readonly eventId: string;
    readonly userId: string;
    readonly scheduledFor: string;
    readonly offsetMinutes: number;
}
export interface AttendanceRecordedPayload {
    readonly purchaseId: string;
    readonly eventId: string;
    readonly userId: string;
    readonly joinedAt: string;
    readonly source: 'ticket' | 'invite' | 'free';
}
export type TicketCreatedEvent = DomainEvent<TicketCreatedPayload>;
export type TicketPurchasedEvent = DomainEvent<TicketPurchasedPayload>;
export type TicketRefundedEvent = DomainEvent<TicketRefundedPayload>;
export type ReminderScheduledEvent = DomainEvent<ReminderScheduledPayload>;
export type AttendanceRecordedEvent = DomainEvent<AttendanceRecordedPayload>;
