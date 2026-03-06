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
  isFavourite?: boolean;
  sort: SortOption;
};

export function parseBrowseFilters(params: URLSearchParams): BrowseFilterState {
  return {
    search: params.get("q") ?? undefined,
    category: params.get("category") ?? undefined,
    tag: params.get("tag") ?? undefined,
    collectionId: params.get("collection") ?? undefined,
    reviewStatus: params.get("review_status") ?? undefined,
    isFavourite: params.get("is_favourite") === "true" ? true : undefined,
    sort: (params.get("sort") as SortOption | null) ?? "created_at_desc",
  };
}

export function applyQuickFilter(
  current: BrowseFilterState,
  quick: QuickFilter,
): BrowseFilterState {
  if (quick === "inbox") {
    return {
      ...current,
      category: "__uncategorized__",
      tag: undefined,
      collectionId: undefined,
      reviewStatus: undefined,
    };
  }

  if (quick === "needs_review") {
    return {
      ...current,
      category: undefined,
      tag: undefined,
      collectionId: undefined,
      reviewStatus: "stale",
    };
  }

  if (quick === "never_viewed") {
    return {
      ...current,
      category: undefined,
      tag: undefined,
      collectionId: undefined,
      reviewStatus: "never_viewed",
    };
  }

  return {
    ...current,
    category: undefined,
    tag: undefined,
    collectionId: undefined,
    reviewStatus: undefined,
    sort: "duration_desc",
  };
}

export function buildBrowseSearchParams(
  state: BrowseFilterState,
): URLSearchParams {
  const params = new URLSearchParams();

  if (state.search) {
    params.set("q", state.search);
  }

  if (state.category) {
    params.set("category", state.category);
  }

  if (state.tag) {
    params.set("tag", state.tag);
  }

  if (state.collectionId) {
    params.set("collection", state.collectionId);
  }

  if (state.reviewStatus) {
    params.set("review_status", state.reviewStatus);
  }

  if (state.isFavourite) {
    params.set("is_favourite", "true");
  }

  params.set("sort", state.sort);
  return params;
}
