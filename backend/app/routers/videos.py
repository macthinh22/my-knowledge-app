import asyncio
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.logging_config import get_logger
from app.models import Video, VideoJob
from app.schemas import (
    VideoCreate,
    VideoJobResponse,
    VideoListResponse,
    VideoResponse,
    VideoUpdate,
)
from app.services.video_jobs import ACTIVE_JOB_STATUSES, JOB_STEPS, run_video_job
from app.services.youtube import YouTubeService

logger = get_logger(__name__)

router = APIRouter(prefix="/api/videos", tags=["videos"])

youtube_service = YouTubeService()


@router.post("", response_model=VideoJobResponse, status_code=status.HTTP_202_ACCEPTED)
async def create_video(body: VideoCreate, db: AsyncSession = Depends(get_db)):
    url_str = str(body.youtube_url)

    try:
        youtube_id = youtube_service.extract_youtube_id(url_str)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc

    active_job = await _get_active_job(db, youtube_id)
    if active_job:
        return active_job

    existing_video_result = await db.execute(
        select(Video).where(Video.youtube_id == youtube_id)
    )
    existing_video = existing_video_result.scalar_one_or_none()
    if existing_video:
        completed_job = await _get_or_create_completed_job(
            db=db,
            youtube_id=youtube_id,
            youtube_url=url_str,
            video_id=existing_video.id,
        )
        logger.info("Video already exists, reusing completed job: %s", completed_job.id)
        return completed_job

    job = VideoJob(
        youtube_url=url_str,
        youtube_id=youtube_id,
        status="queued",
        current_step=0,
        total_steps=len(JOB_STEPS),
        step_label=JOB_STEPS[0],
    )
    db.add(job)
    await db.flush()
    await db.refresh(job)
    await db.commit()

    asyncio.create_task(run_video_job(job.id))
    logger.info("Video job created: %s for %s", job.id, youtube_id)
    return job


@router.get("/jobs", response_model=list[VideoJobResponse])
async def list_video_jobs(
    status_filter: str | None = Query(default=None, alias="status"),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(VideoJob)
    if status_filter:
        statuses = tuple(
            token.strip() for token in status_filter.split(",") if token.strip()
        )
        if statuses:
            stmt = stmt.where(VideoJob.status.in_(statuses))

    result = await db.execute(stmt.order_by(VideoJob.created_at.desc()))
    return result.scalars().all()


@router.get("/jobs/{job_id}", response_model=VideoJobResponse)
async def get_video_job(job_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    job = await db.get(VideoJob, job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Video job not found"
        )
    return job


@router.get("", response_model=list[VideoListResponse])
async def list_videos(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Video).order_by(Video.created_at.desc()))
    return result.scalars().all()


@router.get("/{video_id}", response_model=VideoResponse)
async def get_video(video_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
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
    video = await db.get(Video, video_id)
    if not video:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Video not found"
        )

    await db.delete(video)
    logger.info("Video deleted: %s", video_id)


async def _get_active_job(db: AsyncSession, youtube_id: str) -> VideoJob | None:
    result = await db.execute(
        select(VideoJob)
        .where(
            VideoJob.youtube_id == youtube_id,
            VideoJob.status.in_(tuple(ACTIVE_JOB_STATUSES)),
        )
        .order_by(VideoJob.created_at.desc())
    )
    return result.scalars().first()


async def _get_or_create_completed_job(
    db: AsyncSession,
    youtube_id: str,
    youtube_url: str,
    video_id: uuid.UUID,
) -> VideoJob:
    result = await db.execute(
        select(VideoJob)
        .where(
            VideoJob.youtube_id == youtube_id,
            VideoJob.status == "completed",
            VideoJob.video_id == video_id,
        )
        .order_by(VideoJob.created_at.desc())
    )
    existing = result.scalars().first()
    if existing:
        return existing

    job = VideoJob(
        youtube_url=youtube_url,
        youtube_id=youtube_id,
        status="completed",
        current_step=len(JOB_STEPS) - 1,
        total_steps=len(JOB_STEPS),
        step_label=JOB_STEPS[-1],
        video_id=video_id,
    )
    db.add(job)
    await db.flush()
    await db.refresh(job)
    return job
