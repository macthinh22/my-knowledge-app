export type SortOption =
  `${"created_at" | "title" | "duration" | "channel_name"}_${"asc" | "desc"}`;

export type QuickFilter =
  | "inbox"
  | "needs_review"
  | "never_viewed"
  | "long_videos";

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
  if (quick === "inbox") {
    return { ...current, category: "__uncategorized__" };
  }

  if (quick === "needs_review") {
    return { ...current, reviewStatus: "stale" };
  }

  if (quick === "never_viewed") {
    return { ...current, reviewStatus: "never_viewed" };
  }

  return { ...current, sort: "duration_desc" };
}
