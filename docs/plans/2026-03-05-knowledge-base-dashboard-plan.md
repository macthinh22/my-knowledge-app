# Knowledge Base Dashboard Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the YouTube-like thumbnail grid home page with a dashboard-first knowledge base layout, and add text-first list view pages for browsing by category, tag, and collection.

**Architecture:** Dashboard home page (`/`) with four sections (recently added, categories+tags, collections). Clicking any item navigates to a shared list view page. New Next.js app router routes for `/browse`, `/category/[slug]`, `/tag/[tag]`, `/collection/[id]`. Reuses existing `usePaginatedVideos` hook and all backend APIs unchanged.

**Tech Stack:** Next.js 16 (app router), React 19, Tailwind CSS v4, shadcn/ui, existing API client.

---

### Task 1: Create the Browse List View Page

The list view is the foundation — dashboard links all point here. Build it first.

**Files:**
- Create: `frontend/src/app/browse/page.tsx`
- Create: `frontend/src/components/ResourceListItem.tsx`

**Step 1: Create `ResourceListItem` component**

This replaces `VideoListItem` for the new text-first design. No thumbnails.

```tsx
// frontend/src/components/ResourceListItem.tsx
"use client";

import Link from "next/link";
import { Clock } from "lucide-react";
import { KeywordChips } from "@/components/KeywordChips";
import { VideoActionDropdown } from "@/components/VideoActionDropdown";
import { Badge } from "@/components/ui/badge";
import type { Category, CollectionItem, VideoListItem } from "@/lib/api";
import { categoryLabel, getCategoryBadgeClass, buildCategoryColorMap } from "@/lib/categories";
import { formatDuration } from "@/lib/format";
import { formatDistanceToNowStrict } from "date-fns";

interface ResourceListItemProps {
  video: VideoListItem;
  categoryNameMap?: Record<string, string>;
  categories: Category[];
  collections: CollectionItem[];
  selectedCollectionIds: Set<string>;
  onCategoryChange: (category: string | null) => Promise<void>;
  onCollectionToggle: (collectionId: string, checked: boolean) => Promise<void>;
  onDelete: () => void;
  showCategory?: boolean;
  actionsDisabled?: boolean;
}

export function ResourceListItem({
  video,
  categoryNameMap,
  categories,
  collections,
  selectedCollectionIds,
  onCategoryChange,
  onCollectionToggle,
  onDelete,
  showCategory = true,
  actionsDisabled,
}: ResourceListItemProps) {
  const categoryColorMap = buildCategoryColorMap(categories);

  return (
    <div className="group flex items-center gap-2 rounded-lg border border-transparent px-4 py-3 transition-colors hover:bg-accent">
      <Link href={`/video/${video.id}`} className="flex min-w-0 flex-1 items-start gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h3 className="text-sm font-medium leading-snug">
            {video.title ?? "Untitled"}
          </h3>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            {video.channel_name && <span>{video.channel_name}</span>}
            {video.channel_name && <span>·</span>}
            {showCategory && video.category && (
              <Badge
                variant="outline"
                className={`text-[10px] px-1.5 py-0 ${getCategoryBadgeClass(categoryColorMap[video.category])}`}
              >
                {categoryLabel(video.category, categoryNameMap)}
              </Badge>
            )}
            <KeywordChips keywords={video.keywords} maxVisible={3} className="" />
            {video.duration != null && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDuration(video.duration)}
              </span>
            )}
            <span>
              {formatDistanceToNowStrict(new Date(video.created_at), { addSuffix: true })}
            </span>
          </div>
        </div>
      </Link>
      <div className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 [&:has([data-state=open])]:opacity-100">
        <VideoActionDropdown
          categories={categories}
          currentCategory={video.category}
          collections={collections}
          selectedCollectionIds={selectedCollectionIds}
          onCategoryChange={onCategoryChange}
          onCollectionToggle={onCollectionToggle}
          onDelete={onDelete}
          disabled={actionsDisabled}
        />
      </div>
    </div>
  );
}
```

**Step 2: Create the browse page**

```tsx
// frontend/src/app/browse/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, SearchX } from "lucide-react";
import { ResourceListItem } from "@/components/ResourceListItem";
import { usePaginatedVideos } from "@/hooks/usePaginatedVideos";
import {
  listCategories,
  listCollections,
  listTags,
  getCollection,
  deleteVideo,
  updateVideoCategory,
  addVideoToCollection,
  removeVideoFromCollection,
  type Category,
  type CollectionItem,
  type TagSummary,
  type VideoListItem,
} from "@/lib/api";
import type { SortOption } from "@/components/Toolbar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, Tag } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// This is a shared browse/list page.
// URL params: ?q=search&sort=created_at_desc&tag=pytorch&category=ml&collection=uuid
// The page title adapts based on which filter is active.

export default function BrowsePage() {
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get("q") ?? "";
  const categorySlug = searchParams.get("category");
  const tagFilter = searchParams.get("tag");
  const collectionId = searchParams.get("collection");
  const initialSort = (searchParams.get("sort") as SortOption) ?? "created_at_desc";

  const [sortOption, setSortOption] = useState<SortOption>(initialSort);
  const [categories, setCategories] = useState<Category[]>([]);
  const [collections, setCollections] = useState<CollectionItem[]>([]);
  const [videoCollectionMap, setVideoCollectionMap] = useState<Record<string, Set<string>>>({});
  const [deletedVideoIds, setDeletedVideoIds] = useState<Set<string>>(new Set());
  const [videoPendingDelete, setVideoPendingDelete] = useState<VideoListItem | null>(null);

  // Parse sort option into sort_by and sort_order
  const [sortBy, sortOrder] = useMemo(() => {
    const lastUnderscore = sortOption.lastIndexOf("_");
    return [sortOption.slice(0, lastUnderscore), sortOption.slice(lastUnderscore + 1)] as [string, "asc" | "desc"];
  }, [sortOption]);

  const { videos, total, loading, loadingMore, hasMore, loadMore, refresh } =
    usePaginatedVideos({
      search: searchQuery || undefined,
      sort_by: sortBy,
      sort_order: sortOrder,
      category: categorySlug ?? undefined,
      tag: tagFilter ?? undefined,
      collection_id: collectionId ?? undefined,
    });

  const filtered = useMemo(
    () => videos.filter((v) => !deletedVideoIds.has(v.id)),
    [videos, deletedVideoIds],
  );

  useEffect(() => {
    listCategories().then(setCategories).catch(() => setCategories([]));
  }, []);

  const refreshCollections = useCallback(async () => {
    const cols = await listCollections().catch(() => [] as CollectionItem[]);
    setCollections(cols);
    const details = await Promise.all(cols.map((c) => getCollection(c.id).catch(() => null)));
    const membership: Record<string, Set<string>> = {};
    details.forEach((d, i) => {
      if (!d) return;
      d.video_ids.forEach((vid) => {
        if (!membership[vid]) membership[vid] = new Set();
        membership[vid].add(cols[i].id);
      });
    });
    setVideoCollectionMap(membership);
  }, []);

  useEffect(() => { refreshCollections(); }, [refreshCollections]);

  const categoryNameMap = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.slug, c.name])),
    [categories],
  );

  // Page title logic
  const pageTitle = useMemo(() => {
    if (categorySlug) {
      const name = categoryNameMap[categorySlug] ?? categorySlug;
      return name;
    }
    if (tagFilter) return `#${tagFilter}`;
    if (collectionId) {
      const col = collections.find((c) => c.id === collectionId);
      return col?.name ?? "Collection";
    }
    if (searchQuery) return `Search: "${searchQuery}"`;
    return "All Resources";
  }, [categorySlug, tagFilter, collectionId, searchQuery, categoryNameMap, collections]);

  const handleDelete = async () => {
    if (!videoPendingDelete) return;
    setDeletedVideoIds((prev) => new Set(prev).add(videoPendingDelete.id));
    setVideoPendingDelete(null);
    try {
      await deleteVideo(videoPendingDelete.id);
      refresh();
      refreshCollections();
    } catch { /* optimistic, already removed from UI */ }
  };

  const sortLabels: Record<string, string> = {
    created_at_desc: "Newest",
    created_at_asc: "Oldest",
    title_asc: "Title A–Z",
    title_desc: "Title Z–A",
    duration_desc: "Longest",
    duration_asc: "Shortest",
  };

  // Sentinel for infinite scroll
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!hasMore || !sentinelRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMore(); },
      { rootMargin: "200px" },
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [loadMore, hasMore]);

  // Show category badge only when NOT filtering by a single category
  const showCategory = !categorySlug;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-6 py-8">
        <Link
          href="/"
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>

        <div className="mb-6 flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{pageTitle}</h1>
            <p className="text-sm text-muted-foreground">{total} items</p>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <ArrowUpDown className="mr-2 h-3.5 w-3.5" />
                {sortLabels[sortOption] ?? "Sort"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {Object.entries(sortLabels).map(([key, label]) => (
                <DropdownMenuItem key={key} onClick={() => setSortOption(key as SortOption)}>
                  {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
            <SearchX className="h-10 w-10" />
            <p>No items found</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {filtered.map((video) => (
              <ResourceListItem
                key={video.id}
                video={video}
                categoryNameMap={categoryNameMap}
                categories={categories}
                collections={collections}
                selectedCollectionIds={videoCollectionMap[video.id] ?? new Set()}
                onCategoryChange={async (cat) => {
                  await updateVideoCategory(video.id, cat);
                  refresh();
                }}
                onCollectionToggle={async (colId, checked) => {
                  if (checked) await addVideoToCollection(colId, video.id);
                  else await removeVideoFromCollection(colId, video.id);
                  refreshCollections();
                }}
                onDelete={() => setVideoPendingDelete(video)}
                showCategory={showCategory}
              />
            ))}
          </div>
        )}

        <div ref={sentinelRef} className="flex justify-center py-8">
          {loadingMore && <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />}
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={!!videoPendingDelete} onOpenChange={(open) => { if (!open) setVideoPendingDelete(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete resource?</DialogTitle>
            <DialogDescription>
              &quot;{videoPendingDelete?.title}&quot; will be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVideoPendingDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

**Step 3: Verify the page renders**

Run: `cd frontend && npm run dev`

Navigate to `http://localhost:3000/browse` — should show "All Resources" with the full list of items in text-first format. Navigate to `http://localhost:3000/browse?category=some-slug` — should filter by category.

**Step 4: Commit**

```bash
git add frontend/src/components/ResourceListItem.tsx frontend/src/app/browse/page.tsx
git commit -m "feat: add browse list view page with text-first ResourceListItem"
```

---

### Task 2: Add Route Aliases for Category, Tag, and Collection

Instead of separate page components, create thin wrapper pages that redirect/render the browse page with the right params.

**Files:**
- Create: `frontend/src/app/category/[slug]/page.tsx`
- Create: `frontend/src/app/tag/[tag]/page.tsx`
- Create: `frontend/src/app/collection/[id]/page.tsx`

**Step 1: Create category route**

```tsx
// frontend/src/app/category/[slug]/page.tsx
import { redirect } from "next/navigation";

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/browse?category=${encodeURIComponent(slug)}`);
}
```

**Step 2: Create tag route**

```tsx
// frontend/src/app/tag/[tag]/page.tsx
import { redirect } from "next/navigation";

export default async function TagPage({
  params,
}: {
  params: Promise<{ tag: string }>;
}) {
  const { tag } = await params;
  redirect(`/browse?tag=${encodeURIComponent(tag)}`);
}
```

**Step 3: Create collection route**

```tsx
// frontend/src/app/collection/[id]/page.tsx
import { redirect } from "next/navigation";

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/browse?collection=${encodeURIComponent(id)}`);
}
```

**Step 4: Verify redirects work**

Navigate to `http://localhost:3000/category/some-slug` — should redirect to `/browse?category=some-slug`.

**Step 5: Commit**

```bash
git add frontend/src/app/category frontend/src/app/tag frontend/src/app/collection
git commit -m "feat: add route aliases for category, tag, and collection views"
```

---

### Task 3: Build the Dashboard Home Page

Replace the current flat grid home page with the dashboard layout.

**Files:**
- Rewrite: `frontend/src/app/page.tsx`
- Create: `frontend/src/components/DashboardToolbar.tsx`

**Step 1: Create a simplified dashboard toolbar**

```tsx
// frontend/src/components/DashboardToolbar.tsx
"use client";

import { useState, useCallback, useEffect } from "react";
import { Search, X, BookOpen, SlidersHorizontal, BarChart3 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./ThemeToggle";

export function DashboardToolbar() {
  const router = useRouter();
  const [search, setSearch] = useState("");

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (search.trim()) {
        router.push(`/browse?q=${encodeURIComponent(search.trim())}`);
      }
    },
    [search, router],
  );

  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center gap-4 px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <BookOpen className="h-5 w-5" />
          <span className="hidden sm:inline">Knowledge Base</span>
        </Link>

        <form onSubmit={handleSearch} className="relative ml-auto flex w-full max-w-sm items-center">
          <Search className="absolute left-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search resources…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-8"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </form>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard"><BarChart3 className="h-4 w-4" /></Link>
          </Button>
          <Button variant="ghost" size="icon" asChild>
            <Link href="/categories"><SlidersHorizontal className="h-4 w-4" /></Link>
          </Button>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
```

**Step 2: Rewrite the home page**

Replace `frontend/src/app/page.tsx` entirely with the dashboard layout. The new page has four sections: recently added, categories + tags side by side, and collections.

```tsx
// frontend/src/app/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Clock,
  FolderOpen,
  Hash,
  Loader2,
  Plus,
  Tag,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DashboardToolbar } from "@/components/DashboardToolbar";
import { PendingVideoCard } from "@/components/PendingVideoCard";
import { useExtraction } from "@/context/extraction";
import {
  listCategories,
  listCollections,
  listTags,
  listVideos,
  createCollection,
  deleteCollection,
  type Category,
  type CollectionItem,
  type TagSummary,
  type VideoListItem,
} from "@/lib/api";
import { categoryLabel, getCategoryBadgeClass, buildCategoryColorMap } from "@/lib/categories";
import { formatDistanceToNowStrict } from "date-fns";

export default function HomePage() {
  const { activeJob } = useExtraction();

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [tags, setTags] = useState<TagSummary[]>([]);
  const [collections, setCollections] = useState<CollectionItem[]>([]);
  const [recentItems, setRecentItems] = useState<VideoListItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Collection creation
  const [showCreateCollection, setShowCreateCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [creatingCollection, setCreatingCollection] = useState(false);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const [cats, tagList, cols, recent] = await Promise.all([
        listCategories().catch(() => [] as Category[]),
        listTags({ limit: 20 }).catch(() => [] as TagSummary[]),
        listCollections().catch(() => [] as CollectionItem[]),
        listVideos({ sort_by: "created_at", sort_order: "desc", limit: 5 }).then((r) => r.items).catch(() => [] as VideoListItem[]),
      ]);
      setCategories(cats);
      setTags(tagList);
      setCollections(cols);
      setRecentItems(recent);

      // Fetch category counts in parallel
      const counts: Record<string, number> = {};
      await Promise.all(
        cats.map(async (cat) => {
          try {
            const res = await listVideos({ category: cat.slug, limit: 1 });
            counts[cat.slug] = res.total;
          } catch {
            counts[cat.slug] = 0;
          }
        }),
      );
      // Also count uncategorized
      try {
        const allRes = await listVideos({ limit: 1 });
        const categorizedTotal = Object.values(counts).reduce((a, b) => a + b, 0);
        counts["__uncategorized"] = allRes.total - categorizedTotal;
      } catch { /* ignore */ }
      setCategoryCounts(counts);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDashboardData(); }, [fetchDashboardData]);

  const categoryNameMap = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.slug, c.name])),
    [categories],
  );
  const categoryColorMap = useMemo(
    () => buildCategoryColorMap(categories),
    [categories],
  );

  const handleCreateCollection = async () => {
    const name = newCollectionName.trim();
    if (!name) return;
    setCreatingCollection(true);
    try {
      await createCollection(name);
      setNewCollectionName("");
      setShowCreateCollection(false);
      const cols = await listCollections();
      setCollections(cols);
    } finally {
      setCreatingCollection(false);
    }
  };

  const handleDeleteCollection = async (id: string) => {
    await deleteCollection(id);
    setCollections((prev) => prev.filter((c) => c.id !== id));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <DashboardToolbar />
        <div className="flex justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardToolbar />

      <main className="mx-auto max-w-4xl px-6 py-8 space-y-10">
        {/* Pending extraction */}
        {activeJob && (
          <section>
            <PendingVideoCard job={activeJob} />
          </section>
        )}

        {/* Recently Added */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Recently Added</h2>
            <Link
              href="/browse?sort=created_at_desc"
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {recentItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">No resources yet.</p>
          ) : (
            <div className="space-y-1">
              {recentItems.map((item) => (
                <Link
                  key={item.id}
                  href={`/video/${item.id}`}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent"
                >
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {item.title ?? "Untitled"}
                  </span>
                  {item.channel_name && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {item.channel_name}
                    </span>
                  )}
                  {item.category && (
                    <Badge
                      variant="outline"
                      className={`shrink-0 text-[10px] px-1.5 py-0 ${getCategoryBadgeClass(categoryColorMap[item.category])}`}
                    >
                      {categoryLabel(item.category, categoryNameMap)}
                    </Badge>
                  )}
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDistanceToNowStrict(new Date(item.created_at), { addSuffix: true })}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Categories + Tags side by side */}
        <section className="grid gap-8 md:grid-cols-2">
          {/* Categories */}
          <div>
            <h2 className="mb-3 text-lg font-semibold">Categories</h2>
            <div className="space-y-1">
              {categories.map((cat) => (
                <Link
                  key={cat.id}
                  href={`/category/${cat.slug}`}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent"
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{
                      backgroundColor: `var(--color-${cat.color ?? "slate"}-500, var(--color-slate-500))`,
                    }}
                  />
                  <span className="min-w-0 flex-1">{cat.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {categoryCounts[cat.slug] ?? 0}
                  </span>
                </Link>
              ))}
              {(categoryCounts["__uncategorized"] ?? 0) > 0 && (
                <Link
                  href="/browse"
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent"
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-muted-foreground/30" />
                  <span className="min-w-0 flex-1">Uncategorized</span>
                  <span className="text-xs">{categoryCounts["__uncategorized"]}</span>
                </Link>
              )}
            </div>
          </div>

          {/* Tags */}
          <div>
            <h2 className="mb-3 text-lg font-semibold">Tags</h2>
            {tags.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tags yet.</p>
            ) : (
              <div className="space-y-1">
                {tags.map((t) => (
                  <Link
                    key={t.tag}
                    href={`/tag/${encodeURIComponent(t.tag)}`}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent"
                  >
                    <Hash className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">{t.tag}</span>
                    <span className="text-xs text-muted-foreground">{t.usage_count}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Collections */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Collections</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowCreateCollection(true)}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              New
            </Button>
          </div>

          {showCreateCollection && (
            <div className="mb-3 flex items-center gap-2">
              <Input
                placeholder="Collection name"
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateCollection()}
                autoFocus
                className="max-w-xs"
              />
              <Button size="sm" onClick={handleCreateCollection} disabled={creatingCollection}>
                Create
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setShowCreateCollection(false); setNewCollectionName(""); }}
              >
                Cancel
              </Button>
            </div>
          )}

          {collections.length === 0 && !showCreateCollection ? (
            <p className="text-sm text-muted-foreground">No collections yet.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {collections.map((col) => (
                <Link
                  key={col.id}
                  href={`/collection/${col.id}`}
                  className="group flex items-start gap-3 rounded-lg border p-4 transition-colors hover:bg-accent"
                >
                  <FolderOpen className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-medium">{col.name}</h3>
                    <p className="text-xs text-muted-foreground">{col.video_count} items</p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDeleteCollection(col.id);
                    }}
                    className="shrink-0 rounded p-1 opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
```

**Step 3: Install date-fns if not already present**

Run: `cd frontend && npm ls date-fns 2>/dev/null || npm install date-fns`

**Step 4: Verify the dashboard renders**

Run: `cd frontend && npm run dev`

Navigate to `http://localhost:3000/` — should show the dashboard with all four sections. Click a category → should redirect to `/browse?category=slug`. Click a tag → should redirect to `/browse?tag=name`.

**Step 5: Commit**

```bash
git add frontend/src/app/page.tsx frontend/src/components/DashboardToolbar.tsx
git commit -m "feat: replace flat video grid with knowledge base dashboard"
```

---

### Task 4: Update the Toolbar on Browse Page to Use DashboardToolbar

The browse page currently has no toolbar. Add the `DashboardToolbar` to it for consistent navigation, and also wire up search so it stays on `/browse` with updated params.

**Files:**
- Modify: `frontend/src/app/browse/page.tsx`

**Step 1: Add DashboardToolbar to browse page**

At the top of the browse page's return, add `<DashboardToolbar />` before the `max-w-4xl` container.

Update the return in `browse/page.tsx` — wrap everything in:

```tsx
<div className="min-h-screen bg-background">
  <DashboardToolbar />
  <div className="mx-auto max-w-4xl px-6 py-8">
    {/* existing content */}
  </div>
</div>
```

(This should already be the structure from Task 1, just verify `DashboardToolbar` is imported and used.)

**Step 2: Verify navigation works end-to-end**

- Dashboard `/` → click category → `/browse?category=slug` → back link → `/`
- Dashboard `/` → search → `/browse?q=term`
- Browse page search → navigates to `/browse?q=new-term`

**Step 3: Commit**

```bash
git add frontend/src/app/browse/page.tsx
git commit -m "feat: add consistent toolbar to browse page"
```

---

### Task 5: Rename Video Language Throughout UI

Update user-facing strings from video terminology to knowledge base terminology.

**Files:**
- Modify: `frontend/src/components/DashboardToolbar.tsx` (if needed — already uses "Knowledge Base")
- Modify: `frontend/src/app/browse/page.tsx` (if any "video" strings)
- Modify: `frontend/src/components/ResourceListItem.tsx` (if any "video" strings)
- Modify: `frontend/src/app/video/new/page.tsx` (button text if applicable)
- Modify: any component that shows "Add Video" text visible to users

**Step 1: Audit user-facing "video" strings**

Run: `grep -rn '".*[Vv]ideo.*"' frontend/src/app/ frontend/src/components/ --include='*.tsx' | grep -v node_modules | grep -v '\.test\.'`

Focus only on user-facing strings (button labels, headings, placeholder text), not variable names or type names.

**Step 2: Replace user-facing strings**

Key replacements (only in UI-visible text, not variable names):
- "Add Video" → "Add URL"
- "All Videos" → "All Resources"
- "No videos" → "No resources"
- "video" in delete confirmations → "resource"
- "Channel" labels → "Source" (if prominently displayed)

Do NOT rename:
- TypeScript types/interfaces (`VideoListItem`, etc.)
- API function names (`listVideos`, etc.)
- File names (`VideoCard.tsx` — it's being retired anyway)
- Internal variable names

**Step 3: Verify no broken strings**

Run: `cd frontend && npm run build`

Ensure no build errors.

**Step 4: Commit**

```bash
git add -u frontend/src/
git commit -m "feat: rename video terminology to resource/knowledge base language"
```

---

### Task 6: Clean Up Unused Components

Remove components that are no longer referenced after the dashboard redesign.

**Files:**
- Delete: `frontend/src/components/CollectionsSidebar.tsx`
- Delete: `frontend/src/components/VideoCard.tsx`
- Delete: `frontend/src/components/RecentlyAdded.tsx`
- Delete: `frontend/src/components/ViewToggle.tsx` (if only used by old Toolbar)
- Potentially delete: `frontend/src/components/VideoListItem.tsx` (replaced by `ResourceListItem`)
- Potentially simplify: `frontend/src/components/Toolbar.tsx` (if no longer imported anywhere)

**Step 1: Verify no remaining imports**

Run for each component:
```bash
grep -rn "CollectionsSidebar\|VideoCard\|RecentlyAdded\|ViewToggle\|VideoListItem" frontend/src/ --include='*.tsx' --include='*.ts' | grep -v node_modules | grep "import"
```

Only delete files that have zero remaining imports.

**Step 2: Delete unused files**

```bash
rm frontend/src/components/CollectionsSidebar.tsx
rm frontend/src/components/VideoCard.tsx
rm frontend/src/components/RecentlyAdded.tsx
rm frontend/src/components/VideoListItem.tsx
# Only if ViewToggle has no remaining imports:
rm frontend/src/components/ViewToggle.tsx
# Only if old Toolbar has no remaining imports:
rm frontend/src/components/Toolbar.tsx
```

**Step 3: Verify build passes**

Run: `cd frontend && npm run build`

**Step 4: Commit**

```bash
git add -u frontend/src/
git commit -m "chore: remove unused video grid components"
```

---

### Task 7: Verify Full Flow End-to-End

**Step 1: Start the app**

Run: `cd frontend && npm run dev`

**Step 2: Test dashboard**

- `/` shows dashboard with recently added, categories, tags, collections
- Category counts are accurate
- Tag counts are accurate
- Collection item counts are accurate

**Step 3: Test navigation**

- Click category → `/browse?category=slug` → shows filtered list → back to dashboard
- Click tag → `/browse?tag=name` → shows filtered list
- Click collection → `/browse?collection=id` → shows filtered list
- Click "View all" on recently added → `/browse?sort=created_at_desc`
- Search from dashboard → `/browse?q=term`
- Click resource in list → `/video/[id]` detail page
- `/category/slug` redirects to `/browse?category=slug`
- `/tag/name` redirects to `/browse?tag=name`
- `/collection/id` redirects to `/browse?collection=id`

**Step 4: Test actions on list view**

- Action dropdown: change category works
- Action dropdown: add/remove from collection works
- Action dropdown: delete works (confirmation dialog, item disappears)

**Step 5: Test edge cases**

- Empty category (no items) shows "No items found"
- Dashboard with no categories/tags/collections shows appropriate empty messages
- Search with no results shows empty state
- Create/delete collection from dashboard works

**Step 6: Final commit if any fixes needed**

```bash
git add -u
git commit -m "fix: address issues found during e2e verification"
```
