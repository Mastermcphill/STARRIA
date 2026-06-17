// ---------------------------------------------------------------------------
// notification-core — push notification provider contract
// Implement this for FCM, APNs, OneSignal, etc.
// ---------------------------------------------------------------------------

export interface PushTokenRecord {
  readonly userId: string;
  readonly token: string;
  readonly platform: 'ios' | 'android' | 'web';
  readonly createdAt: string;
}

export interface PushPayload {
  readonly title: string;
  readonly body: string;
  readonly imageUrl?: string;
  readonly deepLink?: string;
  readonly data?: Record<string, string>;
  readonly badge?: number;
  readonly sound?: string;
}

export interface PushSendResult {
  readonly token: string;
  readonly success: boolean;
  readonly messageId?: string;
  readonly errorCode?: string;
  readonly errorMessage?: string;
}

/** Implement per push provider (FCM, APNs, OneSignal…). */
export interface PushProvider {
  readonly name: string;
  send(token: string, payload: PushPayload): Promise<PushSendResult>;
  sendBatch(tokens: string[], payload: PushPayload): Promise<PushSendResult[]>;
}

/** Implement to retrieve / store device tokens. */
export interface PushTokenStore {
  getTokens(userId: string): Promise<PushTokenRecord[]>;
  upsert(record: PushTokenRecord): Promise<void>;
  remove(token: string): Promise<void>;
}
