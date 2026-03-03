from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "g6h7i8j9k0l1"
down_revision: Union[str, Sequence[str], None] = "04e7e3c760e5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


DEFAULT_COLORS = {
    "technology": "blue",
    "business-finance": "emerald",
    "personal-development": "rose",
    "knowledge-education": "amber",
    "other": "slate",
}


def upgrade() -> None:
    op.add_column("categories", sa.Column("color", sa.String(20), nullable=True))
    op.add_column(
        "categories",
        sa.Column("display_order", sa.Integer(), nullable=False, server_default="0"),
    )

    for i, (slug, color) in enumerate(DEFAULT_COLORS.items()):
        op.execute(
            sa.text(
                "UPDATE categories SET color = :color, display_order = :order WHERE slug = :slug"
            ).bindparams(color=color, order=i, slug=slug)
        )


def downgrade() -> None:
    op.drop_column("categories", "display_order")
    op.drop_column("categories", "color")
