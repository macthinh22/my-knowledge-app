# Frontend Redesign — "Knowledge Gallery"

## Problem

Current frontend looks generic and AI-generated. Centered max-width layout with no visual identity. Needs a ground-up UI rethink.

## Design Direction

Visual-first, discovery-oriented (Raindrop/Pinterest inspired). Full-width layout with large thumbnails, top toolbar navigation, and a split detail page.

## Tech Stack Changes

- **Add**: shadcn/ui component library
- **Keep**: Next.js 16, React 19, Tailwind CSS v4, existing API client and business logic
- **Replace**: All custom UI components rebuilt with shadcn primitives
- **Drop**: Source Serif 4 font (use DM Sans only), custom CSS variable system (use shadcn's)

## Layout & Navigation

**Top toolbar** (sticky, full-width):
- Left: App name/logo
- Center: Prominent search bar (shadcn Input)
- Right: Filter dropdowns (keyword, channel via shadcn Popover/Command), grid/list view toggle, theme toggle

**Home page**: Full viewport width, comfortable horizontal padding. No max-width container constraining the grid.

**Responsive**: Desktop full layout → Tablet stacked → Mobile single column with collapsed search.

## Card Design

**Grid view**:
- Large 16:9 thumbnail filling card width
- Overlay badges: duration (bottom-right), channel (bottom-left)
- Below: title (2-line clamp), channel name (muted), date
- Bottom: 2-3 keyword badges, "+N more" overflow
- Hover: subtle scale + shadow lift
- No borders — elevation/shadow on light, subtle bg on dark
- CSS Grid: `auto-fill, minmax(280px, 1fr)` for fluid columns

**List view**:
- Compact horizontal: small thumbnail (~160px) + title + channel + date + keywords inline
- One row per video, scannable

## Video Detail Page (Split Layout)

**Left panel (~60%)**:
- Sticky YouTube player (16:9)
- Below: title, channel, date, duration, keyword badges
- Delete button (destructive, de-emphasized)

**Right panel (~40%)**:
- Shadcn Tabs: "Analysis" and "Notes"
- Analysis: 4 markdown sections in shadcn Accordion (collapsible)
- Notes: Full-height editor with auto-save indicator
- Independent scroll from left panel

**Back nav**: "← Back to library" link above the split layout.

**Responsive**: Split → stacked on tablet/mobile.

## Styling & Theme

- shadcn/ui CSS variable theming system
- Single font family: DM Sans (weight/size for hierarchy)
- Dark mode via `class` strategy on `<html>`
- Smooth transitions (150-200ms) on hover/focus
- No flashy animations — professional and snappy

## New Components

- `Toolbar` — sticky top bar with search, filters, toggles
- `ViewToggle` — grid/list switch
- `FilterToolbar` — keyword/channel filter dropdowns

## Rebuilt Components

- `VideoCard` → grid card with thumbnail overlays
- `VideoListItem` → new, compact list row
- `VideoDetail` → tabbed analysis with accordion sections
- `NotesEditor` → shadcn-styled textarea with save indicator
- `DeleteButton` → shadcn Button (destructive variant)
- `SearchBar` → shadcn Input with icon
- `VideoInput` → shadcn Input + Button
- `LoadingState` → shadcn Skeleton components
- `ThemeToggle` → shadcn-compatible, class-based
- `KeywordBadge` → shadcn Badge
