"""replace_summary_with_knowledge_analysis_fields

Revision ID: a1b2c3d4e5f6
Revises: c10c7cbe6f3a
Create Date: 2026-02-20 20:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'c10c7cbe6f3a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Replace old summary columns with new knowledge analysis columns."""
    # Add new columns
    op.add_column('videos', sa.Column('explanation', sa.Text(), nullable=True))
    op.add_column('videos', sa.Column('key_knowledge', sa.Text(), nullable=True))
    op.add_column('videos', sa.Column('critical_analysis', sa.Text(), nullable=True))
    op.add_column('videos', sa.Column('real_world_applications', sa.Text(), nullable=True))

    # Drop old summary columns
    op.drop_column('videos', 'overview')
    op.drop_column('videos', 'detailed_summary')
    op.drop_column('videos', 'key_takeaways')


def downgrade() -> None:
    """Restore old summary columns and remove knowledge analysis columns."""
    # Restore old columns
    op.add_column('videos', sa.Column('overview', sa.Text(), nullable=True))
    op.add_column('videos', sa.Column('detailed_summary', sa.Text(), nullable=True))
    op.add_column('videos', sa.Column('key_takeaways', sa.Text(), nullable=True))

    # Drop new columns
    op.drop_column('videos', 'explanation')
    op.drop_column('videos', 'key_knowledge')
    op.drop_column('videos', 'critical_analysis')
    op.drop_column('videos', 'real_world_applications')
