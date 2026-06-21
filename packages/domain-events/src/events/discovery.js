"use strict";
// ---------------------------------------------------------------------------
// domain-events — discovery-core events
// Emitted by star-core / event-core when content becomes discoverable.
// Consumed by search-core and feed-core indexers.
// ---------------------------------------------------------------------------
Object.defineProperty(exports, "__esModule", { value: true });
exports.GLOBAL_TREND_TRIGGERED = exports.LOCAL_TREND_TRIGGERED = exports.DISCOVERY_SCORE_UPDATED = exports.DISCOVERY_CONTENT_DEINDEXED = exports.DISCOVERY_CONTENT_INDEXED = void 0;
exports.DISCOVERY_CONTENT_INDEXED = 'discovery.content.indexed';
exports.DISCOVERY_CONTENT_DEINDEXED = 'discovery.content.deindexed';
exports.DISCOVERY_SCORE_UPDATED = 'discovery.score.updated';
exports.LOCAL_TREND_TRIGGERED = 'discovery.trend.local';
exports.GLOBAL_TREND_TRIGGERED = 'discovery.trend.global';
