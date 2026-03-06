from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Collection, User, Video, collection_videos
from app.schemas import (
    AddVideoToCollectionRequest,
    CollectionCreate,
    CollectionUpdate,
    CollectionResponse,
    CollectionDetailResponse,
)

router = APIRouter(prefix="/api/collections", tags=["collections"])


@router.post("", response_model=CollectionResponse, status_code=status.HTTP_201_CREATED)
async def create_collection(
    body: CollectionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    collection = Collection(
        user_id=current_user.id,
        name=body.name,
        description=body.description,
    )
    db.add(collection)
    await db.commit()
    await db.refresh(collection)
    return CollectionResponse(
        id=collection.id,
        name=collection.name,
        description=collection.description,
        video_count=0,
        created_at=collection.created_at,
        updated_at=collection.updated_at,
    )


@router.get("", response_model=list[CollectionResponse])
async def list_collections(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Collection)
        .options(selectinload(Collection.videos))
        .where(Collection.user_id == current_user.id)
        .order_by(Collection.name)
    )
    collections = result.scalars().all()
    return [
        CollectionResponse(
            id=c.id,
            name=c.name,
            description=c.description,
            video_count=len(c.videos),
            created_at=c.created_at,
            updated_at=c.updated_at,
        )
        for c in collections
    ]


@router.get("/{collection_id}", response_model=CollectionDetailResponse)
async def get_collection(
    collection_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Collection)
        .options(selectinload(Collection.videos))
        .where(
            Collection.id == collection_id,
            Collection.user_id == current_user.id,
        )
    )
    collection = result.scalar_one_or_none()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    return CollectionDetailResponse(
        id=collection.id,
        name=collection.name,
        description=collection.description,
        video_count=len(collection.videos),
        video_ids=[v.id for v in collection.videos],
        created_at=collection.created_at,
        updated_at=collection.updated_at,
    )


@router.patch("/{collection_id}", response_model=CollectionResponse)
async def update_collection(
    collection_id: str,
    body: CollectionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Collection).where(
            Collection.id == collection_id,
            Collection.user_id == current_user.id,
        )
    )
    collection = result.scalar_one_or_none()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    if body.name is not None:
        collection.name = body.name
    if body.description is not None:
        collection.description = body.description
    await db.commit()
    await db.refresh(collection)
    count_result = await db.execute(
        select(func.count())
        .select_from(collection_videos)
        .where(collection_videos.c.collection_id == collection.id)
    )
    return CollectionResponse(
        id=collection.id,
        name=collection.name,
        description=collection.description,
        video_count=count_result.scalar() or 0,
        created_at=collection.created_at,
        updated_at=collection.updated_at,
    )


@router.delete("/{collection_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_collection(
    collection_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Collection).where(
            Collection.id == collection_id,
            Collection.user_id == current_user.id,
        )
    )
    collection = result.scalar_one_or_none()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    await db.delete(collection)
    await db.commit()


@router.post("/{collection_id}/videos", status_code=status.HTTP_200_OK)
async def add_video_to_collection(
    collection_id: str,
    body: AddVideoToCollectionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Collection)
        .options(selectinload(Collection.videos))
        .where(
            Collection.id == collection_id,
            Collection.user_id == current_user.id,
        )
    )
    collection = result.scalar_one_or_none()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")

    video_result = await db.execute(
        select(Video).where(
            Video.id == body.video_id,
            Video.user_id == current_user.id,
        )
    )
    video = video_result.scalar_one_or_none()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    if video not in collection.videos:
        collection.videos.append(video)
        await db.commit()
    return {"ok": True}


@router.delete(
    "/{collection_id}/videos/{video_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_video_from_collection(
    collection_id: str,
    video_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Collection)
        .options(selectinload(Collection.videos))
        .where(
            Collection.id == collection_id,
            Collection.user_id == current_user.id,
        )
    )
    collection = result.scalar_one_or_none()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")

    video_result = await db.execute(
        select(Video).where(
            Video.id == video_id,
            Video.user_id == current_user.id,
        )
    )
    video = video_result.scalar_one_or_none()
    if video and video in collection.videos:
        collection.videos.remove(video)
        await db.commit()
