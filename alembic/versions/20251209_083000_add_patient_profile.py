"""Add patient profile table

Revision ID: d53f1c8d8bbd
Revises: c42e0b7c7aac
Create Date: 2025-12-09 08:30:00.000000+00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd53f1c8d8bbd'
down_revision: Union[str, None] = 'c42e0b7c7aac'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('patient_profiles',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('body_parameters', sa.JSON(), nullable=True),
        sa.Column('gender_health', sa.JSON(), nullable=True),
        sa.Column('medical_history', sa.JSON(), nullable=True),
        sa.Column('allergies', sa.JSON(), nullable=True),
        sa.Column('chronic_diseases', sa.JSON(), nullable=True),
        sa.Column('hereditary_diseases', sa.JSON(), nullable=True),
        sa.Column('lifestyle', sa.JSON(), nullable=True),
        sa.Column('additional_info', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_patient_profiles_id'), 'patient_profiles', ['id'], unique=False)
    op.create_index(op.f('ix_patient_profiles_user_id'), 'patient_profiles', ['user_id'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_patient_profiles_user_id'), table_name='patient_profiles')
    op.drop_index(op.f('ix_patient_profiles_id'), table_name='patient_profiles')
    op.drop_table('patient_profiles')

