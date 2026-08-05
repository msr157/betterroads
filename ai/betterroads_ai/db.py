"""Database connection helpers.

The engine talks straight SQL over psycopg (no ORM). Connection info comes
from the ``DATABASE_URL`` environment variable, e.g.::

    postgresql://user:pass@host:5432/betterroads

``psycopg`` is imported lazily inside :func:`connect` so that the pure
computation modules (grid / classify / rebuild planning) stay importable and
testable without a database driver or a database.
"""

from __future__ import annotations

import os


def database_url() -> str:
    """Return the normalized DATABASE_URL, raising a clear error if unset."""
    url = os.environ.get("DATABASE_URL", "").strip()
    if not url:
        raise RuntimeError(
            "DATABASE_URL is not set. "
            "Expected e.g. postgresql://user:pass@host:5432/betterroads"
        )
    # Heroku-style alias: psycopg wants the postgresql:// scheme.
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://") :]
    return url


def connect():
    """Open a psycopg connection (autocommit off; callers manage transactions)."""
    import psycopg  # local import: keep module import-clean without the driver

    return psycopg.connect(database_url())
