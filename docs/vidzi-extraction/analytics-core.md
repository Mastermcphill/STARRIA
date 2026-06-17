# analytics-core Migration Guide

## Source in Vidzi

Vidzi does not have a dedicated analytics service. Watch-time data is
implicit in two places:

| Data | Vidzi location |
|---|---|
| Session start/end | `RoomParticipant.joined_at` / `left_at` in `app/models.py` |
| Join/leave tracking | `_join_room_record()` / `_leave_room_record()` in `app/routers/rooms.py` |
| Duration derivation | Computed in admin dashboards at read time (no pre-aggregation) |

`analytics-core` formalizes this into a proper service layer.

## New capabilities (not in Vidzi)

- `WatchSession` table — persists sessions for any content type, not just Rooms.
- `ViewerEvent` table — granular play/pause/seek events for per-position retention.
- `ContentAnalyticsSnapshot` — materialized stats updated periodically to avoid
  full table scans on every request.
- `compute_retention_curve()` — percentage of viewers still watching at each time bucket.
- `get_viewer_stats()` — total views, unique viewers, avg watch time, completion rate,
  peak concurrent viewers per content item.
- `list_top_content()` — most-viewed content ranked by session count.

## Migration plan for existing Vidzi data

### 1. Backfill WatchSession from RoomParticipant

```sql
INSERT INTO watch_sessions (
  id, user_id, content_id, content_type,
  joined_at, left_at
)
SELECT
  gen_random_uuid()::text,
  user_id,
  room_id,       -- content_id = room_id
  'LIVE',        -- all participants were in live rooms
  joined_at,
  left_at
FROM room_participants
WHERE joined_at IS NOT NULL;
```

### 2. Integrate join/leave events

After backfilling, wire the new service calls alongside (or replacing) the
Vidzi participant tracking:

```python
# On room join — alongside existing RoomParticipant creation:
from analytics_core.services import join_session
join_session(db, user_id=user.id, content_id=room_id, content_type="LIVE")

# On room leave:
from analytics_core.services import leave_session
leave_session(db, user_id=user.id, content_id=room_id)
```

### 3. VOD / class sessions

For pre-recorded content, pass position and duration to enable completion rate:

```python
leave_session(
    db,
    user_id=user.id,
    content_id=class_id,
    last_position_seconds=player_position,
    content_duration_seconds=class.duration_seconds,
)
```

## API contracts (no changes from Vidzi implicit behavior)

The join/leave semantics (open session on join, close on leave, derive duration)
are identical — only the storage moves from `room_participants` to `watch_sessions`.
