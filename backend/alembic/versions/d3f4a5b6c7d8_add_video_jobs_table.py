from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "d3f4a5b6c7d8"
down_revision: Union[str, Sequence[str], None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "video_jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("youtube_url", sa.String(length=500), nullable=False),
        sa.Column("youtube_id", sa.String(length=20), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("current_step", sa.Integer(), nullable=False),
        sa.Column("total_steps", sa.Integer(), nullable=False),
        sa.Column("step_label", sa.String(length=120), nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("video_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False
        ),
        sa.ForeignKeyConstraint(["video_id"], ["videos.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_video_jobs_youtube_id", "video_jobs", ["youtube_id"], unique=False
    )
    op.create_index("ix_video_jobs_status", "video_jobs", ["status"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_video_jobs_status", table_name="video_jobs")
    op.drop_index("ix_video_jobs_youtube_id", table_name="video_jobs")
    op.drop_table("video_jobs")
