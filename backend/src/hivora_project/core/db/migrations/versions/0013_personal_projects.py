"""personal projects

Revision ID: 0013
Revises: 0012
Create Date: 2026-11-13 10:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0013"
down_revision: str | None = "0012"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # An account's personal project (My kanban): one at most, gone with the account.
    with op.batch_alter_table("project", schema=None) as batch_op:
        batch_op.add_column(sa.Column("owner_id", sa.Integer(), nullable=True))
        batch_op.create_unique_constraint(batch_op.f("uq_project_owner_id"), ["owner_id"])
        batch_op.create_foreign_key(
            batch_op.f("fk_project_owner_id_user"), "user", ["owner_id"], ["id"], ondelete="CASCADE"
        )


def downgrade() -> None:
    op.execute("DELETE FROM project WHERE owner_id IS NOT NULL")
    with op.batch_alter_table("project", schema=None) as batch_op:
        batch_op.drop_constraint(batch_op.f("fk_project_owner_id_user"), type_="foreignkey")
        batch_op.drop_constraint(batch_op.f("uq_project_owner_id"), type_="unique")
        batch_op.drop_column("owner_id")
