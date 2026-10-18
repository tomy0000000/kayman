"""rename eventtype labels

Revision ID: 0051
Revises: 0050
Create Date: 2026-10-18 22:20:00.000000

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "0051"
down_revision = "0050"
branch_labels = None
depends_on = None

# Hand-written: autogenerate cannot detect enum label renames.
# ALTER TYPE ... RENAME VALUE is transactional on PostgreSQL >= 12 (the
# project's target), so plain op.execute inside the migration transaction
# is fine.
EVENT_TYPE_RENAMES = [
    ("Expense", "EXPENSE"),
    ("Income", "INCOME"),
    ("Transfer", "TRANSFER"),
    ("Exchange", "EXCHANGE"),
]


def upgrade():
    for old, new in EVENT_TYPE_RENAMES:
        op.execute(f"ALTER TYPE eventtype RENAME VALUE '{old}' TO '{new}'")


def downgrade():
    for old, new in EVENT_TYPE_RENAMES:
        op.execute(f"ALTER TYPE eventtype RENAME VALUE '{new}' TO '{old}'")
