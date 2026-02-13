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

## Phase 7: Frontend — Layout & Design System
- [ ] Set up global CSS (dark theme, design tokens, glassmorphism)
- [ ] Set up Inter font from Google Fonts
- [ ] Create root layout with metadata

## Phase 8: Frontend — Main Page
- [ ] Build `VideoInput` component (URL paste + submit)
- [ ] Build `LoadingState` component (processing animation with status)
- [ ] Build `VideoCard` component (thumbnail, title, keywords, date)
- [ ] Build `SearchBar` component (filter by keyword/title)
- [ ] Build `KeywordBadge` component
- [ ] Assemble main page (input + search + card list)
- [ ] Connect to backend API (`api.ts`)

## Phase 9: Frontend — Detail Page
- [ ] Build `VideoDetail` component (Markdown rendering for summary sections)
- [ ] Build `NotesEditor` component (textarea, auto-save on blur)
- [ ] Build video detail page (`/video/[id]`)
- [ ] Add delete functionality with confirmation
- [ ] Add embedded YouTube player (optional)

## Phase 10: Polish & Testing
- [ ] Add micro-animations (hover effects, transitions)
- [ ] Responsive design check (mobile + desktop)
- [ ] Write backend unit tests (URL parsing, services, endpoints)
- [ ] End-to-end manual testing (full flow)
- [ ] Test email delivery
- [ ] Error states and edge cases (invalid URL, API failures, long videos)
