import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models import TagAlias, User, Video
from app.schemas import (
    TagAliasCreate,
    TagAliasResponse,
    TagMergeRequest,
    TagRenameRequest,
    TagSummaryResponse,
)
from app.services.tags import canonicalize_keywords, collect_tag_stats, normalize_tag

router = APIRouter(prefix="/api/tags", tags=["tags"])


async def _build_tag_summaries(
    db: AsyncSession,
    user_id: uuid.UUID,
    *,
    search: str | None,
    limit: int,
) -> list[TagSummaryResponse]:
    videos_result = await db.execute(
        select(Video).where(Video.user_id == user_id).order_by(Video.created_at.desc())
    )
    videos = list(videos_result.scalars().all())
    aliases_result = await db.execute(
        select(TagAlias).where(TagAlias.user_id == user_id)
    )
    aliases = aliases_result.scalars().all()

    alias_by_canonical: dict[str, list[str]] = {}
    for alias in aliases:
        alias_by_canonical.setdefault(alias.canonical, []).append(alias.alias)

    stats: list[dict[str, Any]] = collect_tag_stats(videos)
    if search:
        term = search.strip().lower()
        stats = [item for item in stats if term in str(item["tag"]).lower()]

    stats = stats[:limit]

    return [
        TagSummaryResponse(
            tag=str(item["tag"]),
            usage_count=int(item["usage_count"]),
            last_used_at=item["last_used_at"],
            aliases=sorted(alias_by_canonical.get(str(item["tag"]), [])),
        )
        for item in stats
    ]


@router.get("", response_model=list[TagSummaryResponse])
async def list_tags(
    db: AsyncSession = Depends(get_db),
    search: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
):
    return await _build_tag_summaries(
        db,
        current_user.id,
        search=search,
        limit=limit,
    )


@router.get("/aliases", response_model=list[TagAliasResponse])
async def list_tag_aliases(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(TagAlias)
        .where(TagAlias.user_id == current_user.id)
        .order_by(TagAlias.alias.asc())
    )
    return result.scalars().all()


@router.post("/aliases", response_model=TagAliasResponse)
async def create_tag_alias(
    body: TagAliasCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    alias = normalize_tag(body.alias)
    canonical = normalize_tag(body.canonical)
    if not alias or not canonical:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Alias and canonical tag are required",
        )
    if alias == canonical:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Alias and canonical tag cannot be the same",
        )

    result = await db.execute(
        select(TagAlias).where(
            TagAlias.alias == alias,
            TagAlias.user_id == current_user.id,
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        row = TagAlias(user_id=current_user.id, alias=alias, canonical=canonical)
        db.add(row)
    else:
        row.canonical = canonical

    await db.flush()
    await db.refresh(row)
    await db.commit()
    return row


@router.delete("/aliases/{alias}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tag_alias(
    alias: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    normalized = normalize_tag(alias)
    result = await db.execute(
        select(TagAlias).where(
            TagAlias.alias == normalized,
            TagAlias.user_id == current_user.id,
        )
    )
    row = result.scalar_one_or_none()
    if row:
        await db.delete(row)
        await db.commit()


@router.post("/rename", response_model=list[TagSummaryResponse])
async def rename_tag(
    body: TagRenameRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    source = normalize_tag(body.from_tag)
    target = normalize_tag(body.to_tag)

    if not source or not target:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Both from_tag and to_tag are required",
        )

    if source == target:
        return await _build_tag_summaries(
            db,
            current_user.id,
            search=None,
            limit=100,
        )

    videos_result = await db.execute(
        select(Video).where(Video.user_id == current_user.id)
    )
    videos = videos_result.scalars().all()

    for video in videos:
        if not video.keywords:
            continue
        replaced = [
            target if normalize_tag(tag) == source else tag for tag in video.keywords
        ]
        video.keywords = await canonicalize_keywords(db, replaced, current_user.id)

    alias_result = await db.execute(
        select(TagAlias).where(TagAlias.user_id == current_user.id)
    )
    alias_rows = alias_result.scalars().all()
    alias_record: TagAlias | None = None
    for row in alias_rows:
        if row.alias == source:
            alias_record = row
        if row.canonical == source:
            row.canonical = target

    if alias_record is None:
        db.add(TagAlias(user_id=current_user.id, alias=source, canonical=target))
    else:
        alias_record.canonical = target

    for row in alias_rows:
        if row.alias == row.canonical:
            await db.delete(row)

    await db.flush()
    await db.commit()
    return await _build_tag_summaries(
        db,
        current_user.id,
        search=None,
        limit=100,
    )


@router.post("/merge", response_model=list[TagSummaryResponse])
async def merge_tags(
    body: TagMergeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    target = normalize_tag(body.target_tag)
    sources = [normalize_tag(tag) for tag in body.source_tags]
    sources = [tag for tag in sources if tag and tag != target]
    sources = list(dict.fromkeys(sources))

    if not target or not sources:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="target_tag and at least one source tag are required",
        )

    videos_result = await db.execute(
        select(Video).where(Video.user_id == current_user.id)
    )
    videos = videos_result.scalars().all()

    source_set = set(sources)
    for video in videos:
        if not video.keywords:
            continue
        replaced = [
            target if normalize_tag(tag) in source_set else tag
            for tag in video.keywords
        ]
        video.keywords = await canonicalize_keywords(db, replaced, current_user.id)

    alias_result = await db.execute(
        select(TagAlias).where(TagAlias.user_id == current_user.id)
    )
    alias_rows = alias_result.scalars().all()
    alias_map = {row.alias: row for row in alias_rows}

    for source in sources:
        row = alias_map.get(source)
        if row is None:
            db.add(TagAlias(user_id=current_user.id, alias=source, canonical=target))
        else:
            row.canonical = target

    for row in alias_rows:
        if row.canonical in source_set:
            row.canonical = target
        if row.alias == row.canonical:
            await db.delete(row)

    await db.flush()
    await db.commit()
    return await _build_tag_summaries(
        db,
        current_user.id,
        search=None,
        limit=100,
    )


@router.delete("/{tag}", response_model=list[TagSummaryResponse])
async def delete_tag(
    tag: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    target = normalize_tag(tag)
    if not target:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="tag is required",
        )

    videos_result = await db.execute(
        select(Video).where(Video.user_id == current_user.id)
    )
    videos = videos_result.scalars().all()

    for video in videos:
        if not video.keywords:
            continue
        remaining = [kw for kw in video.keywords if normalize_tag(kw) != target]
        video.keywords = await canonicalize_keywords(db, remaining, current_user.id)

    alias_result = await db.execute(
        select(TagAlias).where(TagAlias.user_id == current_user.id)
    )
    alias_rows = alias_result.scalars().all()
    for row in alias_rows:
        if row.alias == target or row.canonical == target:
            await db.delete(row)

    await db.flush()
    await db.commit()
    return await _build_tag_summaries(
        db,
        current_user.id,
        search=None,
        limit=100,
    )
