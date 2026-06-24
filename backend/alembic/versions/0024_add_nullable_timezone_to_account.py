"""Add nullable timezone to account

Revision ID: db51787ee569
Revises: 3f6b892b23da
Create Date: 2026-06-10 00:30:51.945994

"""

import sqlalchemy as sa

from alembic import op
from kayman.schemas._custom_types import SATimezone

# revision identifiers, used by Alembic.
revision = "db51787ee569"
down_revision = "3f6b892b23da"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("account", sa.Column("timezone", SATimezone(), nullable=True))


def downgrade():
    op.drop_column("account", "timezone")
