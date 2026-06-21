import { Injectable, Inject } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { EventBus } from '@starria/domain-events';
import {
  PRESENCE_UPDATED,
  USER_TYPING,
} from '@starria/domain-events';
import { createEvent } from '@starria/domain-events';
import { EVENT_BUS } from '../../event-bus/event-bus.module';

export type PresenceState = 'ONLINE' | 'AWAY' | 'BUSY' | 'OFFLINE' | 'IN_SESSION';

export interface PresenceProfile {
  readonly userId: string;
  readonly state: PresenceState;
  readonly lastSeenAt: string;
  readonly roomId?: string;
  readonly updatedAt: string;
}

const PRESENCES = new Map<string, PresenceProfile>();

@Injectable()
export class PresenceService {
  constructor(@Inject(EVENT_BUS) private readonly eventBus: EventBus) {}

  async getPresence(userId: string): Promise<PresenceProfile> {
    return PRESENCES.get(userId) ?? {
      userId,
      state: 'OFFLINE',
      lastSeenAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  async updatePresence(
    userId: string,
    state: PresenceState,
    roomId?: string,
  ): Promise<PresenceProfile> {
    const now = new Date().toISOString();
    const previous = await this.getPresence(userId);

    const updated: PresenceProfile = {
      userId,
      state,
      roomId,
      lastSeenAt: now,
      updatedAt: now,
    };
    PRESENCES.set(userId, updated);

    void this.eventBus?.publish(createEvent({
      id: randomUUID(),
      type: PRESENCE_UPDATED,
      aggregateId: userId,
      aggregateType: 'PresenceProfile',
      payload: {
        userId,
        state,
        previousState: previous.state,
        lastSeenAt: now,
        roomId,
        updatedAt: now,
      },
    }));

    return updated;
  }

  async setTyping(
    userId: string,
    conversationId: string,
    isTyping: boolean,
  ): Promise<void> {
    void this.eventBus?.publish(createEvent({
      id: randomUUID(),
      type: USER_TYPING,
      aggregateId: conversationId,
      aggregateType: 'Conversation',
      payload: {
        userId,
        conversationId,
        isTyping,
        at: new Date().toISOString(),
      },
    }));
  }
}
