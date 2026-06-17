# Domain Event Catalog

All 33 events published across STARRIA packages. Each row shows the event type string, the payload shape, and which package publishes it.

---

## support-core

| Event Type | Aggregate | Key Payload Fields |
|---|---|---|
| `supporter.profile.created` | SupporterProfile | supporterId, userId, displayName |
| `supporter.spend.recorded` | SupporterProfile | supporterId, coinsSpent, fiatMinorUnitsSpent, lifetimeCoinsSpent, lifetimeFiatSpent |
| `supporter.tier.upgraded` | SupporterProfile | supporterId, previousTier, newTier |
| `supporter.subscribed` | Subscription | subscriptionId, supporterId, starId, tier, startedAt, endsAt? |
| `supporter.subscription.cancelled` | Subscription | subscriptionId, supporterId, starId, cancelledAt, immediate |

---

## wallet-core

| Event Type | Aggregate | Key Payload Fields |
|---|---|---|
| `wallet.ledger.entry.created` | WalletLedgerEntry | entryId, accountId, accountType, direction, amount, currency, balanceAfter, reason, reference |
| `wallet.payout.requested` | WalletPayout | payoutId, accountId, amount, currency, destinationRef |
| `wallet.payout.completed` | WalletPayout | payoutId, accountId, amount, currency, completedAt |

---

## gifting-core

| Event Type | Aggregate | Key Payload Fields |
|---|---|---|
| `gift.coin.sent` | CoinGift | reference, senderId, recipientId, coins, platformCut, creatorAmount, platformPercentage, targetType |
| `gift.fiat.sent` | FiatGift | giftId, reference, senderId?, recipientId?, amount, currency, platformFee, creatorAmount, targetType |
| `gift.livestream.sent` | LivestreamGift | id, reference, senderId, recipientId, roomId, currency, amount, platformCut, creatorAmount |

---

## tap-core

| Event Type | Aggregate | Key Payload Fields |
|---|---|---|
| `tap.completed` | Tap | tapId, senderId, receiverId, type, currency, grossAmount, platformFee, creatorNet, reference, contextType?, contextId? |
| `tap.failed` | Tap | tapId, senderId, receiverId, type, reason, idempotencyKey |
| `tap.refunded` | Tap | tapId, senderId, receiverId, grossAmount, currency, refundedAt |

---

## star-core

| Event Type | Aggregate | Key Payload Fields |
|---|---|---|
| `star.profile.created` | StarProfile | starId, userId, displayName, username |
| `star.tier.upgraded` | StarProfile | starId, previousTier, newTier, subscriberCount |
| `star.verified` | StarProfile | starId, requestId, reviewedBy, reviewedAt |
| `star.verification.rejected` | StarProfile | starId, requestId, reviewedBy, reason |
| `star.followed` | StarProfile | starId, followerId, followerCount |
| `star.unfollowed` | StarProfile | starId, followerId, followerCount |
| `star.subscriber.added` | StarProfile | starId, supporterId, subscriptionTier, subscriberCount |
| `star.subscriber.removed` | StarProfile | starId, supporterId, subscriberCount |

---

## discovery-core (emitted by star-core / event-core via search index port)

| Event Type | Aggregate | Key Payload Fields |
|---|---|---|
| `discovery.content.indexed` | (entity) | entityId, entityType, title?, tags?, category?, starId?, isLive?, indexedAt |
| `discovery.content.deindexed` | (entity) | entityId, entityType, reason, deindexedAt |
| `discovery.score.updated` | (entity) | entityId, entityType, previousScore, newScore |

---

## event-core

| Event Type | Aggregate | Key Payload Fields |
|---|---|---|
| `starria.event.created` | StarriaEvent | eventId, starId, arenaId?, title, type, visibility, scheduledAt? |
| `starria.event.scheduled` | StarriaEvent | eventId, starId, scheduledAt |
| `starria.event.started` | StarriaEvent | eventId, starId, arenaId?, startedAt |
| `starria.event.ended` | StarriaEvent | eventId, starId, endedAt, durationSeconds?, peakViewerCount, totalViewerCount, tapCount |
| `starria.event.cancelled` | StarriaEvent | eventId, starId, cancelledAt |
| `starria.event.replay.published` | EventReplay | replayId, eventId, starId, playbackUrl, durationSeconds? |
| `starria.event.viewer.joined` | EventWatchSession | sessionId, eventId, userId, joinedAt |
| `starria.event.viewer.left` | EventWatchSession | sessionId, eventId, userId, leftAt, watchSeconds |

---

## arena-core

| Event Type | Aggregate | Key Payload Fields |
|---|---|---|
| `arena.created` | Arena | arenaId, starId, name, accessMode, livekitRoom, createdAt |
| `arena.closed` | Arena | arenaId, starId, closedAt, totalParticipantCount |
| `arena.participant.joined` | ArenaParticipant | participantId, arenaId, userId, role, joinedAt |
| `arena.participant.left` | ArenaParticipant | participantId, arenaId, userId, leftAt, durationSeconds |
| `arena.participant.muted` | ArenaModerationRecord | recordId, arenaId, moderatorId, targetUserId, action, reason? |
| `arena.participant.removed` | ArenaModerationRecord | recordId, arenaId, moderatorId, targetUserId, action, reason? |
| `arena.participant.banned` | ArenaModerationRecord | recordId, arenaId, moderatorId, targetUserId, action, reason?, expiresAt? |
| `arena.participant.promoted` | ArenaModerationRecord | recordId, arenaId, moderatorId, targetUserId, action |
| `arena.participant.demoted` | ArenaModerationRecord | recordId, arenaId, moderatorId, targetUserId, action |

---

## creator-os-core

| Event Type | Aggregate | Key Payload Fields |
|---|---|---|
| `creator.onboarded` | Creator | creatorId, userId, starId, onboardedAt, onboardingVersion |
| `creator.settings.updated` | Creator | creatorId, starId, changedFields[], updatedAt |
| `creator.payout.configured` | Creator | creatorId, starId, payoutMethod, configuredAt |
| `creator.deactivated` | Creator | creatorId, starId, reason, deactivatedAt, deactivatedBy |
| `creator.reactivated` | Creator | creatorId, starId, reactivatedAt, reactivatedBy |

---

## Common Cross-Domain Subscriptions

| Subscriber | Listens To | Reaction |
|---|---|---|
| star-core | `supporter.subscribed` | call `StarService.onSubscriberAdded()` |
| star-core | `supporter.subscription.cancelled` | call `StarService.onSubscriberRemoved()` |
| analytics-core | `tap.completed` | record tap analytics |
| analytics-core | `starria.event.ended` | record event metrics |
| analytics-core | `starria.event.viewer.left` | record watch time |
| feed-core | `star.tier.upgraded` | re-rank creator in feed |
| feed-core | `starria.event.started` | surface live event in FYP |
| notification-core | `supporter.tier.upgraded` | push upgrade notification |
| notification-core | `star.verified` | push verification badge notification |
| notification-core | `starria.event.replay.published` | push replay-ready notification |
