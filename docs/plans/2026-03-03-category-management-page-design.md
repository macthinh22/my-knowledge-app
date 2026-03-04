# Category Management Page Design

## Summary

Move category management from an inline modal in the Toolbar to a dedicated `/categories` page with full CRUD, custom colors, and reordering.

## Current State

- Category create/delete lives in a `CategoryManager` modal triggered from the Toolbar's category filter row
- No rename, color, or ordering support
- `getCategoryBadgeClass()` hardcodes colors for 5 default slugs; custom categories all get slate
- Backend model has only: `id`, `slug`, `name`, `created_at`

## Design

### Route

`/categories` — new Next.js app directory page

### Navigation

- Add "Categories" link to Toolbar top row (next to Dashboard, Add Video)
- Remove "Manage Categories" button from category filter pill row
- Delete `CategoryManager` component

### Page Layout

Table/list of categories with columns:
- Color dot (from preset palette)
- Name (editable)
- Slug (read-only, set at creation)
- Video count (display only)
- Actions: Edit, Move Up/Down, Delete

Add category form: name input (slug auto-generated) + color swatch picker + create button.

### Features

| Feature | Details |
|---------|---------|
| Create | Name + color picker. Slug auto-generated from name. |
| Rename | Edit display name only. Slug immutable after creation. |
| Custom colors | ~10 preset swatches stored as string in DB |
| Reorder | Up/down arrows. `display_order` integer field. |
| Delete | Confirmation dialog. Blocked for 5 default categories. |

### Color Palette

10 preset colors: `slate`, `red`, `orange`, `amber`, `emerald`, `teal`, `blue`, `indigo`, `violet`, `rose`

Each maps to Tailwind border/bg/text classes for badges.

### Backend Changes

**Model** (`categories` table):
- Add `color` column: `String(20)`, nullable, default `"slate"`
- Add `display_order` column: `Integer`, default 0

**Endpoints:**
- `PATCH /api/categories/{slug}` — update `name`, `color`, `display_order`
- Modify `GET /api/categories` — order by `display_order` ASC, then `created_at` ASC
- Modify `POST /api/categories` — accept optional `color` field

**Migration:** New Alembic migration for `color` and `display_order` columns.

### Frontend Changes

- New page: `frontend/src/app/categories/page.tsx`
- Update `getCategoryBadgeClass()` in `categories.ts` to use DB color field instead of hardcoded slug map
- Update `CategoryResponse`/`CategoryCreate` types in `api.ts`
- Add `updateCategory()` and related API functions
- Remove `CategoryManager.tsx`
- Update `Toolbar.tsx`: remove modal trigger, add nav link

### Constraints

- Default categories (technology, business-finance, personal-development, knowledge-education, other) cannot be deleted
- Videos reference categories by slug string (not FK), so slug must remain immutable
- Color defaults assigned to existing 5 defaults during migration
