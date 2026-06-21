// ---------------------------------------------------------------------------
// session-engine-core — domain types
// Unifies all room types (live events, companion sessions, battles, etc.)
// under a single engine with billing, moderation, recording & replay hooks.
// ---------------------------------------------------------------------------

import type {
  SessionRoomType,
  SessionRoomStatus,
  SessionRoomRole,
} from '@starria/domain-events';

export type { SessionRoomType, SessionRoomStatus, SessionRoomRole };

// ── Billing modes ─────────────────────────────────────────────────────────────

export type BillingMode =
  | 'FREE'              // no charge
  | 'TICKETED'          // pay once to enter
  | 'PER_MINUTE'        // metered (companion sessions)
  | 'SUPPORTER_GATED'   // must be a supporter
  | 'COIN_ENTRY';       // flat coin entry fee

export interface SessionBilling {
  readonly mode: BillingMode;
  readonly entryCoins?: number;
  readonly perMinuteCoins?: number;
  readonly platformFeePct: number;     // default 20
  readonly creatorPct: number;         // default 80
  readonly minSupporterTier?: string;
}

// ── Permission matrix per room type ────────────────────────────────────────────

export interface SessionPermission {
  readonly canPublishVideo: SessionRoomRole[];
  readonly canPublishAudio: SessionRoomRole[];
  readonly canScreenShare: SessionRoomRole[];
  readonly canInvite: SessionRoomRole[];
  readonly canModerate: SessionRoomRole[];
  readonly canRecord: SessionRoomRole[];
}

// ── Room ────────────────────────────────────────────────────────────────────────

export interface SessionRoom {
  readonly id: string;
  readonly roomType: SessionRoomType;
  readonly title: string;
  readonly hostId: string;
  readonly status: SessionRoomStatus;
  readonly maxParticipants: number;
  readonly livekitRoomName: string;
  readonly billing: SessionBilling;
  readonly permissions: SessionPermission;
  readonly recordingEnabled: boolean;
  readonly replayPublishing: boolean;
  readonly metadata?: Record<string, unknown>;
  readonly createdAt: string;
  readonly openedAt?: string;
  readonly startedAt?: string;
  readonly endedAt?: string;
}

// ── Participant ───────────────────────────────────────────────────────────────

export type ParticipantStatus = 'INVITED' | 'JOINED' | 'LEFT' | 'REMOVED';

export interface SessionParticipant {
  readonly id: string;
  readonly roomId: string;
  readonly userId: string;
  readonly role: SessionRoomRole;
  readonly status: ParticipantStatus;
  readonly invitedBy?: string;
  readonly joinedAt?: string;
  readonly leftAt?: string;
}

// ── Recording ───────────────────────────────────────────────────────────────────

export type RecordingStatus = 'IDLE' | 'RECORDING' | 'STOPPED' | 'FAILED';

export interface SessionRecording {
  readonly id: string;
  readonly roomId: string;
  readonly status: RecordingStatus;
  readonly egressId?: string;        // LiveKit egress id
  readonly rawAssetUrl?: string;
  readonly durationSeconds?: number;
  readonly startedAt?: string;
  readonly stoppedAt?: string;
}

// ── Moderation ────────────────────────────────────────────────────────────────

export type ModerationAction = 'WARN' | 'MUTE' | 'KICK' | 'BAN' | 'FLAG';

export interface SessionModeration {
  readonly id: string;
  readonly roomId: string;
  readonly targetUserId: string;
  readonly actorId: string;
  readonly action: ModerationAction;
  readonly reason?: string;
  readonly at: string;
}

// ── Replay handle (engine-side reference; full lifecycle in replay-core) ─────────

export interface SessionReplay {
  readonly id: string;
  readonly roomId: string;
  readonly recordingId: string;
  readonly published: boolean;
  readonly replayId?: string;        // replay-core id once published
}

// ── Default permission matrix per room type ──────────────────────────────────────

export const DEFAULT_PERMISSIONS: Record<SessionRoomType, SessionPermission> = {
  LIVE_EVENT: {
    canPublishVideo: ['HOST', 'CO_HOST', 'PERFORMER'],
    canPublishAudio: ['HOST', 'CO_HOST', 'PERFORMER'],
    canScreenShare: ['HOST', 'CO_HOST'],
    canInvite: ['HOST', 'CO_HOST'],
    canModerate: ['HOST', 'MODERATOR'],
    canRecord: ['HOST'],
  },
  COMPANION_AUDIO: {
    canPublishVideo: [],
    canPublishAudio: ['HOST', 'GUEST'],
    canScreenShare: [],
    canInvite: ['HOST'],
    canModerate: ['HOST'],
    canRecord: ['HOST'],
  },
  COMPANION_VIDEO: {
    canPublishVideo: ['HOST', 'GUEST'],
    canPublishAudio: ['HOST', 'GUEST'],
    canScreenShare: ['HOST'],
    canInvite: ['HOST'],
    canModerate: ['HOST'],
    canRecord: ['HOST'],
  },
  SUPPORTER_ROOM: {
    canPublishVideo: ['HOST', 'CO_HOST'],
    canPublishAudio: ['HOST', 'CO_HOST', 'GUEST'],
    canScreenShare: ['HOST', 'CO_HOST'],
    canInvite: ['HOST', 'CO_HOST'],
    canModerate: ['HOST', 'MODERATOR'],
    canRecord: ['HOST'],
  },
  CREATOR_QA: {
    canPublishVideo: ['HOST', 'CO_HOST'],
    canPublishAudio: ['HOST', 'CO_HOST', 'GUEST'],
    canScreenShare: ['HOST'],
    canInvite: ['HOST', 'CO_HOST'],
    canModerate: ['HOST', 'MODERATOR'],
    canRecord: ['HOST'],
  },
  RAP_BATTLE: {
    canPublishVideo: ['HOST', 'PERFORMER'],
    canPublishAudio: ['HOST', 'PERFORMER'],
    canScreenShare: [],
    canInvite: ['HOST'],
    canModerate: ['HOST', 'MODERATOR'],
    canRecord: ['HOST'],
  },
  SING_OFF: {
    canPublishVideo: ['HOST', 'PERFORMER'],
    canPublishAudio: ['HOST', 'PERFORMER'],
    canScreenShare: [],
    canInvite: ['HOST'],
    canModerate: ['HOST', 'MODERATOR'],
    canRecord: ['HOST'],
  },
  YAP_BATTLE: {
    canPublishVideo: ['HOST', 'PERFORMER'],
    canPublishAudio: ['HOST', 'PERFORMER'],
    canScreenShare: [],
    canInvite: ['HOST'],
    canModerate: ['HOST', 'MODERATOR'],
    canRecord: ['HOST'],
  },
  AI_PREMIERE: {
    canPublishVideo: ['HOST'],
    canPublishAudio: ['HOST', 'CO_HOST'],
    canScreenShare: ['HOST'],
    canInvite: ['HOST'],
    canModerate: ['HOST', 'MODERATOR'],
    canRecord: ['HOST'],
  },
  PRIVATE_ROOM: {
    canPublishVideo: ['HOST', 'GUEST'],
    canPublishAudio: ['HOST', 'GUEST'],
    canScreenShare: ['HOST', 'GUEST'],
    canInvite: ['HOST'],
    canModerate: ['HOST'],
    canRecord: ['HOST'],
  },
};

// ── Default participant caps per room type ────────────────────────────────────────

export const DEFAULT_MAX_PARTICIPANTS: Record<SessionRoomType, number> = {
  LIVE_EVENT: 5000,
  COMPANION_AUDIO: 2,
  COMPANION_VIDEO: 2,
  SUPPORTER_ROOM: 500,
  CREATOR_QA: 1000,
  RAP_BATTLE: 200,
  SING_OFF: 200,
  YAP_BATTLE: 200,
  AI_PREMIERE: 5000,
  PRIVATE_ROOM: 8,
};

export const DEFAULT_PLATFORM_FEE_PCT = 20;
export const DEFAULT_CREATOR_PCT = 80;

// ── Inputs ────────────────────────────────────────────────────────────────────

export interface CreateRoomInput {
  readonly roomType: SessionRoomType;
  readonly hostId: string;
  readonly title: string;
  readonly maxParticipants?: number;
  readonly billing?: Partial<SessionBilling>;
  readonly recordingEnabled?: boolean;
  readonly replayPublishing?: boolean;
  readonly metadata?: Record<string, unknown>;
  readonly idempotencyKey?: string;
}

export interface JoinRoomInput {
  readonly roomId: string;
  readonly userId: string;
  readonly role?: SessionRoomRole;
}

export interface InviteInput {
  readonly roomId: string;
  readonly invitedBy: string;
  readonly userId: string;
  readonly role: SessionRoomRole;
}

export interface ModerateInput {
  readonly roomId: string;
  readonly actorId: string;
  readonly targetUserId: string;
  readonly action: ModerationAction;
  readonly reason?: string;
}

// ── Ports ─────────────────────────────────────────────────────────────────────

export interface SessionEngineStorePort {
  createRoom(room: SessionRoom): Promise<SessionRoom>;
  getRoom(roomId: string): Promise<SessionRoom | null>;
  updateRoom(roomId: string, patch: Partial<SessionRoom>): Promise<SessionRoom>;
  listRooms(filter?: { status?: SessionRoomStatus; roomType?: SessionRoomType }): Promise<SessionRoom[]>;
  findRoomByKey(idempotencyKey: string): Promise<SessionRoom | null>;
  setRoomKey(idempotencyKey: string, roomId: string): Promise<void>;

  addParticipant(p: SessionParticipant): Promise<SessionParticipant>;
  getParticipant(roomId: string, userId: string): Promise<SessionParticipant | null>;
  updateParticipant(roomId: string, userId: string, patch: Partial<SessionParticipant>): Promise<void>;
  listParticipants(roomId: string): Promise<SessionParticipant[]>;
  countActiveParticipants(roomId: string): Promise<number>;

  createRecording(rec: SessionRecording): Promise<SessionRecording>;
  getRecording(recordingId: string): Promise<SessionRecording | null>;
  getRecordingByRoom(roomId: string): Promise<SessionRecording | null>;
  updateRecording(recordingId: string, patch: Partial<SessionRecording>): Promise<SessionRecording>;

  addModeration(m: SessionModeration): Promise<SessionModeration>;
  listModeration(roomId: string): Promise<SessionModeration[]>;
}

export interface SessionBillingPort {
  /** Charge a user for entry/metered usage. Throws if insufficient balance. */
  charge(userId: string, coins: number, reason: string): Promise<void>;
  /** Settle accumulated room revenue: split between platform & creator. */
  settle(roomId: string, creatorId: string, grossCoins: number, platformFeePct: number): Promise<{ creatorCoins: number; platformCoins: number }>;
}

/** Provisions LiveKit rooms & access tokens. Stubbed until Sprint 7 LiveKit wiring. */
export interface LiveKitProviderPort {
  createRoom(roomName: string, maxParticipants: number): Promise<void>;
  issueToken(roomName: string, identity: string, canPublish: boolean): Promise<string>;
  startEgress(roomName: string): Promise<{ egressId: string }>;
  stopEgress(egressId: string): Promise<{ assetUrl: string; durationSeconds: number }>;
  deleteRoom(roomName: string): Promise<void>;
}
