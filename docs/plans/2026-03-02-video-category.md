# Video Category Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Auto-assign a category to each video during GPT analysis, let users manage categories (add/remove) and manually change a video's category.

**Architecture:** A `categories` table stores the user-defined category list (seeded with 5 defaults). A `category` VARCHAR column on `videos` stores the assigned value. GPT reads the current category list dynamically when analyzing. Users can CRUD categories via API and update a video's category from the detail page.

**Tech Stack:** Alembic migration, SQLAlchemy, OpenAI structured output, FastAPI, Next.js/React

---

### Categories

| Value | Label |
|---|---|
| `technology` | Technology |
| `business-finance` | Business & Finance |
| `personal-development` | Personal Development |
| `knowledge-education` | Knowledge & Education |
| `other` | Other |

---

### Task 1: Alembic migration — add `categories` table and `category` column on `videos`

**Files:**
- Create: `backend/alembic/versions/f5g6h7i8j9k0_add_categories.py`

**Step 1: Generate and write migration**

```python
"""Add categories table and category column to videos."""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
import uuid

revision: str = "f5g6h7i8j9k0"
down_revision: Union[str, Sequence[str], None] = "e4f5a6b7c8d9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

DEFAULT_CATEGORIES = [
    ("technology", "Technology"),
    ("business-finance", "Business & Finance"),
    ("personal-development", "Personal Development"),
    ("knowledge-education", "Knowledge & Education"),
    ("other", "Other"),
]


def upgrade() -> None:
    categories_table = op.create_table(
        "categories",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("slug", sa.String(50), unique=True, nullable=False, index=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )
    op.bulk_insert(
        categories_table,
        [{"id": uuid.uuid4(), "slug": slug, "name": name} for slug, name in DEFAULT_CATEGORIES],
    )
    op.add_column("videos", sa.Column("category", sa.String(50), nullable=True))


def downgrade() -> None:
    op.drop_column("videos", "category")
    op.drop_table("categories")
```

**Step 2: Run migration**

Run: `cd backend && alembic upgrade head`
Expected: Migration applies successfully with 5 seeded categories.

**Step 3: Commit**

```bash
git add backend/alembic/versions/f5g6h7i8j9k0_add_categories.py
git commit -m "feat: add categories table and category column to videos"
```

---

### Task 2: Update models and schemas

**Files:**
- Modify: `backend/app/models.py` — add `Category` model, add `category` field to `Video`
- Modify: `backend/app/schemas.py` — add category-related schemas, add `category` to video responses, add `category` to `VideoUpdate`

**Step 1: Add `Category` model and `category` to `Video`**

In `backend/app/models.py`, add a new `Category` model:

```python
class Category(Base):
    __tablename__ = "categories"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
```

Add to `Video` model after `keywords`:

```python
category: Mapped[str | None] = mapped_column(String(50))
```

**Step 2: Add schemas**

In `backend/app/schemas.py`:

- Add `category: str | None = None` to `VideoResponse` and `VideoListResponse`
- Add `category: str | None = None` to `VideoUpdate` (so users can update it)
- Add new schemas:

```python
class CategoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    slug: str
    name: str
    created_at: datetime

class CategoryCreate(BaseModel):
    slug: str
    name: str
```

**Step 3: Commit**

```bash
git add backend/app/models.py backend/app/schemas.py
git commit -m "feat: add Category model and category schemas"
```

---

### Task 3: Update GPT analysis to output category dynamically

**Files:**
- Modify: `backend/app/services/summarizer.py`

The key change: `analyze()` now accepts a `categories` parameter (list of `{slug, name}` dicts) loaded from the DB at call time. This is injected into the system prompt so GPT always sees the current category list.

**Step 1: Add `category` to `_KnowledgeSchema` and `KnowledgeResult`**

Add a `category` string field to `_KnowledgeSchema` (not a Literal, since categories are dynamic):

```python
# Inside _KnowledgeSchema:
category: str = Field(
    description="The slug of the category that best fits this video. Must be one of the provided category slugs."
)
```

Add `category: str` to `KnowledgeResult`.

**Step 2: Update `analyze()` to accept and inject categories**

Change signature:

```python
async def analyze(self, transcript: str, title: str, categories: list[dict[str, str]]) -> KnowledgeResult:
```

Build a category instruction block and append it to the system prompt:

```python
cat_lines = "\n".join(f"- `{c['slug']}`: {c['name']}" for c in categories)
category_instruction = (
    f"\n\n### category\n"
    f"- Classify this video into exactly one of these categories by returning its slug:\n{cat_lines}\n"
    f"- If none fit well, use `other`."
)
system_prompt = _SYSTEM_PROMPT + category_instruction
```

Pass `category=parsed.category` to `KnowledgeResult`.

**Step 3: Commit**

```bash
git add backend/app/services/summarizer.py
git commit -m "feat: add dynamic category classification to GPT analysis"
```

---

### Task 4: Store category in video_jobs pipeline + load categories from DB

**Files:**
- Modify: `backend/app/services/video_jobs.py`

**Step 1: Load categories from DB before analysis**

In `run_video_job`, before calling `summarizer_service.analyze()`, query all categories:

```python
from app.models import Category
from sqlalchemy import select

cats_result = await db.execute(select(Category))
categories = [{"slug": c.slug, "name": c.name} for c in cats_result.scalars().all()]
```

**Step 2: Pass categories to analyze and store result**

```python
analysis = await summarizer_service.analyze(transcript, metadata.title, categories)
```

In the `Video(...)` constructor, add `category=analysis.category`.

**Step 3: Commit**

```bash
git add backend/app/services/video_jobs.py
git commit -m "feat: load categories from DB and pass to GPT analysis"
```

---

### Task 5: Add categories API router

**Files:**
- Create: `backend/app/routers/categories.py`
- Modify: `backend/app/main.py` — register the router

**Step 1: Create categories router**

```
GET    /api/categories          — list all categories
POST   /api/categories          — create a new category
DELETE /api/categories/{slug}   — delete a category (sets videos with that category to null)
```

For DELETE: before removing, update all videos with that slug to `category = NULL`.

**Step 2: Register router in main.py**

**Step 3: Commit**

```bash
git add backend/app/routers/categories.py backend/app/main.py
git commit -m "feat: add categories CRUD API router"
```

---

### Task 6: Update video PATCH endpoint to support category update

**Files:**
- Modify: `backend/app/routers/videos.py`

**Step 1: Update the `update_video` handler**

The `VideoUpdate` schema already has `category: str | None = None` from Task 2. Update the handler to also set `video.category` if provided:

```python
if body.category is not None:
    video.category = body.category
```

**Step 2: Commit**

```bash
git add backend/app/routers/videos.py
git commit -m "feat: allow updating video category via PATCH"
```

---

### Task 7: Add frontend types and API functions

**Files:**
- Modify: `frontend/src/lib/api.ts`

**Step 1: Add `category` to TypeScript interfaces**

Add `category: string | null;` to both `VideoListItem` and `Video` interfaces.

**Step 2: Add Category type and API functions**

```typescript
export interface Category {
    id: string;
    slug: string;
    name: string;
    created_at: string;
}

export function listCategories() {
    return request<Category[]>("/api/categories");
}

export function createCategory(slug: string, name: string) {
    return request<Category>("/api/categories", {
        method: "POST",
        body: JSON.stringify({ slug, name }),
    });
}

export function deleteCategory(slug: string) {
    return request<void>(`/api/categories/${encodeURIComponent(slug)}`, {
        method: "DELETE",
    });
}
```

**Step 3: Add `updateVideoCategory` helper (uses existing PATCH)**

```typescript
export function updateVideoCategory(id: string, category: string) {
    return request<Video>(`/api/videos/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ category }),
    });
}
```

**Step 4: Commit**

```bash
git add frontend/src/lib/api.ts
git commit -m "feat: add category types and API functions to frontend"
```

---

### Task 8: Add category filter to the library page

**Files:**
- Modify: `frontend/src/app/page.tsx` — add category state + filter logic
- Modify: `frontend/src/components/Toolbar.tsx` — add category tabs/chips

**Step 1: Add category filter chips to Toolbar**

Add a row of clickable chips below (or inline with) the search bar. One chip per category + "All". Clicking a chip sets the active category filter. Props:

```typescript
// Add to ToolbarProps:
selectedCategory?: string | null;
onCategoryChange?: (category: string | null) => void;
```

Render as a horizontal scrollable chip bar:
- "All" chip (clears filter)
- One chip per category with label

**Step 2: Add category state and filtering to page.tsx**

```typescript
const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
```

In the `filtered` memo, add category filtering:

```typescript
if (selectedCategory) {
    result = result.filter((v) => v.category === selectedCategory);
}
```

Pass props to `<Toolbar>`:

```typescript
selectedCategory={selectedCategory}
onCategoryChange={setSelectedCategory}
```

**Step 3: Commit**

```bash
git add frontend/src/app/page.tsx frontend/src/components/Toolbar.tsx
git commit -m "feat: add category filter chips to library toolbar"
```

---

### Task 9: Show category on video cards and detail page

**Files:**
- Create: `frontend/src/lib/categories.ts` — shared category color/label config
- Modify: `frontend/src/components/VideoCard.tsx` — show category badge
- Modify: `frontend/src/components/VideoListItem.tsx` — show category badge
- Modify: `frontend/src/app/video/[id]/page.tsx` — show category badge + editable dropdown

**Step 1: Create shared category config**

`frontend/src/lib/categories.ts` — a color mapping for known categories. Since categories are now dynamic, use a fallback color for unknown slugs:

```typescript
const CATEGORY_COLORS: Record<string, string> = {
    "technology": "blue",
    "business-finance": "green",
    "personal-development": "purple",
    "knowledge-education": "amber",
    "other": "gray",
};

export function getCategoryColor(slug: string): string {
    return CATEGORY_COLORS[slug] ?? "gray";
}
```

**Step 2: Add category badge to VideoCard and VideoListItem**

Display `video.category` as a small colored badge. Use the category `name` from the categories list if available, otherwise fall back to the slug.

**Step 3: Add editable category on video detail page**

On the detail page's left panel, show the category as a dropdown/select that the user can change. On change, call `updateVideoCategory(id, newSlug)`. Load categories list via `listCategories()`.

**Step 4: Commit**

```bash
git add frontend/src/lib/categories.ts frontend/src/components/VideoCard.tsx frontend/src/components/VideoListItem.tsx frontend/src/app/video/[id]/page.tsx
git commit -m "feat: display category on cards and editable category on detail page"
```

---

### Task 10: Category management UI

**Files:**
- Create: `frontend/src/components/CategoryManager.tsx`
- Modify: Toolbar or a settings area to expose the manager

**Step 1: Build CategoryManager component**

A simple dialog/panel (similar to TagManager) where users can:
- See all categories
- Add a new category (slug + name)
- Delete a category (with confirmation — warns that videos will lose their category assignment)

**Step 2: Wire it into the UI**

Add a "Manage Categories" button near the category filter chips or in the filter panel.

**Step 3: Commit**

```bash
git add frontend/src/components/CategoryManager.tsx frontend/src/components/Toolbar.tsx
git commit -m "feat: add category management UI"
```

---

### Task 11: Verify end-to-end

**Step 1: Start backend and frontend**

Run backend: `cd backend && uvicorn app.main:app --reload`
Run frontend: `cd frontend && npm run dev`

**Step 2: Submit a new video and verify category is assigned**

Submit a YouTube video URL. After processing completes, check:
- The video detail page shows a category badge
- The library page shows the category filter chips
- Filtering by category works correctly

**Step 3: Verify existing videos show `null` category gracefully**

Old videos without a category should render without a badge and should appear under "All" filter only.

**Step 4: Test category update**

On a video detail page, change the category via the dropdown. Verify it persists after page reload.

**Step 5: Test category management**

- Add a new category. Verify it appears in the filter chips and the GPT prompt would include it.
- Delete a category. Verify videos that had it now show no category.
