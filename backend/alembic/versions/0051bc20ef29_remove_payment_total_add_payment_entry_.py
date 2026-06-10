"""Remove payment.total + Add payment_entry.currency_code

Revision ID: 0051bc20ef29
Revises: 67f7bc3ffc60
Create Date: 2025-05-26 21:50:56.103533

"""

import sqlalchemy as sa
import sqlmodel
from alembic import op

# revision identifiers, used by Alembic.
revision = "0051bc20ef29"
down_revision = "67f7bc3ffc60"
branch_labels = None
depends_on = None


def upgrade():
    # Drop payment.total column
    op.drop_column("payment", "total")

    # Add the new column as nullable
    op.add_column(
        "payment_entry",
        sa.Column("currency_code", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    )

    # Set default value for currency_code
    connection = op.get_bind()
    connection.execute(sa.text("UPDATE payment_entry SET currency_code = 'USD'"))

    # Make the new column non-nullable
    op.alter_column('payment_entry', 'currency_code', nullable=False)

    # Add constraints
    op.create_foreign_key(
        "fk_payment_entry_currency_code_currency",
        "payment_entry",
        "currency",
        ["currency_code"],
        ["code"],
    )


def downgrade():
    # Drop payment_entry.currency_code column
    op.drop_constraint(
        "fk_payment_entry_currency_code_currency", "payment_entry", type_="foreignkey"
    )
    op.drop_column("payment_entry", "currency_code")

    # Add the new column as nullable
    op.add_column(
        "payment",
        sa.Column("total", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    )

    # Set the default value for total
    connection = op.get_bind()
    connection.execute(sa.text("UPDATE payment SET total = 0.0"))

    # Make the new column non-nullable
    op.alter_column('payment', 'total', nullable=False)
