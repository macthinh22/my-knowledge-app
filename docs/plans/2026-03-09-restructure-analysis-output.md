# Restructure Video Analysis Output

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the rigid 4-section AI analysis (explanation, key_knowledge, critical_analysis, real_world_applications) with 2 fields: a natural flowing `analysis` and a short `takeaways` for quick review. Rewrite the GPT prompt to produce human-sounding, non-templated output.

**Architecture:** Replace 4 DB columns with 2 new ones (`analysis`, `takeaways`). Update the GPT prompt to produce a single cohesive write-up + short takeaways. Simplify the frontend from accordion sections to a single markdown render with a collapsible takeaways block.

**Tech Stack:** Python/FastAPI, SQLAlchemy + Alembic (PostgreSQL), Next.js/React, OpenAI API (structured output), Tailwind CSS

---

### Task 1: Alembic migration — replace 4 columns with 2

**Files:**
- Create: `backend/alembic/versions/h7i8j9k0l1m2_restructure_analysis_fields.py`

**Step 1: Generate migration**

```bash
cd backend && alembic revision -m "restructure_analysis_fields"
```

**Step 2: Write migration content**

```python
"""restructure_analysis_fields"""

from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = "h7i8j9k0l1m2"
down_revision = "706d274a742e"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("videos", sa.Column("analysis", sa.Text(), nullable=True))
    op.add_column("videos", sa.Column("takeaways", sa.Text(), nullable=True))

    # Migrate existing data: concatenate old fields into new analysis field
    op.execute("""
        UPDATE videos SET
            analysis = COALESCE(explanation, '') || E'\n\n' || COALESCE(key_knowledge, '') || E'\n\n' || COALESCE(critical_analysis, '') || E'\n\n' || COALESCE(real_world_applications, ''),
            takeaways = key_knowledge
        WHERE explanation IS NOT NULL OR key_knowledge IS NOT NULL
    """)

    op.drop_column("videos", "explanation")
    op.drop_column("videos", "key_knowledge")
    op.drop_column("videos", "critical_analysis")
    op.drop_column("videos", "real_world_applications")


def downgrade() -> None:
    op.add_column("videos", sa.Column("explanation", sa.Text(), nullable=True))
    op.add_column("videos", sa.Column("key_knowledge", sa.Text(), nullable=True))
    op.add_column("videos", sa.Column("critical_analysis", sa.Text(), nullable=True))
    op.add_column("videos", sa.Column("real_world_applications", sa.Text(), nullable=True))
    op.drop_column("videos", "analysis")
    op.drop_column("videos", "takeaways")
```

**Step 3: Run migration**

```bash
cd backend && alembic upgrade head
```

**Step 4: Commit**

```bash
git add backend/alembic/versions/h7i8j9k0l1m2_restructure_analysis_fields.py
git commit -m "migration: replace 4 analysis columns with analysis + takeaways"
```

---

### Task 2: Update Video model and schemas

**Files:**
- Modify: `backend/app/models.py:111-115` (replace 4 fields with 2)
- Modify: `backend/app/schemas.py:33-36,60-61` (update response schemas)

**Step 1: Update `models.py`**

Replace lines 111-115:
```python
    # Knowledge analysis fields
    explanation: Mapped[str | None] = mapped_column(Text)
    key_knowledge: Mapped[str | None] = mapped_column(Text)
    critical_analysis: Mapped[str | None] = mapped_column(Text)
    real_world_applications: Mapped[str | None] = mapped_column(Text)
```

With:
```python
    # Knowledge analysis fields
    analysis: Mapped[str | None] = mapped_column(Text)
    takeaways: Mapped[str | None] = mapped_column(Text)
```

**Step 2: Update `schemas.py` — `VideoResponse`**

Replace `explanation`, `key_knowledge`, `critical_analysis`, `real_world_applications` fields with:
```python
    analysis: str | None = None
    takeaways: str | None = None
```

**Step 3: Update `schemas.py` — `VideoListResponse`**

Replace `explanation` and `key_knowledge` fields with:
```python
    takeaways: str | None = None
```

(List view doesn't need the full analysis — `takeaways` is enough for preview.)

**Step 4: Commit**

```bash
git add backend/app/models.py backend/app/schemas.py
git commit -m "feat: update model and schemas for analysis + takeaways"
```

---

### Task 3: Rewrite the GPT prompt and summarizer service

**Files:**
- Modify: `backend/app/services/summarizer.py` (entire prompt + schema rewrite)

**Step 1: Replace `_KnowledgeSchema`**

```python
class _KnowledgeSchema(BaseModel):
    """Pydantic model used as OpenAI structured output format."""

    analysis: str = Field(
        description=(
            "A natural, flowing write-up that helps the reader understand what this video "
            "is about and what knowledge they can gain from it. Write like a knowledgeable "
            "friend explaining what they learned — not like a corporate report. "
            "Use markdown for structure but let the content dictate the shape: "
            "use headings, paragraphs, and bullets where they naturally fit, "
            "not as a rigid template."
        )
    )
    takeaways: str = Field(
        description=(
            "A short list of the most important things to remember from this video. "
            "Each point should be a standalone piece of knowledge worth coming back to. "
            "Keep it concise — this is for quick review, not for learning."
        )
    )
    keywords: list[str] = Field(
        min_length=1,
        max_length=5,
        description="1-5 lowercase descriptive tags for search and categorization.",
    )
    category: str = Field(
        description=(
            "The slug of the category that best fits this video. "
            "Must be one of the provided category slugs."
        )
    )
```

**Step 2: Replace `KnowledgeResult`**

```python
@dataclass(frozen=True)
class KnowledgeResult:
    """Immutable result from the knowledge analysis pipeline."""

    analysis: str
    takeaways: str
    keywords: list[str]
    category: str
```

**Step 3: Replace `_SYSTEM_PROMPT`**

```python
_SYSTEM_PROMPT = """\
You are a knowledgeable friend who just watched a video and is explaining what you learned \
to someone who hasn't seen it yet. Your goal: after reading your write-up, they should \
understand what the video covers and what knowledge they can take away from it.

**IMPORTANT: Write ALL output in Vietnamese (Tiếng Việt), even if the source is in English.**

## How to write

- Write naturally. Mix paragraphs and structure as the content demands — don't force everything \
into bullet points or rigid sections.
- When a concept is complex, explain it step by step with clear logic. Use analogies when they help.
- When something is a simple list of facts or tips, use bullets. Otherwise, write prose.
- Be honest about the content. If the video makes strong claims, note them. If it skips over \
important nuances, mention that briefly — but don't turn it into a formal "strengths and weaknesses" analysis.
- Suggest related concepts or directions worth exploring if they naturally connect to the content. \
Don't force recommendations — only include them when genuinely useful.
- Keep technical accuracy. Don't oversimplify formulas, code, or precise definitions.

## Output fields

### analysis
The main write-up. Let the content dictate the structure — use markdown headings, paragraphs, \
and bullets where they naturally fit. There is no fixed template. The reader should walk away \
understanding what this video is about and what's worth knowing.

If the topic connects to broader ideas or further learning paths, weave that in naturally \
rather than making it a separate section.

### takeaways
5-8 short bullet points capturing the most important knowledge from the video. \
Each point should stand on its own — useful for quick review without re-reading the full analysis. \
Write them as knowledge statements, not as summaries of the video structure.

### keywords
1-5 lowercase tags in Vietnamese. Only include tags that are genuinely relevant.
"""
```

**Step 4: Update `analyze()` return to use new fields**

In the `analyze` method, replace:
```python
            result = KnowledgeResult(
                explanation=parsed.explanation,
                key_knowledge=parsed.key_knowledge,
                critical_analysis=parsed.critical_analysis,
                real_world_applications=parsed.real_world_applications,
                keywords=parsed.keywords,
                category=parsed.category,
            )
```

With:
```python
            result = KnowledgeResult(
                analysis=parsed.analysis,
                takeaways=parsed.takeaways,
                keywords=parsed.keywords,
                category=parsed.category,
            )
```

**Step 5: Commit**

```bash
git add backend/app/services/summarizer.py
git commit -m "feat: rewrite GPT prompt for natural analysis output"
```

---

### Task 4: Update video_jobs.py to use new field names

**Files:**
- Modify: `backend/app/services/video_jobs.py:115-130` (Video creation)

**Step 1: Update Video creation in `run_video_job`**

Replace:
```python
                video = Video(
                    user_id=user_id,
                    youtube_url=job.youtube_url,
                    youtube_id=job.youtube_id,
                    title=metadata.title,
                    thumbnail_url=metadata.thumbnail_url,
                    channel_name=metadata.channel_name,
                    duration=metadata.duration,
                    explanation=analysis.explanation,
                    key_knowledge=analysis.key_knowledge,
                    critical_analysis=analysis.critical_analysis,
                    real_world_applications=analysis.real_world_applications,
                    keywords=canonical_keywords,
                    category=selected_category,
                    transcript_source=transcript_source,
                )
```

With:
```python
                video = Video(
                    user_id=user_id,
                    youtube_url=job.youtube_url,
                    youtube_id=job.youtube_id,
                    title=metadata.title,
                    thumbnail_url=metadata.thumbnail_url,
                    channel_name=metadata.channel_name,
                    duration=metadata.duration,
                    analysis=analysis.analysis,
                    takeaways=analysis.takeaways,
                    keywords=canonical_keywords,
                    category=selected_category,
                    transcript_source=transcript_source,
                )
```

**Step 2: Commit**

```bash
git add backend/app/services/video_jobs.py
git commit -m "feat: use new analysis fields in video job pipeline"
```

---

### Task 5: Update video router search to use new fields

**Files:**
- Modify: `backend/app/routers/videos.py:157-158`

**Step 1: Update search filter**

Replace:
```python
                Video.explanation.ilike(pattern),
                Video.key_knowledge.ilike(pattern),
```

With:
```python
                Video.analysis.ilike(pattern),
                Video.takeaways.ilike(pattern),
```

**Step 2: Commit**

```bash
git add backend/app/routers/videos.py
git commit -m "feat: search against new analysis fields"
```

---

### Task 6: Update frontend types

**Files:**
- Modify: `frontend/src/lib/api.ts:11-33` (TypeScript types)

**Step 1: Update `VideoListItem`**

Replace `explanation` and `key_knowledge` fields with:
```typescript
    takeaways: string | null;
```

**Step 2: Update `Video` interface**

Replace `critical_analysis` and `real_world_applications` with:
```typescript
export interface Video extends VideoListItem {
    analysis: string | null;
    notes: string | null;
}
```

**Step 3: Commit**

```bash
git add frontend/src/lib/api.ts
git commit -m "feat: update TypeScript types for new analysis structure"
```

---

### Task 7: Simplify VideoDetail component

**Files:**
- Modify: `frontend/src/components/VideoDetail.tsx` (remove accordion, render single markdown body)

**Step 1: Rewrite component**

```tsx
"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Lightbulb } from "lucide-react";
import type { Video } from "@/lib/api";
import { NotesEditor } from "./NotesEditor";

interface VideoDetailProps {
  video: Video;
}

export function VideoDetail({ video }: VideoDetailProps) {
  const hasAnalysis = video.analysis || video.takeaways;

  return (
    <Tabs defaultValue="analysis" className="h-full">
      <TabsList className="w-full">
        <TabsTrigger value="analysis" className="flex-1">Analysis</TabsTrigger>
        <TabsTrigger value="notes" className="flex-1">Notes</TabsTrigger>
      </TabsList>

      <TabsContent value="analysis" className="mt-4">
        {!hasAnalysis ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No analysis available for this resource.
          </p>
        ) : (
          <div className="space-y-6">
            {video.takeaways && (
              <Accordion type="single" collapsible defaultValue="takeaways">
                <AccordionItem value="takeaways">
                  <AccordionTrigger className="text-sm font-medium">
                    <span className="flex items-center gap-2">
                      <Lightbulb className="h-4 w-4" />
                      Key Takeaways
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="prose prose-base dark:prose-invert max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {video.takeaways}
                      </ReactMarkdown>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )}

            {video.analysis && (
              <div className="prose prose-base dark:prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {video.analysis}
                </ReactMarkdown>
              </div>
            )}
          </div>
        )}
      </TabsContent>

      <TabsContent value="notes" className="mt-4">
        <NotesEditor key={video.id} videoId={video.id} initialNotes={video.notes || ""} />
      </TabsContent>
    </Tabs>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/VideoDetail.tsx
git commit -m "feat: simplify video detail to analysis + takeaways"
```

---

### Task 8: Update backend tests

**Files:**
- Modify: `backend/tests/test_youtube.py` (if it references old fields)

**Step 1: Check and update any test references to old field names**

Search for `explanation`, `key_knowledge`, `critical_analysis`, `real_world_applications` in all test files and update to `analysis` / `takeaways`.

**Step 2: Run tests**

```bash
cd backend && python -m pytest -v
```

**Step 3: Commit**

```bash
git add backend/tests/
git commit -m "test: update tests for new analysis fields"
```

---

### Task 9: Verify end-to-end

**Step 1: Start backend and frontend**

```bash
cd backend && uvicorn app.main:app --reload &
cd frontend && npm run dev &
```

**Step 2: Test by pasting a YouTube URL and verifying the output renders correctly**

**Step 3: Verify existing videos still display (migrated data)**

**Step 4: Final commit if any fixes needed**
