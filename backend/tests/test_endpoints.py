"""Tests for video CRUD endpoints with mocked services."""

import uuid
from unittest.mock import AsyncMock, patch

import pytest

from app.services.summarizer import SummaryResult
from app.services.youtube import VideoMetadata
from tests.conftest import make_video


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

MOCK_YOUTUBE_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
MOCK_YOUTUBE_ID = "dQw4w9WgXcQ"

MOCK_METADATA = VideoMetadata(
    title="Test Video",
    thumbnail_url="https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
    channel_name="TestChannel",
    duration=212,
)

MOCK_SUMMARY = SummaryResult(
    overview="A concise overview.",
    detailed_summary="## Section\n- Point",
    key_takeaways="- Takeaway",
    keywords=["test", "python"],
)


# ---------------------------------------------------------------------------
# POST /api/videos
# ---------------------------------------------------------------------------


class TestCreateVideo:

    @pytest.mark.asyncio
    @patch("app.routers.videos.youtube_service")
    @patch("app.routers.videos.summarizer_service")
    async def test_create_video_success(
        self, mock_summarizer, mock_youtube, client, fake_db
    ):
        mock_youtube.extract_youtube_id.return_value = MOCK_YOUTUBE_ID
        mock_youtube.fetch_metadata = AsyncMock(return_value=MOCK_METADATA)
        mock_youtube.fetch_transcript = AsyncMock(
            return_value=("transcript text", "captions")
        )
        mock_summarizer.summarize = AsyncMock(return_value=MOCK_SUMMARY)

        res = await client.post(
            "/api/videos", json={"youtube_url": MOCK_YOUTUBE_URL}
        )

        assert res.status_code == 201
        data = res.json()
        assert data["title"] == "Test Video"
        assert data["youtube_id"] == MOCK_YOUTUBE_ID
        assert data["keywords"] == ["test", "python"]

    @pytest.mark.asyncio
    async def test_create_video_invalid_url(self, client):
        res = await client.post(
            "/api/videos", json={"youtube_url": "not-a-url"}
        )
        assert res.status_code == 422  # Pydantic validation (HttpUrl)


# ---------------------------------------------------------------------------
# GET /api/videos
# ---------------------------------------------------------------------------


class TestListVideos:

    @pytest.mark.asyncio
    async def test_list_empty(self, client, fake_db):
        res = await client.get("/api/videos")
        assert res.status_code == 200
        assert res.json() == []

    @pytest.mark.asyncio
    async def test_list_with_videos(self, client, fake_db):
        vid = make_video()
        fake_db.store[vid.id] = vid

        res = await client.get("/api/videos")
        assert res.status_code == 200
        data = res.json()
        assert len(data) == 1
        assert data[0]["title"] == "Test Video"


# ---------------------------------------------------------------------------
# GET /api/videos/{id}
# ---------------------------------------------------------------------------


class TestGetVideo:

    @pytest.mark.asyncio
    async def test_get_existing_video(self, client, fake_db):
        vid = make_video()
        fake_db.store[vid.id] = vid

        res = await client.get(f"/api/videos/{vid.id}")
        assert res.status_code == 200
        data = res.json()
        assert data["youtube_id"] == "dQw4w9WgXcQ"
        assert data["detailed_summary"] is not None

    @pytest.mark.asyncio
    async def test_get_nonexistent_video(self, client, fake_db):
        fake_id = uuid.uuid4()
        res = await client.get(f"/api/videos/{fake_id}")
        assert res.status_code == 404


# ---------------------------------------------------------------------------
# PATCH /api/videos/{id}
# ---------------------------------------------------------------------------


class TestUpdateVideo:

    @pytest.mark.asyncio
    async def test_update_notes(self, client, fake_db):
        vid = make_video()
        fake_db.store[vid.id] = vid

        res = await client.patch(
            f"/api/videos/{vid.id}",
            json={"notes": "My updated notes"},
        )
        assert res.status_code == 200
        assert res.json()["notes"] == "My updated notes"

    @pytest.mark.asyncio
    async def test_update_nonexistent(self, client, fake_db):
        fake_id = uuid.uuid4()
        res = await client.patch(
            f"/api/videos/{fake_id}", json={"notes": "nope"}
        )
        assert res.status_code == 404


# ---------------------------------------------------------------------------
# DELETE /api/videos/{id}
# ---------------------------------------------------------------------------


class TestDeleteVideo:

    @pytest.mark.asyncio
    async def test_delete_existing(self, client, fake_db):
        vid = make_video()
        fake_db.store[vid.id] = vid

        res = await client.delete(f"/api/videos/{vid.id}")
        assert res.status_code == 204
        assert vid.id not in fake_db.store

    @pytest.mark.asyncio
    async def test_delete_nonexistent(self, client, fake_db):
        fake_id = uuid.uuid4()
        res = await client.delete(f"/api/videos/{fake_id}")
        assert res.status_code == 404


# ---------------------------------------------------------------------------
# GET /api/health
# ---------------------------------------------------------------------------


class TestHealth:

    @pytest.mark.asyncio
    async def test_health(self, client):
        res = await client.get("/api/health")
        assert res.status_code == 200
        assert res.json() == {"status": "ok"}
