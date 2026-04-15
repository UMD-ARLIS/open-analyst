from __future__ import annotations

import json
from contextlib import asynccontextmanager
from typing import Any

from fastapi.encoders import jsonable_encoder
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse

from config import settings
from runtime_db import runtime_db
from runtime_context import list_skills_catalog, runtime_context_service
from runtime_engine import runtime_engine
from telemetry import configure_telemetry


def _normalize_thread_response(thread: dict[str, Any]) -> dict[str, Any]:
    metadata = thread.get("metadata") if isinstance(thread.get("metadata"), dict) else {}
    metadata = {
        **metadata,
        "project_id": metadata.get("project_id") or thread.get("project_id"),
        "collection_id": metadata.get("collection_id") or thread.get("collection_id"),
        "analysis_mode": metadata.get("analysis_mode") or thread.get("analysis_mode"),
        "title": metadata.get("title") or thread.get("title"),
        "summary": metadata.get("summary") or thread.get("summary"),
    }
    return {
        "thread_id": str(thread.get("id")),
        "metadata": metadata,
        "created_at": thread.get("created_at"),
        "updated_at": thread.get("updated_at"),
        "status": thread.get("status"),
        "current_run_id": thread.get("current_run_id"),
    }


def _derive_request_base_url(request: Request) -> str:
    explicit = str(request.headers.get("x-open-analyst-web-url") or "").strip()
    if explicit:
        return explicit.rstrip("/")
    forwarded_host = str(request.headers.get("x-forwarded-host") or request.headers.get("host") or "").strip()
    if forwarded_host:
        proto = str(request.headers.get("x-forwarded-proto") or request.url.scheme or "http").strip() or "http"
        return f"{proto}://{forwarded_host}".rstrip("/")
    return str(request.base_url).rstrip("/")


def _json_response(payload: Any, status_code: int = 200) -> JSONResponse:
    return JSONResponse(content=jsonable_encoder(payload), status_code=status_code)


@asynccontextmanager
async def lifespan(_: FastAPI):
    configure_telemetry()
    await runtime_engine.initialize()
    yield


app = FastAPI(title="open-analyst-runtime", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allowed_origins,
    allow_origin_regex=settings.cors_allowed_origin_regex,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict[str, Any]:
    return {"ok": True, "service": "open-analyst-runtime"}


@app.get("/skills")
async def list_skills(project_id: str | None = None) -> dict[str, Any]:
    if project_id:
        project = await runtime_context_service._load_project(project_id)
        user_id = str(project.get("user_id") or "").strip() if isinstance(project, dict) else ""
        return {"skills": list_skills_catalog(user_id or None)}
    return {"skills": list_skills_catalog()}


@app.post("/threads")
async def create_thread(request: Request) -> dict[str, Any]:
    body = await request.json()
    metadata = body.get("metadata") if isinstance(body, dict) and isinstance(body.get("metadata"), dict) else {}
    thread = await runtime_engine.create_thread(metadata)
    return _json_response({"thread_id": str(thread["id"])})


@app.post("/threads/search")
async def search_threads(request: Request) -> list[dict[str, Any]]:
    body = await request.json()
    metadata = body.get("metadata") if isinstance(body, dict) and isinstance(body.get("metadata"), dict) else {}
    limit = int(body.get("limit") or 20) if isinstance(body, dict) else 20
    threads = await runtime_engine.search_threads(metadata, limit=limit)
    return _json_response([_normalize_thread_response(thread) for thread in threads])


@app.get("/threads/{thread_id}")
async def get_thread(thread_id: str) -> dict[str, Any]:
    thread = await runtime_engine.get_thread(thread_id)
    if not thread:
        raise HTTPException(status_code=404, detail="thread_not_found")
    return _json_response(_normalize_thread_response(thread))


@app.get("/threads/{thread_id}/state")
async def get_thread_state(thread_id: str) -> dict[str, Any]:
    try:
        state = await runtime_engine.get_thread_state(thread_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return _json_response(state)


@app.patch("/threads/{thread_id}")
async def patch_thread(thread_id: str, request: Request) -> dict[str, Any]:
    body = await request.json()
    metadata = body.get("metadata") if isinstance(body, dict) and isinstance(body.get("metadata"), dict) else {}
    thread = await runtime_engine.update_thread(thread_id, metadata)
    if not thread:
        raise HTTPException(status_code=404, detail="thread_not_found")
    return _json_response(_normalize_thread_response(thread))


@app.delete("/threads/{thread_id}", status_code=204)
async def delete_thread(thread_id: str) -> None:
    await runtime_engine.delete_thread(thread_id)


@app.post("/threads/{thread_id}/runs")
async def create_run(thread_id: str, request: Request) -> dict[str, Any]:
    body = await request.json()
    try:
        run = await runtime_engine.start_run(
            thread_id,
            body if isinstance(body, dict) else {},
            request_base_url=_derive_request_base_url(request),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return _json_response({"run_id": run["id"], "thread_id": run["thread_id"], "status": run["status"]})


@app.get("/threads/{thread_id}/runs/{run_id}")
async def get_run(thread_id: str, run_id: str) -> dict[str, Any]:
    run = await runtime_db.get_run(run_id)
    if not run or str(run.get("thread_id")) != thread_id:
        raise HTTPException(status_code=404, detail="run_not_found")
    return _json_response(run)


@app.post("/threads/{thread_id}/runs/{run_id}/cancel")
async def cancel_run(thread_id: str, run_id: str) -> dict[str, Any]:
    await runtime_engine.cancel_run(thread_id, run_id)
    return _json_response({"ok": True})


@app.get("/threads/{thread_id}/runs/{run_id}/events/stream")
async def stream_run_events(thread_id: str, run_id: str, after: int = 0):
    run = await runtime_db.get_run(run_id)
    if not run or str(run.get("thread_id")) != thread_id:
        raise HTTPException(status_code=404, detail="run_not_found")

    async def event_generator():
        existing = await runtime_db.list_run_events(run_id, after=after)
        latest = after
        terminal_seen = False
        for event in existing:
            latest = max(latest, int(event.get("sequence_no") or 0))
            event_name = str(event.get("event_type") or "message")
            yield {
                "event": event_name,
                "data": json.dumps(
                    event.get("payload"),
                    default=str,
                ),
            }
            if event_name in {"done", "error"}:
                terminal_seen = True
        if terminal_seen:
            return
        refreshed = await runtime_db.get_run(run_id)
        final_status = str(refreshed.get("status") or "").lower() if refreshed else ""
        if final_status in {"completed", "failed", "cancelled", "interrupted"} and latest >= int(refreshed.get("last_event_seq") or 0):
            return
        async for event in runtime_engine.subscribe(run_id):
            if int(event.get("sequence_no") or 0) <= latest:
                continue
            latest = int(event.get("sequence_no") or 0)
            event_name = str(event.get("event") or "message")
            yield {
                "event": event_name,
                "data": json.dumps(event.get("data"), default=str),
            }
            if event_name in {"done", "error"}:
                return

    return EventSourceResponse(event_generator())


@app.post("/store/items/search")
async def search_store_items(request: Request) -> dict[str, Any]:
    body = await request.json()
    namespace_prefix = body.get("namespace_prefix") if isinstance(body, dict) else None
    if not isinstance(namespace_prefix, list):
        raise HTTPException(status_code=400, detail="namespace_prefix is required")
    query = str(body.get("query") or "").strip() or None if isinstance(body, dict) else None
    limit = int(body.get("limit") or 10) if isinstance(body, dict) else 10
    items = await runtime_engine.search_store_items(
        [str(item) for item in namespace_prefix],
        query=query,
        limit=limit,
    )
    return _json_response({"items": items})


@app.put("/store/items")
async def put_store_item(request: Request) -> dict[str, Any]:
    body = await request.json()
    namespace = body.get("namespace") if isinstance(body, dict) else None
    key = str(body.get("key") or "").strip() if isinstance(body, dict) else ""
    value = body.get("value") if isinstance(body, dict) else None
    if not isinstance(namespace, list):
        raise HTTPException(status_code=400, detail="namespace is required")
    if not key:
        raise HTTPException(status_code=400, detail="key is required")
    if not isinstance(value, dict):
        raise HTTPException(status_code=400, detail="value must be an object")
    item = await runtime_engine.put_store_item(
        [str(item) for item in namespace],
        key,
        value,
    )
    return _json_response({"item": item})


@app.delete("/store/items")
async def delete_store_item(request: Request) -> dict[str, Any]:
    body = await request.json()
    namespace = body.get("namespace") if isinstance(body, dict) else None
    key = str(body.get("key") or "").strip() if isinstance(body, dict) else ""
    if not isinstance(namespace, list):
        raise HTTPException(status_code=400, detail="namespace is required")
    if not key:
        raise HTTPException(status_code=400, detail="key is required")
    await runtime_engine.delete_store_item(
        [str(item) for item in namespace],
        key,
    )
    return _json_response({"ok": True})
