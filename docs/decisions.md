# Decisions

Technical decisions made during planning and the reasoning behind each.

---

## Backend Framework: FastAPI
**Chosen over**: Flask, Django
**Why**:
- Async-first — important for I/O-heavy operations (YouTube API, OpenAI API, DB)
- Built-in Pydantic validation — less boilerplate for request/response schemas
- Auto-generated OpenAPI docs — helpful during development
- Lightweight — no unnecessary overhead for a personal project

## Frontend Framework: Next.js (React)
**Chosen over**: Vue, Svelte, plain HTML/JS
**Why**:
- SSR for fast initial page loads
- File-based routing — simple page structure
- Rich React ecosystem for Markdown rendering, animations
- TypeScript support out of the box
- Industry standard — skills transfer to other projects

## Database: PostgreSQL
**Why**:
- Robust, reliable, widely supported
- Native array types (`VARCHAR[]`) for keywords — no need for a separate tags table
- Excellent async driver support (`asyncpg`)
- User already familiar with it from previous projects

## ORM: SQLAlchemy (async)
**Chosen over**: Tortoise ORM, raw SQL
**Why**:
- Most mature Python ORM with excellent async support
- Alembic integration for migrations
- User already has experience with it (Jogak Backend)

## Transcript Strategy: youtube-transcript-api + Whisper fallback
**Why two approaches**:
- `youtube-transcript-api` is free and instant — covers ~90% of videos with captions/auto-captions
- Whisper API handles the remaining ~10% without captions
- Cost-effective: Whisper fallback costs only $0.006/min, used rarely
- Trying captions first avoids unnecessary API costs

## AI Model: GPT-5.2
**Chosen over**: GPT-4o-mini, GPT-5-mini
**Why**:
- Most capable OpenAI model available — best quality for detailed, structured summaries
- Excellent at following complex prompt instructions for structured output
- $1.75/1M input tokens, $14/1M output tokens — ~$0.04-0.05 per video summary
- Strong long-context understanding for processing full video transcripts

## Video Metadata: yt-dlp
**Chosen over**: YouTube Data API v3
**Why**:
- No API key quota limits — YouTube Data API has daily quota restrictions
- Extracts all needed metadata (title, thumbnail, channel, duration) reliably
- Also handles audio download for the Whisper fallback path
- One dependency for two purposes (metadata + audio)

## Email: Gmail SMTP
**Chosen over**: SendGrid, Resend, AWS SES
**Why**:
- Completely free for personal use
- No third-party account needed — just a Gmail app password
- `smtplib` is built into Python — zero additional dependencies
- Sufficient for sending 1 email/day

## Scheduler: APScheduler (in-process)
**Chosen over**: Celery, system cron, external scheduler
**Why**:
- Runs inside the FastAPI process — no additional infrastructure
- Simple CronTrigger configuration
- Lightweight — perfect for a single daily job
- No need for Redis/RabbitMQ message broker

## Authentication: None
**Why**:
- Personal use only — single user
- Simplifies development significantly
- Security handled at network/VPS level instead

## Summary Structure: 3-part format
**Format**: Overview → Detailed Breakdown → Key Takeaways + Keywords
**Why**:
- Overview gives quick context (decide if you want to read more)
- Detailed breakdown preserves the video's flow and specifics — this is the core value
- Key takeaways are scannable highlights for review
- Keywords enable search and categorization
- Mirrors how effective study notes are structured

## Notes: User-managed (not AI-generated)
**Why**:
- Personal notes capture YOUR understanding, not the AI's interpretation
- Forces active engagement with the material (better retention)
- Keeps the AI's role focused on summarization only
