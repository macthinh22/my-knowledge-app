"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, Plus, Sparkles } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";

import { DashboardToolbar } from "@/components/DashboardToolbar";
import { PendingVideoCard } from "@/components/PendingVideoCard";
import { TodayQueueCard } from "@/components/TodayQueueCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useExtraction } from "@/context/extraction";
import {
  listCategories,
  listVideos,
  type Category,
  type VideoListItem,
} from "@/lib/api";
import {
  buildCategoryColorMap,
  categoryLabel,
  getCategoryBadgeClass,
} from "@/lib/categories";
import {
  buildTodayQueues,
  type TodayQueues,
} from "@/lib/todayQueues";

const EMPTY_QUEUES: TodayQueues = {
  inbox: { count: 0, preview: [] },
  neverViewed: { count: 0, preview: [] },
  needsReview: { count: 0, preview: [] },
};

export default function HomePage() {
  const { activeJob } = useExtraction();

  const [categories, setCategories] = useState<Category[]>([]);
  const [recentItems, setRecentItems] = useState<VideoListItem[]>([]);
  const [queues, setQueues] = useState<TodayQueues>(EMPTY_QUEUES);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);

    try {
      const [nextCategories, recentResponse, inboxRes, neverViewedRes, needsReviewRes] =
        await Promise.all([
          listCategories().catch(() => [] as Category[]),
          listVideos({
            sort_by: "created_at",
            sort_order: "desc",
            limit: 5,
          }).catch(() => ({ items: [] as VideoListItem[], total: 0 })),
          listVideos({
            category: "__uncategorized__",
            sort_by: "created_at",
            sort_order: "desc",
            limit: 20,
          }).catch(() => ({ items: [] as VideoListItem[], total: 0 })),
          listVideos({
            review_status: "never_viewed",
            sort_by: "created_at",
            sort_order: "desc",
            limit: 20,
          }).catch(() => ({ items: [] as VideoListItem[], total: 0 })),
          listVideos({
            review_status: "stale",
            sort_by: "created_at",
            sort_order: "desc",
            limit: 20,
          }).catch(() => ({ items: [] as VideoListItem[], total: 0 })),
        ]);

      setCategories(nextCategories);
      setRecentItems(recentResponse.items);
      setQueues(
        buildTodayQueues({
          inbox: inboxRes.items,
          neverViewed: neverViewedRes.items,
          needsReview: needsReviewRes.items,
          previewLimit: 3,
        }),
      );
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

  const categoryColorMap = useMemo(() => buildCategoryColorMap(categories), [categories]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <DashboardToolbar />
        <div className="flex flex-col items-center justify-center gap-3 py-32">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Loading your today workspace...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardToolbar />

      <main className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6">
        <section className="rounded-2xl border bg-gradient-to-r from-amber-100/60 via-background to-blue-100/40 p-5 shadow-sm dark:from-amber-950/20 dark:to-blue-950/20">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Daily Triage
              </p>
              <h1 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">
                Capture and review today&apos;s queue
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Add new URLs fast, then clear inbox and review backlogs.
              </p>
              {activeJob && (
                <p className="mt-2 text-sm font-medium text-amber-700 dark:text-amber-300">
                  Extraction in progress right now.
                </p>
              )}
            </div>

            <Button asChild className="w-full sm:w-auto">
              <Link href="/video/new">
                <Plus className="mr-2 h-4 w-4" />
                Add URL
              </Link>
            </Button>
          </div>

          {activeJob && (
            <div className="mt-4">
              <PendingVideoCard job={activeJob} view="list" />
            </div>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Today Queues
            </h2>
            <Link
              href="/browse"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Manage all
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <TodayQueueCard
              title="Uncategorized"
              count={queues.inbox.count}
              emptyMessage="No uncategorized items."
              href="/browse?category=__uncategorized__"
              items={queues.inbox.preview}
            />
            <TodayQueueCard
              title="Never Viewed"
              count={queues.neverViewed.count}
              emptyMessage="Everything has been viewed at least once."
              href="/browse?review_status=never_viewed"
              items={queues.neverViewed.preview}
            />
            <TodayQueueCard
              title="Needs Review"
              count={queues.needsReview.count}
              emptyMessage="No stale items right now."
              href="/browse?review_status=stale"
              items={queues.needsReview.preview}
            />
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Recently Added
              </h2>
            </div>
            <Link
              href="/browse?sort=created_at_desc"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Open browse
              <ArrowRight className="h-3.5 w-3.5" />
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
              {recentItems.map((item) => (
                <Link
                  key={item.id}
                  href={`/video/${item.id}`}
                  className="flex min-w-0 items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/60"
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {item.title ?? "Untitled"}
                  </span>

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
      </main>
    </div>
  );
}
