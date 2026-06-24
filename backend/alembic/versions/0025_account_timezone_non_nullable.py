"""Account timezone non-nullable

Revision ID: 59ab8c96d8e6
Revises: db51787ee569
Create Date: 2026-06-10 01:25:11.000000

"""

import sqlalchemy as sa

from alembic import op
from kayman.schemas._custom_types import SATimezone

# revision identifiers, used by Alembic.
revision = "59ab8c96d8e6"
down_revision = "db51787ee569"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("UPDATE account SET timezone = 'UTC' WHERE timezone IS NULL")
    op.alter_column("account", "timezone", existing_type=SATimezone(), nullable=False)


def downgrade():
    op.alter_column("account", "timezone", existing_type=SATimezone(), nullable=True)
