from __future__ import annotations

import json
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from sse_starlette.sse import EventSourceResponse

from config import settings
from graph import invoke_run, stream_run
from models import RuntimeRunRequest
from telemetry import configure_telemetry


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_telemetry()
    yield


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


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=settings.host, port=settings.port)
