# YouTube Knowledge Extractor 🧠

A personal knowledge management app that transforms YouTube videos into detailed, structured summaries — learn without watching entire videos.

## Features

- 🎥 **Paste & Summarize** — Paste any YouTube URL to generate a comprehensive, structured summary
- 📝 **Detailed Breakdowns** — Section-by-section analysis, not superficial overviews
- 🏷️ **Auto Keywords** — AI-generated tags for easy search and categorization
- 📒 **Personal Notes** — Add your own notes to any video summary
- 📧 **Daily Review Email** — Random past summaries delivered to your inbox each morning
- 🔍 **Search & Filter** — Find past knowledge by keyword or title

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python, FastAPI |
| Frontend | Next.js (React + TypeScript) |
| Database | PostgreSQL |
| AI | OpenAI GPT-4o-mini + Whisper |
| Email | Gmail SMTP |

## Getting Started

### Prerequisites
- Python 3.11+
- Node.js 18+
- PostgreSQL (or Docker)
- OpenAI API key
- Gmail account with App Password

### Setup

```bash
# Clone
git clone <repo-url>
cd my-knowledge-app

# Backend
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # Fill in your values
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev
```

### Environment Variables

```env
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/knowledge_app
OPENAI_API_KEY=sk-...
EMAIL_ADDRESS=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
RECIPIENT_EMAIL=your-email@gmail.com
REVIEW_EMAIL_HOUR=8
```

## Documentation

Detailed planning docs are in the [`/docs`](./docs) folder:

| File | Description |
|---|---|
| [brief.md](./docs/brief.md) | What we're building and why |
| [architecture.md](./docs/architecture.md) | Tech stack and structure |
| [tasks.md](./docs/tasks.md) | Ordered task list with progress |
| [decisions.md](./docs/decisions.md) | Technical decision log |
| [current-task.md](./docs/current-task.md) | Current development context |

## License

Private — personal use only.
