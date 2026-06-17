// ---------------------------------------------------------------------------
// arena-core — port interfaces
// ---------------------------------------------------------------------------

import type {
  ArenaRecord,
  CreateArenaInput,
  UpdateArenaInput,
  ArenaParticipant,
  JoinArenaInput,
  ArenaJoinToken,
  ArenaModerationInput,
  ArenaModerationRecord,
  ArenaDiscoveryFilter,
} from './types';

// ---------------------------------------------------------------------------
// Arena store
// ---------------------------------------------------------------------------

export interface ArenaStorePort {
  findById(arenaId: string): Promise<ArenaRecord | undefined>;
  findByLivekitRoom(roomName: string): Promise<ArenaRecord | undefined>;
  create(input: CreateArenaInput & { id: string; livekitRoom: string; createdAt: string; updatedAt: string }): Promise<ArenaRecord>;
  update(arenaId: string, input: UpdateArenaInput): Promise<ArenaRecord>;
  updateStatus(arenaId: string, status: ArenaRecord['status']): Promise<ArenaRecord>;
  incrementParticipants(arenaId: string, delta: number): Promise<void>;
  list(filter: ArenaDiscoveryFilter): Promise<{ items: ArenaRecord[]; nextCursor?: string; hasMore: boolean }>;
}

// ---------------------------------------------------------------------------
// Participant store
// ---------------------------------------------------------------------------

export interface ArenaParticipantPort {
  findActive(arenaId: string, userId: string): Promise<ArenaParticipant | undefined>;
  join(input: JoinArenaInput & { id: string; role: ArenaParticipant['role']; joinedAt: string }): Promise<ArenaParticipant>;
  leave(arenaId: string, userId: string, leftAt: string): Promise<ArenaParticipant | undefined>;
  listActive(arenaId: string): Promise<ArenaParticipant[]>;
  countActive(arenaId: string): Promise<number>;
  updateStatus(participantId: string, status: ArenaParticipant['status'], muteReason?: string): Promise<ArenaParticipant>;
  updateRole(participantId: string, role: ArenaParticipant['role']): Promise<ArenaParticipant>;
}

// ---------------------------------------------------------------------------
// Moderation store
// ---------------------------------------------------------------------------

export interface ArenaModerationPort {
  record(input: ArenaModerationInput & { id: string; createdAt: string; expiresAt?: string }): Promise<ArenaModerationRecord>;
  isBanned(arenaId: string, userId: string): Promise<boolean>;
  listBanned(arenaId: string): Promise<string[]>;
}

// ---------------------------------------------------------------------------
// LiveKit port — abstraction over the LiveKit Server SDK
// ---------------------------------------------------------------------------

export interface LiveKitPort {
  /** Create a LiveKit room (idempotent — no-op if already exists). */
  ensureRoom(roomName: string, options?: { maxParticipants?: number }): Promise<void>;
  /** Generate a signed join token for a user. */
  generateToken(params: {
    roomName: string;
    userId: string;
    displayName: string;
    role: 'host' | 'speaker' | 'viewer';
    expiresInSeconds?: number;
  }): Promise<{ token: string; expiresAt: string; serverUrl: string }>;
  /** Remove a participant from a room. */
  removeParticipant(roomName: string, userId: string): Promise<void>;
  /** Mute a participant's audio/video track. */
  muteParticipant(roomName: string, userId: string): Promise<void>;
  /** Close a room, removing all participants. */
  closeRoom(roomName: string): Promise<void>;
  /** Check if a room is currently active. */
  getRoomInfo(roomName: string): Promise<{ participantCount: number; isActive: boolean } | undefined>;
}

// ---------------------------------------------------------------------------
// Analytics port
// ---------------------------------------------------------------------------

export interface ArenaAnalyticsPort {
  trackParticipantJoined(arenaId: string, userId: string): Promise<void>;
  trackParticipantLeft(arenaId: string, userId: string, durationSeconds: number): Promise<void>;
  trackModerationAction(arenaId: string, action: string, targetUserId: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Notification port
// ---------------------------------------------------------------------------

export interface ArenaNotificationPort {
  onUserJoined(arenaId: string, userId: string, starId: string): Promise<void>;
  onUserRemoved(arenaId: string, userId: string, reason?: string): Promise<void>;
  onArenaOpened(arenaId: string, starId: string): Promise<void>;
  onArenaClosed(arenaId: string, starId: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Subscription check port (injected from support-core)
// ---------------------------------------------------------------------------

export interface ArenaSubscriptionCheckPort {
  hasActiveSubscription(userId: string, starId: string): Promise<boolean>;
}
