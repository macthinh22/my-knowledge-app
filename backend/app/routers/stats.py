from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Collection, User, Video
from app.schemas import DashboardStats, TagSummaryResponse
from app.services.tags import collect_tag_stats

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("/dashboard", response_model=DashboardStats)
async def get_dashboard(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    total_result = await db.execute(
        select(func.count(Video.id)).where(Video.user_id == current_user.id)
    )
    total_videos = total_result.scalar() or 0

    collections_result = await db.execute(
        select(func.count(Collection.id)).where(Collection.user_id == current_user.id)
    )
    total_collections = collections_result.scalar() or 0

    never_viewed_result = await db.execute(
        select(func.count(Video.id)).where(
            Video.user_id == current_user.id,
            Video.view_count == 0,
        )
    )
    never_viewed_count = never_viewed_result.scalar() or 0

    stale_threshold = datetime.now() - timedelta(days=14)
    stale_result = await db.execute(
        select(func.count(Video.id)).where(
            Video.user_id == current_user.id,
            or_(Video.last_viewed_at == None, Video.last_viewed_at < stale_threshold),  # noqa: E711
        )
    )
    stale_count = stale_result.scalar() or 0

    recent_threshold = datetime.now() - timedelta(days=7)
    recent_result = await db.execute(
        select(func.count(Video.id)).where(
            Video.user_id == current_user.id,
            Video.created_at >= recent_threshold,
        )
    )
    recent_additions = recent_result.scalar() or 0

    videos_result = await db.execute(
        select(Video).where(Video.user_id == current_user.id)
    )
    videos = videos_result.scalars().all()

    videos_by_category: dict[str, int] = {}
    for v in videos:
        cat = v.category or "uncategorized"
        videos_by_category[cat] = videos_by_category.get(cat, 0) + 1

    stats = collect_tag_stats(list(videos))
    top_tags: list[TagSummaryResponse] = []
    for stat in stats[:10]:
        last_used_at = stat.get("last_used_at")
        top_tags.append(
            TagSummaryResponse(
                tag=str(stat["tag"]),
                usage_count=int(stat["usage_count"]),
                last_used_at=last_used_at
                if isinstance(last_used_at, datetime)
                else None,
                aliases=[],
            )
        )

    return DashboardStats(
        total_videos=total_videos,
        total_collections=total_collections,
        never_viewed_count=never_viewed_count,
        stale_count=stale_count,
        videos_by_category=videos_by_category,
        top_tags=top_tags,
        recent_additions=recent_additions,
    )
