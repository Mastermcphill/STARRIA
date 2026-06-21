"use strict";
// ---------------------------------------------------------------------------
// domain-events — Sprint 4 Prestige events
// White Star, Gold Star, Upload Caps, Revenue Ladder
// ---------------------------------------------------------------------------
Object.defineProperty(exports, "__esModule", { value: true });
exports.UPLOAD_LIMIT_REACHED = exports.LEGACY_ACHIEVEMENT_UNLOCKED = exports.GOLD_STAR_UPDATED = exports.WHITE_STAR_SEASON_RESET = exports.WHITE_STAR_DECAY_APPLIED = exports.WHITE_STAR_TIER_CHANGED = exports.WHITE_STAR_UPDATED = void 0;
// ── White Star ───────────────────────────────────────────────────────────────
exports.WHITE_STAR_UPDATED = 'prestige.white_star.updated';
exports.WHITE_STAR_TIER_CHANGED = 'prestige.white_star.tier_changed';
exports.WHITE_STAR_DECAY_APPLIED = 'prestige.white_star.decay_applied';
exports.WHITE_STAR_SEASON_RESET = 'prestige.white_star.season_reset';
// ── Gold Star ────────────────────────────────────────────────────────────────
exports.GOLD_STAR_UPDATED = 'prestige.gold_star.updated';
exports.LEGACY_ACHIEVEMENT_UNLOCKED = 'prestige.gold_star.achievement_unlocked';
// ── Upload Caps ──────────────────────────────────────────────────────────────
exports.UPLOAD_LIMIT_REACHED = 'prestige.upload.limit_reached';
