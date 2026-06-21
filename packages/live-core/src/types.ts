// ---------------------------------------------------------------------------
// live-core — domain types
// All LiveKit-specific types are kept in adapters; these are pure domain types.
// ---------------------------------------------------------------------------

export type LiveRoomType =
  | 'PUBLIC'
  | 'SUPPORTERS_ONLY'
  | 'TICKETED'
  | 'INVITE_ONLY';

export type LiveParticipantRole =
  | 'HOST'
  | 'COHOST'
  | 'GUEST'
  | 'MODERATOR'
  | 'VIEWER';

export type LiveRoomStatus = 'WAITING' | 'LIVE' | 'ENDED';

export type LiveModerationActionType =
  | 'MUTE'
  | 'UNMUTE'
  | 'KICK'
  | 'BAN'
  | 'UNBAN'
  | 'PROMOTE_COHOST'
  | 'DEMOTE_VIEWER';

// ---------------------------------------------------------------------------
// LiveRoom
// ---------------------------------------------------------------------------

export interface LiveRoom {
  readonly id: string;
  readonly eventId: string;
  readonly starId: string;
  readonly title: string;
  readonly roomType: LiveRoomType;
  readonly status: LiveRoomStatus;
  readonly livekitRoomName: string;
  readonly maxParticipants: number;
  readonly participantCount: number;
  readonly peakViewerCount: number;
  readonly totalGiftsSentCoins: number;
  readonly startedAt?: string;
  readonly endedAt?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

// ---------------------------------------------------------------------------
// LiveParticipant
// ---------------------------------------------------------------------------

export interface LiveParticipant {
  readonly id: string;
  readonly roomId: string;
  readonly userId: string;
  readonly role: LiveParticipantRole;
  readonly livekitIdentity: string;
  readonly isMuted: boolean;
  readonly isBanned: boolean;
  readonly joinedAt: string;
  readonly leftAt?: string;
  readonly watchSeconds: number;
}

// ---------------------------------------------------------------------------
// LiveGift
// ---------------------------------------------------------------------------

export interface LiveGift {
  readonly id: string;
  readonly roomId: string;
  readonly eventId: string;
  readonly senderId: string;
  readonly recipientId: string;
  readonly giftType: string;
  readonly coins: number;
  readonly creatorAmount: number;
  readonly platformCut: number;
  readonly message?: string;
  readonly sentAt: string;
}

// ---------------------------------------------------------------------------
// LiveReplay
// ---------------------------------------------------------------------------

export interface LiveReplay {
  readonly id: string;
  readonly roomId: string;
  readonly eventId: string;
  readonly starId: string;
  readonly playbackUrl: string;
  readonly thumbnailUrl?: string;
  readonly durationSeconds: number;
  readonly viewCount: number;
  readonly publishedAt: string;
  readonly createdAt: string;
}

// ---------------------------------------------------------------------------
// LiveModerationAction
// ---------------------------------------------------------------------------

export interface LiveModerationAction {
  readonly id: string;
  readonly roomId: string;
  readonly moderatorId: string;
  readonly targetUserId: string;
  readonly action: LiveModerationActionType;
  readonly reason?: string;
  readonly createdAt: string;
}

// ---------------------------------------------------------------------------
// LiveChatMessage
// ---------------------------------------------------------------------------

export interface LiveChatMessage {
  readonly id: string;
  readonly roomId: string;
  readonly senderId: string;
  readonly senderDisplayName: string;
  readonly body: string;
  readonly isDeleted: boolean;
  readonly sentAt: string;
}

// ---------------------------------------------------------------------------
// LiveReaction
// ---------------------------------------------------------------------------

export interface LiveReaction {
  readonly id: string;
  readonly roomId: string;
  readonly userId: string;
  readonly emoji: string;
  readonly sentAt: string;
}

// ---------------------------------------------------------------------------
// Service I/O types
// ---------------------------------------------------------------------------

export interface CreateLiveRoomInput {
  readonly eventId: string;
  readonly starId: string;
  readonly title: string;
  readonly roomType: LiveRoomType;
  readonly maxParticipants?: number;
}

export interface JoinRoomInput {
  readonly roomId: string;
  readonly userId: string;
  readonly role?: LiveParticipantRole;
}

export interface JoinRoomResult {
  readonly participant: LiveParticipant;
  readonly livekitToken: string;
  readonly room: Pick<LiveRoom, 'id' | 'title' | 'roomType' | 'status' | 'participantCount'>;
}

export interface LeaveRoomInput {
  readonly roomId: string;
  readonly userId: string;
}

export interface ModerationInput {
  readonly roomId: string;
  readonly moderatorId: string;
  readonly targetUserId: string;
  readonly action: LiveModerationActionType;
  readonly reason?: string;
}

export interface SendLiveGiftInput {
  readonly roomId: string;
  readonly eventId: string;
  readonly senderId: string;
  readonly recipientId: string;
  readonly giftType: string;
  readonly coins: number;
  readonly message?: string;
  readonly idempotencyKey: string;
}

export interface PublishReplayInput {
  readonly roomId: string;
  readonly eventId: string;
  readonly starId: string;
  readonly playbackUrl: string;
  readonly thumbnailUrl?: string;
  readonly durationSeconds: number;
}

// ---------------------------------------------------------------------------
// LiveKit adapter port (implement in api with livekit-server-sdk)
// ---------------------------------------------------------------------------

export interface LiveKitPort {
  createRoom(roomName: string, maxParticipants: number): Promise<void>;
  deleteRoom(roomName: string): Promise<void>;
  generateToken(params: {
    roomName: string;
    identity: string;
    displayName?: string;
    canPublish: boolean;
    canSubscribe: boolean;
  }): string | Promise<string>;
  removeParticipant(roomName: string, identity: string): Promise<void>;
  muteParticipant(roomName: string, identity: string, muted: boolean): Promise<void>;
}

// ---------------------------------------------------------------------------
// Room persistence port (implement with Prisma in api)
// ---------------------------------------------------------------------------

export interface LiveRoomStorePort {
  createRoom(input: Omit<LiveRoom, 'updatedAt'>): Promise<LiveRoom>;
  findRoomById(roomId: string): Promise<LiveRoom | null>;
  findRoomByEventId(eventId: string): Promise<LiveRoom | null>;
  updateRoom(roomId: string, patch: Partial<LiveRoom>): Promise<LiveRoom>;
  createParticipant(participant: LiveParticipant): Promise<LiveParticipant>;
  findParticipant(roomId: string, userId: string): Promise<LiveParticipant | null>;
  updateParticipant(id: string, patch: Partial<LiveParticipant>): Promise<LiveParticipant>;
  countActiveParticipants(roomId: string): Promise<number>;
  createModerationAction(action: LiveModerationAction): Promise<LiveModerationAction>;
  createGift(gift: LiveGift): Promise<LiveGift>;
  createReplay(replay: LiveReplay): Promise<LiveReplay>;
}
