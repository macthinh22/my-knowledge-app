"""Tests for video CRUD endpoints with mocked services."""

import uuid
from datetime import UTC, datetime
from unittest.mock import patch

import pytest

from app.models import Category
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
    category="technology",
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
        assert res.json() == {"items": [], "total": 0, "limit": 50, "offset": 0}

    @pytest.mark.asyncio
    async def test_list_with_videos(self, client, fake_db):
        vid = make_video()
        fake_db.store[vid.id] = vid

        res = await client.get("/api/videos")
        assert res.status_code == 200
        data = res.json()
        assert data["total"] == 1
        assert len(data["items"]) == 1
        assert data["items"][0]["title"] == "Test Video"


class TestListVideosPaginated:
    @pytest.mark.asyncio
    async def test_list_videos_returns_paginated_response(self, client, fake_db):
        for i in range(5):
            video = make_video(
                title=f"Video {i}",
                created_at=datetime(2024, 1, i + 1, tzinfo=UTC),
            )
            fake_db.store[video.id] = video

        resp = await client.get("/api/videos?limit=2&offset=0")

        assert resp.status_code == 200
        body = resp.json()
        assert "items" in body
        assert "total" in body
        assert body["total"] == 5
        assert len(body["items"]) == 2

    @pytest.mark.asyncio
    async def test_list_videos_offset(self, client, fake_db):
        for i in range(5):
            video = make_video(
                title=f"Video {i}",
                created_at=datetime(2024, 1, i + 1, tzinfo=UTC),
            )
            fake_db.store[video.id] = video

        resp = await client.get("/api/videos?limit=2&offset=2")

        assert resp.status_code == 200
        body = resp.json()
        assert len(body["items"]) == 2
        assert body["total"] == 5

    @pytest.mark.asyncio
    async def test_list_videos_default_limit(self, client, fake_db):
        video = make_video()
        fake_db.store[video.id] = video

        resp = await client.get("/api/videos")

        assert resp.status_code == 200
        body = resp.json()
        assert "items" in body
        assert "total" in body


class TestSearchVideos:
    @pytest.mark.asyncio
    async def test_search_by_title(self, client, fake_db):
        v1 = make_video(
            title="Learn Python Basics",
            explanation="Intro course",
            keywords=["basics"],
        )
        v2 = make_video(
            title="Cooking with Gordon",
            explanation="Kitchen tips",
            keywords=["cooking"],
        )
        fake_db.store[v1.id] = v1
        fake_db.store[v2.id] = v2

        resp = await client.get("/api/videos?search=python")

        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] == 1
        assert body["items"][0]["title"] == "Learn Python Basics"

    @pytest.mark.asyncio
    async def test_search_by_explanation(self, client, fake_db):
        v1 = make_video(
            title="Video A",
            explanation="This video covers distributed systems and consensus algorithms",
        )
        v2 = make_video(
            title="Video B",
            explanation="This video covers cooking techniques",
        )
        fake_db.store[v1.id] = v1
        fake_db.store[v2.id] = v2

        resp = await client.get("/api/videos?search=distributed")

        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] == 1
        assert body["items"][0]["title"] == "Video A"

    @pytest.mark.asyncio
    async def test_search_by_keywords(self, client, fake_db):
        v1 = make_video(title="Video A", keywords=["react", "frontend"])
        v2 = make_video(title="Video B", keywords=["python", "backend"])
        fake_db.store[v1.id] = v1
        fake_db.store[v2.id] = v2

        resp = await client.get("/api/videos?search=react")

        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] == 1
        assert body["items"][0]["title"] == "Video A"


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
        assert data["category"] is None

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
    async def test_update_category(self, client, fake_db):
        vid = make_video()
        fake_db.store[vid.id] = vid
        category = Category(
            id=uuid.uuid4(),
            slug="technology",
            name="Technology",
            created_at=datetime(2026, 1, 15, tzinfo=UTC),
        )
        fake_db.category_store[category.id] = category

        res = await client.patch(
            f"/api/videos/{vid.id}",
            json={"category": "technology"},
        )
        assert res.status_code == 200
        assert res.json()["category"] == "technology"

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


class TestTags:
    @pytest.mark.asyncio
    async def test_list_tags_with_metadata(self, client, fake_db):
        fake_db.store[uuid.uuid4()] = make_video(
            keywords=["python", "ai", "AI"],
            updated_at=datetime(2026, 1, 16, tzinfo=UTC),
        )
        fake_db.store[uuid.uuid4()] = make_video(
            keywords=["python", "backend"],
            updated_at=datetime(2026, 1, 20, tzinfo=UTC),
        )

        res = await client.get("/api/tags")
        assert res.status_code == 200
        tags = res.json()
        assert tags[0]["tag"] == "python"
        assert tags[0]["usage_count"] == 2
        assert tags[0]["last_used_at"] is not None

    @pytest.mark.asyncio
    async def test_rename_tag(self, client, fake_db):
        vid = make_video(keywords=["ai", "python"])
        fake_db.store[vid.id] = vid

        res = await client.post(
            "/api/tags/rename",
            json={"from_tag": "ai", "to_tag": "machine learning"},
        )
        assert res.status_code == 200
        assert "machine learning" in fake_db.store[vid.id].keywords
        assert "ai" not in fake_db.store[vid.id].keywords

    @pytest.mark.asyncio
    async def test_merge_and_delete_tags(self, client, fake_db):
        vid = make_video(keywords=["ai", "ml", "python"])
        fake_db.store[vid.id] = vid

        merge_res = await client.post(
            "/api/tags/merge",
            json={"source_tags": ["ai", "ml"], "target_tag": "machine learning"},
        )
        assert merge_res.status_code == 200
        assert fake_db.store[vid.id].keywords.count("machine learning") == 1

        delete_res = await client.delete("/api/tags/machine learning")
        assert delete_res.status_code == 200
        assert "machine learning" not in fake_db.store[vid.id].keywords


class TestListTagsWithSearch:
    @pytest.mark.asyncio
    async def test_search_tags(self, client, fake_db):
        v = make_video(keywords=["python", "programming", "machine-learning"])
        fake_db.store[v.id] = v

        resp = await client.get("/api/tags?search=pro")

        assert resp.status_code == 200
        tags = resp.json()
        tag_names = [tag["tag"] for tag in tags]
        assert "programming" in tag_names
        assert "machine-learning" not in tag_names

    @pytest.mark.asyncio
    async def test_tags_with_limit(self, client, fake_db):
        v = make_video(keywords=["a", "b", "c", "d", "e"])
        fake_db.store[v.id] = v

        resp = await client.get("/api/tags?limit=3")

        assert resp.status_code == 200
        tags = resp.json()
        assert len(tags) <= 3


class TestCategories:
    @pytest.mark.asyncio
    async def test_list_categories(self, client, fake_db):
        category = Category(
            id=uuid.uuid4(),
            slug="technology",
            name="Technology",
            created_at=datetime(2026, 1, 15, tzinfo=UTC),
        )
        fake_db.category_store[category.id] = category

        res = await client.get("/api/categories")
        assert res.status_code == 200
        data = res.json()
        assert len(data) == 1
        assert data[0]["slug"] == "technology"

    @pytest.mark.asyncio
    async def test_create_category(self, client, fake_db):
        res = await client.post(
            "/api/categories",
            json={"slug": "business-finance", "name": "Business & Finance"},
        )
        assert res.status_code == 201
        assert res.json()["slug"] == "business-finance"

    @pytest.mark.asyncio
    async def test_delete_category_clears_video_category(self, client, fake_db):
        category = Category(
            id=uuid.uuid4(),
            slug="custom-learning",
            name="Custom Learning",
            created_at=datetime(2026, 1, 15, tzinfo=UTC),
        )
        fake_db.category_store[category.id] = category
        vid = make_video(category="custom-learning")
        fake_db.store[vid.id] = vid

        res = await client.delete("/api/categories/custom-learning")
        assert res.status_code == 204
        assert fake_db.store[vid.id].category is None

    @pytest.mark.asyncio
    async def test_delete_default_category_blocked(self, client, fake_db):
        category = Category(
            id=uuid.uuid4(),
            slug="technology",
            name="Technology",
            created_at=datetime(2026, 1, 15, tzinfo=UTC),
        )
        fake_db.category_store[category.id] = category

        res = await client.delete("/api/categories/technology")
        assert res.status_code == 400
        assert "default" in res.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_list_categories_ordered_by_display_order(self, client, fake_db):
        first = Category(
            id=uuid.uuid4(),
            slug="a-first",
            name="A First",
            color="blue",
            display_order=0,
            created_at=datetime(2026, 1, 15, tzinfo=UTC),
        )
        middle = Category(
            id=uuid.uuid4(),
            slug="m-middle",
            name="M Middle",
            color="emerald",
            display_order=1,
            created_at=datetime(2026, 1, 15, tzinfo=UTC),
        )
        last = Category(
            id=uuid.uuid4(),
            slug="z-last",
            name="Z Last",
            color="rose",
            display_order=2,
            created_at=datetime(2026, 1, 15, tzinfo=UTC),
        )
        fake_db.category_store[last.id] = last
        fake_db.category_store[first.id] = first
        fake_db.category_store[middle.id] = middle

        resp = await client.get("/api/categories")
        body = resp.json()
        slugs = [c["slug"] for c in body]
        assert slugs == ["a-first", "m-middle", "z-last"]


class TestCategoryUpdate:
    @pytest.mark.asyncio
    async def test_update_category_name(self, client, fake_db):
        cat = Category(
            id=uuid.uuid4(),
            slug="test-cat",
            name="Test",
            color="slate",
            display_order=0,
            created_at=datetime(2026, 1, 15, tzinfo=UTC),
        )
        fake_db.category_store[cat.id] = cat

        resp = await client.patch(
            f"/api/categories/{cat.slug}",
            json={"name": "Updated Name"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["name"] == "Updated Name"
        assert body["slug"] == "test-cat"

    @pytest.mark.asyncio
    async def test_update_category_color(self, client, fake_db):
        cat = Category(
            id=uuid.uuid4(),
            slug="test-cat",
            name="Test",
            color="slate",
            display_order=0,
            created_at=datetime(2026, 1, 15, tzinfo=UTC),
        )
        fake_db.category_store[cat.id] = cat

        resp = await client.patch(
            f"/api/categories/{cat.slug}",
            json={"color": "blue"},
        )
        assert resp.status_code == 200
        assert resp.json()["color"] == "blue"

    @pytest.mark.asyncio
    async def test_update_category_invalid_color(self, client, fake_db):
        cat = Category(
            id=uuid.uuid4(),
            slug="test-cat",
            name="Test",
            color="slate",
            display_order=0,
            created_at=datetime(2026, 1, 15, tzinfo=UTC),
        )
        fake_db.category_store[cat.id] = cat

        resp = await client.patch(
            f"/api/categories/{cat.slug}",
            json={"color": "neon-pink"},
        )
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_update_nonexistent_category(self, client, fake_db):
        resp = await client.patch(
            "/api/categories/does-not-exist",
            json={"name": "New Name"},
        )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_update_empty_name(self, client, fake_db):
        cat = Category(
            id=uuid.uuid4(),
            slug="test-cat",
            name="Test",
            color="slate",
            display_order=0,
            created_at=datetime(2026, 1, 15, tzinfo=UTC),
        )
        fake_db.category_store[cat.id] = cat

        resp = await client.patch(
            f"/api/categories/{cat.slug}",
            json={"name": "  "},
        )
        assert resp.status_code == 400


class TestCollections:
    @pytest.mark.asyncio
    async def test_create_collection(self, client, fake_db):
        resp = await client.post("/api/collections", json={"name": "System Design"})
        assert resp.status_code == 201
        assert resp.json()["name"] == "System Design"

    @pytest.mark.asyncio
    async def test_list_collections(self, client, fake_db):
        await client.post("/api/collections", json={"name": "Collection A"})
        await client.post("/api/collections", json={"name": "Collection B"})
        resp = await client.get("/api/collections")
        assert resp.status_code == 200
        assert len(resp.json()) >= 2

    @pytest.mark.asyncio
    async def test_add_video_to_collection(self, client, fake_db):
        v = make_video()
        fake_db.store[v.id] = v
        col_resp = await client.post("/api/collections", json={"name": "My Collection"})
        col_id = col_resp.json()["id"]

        resp = await client.post(
            f"/api/collections/{col_id}/videos",
            json={"video_id": str(v.id)},
        )
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_remove_video_from_collection(self, client, fake_db):
        v = make_video()
        fake_db.store[v.id] = v
        col_resp = await client.post("/api/collections", json={"name": "My Collection"})
        col_id = col_resp.json()["id"]
        await client.post(
            f"/api/collections/{col_id}/videos",
            json={"video_id": str(v.id)},
        )

        resp = await client.delete(f"/api/collections/{col_id}/videos/{v.id}")
        assert resp.status_code == 204

    @pytest.mark.asyncio
    async def test_delete_collection(self, client, fake_db):
        col_resp = await client.post("/api/collections", json={"name": "To Delete"})
        col_id = col_resp.json()["id"]
        resp = await client.delete(f"/api/collections/{col_id}")
        assert resp.status_code == 204


class TestViewTracking:
    @pytest.mark.asyncio
    async def test_get_video_increments_view_count(self, client, fake_db):
        v = make_video()
        v.view_count = 0
        v.last_viewed_at = None
        fake_db.store[v.id] = v

        await client.get(f"/api/videos/{v.id}")
        assert v.view_count == 1
        assert v.last_viewed_at is not None

        await client.get(f"/api/videos/{v.id}")
        assert v.view_count == 2


class TestReviewStatusFilter:
    @pytest.mark.asyncio
    async def test_filter_never_viewed(self, client, fake_db):
        v1 = make_video(title="Never Viewed", view_count=0)
        v2 = make_video(title="Viewed", view_count=3)
        fake_db.store[v1.id] = v1
        fake_db.store[v2.id] = v2

        resp = await client.get("/api/videos?review_status=never_viewed")
        body = resp.json()
        assert body["total"] == 1
        assert body["items"][0]["title"] == "Never Viewed"


class TestDashboard:
    @pytest.mark.asyncio
    async def test_get_dashboard_stats(self, client, fake_db):
        v1 = make_video(title="Video 1", category="technology", view_count=0)
        v2 = make_video(title="Video 2", category="technology", view_count=3)
        v3 = make_video(title="Video 3", category="science", view_count=0)
        fake_db.store[v1.id] = v1
        fake_db.store[v2.id] = v2
        fake_db.store[v3.id] = v3

        resp = await client.get("/api/stats/dashboard")
        assert resp.status_code == 200
        body = resp.json()
        assert body["total_videos"] == 3
        assert body["never_viewed_count"] == 2
        assert "technology" in body["videos_by_category"]
        assert body["videos_by_category"]["technology"] == 2
        assert len(body["top_tags"]) > 0
