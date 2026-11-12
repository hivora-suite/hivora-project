"""personal events

Revision ID: 0012
Revises: 0011
Create Date: 2026-11-12 16:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0012"
down_revision: str | None = "0011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # An event belongs to a project, or to one account (personal): never both.
    with op.batch_alter_table("calendar_event", schema=None) as batch_op:
        batch_op.alter_column("project_id", existing_type=sa.Integer(), nullable=True)
        batch_op.add_column(sa.Column("owner_id", sa.Integer(), nullable=True))
        batch_op.create_index(batch_op.f("ix_calendar_event_owner_id"), ["owner_id"], unique=False)
        batch_op.create_foreign_key(
            batch_op.f("fk_calendar_event_owner_id_user"),
            "user",
            ["owner_id"],
            ["id"],
            ondelete="CASCADE",
        )
        batch_op.create_check_constraint(
            batch_op.f("ck_calendar_event_one_scope"), "(project_id IS NULL) <> (owner_id IS NULL)"
        )


def downgrade() -> None:
    op.execute("DELETE FROM calendar_event WHERE project_id IS NULL")
    with op.batch_alter_table("calendar_event", schema=None) as batch_op:
        batch_op.drop_constraint(batch_op.f("ck_calendar_event_one_scope"), type_="check")
        batch_op.drop_constraint(batch_op.f("fk_calendar_event_owner_id_user"), type_="foreignkey")
        batch_op.drop_index(batch_op.f("ix_calendar_event_owner_id"))
        batch_op.drop_column("owner_id")
        batch_op.alter_column("project_id", existing_type=sa.Integer(), nullable=False)
