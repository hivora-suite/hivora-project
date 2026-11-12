"""done columns

Revision ID: 0015
Revises: 0014
Create Date: 2026-11-13 16:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0015"
down_revision: str | None = "0014"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Each board's "Done" column: a card in it is validated. A plain ADD COLUMN: a batch copy
    # would drop board_column, which the cards' foreign keys forbid on a filled database.
    op.add_column(
        "board_column", sa.Column("done", sa.Boolean(), nullable=False, server_default=sa.false())
    )
    # Existing boards: their column named like the default one, the first if several.
    op.execute(
        "UPDATE board_column SET done = TRUE WHERE id IN ("
        " SELECT MIN(id) FROM board_column"
        " WHERE LOWER(name) IN ('terminé', 'termine', 'done') GROUP BY project_id)"
    )


def downgrade() -> None:
    op.drop_column("board_column", "done")
