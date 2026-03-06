import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, HttpUrl


class VideoCreate(BaseModel):
    """Request body for POST /api/videos."""

    youtube_url: HttpUrl


class VideoUpdate(BaseModel):
    """Request body for PATCH /api/videos/{id}."""

    notes: str | None = None
    category: str | None = None


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
    category: str | None = None
    notes: str | None = None
    transcript_source: str | None = None
    created_at: datetime
    updated_at: datetime
    last_viewed_at: datetime | None = None
    view_count: int = 0


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
    category: str | None = None
    transcript_source: str | None = None
    created_at: datetime
    updated_at: datetime
    last_viewed_at: datetime | None = None
    view_count: int = 0


class PaginatedVideosResponse(BaseModel):
    items: list[VideoListResponse]
    total: int
    limit: int
    offset: int


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


class TagSummaryResponse(BaseModel):
    tag: str
    usage_count: int
    last_used_at: datetime | None = None
    aliases: list[str] = Field(default_factory=list)


class TagAliasResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    alias: str
    canonical: str
    created_at: datetime
    updated_at: datetime


class TagAliasCreate(BaseModel):
    alias: str
    canonical: str


class CategoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    slug: str
    name: str
    color: str | None = None
    display_order: int = 0
    created_at: datetime


class CategoryCreate(BaseModel):
    slug: str
    name: str
    color: str | None = None


class CategoryUpdate(BaseModel):
    name: str | None = None
    color: str | None = None
    display_order: int | None = None


class TagRenameRequest(BaseModel):
    from_tag: str
    to_tag: str


class TagMergeRequest(BaseModel):
    source_tags: list[str]
    target_tag: str


class CollectionCreate(BaseModel):
    name: str
    description: str | None = None


class CollectionUpdate(BaseModel):
    name: str | None = None
    description: str | None = None


class CollectionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: str | None
    video_count: int
    created_at: datetime
    updated_at: datetime


class CollectionDetailResponse(CollectionResponse):
    video_ids: list[uuid.UUID]


class AddVideoToCollectionRequest(BaseModel):
    video_id: uuid.UUID


class DashboardStats(BaseModel):
    total_videos: int
    total_collections: int
    never_viewed_count: int
    stale_count: int
    videos_by_category: dict[str, int]
    top_tags: list[TagSummaryResponse]
    recent_additions: int


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    username: str
    created_at: datetime


class UserSettingsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    preferences: dict


class UserSettingsUpdate(BaseModel):
    preferences: dict
