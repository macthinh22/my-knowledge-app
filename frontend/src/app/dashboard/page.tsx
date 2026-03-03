"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  Eye,
  EyeOff,
  FolderOpen,
  Plus,
  Tag,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getDashboard, listCategories, type Category, type DashboardStats } from "@/lib/api";
import { cn } from "@/lib/utils";

function StatCard({
  label,
  value,
  icon: Icon,
  href,
  accent,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  href?: string;
  accent?: string;
}) {
  const content = (
    <div
      className={cn(
        "rounded-lg border p-5 transition-colors",
        href && "hover:bg-accent/50 cursor-pointer",
      )}
    >
      <div className="flex items-center justify-between">
        <Icon className={cn("h-5 w-5 text-muted-foreground", accent)} />
        {href && (
          <span className="text-xs text-muted-foreground">View &rarr;</span>
        )}
      </div>
      <p className="mt-3 text-3xl font-bold tracking-tight">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}

function CategoryBar({
  label,
  count,
  max,
}: {
  label: string;
  count: number;
  max: number;
}) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="truncate font-medium">{label}</span>
        <span className="text-muted-foreground">{count}</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getDashboard(), listCategories()])
      .then(([s, c]) => {
        setStats(s);
        setCategories(c);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const catNameMap = Object.fromEntries(
    categories.map((c) => [c.slug, c.name]),
  );
  const maxCategoryCount = stats
    ? Math.max(...Object.values(stats.videos_by_category), 1)
    : 1;

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <Skeleton className="h-64 rounded-lg" />
          <Skeleton className="h-64 rounded-lg" />
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Failed to load dashboard.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-lg font-semibold">Knowledge Dashboard</h1>
        </div>
        <Button asChild size="sm">
          <Link href="/video/new">
            <Plus className="mr-2 h-4 w-4" />
            Add Video
          </Link>
        </Button>
      </header>

      <main className="px-6 py-6 space-y-8 max-w-6xl mx-auto">
        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Total videos"
            value={stats.total_videos}
            icon={BookOpen}
            href="/"
          />
          <StatCard
            label="Collections"
            value={stats.total_collections}
            icon={FolderOpen}
          />
          <StatCard
            label="Never viewed"
            value={stats.never_viewed_count}
            icon={EyeOff}
            href="/?review_status=never_viewed"
            accent="text-amber-500"
          />
          <StatCard
            label="Added this week"
            value={stats.recent_additions}
            icon={TrendingUp}
            accent="text-green-500"
          />
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Category breakdown */}
          <div className="rounded-lg border p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">
              Videos by Category
            </h2>
            <div className="space-y-3">
              {Object.entries(stats.videos_by_category)
                .sort(([, a], [, b]) => b - a)
                .map(([slug, count]) => (
                  <CategoryBar
                    key={slug}
                    label={catNameMap[slug] ?? slug}
                    count={count}
                    max={maxCategoryCount}
                  />
                ))}
              {Object.keys(stats.videos_by_category).length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No categorized videos yet.
                </p>
              )}
            </div>
          </div>

          {/* Top tags */}
          <div className="rounded-lg border p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">
              Top Tags
            </h2>
            <div className="flex flex-wrap gap-2">
              {stats.top_tags.map((t) => (
                <Badge key={t.tag} variant="secondary" className="gap-1.5 py-1">
                  <Tag className="h-3 w-3" />
                  {t.tag}
                  <span className="text-muted-foreground">
                    {t.usage_count}
                  </span>
                </Badge>
              ))}
              {stats.top_tags.length === 0 && (
                <p className="text-sm text-muted-foreground">No tags yet.</p>
              )}
            </div>
          </div>
        </div>

        {/* Review overview */}
        <div className="rounded-lg border p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">
            Review Status
          </h2>
          <div className="grid grid-cols-3 gap-4">
            <Link
              href="/?review_status=never_viewed"
              className="rounded-md border p-4 text-center hover:bg-accent/50 transition-colors"
            >
              <EyeOff className="mx-auto h-5 w-5 text-amber-500 mb-2" />
              <p className="text-2xl font-bold">{stats.never_viewed_count}</p>
              <p className="text-xs text-muted-foreground">Never viewed</p>
            </Link>
            <Link
              href="/?review_status=stale"
              className="rounded-md border p-4 text-center hover:bg-accent/50 transition-colors"
            >
              <Eye className="mx-auto h-5 w-5 text-orange-500 mb-2" />
              <p className="text-2xl font-bold">{stats.stale_count}</p>
              <p className="text-xs text-muted-foreground">Needs review</p>
            </Link>
            <div className="rounded-md border p-4 text-center">
              <BookOpen className="mx-auto h-5 w-5 text-green-500 mb-2" />
              <p className="text-2xl font-bold">
                {stats.total_videos - stats.never_viewed_count}
              </p>
              <p className="text-xs text-muted-foreground">Viewed at least once</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
