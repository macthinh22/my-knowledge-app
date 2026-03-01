from collections import defaultdict
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import TagAlias, Video


def normalize_tag(value: str) -> str:
    return " ".join(value.strip().lower().split())


def normalize_keywords(keywords: list[str] | None) -> list[str]:
    normalized: list[str] = []
    seen: set[str] = set()

    for keyword in keywords or []:
        tag = normalize_tag(keyword)
        if not tag or tag in seen:
            continue
        seen.add(tag)
        normalized.append(tag)

    return normalized


async def canonicalize_keywords(
    db: AsyncSession, keywords: list[str] | None
) -> list[str]:
    normalized = normalize_keywords(keywords)
    if not normalized:
        return []

    aliases_result = await db.execute(
        select(TagAlias).where(TagAlias.alias.in_(normalized))
    )
    aliases = aliases_result.scalars().all()
    alias_map = {record.alias: record.canonical for record in aliases}

    canonicalized = [alias_map.get(tag, tag) for tag in normalized]
    return normalize_keywords(canonicalized)


def collect_tag_stats(videos: list[Video]) -> list[dict[str, object]]:
    counts: dict[str, int] = defaultdict(int)
    last_used: dict[str, datetime] = {}

    for video in videos:
        for keyword in normalize_keywords(video.keywords):
            counts[keyword] += 1
            if keyword not in last_used or video.updated_at > last_used[keyword]:
                last_used[keyword] = video.updated_at

    stats = [
        {
            "tag": tag,
            "usage_count": count,
            "last_used_at": last_used.get(tag),
        }
        for tag, count in counts.items()
    ]
    stats.sort(key=lambda item: (-int(item["usage_count"]), str(item["tag"])))
    return stats
