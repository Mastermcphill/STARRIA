// ---------------------------------------------------------------------------
// event-core — EventService
// Orchestrates the Event lifecycle and bridges to analytics, notifications,
// and the search index.
// Business logic: TODO (wire ports in consuming app)
// ---------------------------------------------------------------------------

import { randomUUID } from 'crypto';
import type {
  EventRecord,
  EventReplay,
  EventWatchSession,
  CreateEventInput,
  UpdateEventInput,
  StartEventInput,
  EndEventInput,
  PublishReplayInput,
  JoinEventInput,
  LeaveEventInput,
  EventDiscoveryFilter,
  EventPage,
} from './types';
import { isValidEventTransition } from './types';
import type { EventBus } from '@starria/domain-events';
import type {
  EventStorePort,
  EventReplayPort,
  EventWatchSessionPort,
  EventAnalyticsPort,
  EventNotificationPort,
  EventSearchIndexPort,
} from './ports';
import {
  buildStarriaEventCreatedEvent,
  buildStarriaEventStartedEvent,
  buildStarriaEventEndedEvent,
  buildStarriaEventCancelledEvent,
  buildReplayPublishedEvent,
  buildViewerJoinedEvent,
  buildViewerLeftEvent,
} from './events';

export class EventService {
  constructor(
    private readonly events: EventStorePort,
    private readonly replays: EventReplayPort,
    private readonly watchSessions: EventWatchSessionPort,
    private readonly analytics?: EventAnalyticsPort,
    private readonly notifications?: EventNotificationPort,
    private readonly searchIndex?: EventSearchIndexPort,
    private readonly eventBus?: EventBus,
  ) {}

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async getById(eventId: string): Promise<EventRecord | undefined> {
    return this.events.findById(eventId);
  }

  async create(input: CreateEventInput): Promise<EventRecord> {
    const event = await this.events.create({
      ...input,
      visibility: input.visibility ?? 'public',
      tags: input.tags ?? [],
      status: input.scheduledAt ? 'SCHEDULED' : 'DRAFT',
    });
    void this.searchIndex?.index(event);
    if (input.scheduledAt) {
      void this.notifications?.onEventScheduled(event.id, event.starId, input.scheduledAt);
    }
    void this.eventBus?.publish(buildStarriaEventCreatedEvent({
      eventId: event.id,
      starId: event.starId,
      arenaId: event.arenaId,
      title: event.title,
      type: event.type,
      visibility: event.visibility,
      scheduledAt: input.scheduledAt,
    }));
    return event;
  }

  async update(eventId: string, input: UpdateEventInput): Promise<EventRecord> {
    const event = await this.events.update(eventId, input);
    void this.searchIndex?.index(event);
    return event;
  }

  async list(filter: EventDiscoveryFilter): Promise<EventPage> {
    return this.events.list(filter);
  }

  // ── Lifecycle transitions ─────────────────────────────────────────────────

  async start(input: StartEventInput): Promise<EventRecord> {
    const event = await this.events.findById(input.eventId);
    if (!event) throw new Error(`Event not found: ${input.eventId}`);
    if (!isValidEventTransition(event.status, 'LIVE')) {
      throw new Error(`Cannot transition event from ${event.status} to LIVE`);
    }
    const updated = await this.events.transitionStatus(input.eventId, 'LIVE', {
      startedAt: new Date().toISOString(),
    });
    void this.analytics?.trackEventStarted(event.id, event.starId, event.category);
    void this.notifications?.onEventLive(event.id, event.starId, event.arenaId);
    void this.searchIndex?.index(updated);
    void this.eventBus?.publish(buildStarriaEventStartedEvent({
      eventId: event.id,
      starId: event.starId,
      arenaId: event.arenaId,
      startedAt: new Date().toISOString(),
    }));
    return updated;
  }

  async end(input: EndEventInput): Promise<EventRecord> {
    const event = await this.events.findById(input.eventId);
    if (!event) throw new Error(`Event not found: ${input.eventId}`);
    if (!isValidEventTransition(event.status, 'ENDED')) {
      throw new Error(`Cannot transition event from ${event.status} to ENDED`);
    }
    const now = new Date().toISOString();
    const duration = input.durationSeconds
      ?? (event.startedAt ? Math.floor((Date.now() - new Date(event.startedAt).getTime()) / 1000) : undefined);
    const updated = await this.events.transitionStatus(input.eventId, 'ENDED', {
      endedAt: now,
      durationSeconds: duration,
    });
    void this.analytics?.trackEventEnded(event.id, duration ?? 0, event.peakViewerCount);
    void this.notifications?.onEventEnded(event.id, event.starId);
    void this.searchIndex?.index(updated);
    void this.eventBus?.publish(buildStarriaEventEndedEvent({
      eventId: event.id,
      starId: event.starId,
      endedAt: now,
      durationSeconds: duration,
      peakViewerCount: event.peakViewerCount,
      totalViewerCount: event.totalViewerCount,
      tapCount: event.tapCount,
    }));
    return updated;
  }

  async cancel(eventId: string, starId: string): Promise<EventRecord> {
    const event = await this.events.findById(eventId);
    if (!event) throw new Error(`Event not found: ${eventId}`);
    if (!isValidEventTransition(event.status, 'CANCELLED')) {
      throw new Error(`Cannot cancel event from status ${event.status}`);
    }
    const updated = await this.events.transitionStatus(eventId, 'CANCELLED');
    void this.searchIndex?.remove(eventId);
    void this.eventBus?.publish(buildStarriaEventCancelledEvent({
      eventId,
      starId,
      cancelledAt: new Date().toISOString(),
    }));
    return updated;
  }

  // ── Replay ────────────────────────────────────────────────────────────────

  async getReplay(eventId: string): Promise<EventReplay | undefined> {
    return this.replays.findByEventId(eventId);
  }

  async publishReplay(input: PublishReplayInput): Promise<EventReplay> {
    const replay = await this.replays.create({
      ...input,
      id: randomUUID(),
      isReady: true,
      createdAt: new Date().toISOString(),
    });
    const event = await this.events.findById(input.eventId);
    if (event) {
      void this.notifications?.onReplayReady(event.id, event.starId);
      void this.eventBus?.publish(buildReplayPublishedEvent({
        replayId: replay.id,
        eventId: event.id,
        starId: event.starId,
        playbackUrl: replay.playbackUrl,
        durationSeconds: replay.durationSeconds,
      }));
    }
    return replay;
  }

  // ── Watch sessions ────────────────────────────────────────────────────────

  async joinEvent(input: JoinEventInput): Promise<EventWatchSession> {
    const session = await this.watchSessions.join({
      id: randomUUID(),
      eventId: input.eventId,
      userId: input.userId,
      joinedAt: new Date().toISOString(),
    });
    const count = await this.watchSessions.countActive(input.eventId);
    await this.events.incrementViewerCount(input.eventId, 1);
    await this.events.updatePeakViewers(input.eventId, count);
    void this.analytics?.trackViewerJoined(input.eventId, input.userId);
    void this.eventBus?.publish(buildViewerJoinedEvent({
      sessionId: session.id,
      eventId: input.eventId,
      userId: input.userId,
      joinedAt: session.joinedAt,
    }));
    return session;
  }

  async leaveEvent(input: LeaveEventInput): Promise<EventWatchSession | undefined> {
    const now = new Date().toISOString();
    const session = await this.watchSessions.leave({
      eventId: input.eventId,
      userId: input.userId,
      leftAt: now,
      lastPositionSeconds: input.lastPositionSeconds,
    });
    if (session?.joinedAt) {
      const watchSeconds = Math.floor((Date.now() - new Date(session.joinedAt).getTime()) / 1000);
      void this.analytics?.trackViewerLeft(input.eventId, input.userId, watchSeconds);
      void this.eventBus?.publish(buildViewerLeftEvent({
        sessionId: session.id,
        eventId: input.eventId,
        userId: input.userId,
        leftAt: new Date().toISOString(),
        watchSeconds,
      }));
    }
    return session;
  }

  async getActiveViewerCount(eventId: string): Promise<number> {
    return this.watchSessions.countActive(eventId);
  }

  // ── Tap metrics hook (called by tap-core) ─────────────────────────────────

  async recordTapOnEvent(eventId: string, coins: number): Promise<void> {
    await this.events.incrementTapMetrics(eventId, coins);
  }
}
