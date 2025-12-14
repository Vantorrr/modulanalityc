"""add_new_biomarker_categories

Revision ID: 2b3f3ee31c88
Revises: 8a21d17ff6d2
Create Date: 2025-12-14 14:27:19.330098+00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2b3f3ee31c88'
down_revision: Union[str, None] = '8a21d17ff6d2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade database schema."""
    # Add new biomarker categories to the enum
    op.execute("ALTER TYPE biomarkercategory ADD VALUE IF NOT EXISTS 'gastrointestinal'")
    op.execute("ALTER TYPE biomarkercategory ADD VALUE IF NOT EXISTS 'bone'")
    op.execute("ALTER TYPE biomarkercategory ADD VALUE IF NOT EXISTS 'musculoskeletal'")
    op.execute("ALTER TYPE biomarkercategory ADD VALUE IF NOT EXISTS 'adrenal'")
    op.execute("ALTER TYPE biomarkercategory ADD VALUE IF NOT EXISTS 'nervous'")
    op.execute("ALTER TYPE biomarkercategory ADD VALUE IF NOT EXISTS 'pancreas'")
    op.execute("ALTER TYPE biomarkercategory ADD VALUE IF NOT EXISTS 'parathyroid'")
    op.execute("ALTER TYPE biomarkercategory ADD VALUE IF NOT EXISTS 'cardiovascular'")
    op.execute("ALTER TYPE biomarkercategory ADD VALUE IF NOT EXISTS 'reproductive'")
    op.execute("ALTER TYPE biomarkercategory ADD VALUE IF NOT EXISTS 'urinary'")
    op.execute("ALTER TYPE biomarkercategory ADD VALUE IF NOT EXISTS 'immune'")
    op.execute("ALTER TYPE biomarkercategory ADD VALUE IF NOT EXISTS 'coagulation'")


def downgrade() -> None:
    """Downgrade database schema."""
    # Note: PostgreSQL does not support removing enum values
    # You would need to recreate the enum type to remove values
    pass



