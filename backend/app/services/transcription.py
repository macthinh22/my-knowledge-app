"""Whisper-based fallback transcription for videos without captions."""

import tempfile
from pathlib import Path

import yt_dlp
from openai import AsyncOpenAI

from app.config import settings
from app.logging_config import get_logger

logger = get_logger(__name__)


async def transcribe_with_whisper(youtube_id: str) -> tuple[str, str]:
    """Download audio via yt-dlp and transcribe with OpenAI Whisper API.

    This is the fallback path — used only when youtube-transcript-api
    finds no captions for the video.

    Args:
        youtube_id: The 11-character YouTube video ID.

    Returns:
        A tuple of (transcript_text, ``"whisper"``).

    Raises:
        RuntimeError: If audio download or transcription fails.
    """
    video_url = f"https://www.youtube.com/watch?v={youtube_id}"
    audio_path: Path | None = None

    try:
        # --- Step 1: Download audio to a temp file ---
        logger.info("Downloading audio for Whisper transcription: %s", youtube_id)

        with tempfile.TemporaryDirectory() as tmp_dir:
            output_template = str(Path(tmp_dir) / "%(id)s.%(ext)s")

            ydl_opts = {
                "format": "bestaudio/best",
                "quiet": True,
                "no_warnings": True,
                "outtmpl": output_template,
                "postprocessors": [
                    {
                        "key": "FFmpegExtractAudio",
                        "preferredcodec": "mp3",
                        "preferredquality": "128",
                    }
                ],
            }

            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([video_url])

            # Find the downloaded mp3 file
            audio_files = list(Path(tmp_dir).glob("*.mp3"))
            if not audio_files:
                raise RuntimeError(
                    f"Audio download produced no mp3 file for video: {youtube_id}"
                )

            audio_path = audio_files[0]
            file_size_mb = audio_path.stat().st_size / (1024 * 1024)
            logger.info(
                "Audio downloaded: %s (%.1f MB)", audio_path.name, file_size_mb
            )

            # Whisper API limit is 25 MB
            if file_size_mb > 25:
                raise RuntimeError(
                    f"Audio file too large for Whisper API ({file_size_mb:.1f} MB > 25 MB limit)"
                )

            # --- Step 2: Send to OpenAI Whisper API ---
            logger.info("Sending audio to Whisper API...")

            client = AsyncOpenAI(api_key=settings.openai_api_key)

            with open(audio_path, "rb") as audio_file:
                transcription = await client.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio_file,
                    response_format="text",
                )

            transcript_text = str(transcription).strip()

            if not transcript_text:
                raise RuntimeError(
                    f"Whisper returned empty transcription for video: {youtube_id}"
                )

            logger.info(
                "Whisper transcription complete — %d characters",
                len(transcript_text),
            )
            return transcript_text, "whisper"

    except RuntimeError:
        raise
    except Exception as exc:
        logger.error(
            "Whisper transcription failed for %s: %s", youtube_id, exc
        )
        raise RuntimeError(
            f"Whisper transcription failed for video {youtube_id}: {exc}"
        ) from exc
