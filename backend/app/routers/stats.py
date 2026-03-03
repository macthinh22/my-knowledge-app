from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Collection, Video
from app.schemas import DashboardStats, TagSummaryResponse
from app.services.tags import collect_tag_stats

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("/dashboard", response_model=DashboardStats)
async def get_dashboard(db: AsyncSession = Depends(get_db)):
    total_result = await db.execute(select(func.count(Video.id)))
    total_videos = total_result.scalar() or 0

    collections_result = await db.execute(select(func.count(Collection.id)))
    total_collections = collections_result.scalar() or 0

    never_viewed_result = await db.execute(
        select(func.count(Video.id)).where(Video.view_count == 0)
    )
    never_viewed_count = never_viewed_result.scalar() or 0

    stale_threshold = datetime.now() - timedelta(days=14)
    stale_result = await db.execute(
        select(func.count(Video.id)).where(
            or_(Video.last_viewed_at == None, Video.last_viewed_at < stale_threshold)  # noqa: E711
        )
    )
    stale_count = stale_result.scalar() or 0

    recent_threshold = datetime.now() - timedelta(days=7)
    recent_result = await db.execute(
        select(func.count(Video.id)).where(Video.created_at >= recent_threshold)
    )
    recent_additions = recent_result.scalar() or 0

    videos_result = await db.execute(select(Video))
    videos = videos_result.scalars().all()

    videos_by_category: dict[str, int] = {}
    for v in videos:
        cat = v.category or "uncategorized"
        videos_by_category[cat] = videos_by_category.get(cat, 0) + 1

    stats = collect_tag_stats(list(videos))
    top_tags = [
        TagSummaryResponse(
            tag=str(s["tag"]),
            usage_count=s["usage_count"],
            last_used_at=s.get("last_used_at"),
            aliases=[],
        )
        for s in stats[:10]
    ]

    return DashboardStats(
        total_videos=total_videos,
        total_collections=total_collections,
        never_viewed_count=never_viewed_count,
        stale_count=stale_count,
        videos_by_category=videos_by_category,
        top_tags=top_tags,
        recent_additions=recent_additions,
    )
