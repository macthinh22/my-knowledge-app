import re

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Category, Video
from app.schemas import CategoryCreate, CategoryResponse


router = APIRouter(prefix="/api/categories", tags=["categories"])


_SLUG_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
_DEFAULT_CATEGORY_SLUGS = {
    "technology",
    "business-finance",
    "personal-development",
    "knowledge-education",
    "other",
}


def _normalize_slug(value: str) -> str:
    return value.strip().lower()


@router.get("", response_model=list[CategoryResponse])
async def list_categories(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Category).order_by(Category.created_at.asc()))
    return result.scalars().all()


@router.post("", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(body: CategoryCreate, db: AsyncSession = Depends(get_db)):
    slug = _normalize_slug(body.slug)
    name = body.name.strip()

    if not slug or not _SLUG_PATTERN.fullmatch(slug):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Slug must use lowercase letters, numbers, and hyphens",
        )
    if not name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Name is required",
        )

    existing_result = await db.execute(select(Category).where(Category.slug == slug))
    if existing_result.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Category already exists",
        )

    category = Category(slug=slug, name=name)
    db.add(category)
    await db.flush()
    await db.refresh(category)
    return category


@router.delete("/{slug}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(slug: str, db: AsyncSession = Depends(get_db)):
    normalized_slug = _normalize_slug(slug)

    if normalized_slug in _DEFAULT_CATEGORY_SLUGS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Default categories cannot be deleted",
        )

    category_result = await db.execute(
        select(Category).where(Category.slug == normalized_slug)
    )
    category = category_result.scalar_one_or_none()
    if category is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found",
        )

    videos_result = await db.execute(
        select(Video).where(Video.category == normalized_slug)
    )
    for video in videos_result.scalars().all():
        video.category = None

    await db.delete(category)
