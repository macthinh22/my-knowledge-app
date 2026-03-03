# Library Action Dropdown Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current collection-only inline control with a unified top-right kebab action dropdown on each video card/row, supporting delete video, category selection, collection selection, and an extensible "More" section.

**Architecture:** Use one shared action-menu component rendered in both grid and list items. Keep library-level state for categories, collections, and video-collection membership so menu actions update the UI immediately after API calls. Reuse existing delete confirmation behavior and existing backend APIs.

**Tech Stack:** Next.js App Router, React hooks/state, shadcn/radix dropdown-menu + submenus, existing frontend API client and delete flow.

---

### UX Contract (Approved)

- Trigger placement: top-right kebab on each video item (grid card and list row).
- Menu structure:
  - `Category >` submenu (single choice + `No category`)
  - `Collections >` submenu (multi-select checkboxes)
  - separator
  - `Delete video` (opens confirm dialog)
  - `More` placeholder/submenu for upcoming features
- Delete behavior: confirmation required.
- Interaction rule: menu interactions must never navigate to video detail.

---

### Task 1: Build unified per-video action menu component

**Files:**
- Create: `frontend/src/components/VideoActionDropdown.tsx`

**Step 1: Define props and action callbacks**

```ts
type VideoActionDropdownProps = {
  categories: Category[];
  currentCategory: string | null;
  collections: CollectionItem[];
  selectedCollectionIds: Set<string>;
  onCategoryChange: (category: string | null) => Promise<void>;
  onCollectionToggle: (collectionId: string, checked: boolean) => Promise<void>;
  onDelete: () => void;
  disabled?: boolean;
};
```

**Step 2: Implement hierarchical menu UI**

Use `DropdownMenuSub` for `Category` and `Collections`.

**Step 3: Add `More` placeholder section**

Render as disabled item/submenu for now to lock future information architecture.

**Step 4: Guard navigation side-effects**

Stop propagation on trigger and menu item selection so card/list links do not open.

---

### Task 2: Integrate dropdown trigger into card and list layouts

**Files:**
- Modify: `frontend/src/components/VideoCard.tsx`
- Modify: `frontend/src/components/VideoListItem.tsx`

**Step 1: Replace inline collection control usage**

Swap current collection-only control with new unified action dropdown.

**Step 2: Position trigger correctly**

Grid: top-right overlay area. List: far-right action slot.

**Step 3: Keep core row/card click-through behavior**

Main surface still navigates to video detail; only dropdown interactions are isolated.

---

### Task 3: Extend Home page state and handlers for all menu actions

**Files:**
- Modify: `frontend/src/app/page.tsx`
- Modify: `frontend/src/components/CollectionsSidebar.tsx`
- Modify: `frontend/src/lib/api.ts` (only if required for missing API helper typing)

**Step 1: Keep collections + membership map source of truth**

Use existing `listCollections` + `getCollection` to maintain `videoId -> Set<collectionId>`.

**Step 2: Add category mutation handler per video**

Use `updateVideoCategory(videoId, category)` and update local list state immediately on success.

**Step 3: Keep collection mutation handler per video**

Use `addVideoToCollection` / `removeVideoFromCollection` and update local membership map.

**Step 4: Wire delete handler per video**

Reuse existing confirmation UX and `deleteVideo(videoId)` flow, then remove video from local list and related local maps.

**Step 5: Refresh menu data when collections change in sidebar**

Keep callback from sidebar create/delete to refresh dropdown data source.

---

### Task 4: Remove obsolete collection-only dropdown component

**Files:**
- Delete: `frontend/src/components/CollectionQuickDropdown.tsx` (if no longer referenced)

**Step 1: Ensure no references remain**

Search imports/usages and remove dead props/state.

---

### Task 5: Verification

**Files:**
- Verify only

**Step 1: Run lint**

Run: `npm run lint`
Expected: no new errors; existing unrelated warnings may remain.

**Step 2: Run build**

Run: `npm run build`
Expected: successful production build.

**Step 3: Manual behavior checklist**

- Grid/list both show top-right kebab action menu.
- Category changes apply immediately and persist.
- Collection toggles apply immediately and persist.
- Delete opens confirmation and removes video after confirm.
- `More` placeholder appears in menu for future extension.
