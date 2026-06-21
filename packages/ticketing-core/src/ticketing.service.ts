// ---------------------------------------------------------------------------
// ticketing-core — TicketingService
// Handles ticket creation, coin-based purchases, refunds, attendance, and
// reminder scheduling. Framework-agnostic; inject ports from the API layer.
// ---------------------------------------------------------------------------

import { randomUUID } from 'crypto';
import type { EventBus } from '@starria/domain-events';
import type {
  Ticket, TicketPurchaseRecord, RefundRequest, EventReminder,
  CreateTicketInput, PurchaseTicketInput, PurchaseTicketResult,
  RefundTicketInput, RecordAttendanceInput,
  VerifyOwnershipInput, VerifyOwnershipResult,
  TicketStorePort, TicketCoinLedgerPort,
} from './types';
import { PLATFORM_TICKET_FEE_PCT } from './types';
import {
  buildTicketCreatedEvent, buildTicketPurchasedEvent, buildTicketRefundedEvent,
  buildReminderScheduledEvent, buildAttendanceRecordedEvent,
} from './events';

// Reminder offsets in minutes: 24 h, 1 h, 10 min, 0 = "now"
const REMINDER_OFFSETS = [1440, 60, 10, 0];

export class TicketingService {
  constructor(
    private readonly store: TicketStorePort,
    private readonly ledger: TicketCoinLedgerPort,
    private readonly eventBus: EventBus,
    private readonly platformFeePct: number = PLATFORM_TICKET_FEE_PCT,
  ) {}

  // ── Ticket management ──────────────────────────────────────────────────────

  async createTicket(input: CreateTicketInput): Promise<Ticket> {
    const now = new Date().toISOString();
    const ticket = await this.store.createTicket({
      id: randomUUID(),
      eventId: input.eventId,
      starId: input.starId,
      tier: input.tier,
      title: input.title,
      description: input.description,
      priceCoins: input.priceCoins,
      priceFiatMinorUnits: input.priceFiatMinorUnits ?? 0,
      currency: input.currency ?? 'NGN',
      maxQuantity: input.maxQuantity,
      status: 'ACTIVE',
      saleStartsAt: input.saleStartsAt,
      saleEndsAt: input.saleEndsAt,
      createdAt: now,
    });

    void this.eventBus.publish(buildTicketCreatedEvent({
      ticketId: ticket.id,
      eventId: ticket.eventId,
      starId: ticket.starId,
      tier: ticket.tier,
      priceCoins: ticket.priceCoins,
      priceFiatMinorUnits: ticket.priceFiatMinorUnits,
      currency: ticket.currency,
      maxQuantity: ticket.maxQuantity,
    }));

    return ticket;
  }

  // ── Purchase ───────────────────────────────────────────────────────────────

  async purchaseTicket(input: PurchaseTicketInput): Promise<PurchaseTicketResult> {
    // Idempotency guard
    const existing = await this.store.findPurchaseByIdempotencyKey(input.idempotencyKey);
    if (existing) {
      const balance = await this.ledger.getBalance(input.userId);
      return { purchase: existing, buyerCoinBalance: balance.balance };
    }

    const ticket = await this.store.findTicketById(input.ticketId);
    if (!ticket) throw new Error(`Ticket ${input.ticketId} not found`);
    if (ticket.status !== 'ACTIVE') throw new Error('Ticket is not available for purchase');
    if (ticket.maxQuantity !== undefined && ticket.quantitySold + input.quantity > ticket.maxQuantity) {
      throw new Error('Not enough tickets available');
    }

    const totalCoins = ticket.priceCoins * input.quantity;
    const platformFee = Math.floor((totalCoins * this.platformFeePct) / 100);
    const creatorPayout = totalCoins - platformFee;

    // Debit buyer
    if (totalCoins > 0) {
      await this.ledger.debit({
        userId: input.userId,
        amount: totalCoins,
        reason: 'ticket_purchase',
        idempotencyKey: `${input.idempotencyKey}:debit`,
      });
    }

    // Credit creator
    if (creatorPayout > 0) {
      await this.ledger.credit({
        userId: input.starId,
        amount: creatorPayout,
        reason: 'ticket_sale',
        idempotencyKey: `${input.idempotencyKey}:creator`,
      });
    }

    const purchaseId = randomUUID();
    const now = new Date().toISOString();

    const purchase = await this.store.createPurchase({
      id: purchaseId,
      ticketId: input.ticketId,
      eventId: input.eventId,
      userId: input.userId,
      starId: input.starId,
      tier: ticket.tier,
      quantity: input.quantity,
      coinsSpent: totalCoins,
      creatorCoinsPayout: creatorPayout,
      platformCoinsFee: platformFee,
      status: 'CONFIRMED',
      idempotencyKey: input.idempotencyKey,
      purchasedAt: now,
    });

    // Append ledger entry
    await this.store.createLedgerEntry({
      id: randomUUID(),
      purchaseId,
      action: 'PURCHASE',
      coinsAmount: totalCoins,
      note: `${input.quantity}x ${ticket.tier} ticket`,
      createdAt: now,
    });

    // Update sold count
    await this.store.updateTicket(input.ticketId, {
      quantitySold: ticket.quantitySold + input.quantity,
    });

    // Schedule reminders (if event scheduledAt is known — caller passes eventScheduledAt via metadata)
    // Emit event; the API layer can schedule reminder jobs on receipt
    void this.eventBus.publish(buildTicketPurchasedEvent({
      purchaseId,
      ticketId: input.ticketId,
      eventId: input.eventId,
      userId: input.userId,
      starId: input.starId,
      tier: ticket.tier,
      quantity: input.quantity,
      coinsSpent: totalCoins,
      creatorCoinsPayout: creatorPayout,
      platformCoinsFee: platformFee,
      idempotencyKey: input.idempotencyKey,
    }));

    const balance = await this.ledger.getBalance(input.userId);
    return { purchase, buyerCoinBalance: balance.balance };
  }

  // ── Reminders ──────────────────────────────────────────────────────────────

  async scheduleReminders(
    purchaseId: string,
    eventId: string,
    userId: string,
    eventScheduledAt: string,
  ): Promise<EventReminder[]> {
    const eventMs = Date.parse(eventScheduledAt);
    const reminders: EventReminder[] = [];

    for (const offsetMinutes of REMINDER_OFFSETS) {
      const fireAt = new Date(eventMs - offsetMinutes * 60 * 1000).toISOString();
      // Skip if fire time is in the past
      if (Date.parse(fireAt) <= Date.now()) continue;

      const reminder = await this.store.createReminder({
        id: randomUUID(),
        purchaseId,
        eventId,
        userId,
        scheduledFor: fireAt,
        offsetMinutes,
        sent: false,
        createdAt: new Date().toISOString(),
      });

      void this.eventBus.publish(buildReminderScheduledEvent({
        purchaseId, eventId, userId,
        scheduledFor: fireAt,
        offsetMinutes,
      }));

      reminders.push(reminder);
    }

    return reminders;
  }

  // ── Refund ─────────────────────────────────────────────────────────────────

  async refundTicket(input: RefundTicketInput): Promise<RefundRequest> {
    const purchase = await this.store.findPurchaseById(input.purchaseId);
    if (!purchase) throw new Error(`Purchase ${input.purchaseId} not found`);
    if (purchase.userId !== input.userId) throw new Error('Not authorized to refund this purchase');
    if (purchase.status === 'REFUNDED') throw new Error('Already refunded');

    const refundId = randomUUID();
    const now = new Date().toISOString();

    // Refund coins to buyer
    if (purchase.coinsSpent > 0) {
      await this.ledger.credit({
        userId: input.userId,
        amount: purchase.coinsSpent,
        reason: 'ticket_refund',
        idempotencyKey: `refund:${input.purchaseId}:buyer`,
      });

      // Reclaim creator payout
      if (purchase.creatorCoinsPayout > 0) {
        await this.ledger.debit({
          userId: purchase.starId,
          amount: purchase.creatorCoinsPayout,
          reason: 'ticket_refund_clawback',
          idempotencyKey: `refund:${input.purchaseId}:creator`,
        });
      }
    }

    await this.store.updatePurchase(input.purchaseId, {
      status: 'REFUNDED',
      refundedAt: now,
    });

    await this.store.createLedgerEntry({
      id: randomUUID(),
      purchaseId: input.purchaseId,
      action: 'REFUND',
      coinsAmount: purchase.coinsSpent,
      note: input.reason,
      createdAt: now,
    });

    const refund = await this.store.createRefundRequest({
      id: refundId,
      purchaseId: input.purchaseId,
      userId: input.userId,
      reason: input.reason,
      status: 'COMPLETED',
      requestedAt: now,
      resolvedAt: now,
    });

    void this.eventBus.publish(buildTicketRefundedEvent({
      purchaseId: input.purchaseId,
      ticketId: purchase.ticketId,
      eventId: purchase.eventId,
      userId: input.userId,
      coinsRefunded: purchase.coinsSpent,
      reason: input.reason,
    }));

    return refund;
  }

  // ── Attendance ─────────────────────────────────────────────────────────────

  async recordAttendance(input: RecordAttendanceInput): Promise<void> {
    const purchase = await this.store.findPurchaseById(input.purchaseId);
    if (!purchase) throw new Error(`Purchase ${input.purchaseId} not found`);

    await this.store.createLedgerEntry({
      id: randomUUID(),
      purchaseId: input.purchaseId,
      action: 'ATTENDANCE',
      coinsAmount: 0,
      createdAt: new Date().toISOString(),
    });

    void this.eventBus.publish(buildAttendanceRecordedEvent({
      purchaseId: input.purchaseId,
      eventId: input.eventId,
      userId: input.userId,
      source: 'ticket',
    }));
  }

  // ── Ownership verification ─────────────────────────────────────────────────

  async verifyOwnership(input: VerifyOwnershipInput): Promise<VerifyOwnershipResult> {
    const purchase = await this.store.findPurchaseByUserAndEvent(input.userId, input.eventId);
    if (!purchase || purchase.status !== 'CONFIRMED') {
      return { hasAccess: false };
    }
    return { hasAccess: true, purchase, tier: purchase.tier };
  }
}
