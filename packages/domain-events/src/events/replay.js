"use strict";
// ---------------------------------------------------------------------------
// domain-events — Replay events (Sprint 7)
// Recording → process → thumbnails → publish → discovery pipeline.
// ---------------------------------------------------------------------------
Object.defineProperty(exports, "__esModule", { value: true });
exports.REPLAY_FAILED = exports.REPLAY_PUSHED_TO_DISCOVERY = exports.REPLAY_PUBLISHED = exports.REPLAY_THUMBNAILS_READY = exports.REPLAY_PROCESSING_STARTED = exports.REPLAY_RECORDING_CAPTURED = void 0;
exports.REPLAY_RECORDING_CAPTURED = 'replay.recording.captured';
exports.REPLAY_PROCESSING_STARTED = 'replay.processing.started';
exports.REPLAY_THUMBNAILS_READY = 'replay.thumbnails.ready';
exports.REPLAY_PUBLISHED = 'replay.published';
exports.REPLAY_PUSHED_TO_DISCOVERY = 'replay.pushed-to-discovery';
exports.REPLAY_FAILED = 'replay.failed';
