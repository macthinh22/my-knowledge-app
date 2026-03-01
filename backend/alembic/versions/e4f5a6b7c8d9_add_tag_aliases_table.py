from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "e4f5a6b7c8d9"
down_revision: Union[str, Sequence[str], None] = "d3f4a5b6c7d8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "tag_aliases",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("alias", sa.String(length=100), nullable=False),
        sa.Column("canonical", sa.String(length=100), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("alias"),
    )
    op.create_index("ix_tag_aliases_alias", "tag_aliases", ["alias"], unique=False)
    op.create_index(
        "ix_tag_aliases_canonical", "tag_aliases", ["canonical"], unique=False
    )


def downgrade() -> None:
    op.drop_index("ix_tag_aliases_canonical", table_name="tag_aliases")
    op.drop_index("ix_tag_aliases_alias", table_name="tag_aliases")
    op.drop_table("tag_aliases")
