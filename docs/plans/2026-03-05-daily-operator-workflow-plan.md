# Daily Operator Workflow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Convert the product into an action-first daily workflow where `/` is a triage workspace, `/browse` is the management surface, and `/dashboard` is analytics-only.

**Architecture:** Keep existing API contracts where possible, add one small backend filter for accurate uncategorized queues, and move most behavior into reusable frontend filter/queue helpers with test coverage. Build UI changes incrementally in home, browse, and dashboard routes while preserving existing extraction and item detail flows.

**Tech Stack:** FastAPI + pytest (backend), Next.js 16 + React 19 + Tailwind + shadcn/ui (frontend), Vitest for frontend utility tests, Playwright MCP for end-to-end verification.

---

### Task 1: Add Accurate Uncategorized Filtering in API

**Files:**
- Modify: `backend/tests/test_endpoints.py`
- Modify: `backend/app/routers/videos.py`

**Step 1: Write the failing backend test**

Add this test inside `TestListVideos`:

```python
@pytest.mark.asyncio
async def test_filter_uncategorized(self, client, fake_db):
    uncategorized = make_video(title="No Category", category=None)
    categorized = make_video(title="Categorized", category="technology")
    fake_db.store[uncategorized.id] = uncategorized
    fake_db.store[categorized.id] = categorized

    resp = await client.get("/api/videos?category=__uncategorized__")

    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["items"][0]["title"] == "No Category"
```

**Step 2: Run the targeted test and verify RED**

Run: `cd backend && python3 -m pytest tests/test_endpoints.py::TestListVideos::test_filter_uncategorized -q`

Expected: `FAIL` because the API currently compares `Video.category == "__uncategorized__"`.

**Step 3: Implement minimal backend filter logic**

Update `list_videos` category branch in `backend/app/routers/videos.py`:

```python
if category == "__uncategorized__":
    query = query.where(Video.category.is_(None))
elif category:
    query = query.where(Video.category == category)
```

**Step 4: Run the same test and verify GREEN**

Run: `cd backend && python3 -m pytest tests/test_endpoints.py::TestListVideos::test_filter_uncategorized -q`

Expected: `1 passed`.

**Step 5: Commit**

```bash
git add backend/tests/test_endpoints.py backend/app/routers/videos.py
git commit -m "feat: support uncategorized filter in videos list endpoint"
```

---

### Task 2: Add Frontend Test Harness + Browse Filter Helpers

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/vitest.config.ts`
- Create: `frontend/src/lib/browseFilters.test.ts`
- Create: `frontend/src/lib/browseFilters.ts`

**Step 1: Add test dependencies and scripts**

Install and wire scripts:

```bash
cd frontend && npm install -D vitest
```

Add scripts:

```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run"
  }
}
```

**Step 2: Add failing filter helper tests (RED)**

`frontend/src/lib/browseFilters.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseBrowseFilters, applyQuickFilter } from "@/lib/browseFilters";

describe("parseBrowseFilters", () => {
  it("reads review_status from URL params", () => {
    const params = new URLSearchParams("q=ai&review_status=never_viewed&sort=created_at_desc");
    expect(parseBrowseFilters(params)).toMatchObject({
      search: "ai",
      reviewStatus: "never_viewed",
      sort: "created_at_desc",
    });
  });
});

describe("applyQuickFilter", () => {
  it("maps inbox quick filter to uncategorized category token", () => {
    const next = applyQuickFilter({ sort: "created_at_desc" }, "inbox");
    expect(next.category).toBe("__uncategorized__");
  });
});
```

**Step 3: Run the test and verify RED**

Run: `cd frontend && npm run test:run -- src/lib/browseFilters.test.ts`

Expected: `FAIL` because `browseFilters.ts` does not exist.

**Step 4: Implement minimal helper module (GREEN)**

`frontend/src/lib/browseFilters.ts`:

```ts
export type SortOption =
  `${"created_at" | "title" | "duration" | "channel_name"}_${"asc" | "desc"}`;

export type QuickFilter = "inbox" | "needs_review" | "never_viewed" | "long_videos";

export type BrowseFilterState = {
  search?: string;
  category?: string;
  tag?: string;
  collectionId?: string;
  reviewStatus?: string;
  sort: SortOption;
};

export function parseBrowseFilters(params: URLSearchParams): BrowseFilterState {
  return {
    search: params.get("q") ?? undefined,
    category: params.get("category") ?? undefined,
    tag: params.get("tag") ?? undefined,
    collectionId: params.get("collection") ?? undefined,
    reviewStatus: params.get("review_status") ?? undefined,
    sort: (params.get("sort") as SortOption | null) ?? "created_at_desc",
  };
}

export function applyQuickFilter(
  current: Pick<BrowseFilterState, "sort">,
  quick: QuickFilter,
): BrowseFilterState {
  if (quick === "inbox") return { ...current, category: "__uncategorized__" };
  if (quick === "needs_review") return { ...current, reviewStatus: "stale" };
  if (quick === "never_viewed") return { ...current, reviewStatus: "never_viewed" };
  return { ...current, sort: "duration_desc" };
}
```

**Step 5: Re-run tests and verify GREEN**

Run: `cd frontend && npm run test:run -- src/lib/browseFilters.test.ts`

Expected: `PASS`.

**Step 6: Commit**

```bash
git add frontend/package.json frontend/vitest.config.ts frontend/src/lib/browseFilters.ts frontend/src/lib/browseFilters.test.ts
git commit -m "test: add browse filter utilities with vitest coverage"
```

---

### Task 3: Add Today Queue Helpers with TDD

**Files:**
- Create: `frontend/src/lib/todayQueues.test.ts`
- Create: `frontend/src/lib/todayQueues.ts`

**Step 1: Write failing queue helper tests (RED)**

`frontend/src/lib/todayQueues.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildTodayQueues } from "@/lib/todayQueues";
import type { VideoListItem } from "@/lib/api";

function video(partial: Partial<VideoListItem>): VideoListItem {
  return {
    id: partial.id ?? "id",
    youtube_url: partial.youtube_url ?? "https://youtu.be/x",
    youtube_id: partial.youtube_id ?? "x",
    title: partial.title ?? "Title",
    thumbnail_url: null,
    channel_name: null,
    duration: 60,
    explanation: null,
    key_knowledge: null,
    keywords: [],
    category: partial.category ?? null,
    transcript_source: null,
    created_at: partial.created_at ?? "2026-03-05T00:00:00Z",
    updated_at: partial.updated_at ?? "2026-03-05T00:00:00Z",
  };
}

describe("buildTodayQueues", () => {
  it("returns top items and counts per queue", () => {
    const result = buildTodayQueues({
      inbox: [video({ id: "1" }), video({ id: "2" })],
      neverViewed: [video({ id: "3" })],
      needsReview: [video({ id: "4" }), video({ id: "5" }), video({ id: "6" }), video({ id: "7" })],
      previewLimit: 3,
    });

    expect(result.inbox.count).toBe(2);
    expect(result.neverViewed.count).toBe(1);
    expect(result.needsReview.preview).toHaveLength(3);
  });
});
```

**Step 2: Run targeted test and verify RED**

Run: `cd frontend && npm run test:run -- src/lib/todayQueues.test.ts`

Expected: `FAIL` because helper module does not exist.

**Step 3: Implement minimal helper (GREEN)**

`frontend/src/lib/todayQueues.ts`:

```ts
import type { VideoListItem } from "@/lib/api";

type QueueSlice = { count: number; preview: VideoListItem[] };

export type TodayQueues = {
  inbox: QueueSlice;
  neverViewed: QueueSlice;
  needsReview: QueueSlice;
};

export function buildTodayQueues(input: {
  inbox: VideoListItem[];
  neverViewed: VideoListItem[];
  needsReview: VideoListItem[];
  previewLimit: number;
}): TodayQueues {
  const slice = (items: VideoListItem[]): QueueSlice => ({
    count: items.length,
    preview: items.slice(0, input.previewLimit),
  });

  return {
    inbox: slice(input.inbox),
    neverViewed: slice(input.neverViewed),
    needsReview: slice(input.needsReview),
  };
}
```

**Step 4: Re-run test and verify GREEN**

Run: `cd frontend && npm run test:run -- src/lib/todayQueues.test.ts`

Expected: `PASS`.

**Step 5: Commit**

```bash
git add frontend/src/lib/todayQueues.ts frontend/src/lib/todayQueues.test.ts
git commit -m "test: cover today queue aggregation helpers"
```

---

### Task 4: Rebuild Home as Action-First Today Workspace

**Files:**
- Create: `frontend/src/components/TodayQueueCard.tsx`
- Modify: `frontend/src/app/page.tsx`
- Modify: `frontend/src/components/DashboardToolbar.tsx`

**Step 1: Add `TodayQueueCard` component**

Use a reusable card for queue sections with preview rows and CTA:

```tsx
type TodayQueueCardProps = {
  title: string;
  count: number;
  emptyMessage: string;
  href: string;
  items: VideoListItem[];
};
```

Render: header (`title`, `count`), preview list of up to 3 items, and `Open queue` link to browse filter URL.

**Step 2: Load queue datasets in `page.tsx`**

In dashboard fetch block, request queue data in parallel:

```ts
const [inboxRes, neverViewedRes, needsReviewRes] = await Promise.all([
  listVideos({ category: "__uncategorized__", sort_by: "created_at", sort_order: "desc", limit: 20 }),
  listVideos({ review_status: "never_viewed", sort_by: "created_at", sort_order: "desc", limit: 20 }),
  listVideos({ review_status: "stale", sort_by: "created_at", sort_order: "desc", limit: 20 }),
]);
```

Build queue state through `buildTodayQueues()` with `previewLimit: 3`.

**Step 3: Replace metric-first hero with quick capture + queue cards**

Home page top order:
1. quick capture CTA strip (`Add URL` + pending extraction)
2. three queue cards (`Uncategorized`, `Never Viewed`, `Needs Review`)
3. compact recently added list

Remove home-level `Popular Tags` and broad category browsing blocks.

**Step 4: Add toolbar accessibility labels**

In `DashboardToolbar`, add aria labels to icon links:

```tsx
<Link href="/dashboard" aria-label="Open analytics dashboard">...
<Link href="/categories" aria-label="Manage categories">...
```

**Step 5: Verify home behavior manually**

Run: `cd frontend && npm run dev`

Check:
- `/` opens with queue cards visible above fold.
- `Uncategorized` card links to `/browse?category=__uncategorized__`.
- no horizontal overflow at 390px width.

**Step 6: Commit**

```bash
git add frontend/src/components/TodayQueueCard.tsx frontend/src/app/page.tsx frontend/src/components/DashboardToolbar.tsx
git commit -m "feat: convert home page into today-first triage workspace"
```

---

### Task 5: Make Browse the True Management Surface

**Files:**
- Modify: `frontend/src/app/browse/page.tsx`
- Modify: `frontend/src/components/ResourceListItem.tsx`
- Modify: `frontend/src/lib/browseFilters.ts`

**Step 1: Parse and apply `review_status` in browse page**

Use `parseBrowseFilters(new URLSearchParams(searchParams.toString()))` and pass `review_status` into `usePaginatedVideos`:

```ts
review_status: parsed.reviewStatus ?? undefined,
```

**Step 2: Add quick filter chips under header**

Add four buttons mapped by `applyQuickFilter`:
- Inbox
- Needs Review
- Never Viewed
- Long Videos

Each button pushes updated query string via router.

**Step 3: Prevent misleading empty-state flicker**

Show skeletons while first fetch is unresolved; only show `No items found` after loading completes and first payload settles.

**Step 4: Make row actions visible without hover dependency**

In `ResourceListItem.tsx`, change action container from hover-only opacity to always visible on mobile and keyboard focus:

```tsx
className="shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 [&:has([data-state=open])]:opacity-100"
```

**Step 5: Run frontend tests and lint**

Run:
- `cd frontend && npm run test:run -- src/lib/browseFilters.test.ts src/lib/todayQueues.test.ts`
- `cd frontend && npm run lint`

Expected: tests pass and lint clean.

**Step 6: Commit**

```bash
git add frontend/src/app/browse/page.tsx frontend/src/components/ResourceListItem.tsx frontend/src/lib/browseFilters.ts
git commit -m "feat: strengthen browse as primary management workflow"
```

---

### Task 6: Re-scope Dashboard to Analytics-Only

**Files:**
- Modify: `frontend/src/app/dashboard/page.tsx`

**Step 1: Fix review links to point to browse filters**

Update links:

```tsx
href="/browse?review_status=never_viewed"
href="/browse?review_status=stale"
```

**Step 2: Remove operational CTA dependence**

Keep dashboard informational. Primary daily CTA should not require this page.
Retain `Add URL` but de-emphasize queue-task language.

**Step 3: Verify dashboard remains insight-focused**

Run: `cd frontend && npm run dev`

Check:
- stats and charts still load
- review links route to filtered browse
- no operational dead ends

**Step 4: Commit**

```bash
git add frontend/src/app/dashboard/page.tsx
git commit -m "refactor: focus dashboard on analytics and browse routing"
```

---

### Task 7: End-to-End Verification and Final Cleanup

**Files:**
- Verify only (no new files)

**Step 1: Run backend suite**

Run: `cd backend && python3 -m pytest tests/ -q`

Expected: all backend tests pass.

**Step 2: Run frontend quality gates**

Run:
- `cd frontend && npm run test:run`
- `cd frontend && npm run lint`
- `cd frontend && npm run build`

Expected: all commands exit 0.

**Step 3: Run Playwright MCP flow**

Verify:
1. `/` shows quick capture + three queues.
2. Inbox queue link opens `/browse?category=__uncategorized__`.
3. Needs Review queue link opens `/browse?review_status=stale`.
4. Browse quick filters update URL and list.
5. Row actions are visible and usable on mobile viewport (390px).
6. `/dashboard` review links route to `/browse` filters.

**Step 4: Final commit for verification fixes (if needed)**

```bash
git add -u
git commit -m "fix: address daily workflow verification regressions"
```
