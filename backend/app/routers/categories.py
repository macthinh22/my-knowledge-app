import re

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Category, User, Video
from app.schemas import CategoryCreate, CategoryResponse, CategoryUpdate


router = APIRouter(prefix="/api/categories", tags=["categories"])


_SLUG_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
_DEFAULT_CATEGORY_SLUGS = {
    "technology",
    "business-finance",
    "personal-development",
    "knowledge-education",
    "other",
}
VALID_COLORS = {
    "slate",
    "red",
    "orange",
    "amber",
    "emerald",
    "teal",
    "blue",
    "indigo",
    "violet",
    "rose",
}


def _normalize_slug(value: str) -> str:
    return value.strip().lower()


@router.get("", response_model=list[CategoryResponse])
async def list_categories(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Category)
        .where(Category.user_id == current_user.id)
        .order_by(Category.display_order.asc(), Category.created_at.asc())
    )
    return result.scalars().all()


@router.post("", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(
    body: CategoryCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
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

    existing_result = await db.execute(
        select(Category).where(
            Category.slug == slug,
            Category.user_id == current_user.id,
        )
    )
    if existing_result.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Category already exists",
        )

    max_order_result = await db.execute(
        select(func.coalesce(func.max(Category.display_order), -1)).where(
            Category.user_id == current_user.id
        )
    )
    next_order = max_order_result.scalar_one() + 1

    category = Category(
        user_id=current_user.id,
        slug=slug,
        name=name,
        color=body.color,
        display_order=next_order,
    )
    db.add(category)
    await db.flush()
    await db.refresh(category)
    return category


@router.delete("/{slug}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    slug: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    normalized_slug = _normalize_slug(slug)

    if normalized_slug in _DEFAULT_CATEGORY_SLUGS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Default categories cannot be deleted",
        )

    category_result = await db.execute(
        select(Category).where(
            Category.slug == normalized_slug,
            Category.user_id == current_user.id,
        )
    )
    category = category_result.scalar_one_or_none()
    if category is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found",
        )

    videos_result = await db.execute(
        select(Video).where(
            Video.category == normalized_slug,
            Video.user_id == current_user.id,
        )
    )
    for video in videos_result.scalars().all():
        video.category = None

    await db.delete(category)


@router.patch("/{slug}", response_model=CategoryResponse)
async def update_category(
    slug: str,
    body: CategoryUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    normalized_slug = _normalize_slug(slug)
    category_result = await db.execute(
        select(Category).where(
            Category.slug == normalized_slug,
            Category.user_id == current_user.id,
        )
    )
    category = category_result.scalar_one_or_none()
    if category is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found",
        )

    if body.name is not None:
        name = body.name.strip()
        if not name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Name cannot be empty",
            )
        category.name = name

    if body.color is not None:
        if body.color not in VALID_COLORS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid color. Must be one of: {', '.join(sorted(VALID_COLORS))}",
            )
        category.color = body.color

    if body.display_order is not None:
        category.display_order = body.display_order

    await db.flush()
    await db.refresh(category)
    return category
