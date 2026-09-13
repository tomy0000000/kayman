"""account type not null

Revision ID: 0050
Revises: 0049
Create Date: 2026-09-12 17:10:02.485289

"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "0050"
down_revision = "0049"
branch_labels = None
depends_on = None

account_type = sa.Enum(
    "CASH", "CREDIT_CARD", "INVESTMENT", "REWARD", name="account_type"
)


def upgrade():
    # 0049 backfilled every row it saw, this covers anything inserted since
    op.execute("UPDATE account SET type = 'CASH' WHERE type IS NULL")
    op.alter_column("account", "type", existing_type=account_type, nullable=False)


def downgrade():
    op.alter_column("account", "type", existing_type=account_type, nullable=True)
