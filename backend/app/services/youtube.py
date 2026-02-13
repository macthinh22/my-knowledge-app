"""YouTube data extraction services — URL parsing, metadata, and transcript."""

import re
from dataclasses import dataclass

import yt_dlp
from youtube_transcript_api import YouTubeTranscriptApi

from app.logging_config import get_logger

logger = get_logger(__name__)

# ---------------------------------------------------------------------------
# Regex patterns for YouTube URL formats
# ---------------------------------------------------------------------------

_YOUTUBE_URL_PATTERNS: list[re.Pattern[str]] = [
    # Standard watch URL: youtube.com/watch?v=ID
    re.compile(
        r"(?:https?://)?(?:www\.|m\.)?youtube\.com/watch\?.*?v=(?P<id>[a-zA-Z0-9_-]{11})"
    ),
    # Shortened URL: youtu.be/ID
    re.compile(
        r"(?:https?://)?youtu\.be/(?P<id>[a-zA-Z0-9_-]{11})"
    ),
    # Embed URL: youtube.com/embed/ID
    re.compile(
        r"(?:https?://)?(?:www\.)?youtube\.com/embed/(?P<id>[a-zA-Z0-9_-]{11})"
    ),
    # Shorts URL: youtube.com/shorts/ID
    re.compile(
        r"(?:https?://)?(?:www\.)?youtube\.com/shorts/(?P<id>[a-zA-Z0-9_-]{11})"
    ),
    # Live URL: youtube.com/live/ID
    re.compile(
        r"(?:https?://)?(?:www\.)?youtube\.com/live/(?P<id>[a-zA-Z0-9_-]{11})"
    ),
]


@dataclass(frozen=True)
class VideoMetadata:
    """Metadata extracted from a YouTube video via yt-dlp."""

    title: str
    thumbnail_url: str | None
    channel_name: str | None
    duration: int | None  # seconds


class TranscriptNotAvailable(Exception):
    """Raised when no transcript/captions can be found for a video."""


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def extract_youtube_id(url: str) -> str:
    """Extract the 11-character YouTube video ID from various URL formats.

    Args:
        url: Any YouTube video URL.

    Returns:
        The 11-character video ID string.

    Raises:
        ValueError: If the URL is not a recognised YouTube format.
    """
    url = url.strip()

    for pattern in _YOUTUBE_URL_PATTERNS:
        match = pattern.search(url)
        if match:
            video_id = match.group("id")
            logger.debug("Extracted YouTube ID '%s' from URL: %s", video_id, url)
            return video_id

    raise ValueError(f"Could not extract YouTube video ID from URL: {url}")


async def fetch_metadata(youtube_id: str) -> VideoMetadata:
    """Fetch video metadata using yt-dlp (no download).

    Args:
        youtube_id: The 11-character YouTube video ID.

    Returns:
        A VideoMetadata dataclass with title, thumbnail, channel, and duration.

    Raises:
        RuntimeError: If yt-dlp fails to extract metadata.
    """
    video_url = f"https://www.youtube.com/watch?v={youtube_id}"

    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        # Don't extract comments, related videos, etc.
        "extract_flat": False,
    }

    logger.info("Fetching metadata for video: %s", youtube_id)

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(video_url, download=False)

        if info is None:
            raise RuntimeError(f"yt-dlp returned no info for video: {youtube_id}")

        metadata = VideoMetadata(
            title=info.get("title", "Unknown Title"),
            thumbnail_url=info.get("thumbnail"),
            channel_name=info.get("uploader") or info.get("channel"),
            duration=info.get("duration"),
        )

        logger.info(
            "Metadata fetched — title='%s', channel='%s', duration=%ss",
            metadata.title,
            metadata.channel_name,
            metadata.duration,
        )
        return metadata

    except Exception as exc:
        logger.error("Failed to fetch metadata for %s: %s", youtube_id, exc)
        raise RuntimeError(
            f"Failed to fetch metadata for video {youtube_id}: {exc}"
        ) from exc


async def fetch_transcript(youtube_id: str) -> tuple[str, str]:
    """Fetch the transcript/captions for a YouTube video.

    Tries English captions first, then auto-generated, then any available language.

    Args:
        youtube_id: The 11-character YouTube video ID.

    Returns:
        A tuple of (transcript_text, source) where source is ``"captions"``.

    Raises:
        TranscriptNotAvailable: If no transcript can be found.
    """
    logger.info("Fetching transcript for video: %s", youtube_id)

    try:
        ytt_api = YouTubeTranscriptApi()
        transcript = ytt_api.fetch(youtube_id)

        # Join all segments into a single string
        full_text = " ".join(
            snippet.text for snippet in transcript.snippets
        )

        if not full_text.strip():
            raise TranscriptNotAvailable(
                f"Transcript is empty for video: {youtube_id}"
            )

        logger.info(
            "Transcript fetched — %d characters, source=captions",
            len(full_text),
        )
        return full_text, "captions"

    except TranscriptNotAvailable:
        raise
    except Exception as exc:
        logger.warning(
            "No captions available for %s: %s", youtube_id, exc
        )
        raise TranscriptNotAvailable(
            f"No captions available for video {youtube_id}: {exc}"
        ) from exc
