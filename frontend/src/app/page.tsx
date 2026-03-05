"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  FolderOpen,
  Hash,
  Loader2,
  Plus,
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

export default function HomePage() {
  const { activeJob } = useExtraction();

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [tags, setTags] = useState<TagSummary[]>([]);
  const [collections, setCollections] = useState<CollectionItem[]>([]);
  const [recentItems, setRecentItems] = useState<VideoListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreateCollection, setShowCreateCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [creatingCollection, setCreatingCollection] = useState(false);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);

    try {
      const [nextCategories, nextTags, nextCollections, nextRecentItems] =
        await Promise.all([
          listCategories().catch(() => [] as Category[]),
          listTags({ limit: 20 }).catch(() => [] as TagSummary[]),
          listCollections().catch(() => [] as CollectionItem[]),
          listVideos({ sort_by: "created_at", sort_order: "desc", limit: 5 })
            .then((response) => response.items)
            .catch(() => [] as VideoListItem[]),
        ]);

      setCategories(nextCategories);
      setTags(nextTags);
      setCollections(nextCollections);
      setRecentItems(nextRecentItems);

      const counts: Record<string, number> = {};

      await Promise.all(
        nextCategories.map(async (category) => {
          try {
            const response = await listVideos({ category: category.slug, limit: 1 });
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
        counts.__uncategorized = Math.max(allResponse.total - categorizedTotal, 0);
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
    () => Object.fromEntries(categories.map((category) => [category.slug, category.name])),
    [categories],
  );

  const categoryColorMap = useMemo(
    () => buildCategoryColorMap(categories),
    [categories],
  );

  const handleCreateCollection = async () => {
    const name = newCollectionName.trim();
    if (!name) {
      return;
    }

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
    setCollections((previous) => previous.filter((collection) => collection.id !== id));
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

      <main className="mx-auto max-w-4xl space-y-10 px-6 py-8">
        {activeJob && (
          <section>
            <PendingVideoCard job={activeJob} />
          </section>
        )}

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
                      className={`shrink-0 px-1.5 py-0 text-[10px] ${getCategoryBadgeClass(categoryColorMap[item.category])}`}
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

        <section className="grid gap-8 md:grid-cols-2">
          <div>
            <h2 className="mb-3 text-lg font-semibold">Categories</h2>
            <div className="space-y-1">
              {categories.length === 0 ? (
                <p className="text-sm text-muted-foreground">No categories yet.</p>
              ) : (
                categories.map((category) => (
                  <Link
                    key={category.id}
                    href={`/category/${category.slug}`}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent"
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{
                        backgroundColor: `var(--color-${category.color ?? "slate"}-500, var(--color-slate-500))`,
                      }}
                    />
                    <span className="min-w-0 flex-1">{category.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {categoryCounts[category.slug] ?? 0}
                    </span>
                  </Link>
                ))
              )}

              {(categoryCounts.__uncategorized ?? 0) > 0 && (
                <Link
                  href="/browse"
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent"
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-muted-foreground/30" />
                  <span className="min-w-0 flex-1">Uncategorized</span>
                  <span className="text-xs">{categoryCounts.__uncategorized}</span>
                </Link>
              )}
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-lg font-semibold">Tags</h2>
            {tags.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tags yet.</p>
            ) : (
              <div className="space-y-1">
                {tags.map((tag) => (
                  <Link
                    key={tag.tag}
                    href={`/tag/${encodeURIComponent(tag.tag)}`}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent"
                  >
                    <Hash className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">{tag.tag}</span>
                    <span className="text-xs text-muted-foreground">{tag.usage_count}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>

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
                onChange={(event) => setNewCollectionName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void handleCreateCollection();
                  }
                }}
                autoFocus
                className="max-w-xs"
              />
              <Button
                size="sm"
                onClick={() => void handleCreateCollection()}
                disabled={creatingCollection}
              >
                Create
              </Button>
              <Button
                size="sm"
                variant="ghost"
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
            <p className="text-sm text-muted-foreground">No collections yet.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {collections.map((collection) => (
                <Link
                  key={collection.id}
                  href={`/collection/${collection.id}`}
                  className="group flex items-start gap-3 rounded-lg border p-4 transition-colors hover:bg-accent"
                >
                  <FolderOpen className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-medium">{collection.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {collection.video_count} items
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      void handleDeleteCollection(collection.id);
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
