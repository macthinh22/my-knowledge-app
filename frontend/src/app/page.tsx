"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  FolderOpen,
  Hash,
  Layers,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { DashboardToolbar } from "@/components/DashboardToolbar";
import { PendingVideoCard } from "@/components/PendingVideoCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useExtraction } from "@/context/extraction";
import {
  createCollection,
  deleteCollection,
  listCategories,
  listCollections,
  listTags,
  listVideos,
  type Category,
  type CollectionItem,
  type TagSummary,
  type VideoListItem,
} from "@/lib/api";
import {
  buildCategoryColorMap,
  categoryLabel,
  getCategoryBadgeClass,
} from "@/lib/categories";

const CATEGORY_TINTS: Record<
  string,
  { card: string; icon: string; dot: string }
> = {
  slate: {
    card: "from-slate-500/8 to-transparent border-l-slate-400 hover:from-slate-500/12",
    icon: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    dot: "bg-slate-400",
  },
  red: {
    card: "from-red-500/8 to-transparent border-l-red-400 hover:from-red-500/12",
    icon: "bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300",
    dot: "bg-red-400",
  },
  orange: {
    card: "from-orange-500/8 to-transparent border-l-orange-400 hover:from-orange-500/12",
    icon: "bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-300",
    dot: "bg-orange-400",
  },
  amber: {
    card: "from-amber-500/8 to-transparent border-l-amber-400 hover:from-amber-500/12",
    icon: "bg-amber-100 text-amber-600 dark:bg-amber-900 dark:text-amber-300",
    dot: "bg-amber-400",
  },
  emerald: {
    card: "from-emerald-500/8 to-transparent border-l-emerald-400 hover:from-emerald-500/12",
    icon: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900 dark:text-emerald-300",
    dot: "bg-emerald-400",
  },
  teal: {
    card: "from-teal-500/8 to-transparent border-l-teal-400 hover:from-teal-500/12",
    icon: "bg-teal-100 text-teal-600 dark:bg-teal-900 dark:text-teal-300",
    dot: "bg-teal-400",
  },
  blue: {
    card: "from-blue-500/8 to-transparent border-l-blue-400 hover:from-blue-500/12",
    icon: "bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300",
    dot: "bg-blue-400",
  },
  indigo: {
    card: "from-indigo-500/8 to-transparent border-l-indigo-400 hover:from-indigo-500/12",
    icon: "bg-indigo-100 text-indigo-600 dark:bg-indigo-900 dark:text-indigo-300",
    dot: "bg-indigo-400",
  },
  violet: {
    card: "from-violet-500/8 to-transparent border-l-violet-400 hover:from-violet-500/12",
    icon: "bg-violet-100 text-violet-600 dark:bg-violet-900 dark:text-violet-300",
    dot: "bg-violet-400",
  },
  rose: {
    card: "from-rose-500/8 to-transparent border-l-rose-400 hover:from-rose-500/12",
    icon: "bg-rose-100 text-rose-600 dark:bg-rose-900 dark:text-rose-300",
    dot: "bg-rose-400",
  },
};

function getCategoryTint(color: string | null) {
  return (
    CATEGORY_TINTS[color ?? "slate"] ?? CATEGORY_TINTS.slate
  );
}

const MAX_DASHBOARD_TAGS = 8;

export default function HomePage() {
  const { activeJob } = useExtraction();

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>(
    {},
  );
  const [tags, setTags] = useState<TagSummary[]>([]);
  const [collections, setCollections] = useState<CollectionItem[]>([]);
  const [recentItems, setRecentItems] = useState<VideoListItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);

  const [showCreateCollection, setShowCreateCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [creatingCollection, setCreatingCollection] = useState(false);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);

    try {
      const [nextCategories, nextTags, nextCollections, recentResponse] =
        await Promise.all([
          listCategories().catch(() => [] as Category[]),
          listTags({ limit: 20 }).catch(() => [] as TagSummary[]),
          listCollections().catch(() => [] as CollectionItem[]),
          listVideos({
            sort_by: "created_at",
            sort_order: "desc",
            limit: 5,
          }).catch(() => ({ items: [] as VideoListItem[], total: 0 })),
        ]);

      setCategories(nextCategories);
      setTags(nextTags);
      setCollections(nextCollections);
      setRecentItems(recentResponse.items);
      setTotalItems(recentResponse.total);

      const counts: Record<string, number> = {};

      await Promise.all(
        nextCategories.map(async (category) => {
          try {
            const response = await listVideos({
              category: category.slug,
              limit: 1,
            });
            counts[category.slug] = response.total;
          } catch {
            counts[category.slug] = 0;
          }
        }),
      );

      try {
        const allResponse = await listVideos({ limit: 1 });
        const categorizedTotal = Object.values(counts).reduce(
          (accumulator, count) => accumulator + count,
          0,
        );
        counts.__uncategorized = Math.max(
          allResponse.total - categorizedTotal,
          0,
        );
      } catch {}

      setCategoryCounts(counts);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchDashboardData();
  }, [fetchDashboardData]);

  const categoryNameMap = useMemo(
    () =>
      Object.fromEntries(
        categories.map((category) => [category.slug, category.name]),
      ),
    [categories],
  );

  const categoryColorMap = useMemo(
    () => buildCategoryColorMap(categories),
    [categories],
  );

  const topTags = useMemo(
    () =>
      [...tags]
        .sort((a, b) => b.usage_count - a.usage_count)
        .slice(0, MAX_DASHBOARD_TAGS),
    [tags],
  );

  const handleCreateCollection = async () => {
    const name = newCollectionName.trim();
    if (!name) return;

    setCreatingCollection(true);

    try {
      await createCollection(name);
      setNewCollectionName("");
      setShowCreateCollection(false);
      const nextCollections = await listCollections();
      setCollections(nextCollections);
    } finally {
      setCreatingCollection(false);
    }
  };

  const handleDeleteCollection = async (id: string) => {
    await deleteCollection(id);
    setCollections((previous) =>
      previous.filter((collection) => collection.id !== id),
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <DashboardToolbar />
        <div className="flex flex-col items-center justify-center gap-3 py-32">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Loading your knowledge base…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardToolbar />

      <main className="mx-auto max-w-5xl px-6 py-10">
        {/* Hero stats */}
        <div className="mb-10 flex items-center gap-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/40">
              <BookOpen className="h-5 w-5 text-amber-700 dark:text-amber-300" />
            </div>
            <div>
              <p className="text-2xl font-semibold tracking-tight">
                {totalItems}
              </p>
              <p className="text-xs text-muted-foreground">Resources</p>
            </div>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/40">
              <Layers className="h-5 w-5 text-blue-700 dark:text-blue-300" />
            </div>
            <div>
              <p className="text-2xl font-semibold tracking-tight">
                {categories.length}
              </p>
              <p className="text-xs text-muted-foreground">Categories</p>
            </div>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/40">
              <Hash className="h-5 w-5 text-violet-700 dark:text-violet-300" />
            </div>
            <div>
              <p className="text-2xl font-semibold tracking-tight">
                {tags.length}
              </p>
              <p className="text-xs text-muted-foreground">Tags</p>
            </div>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/40">
              <FolderOpen className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />
            </div>
            <div>
              <p className="text-2xl font-semibold tracking-tight">
                {collections.length}
              </p>
              <p className="text-xs text-muted-foreground">Collections</p>
            </div>
          </div>
        </div>

        {activeJob && (
          <section className="mb-8">
            <PendingVideoCard job={activeJob} />
          </section>
        )}

        {/* Recently Added */}
        <section
          className="mb-10 animate-in fade-in slide-in-from-bottom-3 duration-500 fill-mode-both"
          style={{ animationDelay: "100ms" }}
        >
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Recently Added
              </h2>
            </div>
            <Link
              href="/browse?sort=created_at_desc"
              className="group flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              View all
              <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>

          {recentItems.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-8 text-center">
              <p className="text-sm text-muted-foreground">
                No resources yet. Add your first URL to get started.
              </p>
            </div>
          ) : (
            <div className="divide-y rounded-2xl border bg-card shadow-sm">
              {recentItems.map((item, index) => (
                <Link
                  key={item.id}
                  href={`/video/${item.id}`}
                  className="flex items-center gap-4 px-5 py-3.5 transition-colors first:rounded-t-2xl last:rounded-b-2xl hover:bg-accent/60"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100/60 text-xs font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                    {index + 1}
                  </div>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {item.title ?? "Untitled"}
                  </span>

                  {item.channel_name && (
                    <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                      {item.channel_name}
                    </span>
                  )}

                  {item.category && (
                    <Badge
                      variant="outline"
                      className={`hidden shrink-0 px-1.5 py-0 text-[10px] sm:inline-flex ${getCategoryBadgeClass(categoryColorMap[item.category])}`}
                    >
                      {categoryLabel(item.category, categoryNameMap)}
                    </Badge>
                  )}

                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDistanceToNowStrict(new Date(item.created_at), {
                      addSuffix: true,
                    })}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Categories */}
        <section
          className="mb-10 animate-in fade-in slide-in-from-bottom-3 duration-500 fill-mode-both"
          style={{ animationDelay: "200ms" }}
        >
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Categories
          </h2>

          {categories.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-8 text-center">
              <p className="text-sm text-muted-foreground">
                No categories yet.{" "}
                <Link
                  href="/categories"
                  className="underline hover:text-foreground"
                >
                  Create one
                </Link>
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {categories.map((category) => {
                const count = categoryCounts[category.slug] ?? 0;
                const tint = getCategoryTint(category.color);

                return (
                  <Link
                    key={category.id}
                    href={`/category/${category.slug}`}
                    className={`group relative overflow-hidden rounded-2xl border-l-4 bg-gradient-to-r p-5 transition-all hover:shadow-md hover:-translate-y-0.5 ${tint.card}`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tint.icon}`}
                      >
                        <Layers className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold">
                          {category.name}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {count} {count === 1 ? "resource" : "resources"}
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-0.5" />
                    </div>
                  </Link>
                );
              })}

              {(categoryCounts.__uncategorized ?? 0) > 0 && (
                <Link
                  href="/browse"
                  className="group relative overflow-hidden rounded-2xl border border-dashed p-5 transition-all hover:shadow-md hover:-translate-y-0.5"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted">
                      <Layers className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-medium text-muted-foreground">
                        Uncategorized
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {categoryCounts.__uncategorized} resources
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-0.5" />
                  </div>
                </Link>
              )}
            </div>
          )}
        </section>

        {/* Tags + Collections side by side */}
        <div
          className="grid gap-8 md:grid-cols-2 animate-in fade-in slide-in-from-bottom-3 duration-500 fill-mode-both"
          style={{ animationDelay: "300ms" }}
        >
          {/* Tags — compact cloud, top items only */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Popular Tags
              </h2>
              {tags.length > MAX_DASHBOARD_TAGS && (
                <Link
                  href="/browse"
                  className="group flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  All {tags.length} tags
                  <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                </Link>
              )}
            </div>

            {topTags.length === 0 ? (
              <div className="rounded-2xl border border-dashed p-8 text-center">
                <p className="text-sm text-muted-foreground">No tags yet.</p>
              </div>
            ) : (
              <div className="rounded-2xl border bg-card p-4 shadow-sm">
                <div className="flex flex-wrap gap-2">
                  {topTags.map((tag) => (
                    <Link
                      key={tag.tag}
                      href={`/tag/${encodeURIComponent(tag.tag)}`}
                      className="group inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1.5 text-sm transition-all hover:border-violet-300 hover:bg-violet-50 hover:shadow-sm dark:hover:border-violet-700 dark:hover:bg-violet-900/20"
                    >
                      <Hash className="h-3 w-3 text-violet-400 transition-colors group-hover:text-violet-600 dark:group-hover:text-violet-300" />
                      <span className="font-medium">{tag.tag}</span>
                      <span className="text-xs text-muted-foreground">
                        {tag.usage_count}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Collections */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Collections
              </h2>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setShowCreateCollection(true)}
              >
                <Plus className="mr-1 h-3 w-3" />
                New
              </Button>
            </div>

            {showCreateCollection && (
              <div className="mb-3 flex items-center gap-2">
                <Input
                  placeholder="Collection name"
                  value={newCollectionName}
                  onChange={(event) => setNewCollectionName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void handleCreateCollection();
                  }}
                  autoFocus
                  className="h-8 max-w-xs text-sm"
                />
                <Button
                  size="sm"
                  className="h-8"
                  onClick={() => void handleCreateCollection()}
                  disabled={creatingCollection}
                >
                  Create
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8"
                  onClick={() => {
                    setShowCreateCollection(false);
                    setNewCollectionName("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            )}

            {collections.length === 0 && !showCreateCollection ? (
              <div className="rounded-2xl border border-dashed p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  No collections yet.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {collections.map((collection) => (
                  <Link
                    key={collection.id}
                    href={`/collection/${collection.id}`}
                    className="group flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
                      <FolderOpen className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-medium">{collection.name}</h3>
                      <p className="text-xs text-muted-foreground">
                        {collection.video_count}{" "}
                        {collection.video_count === 1 ? "item" : "items"}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        void handleDeleteCollection(collection.id);
                      }}
                      className="shrink-0 rounded-lg p-1.5 opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
