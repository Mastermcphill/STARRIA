// ---------------------------------------------------------------------------
// event-core — port interfaces
// ---------------------------------------------------------------------------

import type {
  EventRecord,
  EventReplay,
  EventWatchSession,
  EventDiscoveryFilter,
  EventPage,
  PublishReplayInput,
} from './types';

// ---------------------------------------------------------------------------
// Event store
// ---------------------------------------------------------------------------

export interface EventStorePort {
  findById(eventId: string): Promise<EventRecord | undefined>;
  create(input: Omit<EventRecord, 'id' | 'createdAt' | 'updatedAt' | 'peakViewerCount' | 'totalViewerCount' | 'tapCount' | 'totalCoinsReceived'>): Promise<EventRecord>;
  update(eventId: string, patch: Partial<Pick<EventRecord, 'title' | 'description' | 'visibility' | 'thumbnailUrl' | 'scheduledAt' | 'tags'>>): Promise<EventRecord>;
  transitionStatus(eventId: string, status: EventRecord['status'], patch?: Partial<Pick<EventRecord, 'startedAt' | 'endedAt' | 'durationSeconds'>>): Promise<EventRecord>;
  incrementViewerCount(eventId: string, delta: number): Promise<void>;
  updatePeakViewers(eventId: string, count: number): Promise<void>;
  incrementTapMetrics(eventId: string, coins: number): Promise<void>;
  list(filter: EventDiscoveryFilter): Promise<EventPage>;
}

// ---------------------------------------------------------------------------
// Replay store
// ---------------------------------------------------------------------------

export interface EventReplayPort {
  findByEventId(eventId: string): Promise<EventReplay | undefined>;
  create(input: PublishReplayInput & { id: string; isReady: boolean; createdAt: string }): Promise<EventReplay>;
  markReady(replayId: string): Promise<EventReplay>;
}

// ---------------------------------------------------------------------------
// Watch session port
// ---------------------------------------------------------------------------

export interface EventWatchSessionPort {
  join(input: { id: string; eventId: string; userId: string; joinedAt: string }): Promise<EventWatchSession>;
  leave(input: { eventId: string; userId: string; leftAt: string; lastPositionSeconds?: number }): Promise<EventWatchSession | undefined>;
  countActive(eventId: string): Promise<number>;
}

// ---------------------------------------------------------------------------
// Analytics port (bridges to analytics-core AnalyticsService)
// ---------------------------------------------------------------------------

export interface EventAnalyticsPort {
  trackEventStarted(eventId: string, starId: string, category: string): Promise<void>;
  trackEventEnded(eventId: string, durationSeconds: number, peakViewers: number): Promise<void>;
  trackViewerJoined(eventId: string, userId: string): Promise<void>;
  trackViewerLeft(eventId: string, userId: string, watchSeconds: number): Promise<void>;
}

// ---------------------------------------------------------------------------
// Notification port
// ---------------------------------------------------------------------------

export interface EventNotificationPort {
  onEventScheduled(eventId: string, starId: string, scheduledAt: string): Promise<void>;
  onEventLive(eventId: string, starId: string, arenaId?: string): Promise<void>;
  onEventEnded(eventId: string, starId: string): Promise<void>;
  onReplayReady(eventId: string, starId: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Search index port (bridges to search-core)
// ---------------------------------------------------------------------------

export interface EventSearchIndexPort {
  index(event: EventRecord): Promise<void>;
  remove(eventId: string): Promise<void>;
}
