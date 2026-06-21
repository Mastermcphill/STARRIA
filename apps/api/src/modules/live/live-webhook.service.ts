// ---------------------------------------------------------------------------
// LiveKit webhook service — turns verified LiveKit server events into durable
// state changes on LiveRoom / LiveParticipant. The signature has already been
// verified by LiveKitAdapterService.receiveWebhook() before we get here.
//
// Handled events:
//   room_started        → room.status = LIVE,  startedAt
//   room_finished       → room.status = ENDED, endedAt
//   participant_joined  → upsert participant, recount participantCount/peak
//   participant_left    → mark leftAt, recount participantCount
//   track_published     → log (publishing began)
//   track_unpublished   → log (publishing stopped)
// ---------------------------------------------------------------------------

import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { WebhookEvent } from 'livekit-server-sdk';
import { PrismaLiveStoreRepository } from './prisma-live-store.repository';
import { LiveKitEgressService } from './livekit-egress.service';
import { NestReplayService } from '../replay/replay.service';

@Injectable()
export class LiveWebhookService {
  private readonly logger = new Logger(LiveWebhookService.name);

  constructor(
    private readonly store: PrismaLiveStoreRepository,
    private readonly egress: LiveKitEgressService,
    private readonly replay: NestReplayService,
  ) {}

  async handle(event: WebhookEvent): Promise<{ handled: boolean; event: string }> {
    const type = event.event;
    const roomName = event.room?.name;

    switch (type) {
      case 'room_started':
        await this.onRoomStarted(roomName);
        break;
      case 'room_finished':
        await this.onRoomFinished(roomName);
        break;
      case 'participant_joined':
        await this.onParticipantJoined(roomName, event.participant?.identity);
        break;
      case 'participant_left':
        await this.onParticipantLeft(roomName, event.participant?.identity);
        break;
      case 'track_published':
      case 'track_unpublished':
        this.logger.log(
          `${type} room=${roomName} identity=${event.participant?.identity} ` +
            `track=${event.track?.sid ?? '?'}`,
        );
        break;
      case 'egress_ended':
        await this.onEgressEnded(event);
        break;
      default:
        this.logger.debug(`Ignoring unhandled LiveKit webhook event: ${type}`);
        return { handled: false, event: type };
    }

    return { handled: true, event: type };
  }

  // ── Room lifecycle ──────────────────────────────────────────────────────────

  private async onRoomStarted(roomName?: string): Promise<void> {
    const room = await this.requireRoom(roomName);
    if (!room) return;
    if (room.status === 'LIVE') return; // idempotent
    await this.store.updateRoom(room.id, {
      status: 'LIVE',
      startedAt: room.startedAt ?? new Date().toISOString(),
    });
    this.logger.log(`room_started → room ${room.id} marked LIVE`);

    // Begin recording for replay when egress is configured. Best-effort: a
    // recording failure must not break the live session, and when egress is
    // disabled we simply do not record (production-safe disabled mode).
    if (this.egress.isEnabled && roomName) {
      try {
        const handle = await this.egress.startRoomRecording(roomName);
        this.logger.log(`Recording started for room ${room.id} (egress=${handle.egressId})`);
      } catch (e) {
        this.logger.error(`Failed to start recording for room ${room.id}: ${(e as Error).message}`);
      }
    }
  }

  private async onRoomFinished(roomName?: string): Promise<void> {
    const room = await this.requireRoom(roomName);
    if (!room) return;
    if (room.status === 'ENDED') return; // idempotent
    await this.store.updateRoom(room.id, {
      status: 'ENDED',
      endedAt: new Date().toISOString(),
    });
    this.logger.log(`room_finished → room ${room.id} marked ENDED`);
  }

  // ── Egress → replay capture ──────────────────────────────────────────────────

  /**
   * When room recording finishes, capture it into the replay pipeline. The
   * egress wrote a segmented HLS playlist to R2; we hand its public URL to the
   * replay processor, which probes the real duration and adopts it for playback.
   * Idempotent on the egress id (replay-core dedupes by recordingId).
   */
  private async onEgressEnded(event: WebhookEvent): Promise<void> {
    const info = event.egressInfo;
    if (!info) {
      this.logger.warn('egress_ended without egressInfo — skipping');
      return;
    }
    const roomName = info.roomName;
    const room = await this.requireRoom(roomName);
    if (!room) return;

    const playlistUrl = this.resolvePlaylistUrl(info, roomName);
    if (!playlistUrl) {
      this.logger.warn(
        `egress_ended for room ${room.id} produced no playlist location — skipping capture`,
      );
      return;
    }

    try {
      const replay = await this.replay.replays.captureAndProcess({
        roomId: room.id,
        recordingId: info.egressId,
        creatorId: room.starId,
        sourceRoomType: room.roomType,
        rawAssetUrl: playlistUrl,
        durationSeconds: 0, // real duration is probed from the HLS playlist
        title: room.title,
      });
      this.logger.log(
        `egress_ended → replay ${replay.id} (${replay.status}) for room ${room.id}`,
      );
    } catch (e) {
      // Processing-disabled or transcode errors must not 500 the webhook; the
      // replay is left FAILED for admin visibility and the webhook is acked.
      this.logger.error(
        `egress_ended capture failed for room ${room.id}: ${(e as Error).message}`,
      );
    }
  }

  /** Prefer the segment playlist location reported by egress; fall back to the
   *  deterministic key the egress service would have used. */
  private resolvePlaylistUrl(
    info: NonNullable<WebhookEvent['egressInfo']>,
    roomName: string | undefined,
  ): string | null {
    const seg = info.segmentResults?.[0];
    const location = seg?.playlistLocation || seg?.playlistName;
    if (location && /^https?:\/\//i.test(location)) return location;
    if (location) return this.egress.publicUrl(location.replace(/^\//, ''));
    if (roomName) return this.egress.publicUrl(this.egress.playlistKeyFor(roomName).key);
    return null;
  }

  // ── Participants ────────────────────────────────────────────────────────────

  private async onParticipantJoined(roomName?: string, identity?: string): Promise<void> {
    const room = await this.requireRoom(roomName);
    if (!room) return;
    const userId = this.userIdFromIdentity(identity);
    if (!userId) return;

    const existing = await this.store.findParticipant(room.id, userId);
    if (existing && !existing.leftAt) {
      // Already tracked (joined via API) — nothing to persist beyond recount.
    } else if (existing && existing.leftAt) {
      await this.store.updateParticipant(existing.id, { leftAt: undefined });
    } else {
      await this.store.createParticipant({
        id: randomUUID(),
        roomId: room.id,
        userId,
        role: 'VIEWER',
        livekitIdentity: identity!,
        isMuted: false,
        isBanned: false,
        joinedAt: new Date().toISOString(),
        watchSeconds: 0,
      });
    }

    const count = await this.store.countActiveParticipants(room.id);
    await this.store.updateRoom(room.id, {
      participantCount: count,
      peakViewerCount: Math.max(room.peakViewerCount, count),
    });
    this.logger.log(`participant_joined → room ${room.id} user ${userId} (count=${count})`);
  }

  private async onParticipantLeft(roomName?: string, identity?: string): Promise<void> {
    const room = await this.requireRoom(roomName);
    if (!room) return;
    const userId = this.userIdFromIdentity(identity);
    if (!userId) return;

    const participant = await this.store.findParticipant(room.id, userId);
    if (participant && !participant.leftAt) {
      const watchSeconds = Math.round(
        (Date.now() - Date.parse(participant.joinedAt)) / 1000,
      );
      await this.store.updateParticipant(participant.id, {
        leftAt: new Date().toISOString(),
        watchSeconds,
      });
    }

    const count = await this.store.countActiveParticipants(room.id);
    await this.store.updateRoom(room.id, { participantCount: count });
    this.logger.log(`participant_left → room ${room.id} user ${userId} (count=${count})`);
  }

  // ── helpers ─────────────────────────────────────────────────────────────────

  private async requireRoom(roomName?: string) {
    if (!roomName) {
      this.logger.warn('LiveKit webhook missing room name — skipping');
      return null;
    }
    const room = await this.store.findRoomByLivekitName(roomName);
    if (!room) {
      this.logger.warn(`LiveKit webhook for unknown room "${roomName}" — skipping`);
      return null;
    }
    return room;
  }

  // join flow uses identity `user-<userId>`; tolerate raw ids too.
  private userIdFromIdentity(identity?: string): string | null {
    if (!identity) return null;
    return identity.startsWith('user-') ? identity.slice('user-'.length) : identity;
  }
}
