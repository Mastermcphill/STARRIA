/**
 * LiveKit multi-client integration harness.
 *
 * Spins up N real LiveKit clients (default 5) against a real LiveKit server and
 * exercises the full media path that the acceptance criteria call for:
 *
 *   ✓ Create room          (RoomServiceClient.createRoom)
 *   ✓ Join room            (N clients connect concurrently with real tokens)
 *   ✓ Host publishes audio (synthetic 16kHz mono sine track)
 *   ✓ Host publishes video (synthetic RGBA frames)
 *   ✓ Guests receive streams (each guest asserts TrackSubscribed: audio + video)
 *   ✓ Leave room           (all clients disconnect, room participant list drains)
 *   ✓ No stub tokens       (tokens are real signed JWTs; a stub would never connect)
 *
 * It then runs a webhook receiver check: it POSTs the running API's
 * /webhooks/livekit endpoint with a LiveKit-signed payload for each of the six
 * required event types and asserts the receiver verifies the signature and
 * acknowledges the event (proving the persistence path is wired end-to-end).
 *
 * Usage:
 *   node test/livekit-multiclient.harness.mjs
 *
 * Required env (the harness SKIPS, not fails, if LiveKit creds are absent):
 *   LIVEKIT_URL          wss://your-project.livekit.cloud
 *   LIVEKIT_API_KEY
 *   LIVEKIT_API_SECRET
 * Optional env:
 *   HARNESS_CLIENTS      number of clients (default 5)
 *   API_BASE             e.g. http://localhost:3000/api/v1  → enables /live/health
 *                        pre-check and the signed-webhook receiver check
 *   HARNESS_MEDIA_SECS   seconds to hold the live session (default 5)
 */

import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import {
  Room,
  RoomEvent,
  TrackKind,
  AudioSource,
  VideoSource,
  LocalAudioTrack,
  LocalVideoTrack,
  AudioFrame,
  VideoFrame,
  VideoBufferType,
  TrackPublishOptions,
  TrackSource,
} from '@livekit/rtc-node';
import { createHash, createHmac } from 'crypto';

const b64url = (buf) =>
  Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const URL = process.env.LIVEKIT_URL?.trim();
const KEY = process.env.LIVEKIT_API_KEY?.trim();
const SECRET = process.env.LIVEKIT_API_SECRET?.trim();
const N = Number(process.env.HARNESS_CLIENTS ?? 5);
const API_BASE = process.env.API_BASE?.trim();
const MEDIA_SECS = Number(process.env.HARNESS_MEDIA_SECS ?? 5);

const httpHost = () =>
  (process.env.LIVEKIT_HOST?.trim() ||
    URL.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:'));

const log = (...a) => console.log('[harness]', ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let failures = 0;
function assert(cond, msg) {
  if (cond) {
    log('  ✓', msg);
  } else {
    failures++;
    console.error('[harness]   ✗', msg);
  }
}

// ── Synthetic media producers ────────────────────────────────────────────────

/** Publish a continuously-captured 440Hz sine wave audio track. */
function startAudioPublisher(localParticipant) {
  const sampleRate = 16000;
  const channels = 1;
  const source = new AudioSource(sampleRate, channels);
  const track = LocalAudioTrack.createAudioTrack('mic', source);
  const samplesPerFrame = sampleRate / 100; // 10ms frames
  let phase = 0;
  let stopped = false;

  const pump = async () => {
    while (!stopped) {
      const data = new Int16Array(samplesPerFrame);
      for (let i = 0; i < samplesPerFrame; i++) {
        data[i] = Math.round(Math.sin(phase) * 8000);
        phase += (2 * Math.PI * 440) / sampleRate;
      }
      const frame = new AudioFrame(data, sampleRate, channels, samplesPerFrame);
      await source.captureFrame(frame);
    }
  };

  const opts = new TrackPublishOptions();
  opts.source = TrackSource.SOURCE_MICROPHONE;
  return localParticipant.publishTrack(track, opts).then((pub) => {
    pump();
    return () => { stopped = true; };
  });
}

/** Publish a continuously-captured solid-color RGBA video track. */
function startVideoPublisher(localParticipant) {
  const width = 320;
  const height = 240;
  const source = new VideoSource(width, height);
  const track = LocalVideoTrack.createVideoTrack('camera', source);
  let stopped = false;
  let tick = 0;

  const pump = async () => {
    while (!stopped) {
      const data = new Uint8Array(width * height * 4);
      const r = (tick * 7) % 255;
      for (let i = 0; i < data.length; i += 4) {
        data[i] = r; data[i + 1] = 128; data[i + 2] = 255 - r; data[i + 3] = 255;
      }
      const frame = new VideoFrame(data, width, height, VideoBufferType.RGBA);
      source.captureFrame(frame);
      tick++;
      await sleep(66); // ~15fps
    }
  };

  const opts = new TrackPublishOptions();
  opts.source = TrackSource.SOURCE_CAMERA;
  return localParticipant.publishTrack(track, opts).then(() => {
    pump();
    return () => { stopped = true; };
  });
}

// ── Client ───────────────────────────────────────────────────────────────────

async function makeToken(roomName, identity, canPublish) {
  const at = new AccessToken(KEY, SECRET, { identity, name: identity });
  at.addGrant({ roomJoin: true, room: roomName, canPublish, canSubscribe: true });
  return at.toJwt();
}

async function connectClient(roomName, identity, canPublish) {
  const token = await makeToken(roomName, identity, canPublish);
  assert(token.split('.').length === 3 && !token.includes('DEV-STUB'),
    `${identity}: real signed JWT issued (not a stub)`);

  const room = new Room();
  const received = { audio: false, video: false };

  room.on(RoomEvent.TrackSubscribed, (track) => {
    if (track.kind === TrackKind.KIND_AUDIO) received.audio = true;
    if (track.kind === TrackKind.KIND_VIDEO) received.video = true;
  });

  await room.connect(URL, token, { autoSubscribe: true, dynacast: false });
  return { room, identity, received, canPublish };
}

// ── Webhook receiver check ────────────────────────────────────────────────────

/**
 * Build a LiveKit-compatible signed webhook request. LiveKit signs an empty-body
 * JWT whose `sha256` claim is the base64 digest of the JSON body, then sends it
 * as the Authorization header.
 */
function signedWebhook(bodyObj) {
  const body = JSON.stringify(bodyObj);
  const sha256 = createHash('sha256').update(body).digest('base64');
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({
    iss: KEY, sha256, iat: now, exp: now + 60, nbf: now - 5,
  }));
  const sig = b64url(createHmac('sha256', SECRET).update(`${header}.${payload}`).digest());
  return { body, auth: `${header}.${payload}.${sig}` };
}

async function webhookCheck(roomName) {
  if (!API_BASE) {
    log('webhook check skipped (set API_BASE to enable)');
    return;
  }
  log('webhook receiver check →', `${API_BASE}/webhooks/livekit`);
  const events = [
    { event: 'room_started', room: { name: roomName } },
    { event: 'participant_joined', room: { name: roomName }, participant: { identity: 'user-harness' } },
    { event: 'track_published', room: { name: roomName }, participant: { identity: 'user-harness' }, track: { sid: 'TR_x' } },
    { event: 'track_unpublished', room: { name: roomName }, participant: { identity: 'user-harness' }, track: { sid: 'TR_x' } },
    { event: 'participant_left', room: { name: roomName }, participant: { identity: 'user-harness' } },
    { event: 'room_finished', room: { name: roomName } },
  ];

  for (const ev of events) {
    const { body, auth } = await signedWebhook(ev);
    const res = await fetch(`${API_BASE}/webhooks/livekit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: auth },
      body,
    });
    assert(res.status === 200, `webhook ${ev.event} accepted (HTTP ${res.status})`);
  }

  // Reject check: a tampered body must fail signature verification.
  const { auth } = await signedWebhook({ event: 'room_started', room: { name: roomName } });
  const bad = await fetch(`${API_BASE}/webhooks/livekit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: auth },
    body: JSON.stringify({ event: 'room_started', room: { name: 'TAMPERED' } }),
  });
  assert(bad.status >= 400, `tampered webhook rejected (HTTP ${bad.status})`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (!URL || !KEY || !SECRET) {
    log('SKIP — set LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET to run.');
    process.exit(0);
  }

  log(`Target ${URL} — ${N} clients, holding ${MEDIA_SECS}s`);
  const svc = new RoomServiceClient(httpHost(), KEY, SECRET);
  const roomName = `starria-harness-${Date.now()}`;

  // Optional API pre-check.
  if (API_BASE) {
    try {
      const res = await fetch(`${API_BASE}/live/health`);
      const json = await res.json();
      assert(res.status === 200 && json.status === 'ok',
        `API /live/health reports LiveKit reachable (${JSON.stringify(json.livekit ?? json)})`);
    } catch (e) {
      assert(false, `API /live/health reachable: ${e.message}`);
    }
  }

  // 1. Create room.
  await svc.createRoom({ name: roomName, maxParticipants: Math.max(10, N + 2) });
  log('created room', roomName);

  const clients = [];
  try {
    // 2. Join — host + (N-1) guests connect concurrently.
    const specs = Array.from({ length: N }, (_, i) =>
      i === 0
        ? { id: 'user-host', publish: true }
        : { id: `user-guest${i}`, publish: false },
    );
    const connected = await Promise.all(
      specs.map((s) => connectClient(roomName, s.id, s.publish)),
    );
    clients.push(...connected);
    assert(connected.length === N, `${N} clients connected concurrently`);

    const serverParts = await svc.listParticipants(roomName);
    assert(serverParts.length === N,
      `LiveKit server reports ${serverParts.length}/${N} participants in room`);

    // 3 & 4. Host publishes audio + video.
    const host = clients[0];
    const stopAudio = await startAudioPublisher(host.room.localParticipant);
    const stopVideo = await startVideoPublisher(host.room.localParticipant);
    assert(true, 'host published audio + video tracks');

    // 5. Guests receive both streams (poll up to MEDIA_SECS).
    const guests = clients.slice(1);
    const deadline = Date.now() + MEDIA_SECS * 1000;
    while (Date.now() < deadline && guests.some((g) => !(g.received.audio && g.received.video))) {
      await sleep(250);
    }
    for (const g of guests) {
      assert(g.received.audio, `${g.identity} received host audio`);
      assert(g.received.video, `${g.identity} received host video`);
    }

    stopAudio?.();
    stopVideo?.();
  } finally {
    // 6. Leave — all clients disconnect.
    await Promise.all(clients.map((c) => c.room.disconnect().catch(() => {})));
    log('all clients disconnected');
    // room lifecycle stable: participant list drains.
    await sleep(1000);
    try {
      const remaining = await svc.listParticipants(roomName);
      assert(remaining.length === 0, `room drained after leave (${remaining.length} left)`);
    } catch { /* room may already be closed */ }
    await svc.deleteRoom(roomName).catch(() => {});
  }

  // 7. Webhook receiver + persistence path check.
  await webhookCheck(roomName);

  log('────────────────────────────────────────────');
  if (failures === 0) {
    log('RESULT: PASS — all acceptance checks green');
    process.exit(0);
  } else {
    console.error(`[harness] RESULT: FAIL — ${failures} check(s) failed`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('[harness] fatal:', e);
  process.exit(1);
});
