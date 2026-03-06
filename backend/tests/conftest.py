"""Shared test fixtures."""

import uuid
from datetime import UTC, datetime
from unittest.mock import MagicMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Category, Collection, TagAlias, User, Video, VideoJob

TEST_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")

# ---------------------------------------------------------------------------
# Fake video data
# ---------------------------------------------------------------------------


def make_video(**overrides) -> Video:
    """Create a Video ORM instance with sensible defaults."""
    defaults = dict(
        id=overrides.pop("id", uuid.uuid4()),
        user_id=TEST_USER_ID,
        youtube_url="https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        youtube_id="dQw4w9WgXcQ",
        title="Test Video",
        thumbnail_url="https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
        channel_name="TestChannel",
        duration=212,
        explanation="Here is a clear explanation of the topic...",
        key_knowledge="- Key insight 1\n- Key insight 2\n- Core principle",
        critical_analysis="**Strengths**: Well-argued.\n**Weaknesses**: Lacks examples.",
        real_world_applications="- Application 1\n- Application 2",
        keywords=["test", "python"],
        notes=None,
        transcript_source="captions",
        created_at=datetime(2026, 1, 15, tzinfo=UTC),
        updated_at=datetime(2026, 1, 15, tzinfo=UTC),
        view_count=0,
        last_viewed_at=None,
    )
    defaults.update(overrides)
    return Video(**defaults)


# ---------------------------------------------------------------------------
# Mock DB session
# ---------------------------------------------------------------------------


class FakeDB:
    """Lightweight mock replacing AsyncSession for endpoint tests."""

    def __init__(self):
        self.store: dict[uuid.UUID, Video] = {}
        self.job_store: dict[uuid.UUID, VideoJob] = {}
        self.alias_store: dict[uuid.UUID, TagAlias] = {}
        self.category_store: dict[uuid.UUID, Category] = {}
        self.collection_store: dict[uuid.UUID, Collection] = {}
        self.collection_videos: dict[uuid.UUID, list[uuid.UUID]] = {}

    async def get(self, model, pk):
        if model is VideoJob:
            return self.job_store.get(pk)
        if model is TagAlias:
            return self.alias_store.get(pk)
        if model is Category:
            return self.category_store.get(pk)
        if model is Collection:
            return self.collection_store.get(pk)
        return self.store.get(pk)

    async def execute(self, stmt):
        result = MagicMock()
        sql = str(stmt)
        params = stmt.compile().params

        if "FROM video_jobs" in sql:
            jobs = sorted(
                self.job_store.values(),
                key=lambda j: j.created_at,
                reverse=True,
            )

            youtube_id = params.get("youtube_id_1")
            if youtube_id is not None:
                jobs = [j for j in jobs if j.youtube_id == youtube_id]

            status_exact = params.get("status_1")
            if isinstance(status_exact, str):
                jobs = [j for j in jobs if j.status == status_exact]

            status_values = params.get("status_1")
            if isinstance(status_values, (list, tuple)):
                jobs = [j for j in jobs if j.status in set(status_values)]

            video_id = params.get("video_id_1")
            if video_id is not None:
                jobs = [j for j in jobs if j.video_id == video_id]

            result.scalars.return_value.all.return_value = jobs
            result.scalars.return_value.first.return_value = jobs[0] if jobs else None
            result.scalar_one_or_none.return_value = jobs[0] if jobs else None
            return result

        if "FROM tag_aliases" in sql:
            aliases = sorted(self.alias_store.values(), key=lambda a: a.alias)

            alias = params.get("alias_1")
            if isinstance(alias, str):
                aliases = [row for row in aliases if row.alias == alias]

            canonical = params.get("canonical_1")
            if isinstance(canonical, str):
                aliases = [row for row in aliases if row.canonical == canonical]

            alias_values = params.get("alias_1")
            if isinstance(alias_values, (list, tuple)):
                aliases = [row for row in aliases if row.alias in set(alias_values)]

            result.scalars.return_value.all.return_value = aliases
            result.scalars.return_value.first.return_value = (
                aliases[0] if aliases else None
            )
            result.scalar_one_or_none.return_value = aliases[0] if aliases else None
            return result

        if "count(" in sql.lower() and "FROM collections" in sql:
            result.scalar.return_value = len(self.collection_store)
            return result

        if "FROM collections" in sql:
            collections = sorted(self.collection_store.values(), key=lambda c: c.name)
            col_id = params.get("id_1")
            if col_id is not None:
                collections = [c for c in collections if str(c.id) == str(col_id)]
            for c in collections:
                video_ids = self.collection_videos.get(c.id, [])
                c.videos = [self.store[vid] for vid in video_ids if vid in self.store]
            if "count(" in sql.lower():
                count = 0
                if col_id:
                    parsed = (
                        uuid.UUID(str(col_id))
                        if not isinstance(col_id, uuid.UUID)
                        else col_id
                    )
                    count = len(self.collection_videos.get(parsed, []))
                result.scalar.return_value = count
                return result
            result.scalars.return_value.all.return_value = collections
            result.scalars.return_value.first.return_value = (
                collections[0] if collections else None
            )
            result.scalar_one_or_none.return_value = (
                collections[0] if collections else None
            )
            return result

        if "FROM categories" in sql:
            categories = sorted(self.category_store.values(), key=lambda c: c.slug)
            slug = params.get("slug_1")
            if isinstance(slug, str):
                categories = [row for row in categories if row.slug == slug]

            result.scalars.return_value.all.return_value = categories
            result.scalars.return_value.first.return_value = (
                categories[0] if categories else None
            )
            result.scalar_one_or_none.return_value = (
                categories[0] if categories else None
            )
            return result

        videos = list(self.store.values())

        search_pattern = next(
            (
                value
                for key, value in params.items()
                if key
                in {"title_1", "channel_name_1", "explanation_1", "key_knowledge_1"}
                and isinstance(value, str)
            ),
            None,
        )
        if isinstance(search_pattern, str):
            term = search_pattern.replace("%", "").strip().lower()
            if term:
                videos = [
                    video
                    for video in videos
                    if term in (video.title or "").lower()
                    or term in (video.channel_name or "").lower()
                    or term in (video.explanation or "").lower()
                    or term in (video.key_knowledge or "").lower()
                    or term in " ".join(video.keywords or []).lower()
                ]

        category = params.get("category_1")
        if category is not None:
            videos = [v for v in videos if v.category == category]
        elif "videos.category IS NULL" in sql:
            videos = [v for v in videos if v.category is None]

        view_count = params.get("view_count_1")
        if view_count is not None:
            videos = [v for v in videos if (v.view_count or 0) == view_count]

        if "count(" in sql.lower() and (
            "from videos" in sql.lower() or "FROM videos" in sql
        ):
            result.scalar.return_value = len(videos)
            return result

        order_key = "created_at"
        if "videos.title" in sql:
            order_key = "title"
        elif "videos.channel_name" in sql:
            order_key = "channel_name"
        elif "videos.duration" in sql:
            order_key = "duration"

        reverse = " desc" in sql.lower()
        if order_key == "duration":
            videos = sorted(
                videos,
                key=lambda v: (
                    getattr(v, order_key) is None,
                    getattr(v, order_key) or 0,
                ),
                reverse=reverse,
            )
        else:
            videos = sorted(
                videos,
                key=lambda v: (
                    getattr(v, order_key) is None,
                    str(getattr(v, order_key) or ""),
                ),
                reverse=reverse,
            )

        youtube_id = params.get("youtube_id_1")
        if youtube_id is not None:
            videos = [v for v in videos if v.youtube_id == youtube_id]

        limit = params.get("param_1")
        offset = params.get("param_2")
        if isinstance(offset, int):
            videos = videos[offset:]
        if isinstance(limit, int):
            videos = videos[:limit]

        result.scalars.return_value.all.return_value = videos
        result.scalars.return_value.first.return_value = videos[0] if videos else None
        result.scalar_one_or_none.return_value = videos[0] if videos else None
        return result

    def add(self, obj):
        if not hasattr(obj, "id") or obj.id is None:
            obj.id = uuid.uuid4()
        if isinstance(obj, VideoJob):
            self.job_store[obj.id] = obj
            return
        if isinstance(obj, TagAlias):
            self.alias_store[obj.id] = obj
            return
        if isinstance(obj, Category):
            self.category_store[obj.id] = obj
            return
        if isinstance(obj, Collection):
            self.collection_store[obj.id] = obj
            if not hasattr(obj, "videos") or obj.videos is None:
                obj.videos = []
            self.collection_videos.setdefault(obj.id, [])
            return
        self.store[obj.id] = obj

    async def flush(self):
        pass

    async def refresh(self, obj):
        # Simulate setting server defaults
        now = datetime.now(UTC)
        if not hasattr(obj, "created_at") or obj.created_at is None:
            object.__setattr__(obj, "created_at", now)
        if not hasattr(obj, "updated_at") or obj.updated_at is None:
            object.__setattr__(obj, "updated_at", now)

    async def delete(self, obj):
        if isinstance(obj, VideoJob):
            self.job_store.pop(obj.id, None)
            return
        if isinstance(obj, TagAlias):
            self.alias_store.pop(obj.id, None)
            return
        if isinstance(obj, Category):
            self.category_store.pop(obj.id, None)
            return
        if isinstance(obj, Collection):
            self.collection_store.pop(obj.id, None)
            self.collection_videos.pop(obj.id, None)
            return
        self.store.pop(obj.id, None)

    async def commit(self):
        for col in self.collection_store.values():
            if hasattr(col, "videos") and isinstance(col.videos, list):
                self.collection_videos[col.id] = [v.id for v in col.videos]

    async def rollback(self):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        pass


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def fake_db():
    return FakeDB()


@pytest.fixture
def client(fake_db):
    """Async test client with the DB dependency overridden."""
    from app.main import app

    async def override_get_db():
        yield fake_db

    async def override_get_current_user():
        return User(
            id=TEST_USER_ID,
            username="test-user",
            password_hash="hashed",
            created_at=datetime(2026, 1, 15, tzinfo=UTC),
        )

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    yield AsyncClient(transport=ASGITransport(app=app), base_url="http://test")
    app.dependency_overrides.clear()
