"""project pins

Revision ID: 0009
Revises: 0008
Create Date: 2026-11-11 12:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0009"
down_revision: str | None = "0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "project_pin",
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["project_id"],
            ["project.id"],
            name=op.f("fk_project_pin_project_id_project"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["user.id"], name=op.f("fk_project_pin_user_id_user"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("project_id", "user_id", name=op.f("pk_project_pin")),
    )
    with op.batch_alter_table("project_pin", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_project_pin_user_id"), ["user_id"], unique=False)
    # Until now every project was in the side menu: keep it so for its members.
    op.execute(
        "INSERT INTO project_pin (project_id, user_id) SELECT project_id, user_id FROM project_member"
    )


def downgrade() -> None:
    with op.batch_alter_table("project_pin", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_project_pin_user_id"))
    op.drop_table("project_pin")
