import type { WebhookEvent } from 'livekit-server-sdk';
import { LiveWebhookService } from './live-webhook.service';
import type { PrismaLiveStoreRepository } from './prisma-live-store.repository';
import type { LiveRoom, LiveParticipant } from '@starria/live-core';

// Minimal in-memory fake of the store methods the webhook service touches.
function makeStore(room: LiveRoom | null) {
  const participants = new Map<string, LiveParticipant>();
  const roomState = room ? { ...room } : null;
  return {
    state: { room: roomState, participants },
    async findRoomByLivekitName(name: string) {
      return roomState && roomState.livekitRoomName === name ? roomState : null;
    },
    async updateRoom(_id: string, patch: Partial<LiveRoom>) {
      Object.assign(roomState!, patch);
      return roomState!;
    },
    async findParticipant(roomId: string, userId: string) {
      return participants.get(`${roomId}:${userId}`) ?? null;
    },
    async createParticipant(p: LiveParticipant) {
      participants.set(`${p.roomId}:${p.userId}`, p);
      return p;
    },
    async updateParticipant(id: string, patch: Partial<LiveParticipant>) {
      const entry = [...participants.values()].find((p) => p.id === id)!;
      Object.assign(entry, patch);
      return entry;
    },
    async countActiveParticipants(roomId: string) {
      return [...participants.values()].filter(
        (p) => p.roomId === roomId && !p.leftAt && !p.isBanned,
      ).length;
    },
  } as unknown as PrismaLiveStoreRepository & { state: any };
}

const baseRoom: LiveRoom = {
  id: 'room-1',
  eventId: 'evt-1',
  starId: 'star-1',
  title: 'Test',
  roomType: 'PUBLIC',
  status: 'WAITING',
  livekitRoomName: 'starria-live-room-1',
  maxParticipants: 500,
  participantCount: 0,
  peakViewerCount: 0,
  totalGiftsSentCoins: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const ev = (event: string, extra: Partial<WebhookEvent> = {}): WebhookEvent =>
  ({ event, room: { name: baseRoom.livekitRoomName }, ...extra }) as unknown as WebhookEvent;

// Default egress + replay test doubles. Egress only needs publicUrl/playlistKeyFor;
// replay exposes a captureAndProcess spy under `.replays`.
function makeEgress() {
  return {
    publicUrl: (key: string) => `https://cdn.test/${key}`,
    playlistKeyFor: (room: string) => ({ key: `replays/${room}/${room}.m3u8`, base: room }),
  } as any;
}
function makeReplay() {
  const captureAndProcess = jest.fn(async (input: any) => ({ id: 'replay-1', status: 'READY', ...input }));
  return { svc: { replays: { captureAndProcess } } as any, captureAndProcess };
}
function build(store: any, egress = makeEgress(), replay = makeReplay().svc) {
  return new LiveWebhookService(store, egress, replay);
}

describe('LiveWebhookService', () => {
  it('marks the room LIVE on room_started', async () => {
    const store = makeStore(baseRoom);
    const svc = build(store);
    const res = await svc.handle(ev('room_started'));
    expect(res.handled).toBe(true);
    expect(store.state.room.status).toBe('LIVE');
    expect(store.state.room.startedAt).toBeDefined();
  });

  it('marks the room ENDED on room_finished', async () => {
    const store = makeStore({ ...baseRoom, status: 'LIVE' });
    const svc = build(store);
    await svc.handle(ev('room_finished'));
    expect(store.state.room.status).toBe('ENDED');
    expect(store.state.room.endedAt).toBeDefined();
  });

  it('creates a participant and bumps counts on participant_joined', async () => {
    const store = makeStore(baseRoom);
    const svc = build(store);
    await svc.handle(ev('participant_joined', { participant: { identity: 'user-42' } } as any));
    expect(store.state.participants.get('room-1:42')).toBeDefined();
    expect(store.state.room.participantCount).toBe(1);
    expect(store.state.room.peakViewerCount).toBe(1);
  });

  it('marks the participant left and decrements count on participant_left', async () => {
    const store = makeStore(baseRoom);
    const svc = build(store);
    await svc.handle(ev('participant_joined', { participant: { identity: 'user-42' } } as any));
    await svc.handle(ev('participant_left', { participant: { identity: 'user-42' } } as any));
    expect(store.state.participants.get('room-1:42').leftAt).toBeDefined();
    expect(store.state.room.participantCount).toBe(0);
  });

  it('acknowledges track events without error', async () => {
    const store = makeStore(baseRoom);
    const svc = build(store);
    const pub = await svc.handle(ev('track_published', { participant: { identity: 'user-42' } } as any));
    const unpub = await svc.handle(ev('track_unpublished', { participant: { identity: 'user-42' } } as any));
    expect(pub.handled).toBe(true);
    expect(unpub.handled).toBe(true);
  });

  it('ignores webhooks for unknown rooms', async () => {
    const store = makeStore(null);
    const svc = build(store);
    const res = await svc.handle(ev('room_started'));
    expect(res.handled).toBe(true); // event recognised, room simply absent
    expect(store.state.room).toBeNull();
  });

  it('captures a replay on egress_ended using the reported playlist URL', async () => {
    const store = makeStore(baseRoom);
    const replay = makeReplay();
    const svc = build(store, makeEgress(), replay.svc);
    const res = await svc.handle(
      ev('egress_ended', {
        egressInfo: {
          egressId: 'eg-1',
          roomName: baseRoom.livekitRoomName,
          segmentResults: [{ playlistLocation: 'https://cdn.test/replays/x/x.m3u8' }],
        },
      } as any),
    );
    expect(res.handled).toBe(true);
    expect(replay.captureAndProcess).toHaveBeenCalledWith(
      expect.objectContaining({
        roomId: 'room-1',
        recordingId: 'eg-1',
        creatorId: 'star-1',
        rawAssetUrl: 'https://cdn.test/replays/x/x.m3u8',
      }),
    );
  });

  it('falls back to the deterministic playlist key when egress reports no location', async () => {
    const store = makeStore(baseRoom);
    const replay = makeReplay();
    const svc = build(store, makeEgress(), replay.svc);
    await svc.handle(
      ev('egress_ended', {
        egressInfo: { egressId: 'eg-2', roomName: baseRoom.livekitRoomName, segmentResults: [] },
      } as any),
    );
    expect(replay.captureAndProcess).toHaveBeenCalledWith(
      expect.objectContaining({
        rawAssetUrl: `https://cdn.test/replays/${baseRoom.livekitRoomName}/${baseRoom.livekitRoomName}.m3u8`,
      }),
    );
  });

  it('does not throw when egress capture fails (webhook still acked)', async () => {
    const store = makeStore(baseRoom);
    const replay = makeReplay();
    replay.svc.replays.captureAndProcess = jest.fn(async () => {
      throw new Error('processing disabled');
    });
    const svc = build(store, makeEgress(), replay.svc);
    const res = await svc.handle(
      ev('egress_ended', {
        egressInfo: {
          egressId: 'eg-3',
          roomName: baseRoom.livekitRoomName,
          segmentResults: [{ playlistLocation: 'https://cdn.test/x.m3u8' }],
        },
      } as any),
    );
    expect(res.handled).toBe(true);
  });
});
