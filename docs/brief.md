# YouTube Knowledge Extractor

## What
A personal web app that transforms YouTube videos into detailed, structured summaries — enabling learning without watching entire videos.

## Why
Watching full YouTube videos is time-consuming. Many educational/tech videos contain dense knowledge that could be absorbed faster through well-structured written summaries. This app:

- **Saves time** — Get the full depth of a video in 2-3 minutes of reading instead of 30+ minutes of watching
- **Builds a knowledge base** — Every summary is stored, searchable, and taggable
- **Reinforces learning** — A daily review email resurfaces past knowledge so it doesn't fade

## How It Works
1. **Paste** a YouTube URL into the app
2. **Extract** the transcript (captions first, Whisper fallback)
3. **Summarize** via OpenAI GPT-5.2 into a structured format:
   - Overview (2-3 sentences)
   - Detailed section-by-section breakdown (follows the video's flow, preserves examples & data)
   - Key takeaways / insights
   - Auto-generated keywords
4. **Store** everything in PostgreSQL (video metadata + summary + keywords)
5. **Review** — Add personal notes anytime; receive a daily email with random past summaries

## Target User
Personal use only — no authentication, single-user system.
