# Recently Added Section — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a horizontal scrollable "Recently Added" row of the 10 newest videos above the library grid, hidden when filters are active.

**Architecture:** New `RecentlyAdded` component fetches 10 newest videos independently via `listVideos()`. Parent `page.tsx` controls visibility based on filter state. No backend changes.

**Tech Stack:** Next.js, React, TypeScript, Tailwind CSS, existing `VideoCard` component, existing `listVideos` API function.

---

### Task 1: Create `RecentlyAdded` component

**Files:**
- Create: `frontend/src/components/RecentlyAdded.tsx`

**Step 1: Create the component**

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { VideoCard } from "@/components/VideoCard";
import { Skeleton } from "@/components/ui/skeleton";
import {
  listVideos,
  type Category,
  type CollectionItem,
  type VideoListItem,
} from "@/lib/api";

interface RecentlyAddedProps {
  categories: Category[];
  categoryNameMap: Record<string, string>;
  collections: CollectionItem[];
  videoCollectionMap: Record<string, Set<string>>;
  onCategoryChange: (videoId: string, category: string | null) => Promise<void>;
  onCollectionToggle: (videoId: string, collectionId: string, checked: boolean) => Promise<void>;
  onDelete: (video: VideoListItem) => void;
}

export function RecentlyAdded({
  categories,
  categoryNameMap,
  collections,
  videoCollectionMap,
  onCategoryChange,
  onCollectionToggle,
  onDelete,
}: RecentlyAddedProps) {
  const [videos, setVideos] = useState<VideoListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRecent = useCallback(async () => {
    try {
      const res = await listVideos({
        sort_by: "created_at",
        sort_order: "desc",
        limit: 10,
      });
      setVideos(res.items);
    } catch {
      setVideos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecent();
  }, [fetchRecent]);

  if (!loading && videos.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-base font-semibold">Recently Added</h2>

      {loading ? (
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="w-[280px] flex-none space-y-3">
              <Skeleton className="aspect-video w-full rounded-lg" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      ) : (
        <div className="group/scroll relative">
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin">
            {videos.map((video) => (
              <div key={video.id} className="w-[280px] flex-none">
                <VideoCard
                  video={video}
                  categoryNameMap={categoryNameMap}
                  categories={categories}
                  collections={collections}
                  selectedCollectionIds={videoCollectionMap[video.id] ?? new Set()}
                  onCategoryChange={(cat) => onCategoryChange(video.id, cat)}
                  onCollectionToggle={(colId, checked) =>
                    onCollectionToggle(video.id, colId, checked)
                  }
                  onDelete={() => onDelete(video)}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
```

**Step 2: Verify no lint errors**

Run: `cd frontend && npx next lint --file src/components/RecentlyAdded.tsx`

**Step 3: Commit**

```bash
git add frontend/src/components/RecentlyAdded.tsx
git commit -m "feat: add RecentlyAdded component"
```

---

### Task 2: Integrate into `page.tsx`

**Files:**
- Modify: `frontend/src/app/page.tsx`

**Step 1: Add import**

At the top of `page.tsx`, add:
```tsx
import { RecentlyAdded } from "@/components/RecentlyAdded";
```

**Step 2: Compute `isFiltering` flag**

Inside `HomePage`, after the `visibleTotal` line (~line 128), add:
```tsx
const isFiltering = !!(search || selectedKeywords.length > 0 || selectedCategory || selectedCollection || reviewStatus);
```

**Step 3: Render `RecentlyAdded` above the library grid**

Inside the `<main>` element, right after the header `<div className="mb-6 ...">` block (after line 341), insert:
```tsx
{!isFiltering && !loading && (
  <RecentlyAdded
    categories={categories}
    categoryNameMap={categoryNameMap}
    collections={collections}
    videoCollectionMap={videoCollectionMap}
    onCategoryChange={handleVideoCategoryChange}
    onCollectionToggle={handleVideoCollectionToggle}
    onDelete={setVideoPendingDelete}
  />
)}
```

**Step 4: Verify no lint errors**

Run: `cd frontend && npx next lint --file src/app/page.tsx`

**Step 5: Commit**

```bash
git add frontend/src/app/page.tsx
git commit -m "feat: integrate RecentlyAdded section into home page"
```

---

### Task 3: Manual browser test

**Step 1: Start the app and verify**

Open the app in browser. Verify:
- The "Recently Added" row appears above the library grid
- It shows up to 10 videos in a horizontal scrollable row
- It disappears when you type in search, select a category, select a collection, or toggle a keyword filter
- It reappears when all filters are cleared
- Clicking a video card navigates to the detail page
- The dropdown actions (category, collection, delete) work on cards in the row
