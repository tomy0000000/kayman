"""statement due_on nullable

Revision ID: 0053
Revises: 0052
Create Date: 2026-10-24 00:00:00.000000

"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "0053"
down_revision = "0052"
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column("statement", "due_on", existing_type=sa.Date(), nullable=True)


def downgrade():
    op.alter_column("statement", "due_on", existing_type=sa.Date(), nullable=False)
