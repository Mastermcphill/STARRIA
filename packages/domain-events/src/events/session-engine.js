"use strict";
// ---------------------------------------------------------------------------
// domain-events — Session Engine events (Sprint 7)
// Unified room engine: rooms, participants, billing, moderation, recording.
// ---------------------------------------------------------------------------
Object.defineProperty(exports, "__esModule", { value: true });
exports.SESSION_RECORDING_STOPPED = exports.SESSION_RECORDING_STARTED = exports.SESSION_MODERATION_ACTIONED = exports.SESSION_MODERATION_FLAGGED = exports.SESSION_BILLING_SETTLED = exports.SESSION_BILLING_CHARGED = exports.SESSION_PARTICIPANT_REMOVED = exports.SESSION_PARTICIPANT_PROMOTED = exports.SESSION_PARTICIPANT_INVITED = exports.SESSION_PARTICIPANT_LEFT = exports.SESSION_PARTICIPANT_JOINED = exports.SESSION_ROOM_CANCELLED = exports.SESSION_ROOM_ENDED = exports.SESSION_ROOM_PAUSED = exports.SESSION_ROOM_STARTED = exports.SESSION_ROOM_OPENED = exports.SESSION_ROOM_CREATED = void 0;
// ── Event type constants ────────────────────────────────────────────────────────
exports.SESSION_ROOM_CREATED = 'session-engine.room.created';
exports.SESSION_ROOM_OPENED = 'session-engine.room.opened';
exports.SESSION_ROOM_STARTED = 'session-engine.room.started';
exports.SESSION_ROOM_PAUSED = 'session-engine.room.paused';
exports.SESSION_ROOM_ENDED = 'session-engine.room.ended';
exports.SESSION_ROOM_CANCELLED = 'session-engine.room.cancelled';
exports.SESSION_PARTICIPANT_JOINED = 'session-engine.participant.joined';
exports.SESSION_PARTICIPANT_LEFT = 'session-engine.participant.left';
exports.SESSION_PARTICIPANT_INVITED = 'session-engine.participant.invited';
exports.SESSION_PARTICIPANT_PROMOTED = 'session-engine.participant.promoted';
exports.SESSION_PARTICIPANT_REMOVED = 'session-engine.participant.removed';
exports.SESSION_BILLING_CHARGED = 'session-engine.billing.charged';
exports.SESSION_BILLING_SETTLED = 'session-engine.billing.settled';
exports.SESSION_MODERATION_FLAGGED = 'session-engine.moderation.flagged';
exports.SESSION_MODERATION_ACTIONED = 'session-engine.moderation.actioned';
exports.SESSION_RECORDING_STARTED = 'session-engine.recording.started';
exports.SESSION_RECORDING_STOPPED = 'session-engine.recording.stopped';
