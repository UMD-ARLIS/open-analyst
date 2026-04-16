from __future__ import annotations

import json
from datetime import datetime
from typing import Any
from uuid import UUID

from psycopg.rows import dict_row
from psycopg_pool import AsyncConnectionPool

from config import settings


def _json_default(value: Any) -> Any:
    if isinstance(value, (datetime, UUID)):
        return str(value)
    raise TypeError(f"Value is not JSON serializable: {type(value)!r}")


def _json(value: Any) -> str:
    return json.dumps(value if value is not None else {}, default=_json_default)


class RuntimeDatabase:
    def __init__(self) -> None:
        self._pool: AsyncConnectionPool | None = None

    async def initialize(self) -> None:
        pool = await self._get_pool()
        async with pool.connection() as conn:
            await conn.execute(
                """
                CREATE TABLE IF NOT EXISTS runtime_threads (
                    id uuid PRIMARY KEY,
                    project_id uuid NOT NULL,
                    title text NOT NULL,
                    summary text,
                    analysis_mode text NOT NULL DEFAULT 'chat',
                    collection_id uuid,
                    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
                    last_values jsonb NOT NULL DEFAULT '{}'::jsonb,
                    current_run_id uuid,
                    status text NOT NULL DEFAULT 'idle',
                    created_at timestamptz NOT NULL DEFAULT NOW(),
                    updated_at timestamptz NOT NULL DEFAULT NOW(),
                    deleted_at timestamptz
                );

                CREATE INDEX IF NOT EXISTS runtime_threads_project_updated_idx
                    ON runtime_threads (project_id, updated_at DESC)
                    WHERE deleted_at IS NULL;

                CREATE TABLE IF NOT EXISTS runtime_runs (
                    id uuid PRIMARY KEY,
                    thread_id uuid NOT NULL REFERENCES runtime_threads(id) ON DELETE CASCADE,
                    status text NOT NULL,
                    input_payload jsonb,
                    command_payload jsonb,
                    error text,
                    created_at timestamptz NOT NULL DEFAULT NOW(),
                    updated_at timestamptz NOT NULL DEFAULT NOW(),
                    completed_at timestamptz,
                    last_event_seq integer NOT NULL DEFAULT 0
                );

                CREATE INDEX IF NOT EXISTS runtime_runs_thread_created_idx
                    ON runtime_runs (thread_id, created_at DESC);

                CREATE TABLE IF NOT EXISTS runtime_run_events (
                    id bigserial PRIMARY KEY,
                    run_id uuid NOT NULL REFERENCES runtime_runs(id) ON DELETE CASCADE,
                    sequence_no integer NOT NULL,
                    event_type text NOT NULL,
                    payload jsonb NOT NULL DEFAULT '{}'::jsonb,
                    created_at timestamptz NOT NULL DEFAULT NOW(),
                    UNIQUE (run_id, sequence_no)
                );

                CREATE INDEX IF NOT EXISTS runtime_run_events_run_seq_idx
                    ON runtime_run_events (run_id, sequence_no);

                CREATE TABLE IF NOT EXISTS runtime_interrupts (
                    id text PRIMARY KEY,
                    run_id uuid NOT NULL REFERENCES runtime_runs(id) ON DELETE CASCADE,
                    thread_id uuid NOT NULL REFERENCES runtime_threads(id) ON DELETE CASCADE,
                    interrupt_type text NOT NULL,
                    payload jsonb NOT NULL DEFAULT '{}'::jsonb,
                    status text NOT NULL DEFAULT 'pending',
                    resolution jsonb,
                    created_at timestamptz NOT NULL DEFAULT NOW(),
                    resolved_at timestamptz
                );

                CREATE INDEX IF NOT EXISTS runtime_interrupts_thread_status_idx
                    ON runtime_interrupts (thread_id, status, created_at DESC);
                """
            )
            await conn.commit()

    async def create_thread(
        self,
        *,
        thread_id: str,
        project_id: str,
        title: str,
        summary: str | None,
        analysis_mode: str,
        collection_id: str | None,
        metadata: dict[str, Any],
    ) -> dict[str, Any]:
        row = await self.fetchrow(
            """
            INSERT INTO runtime_threads (
                id, project_id, title, summary, analysis_mode, collection_id, metadata
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb)
            RETURNING *
            """,
            [
                thread_id,
                project_id,
                title,
                summary,
                analysis_mode,
                collection_id,
                _json(metadata),
            ],
        )
        if not row:
            raise RuntimeError("Failed to create runtime thread")
        return row

    async def get_thread(self, thread_id: str) -> dict[str, Any] | None:
        return await self.fetchrow(
            """
            SELECT *
            FROM runtime_threads
            WHERE id = %s AND deleted_at IS NULL
            LIMIT 1
            """,
            [thread_id],
        )

    async def search_threads(self, project_id: str, limit: int = 20) -> list[dict[str, Any]]:
        return await self.fetchall(
            """
            SELECT *
            FROM runtime_threads
            WHERE project_id = %s AND deleted_at IS NULL
            ORDER BY updated_at DESC
            LIMIT %s
            """,
            [project_id, limit],
        )

    async def update_thread(
        self,
        thread_id: str,
        *,
        title: str | None = None,
        summary: str | None = None,
        analysis_mode: str | None = None,
        collection_id: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any] | None:
        row = await self.fetchrow(
            """
            UPDATE runtime_threads
            SET
                title = COALESCE(%s, title),
                summary = COALESCE(%s, summary),
                analysis_mode = COALESCE(%s, analysis_mode),
                collection_id = CASE WHEN %s::boolean THEN %s ELSE collection_id END,
                metadata = COALESCE(%s::jsonb, metadata),
                updated_at = NOW()
            WHERE id = %s AND deleted_at IS NULL
            RETURNING *
            """,
            [
                title,
                summary,
                analysis_mode,
                collection_id is not None,
                collection_id,
                _json(metadata) if metadata is not None else None,
                thread_id,
            ],
        )
        return row

    async def soft_delete_thread(self, thread_id: str) -> None:
        await self.execute(
            """
            UPDATE runtime_threads
            SET deleted_at = NOW(), updated_at = NOW(), current_run_id = NULL, status = 'deleted'
            WHERE id = %s
            """,
            [thread_id],
        )

    async def create_run(
        self,
        *,
        run_id: str,
        thread_id: str,
        status: str,
        input_payload: dict[str, Any] | None,
        command_payload: dict[str, Any] | None,
    ) -> dict[str, Any]:
        row = await self.fetchrow(
            """
            INSERT INTO runtime_runs (id, thread_id, status, input_payload, command_payload)
            VALUES (%s, %s, %s, %s::jsonb, %s::jsonb)
            RETURNING *
            """,
            [
                run_id,
                thread_id,
                status,
                _json(input_payload) if input_payload is not None else None,
                _json(command_payload) if command_payload is not None else None,
            ],
        )
        if not row:
            raise RuntimeError("Failed to create runtime run")
        return row

    async def get_run(self, run_id: str) -> dict[str, Any] | None:
        return await self.fetchrow(
            """
            SELECT *
            FROM runtime_runs
            WHERE id = %s
            LIMIT 1
            """,
            [run_id],
        )

    async def get_active_run_for_thread(self, thread_id: str) -> dict[str, Any] | None:
        return await self.fetchrow(
            """
            SELECT *
            FROM runtime_runs
            WHERE thread_id = %s AND status IN ('queued', 'running')
            ORDER BY created_at DESC
            LIMIT 1
            """,
            [thread_id],
        )

    async def set_thread_run_state(
        self,
        thread_id: str,
        *,
        run_id: str | None,
        status: str,
        last_values: dict[str, Any] | None = None,
    ) -> None:
        await self.execute(
            """
            UPDATE runtime_threads
            SET
                current_run_id = %s,
                status = %s,
                last_values = COALESCE(%s::jsonb, last_values),
                updated_at = NOW()
            WHERE id = %s
            """,
            [run_id, status, _json(last_values) if last_values is not None else None, thread_id],
        )

    async def update_run_status(
        self,
        run_id: str,
        *,
        status: str,
        error: str | None = None,
        last_event_seq: int | None = None,
        completed: bool = False,
    ) -> None:
        await self.execute(
            """
            UPDATE runtime_runs
            SET
                status = %s,
                error = %s,
                last_event_seq = COALESCE(%s, last_event_seq),
                updated_at = NOW(),
                completed_at = CASE WHEN %s THEN NOW() ELSE completed_at END
            WHERE id = %s
            """,
            [status, error, last_event_seq, completed, run_id],
        )

    async def append_run_event(
        self,
        *,
        run_id: str,
        sequence_no: int,
        event_type: str,
        payload: Any,
    ) -> None:
        await self.execute(
            """
            INSERT INTO runtime_run_events (run_id, sequence_no, event_type, payload)
            VALUES (%s, %s, %s, %s::jsonb)
            ON CONFLICT (run_id, sequence_no) DO NOTHING
            """,
            [run_id, sequence_no, event_type, _json(payload)],
        )

    async def list_run_events(self, run_id: str, after: int = 0) -> list[dict[str, Any]]:
        return await self.fetchall(
            """
            SELECT run_id, sequence_no, event_type, payload, created_at
            FROM runtime_run_events
            WHERE run_id = %s AND sequence_no > %s
            ORDER BY sequence_no ASC
            """,
            [run_id, after],
        )

    async def upsert_interrupts(
        self,
        *,
        thread_id: str,
        run_id: str,
        interrupts: list[dict[str, Any]],
    ) -> None:
        seen: set[str] = set()
        for index, interrupt in enumerate(interrupts):
            interrupt_id = str(interrupt.get("id") or f"{run_id}:{index}")
            seen.add(interrupt_id)
            interrupt_type = str(interrupt.get("value", {}).get("type") or "approval")
            await self.execute(
                """
                INSERT INTO runtime_interrupts (id, run_id, thread_id, interrupt_type, payload, status)
                VALUES (%s, %s, %s, %s, %s::jsonb, 'pending')
                ON CONFLICT (id) DO UPDATE
                SET payload = EXCLUDED.payload, interrupt_type = EXCLUDED.interrupt_type
                """,
                [interrupt_id, run_id, thread_id, interrupt_type, _json(interrupt)],
            )
        await self.execute(
            """
            UPDATE runtime_interrupts
            SET status = 'resolved', resolved_at = NOW()
            WHERE thread_id = %s AND run_id = %s AND status = 'pending' AND id <> ALL(%s::text[])
            """,
            [thread_id, run_id, list(seen) or ["__none__"]],
        )

    async def resolve_interrupts(self, thread_id: str, resolution: dict[str, Any]) -> None:
        await self.execute(
            """
            UPDATE runtime_interrupts
            SET status = 'resolved', resolution = %s::jsonb, resolved_at = NOW()
            WHERE thread_id = %s AND status = 'pending'
            """,
            [_json(resolution), thread_id],
        )

    async def list_pending_interrupts(self, thread_id: str) -> list[dict[str, Any]]:
        return await self.fetchall(
            """
            SELECT *
            FROM runtime_interrupts
            WHERE thread_id = %s AND status = 'pending'
            ORDER BY created_at ASC
            """,
            [thread_id],
        )

    async def fetchrow(self, query: str, params: list[Any]) -> dict[str, Any] | None:
        rows = await self.fetchall(query, params)
        return rows[0] if rows else None

    async def fetchall(self, query: str, params: list[Any]) -> list[dict[str, Any]]:
        pool = await self._get_pool()
        async with pool.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cursor:
                await cursor.execute(query, params)
                rows = await cursor.fetchall()
        return [dict(row) for row in rows]

    async def execute(self, query: str, params: list[Any]) -> None:
        pool = await self._get_pool()
        async with pool.connection() as conn:
            await conn.execute(query, params)
            await conn.commit()

    async def _get_pool(self) -> AsyncConnectionPool:
        if self._pool is None:
            if not settings.database_url_psycopg:
                raise RuntimeError("DATABASE_URL is required for the runtime database")
            self._pool = AsyncConnectionPool(
                conninfo=settings.database_url_psycopg,
                min_size=1,
                max_size=10,
                open=False,
            )
            await self._pool.open()
        return self._pool


runtime_db = RuntimeDatabase()
