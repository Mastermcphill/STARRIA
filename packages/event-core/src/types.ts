// ---------------------------------------------------------------------------
// event-core — types
// Defines the Event lifecycle: SCHEDULED → LIVE → ENDED → (REPLAY) | CANCELLED.
// Events are hosted by Stars inside Arenas (optional) or standalone.
// No NestJS / Prisma dependencies.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Event identity
// ---------------------------------------------------------------------------

export type EventType = 'LIVE_STREAM' | 'REPLAY' | 'CLASS' | 'SHOW';

export type EventStatus = 'DRAFT' | 'SCHEDULED' | 'LIVE' | 'ENDED' | 'CANCELLED';

export type EventVisibility = 'public' | 'subscribers_only' | 'private';

export interface EventRecord {
  readonly id: string;
  readonly starId: string;
  readonly arenaId?: string;
  readonly title: string;
  readonly description?: string;
  readonly type: EventType;
  readonly status: EventStatus;
  readonly visibility: EventVisibility;
  readonly category: string;
  readonly tags: string[];
  readonly thumbnailUrl?: string;
  readonly scheduledAt?: string;
  readonly startedAt?: string;
  readonly endedAt?: string;
  /** Duration in seconds — set on end, used for completion rate. */
  readonly durationSeconds?: number;
  /** Max concurrent viewers for capacity planning. */
  readonly peakViewerCount: number;
  readonly totalViewerCount: number;
  readonly tapCount: number;
  readonly totalCoinsReceived: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

// ---------------------------------------------------------------------------
// Replay
// ---------------------------------------------------------------------------

export interface EventReplay {
  readonly id: string;
  readonly eventId: string;
  readonly mediaUploadId: string;
  readonly playbackUrl: string;
  readonly durationSeconds: number;
  readonly thumbnailUrl?: string;
  readonly isReady: boolean;
  readonly createdAt: string;
}

// ---------------------------------------------------------------------------
// Create / update inputs
// ---------------------------------------------------------------------------

export interface CreateEventInput {
  readonly starId: string;
  readonly title: string;
  readonly description?: string;
  readonly type: EventType;
  readonly visibility?: EventVisibility;
  readonly category: string;
  readonly tags?: string[];
  readonly thumbnailUrl?: string;
  readonly scheduledAt?: string;
  readonly arenaId?: string;
}

export interface UpdateEventInput {
  readonly title?: string;
  readonly description?: string;
  readonly visibility?: EventVisibility;
  readonly thumbnailUrl?: string;
  readonly scheduledAt?: string;
  readonly tags?: string[];
}

export interface StartEventInput {
  readonly eventId: string;
  readonly starId: string;
}

export interface EndEventInput {
  readonly eventId: string;
  readonly starId: string;
  readonly durationSeconds?: number;
}

export interface PublishReplayInput {
  readonly eventId: string;
  readonly mediaUploadId: string;
  readonly playbackUrl: string;
  readonly durationSeconds: number;
  readonly thumbnailUrl?: string;
}

// ---------------------------------------------------------------------------
// Watch session (thin record — full tracking in analytics-core)
// ---------------------------------------------------------------------------

export interface EventWatchSession {
  readonly id: string;
  readonly eventId: string;
  readonly userId: string;
  readonly joinedAt: string;
  readonly leftAt?: string;
  readonly lastPositionSeconds?: number;
}

export interface JoinEventInput {
  readonly eventId: string;
  readonly userId: string;
}

export interface LeaveEventInput {
  readonly eventId: string;
  readonly userId: string;
  readonly lastPositionSeconds?: number;
}

// ---------------------------------------------------------------------------
// Discovery / listing
// ---------------------------------------------------------------------------

export interface EventDiscoveryFilter {
  starId?: string;
  arenaId?: string;
  category?: string;
  tags?: string[];
  status?: EventStatus;
  type?: EventType;
  cursor?: string;
  limit?: number;
}

export interface EventPage {
  readonly items: EventRecord[];
  readonly nextCursor?: string;
  readonly hasMore: boolean;
}

// ---------------------------------------------------------------------------
// Status transition rules
// ---------------------------------------------------------------------------

export const VALID_EVENT_TRANSITIONS: Record<EventStatus, EventStatus[]> = {
  DRAFT:     ['SCHEDULED', 'CANCELLED'],
  SCHEDULED: ['LIVE', 'CANCELLED'],
  LIVE:      ['ENDED'],
  ENDED:     [],           // terminal
  CANCELLED: [],           // terminal
};

export function isValidEventTransition(from: EventStatus, to: EventStatus): boolean {
  return VALID_EVENT_TRANSITIONS[from]?.includes(to) ?? false;
}
