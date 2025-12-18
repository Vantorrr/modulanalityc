"""Make biomarker default_unit nullable

Revision ID: 20251218_073000
Revises: 20251212_000000
Create Date: 2025-12-18 07:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20251218_073000'
down_revision = '20251212_000000'
branch_labels = None
depends_on = None


def upgrade():
    # Make default_unit nullable
    op.alter_column('biomarkers', 'default_unit',
               existing_type=sa.VARCHAR(length=50),
               nullable=True)


def downgrade():
    # Make default_unit NOT NULL again
    op.alter_column('biomarkers', 'default_unit',
               existing_type=sa.VARCHAR(length=50),
               nullable=False)

