// ---------------------------------------------------------------------------
// ticketing-core — domain types
// ---------------------------------------------------------------------------

export type TicketTier = 'FREE' | 'STANDARD' | 'VIP' | 'SUPPORTER_EXCLUSIVE';
export type TicketStatus = 'ACTIVE' | 'USED' | 'CANCELLED' | 'EXPIRED';
export type TicketPurchaseStatus = 'PENDING' | 'CONFIRMED' | 'REFUNDED' | 'CANCELLED';
export type RefundStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED';

export const PLATFORM_TICKET_FEE_PCT = 15; // 15% platform fee on ticket sales

// ---------------------------------------------------------------------------
// Ticket (the offer, created by the star)
// ---------------------------------------------------------------------------

export interface Ticket {
  readonly id: string;
  readonly eventId: string;
  readonly starId: string;
  readonly tier: TicketTier;
  readonly title: string;
  readonly description?: string;
  /** Price in coins (0 = free). Mutually exclusive with priceFiatMinorUnits. */
  readonly priceCoins: number;
  /** Price in minor fiat units (0 = free). */
  readonly priceFiatMinorUnits: number;
  readonly currency: string;
  readonly maxQuantity?: number;
  readonly quantitySold: number;
  readonly status: TicketStatus;
  readonly saleStartsAt?: string;
  readonly saleEndsAt?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

// ---------------------------------------------------------------------------
// TicketPurchase (the transaction, created by the buyer)
// ---------------------------------------------------------------------------

export interface TicketPurchaseRecord {
  readonly id: string;
  readonly ticketId: string;
  readonly eventId: string;
  readonly userId: string;
  readonly starId: string;
  readonly tier: TicketTier;
  readonly quantity: number;
  /** Total coins debited from buyer. */
  readonly coinsSpent: number;
  /** Coins credited to creator after platform fee. */
  readonly creatorCoinsPayout: number;
  /** Coins retained by platform. */
  readonly platformCoinsFee: number;
  readonly status: TicketPurchaseStatus;
  readonly idempotencyKey: string;
  readonly purchasedAt: string;
  readonly refundedAt?: string;
}

// ---------------------------------------------------------------------------
// TicketLedger (append-only audit per purchase)
// ---------------------------------------------------------------------------

export interface TicketLedgerEntry {
  readonly id: string;
  readonly purchaseId: string;
  readonly action: 'PURCHASE' | 'REFUND' | 'ATTENDANCE';
  readonly coinsAmount: number;
  readonly note?: string;
  readonly createdAt: string;
}

// ---------------------------------------------------------------------------
// EventReminder
// ---------------------------------------------------------------------------

export interface EventReminder {
  readonly id: string;
  readonly purchaseId: string;
  readonly eventId: string;
  readonly userId: string;
  /** ISO timestamp at which the reminder notification fires. */
  readonly scheduledFor: string;
  /** Minutes before event start (e.g. 1440, 60, 10). */
  readonly offsetMinutes: number;
  readonly sent: boolean;
  readonly sentAt?: string;
  readonly createdAt: string;
}

// ---------------------------------------------------------------------------
// RefundRequest
// ---------------------------------------------------------------------------

export interface RefundRequest {
  readonly id: string;
  readonly purchaseId: string;
  readonly userId: string;
  readonly reason?: string;
  readonly status: RefundStatus;
  readonly requestedAt: string;
  readonly resolvedAt?: string;
}

// ---------------------------------------------------------------------------
// Service I/O types
// ---------------------------------------------------------------------------

export interface CreateTicketInput {
  readonly eventId: string;
  readonly starId: string;
  readonly tier: TicketTier;
  readonly title: string;
  readonly description?: string;
  readonly priceCoins: number;
  readonly priceFiatMinorUnits?: number;
  readonly currency?: string;
  readonly maxQuantity?: number;
  readonly saleStartsAt?: string;
  readonly saleEndsAt?: string;
}

export interface PurchaseTicketInput {
  readonly ticketId: string;
  readonly eventId: string;
  readonly userId: string;
  readonly starId: string;
  readonly quantity: number;
  readonly idempotencyKey: string;
}

export interface PurchaseTicketResult {
  readonly purchase: TicketPurchaseRecord;
  readonly buyerCoinBalance: number;
}

export interface RefundTicketInput {
  readonly purchaseId: string;
  readonly userId: string;
  readonly reason?: string;
}

export interface RecordAttendanceInput {
  readonly purchaseId: string;
  readonly eventId: string;
  readonly userId: string;
}

export interface VerifyOwnershipInput {
  readonly eventId: string;
  readonly userId: string;
}

export interface VerifyOwnershipResult {
  readonly hasAccess: boolean;
  readonly purchase?: TicketPurchaseRecord;
  readonly tier?: TicketTier;
}

// ---------------------------------------------------------------------------
// Persistence port
// ---------------------------------------------------------------------------

export interface TicketStorePort {
  createTicket(input: Omit<Ticket, 'quantitySold' | 'updatedAt'>): Promise<Ticket>;
  findTicketById(id: string): Promise<Ticket | null>;
  findTicketsByEvent(eventId: string): Promise<Ticket[]>;
  updateTicket(id: string, patch: Partial<Ticket>): Promise<Ticket>;

  createPurchase(record: TicketPurchaseRecord): Promise<TicketPurchaseRecord>;
  findPurchaseById(id: string): Promise<TicketPurchaseRecord | null>;
  findPurchaseByIdempotencyKey(key: string): Promise<TicketPurchaseRecord | null>;
  findPurchasesByUser(userId: string): Promise<TicketPurchaseRecord[]>;
  findPurchaseByUserAndEvent(userId: string, eventId: string): Promise<TicketPurchaseRecord | null>;
  updatePurchase(id: string, patch: Partial<TicketPurchaseRecord>): Promise<TicketPurchaseRecord>;

  createLedgerEntry(entry: TicketLedgerEntry): Promise<TicketLedgerEntry>;

  createReminder(reminder: EventReminder): Promise<EventReminder>;
  findRemindersByPurchase(purchaseId: string): Promise<EventReminder[]>;
  markReminderSent(id: string): Promise<void>;

  createRefundRequest(req: RefundRequest): Promise<RefundRequest>;
  findRefundByPurchase(purchaseId: string): Promise<RefundRequest | null>;
  updateRefundRequest(id: string, patch: Partial<RefundRequest>): Promise<RefundRequest>;
}

// ---------------------------------------------------------------------------
// Coin ledger port (reuses gifting-core's interface shape)
// ---------------------------------------------------------------------------

export interface TicketCoinLedgerPort {
  debit(input: { userId: string; amount: number; reason: string; idempotencyKey: string }): Promise<{ balance: number }>;
  credit(input: { userId: string; amount: number; reason: string; idempotencyKey: string }): Promise<{ balance: number }>;
  getBalance(userId: string): Promise<{ balance: number }>;
}
