from typing import Sequence, Union
import uuid

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "f5g6h7i8j9k0"
down_revision: Union[str, Sequence[str], None] = "e4f5a6b7c8d9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


DEFAULT_CATEGORIES = [
    ("technology", "Technology"),
    ("business-finance", "Business & Finance"),
    ("personal-development", "Personal Development"),
    ("knowledge-education", "Knowledge & Education"),
    ("other", "Other"),
]


def upgrade() -> None:
    categories_table = op.create_table(
        "categories",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("slug", sa.String(length=50), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
    )
    op.create_index("ix_categories_slug", "categories", ["slug"], unique=False)

    op.bulk_insert(
        categories_table,
        [
            {"id": uuid.uuid4(), "slug": slug, "name": name}
            for slug, name in DEFAULT_CATEGORIES
        ],
    )

    op.add_column("videos", sa.Column("category", sa.String(length=50), nullable=True))


def downgrade() -> None:
    op.drop_column("videos", "category")
    op.drop_index("ix_categories_slug", table_name="categories")
    op.drop_table("categories")
