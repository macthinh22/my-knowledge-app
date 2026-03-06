# Daily Operator Workflow Design

## Context

Current frontend design works functionally, but everyday operation is split across multiple centers of gravity:

- `/` behaves like a dashboard + listing teaser.
- `/dashboard` behaves like a second dashboard with different emphasis.
- `/browse` is where item management actually happens.

This causes context switching and weakens day-to-day flow for capture, triage, and organization.

## Goal

Create an everyday-first UX where the app supports a clear recurring loop:

1. Capture new URLs quickly.
2. Triage high-priority backlog.
3. Organize items with low friction.
4. Review long-term trends only when needed.

## Non-Goals

- No backend schema changes in this phase.
- No major visual rebrand.
- No AI behavior changes.

## Live App Findings (Validation)

Validated by running app flows in browser and checking behavior:

- Home and dashboard overlap in purpose, making navigation ambiguous.
- Dashboard links using `review_status` route to home but do not create a clear review workspace.
- Home has horizontal overflow on mobile due to top stats layout.
- Browse briefly renders `0 items` before data settles, which is misleading.
- Category management table is functional but difficult to use on small screens.

## Information Architecture

### Route Roles

- `/` = **Today Workspace** (action-first, triage-first)
- `/browse` = **Primary Management Surface**
- `/dashboard` = **Secondary Analytics Surface**
- `/categories` = taxonomy administration

### Core Principle

Each route has one job. Avoid duplicating management and analytics intent across pages.

## Home (`/`) - Today Workspace

### Structure (top to bottom)

1. Quick Capture bar (`Add URL` input + extract action)
2. Active extraction / pending jobs block
3. Priority queues:
   - Uncategorized
   - Never Viewed
   - Needs Review
4. Compact Recently Added list

### Queue Card Behavior

Each queue card shows:

- total count
- top 3 items
- one-click actions: `Set category`, `Add to collection`, `Open`
- deep link to full filtered browse result

### What Moves Off Home

- full category browsing
- full top tags section
- non-urgent overview blocks

These move to `/browse` or remain in `/dashboard`.

### Mobile Rule

Use stacked cards and avoid horizontal metric rows to prevent overflow.

## Browse (`/browse`) - Management Surface

### Primary Responsibilities

- search
- sorting
- filtering by category/review/tag
- item actions
- (future) batch triage

### Interaction Design

- Sticky filter bar with search + sort + category + review status.
- Quick saved filters: Inbox, Needs Review, No Category, Long Videos.
- Row actions always discoverable (not hover-only), including on touch.
- Metadata hierarchy:
  - primary: title, source
  - secondary: category, top tags
  - tertiary: duration, age

### Batch Operations (Phase 2-ready)

- multi-select rows
- batch set category
- batch add to collection
- batch review-state update

## Dashboard (`/dashboard`) - Analytics Only

### Purpose

Weekly/monthly insight, not daily operations.

### Focus Blocks

- added this week
- reviewed this week
- uncategorized drift
- category and tag distribution trends

### Design Constraint

No primary task actions should depend on visiting `/dashboard`.

## Data Flow

- Home queues and browse filters share the same filter vocabulary and URL semantics.
- Review-status links should always resolve to filtered browse views.
- Dashboard consumes aggregate/stat APIs only.

## Loading and Error Handling

- Never render misleading terminal states during initial loading (`0 items` flicker).
- Use queue/list skeletons while data is unresolved.
- Show explicit fallback states with retry for failed queue loads.

## Accessibility and UX Quality Bar

- Icon-only controls must have labels/tooltips.
- Touch-first parity: actions visible without hover dependency.
- Keyboard support target:
  - `/` focuses search
  - list keyboard navigation is preserved

## Testing Strategy

### Functional

- Add URL -> item appears in Inbox queue.
- Categorize from queue -> item exits Uncategorized queue.
- Review links navigate to correct filtered browse state.

### Responsive

- Validate `/` and `/browse` at 390px width.
- Confirm no horizontal overflow in primary daily pages.

### Regression

- Ensure existing item detail and category management flows remain intact.

## Rollout Approach

1. Reframe `/` as Today workspace (layout + queue actions).
2. Harden `/browse` as the management surface.
3. Reduce `/dashboard` to analytics-only emphasis.
4. Polish mobile/accessibility and remove interaction inconsistencies.

## Success Metrics

- Fewer clicks to categorize uncategorized items.
- Faster path from capture to organized state.
- Reduced navigation switching between `/`, `/browse`, and `/dashboard` for daily work.
- No mobile overflow on core screens.
