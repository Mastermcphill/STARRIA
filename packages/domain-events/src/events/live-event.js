"use strict";
// ---------------------------------------------------------------------------
// domain-events — event-core events (EventRecord lifecycle)
// Prefixed `starria.event.*` to avoid collision with the JS `Event` built-in.
// ---------------------------------------------------------------------------
Object.defineProperty(exports, "__esModule", { value: true });
exports.STARRIA_EVENT_VIEWER_LEFT = exports.STARRIA_EVENT_VIEWER_JOINED = exports.STARRIA_EVENT_REPLAY_PUBLISHED = exports.STARRIA_EVENT_CANCELLED = exports.STARRIA_EVENT_ENDED = exports.STARRIA_EVENT_STARTED = exports.STARRIA_EVENT_SCHEDULED = exports.STARRIA_EVENT_CREATED = void 0;
exports.STARRIA_EVENT_CREATED = 'starria.event.created';
exports.STARRIA_EVENT_SCHEDULED = 'starria.event.scheduled';
exports.STARRIA_EVENT_STARTED = 'starria.event.started';
exports.STARRIA_EVENT_ENDED = 'starria.event.ended';
exports.STARRIA_EVENT_CANCELLED = 'starria.event.cancelled';
exports.STARRIA_EVENT_REPLAY_PUBLISHED = 'starria.event.replay.published';
exports.STARRIA_EVENT_VIEWER_JOINED = 'starria.event.viewer.joined';
exports.STARRIA_EVENT_VIEWER_LEFT = 'starria.event.viewer.left';
