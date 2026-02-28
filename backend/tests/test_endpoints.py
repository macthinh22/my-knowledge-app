"""Tests for video CRUD endpoints with mocked services."""

import uuid
from unittest.mock import AsyncMock, patch

import pytest

from app.services.summarizer import KnowledgeResult
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

MOCK_ANALYSIS = KnowledgeResult(
    explanation="Here is a clear explanation of the topic...",
    key_knowledge="- Key insight 1\n- Key insight 2",
    critical_analysis="**Strengths**: Well-argued.\n**Weaknesses**: Lacks examples.",
    real_world_applications="- Application 1\n- Application 2",
    keywords=["test", "python"],
)


def _close_coro(coro):
    coro.close()


# ---------------------------------------------------------------------------
# POST /api/videos
# ---------------------------------------------------------------------------


class TestCreateVideo:
    @pytest.mark.asyncio
    @patch("app.routers.videos.asyncio.create_task")
    @patch("app.routers.videos.youtube_service")
    async def test_create_video_success(
        self, mock_youtube, mock_create_task, client, fake_db
    ):
        mock_create_task.side_effect = _close_coro
        mock_youtube.extract_youtube_id.return_value = MOCK_YOUTUBE_ID

        res = await client.post("/api/videos", json={"youtube_url": MOCK_YOUTUBE_URL})

        assert res.status_code == 202
        data = res.json()
        assert data["status"] == "queued"
        assert data["youtube_id"] == MOCK_YOUTUBE_ID
        assert data["video_id"] is None
        mock_create_task.assert_called_once()

    @pytest.mark.asyncio
    @patch("app.routers.videos.asyncio.create_task")
    @patch("app.routers.videos.youtube_service")
    async def test_create_video_duplicate_returns_completed_job(
        self, mock_youtube, mock_create_task, client, fake_db
    ):
        mock_create_task.side_effect = _close_coro
        vid = make_video()
        fake_db.store[vid.id] = vid
        mock_youtube.extract_youtube_id.return_value = vid.youtube_id

        res = await client.post("/api/videos", json={"youtube_url": MOCK_YOUTUBE_URL})

        assert res.status_code == 202
        data = res.json()
        assert data["status"] == "completed"
        assert data["video_id"] == str(vid.id)
        mock_create_task.assert_not_called()

    @pytest.mark.asyncio
    async def test_create_video_invalid_url(self, client):
        res = await client.post("/api/videos", json={"youtube_url": "not-a-url"})
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


class TestVideoJobs:
    @pytest.mark.asyncio
    @patch("app.routers.videos.asyncio.create_task")
    @patch("app.routers.videos.youtube_service")
    async def test_list_jobs(self, mock_youtube, mock_create_task, client, fake_db):
        mock_create_task.side_effect = _close_coro
        mock_youtube.extract_youtube_id.return_value = MOCK_YOUTUBE_ID
        await client.post("/api/videos", json={"youtube_url": MOCK_YOUTUBE_URL})

        res = await client.get("/api/videos/jobs")
        assert res.status_code == 200
        data = res.json()
        assert len(data) == 1
        assert data[0]["status"] == "queued"
        mock_create_task.assert_called_once()

    @pytest.mark.asyncio
    @patch("app.routers.videos.asyncio.create_task")
    @patch("app.routers.videos.youtube_service")
    async def test_get_job(self, mock_youtube, mock_create_task, client, fake_db):
        mock_create_task.side_effect = _close_coro
        mock_youtube.extract_youtube_id.return_value = MOCK_YOUTUBE_ID
        created = await client.post(
            "/api/videos", json={"youtube_url": MOCK_YOUTUBE_URL}
        )

        job_id = created.json()["id"]
        res = await client.get(f"/api/videos/jobs/{job_id}")
        assert res.status_code == 200
        assert res.json()["id"] == job_id
        mock_create_task.assert_called_once()


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
        assert data["explanation"] is not None
        assert data["critical_analysis"] is not None
        assert data["real_world_applications"] is not None

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
        res = await client.patch(f"/api/videos/{fake_id}", json={"notes": "nope"})
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
