import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, HttpUrl


class VideoCreate(BaseModel):
    """Request body for POST /api/videos."""

    youtube_url: HttpUrl


class VideoUpdate(BaseModel):
    """Request body for PATCH /api/videos/{id}."""

    notes: str | None = None


class VideoResponse(BaseModel):
    """Full video response with all fields."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    youtube_url: str
    youtube_id: str
    title: str | None = None
    thumbnail_url: str | None = None
    channel_name: str | None = None
    duration: int | None = None
    explanation: str | None = None
    key_knowledge: str | None = None
    critical_analysis: str | None = None
    real_world_applications: str | None = None
    keywords: list[str] | None = None
    notes: str | None = None
    transcript_source: str | None = None
    created_at: datetime
    updated_at: datetime


class VideoListResponse(BaseModel):
    """Summary response for list view (excludes heavy text fields)."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    youtube_url: str
    youtube_id: str
    title: str | None = None
    thumbnail_url: str | None = None
    channel_name: str | None = None
    duration: int | None = None
    explanation: str | None = None
    key_knowledge: str | None = None
    keywords: list[str] | None = None
    transcript_source: str | None = None
    created_at: datetime
    updated_at: datetime


class VideoJobResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    youtube_url: str
    youtube_id: str
    status: str
    current_step: int
    total_steps: int
    step_label: str
    error_message: str | None = None
    video_id: uuid.UUID | None = None
    created_at: datetime
    updated_at: datetime
