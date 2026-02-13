# Architecture

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Backend** | Python + FastAPI | REST API, async processing |
| **Frontend** | Next.js (React + TypeScript) | SSR, modern UI |
| **Database** | PostgreSQL | Persistent storage |
| **ORM** | SQLAlchemy (async) | Database operations |
| **Migrations** | Alembic | Schema versioning |
| **AI — Summary** | OpenAI GPT-5.2 | Transcript → structured summary |
| **AI — Transcription** | OpenAI Whisper API | Fallback for videos without captions |
| **Transcript** | youtube-transcript-api | Primary caption extraction (free) |
| **Video Metadata** | yt-dlp | Title, thumbnail, channel, duration |
| **Email** | Gmail SMTP (smtplib) | Daily review digest |
| **Scheduler** | APScheduler | In-process daily cron job |

---

## System Flow

```
┌─────────────────────────────────────────────────────────┐
│                    Next.js Frontend                      │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ URL Input │  │  Video List  │  │  Video Detail +   │  │
│  │           │  │  (cards)     │  │  Notes Editor     │  │
│  └─────┬────┘  └──────┬───────┘  └────────┬──────────┘  │
└────────┼───────────────┼──────────────────┼──────────────┘
         │               │                  │
         ▼               ▼                  ▼
┌─────────────────────────────────────────────────────────┐
│                   FastAPI Backend                        │
│                                                         │
│  POST /api/videos ─── GET /api/videos ─── PATCH/DELETE  │
│        │                                                │
│        ▼                                                │
│  ┌─────────────────┐    ┌──────────────────────────┐    │
│  │ youtube.py       │    │ summarizer.py             │    │
│  │ - extract ID     │    │ - GPT-5.2 summarization   │    │
│  │ - fetch metadata │──▶│ - structured output       │    │
│  │ - get transcript │    │ - parse into sections     │    │
│  └────────┬────────┘    └─────────────┬────────────┘    │
│           │                           │                 │
│     (no captions?)                    ▼                 │
│           │                    ┌─────────────┐          │
│           ▼                    │ PostgreSQL   │          │
│  ┌─────────────────┐          │   (videos)   │          │
│  │ transcription.py │          └──────┬──────┘          │
│  │ - yt-dlp audio   │                 │                 │
│  │ - Whisper API    │──▶──────────────┘                 │
│  └─────────────────┘                                    │
│                                                         │
│  ┌─────────────────────────────────────────────┐        │
│  │ scheduler.py (APScheduler — daily cron)     │        │
│  │ → Pick 1-3 random entries                   │        │
│  │ → email_service.py → Gmail SMTP             │        │
│  └─────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────┘
```

---

## Database Schema

### Table: `videos`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | PK, default uuid4 | Primary key |
| `youtube_url` | `VARCHAR(500)` | NOT NULL | Original URL |
| `youtube_id` | `VARCHAR(20)` | UNIQUE, NOT NULL | Extracted video ID |
| `title` | `VARCHAR(500)` | | Video title |
| `thumbnail_url` | `VARCHAR(500)` | | Thumbnail URL |
| `channel_name` | `VARCHAR(255)` | | Channel name |
| `duration` | `INTEGER` | | Duration in seconds |
| `overview` | `TEXT` | | 2-3 sentence overview |
| `detailed_summary` | `TEXT` | | Section-by-section breakdown (Markdown) |
| `key_takeaways` | `TEXT` | | Key insights (Markdown) |
| `keywords` | `VARCHAR[]` | | Auto-generated tags |
| `notes` | `TEXT` | | User's personal notes (Markdown) |
| `transcript_source` | `VARCHAR(20)` | | `'captions'` or `'whisper'` |
| `created_at` | `TIMESTAMP` | default now() | Created timestamp |
| `updated_at` | `TIMESTAMP` | auto-update | Last modified |

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/videos` | Submit YouTube URL → extract + summarize + store |
| `GET` | `/api/videos` | List all videos (newest first) |
| `GET` | `/api/videos/{id}` | Get single video with full summary |
| `PATCH` | `/api/videos/{id}` | Update user notes |
| `DELETE` | `/api/videos/{id}` | Delete a video entry |

---

## Project Structure

```
my-knowledge-app/
├── docs/                     # Planning & documentation
├── backend/
│   ├── app/
│   │   ├── main.py           # FastAPI app, CORS, lifespan
│   │   ├── config.py         # Pydantic Settings (.env)
│   │   ├── database.py       # Async SQLAlchemy engine
│   │   ├── models.py         # ORM models
│   │   ├── schemas.py        # Pydantic schemas
│   │   ├── routers/
│   │   │   └── videos.py     # Video CRUD endpoints
│   │   ├── services/
│   │   │   ├── youtube.py    # Metadata + transcript
│   │   │   ├── transcription.py  # Whisper fallback
│   │   │   ├── summarizer.py     # GPT summarization
│   │   │   └── email_service.py  # Gmail SMTP
│   │   └── scheduler.py     # APScheduler cron
│   ├── alembic/              # DB migrations
│   ├── alembic.ini
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── app/
    │   │   ├── layout.tsx
    │   │   ├── page.tsx      # Main page (input + list)
    │   │   └── video/[id]/
    │   │       └── page.tsx  # Detail page (summary + notes)
    │   ├── components/
    │   │   ├── VideoInput.tsx
    │   │   ├── VideoCard.tsx
    │   │   ├── VideoDetail.tsx
    │   │   ├── NotesEditor.tsx
    │   │   ├── KeywordBadge.tsx
    │   │   ├── LoadingState.tsx
    │   │   └── SearchBar.tsx
    │   ├── lib/
    │   │   └── api.ts        # API client
    │   └── styles/
    │       └── globals.css
    ├── package.json
    ├── next.config.js
    └── tsconfig.json
```

---

## Frontend Design

- **Theme**: Dark mode default, sleek modern aesthetic
- **Style**: Glassmorphism cards, subtle backdrop blur
- **Colors**: Deep navy/charcoal background, electric blue/purple gradient accents
- **Font**: Inter (Google Fonts)
- **Animations**: Smooth hover transitions, loading skeletons, page transitions
