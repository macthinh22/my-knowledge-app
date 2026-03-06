import asyncio
import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import ARRAY, String, and_, cast, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.logging_config import get_logger
from app.models import Category, User, Video, VideoJob
from app.schemas import (
    PaginatedVideosResponse,
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
async def create_video(
    body: VideoCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    url_str = str(body.youtube_url)

    try:
        youtube_id = youtube_service.extract_youtube_id(url_str)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc

    active_job = await _get_active_job(db, youtube_id, current_user.id)
    if active_job:
        return active_job

    existing_video_result = await db.execute(
        select(Video).where(
            Video.youtube_id == youtube_id,
            Video.user_id == current_user.id,
        )
    )
    existing_video = existing_video_result.scalar_one_or_none()
    if existing_video:
        completed_job = await _get_or_create_completed_job(
            db=db,
            user_id=current_user.id,
            youtube_id=youtube_id,
            youtube_url=url_str,
            video_id=existing_video.id,
        )
        logger.info("Video already exists, reusing completed job: %s", completed_job.id)
        return completed_job

    job = VideoJob(
        user_id=current_user.id,
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

    asyncio.create_task(run_video_job(job.id, current_user.id))
    logger.info("Video job created: %s for %s", job.id, youtube_id)
    return job


@router.get("/jobs", response_model=list[VideoJobResponse])
async def list_video_jobs(
    status_filter: str | None = Query(default=None, alias="status"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(VideoJob).where(VideoJob.user_id == current_user.id)
    if status_filter:
        statuses = tuple(
            token.strip() for token in status_filter.split(",") if token.strip()
        )
        if statuses:
            stmt = stmt.where(VideoJob.status.in_(statuses))

    result = await db.execute(stmt.order_by(VideoJob.created_at.desc()))
    return result.scalars().all()


@router.get("/jobs/{job_id}", response_model=VideoJobResponse)
async def get_video_job(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    job = await db.get(VideoJob, job_id)
    if not job or job.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Video job not found"
        )
    return job


@router.get("", response_model=PaginatedVideosResponse)
async def list_videos(
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    sort_by: str = Query(default="created_at"),
    sort_order: str = Query(default="desc"),
    search: str | None = Query(default=None),
    tag: str | None = Query(default=None),
    tag_mode: str = Query(default="any"),
    category: str | None = Query(default=None),
    collection_id: str | None = Query(default=None),
    review_status: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    allowed_sort = {
        "created_at",
        "title",
        "channel_name",
        "duration",
        "last_viewed_at",
        "view_count",
    }
    if sort_by == "random":
        order_expr = func.random()
    else:
        sort_column = getattr(Video, sort_by if sort_by in allowed_sort else "created_at")
        order_expr = sort_column.desc() if sort_order == "desc" else sort_column.asc()

    query = select(Video).where(Video.user_id == current_user.id)

    if search:
        pattern = f"%{search.strip()}%"
        query = query.where(
            or_(
                Video.title.ilike(pattern),
                Video.channel_name.ilike(pattern),
                Video.explanation.ilike(pattern),
                Video.key_knowledge.ilike(pattern),
                func.array_to_string(Video.keywords, " ").ilike(pattern),
            )
        )

    if tag:
        tags = [token.strip().lower() for token in tag.split(",") if token.strip()]
        if tags:
            keyword_text = func.lower(func.array_to_string(Video.keywords, " "))
            if tag_mode == "all":
                query = query.where(
                    and_(*[keyword_text.contains(item) for item in tags])
                )
            else:
                query = query.where(
                    or_(*[keyword_text.contains(item) for item in tags])
                )

    if category == "__uncategorized__":
        query = query.where(Video.category.is_(None))
    elif category:
        query = query.where(Video.category == category)

    if collection_id:
        from app.models import collection_videos

        query = query.join(collection_videos).where(
            collection_videos.c.collection_id == collection_id
        )

    if review_status == "never_viewed":
        query = query.where(Video.view_count == 0)
    elif review_status == "stale":
        stale_threshold = datetime.now() - timedelta(days=14)
        query = query.where(
            or_(Video.last_viewed_at == None, Video.last_viewed_at < stale_threshold)  # noqa: E711
        )
    elif review_status == "recent":
        recent_threshold = datetime.now() - timedelta(days=7)
        query = query.where(Video.last_viewed_at >= recent_threshold)

    total_result = await db.execute(
        select(func.count()).select_from(query.order_by(None).subquery())
    )
    total = total_result.scalar() or 0

    result = await db.execute(query.order_by(order_expr).limit(limit).offset(offset))
    items = [
        VideoListResponse.model_validate(video) for video in result.scalars().all()
    ]
    return PaginatedVideosResponse(
        items=items,
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/{video_id}", response_model=VideoResponse)
async def get_video(
    video_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    video = await db.get(Video, video_id)
    if not video or video.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Video not found"
        )
    video.view_count = (video.view_count or 0) + 1
    video.last_viewed_at = datetime.now()
    await db.commit()
    await db.refresh(video)
    return video


@router.get("/{video_id}/related", response_model=list[VideoListResponse])
async def get_related_videos(
    video_id: str,
    limit: int = Query(default=5, ge=1, le=20),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Video).where(Video.id == video_id, Video.user_id == current_user.id)
    )
    video = result.scalar_one_or_none()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    if not video.keywords:
        return []

    all_result = await db.execute(
        select(Video).where(
            Video.id != video_id,
            Video.user_id == current_user.id,
            Video.keywords.bool_op("&&")(cast(video.keywords, ARRAY(String))),
        )
    )
    candidates = list(all_result.scalars().all())

    def overlap_count(v: Video) -> int:
        left_keywords = v.keywords if v.keywords is not None else []
        right_keywords = video.keywords if video.keywords is not None else []
        return len(set(left_keywords) & set(right_keywords))

    candidates = sorted(candidates, key=overlap_count, reverse=True)
    return candidates[:limit]


@router.patch("/{video_id}", response_model=VideoResponse)
async def update_video(
    video_id: uuid.UUID,
    body: VideoUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    video = await db.get(Video, video_id)
    if not video or video.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Video not found"
        )

    if body.notes is not None:
        video.notes = body.notes

    if "category" in body.model_fields_set:
        if body.category is None:
            video.category = None
        else:
            normalized_category = body.category.strip().lower()
            result = await db.execute(
                select(Category).where(
                    Category.slug == normalized_category,
                    Category.user_id == current_user.id,
                )
            )
            category = result.scalar_one_or_none()
            if category is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Category does not exist",
                )
            video.category = normalized_category

    await db.flush()
    await db.refresh(video)

    logger.info("Video updated: %s", video_id)
    return video


@router.delete("/{video_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_video(
    video_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    video = await db.get(Video, video_id)
    if not video or video.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Video not found"
        )

    await db.delete(video)
    logger.info("Video deleted: %s", video_id)


async def _get_active_job(
    db: AsyncSession,
    youtube_id: str,
    user_id: uuid.UUID,
) -> VideoJob | None:
    result = await db.execute(
        select(VideoJob)
        .where(
            VideoJob.youtube_id == youtube_id,
            VideoJob.user_id == user_id,
            VideoJob.status.in_(tuple(ACTIVE_JOB_STATUSES)),
        )
        .order_by(VideoJob.created_at.desc())
    )
    return result.scalars().first()


async def _get_or_create_completed_job(
    db: AsyncSession,
    user_id: uuid.UUID,
    youtube_id: str,
    youtube_url: str,
    video_id: uuid.UUID,
) -> VideoJob:
    result = await db.execute(
        select(VideoJob)
        .where(
            VideoJob.youtube_id == youtube_id,
            VideoJob.user_id == user_id,
            VideoJob.status == "completed",
            VideoJob.video_id == video_id,
        )
        .order_by(VideoJob.created_at.desc())
    )
    existing = result.scalars().first()
    if existing:
        return existing

    job = VideoJob(
        user_id=user_id,
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
