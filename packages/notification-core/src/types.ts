// ---------------------------------------------------------------------------
// notification-core — types
// Extracted from LifeNest notifications/notification.service.ts.
// Extend NotificationType with app-specific values.
// ---------------------------------------------------------------------------

export type NotificationType =
  // Messaging
  | 'chat_message'
  | 'attachment_received'
  // Consultations / bookings
  | 'consultation_booked'
  | 'consultation_accepted'
  | 'consultation_declined'
  | 'consultation_starting'
  | 'consultation_completed'
  | 'consultation_update'
  // Social / creator
  | 'appreciation'
  | 'comment'
  | 'reply'
  | 'follow'
  | 'mention'
  | 'creator_action'
  // Credentials
  | 'credential_approved'
  | 'credential_rejected'
  // Wallet / payments
  | 'wallet_top_up_success'
  | 'wallet_refund'
  | 'wallet_payout_complete'
  | 'payout_update'
  | 'order_update'
  // Tips / gifts
  | 'tip_received'
  // Rooms / livestream
  | 'room_invite'
  | 'room_starting'
  | 'room_ended'
  | 'livestream_reminder'
  | 'replay_ready'
  // Moderation
  | 'moderation_alert'
  // Support
  | 'support_thread_update'
  | string;

export type NotificationChannel = 'in_app' | 'push' | 'email' | 'sms';
export type NotificationStatus = 'queued' | 'delivered' | 'read' | 'failed';
export type NotificationState = 'unread' | 'read' | 'archived' | 'deleted';
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export type NotificationDeferPolicy =
  | 'send_immediately'
  | 'respect_quiet_hours'
  | 'defer_unless_high_priority'
  | 'defer_unless_safety_critical';

export interface QuietHoursConfig {
  active: boolean;
  startsAt?: string;
  endsAt?: string;
  timezone?: string;
}

export interface NotificationRecord {
  readonly id: string;
  readonly userId: string;
  readonly type: NotificationType;
  readonly title?: string;
  readonly body?: string;
  readonly channel: NotificationChannel;
  readonly status: NotificationStatus;
  readonly state: NotificationState;
  readonly priority: NotificationPriority;
  readonly dedupeKey?: string;
  readonly actorId?: string;
  readonly entityId?: string;
  readonly entityType?: string;
  readonly deepLink?: string;
  readonly imageUrl?: string;
  readonly metadata?: Record<string, unknown>;
  readonly quietHours?: QuietHoursConfig;
  readonly deferPolicy?: NotificationDeferPolicy;
  readonly deliveredAt?: string;
  readonly readAt?: string;
  readonly createdAt: string;
}

export interface SendNotificationInput {
  readonly userId: string;
  readonly type: NotificationType;
  readonly title?: string;
  readonly body?: string;
  readonly channel?: NotificationChannel;
  readonly priority?: NotificationPriority;
  readonly deferPolicy?: NotificationDeferPolicy;
  readonly dedupeKey?: string;
  readonly actorId?: string;
  readonly entityId?: string;
  readonly entityType?: string;
  readonly deepLink?: string;
  readonly imageUrl?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface NotificationListOptions {
  userId?: string;
  state?: NotificationState;
  status?: NotificationStatus;
  includeDeleted?: boolean;
  limit?: number;
  offset?: number;
}

export interface MarkAllReadResult {
  userId: string;
  updated: number;
}
