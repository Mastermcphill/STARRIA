"use strict";
// ---------------------------------------------------------------------------
// domain-events — discovery "content tap" events
// A content tap is a weighted discovery signal (upvote/like) on a video.
// Distinct from the payment Tap in tap-core (tap.completed / tap.failed).
// ---------------------------------------------------------------------------
Object.defineProperty(exports, "__esModule", { value: true });
exports.REGIONAL_BOOST_UPDATED = exports.CONTENT_TAP_REJECTED = exports.CONTENT_TAP_RECORDED = void 0;
exports.CONTENT_TAP_RECORDED = 'discovery.tap.recorded';
exports.CONTENT_TAP_REJECTED = 'discovery.tap.rejected';
exports.REGIONAL_BOOST_UPDATED = 'discovery.boost.updated';
