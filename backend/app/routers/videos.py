"""Video CRUD endpoints and the full processing pipeline."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.logging_config import get_logger
from app.models import Video
from app.schemas import VideoCreate, VideoListResponse, VideoResponse, VideoUpdate
from app.services.summarizer import SummarizerService
from app.services.transcription import TranscriptionService
from app.services.youtube import TranscriptNotAvailableError, YouTubeService

logger = get_logger(__name__)

router = APIRouter(prefix="/api/videos", tags=["videos"])

# ---------------------------------------------------------------------------
# Service instances
# ---------------------------------------------------------------------------

youtube_service = YouTubeService()
summarizer_service = SummarizerService()
transcription_service = TranscriptionService()


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("", response_model=VideoResponse, status_code=status.HTTP_201_CREATED)
async def create_video(body: VideoCreate, db: AsyncSession = Depends(get_db)):
    """Full pipeline: parse URL → check duplicate → metadata → transcript → summarize → store."""
    url_str = str(body.youtube_url)

    # 1. Extract YouTube ID
    try:
        youtube_id = youtube_service.extract_youtube_id(url_str)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc

    # 2. Duplicate check
    existing = await db.execute(select(Video).where(Video.youtube_id == youtube_id))
    existing_video = existing.scalar_one_or_none()
    if existing_video:
        logger.info("Duplicate video found: %s", youtube_id)
        return existing_video

    # 3. Fetch metadata
    try:
        metadata = await youtube_service.fetch_metadata(youtube_id)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)
        ) from exc

    # 4. Fetch transcript (captions → Whisper fallback)
    try:
        transcript, transcript_source = await youtube_service.fetch_transcript(
            youtube_id
        )
    except TranscriptNotAvailableError:
        logger.info("No captions — falling back to Whisper for %s", youtube_id)
        try:
            (
                transcript,
                transcript_source,
            ) = await transcription_service.transcribe_with_whisper(youtube_id)
        except RuntimeError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)
            ) from exc

    # 5. Summarize
    try:
        summary = await summarizer_service.summarize(transcript, metadata.title)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)
        ) from exc

    # 6. Store in database
    video = Video(
        youtube_url=url_str,
        youtube_id=youtube_id,
        title=metadata.title,
        thumbnail_url=metadata.thumbnail_url,
        channel_name=metadata.channel_name,
        duration=metadata.duration,
        overview=summary.overview,
        detailed_summary=summary.detailed_summary,
        key_takeaways=summary.key_takeaways,
        keywords=summary.keywords,
        transcript_source=transcript_source,
    )
    db.add(video)
    await db.flush()
    await db.refresh(video)

    logger.info("Video created: %s — '%s'", video.id, video.title)
    return video


@router.get("", response_model=list[VideoListResponse])
async def list_videos(db: AsyncSession = Depends(get_db)):
    """List all videos, sorted newest first."""
    result = await db.execute(select(Video).order_by(Video.created_at.desc()))
    return result.scalars().all()


@router.get("/{video_id}", response_model=VideoResponse)
async def get_video(video_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Get a single video with full summary."""
    video = await db.get(Video, video_id)
    if not video:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Video not found"
        )
    return video


@router.patch("/{video_id}", response_model=VideoResponse)
async def update_video(
    video_id: uuid.UUID, body: VideoUpdate, db: AsyncSession = Depends(get_db)
):
    """Update user notes for a video."""
    video = await db.get(Video, video_id)
    if not video:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Video not found"
        )

    if body.notes is not None:
        video.notes = body.notes

    await db.flush()
    await db.refresh(video)

    logger.info("Video updated: %s", video_id)
    return video


@router.delete("/{video_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_video(video_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Delete a video entry."""
    video = await db.get(Video, video_id)
    if not video:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Video not found"
        )

    await db.delete(video)
    logger.info("Video deleted: %s", video_id)
