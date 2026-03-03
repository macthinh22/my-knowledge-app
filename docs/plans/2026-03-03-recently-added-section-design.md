# Recently Added Section — Design

## Summary

Add a horizontal scrollable row of the 10 most recently added videos above the main library grid on the home page. Hidden when search/filter/collection is active.

## Approach

Separate API call (`GET /api/videos?sort_by=created_at&order=desc&limit=10`) independent of the library's paginated query. No backend changes needed.

## Components

### `RecentlyAdded.tsx` (new)
- Fetches 10 newest videos on mount via `fetchVideos()`
- Renders section heading + horizontal scrollable row of `VideoCard`
- Loading skeleton while fetching
- Not rendered when 0 videos or fetch fails

### `page.tsx` (modified)
- Renders `<RecentlyAdded />` above library grid
- Hides the section when any filter/search/collection is active
- Passes delete callback for invalidation

## Layout

```
┌─────────────────────────────────────────────────┐
│ Toolbar (search, sort, filters)                 │
├─────────────────────────────────────────────────┤
│ Recently Added                                  │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐  │
│ │ Card │ │ Card │ │ Card │ │ Card │ │ Card │ ► │
│ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘  │
├─────────────────────────────────────────────────┤
│ Library (existing grid/list view)               │
└─────────────────────────────────────────────────┘
```

## Behavior

- Fixed count: always 10 most recent
- Hidden when any search, tag filter, category filter, or collection is active
- Silent fail on fetch error
- Delete from row triggers refetch
