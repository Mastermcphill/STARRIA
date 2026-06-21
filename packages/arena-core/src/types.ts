// ---------------------------------------------------------------------------
// arena-core — types
// An Arena is a persistent LiveKit room owned by a Star.
// Arenas host Events (0..N events over the arena's lifetime).
// No NestJS / Prisma dependencies.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Arena identity
// ---------------------------------------------------------------------------

export type ArenaStatus = 'ACTIVE' | 'CLOSED' | 'ARCHIVED';

export type ArenaAccessMode = 'public' | 'subscribers_only' | 'invite_only';

export interface ArenaRecord {
  readonly id: string;
  readonly starId: string;
  readonly name: string;
  readonly description?: string;
  readonly status: ArenaStatus;
  readonly accessMode: ArenaAccessMode;
  readonly maxParticipants: number;
  readonly livekitRoom: string;
  readonly currentParticipantCount: number;
  readonly totalParticipantCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateArenaInput {
  readonly starId: string;
  readonly name: string;
  readonly description?: string;
  readonly accessMode?: ArenaAccessMode;
  readonly maxParticipants?: number;
}

export interface UpdateArenaInput {
  readonly name?: string;
  readonly description?: string;
  readonly accessMode?: ArenaAccessMode;
  readonly maxParticipants?: number;
}

// ---------------------------------------------------------------------------
// Participants
// ---------------------------------------------------------------------------

export type ParticipantRole = 'host' | 'speaker' | 'viewer';

export type ParticipantStatus = 'active' | 'removed' | 'banned' | 'left';

export interface ArenaParticipant {
  readonly id: string;
  readonly arenaId: string;
  readonly userId: string;
  readonly role: ParticipantRole;
  readonly status: ParticipantStatus;
  readonly joinedAt: string;
  readonly leftAt?: string;
  readonly muteReason?: string;
}

export interface JoinArenaInput {
  readonly arenaId: string;
  readonly userId: string;
  /** Role requested — host can only be assigned to the owning Star. */
  readonly requestedRole?: ParticipantRole;
}

export interface LeaveArenaInput {
  readonly arenaId: string;
  readonly userId: string;
}

// ---------------------------------------------------------------------------
// LiveKit token response (mirrors Vidzi video-core contract)
// ---------------------------------------------------------------------------

export interface ArenaJoinToken {
  readonly provider: 'livekit';
  readonly roomName: string;
  readonly token: string;
  readonly uid: string;
  readonly expiresAt: string;
  readonly serverUrl: string;
  readonly role: ParticipantRole;
}

// ---------------------------------------------------------------------------
// Moderation actions (within Arena)
// ---------------------------------------------------------------------------

export type ArenaModerationAction = 'mute' | 'unmute' | 'remove' | 'ban' | 'promote' | 'demote';

export interface ArenaModerationInput {
  readonly arenaId: string;
  readonly actorId: string;       // must be Star (host) or admin
  /** Alias of actorId used by the moderation event payload. */
  readonly moderatorId?: string;
  readonly targetUserId: string;
  readonly action: ArenaModerationAction;
  readonly reason?: string;
  readonly durationSeconds?: number;
}

export interface ArenaModerationRecord {
  readonly id: string;
  readonly arenaId: string;
  readonly actorId: string;
  readonly targetUserId: string;
  readonly action: ArenaModerationAction;
  readonly reason?: string;
  readonly expiresAt?: string;
  readonly createdAt: string;
}

// ---------------------------------------------------------------------------
// Access control check
// ---------------------------------------------------------------------------

export interface ArenaAccessContext {
  readonly userId: string;
  readonly arenaId: string;
  /** Whether the user has an active subscription to this Star. */
  readonly hasSubscription: boolean;
  /** Whether the user has been explicitly invited. */
  readonly isInvited: boolean;
  /** Whether the user is the owning Star. */
  readonly isOwner: boolean;
}

export interface ArenaAccessDecision {
  readonly allowed: boolean;
  readonly reason?: 'not_subscribed' | 'not_invited' | 'arena_closed' | 'participant_limit_reached' | 'banned';
  readonly role: ParticipantRole;
}

export function resolveArenaAccess(
  arena: ArenaRecord,
  ctx: ArenaAccessContext,
  bannedUserIds: Set<string>,
): ArenaAccessDecision {
  if (arena.status !== 'ACTIVE') {
    return { allowed: false, reason: 'arena_closed', role: 'viewer' };
  }
  if (bannedUserIds.has(ctx.userId)) {
    return { allowed: false, reason: 'banned', role: 'viewer' };
  }
  if (ctx.isOwner) {
    return { allowed: true, role: 'host' };
  }
  if (arena.currentParticipantCount >= arena.maxParticipants) {
    return { allowed: false, reason: 'participant_limit_reached', role: 'viewer' };
  }
  if (arena.accessMode === 'subscribers_only' && !ctx.hasSubscription) {
    return { allowed: false, reason: 'not_subscribed', role: 'viewer' };
  }
  if (arena.accessMode === 'invite_only' && !ctx.isInvited) {
    return { allowed: false, reason: 'not_invited', role: 'viewer' };
  }
  return { allowed: true, role: 'viewer' };
}

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

export interface ArenaDiscoveryFilter {
  starId?: string;
  status?: ArenaStatus;
  accessMode?: ArenaAccessMode;
  cursor?: string;
  limit?: number;
}
