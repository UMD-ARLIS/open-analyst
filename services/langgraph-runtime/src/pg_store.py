"""Custom PostgreSQL store for the inmem runtime edition.

Provides durable key-value/memory persistence without requiring the licensed
langgraph-runtime-postgres package or a LangSmith API key.
"""

from __future__ import annotations

import os

import psycopg
from langgraph.store.postgres import AsyncPostgresStore
from psycopg_pool import AsyncConnectionPool

_pool: AsyncConnectionPool | None = None
_store: AsyncPostgresStore | None = None


def _get_dsn() -> str:
    dsn = os.environ.get("CHECKPOINT_POSTGRES_URI") or os.environ.get("DATABASE_URL", "")
    if not dsn:
        raise RuntimeError("CHECKPOINT_POSTGRES_URI or DATABASE_URL must be set")
    return dsn.replace("sslmode=no-verify", "sslmode=require")


async def create_store() -> AsyncPostgresStore:
    """Factory called by the LangGraph API via LANGGRAPH_STORE config."""
    global _pool, _store
    if _store is not None:
        return _store

    dsn = _get_dsn()

    # Run migrations with a direct connection (autocommit) to allow
    # CREATE INDEX CONCURRENTLY which cannot run inside a transaction.
    async with await psycopg.AsyncConnection.connect(dsn, autocommit=True) as conn:
        tmp = AsyncPostgresStore(conn=conn)
        await tmp.setup()

    _pool = AsyncConnectionPool(conninfo=dsn, min_size=2, max_size=10, open=False)
    await _pool.open()

    _store = AsyncPostgresStore(conn=_pool)
    return _store
