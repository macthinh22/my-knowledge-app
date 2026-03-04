# Category Management Page Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move category management from an inline modal to a dedicated `/categories` page with full CRUD, custom colors, and reordering.

**Architecture:** Add `color` and `display_order` columns to the `categories` table. Create a PATCH endpoint for updates. Build a new Next.js page at `/categories` with a table view. Remove the `CategoryManager` modal component and update the Toolbar navigation.

**Tech Stack:** FastAPI, SQLAlchemy, Alembic (backend); Next.js App Router, shadcn/ui, Tailwind (frontend)

---

### Task 1: Alembic Migration — Add `color` and `display_order` columns

**Files:**
- Create: `backend/alembic/versions/g6h7i8j9k0l1_add_category_color_and_order.py`
- Reference: `backend/alembic/versions/f5g6h7i8j9k0_add_categories.py`

**Step 1: Create the migration file**

```python
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "g6h7i8j9k0l1"
down_revision: Union[str, Sequence[str], None] = "f5g6h7i8j9k0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


DEFAULT_COLORS = {
    "technology": "blue",
    "business-finance": "emerald",
    "personal-development": "rose",
    "knowledge-education": "amber",
    "other": "slate",
}


def upgrade() -> None:
    op.add_column("categories", sa.Column("color", sa.String(20), nullable=True))
    op.add_column(
        "categories",
        sa.Column("display_order", sa.Integer(), nullable=False, server_default="0"),
    )

    # Set colors for default categories
    for i, (slug, color) in enumerate(DEFAULT_COLORS.items()):
        op.execute(
            sa.text(
                "UPDATE categories SET color = :color, display_order = :order WHERE slug = :slug"
            ).bindparams(color=color, order=i, slug=slug)
        )


def downgrade() -> None:
    op.drop_column("categories", "display_order")
    op.drop_column("categories", "color")
```

**Step 2: Run the migration**

Run: `cd backend && alembic upgrade head`
Expected: Migration applies successfully.

**Step 3: Commit**

```bash
git add backend/alembic/versions/g6h7i8j9k0l1_add_category_color_and_order.py
git commit -m "feat: add color and display_order columns to categories table"
```

---

### Task 2: Update Backend Model and Schemas

**Files:**
- Modify: `backend/app/models.py:85-98` (Category class)
- Modify: `backend/app/schemas.py:114-125` (CategoryResponse, CategoryCreate)

**Step 1: Add fields to Category model**

In `backend/app/models.py`, add to the `Category` class after the `name` field:

```python
color: Mapped[str | None] = mapped_column(String(20), nullable=True)
display_order: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
```

**Step 2: Update schemas**

In `backend/app/schemas.py`:

Update `CategoryResponse` to include new fields:
```python
class CategoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    slug: str
    name: str
    color: str | None = None
    display_order: int = 0
    created_at: datetime
```

Update `CategoryCreate` to accept optional color:
```python
class CategoryCreate(BaseModel):
    slug: str
    name: str
    color: str | None = None
```

Add a new `CategoryUpdate` schema:
```python
class CategoryUpdate(BaseModel):
    name: str | None = None
    color: str | None = None
    display_order: int | None = None
```

**Step 3: Commit**

```bash
git add backend/app/models.py backend/app/schemas.py
git commit -m "feat: add color and display_order to category model and schemas"
```

---

### Task 3: Add PATCH Endpoint and Update List Ordering

**Files:**
- Modify: `backend/app/routers/categories.py`

**Step 1: Update imports**

Add `CategoryUpdate` to the import from schemas.

**Step 2: Update `list_categories` to order by `display_order`**

```python
@router.get("", response_model=list[CategoryResponse])
async def list_categories(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Category).order_by(Category.display_order.asc(), Category.created_at.asc())
    )
    return result.scalars().all()
```

**Step 3: Update `create_category` to accept `color` and auto-set `display_order`**

After the existing validation in `create_category`, before creating the `Category` object:

```python
# Auto-set display_order to max + 1
max_order_result = await db.execute(
    select(func.coalesce(func.max(Category.display_order), -1))
)
next_order = max_order_result.scalar() + 1

category = Category(slug=slug, name=name, color=body.color, display_order=next_order)
```

Add `func` to the sqlalchemy imports.

**Step 4: Add PATCH endpoint**

```python
VALID_COLORS = {"slate", "red", "orange", "amber", "emerald", "teal", "blue", "indigo", "violet", "rose"}


@router.patch("/{slug}", response_model=CategoryResponse)
async def update_category(
    slug: str, body: CategoryUpdate, db: AsyncSession = Depends(get_db)
):
    normalized_slug = _normalize_slug(slug)
    category_result = await db.execute(
        select(Category).where(Category.slug == normalized_slug)
    )
    category = category_result.scalar_one_or_none()
    if category is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found",
        )

    if body.name is not None:
        name = body.name.strip()
        if not name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Name cannot be empty",
            )
        category.name = name

    if body.color is not None:
        if body.color not in VALID_COLORS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid color. Must be one of: {', '.join(sorted(VALID_COLORS))}",
            )
        category.color = body.color

    if body.display_order is not None:
        category.display_order = body.display_order

    await db.flush()
    await db.refresh(category)
    return category
```

**Step 5: Commit**

```bash
git add backend/app/routers/categories.py
git commit -m "feat: add PATCH endpoint for categories, update list ordering"
```

---

### Task 4: Add Backend Tests for New Category Endpoints

**Files:**
- Modify: `backend/tests/test_endpoints.py`

**Step 1: Add test for PATCH endpoint**

Find the existing category tests section and add:

```python
class TestCategoryUpdate:
    async def test_update_category_name(self, client, db_session, make_category):
        cat = make_category(slug="test-cat", name="Test")
        resp = await client.patch(
            f"/api/categories/{cat.slug}",
            json={"name": "Updated Name"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["name"] == "Updated Name"
        assert body["slug"] == "test-cat"

    async def test_update_category_color(self, client, db_session, make_category):
        cat = make_category(slug="test-cat", name="Test")
        resp = await client.patch(
            f"/api/categories/{cat.slug}",
            json={"color": "blue"},
        )
        assert resp.status_code == 200
        assert resp.json()["color"] == "blue"

    async def test_update_category_invalid_color(self, client, db_session, make_category):
        cat = make_category(slug="test-cat", name="Test")
        resp = await client.patch(
            f"/api/categories/{cat.slug}",
            json={"color": "neon-pink"},
        )
        assert resp.status_code == 400

    async def test_update_nonexistent_category(self, client, db_session):
        resp = await client.patch(
            "/api/categories/does-not-exist",
            json={"name": "New Name"},
        )
        assert resp.status_code == 404

    async def test_update_empty_name(self, client, db_session, make_category):
        cat = make_category(slug="test-cat", name="Test")
        resp = await client.patch(
            f"/api/categories/{cat.slug}",
            json={"name": "  "},
        )
        assert resp.status_code == 400
```

**Step 2: Add test for ordering**

```python
    async def test_list_categories_ordered_by_display_order(self, client, db_session, make_category):
        make_category(slug="z-last", name="Z Last", display_order=2)
        make_category(slug="a-first", name="A First", display_order=0)
        make_category(slug="m-middle", name="M Middle", display_order=1)
        resp = await client.get("/api/categories")
        body = resp.json()
        slugs = [c["slug"] for c in body]
        assert slugs == ["a-first", "m-middle", "z-last"]
```

**Step 3: Run tests**

Run: `cd backend && python -m pytest tests/test_endpoints.py -v -k "category"`
Expected: All new tests pass.

**Step 4: Commit**

```bash
git add backend/tests/test_endpoints.py
git commit -m "test: add tests for category update endpoint and ordering"
```

---

### Task 5: Update Frontend API Types and Functions

**Files:**
- Modify: `frontend/src/lib/api.ts`

**Step 1: Update `Category` interface**

```typescript
export interface Category {
    id: string;
    slug: string;
    name: string;
    color: string | null;
    display_order: number;
    created_at: string;
}
```

**Step 2: Update `createCategory` to accept color**

```typescript
export function createCategory(slug: string, name: string, color?: string) {
    return request<Category>("/api/categories", {
        method: "POST",
        body: JSON.stringify({ slug, name, color }),
    });
}
```

**Step 3: Add `updateCategory` function**

```typescript
export function updateCategory(
    slug: string,
    data: { name?: string; color?: string; display_order?: number },
) {
    return request<Category>(`/api/categories/${encodeURIComponent(slug)}`, {
        method: "PATCH",
        body: JSON.stringify(data),
    });
}
```

**Step 4: Commit**

```bash
git add frontend/src/lib/api.ts
git commit -m "feat: update category API types and add updateCategory function"
```

---

### Task 6: Update `categories.ts` — Color System

**Files:**
- Modify: `frontend/src/lib/categories.ts`

**Step 1: Replace hardcoded color map with dynamic color system**

```typescript
const COLOR_CLASSES: Record<string, string> = {
    slate: "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700",
    red: "bg-red-100 text-red-800 border-red-200 dark:bg-red-800 dark:text-red-200 dark:border-red-700",
    orange: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-800 dark:text-orange-200 dark:border-orange-700",
    amber: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-800 dark:text-amber-200 dark:border-amber-700",
    emerald: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-800 dark:text-emerald-200 dark:border-emerald-700",
    teal: "bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-800 dark:text-teal-200 dark:border-teal-700",
    blue: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-800 dark:text-blue-200 dark:border-blue-700",
    indigo: "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-800 dark:text-indigo-200 dark:border-indigo-700",
    violet: "bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-800 dark:text-violet-200 dark:border-violet-700",
    rose: "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-800 dark:text-rose-200 dark:border-rose-700",
};

export const PRESET_COLORS = Object.keys(COLOR_CLASSES);

const DEFAULT_CATEGORY_SLUGS = new Set([
    "technology",
    "business-finance",
    "personal-development",
    "knowledge-education",
    "other",
]);

export function getCategoryBadgeClass(color: string | null | undefined): string {
    return COLOR_CLASSES[color ?? "slate"] ?? COLOR_CLASSES.slate;
}

export function categoryLabel(
    slug: string,
    categoryNameMap?: Record<string, string>,
): string {
    return categoryNameMap?.[slug] ?? slug;
}

export function isDefaultCategory(slug: string): boolean {
    return DEFAULT_CATEGORY_SLUGS.has(slug);
}
```

**Step 2: Update all callers of `getCategoryBadgeClass`**

The signature changes from `getCategoryBadgeClass(slug)` to `getCategoryBadgeClass(color)`. Every call site needs to pass `category.color` (or the color from the category map) instead of the slug. This affects:
- `frontend/src/components/VideoCard.tsx`
- `frontend/src/components/VideoListItem.tsx`
- `frontend/src/app/video/[id]/page.tsx`

Each of these currently calls `getCategoryBadgeClass(video.category)` where `video.category` is a slug string. They need to look up the category's color from the categories list/map.

The simplest approach: create a helper map `Record<string, string>` mapping slug → color, built from the categories array, and pass it down or build it where needed.

Add to `categories.ts`:
```typescript
export function buildCategoryColorMap(categories: { slug: string; color: string | null }[]): Record<string, string> {
    const map: Record<string, string> = {};
    for (const cat of categories) {
        map[cat.slug] = cat.color ?? "slate";
    }
    return map;
}
```

Then at each call site, replace:
```typescript
// Before:
getCategoryBadgeClass(video.category)
// After:
getCategoryBadgeClass(categoryColorMap[video.category ?? ""] ?? null)
```

Where `categoryColorMap` is built from the categories list that's already available as a prop.

**Step 3: Commit**

```bash
git add frontend/src/lib/categories.ts frontend/src/components/VideoCard.tsx frontend/src/components/VideoListItem.tsx frontend/src/app/video/[id]/page.tsx
git commit -m "feat: switch category colors from hardcoded slugs to DB-driven colors"
```

---

### Task 7: Build the Categories Page

**Files:**
- Create: `frontend/src/app/categories/page.tsx`

**Step 1: Create the page**

Build a client component page with:

1. **State:** categories list, loading, error, form fields (name, color), editing state
2. **On mount:** fetch `listCategories()` and video counts from `listVideos` (or a lightweight endpoint)
3. **Category table:** Each row shows:
   - Color dot (circle div with Tailwind bg class)
   - Name (text, or Input when editing)
   - Slug (muted text)
   - Video count
   - Actions: Edit (pencil icon), Move Up/Down (arrow icons, disabled at boundaries), Delete (trash icon, hidden for defaults)
4. **Add form:** At bottom — name Input + color swatch picker (grid of colored circles, selected has ring) + "Add" button
5. **Delete confirmation:** Use an AlertDialog from shadcn/ui
6. **Slug auto-generation:** When typing name, auto-generate slug: lowercase, replace spaces/special chars with hyphens, strip leading/trailing hyphens

Key interactions:
- **Edit:** Click edit → row switches to inline edit mode (name input + color picker). Save/Cancel buttons.
- **Reorder:** Up/down arrows call `updateCategory` with swapped `display_order` values, then re-fetch.
- **Delete:** Shows AlertDialog. On confirm, calls `deleteCategory`, re-fetches.
- **Create:** Validates name not empty, slug not taken. Calls `createCategory`. Clears form. Re-fetches.

Use existing shadcn/ui components: `Button`, `Input`, `Badge`, `AlertDialog`.

Back navigation: Link back to home (`/`).

**Step 2: Verify the page renders**

Run: `cd frontend && npm run build`
Expected: Build succeeds without errors.

**Step 3: Commit**

```bash
git add frontend/src/app/categories/page.tsx
git commit -m "feat: add category management page with full CRUD, colors, and reordering"
```

---

### Task 8: Update Toolbar Navigation

**Files:**
- Modify: `frontend/src/components/Toolbar.tsx`

**Step 1: Remove CategoryManager from the category filter row**

Remove the `<CategoryManager>` component from line 326-329 of the Toolbar. Remove the import of `CategoryManager`.

**Step 2: Add Categories link to the top row**

In the top row (around line 299-304, near the Dashboard link), add a Categories link:

```tsx
<Button variant="ghost" size="icon" asChild>
    <Link href="/categories">
        <SlidersHorizontal className="h-4 w-4" />
    </Link>
</Button>
```

`SlidersHorizontal` is already imported. Place it next to the Dashboard icon button.

**Step 3: Commit**

```bash
git add frontend/src/components/Toolbar.tsx
git commit -m "feat: replace category modal with link to categories page in toolbar"
```

---

### Task 9: Delete CategoryManager Component

**Files:**
- Delete: `frontend/src/components/CategoryManager.tsx`

**Step 1: Verify no other imports**

Search for `CategoryManager` across the frontend. After Task 8, only the file itself should remain.

**Step 2: Delete the file**

```bash
rm frontend/src/components/CategoryManager.tsx
```

**Step 3: Verify build**

Run: `cd frontend && npm run build`
Expected: Build succeeds.

**Step 4: Commit**

```bash
git add -u frontend/src/components/CategoryManager.tsx
git commit -m "chore: remove CategoryManager modal component"
```

---

### Task 10: Update Toolbar Props — Remove `onCategoryDataChanged`

**Files:**
- Modify: `frontend/src/components/Toolbar.tsx`
- Modify: `frontend/src/app/page.tsx`

**Step 1: Check if `onCategoryDataChanged` is still needed**

The Toolbar's `onCategoryDataChanged` callback was used by `CategoryManager` to signal when categories were created/deleted. Since category management now happens on a separate page, the home page should re-fetch categories on mount (which it already does). The callback can be removed from the Toolbar props.

However, the category filter pills still need the `availableCategories` prop. Keep that.

**Step 2: Remove `onCategoryDataChanged` from ToolbarProps**

Remove the `onCategoryDataChanged` prop from the interface and its usage. Also remove any refreshCategories-related code from `page.tsx` that was only used for the modal.

**Step 3: Verify build**

Run: `cd frontend && npm run build`
Expected: Build succeeds.

**Step 4: Commit**

```bash
git add frontend/src/components/Toolbar.tsx frontend/src/app/page.tsx
git commit -m "refactor: remove onCategoryDataChanged callback from Toolbar"
```

---

### Task 11: Final Verification

**Step 1: Run backend tests**

Run: `cd backend && python -m pytest tests/ -v`
Expected: All tests pass.

**Step 2: Run frontend build**

Run: `cd frontend && npm run build`
Expected: Build succeeds.

**Step 3: Manual smoke test**

Start the app and verify:
- `/categories` page loads, shows all categories with colors
- Can create a new category with name and color
- Can rename a category
- Can change a category's color
- Can reorder categories with up/down arrows
- Can delete a custom category (with confirmation)
- Cannot delete default categories
- Category filter pills on home page reflect correct colors and order
- Dashboard icon and Categories icon both visible in toolbar top row
