# Knowledge Base Dashboard Redesign

## Problem

The home page is a flat grid of thumbnail cards with play button overlays, duration badges, and channel names — structurally identical to YouTube. The app is a knowledge base, not a video platform. The entire mental model needs to shift from "browse media" to "navigate knowledge."

## Design Direction

Dashboard-first, text-oriented, structure-driven. The home page becomes an overview/orientation page. Browsing content happens through category, tag, and collection list views — all text-first with no thumbnails.

## Dashboard Home Page (`/`)

Four sections, vertically scrolled, no sidebar:

**Toolbar** (simplified):
- Logo + "Knowledge Base"
- Search bar (searches all items, navigates to `/browse?q=...`)
- Theme toggle, Categories management link, Dashboard analytics link
- Removed: sort dropdown, view toggle, category filter pills, review status pills

**Section 1 — Recently Added**:
- Compact list of 5 most recently added items
- Each row: title, source, category badge, relative date
- Text-first, no thumbnails
- "View all" link → `/browse?sort=created_at_desc`

**Section 2 — Categories + Tags** (two columns side by side):
- Left column: category list with color dot, name, item count. Click → `/category/[slug]`
- Right column: top tags (limit ~15-20) with usage count. Click → `/tag/[tag-name]`

**Section 3 — Collections**:
- Grid of collection cards (folder icon, name, item count)
- Click → `/collection/[id]`
- Inline "Create collection" button

## List View Page

Shared page for browsing items, reached from any dashboard link.

**Routes**:
- `/browse` — all items (search results, "view all")
- `/category/[slug]` — items in a category
- `/tag/[tag]` — items with a specific tag
- `/collection/[id]` — items in a collection

**Layout**:
- Back link to dashboard
- Page title with item count (e.g., "Machine Learning (12 items)")
- Sort control (newest/oldest/title A-Z/duration) + tag filter dropdown
- Compact list rows, infinite scroll

**List row**:
- Title (bold, primary)
- Source/channel (muted)
- Category badge (shown when not already inside a category view)
- Tag pills (2-3 visible, +N overflow)
- Relative date
- Duration (small, muted)
- Action dropdown on hover (change category, manage collections, delete)
- No thumbnails. Click row → `/video/[id]`

## What Changes

**New**:
- Dashboard home page (replaces current `page.tsx`)
- List view page (new shared route)
- New routes: `/browse`, `/category/[slug]`, `/tag/[tag]`, `/collection/[id]`

**Removed**:
- `CollectionsSidebar` component (no persistent sidebar)
- `VideoCard` component (no thumbnail grid)
- `RecentlyAdded` horizontal carousel (replaced by compact text list)
- Toolbar row 2 (category pills, review status pills)
- Grid/list view toggle (list is the only browse view)

**Kept as-is**:
- Video detail page (`/video/[id]`)
- Categories management page (`/categories`)
- Dashboard analytics page (`/dashboard`)
- `VideoActionDropdown` (reused in list rows)
- `KeywordChips` (reused in list rows)
- All backend APIs

**Renamed language**:
- "Videos" → "Items" or "Resources"
- "Add Video" → "Add URL"
- "Channel" → "Source"

## Data Flow

**Dashboard data**:
- `listCategories()` — existing
- `listTags({ limit: 20 })` — existing
- `listCollections()` — existing
- `listVideos({ sort: "created_at_desc", limit: 5 })` — existing, for recently added
- Category item counts: use `listVideos` per category and read pagination total, or add a backend counts endpoint

**List view data**:
- Reuse `usePaginatedVideos` hook with filter params
- Hook already supports category and keyword filters
- Collection filtering: fetch `getCollection(id)` for video IDs, then filter

## Tech

- Next.js 16 app router for new routes
- shadcn/ui components (already in use)
- No backend changes required (may optionally add category counts endpoint)
