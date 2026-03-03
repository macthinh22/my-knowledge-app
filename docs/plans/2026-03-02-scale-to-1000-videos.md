# Scale App to 500-1000 Videos — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the app performant, searchable, and organizable at 500-1000 videos so users can find, manage, and retain knowledge effectively.

**Architecture:** Server-side pagination + search replaces the current "fetch everything" approach. PostgreSQL full-text search and GIN indexes handle content search. Frontend uses infinite scroll with virtual rendering. Collections provide hierarchical organization beyond flat tags.

**Tech Stack:** PostgreSQL (GIN indexes, tsvector), SQLAlchemy async, FastAPI query params, react-window (virtual scroll), Next.js

**Excluded from scope:** Database indexing improvements (GIN on keywords, tsvector), daily email randomness fix. These are important but not part of this plan.

---

## Phase 1: Server-Side Pagination & Search

### Task 1: Add pagination to GET /api/videos

The current endpoint loads all videos. Add `limit`, `offset`, `sort_by`, `sort_order` query params and return total count in a wrapper response.

**Files:**
- Modify: `backend/app/schemas.py`
- Modify: `backend/app/routers/videos.py`
- Test: `backend/tests/test_endpoints.py`

**Step 1: Write the failing test**

In `backend/tests/test_endpoints.py`, add to `TestListVideos`:

```python
class TestListVideosPaginated:
    """Tests for paginated video listing."""

    @patch("app.routers.videos.get_db")
    async def test_list_videos_returns_paginated_response(self, mock_get_db, client, fake_db):
        mock_get_db.return_value = fake_db
        for i in range(5):
            v = make_video()
            v.title = f"Video {i}"
            fake_db.store[v.id] = v

        resp = client.get("/api/videos?limit=2&offset=0")
        assert resp.status_code == 200
        body = resp.json()
        assert "items" in body
        assert "total" in body
        assert body["total"] == 5
        assert len(body["items"]) == 2

    @patch("app.routers.videos.get_db")
    async def test_list_videos_offset(self, mock_get_db, client, fake_db):
        mock_get_db.return_value = fake_db
        for i in range(5):
            v = make_video()
            v.title = f"Video {i}"
            v.created_at = datetime(2024, 1, i + 1)
            fake_db.store[v.id] = v

        resp = client.get("/api/videos?limit=2&offset=2")
        body = resp.json()
        assert len(body["items"]) == 2
        assert body["total"] == 5

    @patch("app.routers.videos.get_db")
    async def test_list_videos_default_limit(self, mock_get_db, client, fake_db):
        """Without params, defaults to limit=50 offset=0."""
        mock_get_db.return_value = fake_db
        v = make_video()
        fake_db.store[v.id] = v

        resp = client.get("/api/videos")
        body = resp.json()
        assert "items" in body
        assert "total" in body
```

**Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_endpoints.py::TestListVideosPaginated -v`
Expected: FAIL — class doesn't exist yet or response shape mismatch

**Step 3: Add PaginatedVideosResponse schema**

In `backend/app/schemas.py`, add:

```python
class PaginatedVideosResponse(BaseModel):
    items: list[VideoListResponse]
    total: int
    limit: int
    offset: int
```

**Step 4: Update the list_videos endpoint**

In `backend/app/routers/videos.py`, replace the current `list_videos`:

```python
from sqlalchemy import func

@router.get("", response_model=PaginatedVideosResponse)
async def list_videos(
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    sort_by: str = Query(default="created_at"),
    sort_order: str = Query(default="desc"),
    db: AsyncSession = Depends(get_db),
):
    allowed_sort = {"created_at", "title", "channel_name", "duration"}
    col = getattr(Video, sort_by if sort_by in allowed_sort else "created_at")
    order = col.desc() if sort_order == "desc" else col.asc()

    total_result = await db.execute(select(func.count(Video.id)))
    total = total_result.scalar()

    result = await db.execute(
        select(Video).order_by(order).limit(limit).offset(offset)
    )
    return PaginatedVideosResponse(
        items=result.scalars().all(),
        total=total,
        limit=limit,
        offset=offset,
    )
```

**Step 5: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_endpoints.py::TestListVideosPaginated -v`
Expected: PASS

**Step 6: Run full test suite to check for regressions**

Run: `cd backend && python -m pytest tests/ -v`
Expected: Some existing tests in `TestListVideos` may break because response shape changed from `list` to `{items, total, ...}`. Fix those tests to expect the new shape.

**Step 7: Commit**

```bash
git add backend/app/schemas.py backend/app/routers/videos.py backend/tests/test_endpoints.py
git commit -m "feat: add server-side pagination to GET /api/videos"
```

---

### Task 2: Add server-side search to GET /api/videos

Add `search` query param that filters by title, channel_name, keywords, explanation, and key_knowledge on the server.

**Files:**
- Modify: `backend/app/routers/videos.py`
- Test: `backend/tests/test_endpoints.py`

**Step 1: Write the failing test**

```python
class TestSearchVideos:
    @patch("app.routers.videos.get_db")
    async def test_search_by_title(self, mock_get_db, client, fake_db):
        mock_get_db.return_value = fake_db
        v1 = make_video()
        v1.title = "Learn Python Basics"
        v2 = make_video()
        v2.title = "Cooking with Gordon"
        fake_db.store[v1.id] = v1
        fake_db.store[v2.id] = v2

        resp = client.get("/api/videos?search=python")
        body = resp.json()
        assert body["total"] == 1
        assert body["items"][0]["title"] == "Learn Python Basics"

    @patch("app.routers.videos.get_db")
    async def test_search_by_explanation(self, mock_get_db, client, fake_db):
        mock_get_db.return_value = fake_db
        v1 = make_video()
        v1.title = "Video A"
        v1.explanation = "This video covers distributed systems and consensus algorithms"
        v2 = make_video()
        v2.title = "Video B"
        v2.explanation = "This video covers cooking techniques"
        fake_db.store[v1.id] = v1
        fake_db.store[v2.id] = v2

        resp = client.get("/api/videos?search=distributed")
        body = resp.json()
        assert body["total"] == 1
        assert body["items"][0]["title"] == "Video A"

    @patch("app.routers.videos.get_db")
    async def test_search_by_keywords(self, mock_get_db, client, fake_db):
        mock_get_db.return_value = fake_db
        v1 = make_video()
        v1.title = "Video A"
        v1.keywords = ["react", "frontend"]
        v2 = make_video()
        v2.title = "Video B"
        v2.keywords = ["python", "backend"]
        fake_db.store[v1.id] = v1
        fake_db.store[v2.id] = v2

        resp = client.get("/api/videos?search=react")
        body = resp.json()
        assert body["total"] == 1
```

**Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_endpoints.py::TestSearchVideos -v`
Expected: FAIL — search param ignored

**Step 3: Add search filtering to the endpoint**

In `backend/app/routers/videos.py`, update `list_videos`:

```python
from sqlalchemy import func, or_, any_

@router.get("", response_model=PaginatedVideosResponse)
async def list_videos(
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    sort_by: str = Query(default="created_at"),
    sort_order: str = Query(default="desc"),
    search: str | None = Query(default=None),
    tag: str | None = Query(default=None),
    tag_mode: str = Query(default="any"),
    category: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    allowed_sort = {"created_at", "title", "channel_name", "duration"}
    col = getattr(Video, sort_by if sort_by in allowed_sort else "created_at")
    order = col.desc() if sort_order == "desc" else col.asc()

    query = select(Video)

    if search:
        term = f"%{search.lower()}%"
        query = query.where(
            or_(
                func.lower(Video.title).contains(search.lower()),
                func.lower(Video.channel_name).contains(search.lower()),
                func.lower(Video.explanation).contains(search.lower()),
                func.lower(Video.key_knowledge).contains(search.lower()),
                Video.keywords.any(search.lower()),
            )
        )

    if tag:
        tags = [t.strip() for t in tag.split(",")]
        if tag_mode == "all":
            query = query.where(Video.keywords.contains(tags))
        else:
            query = query.where(Video.keywords.overlap(tags))

    if category:
        query = query.where(Video.category == category)

    total_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_result.scalar()

    result = await db.execute(query.order_by(order).limit(limit).offset(offset))
    return PaginatedVideosResponse(
        items=result.scalars().all(),
        total=total,
        limit=limit,
        offset=offset,
    )
```

**Step 4: Run tests**

Run: `cd backend && python -m pytest tests/test_endpoints.py::TestSearchVideos -v`
Expected: PASS

**Step 5: Run full suite**

Run: `cd backend && python -m pytest tests/ -v`
Expected: PASS

**Step 6: Commit**

```bash
git add backend/app/routers/videos.py backend/tests/test_endpoints.py
git commit -m "feat: add server-side search with content filtering"
```

---

### Task 3: Add server-side tag aggregation endpoint

Move tag statistics computation from client to server. Add search param for tag autocomplete.

**Files:**
- Modify: `backend/app/routers/tags.py`
- Modify: `backend/app/services/tags.py`
- Test: `backend/tests/test_endpoints.py`

**Step 1: Write failing test**

```python
class TestListTagsWithSearch:
    @patch("app.routers.tags.get_db")
    async def test_search_tags(self, mock_get_db, client, fake_db):
        mock_get_db.return_value = fake_db
        v = make_video()
        v.keywords = ["python", "programming", "machine-learning"]
        fake_db.store[v.id] = v

        resp = client.get("/api/tags?search=pro")
        assert resp.status_code == 200
        tags = resp.json()
        tag_names = [t["tag"] for t in tags]
        assert "programming" in tag_names
        assert "machine-learning" not in tag_names

    @patch("app.routers.tags.get_db")
    async def test_tags_with_limit(self, mock_get_db, client, fake_db):
        mock_get_db.return_value = fake_db
        v = make_video()
        v.keywords = ["a", "b", "c", "d", "e"]
        fake_db.store[v.id] = v

        resp = client.get("/api/tags?limit=3")
        tags = resp.json()
        assert len(tags) <= 3
```

**Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_endpoints.py::TestListTagsWithSearch -v`

**Step 3: Update the tags endpoint**

In `backend/app/routers/tags.py`, update `list_tags`:

```python
@router.get("", response_model=list[TagSummaryResponse])
async def list_tags(
    search: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Video))
    videos = result.scalars().all()
    alias_result = await db.execute(select(TagAlias))
    aliases = alias_result.scalars().all()
    alias_map = {}
    for a in aliases:
        alias_map.setdefault(a.canonical, []).append(a.alias)

    stats = collect_tag_stats(videos)

    if search:
        term = search.lower()
        stats = [s for s in stats if term in s["tag"]]

    stats = stats[:limit]

    return [
        TagSummaryResponse(
            tag=s["tag"],
            usage_count=s["usage_count"],
            last_used_at=s["last_used_at"],
            aliases=alias_map.get(s["tag"], []),
        )
        for s in stats
    ]
```

**Step 4: Run tests**

Run: `cd backend && python -m pytest tests/test_endpoints.py::TestListTagsWithSearch -v`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/app/routers/tags.py backend/tests/test_endpoints.py
git commit -m "feat: add search and limit params to tags endpoint"
```

---

## Phase 2: Frontend Pagination & Infinite Scroll

### Task 4: Update API client for paginated responses

**Files:**
- Modify: `frontend/src/lib/api.ts`

**Step 1: Add paginated types and update listVideos**

In `frontend/src/lib/api.ts`:

```typescript
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface VideoListParams {
  limit?: number;
  offset?: number;
  search?: string;
  sort_by?: string;
  sort_order?: "asc" | "desc";
  tag?: string;
  tag_mode?: "all" | "any";
  category?: string;
}

export async function listVideos(
  params: VideoListParams = {},
): Promise<PaginatedResponse<VideoListItem>> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  }
  const qs = query.toString();
  return request<PaginatedResponse<VideoListItem>>(
    `${API}/videos${qs ? `?${qs}` : ""}`,
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/lib/api.ts
git commit -m "feat: update API client for paginated video responses"
```

---

### Task 5: Implement infinite scroll on library page

Replace the "render everything" approach with paginated fetching and append-on-scroll.

**Files:**
- Modify: `frontend/src/app/page.tsx`
- Create: `frontend/src/hooks/usePaginatedVideos.ts`

**Step 1: Create the pagination hook**

```typescript
// frontend/src/hooks/usePaginatedVideos.ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  listVideos,
  type PaginatedResponse,
  type VideoListItem,
  type VideoListParams,
} from "@/lib/api";

const PAGE_SIZE = 50;

interface UsePaginatedVideosResult {
  videos: VideoListItem[];
  total: number;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
  refresh: () => void;
}

export function usePaginatedVideos(
  filters: Omit<VideoListParams, "limit" | "offset">,
): UsePaginatedVideosResult {
  const [videos, setVideos] = useState<VideoListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const offsetRef = useRef(0);

  const filtersKey = JSON.stringify(filters);

  const fetchPage = useCallback(
    async (offset: number, append: boolean) => {
      try {
        if (append) setLoadingMore(true);
        else setLoading(true);

        const data = await listVideos({
          ...filters,
          limit: PAGE_SIZE,
          offset,
        });

        setVideos((prev) => (append ? [...prev, ...data.items] : data.items));
        setTotal(data.total);
        offsetRef.current = offset + data.items.length;
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load videos");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtersKey],
  );

  useEffect(() => {
    offsetRef.current = 0;
    fetchPage(0, false);
  }, [fetchPage]);

  const loadMore = useCallback(() => {
    if (!loadingMore && offsetRef.current < total) {
      fetchPage(offsetRef.current, true);
    }
  }, [loadingMore, total, fetchPage]);

  const refresh = useCallback(() => {
    offsetRef.current = 0;
    fetchPage(0, false);
  }, [fetchPage]);

  return {
    videos,
    total,
    loading,
    loadingMore,
    error,
    hasMore: offsetRef.current < total,
    loadMore,
    refresh,
  };
}
```

**Step 2: Create an intersection observer trigger component**

Add to the bottom of the video grid in `page.tsx`:

```typescript
// Inside page.tsx, add a sentinel div at the end of the grid
function LoadMoreTrigger({ onVisible, hasMore, loadingMore }: {
  onVisible: () => void;
  hasMore: boolean;
  loadingMore: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasMore || !ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) onVisible(); },
      { rootMargin: "200px" },
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [onVisible, hasMore]);

  return (
    <div ref={ref} className="flex justify-center py-8">
      {loadingMore && <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />}
    </div>
  );
}
```

**Step 3: Refactor page.tsx to use the hook**

Replace the current `listVideos()` call and client-side filtering with `usePaginatedVideos`:

- Remove: `const [videos, setVideos] = useState<VideoListItem[]>([])`
- Remove: the `allKeywords` useMemo that iterates all videos
- Remove: the `filtered` useMemo with client-side search/tag/category filtering
- Replace with:

```typescript
const {
  videos: filtered,
  total,
  loading,
  loadingMore,
  hasMore,
  loadMore,
  refresh: refreshVideos,
} = usePaginatedVideos({
  search: search || undefined,
  tag: selectedKeywords.length ? selectedKeywords.join(",") : undefined,
  tag_mode: keywordFilterMode,
  category: selectedCategory || undefined,
  sort_by: "created_at",
  sort_order: "desc",
});
```

For tag stats, call the updated server-side `/api/tags` endpoint instead of computing client-side.

**Step 4: Add the LoadMoreTrigger after the video grid**

```tsx
{/* After the grid/list of videos */}
<LoadMoreTrigger
  onVisible={loadMore}
  hasMore={hasMore}
  loadingMore={loadingMore}
/>
```

**Step 5: Verify manually**

- Library page loads with first 50 videos
- Scrolling to bottom loads more
- Search debounce triggers server request
- Tag/category filters trigger server request

**Step 6: Commit**

```bash
git add frontend/src/hooks/usePaginatedVideos.ts frontend/src/app/page.tsx
git commit -m "feat: replace client-side filtering with paginated server queries"
```

---

### Task 6: Move tag stats to server-side

The `allKeywords` computed in page.tsx currently iterates all videos client-side. Replace with a server call.

**Files:**
- Modify: `frontend/src/app/page.tsx`
- Modify: `frontend/src/lib/api.ts`

**Step 1: Add listTags params to API client**

In `frontend/src/lib/api.ts`, update `listTags`:

```typescript
export async function listTags(params?: {
  search?: string;
  limit?: number;
}): Promise<TagSummary[]> {
  const query = new URLSearchParams();
  if (params?.search) query.set("search", params.search);
  if (params?.limit) query.set("limit", String(params.limit));
  const qs = query.toString();
  return request<TagSummary[]>(`${API}/tags${qs ? `?${qs}` : ""}`);
}
```

**Step 2: In page.tsx, replace the allKeywords useMemo**

```typescript
const [allKeywords, setAllKeywords] = useState<TagSummary[]>([]);

useEffect(() => {
  listTags({ limit: 200 }).then(setAllKeywords).catch(console.error);
}, []);

const refreshTags = useCallback(() => {
  listTags({ limit: 200 }).then(setAllKeywords).catch(console.error);
}, []);
```

Call `refreshTags()` after tag mutations instead of refetching all videos.

**Step 3: Commit**

```bash
git add frontend/src/app/page.tsx frontend/src/lib/api.ts
git commit -m "feat: fetch tag stats from server instead of computing client-side"
```

---

## Phase 3: Sort & View Improvements

### Task 7: Add sort controls to the toolbar

Users need to sort by title, date, duration, channel — not just newest-first.

**Files:**
- Modify: `frontend/src/components/Toolbar.tsx`
- Modify: `frontend/src/app/page.tsx`

**Step 1: Add sort state to page.tsx**

```typescript
const [sortBy, setSortBy] = useState<string>("created_at");
const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
```

Pass these to `usePaginatedVideos` and to `Toolbar`.

**Step 2: Add sort dropdown to Toolbar**

Add a `<Select>` component in the toolbar with options:
- Newest first (created_at desc) — default
- Oldest first (created_at asc)
- Title A-Z (title asc)
- Title Z-A (title desc)
- Duration: longest (duration desc)
- Duration: shortest (duration asc)
- Channel A-Z (channel_name asc)

**Step 3: Commit**

```bash
git add frontend/src/components/Toolbar.tsx frontend/src/app/page.tsx
git commit -m "feat: add sort controls to library toolbar"
```

---

### Task 8: Show total count and current position

Display "Showing X of Y videos" so users know where they are in a large collection.

**Files:**
- Modify: `frontend/src/app/page.tsx`

**Step 1: Add count display**

Below the toolbar, before the grid:

```tsx
<div className="text-sm text-muted-foreground px-1">
  {total > 0
    ? `Showing ${filtered.length} of ${total} videos`
    : "No videos found"}
</div>
```

**Step 2: Commit**

```bash
git add frontend/src/app/page.tsx
git commit -m "feat: show video count indicator"
```

---

## Phase 4: Collections for Hierarchical Organization

### Task 9: Create collections database model and migration

Collections let users group videos into named folders (e.g., "System Design Series", "Python Masterclass"). A video can belong to multiple collections.

**Files:**
- Create: `backend/alembic/versions/g6h7i8j9k0l1_add_collections.py`
- Modify: `backend/app/models.py`

**Step 1: Add Collection model and association table**

In `backend/app/models.py`:

```python
collection_videos = Table(
    "collection_videos",
    Base.metadata,
    Column("collection_id", UUID, ForeignKey("collections.id", ondelete="CASCADE"), primary_key=True),
    Column("video_id", UUID, ForeignKey("videos.id", ondelete="CASCADE"), primary_key=True),
)


class Collection(Base):
    __tablename__ = "collections"

    id: Mapped[uuid.UUID] = mapped_column(UUID, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(server_default=text("now()"), onupdate=datetime.now)

    videos: Mapped[list["Video"]] = relationship(secondary=collection_videos, backref="collections")
```

**Step 2: Create alembic migration**

Run: `cd backend && alembic revision --autogenerate -m "add collections"`

Verify the generated migration creates both the `collections` table and `collection_videos` junction table.

**Step 3: Run migration**

Run: `cd backend && alembic upgrade head`

**Step 4: Commit**

```bash
git add backend/app/models.py backend/alembic/versions/
git commit -m "feat: add collections model with many-to-many video relationship"
```

---

### Task 10: Add collections API endpoints

CRUD for collections + add/remove videos.

**Files:**
- Create: `backend/app/routers/collections.py`
- Modify: `backend/app/schemas.py`
- Modify: `backend/app/main.py` (register router)
- Test: `backend/tests/test_endpoints.py`

**Step 1: Add schemas**

In `backend/app/schemas.py`:

```python
class CollectionCreate(BaseModel):
    name: str
    description: str | None = None

class CollectionUpdate(BaseModel):
    name: str | None = None
    description: str | None = None

class CollectionResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    video_count: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class CollectionDetailResponse(CollectionResponse):
    video_ids: list[uuid.UUID]
```

**Step 2: Write failing tests**

```python
class TestCollections:
    @patch("app.routers.collections.get_db")
    async def test_create_collection(self, mock_get_db, client, fake_db):
        mock_get_db.return_value = fake_db
        resp = client.post("/api/collections", json={"name": "System Design"})
        assert resp.status_code == 201
        assert resp.json()["name"] == "System Design"

    @patch("app.routers.collections.get_db")
    async def test_list_collections(self, mock_get_db, client, fake_db):
        mock_get_db.return_value = fake_db
        client.post("/api/collections", json={"name": "Collection A"})
        client.post("/api/collections", json={"name": "Collection B"})
        resp = client.get("/api/collections")
        assert resp.status_code == 200
        assert len(resp.json()) >= 2

    @patch("app.routers.collections.get_db")
    async def test_add_video_to_collection(self, mock_get_db, client, fake_db):
        mock_get_db.return_value = fake_db
        v = make_video()
        fake_db.store[v.id] = v
        col_resp = client.post("/api/collections", json={"name": "My Collection"})
        col_id = col_resp.json()["id"]

        resp = client.post(f"/api/collections/{col_id}/videos", json={"video_id": str(v.id)})
        assert resp.status_code == 200

    @patch("app.routers.collections.get_db")
    async def test_remove_video_from_collection(self, mock_get_db, client, fake_db):
        mock_get_db.return_value = fake_db
        v = make_video()
        fake_db.store[v.id] = v
        col_resp = client.post("/api/collections", json={"name": "My Collection"})
        col_id = col_resp.json()["id"]
        client.post(f"/api/collections/{col_id}/videos", json={"video_id": str(v.id)})

        resp = client.delete(f"/api/collections/{col_id}/videos/{v.id}")
        assert resp.status_code == 204
```

**Step 3: Implement the router**

```python
# backend/app/routers/collections.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import Collection, Video, collection_videos
from app.schemas import (
    CollectionCreate,
    CollectionUpdate,
    CollectionResponse,
    CollectionDetailResponse,
)

router = APIRouter(prefix="/api/collections", tags=["collections"])


@router.post("", response_model=CollectionResponse, status_code=status.HTTP_201_CREATED)
async def create_collection(body: CollectionCreate, db: AsyncSession = Depends(get_db)):
    collection = Collection(name=body.name, description=body.description)
    db.add(collection)
    await db.commit()
    await db.refresh(collection)
    return CollectionResponse(
        id=collection.id,
        name=collection.name,
        description=collection.description,
        video_count=0,
        created_at=collection.created_at,
        updated_at=collection.updated_at,
    )


@router.get("", response_model=list[CollectionResponse])
async def list_collections(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Collection).options(selectinload(Collection.videos)).order_by(Collection.name)
    )
    collections = result.scalars().all()
    return [
        CollectionResponse(
            id=c.id,
            name=c.name,
            description=c.description,
            video_count=len(c.videos),
            created_at=c.created_at,
            updated_at=c.updated_at,
        )
        for c in collections
    ]


@router.get("/{collection_id}", response_model=CollectionDetailResponse)
async def get_collection(collection_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Collection).options(selectinload(Collection.videos)).where(Collection.id == collection_id)
    )
    collection = result.scalar_one_or_none()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    return CollectionDetailResponse(
        id=collection.id,
        name=collection.name,
        description=collection.description,
        video_count=len(collection.videos),
        video_ids=[v.id for v in collection.videos],
        created_at=collection.created_at,
        updated_at=collection.updated_at,
    )


@router.patch("/{collection_id}", response_model=CollectionResponse)
async def update_collection(collection_id: str, body: CollectionUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Collection).where(Collection.id == collection_id))
    collection = result.scalar_one_or_none()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    if body.name is not None:
        collection.name = body.name
    if body.description is not None:
        collection.description = body.description
    await db.commit()
    await db.refresh(collection)
    video_count_result = await db.execute(
        select(func.count()).select_from(collection_videos).where(collection_videos.c.collection_id == collection.id)
    )
    return CollectionResponse(
        id=collection.id,
        name=collection.name,
        description=collection.description,
        video_count=video_count_result.scalar(),
        created_at=collection.created_at,
        updated_at=collection.updated_at,
    )


@router.delete("/{collection_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_collection(collection_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Collection).where(Collection.id == collection_id))
    collection = result.scalar_one_or_none()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    await db.delete(collection)
    await db.commit()


@router.post("/{collection_id}/videos", status_code=status.HTTP_200_OK)
async def add_video_to_collection(collection_id: str, body: dict, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Collection).options(selectinload(Collection.videos)).where(Collection.id == collection_id)
    )
    collection = result.scalar_one_or_none()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")

    video_result = await db.execute(select(Video).where(Video.id == body["video_id"]))
    video = video_result.scalar_one_or_none()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    if video not in collection.videos:
        collection.videos.append(video)
        await db.commit()
    return {"ok": True}


@router.delete("/{collection_id}/videos/{video_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_video_from_collection(collection_id: str, video_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Collection).options(selectinload(Collection.videos)).where(Collection.id == collection_id)
    )
    collection = result.scalar_one_or_none()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")

    video_result = await db.execute(select(Video).where(Video.id == video_id))
    video = video_result.scalar_one_or_none()
    if video and video in collection.videos:
        collection.videos.remove(video)
        await db.commit()
```

**Step 4: Register router in main.py**

```python
from app.routers import collections
app.include_router(collections.router)
```

**Step 5: Run tests**

Run: `cd backend && python -m pytest tests/test_endpoints.py::TestCollections -v`

**Step 6: Commit**

```bash
git add backend/app/routers/collections.py backend/app/schemas.py backend/app/main.py backend/tests/test_endpoints.py
git commit -m "feat: add collections CRUD with add/remove video endpoints"
```

---

### Task 11: Add collections filter to GET /api/videos

Allow filtering videos by collection.

**Files:**
- Modify: `backend/app/routers/videos.py`
- Test: `backend/tests/test_endpoints.py`

**Step 1: Write failing test**

```python
class TestFilterByCollection:
    @patch("app.routers.videos.get_db")
    async def test_filter_by_collection(self, mock_get_db, client, fake_db):
        mock_get_db.return_value = fake_db
        # setup: collection with 1 of 2 videos
        # GET /api/videos?collection_id=<id> returns only that video
        pass  # Implement with actual fake_db setup
```

**Step 2: Add collection_id filter to list_videos**

In the `list_videos` endpoint, add:

```python
collection_id: str | None = Query(default=None),
```

And in the query builder:

```python
if collection_id:
    query = query.join(collection_videos).where(
        collection_videos.c.collection_id == collection_id
    )
```

**Step 3: Run tests, commit**

```bash
git add backend/app/routers/videos.py backend/tests/test_endpoints.py
git commit -m "feat: add collection filter to video listing"
```

---

### Task 12: Build collections UI — sidebar + management

**Files:**
- Create: `frontend/src/components/CollectionsSidebar.tsx`
- Create: `frontend/src/components/CollectionManager.tsx`
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/app/page.tsx`

**Step 1: Add collection API methods**

In `frontend/src/lib/api.ts`:

```typescript
export interface Collection {
  id: string;
  name: string;
  description: string | null;
  video_count: number;
  created_at: string;
  updated_at: string;
}

export async function listCollections(): Promise<Collection[]> {
  return request<Collection[]>(`${API}/collections`);
}

export async function createCollection(name: string, description?: string): Promise<Collection> {
  return request<Collection>(`${API}/collections`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, description }),
  });
}

export async function deleteCollection(id: string): Promise<void> {
  await request<void>(`${API}/collections/${id}`, { method: "DELETE" });
}

export async function addVideoToCollection(collectionId: string, videoId: string): Promise<void> {
  await request<void>(`${API}/collections/${collectionId}/videos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ video_id: videoId }),
  });
}

export async function removeVideoFromCollection(collectionId: string, videoId: string): Promise<void> {
  await request<void>(`${API}/collections/${collectionId}/videos/${videoId}`, {
    method: "DELETE",
  });
}
```

**Step 2: Build CollectionsSidebar**

A sidebar (or collapsible panel) showing:
- "All Videos" (default, no filter)
- List of collections with video count badges
- "+ New Collection" button
- Click a collection → sets `collection_id` filter on the paginated query

**Step 3: Build CollectionManager**

Dialog/modal for:
- Creating new collections
- Renaming collections
- Deleting collections (with confirmation)

**Step 4: Add "Add to Collection" action on video cards**

On the detail page or via a context menu on cards, allow adding a video to a collection.

**Step 5: Wire into page.tsx**

```typescript
const [selectedCollection, setSelectedCollection] = useState<string | null>(null);

// Pass to usePaginatedVideos
const { videos, ... } = usePaginatedVideos({
  ...otherFilters,
  collection_id: selectedCollection || undefined,
});
```

**Step 6: Commit**

```bash
git add frontend/src/components/CollectionsSidebar.tsx frontend/src/components/CollectionManager.tsx frontend/src/lib/api.ts frontend/src/app/page.tsx
git commit -m "feat: add collections UI with sidebar, management, and filtering"
```

---

## Phase 5: Knowledge Connections & Discovery

### Task 13: Add "related videos" to the detail page

When viewing a video, show other videos that share the most keywords. Computed server-side.

**Files:**
- Modify: `backend/app/routers/videos.py`
- Test: `backend/tests/test_endpoints.py`
- Modify: `frontend/src/app/video/[id]/page.tsx`

**Step 1: Add endpoint**

```python
@router.get("/{video_id}/related", response_model=list[VideoListResponse])
async def get_related_videos(
    video_id: str,
    limit: int = Query(default=5, ge=1, le=20),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Video).where(Video.id == video_id))
    video = result.scalar_one_or_none()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    if not video.keywords:
        return []

    # Find videos that share keywords, ordered by overlap count
    all_result = await db.execute(
        select(Video).where(
            Video.id != video_id,
            Video.keywords.overlap(video.keywords),
        )
    )
    candidates = all_result.scalars().all()

    # Rank by keyword overlap count
    def overlap_count(v):
        return len(set(v.keywords or []) & set(video.keywords))

    candidates.sort(key=overlap_count, reverse=True)
    return candidates[:limit]
```

**Step 2: Write test**

```python
class TestRelatedVideos:
    @patch("app.routers.videos.get_db")
    async def test_returns_videos_with_shared_keywords(self, mock_get_db, client, fake_db):
        mock_get_db.return_value = fake_db
        v1 = make_video()
        v1.keywords = ["python", "backend", "fastapi"]
        v2 = make_video()
        v2.keywords = ["python", "backend", "django"]
        v3 = make_video()
        v3.keywords = ["cooking", "recipes"]
        fake_db.store[v1.id] = v1
        fake_db.store[v2.id] = v2
        fake_db.store[v3.id] = v3

        resp = client.get(f"/api/videos/{v1.id}/related")
        assert resp.status_code == 200
        related = resp.json()
        assert len(related) == 1
        assert related[0]["id"] == str(v2.id)
```

**Step 3: Add "Related Videos" section to detail page**

Below the summary content, show a horizontal scroll of related video cards.

**Step 4: Commit**

```bash
git add backend/app/routers/videos.py backend/tests/test_endpoints.py frontend/src/app/video/\\[id\\]/page.tsx
git commit -m "feat: add related videos endpoint and display on detail page"
```

---

### Task 14: Add learning state tracking

Track when a user last viewed each video and how many times. This enables future smart review features.

**Files:**
- Create: Alembic migration for `last_viewed_at` and `view_count` on videos
- Modify: `backend/app/models.py`
- Modify: `backend/app/routers/videos.py`
- Modify: `backend/app/schemas.py`
- Test: `backend/tests/test_endpoints.py`

**Step 1: Add fields to Video model**

```python
last_viewed_at: Mapped[datetime | None] = mapped_column(nullable=True)
view_count: Mapped[int] = mapped_column(default=0, server_default=text("0"))
```

**Step 2: Create migration**

Run: `cd backend && alembic revision --autogenerate -m "add view tracking fields"`
Run: `cd backend && alembic upgrade head`

**Step 3: Update get_video to increment view count**

In `backend/app/routers/videos.py`, in the `get_video` endpoint:

```python
video.view_count += 1
video.last_viewed_at = datetime.now()
await db.commit()
await db.refresh(video)
```

**Step 4: Add to schemas**

Add `last_viewed_at` and `view_count` to `VideoResponse` and `VideoListResponse`.

**Step 5: Write test**

```python
class TestViewTracking:
    @patch("app.routers.videos.get_db")
    async def test_get_video_increments_view_count(self, mock_get_db, client, fake_db):
        mock_get_db.return_value = fake_db
        v = make_video()
        v.view_count = 0
        v.last_viewed_at = None
        fake_db.store[v.id] = v

        client.get(f"/api/videos/{v.id}")
        assert v.view_count == 1
        assert v.last_viewed_at is not None

        client.get(f"/api/videos/{v.id}")
        assert v.view_count == 2
```

**Step 6: Add sort options for view_count and last_viewed_at**

In the `list_videos` endpoint, add to `allowed_sort`:

```python
allowed_sort = {"created_at", "title", "channel_name", "duration", "last_viewed_at", "view_count"}
```

This enables sorting by "least recently viewed" or "never viewed" — natural review candidates.

**Step 7: Commit**

```bash
git add backend/app/models.py backend/app/schemas.py backend/app/routers/videos.py backend/tests/test_endpoints.py backend/alembic/versions/
git commit -m "feat: add view count and last_viewed_at tracking"
```

---

### Task 15: Add "needs review" filter

Surface videos the user hasn't looked at in a while or has never reviewed.

**Files:**
- Modify: `backend/app/routers/videos.py`
- Modify: `frontend/src/components/Toolbar.tsx`
- Modify: `frontend/src/app/page.tsx`

**Step 1: Add review_status filter to backend**

In `list_videos`, add:

```python
review_status: str | None = Query(default=None),  # "never_viewed", "stale", "recent"
```

Filter logic:

```python
if review_status == "never_viewed":
    query = query.where(Video.view_count == 0)
elif review_status == "stale":
    stale_threshold = datetime.now() - timedelta(days=14)
    query = query.where(
        or_(Video.last_viewed_at == None, Video.last_viewed_at < stale_threshold)
    )
elif review_status == "recent":
    recent_threshold = datetime.now() - timedelta(days=7)
    query = query.where(Video.last_viewed_at >= recent_threshold)
```

**Step 2: Add review filter buttons to Toolbar**

Quick-filter chips: "All" | "Never viewed" | "Needs review" | "Recently viewed"

**Step 3: Write test**

```python
class TestReviewStatusFilter:
    @patch("app.routers.videos.get_db")
    async def test_filter_never_viewed(self, mock_get_db, client, fake_db):
        mock_get_db.return_value = fake_db
        v1 = make_video()
        v1.view_count = 0
        v2 = make_video()
        v2.view_count = 3
        fake_db.store[v1.id] = v1
        fake_db.store[v2.id] = v2

        resp = client.get("/api/videos?review_status=never_viewed")
        body = resp.json()
        assert body["total"] == 1
```

**Step 4: Commit**

```bash
git add backend/app/routers/videos.py frontend/src/components/Toolbar.tsx frontend/src/app/page.tsx backend/tests/test_endpoints.py
git commit -m "feat: add review status filters for knowledge retention"
```

---

## Phase 6: Knowledge Dashboard

### Task 16: Add a stats/dashboard endpoint

Provide aggregate stats: total videos, videos by category, top tags, unreviewed count, videos added over time.

**Files:**
- Create: `backend/app/routers/stats.py`
- Modify: `backend/app/schemas.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_endpoints.py`

**Step 1: Define schema**

```python
class DashboardStats(BaseModel):
    total_videos: int
    total_collections: int
    never_viewed_count: int
    stale_count: int
    videos_by_category: dict[str, int]
    top_tags: list[TagSummaryResponse]
    recent_additions: int  # added in last 7 days
```

**Step 2: Implement endpoint**

```python
@router.get("/api/stats/dashboard", response_model=DashboardStats)
async def get_dashboard(db: AsyncSession = Depends(get_db)):
    # Aggregate queries for each stat
    ...
```

**Step 3: Write tests, commit**

```bash
git add backend/app/routers/stats.py backend/app/schemas.py backend/app/main.py backend/tests/test_endpoints.py
git commit -m "feat: add dashboard stats endpoint"
```

---

### Task 17: Build dashboard page in frontend

A dedicated `/dashboard` page showing knowledge overview.

**Files:**
- Create: `frontend/src/app/dashboard/page.tsx`

**Step 1: Build the page**

Display:
- Total videos count
- Videos by category (bar chart or colored cards)
- Top 10 tags (tag cloud or ranked list)
- "Needs review" count with link to filtered library view
- "Never viewed" count with link
- Videos added per week (simple trend)

Use existing Radix UI components. No need for a charting library — simple HTML/CSS bars work fine for an MVP.

**Step 2: Add navigation link**

Add "Dashboard" to the app's navigation/header.

**Step 3: Commit**

```bash
git add frontend/src/app/dashboard/page.tsx
git commit -m "feat: add knowledge dashboard page"
```

---

## Summary of All Tasks

| # | Task | Phase | Key Change |
|---|------|-------|------------|
| 1 | Server-side pagination | Performance | `GET /api/videos?limit=50&offset=0` |
| 2 | Server-side search | Performance | Search across title, channel, explanation, key_knowledge, keywords |
| 3 | Server-side tag stats | Performance | `GET /api/tags?search=&limit=` |
| 4 | Update API client | Frontend | New types + paginated listVideos |
| 5 | Infinite scroll | Frontend | `usePaginatedVideos` hook + IntersectionObserver |
| 6 | Server-side tag loading | Frontend | Remove client-side tag computation |
| 7 | Sort controls | UX | Sort by title, date, duration, channel |
| 8 | Video count indicator | UX | "Showing X of Y" |
| 9 | Collections model | Organization | Many-to-many collections ↔ videos |
| 10 | Collections API | Organization | CRUD + add/remove videos |
| 11 | Collection filter | Organization | `GET /api/videos?collection_id=` |
| 12 | Collections UI | Organization | Sidebar, manager, add-to-collection action |
| 13 | Related videos | Discovery | Keyword overlap ranking |
| 14 | View tracking | Retention | `view_count`, `last_viewed_at` |
| 15 | Review status filter | Retention | "Never viewed" / "Needs review" / "Recent" |
| 16 | Dashboard stats API | Dashboard | Aggregated knowledge overview |
| 17 | Dashboard page | Dashboard | Visual knowledge overview page |
