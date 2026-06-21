// ---------------------------------------------------------------------------
// LiveKit adapter — implements LiveKitPort using livekit-server-sdk.
//
// Production-only: LIVEKIT_API_KEY, LIVEKIT_API_SECRET and LIVEKIT_URL must all
// be configured. If any is missing the service refuses to construct — the app
// fails fast at boot rather than silently issuing fake tokens or pretending to
// own rooms that do not exist. There is no stub / dev fallback path.
// ---------------------------------------------------------------------------

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AccessToken,
  RoomServiceClient,
  WebhookReceiver,
  type WebhookEvent,
} from 'livekit-server-sdk';
import type { LiveKitPort } from '@starria/live-core';

@Injectable()
export class LiveKitAdapterService implements LiveKitPort {
  private readonly logger = new Logger(LiveKitAdapterService.name);
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly host: string;
  private readonly roomService: RoomServiceClient;
  private readonly webhookReceiver: WebhookReceiver;

  constructor(private readonly config: ConfigService) {
    const apiKey = config.get<string>('LIVEKIT_API_KEY')?.trim();
    const apiSecret = config.get<string>('LIVEKIT_API_SECRET')?.trim();
    const url = config.get<string>('LIVEKIT_URL')?.trim();

    const missing = [
      ['LIVEKIT_API_KEY', apiKey],
      ['LIVEKIT_API_SECRET', apiSecret],
      ['LIVEKIT_URL', url],
    ]
      .filter(([, v]) => !v)
      .map(([k]) => k);

    if (missing.length) {
      throw new Error(
        `LiveKit is not configured — missing required env: ${missing.join(', ')}. ` +
          'Set all of LIVEKIT_API_KEY, LIVEKIT_API_SECRET and LIVEKIT_URL. ' +
          'Stub/fake tokens are not supported.',
      );
    }

    this.apiKey = apiKey!;
    this.apiSecret = apiSecret!;
    // RoomServiceClient + webhook receiver speak HTT(S); the SDK token URL is
    // ws(s). Derive the HTTP host from LIVEKIT_HOST if given, else from URL.
    this.host =
      config.get<string>('LIVEKIT_HOST')?.trim() ||
      url!.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:');

    this.roomService = new RoomServiceClient(this.host, this.apiKey, this.apiSecret);
    this.webhookReceiver = new WebhookReceiver(this.apiKey, this.apiSecret);

    this.logger.log(`LiveKit adapter ready (host=${this.host})`);
  }

  async createRoom(roomName: string, maxParticipants: number): Promise<void> {
    await this.roomService.createRoom({ name: roomName, maxParticipants });
  }

  async deleteRoom(roomName: string): Promise<void> {
    await this.roomService.deleteRoom(roomName);
  }

  async generateToken(params: {
    roomName: string;
    identity: string;
    displayName?: string;
    canPublish: boolean;
    canSubscribe: boolean;
  }): Promise<string> {
    const at = new AccessToken(this.apiKey, this.apiSecret, {
      identity: params.identity,
      name: params.displayName,
    });
    at.addGrant({
      roomJoin: true,
      room: params.roomName,
      canPublish: params.canPublish,
      canSubscribe: params.canSubscribe,
    });
    // toJwt() returns Promise<string> in livekit-server-sdk v2; await covers
    // both sync and async SDK variants.
    return await at.toJwt();
  }

  async removeParticipant(roomName: string, identity: string): Promise<void> {
    await this.roomService.removeParticipant(roomName, identity);
  }

  async muteParticipant(roomName: string, identity: string, muted: boolean): Promise<void> {
    // Mute every track published by the participant.
    const participant = await this.roomService.getParticipant(roomName, identity);
    const tracks: Array<{ sid: string }> = participant.tracks ?? [];
    await Promise.all(
      tracks.map((t) =>
        this.roomService.mutePublishedTrack(roomName, identity, t.sid, muted),
      ),
    );
  }

  // ── Health & webhooks ──────────────────────────────────────────────────────

  /**
   * Verify the LiveKit server is reachable and the configured credentials are
   * accepted. listRooms() performs an authenticated call to the LiveKit server,
   * so a success proves both reachability and credential validity.
   */
  async healthCheck(): Promise<{ reachable: boolean; roomCount?: number; error?: string }> {
    try {
      const rooms = await this.roomService.listRooms();
      return { reachable: true, roomCount: rooms.length };
    } catch (e) {
      return { reachable: false, error: (e as Error).message };
    }
  }

  /**
   * Verify a LiveKit webhook's signature over the raw request body and return
   * the decoded event. Throws if the signature is missing or invalid.
   */
  async receiveWebhook(body: string, authHeader?: string): Promise<WebhookEvent> {
    if (!authHeader) {
      throw new Error('Missing Authorization header on LiveKit webhook');
    }
    return this.webhookReceiver.receive(body, authHeader);
  }
}
