from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class SearchRequest(BaseModel):
    q: str = Field(..., min_length=1, max_length=200)
    content_types: list[str] | None = None
    language_code: str | None = Field(default=None, max_length=10)
    limit: int = Field(default=20, ge=1, le=100)
    offset: int = Field(default=0, ge=0)


class SearchResultItem(BaseModel):
    content_type: str
    content_id: str
    title: str
    body: str | None
    language_code: str
    tags: list[str]
    score: float


class SearchResponse(BaseModel):
    query: str
    total: int
    results: list[SearchResultItem]


class RecommendationFeedbackRequest(BaseModel):
    action: str = Field(default="seen", max_length=40)
    reason: str | None = Field(default=None, max_length=240)
    context: dict[str, Any] = Field(default_factory=dict)


class IndexEntryRequest(BaseModel):
    content_type: str = Field(..., max_length=64)
    content_id: str = Field(..., max_length=128)
    title: str = Field(..., max_length=512)
    body: str | None = Field(default=None, max_length=4096)
    language_code: str = Field(default="en", max_length=10)
    tags: list[str] = Field(default_factory=list)
    score: float = Field(default=0.0)
