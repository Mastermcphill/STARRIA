// ---------------------------------------------------------------------------
// replay-core — domain event builders
// ---------------------------------------------------------------------------

import { randomUUID } from 'crypto';
import { createEvent } from '@starria/domain-events';
import type {
  ReplayRecordingCapturedEvent,
  ReplayProcessingEvent,
  ReplayThumbnailsReadyEvent,
  ReplayAssetPublishedEvent,
  ReplayDiscoveryEvent,
  ReplayFailedEvent,
  ReplayRecordingCapturedPayload,
  ReplayProcessingPayload,
  ReplayThumbnailsReadyPayload,
  ReplayAssetPublishedPayload,
  ReplayDiscoveryPayload,
  ReplayFailedPayload,
} from '@starria/domain-events';
import {
  REPLAY_RECORDING_CAPTURED,
  REPLAY_PROCESSING_STARTED,
  REPLAY_THUMBNAILS_READY,
  REPLAY_PUBLISHED,
  REPLAY_PUSHED_TO_DISCOVERY,
  REPLAY_FAILED,
} from '@starria/domain-events';

export function buildRecordingCaptured(p: ReplayRecordingCapturedPayload): ReplayRecordingCapturedEvent {
  return createEvent({ id: randomUUID(), type: REPLAY_RECORDING_CAPTURED, aggregateId: p.replayId, aggregateType: 'Replay', payload: p });
}
export function buildProcessingStarted(p: ReplayProcessingPayload): ReplayProcessingEvent {
  return createEvent({ id: randomUUID(), type: REPLAY_PROCESSING_STARTED, aggregateId: p.replayId, aggregateType: 'Replay', payload: p });
}
export function buildThumbnailsReady(p: ReplayThumbnailsReadyPayload): ReplayThumbnailsReadyEvent {
  return createEvent({ id: randomUUID(), type: REPLAY_THUMBNAILS_READY, aggregateId: p.replayId, aggregateType: 'Replay', payload: p });
}
export function buildReplayPublished(p: ReplayAssetPublishedPayload): ReplayAssetPublishedEvent {
  return createEvent({ id: randomUUID(), type: REPLAY_PUBLISHED, aggregateId: p.replayId, aggregateType: 'Replay', payload: p });
}
export function buildPushedToDiscovery(p: ReplayDiscoveryPayload): ReplayDiscoveryEvent {
  return createEvent({ id: randomUUID(), type: REPLAY_PUSHED_TO_DISCOVERY, aggregateId: p.replayId, aggregateType: 'Replay', payload: p });
}
export function buildReplayFailed(p: ReplayFailedPayload): ReplayFailedEvent {
  return createEvent({ id: randomUUID(), type: REPLAY_FAILED, aggregateId: p.replayId, aggregateType: 'Replay', payload: p });
}
