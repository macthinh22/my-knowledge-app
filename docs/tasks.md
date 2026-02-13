# Tasks

Ordered task list for building the YouTube Knowledge Extractor.

---

## Phase 1: Project Setup ✅
- [x] Initialize monorepo structure (`backend/`, `frontend/`, `docs/`)
- [x] Set up Python virtual environment + `requirements.txt`
- [x] Set up Next.js project with TypeScript
- [x] Create `.env.example` with all required variables
- [x] Set up PostgreSQL (Docker Compose)

## Phase 2: Backend — Database & Core ✅
- [x] Set up SQLAlchemy async engine + session (`database.py`)
- [x] Create Video ORM model (`models.py`)
- [x] Set up Alembic + create initial migration
- [x] Create Pydantic schemas (`schemas.py`)
- [x] Create config with Pydantic Settings (`config.py`)

## Phase 3: Backend — YouTube Services ✅
- [x] Implement YouTube URL parser (extract `youtube_id` from various formats)
- [x] Implement metadata fetcher via `yt-dlp` (title, thumbnail, channel, duration)
- [x] Implement transcript extraction via `youtube-transcript-api`
- [x] Implement Whisper fallback transcription (download audio + Whisper API)
- [x] Add error handling + logging for both transcript paths

## Phase 4: Backend — AI Summarization ✅
- [x] Design GPT prompt for structured summary generation
- [x] Implement summarizer service (call OpenAI, parse structured response)
- [x] Test prompt with various video types (tutorial, talk, interview)
- [x] Fine-tune prompt for depth and detail quality

## Phase 5: Backend — API Endpoints ✅
- [x] `POST /api/videos` — full pipeline (extract → transcribe → summarize → store)
- [x] `GET /api/videos` — list all, sorted newest first
- [x] `GET /api/videos/{id}` — get single video detail
- [x] `PATCH /api/videos/{id}` — update user notes
- [x] `DELETE /api/videos/{id}` — delete entry
- [x] Duplicate handling (return existing if same `youtube_id`)
- [x] Wire up FastAPI app with CORS (`main.py`)

## Phase 6: Backend — Email & Scheduler ✅
- [x] Implement Gmail SMTP email sending (`email_service.py`)
- [x] Design HTML email template for review digest
- [x] Implement APScheduler daily cron job (`scheduler.py`)
- [x] Random selection of 1-3 past entries for review
- [x] Integrate scheduler into FastAPI lifespan

## Phase 7: Frontend — Layout & Design System ✅
- [x] Set up global CSS (dark theme, design tokens, glassmorphism)
- [x] Set up Sora + DM Sans fonts from Google Fonts
- [x] Create root layout with metadata
- [x] Configure next.config.ts for YouTube image domains

## Phase 8: Frontend — Main Page ✅
- [x] Build `VideoInput` component (URL paste + submit)
- [x] Build `LoadingState` component (processing animation with status)
- [x] Build `VideoCard` component (thumbnail, title, keywords, date)
- [x] Build `SearchBar` component (filter by keyword/title)
- [x] Build `KeywordBadge` component
- [x] Assemble main page (input + search + card list)
- [x] Connect to backend API (`api.ts`)

## Phase 9: Frontend — Detail Page ✅
- [x] Build `VideoDetail` component (Markdown rendering for summary sections)
- [x] Build `NotesEditor` component (textarea, auto-save on blur)
- [x] Build video detail page (`/video/[id]`)
- [x] Add delete functionality with confirmation
- [x] Add embedded YouTube player

## Phase 10: Polish & Testing ✅
- [x] Add micro-animations (hover effects, transitions)
- [x] Responsive design check (mobile + desktop)
- [x] Write backend unit tests (endpoint tests with mocked services)
- [x] Custom 404 page
- [x] Error states and edge cases (invalid URL, API failures, video not found)
