# search-core Migration Guide

## Source in Vidzi

| STARRIA file | Vidzi source |
|---|---|
| `services/search.py` | `app/routers/discovery.py` — `GET /discovery/recommendations` and nearby/available-now queries |
| `services/recommendations.py` | `app/routers/discovery.py` — `recommendations()` and `recommendation_feedback()` |
| `services/indexing.py` | New — Vidzi queries live tables directly; STARRIA introduces a separate index |
| `models.py` (`ContentIndex`) | New — Vidzi has no dedicated search index table |
| `models.py` (`RecommendationFeedback`) | Vidzi stores feedback in `UserSettings.metadata_json` (JSON blob, last 50 entries only) |
| `routers/search.py` | `app/routers/discovery.py` |

## Key changes from Vidzi

### 1. Vidzi-specific discovery entities removed

Vidzi's `GET /discovery/recommendations` queries `Organization`, `WorkerProfile`,
and `LearnClass` tables directly and returns Vidzi-specific routes
(`/organization/:id`, `/worker/:id`, `/learn/classes/:id`).

STARRIA queries a generic `ContentIndex` table. Your application is responsible
for populating the index when content is created:

```python
from search_core.services import index_content, IndexEntry

# When a video is published:
index_content(db, IndexEntry(
    content_type="video",
    content_id=video.id,
    title=video.title,
    body=video.description,
    language_code=video.language,
    tags=video.tags,
    score=video.view_count / 1000.0,  # popularity signal
))
```

### 2. Discovery categories removed

Vidzi's `GET /discovery/categories` returns hard-coded Vidzi product categories
(`commerce`, `debate`, `learn`, `work`, `entertainment`). These are app-specific
and have no place in a shared library. Implement them in your application layer.

### 3. Recommendation feedback now stored in a table

```
# Vidzi — stored in UserSettings.metadata_json["recommendation_feedback"]
# Capped at 50 entries, lost on settings reset

# STARRIA — proper table, no cap, queryable
SELECT COUNT(*) FROM recommendation_feedback
WHERE user_id = ? AND action = 'clicked';
```

Backfill if needed:
```python
import json
for settings in db.scalars(select(UserSettings)):
    meta = settings.metadata_json or {}
    for entry in (meta.get("recommendation_feedback") or []):
        db.add(RecommendationFeedback(
            user_id=settings.user_id,
            recommendation_id=entry["recommendation_id"],
            action=entry.get("action", "seen"),
            reason=entry.get("reason"),
            context=entry.get("context", {}),
        ))
db.commit()
```

### 4. `GET /discovery/nearby` and `GET /discovery/available-now` not extracted

These endpoints depend on Vidzi's `Profile`, `WorkerProfile`, `DeskAgent`, and
`UserSettings` (privacy rules) models. They are marketplace-specific and cannot
be generalized without knowing STARRIA's user/profile schema. Implement them
in your application router using the `search_core.services.search()` function
as needed.

### 5. Language-aware search

`ContentIndex.language_code` and `SearchQuery.language_code` preserve the
language-filtering behavior from Vidzi's discovery router. Pass `language_code`
to filter results to a specific language.

## Route mapping

| Vidzi route | STARRIA route |
|---|---|
| `GET /discovery/recommendations` | `GET /search/recommendations` |
| `POST /discovery/recommendations/{id}/feedback` | `POST /search/recommendations/{id}/feedback` |
| `GET /discovery/categories` | Implement in application layer |
| `GET /discovery/nearby` | Implement in application layer |
| `GET /discovery/available-now` | Implement in application layer |
| `GET /discovery/languages` | Implement in application layer |
| `GET /discovery/country-desks` | Vidzi-specific, do not migrate |
| (new) `GET /search/` | Full-text search across ContentIndex |
| (new) `POST /search/index` | Index a content item |
| (new) `DELETE /search/index/{type}/{id}` | Remove from index |
