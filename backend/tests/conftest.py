"""Shared test fixtures."""

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.database import get_db
from app.models import Video


# ---------------------------------------------------------------------------
# Fake video data
# ---------------------------------------------------------------------------

def make_video(**overrides) -> Video:
    """Create a Video ORM instance with sensible defaults."""
    defaults = dict(
        id=overrides.pop("id", uuid.uuid4()),
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
        created_at=datetime(2026, 1, 15, tzinfo=timezone.utc),
        updated_at=datetime(2026, 1, 15, tzinfo=timezone.utc),
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

    async def get(self, model, pk):
        return self.store.get(pk)

    async def execute(self, stmt):
        """Supports basic select() queries by returning all or filtered."""
        result = MagicMock()
        # For list queries, return all videos
        videos = sorted(self.store.values(), key=lambda v: v.created_at, reverse=True)
        result.scalars.return_value.all.return_value = videos
        # For duplicate check (scalar_one_or_none)
        result.scalar_one_or_none.return_value = None
        return result

    def add(self, obj):
        if not hasattr(obj, "id") or obj.id is None:
            obj.id = uuid.uuid4()
        self.store[obj.id] = obj

    async def flush(self):
        pass

    async def refresh(self, obj):
        # Simulate setting server defaults
        now = datetime.now(timezone.utc)
        if not hasattr(obj, "created_at") or obj.created_at is None:
            object.__setattr__(obj, "created_at", now)
        if not hasattr(obj, "updated_at") or obj.updated_at is None:
            object.__setattr__(obj, "updated_at", now)

    async def delete(self, obj):
        self.store.pop(obj.id, None)

    async def commit(self):
        pass

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

    app.dependency_overrides[get_db] = override_get_db
    yield AsyncClient(transport=ASGITransport(app=app), base_url="http://test")
    app.dependency_overrides.clear()
