"""Payment entry transaction index

Revision ID: d750f208cb59
Revises: c0db25a49f08
Create Date: 2025-05-18 09:52:15.281205

"""
import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = 'd750f208cb59'
down_revision = 'c0db25a49f08'
branch_labels = None
depends_on = None


def upgrade():
    # Add the new column as nullable
    op.add_column('payment_entry', sa.Column('index', sa.Integer(), nullable=True))
    op.add_column('transaction', sa.Column('index', sa.Integer(), nullable=True))

    # Populate existing rows with group-wise index per payment
    connection = op.get_bind()
    metadata = sa.MetaData()
    metadata.reflect(bind=connection, only=['payment', 'payment_entry', 'transaction'])
    payment_table = sa.Table('payment', metadata, autoload_with=connection)
    entry_table = sa.Table('payment_entry', metadata, autoload_with=connection)
    trans_table = sa.Table('transaction', metadata, autoload_with=connection)

    # Loop through each payment and set entry index
    payment_ids = [row[0] for row in connection.execute(sa.select(payment_table.c.id))]
    for pid in payment_ids:
        # PaymentEntry indexes
        entry_rows = connection.execute(
            sa.select(entry_table.c.id)
            .where(entry_table.c.payment_id == pid)
            .order_by(entry_table.c.id)
        ).fetchall()
        for idx, (eid,) in enumerate(entry_rows):
            connection.execute(
                entry_table.update()
                .where(entry_table.c.id == eid)
                .values(index=idx)
            )
        # Transaction indexes
        trans_rows = connection.execute(
            sa.select(trans_table.c.id)
            .where(trans_table.c.payment_id == pid)
            .order_by(trans_table.c.id)
        ).fetchall()
        for idx, (tid,) in enumerate(trans_rows):
            connection.execute(
                trans_table.update()
                .where(trans_table.c.id == tid)
                .values(index=idx)
            )

    # Make the new column non-nullable
    op.alter_column('payment_entry', 'index', nullable=False)
    op.alter_column('transaction', 'index', nullable=False)

    # Add constraints
    op.create_unique_constraint(None, 'payment_entry', ['payment_id', 'index'])
    op.create_unique_constraint(None, 'transaction', ['payment_id', 'index'])


def downgrade():
    op.drop_constraint("transaction_payment_id_index_key", 'transaction', type_='unique')
    op.drop_column('transaction', 'index')

    op.drop_constraint("payment_entry_payment_id_index_key", 'payment_entry', type_='unique')
    op.drop_column('payment_entry', 'index')
