// ---------------------------------------------------------------------------
// ticketing-core — domain event builders
// ---------------------------------------------------------------------------

import { randomUUID } from 'crypto';
import { createEvent } from '@starria/domain-events';
import {
  TICKET_CREATED, TICKET_PURCHASED, TICKET_REFUNDED,
  TICKET_REMINDER_SCHEDULED, TICKET_ATTENDANCE_RECORDED,
} from '@starria/domain-events';
import type {
  TicketCreatedEvent, TicketPurchasedEvent, TicketRefundedEvent,
  ReminderScheduledEvent, AttendanceRecordedEvent, TicketTier,
} from '@starria/domain-events';

export function buildTicketCreatedEvent(p: {
  ticketId: string; eventId: string; starId: string; tier: TicketTier;
  priceCoins: number; priceFiatMinorUnits: number; currency: string; maxQuantity?: number;
}): TicketCreatedEvent {
  return createEvent({
    id: randomUUID(), type: TICKET_CREATED,
    aggregateId: p.ticketId, aggregateType: 'Ticket',
    payload: { ...p, createdAt: new Date().toISOString() },
  });
}

export function buildTicketPurchasedEvent(p: {
  purchaseId: string; ticketId: string; eventId: string; userId: string; starId: string;
  tier: TicketTier; quantity: number; coinsSpent: number;
  creatorCoinsPayout: number; platformCoinsFee: number; idempotencyKey: string;
}): TicketPurchasedEvent {
  return createEvent({
    id: randomUUID(), type: TICKET_PURCHASED,
    aggregateId: p.purchaseId, aggregateType: 'TicketPurchase',
    payload: { ...p, purchasedAt: new Date().toISOString() },
  });
}

export function buildTicketRefundedEvent(p: {
  purchaseId: string; ticketId: string; eventId: string;
  userId: string; coinsRefunded: number; reason?: string;
}): TicketRefundedEvent {
  return createEvent({
    id: randomUUID(), type: TICKET_REFUNDED,
    aggregateId: p.purchaseId, aggregateType: 'TicketPurchase',
    payload: { ...p, refundedAt: new Date().toISOString() },
  });
}

export function buildReminderScheduledEvent(p: {
  purchaseId: string; eventId: string; userId: string;
  scheduledFor: string; offsetMinutes: number;
}): ReminderScheduledEvent {
  return createEvent({
    id: randomUUID(), type: TICKET_REMINDER_SCHEDULED,
    aggregateId: p.purchaseId, aggregateType: 'TicketPurchase',
    payload: p,
  });
}

export function buildAttendanceRecordedEvent(p: {
  purchaseId: string; eventId: string; userId: string; source: 'ticket' | 'invite' | 'free';
}): AttendanceRecordedEvent {
  return createEvent({
    id: randomUUID(), type: TICKET_ATTENDANCE_RECORDED,
    aggregateId: p.purchaseId, aggregateType: 'TicketPurchase',
    payload: { ...p, joinedAt: new Date().toISOString() },
  });
}
