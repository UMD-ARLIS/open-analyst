"""Custom PostgreSQL checkpointer for the inmem runtime edition.

Provides durable checkpoint persistence without requiring the licensed
langgraph-runtime-postgres package or a LangSmith API key.
"""

from __future__ import annotations

import os

import psycopg
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from psycopg_pool import AsyncConnectionPool

_pool: AsyncConnectionPool | None = None
_checkpointer: AsyncPostgresSaver | None = None


def _get_dsn() -> str:
    dsn = os.environ.get("CHECKPOINT_POSTGRES_URI") or os.environ.get("DATABASE_URL", "")
    if not dsn:
        raise RuntimeError("CHECKPOINT_POSTGRES_URI or DATABASE_URL must be set")
    return dsn.replace("sslmode=no-verify", "sslmode=require")


async def create_checkpointer() -> AsyncPostgresSaver:
    """Factory called by the LangGraph API via LANGGRAPH_CHECKPOINTER config."""
    global _pool, _checkpointer
    if _checkpointer is not None:
        return _checkpointer

    dsn = _get_dsn()

    # Run migrations with a direct connection (autocommit) to allow
    # CREATE INDEX CONCURRENTLY which cannot run inside a transaction.
    async with await psycopg.AsyncConnection.connect(dsn, autocommit=True) as conn:
        tmp = AsyncPostgresSaver(conn=conn)
        await tmp.setup()

    _pool = AsyncConnectionPool(conninfo=dsn, min_size=2, max_size=10, open=False)
    await _pool.open()

    _checkpointer = AsyncPostgresSaver(conn=_pool)
    return _checkpointer
