"""Custom HTTP routes for the LangGraph Agent Server.

These routes are mounted alongside the Agent Server's built-in API
(threads, runs, assistants, store, etc.) via the ``http.app`` key in
``langgraph.json``.

Memory CRUD is handled by the Agent Server's built-in ``/store/*``
endpoints — no custom routes are needed.
"""

from __future__ import annotations

import json
import re
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.requests import Request

from config import settings
from runtime_context import derive_api_base_url, runtime_context_service

app = FastAPI(title="open-analyst-custom-routes")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allowed_origins,
    allow_origin_regex=settings.cors_allowed_origin_regex,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

RUN_PATH_RE = re.compile(r"^/threads/[^/]+/runs(?:/[^/]+)?$")


def _trimmed(value: Any) -> str:
    return str(value or "").strip()


def _trimmed_or_none(value: Any) -> str | None:
    trimmed = _trimmed(value)
    return trimmed or None


def _json_object(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _get_project_id(body: dict[str, Any]) -> str:
    metadata = _json_object(body.get("metadata"))
    context = _json_object(body.get("context"))
    return _trimmed(metadata.get("project_id") or context.get("project_id"))


def _get_collection_id(body: dict[str, Any]) -> str | None:
    metadata = _json_object(body.get("metadata"))
    context = _json_object(body.get("context"))
    return _trimmed_or_none(metadata.get("collection_id") or context.get("collection_id"))


def _get_analysis_mode(body: dict[str, Any]) -> str:
    metadata = _json_object(body.get("metadata"))
    context = _json_object(body.get("context"))
    return _trimmed(metadata.get("analysis_mode") or context.get("analysis_mode")) or "chat"


def build_runtime_system_prompt(runtime_context: dict[str, Any], analysis_mode: str) -> str:
    lines = [
        f"Current UTC date: {_trimmed(runtime_context.get('current_date')) or 'unknown'}.",
        f"Current UTC timestamp: {_trimmed(runtime_context.get('current_datetime_utc')) or 'unknown'}.",
        "Interpret relative time references like recent, latest, today, this week, this month, and this year using this date.",
    ]
    if analysis_mode == "deep_research":
        lines.extend(
            [
                "Deep research mode is active.",
                "Plan before acting, delegate evidence collection to the researcher first,",
                "use grounded sources, and synthesize only after retrieval has produced enough support.",
            ]
        )
    return " ".join(lines)


def apply_runtime_system_prompt(body: dict[str, Any], runtime_context: dict[str, Any], analysis_mode: str) -> dict[str, Any]:
    input_payload = _json_object(body.get("input"))
    messages = input_payload.get("messages")
    if not isinstance(messages, list):
        return body
    first_message = messages[0] if messages else None
    if isinstance(first_message, dict):
        first_role = _trimmed(first_message.get("role"))
        first_content = first_message.get("content")
        if first_role == "system" and isinstance(first_content, str) and "Current UTC date:" in first_content:
            return body
    next_input = dict(input_payload)
    next_input["messages"] = [
        {
            "role": "system",
            "content": build_runtime_system_prompt(runtime_context, analysis_mode),
        },
        *messages,
    ]
    return {**body, "input": next_input}


def normalize_thread_create_payload(body: dict[str, Any]) -> dict[str, Any]:
    project_id = _get_project_id(body)
    if not project_id:
        return body
    metadata = _json_object(body.get("metadata"))
    return {
        **body,
        "metadata": {
            **metadata,
            "project_id": project_id,
            "collection_id": _get_collection_id(body),
            "analysis_mode": _get_analysis_mode(body),
        },
    }


async def enrich_run_payload(body: dict[str, Any], request: Request) -> dict[str, Any]:
    project_id = _get_project_id(body)
    if not project_id:
        return body
    analysis_mode = _get_analysis_mode(body)
    collection_id = _get_collection_id(body)
    runtime_context = await runtime_context_service.build_context(
        project_id,
        collection_id=collection_id,
        analysis_mode=analysis_mode,
        api_base_url=derive_api_base_url(
            origin=request.headers.get("origin"),
            fallback_host=str(request.base_url),
        ),
    )
    payload = {
        **body,
        "context": runtime_context.model_dump(),
        "metadata": {
            **_json_object(body.get("metadata")),
            "project_id": project_id,
            "collection_id": collection_id,
            "analysis_mode": analysis_mode,
        },
    }
    return apply_runtime_system_prompt(payload, runtime_context.model_dump(), analysis_mode)


def _with_json_body(request: Request, payload: dict[str, Any]) -> Request:
    body = json.dumps(payload).encode("utf-8")

    async def receive() -> dict[str, Any]:
        return {"type": "http.request", "body": body, "more_body": False}

    scope = dict(request.scope)
    headers = [(key, value) for key, value in request.scope["headers"] if key != b"content-length"]
    headers.append((b"content-length", str(len(body)).encode("ascii")))
    scope["headers"] = headers
    return Request(scope, receive)


@app.middleware("http")
async def enrich_agent_server_requests(request: Request, call_next):
    if request.method == "POST" and "application/json" in request.headers.get("content-type", ""):
        raw_body = await request.body()
        if raw_body:
            try:
                payload = json.loads(raw_body)
            except json.JSONDecodeError:
                payload = None
            if isinstance(payload, dict):
                next_payload = payload
                if request.url.path == "/threads":
                    next_payload = normalize_thread_create_payload(payload)
                elif RUN_PATH_RE.match(request.url.path):
                    next_payload = await enrich_run_payload(payload, request)
                if next_payload is not payload:
                    request = _with_json_body(request, next_payload)
    return await call_next(request)


@app.get("/health")
async def health():
    return {"ok": True, "service": "langgraph-runtime"}
