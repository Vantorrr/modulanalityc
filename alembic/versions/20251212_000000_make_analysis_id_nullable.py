"""make analysis_id nullable in user_biomarkers

Revision ID: 8a21d17ff6d2
Revises: 7f10c16ee5c1
Create Date: 2025-12-12 00:00:00.000000+00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "8a21d17ff6d2"
down_revision: Union[str, None] = "7f10c16ee5c1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Make analysis_id nullable to allow manual biomarker entries."""
    # SQLite doesn't support ALTER COLUMN, so we need to use batch mode
    with op.batch_alter_table('user_biomarkers', schema=None) as batch_op:
        batch_op.alter_column(
            'analysis_id',
            existing_type=sa.Integer(),
            nullable=True,
            existing_comment=None,
            comment='NULL for manually added values',
        )


def downgrade() -> None:
    """Revert analysis_id to NOT NULL."""
    # Delete manually added values first
    op.execute('DELETE FROM user_biomarkers WHERE analysis_id IS NULL')
    
    with op.batch_alter_table('user_biomarkers', schema=None) as batch_op:
        batch_op.alter_column(
            'analysis_id',
            existing_type=sa.Integer(),
            nullable=False,
            existing_comment='NULL for manually added values',
            comment=None,
        )

