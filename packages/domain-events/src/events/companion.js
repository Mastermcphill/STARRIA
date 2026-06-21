"use strict";
// ---------------------------------------------------------------------------
// domain-events — Sprint 6 Companion Economy events
// ---------------------------------------------------------------------------
Object.defineProperty(exports, "__esModule", { value: true });
exports.SESSION_FLAGGED = exports.PANIC_LEAVE_TRIGGERED = exports.COMPANION_REPORTED = exports.COMPANION_BLOCKED = exports.COMPANION_RECOMMENDATION_SENT = exports.LONELINESS_PROFILE_UPDATED = exports.PARTICIPANT_LEFT = exports.PARTICIPANT_JOINED = exports.PARTICIPANT_INVITED = exports.SESSION_PAYOUT_SETTLED = exports.SESSION_CANCELLED = exports.SESSION_ENDED = exports.SESSION_EXTENDED = exports.SESSION_STARTED = exports.SESSION_BOOKED = exports.CONSENT_RECORDED = exports.AGE_GATE_FAILED = exports.AGE_GATE_PASSED = exports.COMPANION_SUSPENDED = exports.COMPANION_VERIFIED = exports.COMPANION_PROFILE_UPDATED = exports.COMPANION_PROFILE_CREATED = void 0;
// ── Companion Profile ─────────────────────────────────────────────────────────
exports.COMPANION_PROFILE_CREATED = 'companion.profile.created';
exports.COMPANION_PROFILE_UPDATED = 'companion.profile.updated';
exports.COMPANION_VERIFIED = 'companion.verified';
exports.COMPANION_SUSPENDED = 'companion.suspended';
// ── Age Gate ──────────────────────────────────────────────────────────────────
exports.AGE_GATE_PASSED = 'age_gate.passed';
exports.AGE_GATE_FAILED = 'age_gate.failed';
exports.CONSENT_RECORDED = 'age_gate.consent.recorded';
// ── Session ───────────────────────────────────────────────────────────────────
exports.SESSION_BOOKED = 'session.booked';
exports.SESSION_STARTED = 'session.started';
exports.SESSION_EXTENDED = 'session.extended';
exports.SESSION_ENDED = 'session.ended';
exports.SESSION_CANCELLED = 'session.cancelled';
exports.SESSION_PAYOUT_SETTLED = 'session.payout.settled';
exports.PARTICIPANT_INVITED = 'session.participant.invited';
exports.PARTICIPANT_JOINED = 'session.participant.joined';
exports.PARTICIPANT_LEFT = 'session.participant.left';
// ── Loneliness / Recommendation ───────────────────────────────────────────────
exports.LONELINESS_PROFILE_UPDATED = 'loneliness.profile.updated';
exports.COMPANION_RECOMMENDATION_SENT = 'loneliness.recommendation.sent';
// ── Safety ────────────────────────────────────────────────────────────────────
exports.COMPANION_BLOCKED = 'companion.safety.blocked';
exports.COMPANION_REPORTED = 'companion.safety.reported';
exports.PANIC_LEAVE_TRIGGERED = 'companion.safety.panic_leave';
exports.SESSION_FLAGGED = 'companion.safety.session_flagged';
