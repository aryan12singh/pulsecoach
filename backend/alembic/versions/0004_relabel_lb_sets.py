"""Relabel lb strength sets to kg.

A pre-fix Hevy adapter bug stored weight values from the API's weight_kg field
(always kilograms) but labeled the row with the user's *display* unit, so
lb-labeled rows actually hold kilogram values. Hevy is the only source that
ever wrote lb rows (manual entry and CSV import were always kg), so the fix is
a relabel — the numeric value is already correct and must NOT be converted.

Revision ID: 0004
Revises: 0003
Create Date: 2026-07-03
"""
from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("UPDATE strength_sets SET weight_unit = 'kg' WHERE weight_unit = 'lb'")


def downgrade() -> None:
    # Irreversible relabel; original display units were never stored correctly.
    pass
