"""Drop transaction timezone

Revision ID: be372c32e055
Revises: 59ab8c96d8e6
Create Date: 2026-06-10 01:37:44.496893

"""

import sqlalchemy as sa

from alembic import op
from kayman.schemas._custom_types import SATimezone

# revision identifiers, used by Alembic.
revision = "be372c32e055"
down_revision = "59ab8c96d8e6"
branch_labels = None
depends_on = None


def upgrade():
    op.drop_column("transaction", "timezone")


def downgrade():
    op.add_column("transaction", sa.Column("timezone", SATimezone(), nullable=True))
    op.execute(
        """
        UPDATE transaction
        SET timezone = account.timezone
        FROM account
        WHERE transaction.account_id = account.id
        """
    )
    op.alter_column(
        "transaction", "timezone", existing_type=SATimezone(), nullable=False
    )
