from __future__ import annotations

import json
from contextlib import AsyncExitStack, asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from sse_starlette.sse import EventSourceResponse

from config import settings
import graph as graph_module
from graph import configure_runtime_persistence, invoke_run, stream_run
from models import RuntimeRunRequest
from retrieval import retrieval_service
from telemetry import configure_telemetry

try:
    from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
    from langgraph.store.postgres.aio import AsyncPostgresStore
except Exception:  # pragma: no cover
    AsyncPostgresSaver = None
    AsyncPostgresStore = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_telemetry()
    async with AsyncExitStack() as stack:
        checkpointer = None
        store = None
        if settings.database_url_psycopg and AsyncPostgresSaver is not None and AsyncPostgresStore is not None:
            checkpointer = await stack.enter_async_context(
                AsyncPostgresSaver.from_conn_string(settings.database_url_psycopg)
            )
            await checkpointer.setup()
            store = await stack.enter_async_context(
                AsyncPostgresStore.from_conn_string(settings.database_url_psycopg)
            )
            await store.setup()
        configure_runtime_persistence(checkpointer=checkpointer, store=store)
        yield
        configure_runtime_persistence(checkpointer=None, store=None)


app = FastAPI(title="open-analyst-langgraph-runtime", lifespan=lifespan)


@app.get("/health")
async def health():
    return {"ok": True, "service": "langgraph-runtime"}


@app.post("/invoke")
async def invoke(payload: RuntimeRunRequest):
    if payload.stream:
        async def event_generator():
            async for event in stream_run(payload):
                yield {
                    "event": event.type,
                    "data": json.dumps(event.model_dump(mode="json")),
                }

        return EventSourceResponse(event_generator())

    result = await invoke_run(payload)
    return JSONResponse(result.model_dump(mode="json"))


@app.post("/resume")
async def resume_run(request: Request):
    body = await request.json()
    run_id = body.get("run_id", "")
    thread_id = body.get("thread_id", run_id)
    decision = body.get("decision", "approve")

    if not graph_module.CHECKPOINTER:
        return JSONResponse({"error": "No checkpointer configured"}, status_code=500)

    from graph import _build_agent, _runtime_config
    from models import RuntimeRunRequest, RuntimeProjectContext

    agent = _build_agent()
    if agent is None:
        return JSONResponse({"error": "Agent not available"}, status_code=500)

    config = {"configurable": {"thread_id": thread_id}}

    if decision == "reject":
        # Cancel the interrupted tool call
        return JSONResponse({"status": "rejected"})

    # Resume with approval - pass None to continue from checkpoint
    result = await agent.ainvoke(None, config)
    final_text = ""
    if isinstance(result, dict):
        messages = result.get("messages", [])
        for msg in reversed(messages):
            if getattr(msg, "type", "") == "ai":
                content = getattr(msg, "content", "")
                if isinstance(content, str):
                    final_text = content
                    break

    return JSONResponse({"status": "completed", "text": final_text})


@app.get("/projects/{project_id}/memories")
async def list_project_memories(project_id: str, query: str = "", limit: int = 10):
    memories = await retrieval_service.search_project_memories(
        project_id,
        query,
        limit=limit,
    )
    return {"memories": memories}


@app.put("/projects/{project_id}/memories/{memory_id}")
async def put_project_memory(project_id: str, memory_id: str, payload: dict[str, object]):
    await retrieval_service.upsert_store_memory(
        project_id,
        memory_id,
        {
            "title": str(payload.get("title") or "Untitled memory").strip(),
            "summary": str(payload.get("summary") or "").strip(),
            "content": str(payload.get("content") or "").strip(),
            "memory_type": str(payload.get("memory_type") or "note").strip() or "note",
            "task_id": str(payload.get("task_id") or "").strip() or None,
            "metadata": payload.get("metadata") if isinstance(payload.get("metadata"), dict) else {},
            "provenance": payload.get("provenance")
            if isinstance(payload.get("provenance"), dict)
            else {},
        },
    )
    return {"ok": True, "memory_id": memory_id}


@app.delete("/projects/{project_id}/memories/{memory_id}")
async def delete_project_memory(project_id: str, memory_id: str):
    await retrieval_service.delete_store_memory(project_id, memory_id)
    return {"ok": True, "memory_id": memory_id}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=settings.host, port=settings.port)
