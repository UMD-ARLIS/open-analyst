from __future__ import annotations

import pytest
from fastapi import Request

from models import RuntimeProjectContext
from runtime_context import derive_api_base_url
from webapp import build_runtime_system_prompt, enrich_run_payload, normalize_thread_create_payload


def _make_request() -> Request:
    scope = {
        "type": "http",
        "method": "POST",
        "path": "/threads/thread-1/runs/stream",
        "headers": [(b"origin", b"http://localhost:5173")],
        "scheme": "http",
        "server": ("localhost", 8081),
        "client": ("127.0.0.1", 54321),
        "root_path": "",
        "query_string": b"",
    }

    async def receive():
        return {"type": "http.request", "body": b"", "more_body": False}

    return Request(scope, receive)


def test_derive_api_base_url_prefers_origin():
    assert derive_api_base_url(
        origin="http://localhost:5173",
        fallback_host="http://localhost:8081/",
    ) == "http://localhost:5173"


def test_derive_api_base_url_rewrites_runtime_port_when_origin_missing():
    assert derive_api_base_url(
        origin=None,
        fallback_host="http://192.168.1.10:8081/",
    ) == "http://192.168.1.10:5173"


def test_normalize_thread_create_payload_promotes_metadata():
    payload = normalize_thread_create_payload(
        {
            "context": {
                "project_id": "project-123",
                "collection_id": "collection-456",
                "analysis_mode": "deep_research",
            }
        }
    )

    assert payload["metadata"] == {
        "project_id": "project-123",
        "collection_id": "collection-456",
        "analysis_mode": "deep_research",
    }


def test_build_runtime_system_prompt_mentions_date_and_mode():
    prompt = build_runtime_system_prompt(
        {
            "current_date": "2026-03-19",
            "current_datetime_utc": "2026-03-19T17:00:00Z",
        },
        "deep_research",
    )

    assert "Current UTC date: 2026-03-19." in prompt
    assert "Deep research mode is active." in prompt


@pytest.mark.asyncio
async def test_enrich_run_payload_injects_context_and_system_prompt(monkeypatch):
    async def fake_build_context(
        project_id: str,
        *,
        collection_id: str | None = None,
        analysis_mode: str | None = None,
        api_base_url: str = "",
    ) -> RuntimeProjectContext:
        return RuntimeProjectContext(
            project_id=project_id,
            project_name="Project 123",
            workspace_path="/tmp/workspace",
            workspace_slug="project-123",
            current_date="2026-03-19",
            current_datetime_utc="2026-03-19T17:00:00Z",
            collection_id=collection_id,
            analysis_mode=analysis_mode or "chat",
            api_base_url=api_base_url,
        )

    monkeypatch.setattr("webapp.runtime_context_service.build_context", fake_build_context)

    payload = await enrich_run_payload(
        {
            "input": {
                "messages": [{"role": "human", "content": "Research this topic."}],
            },
            "metadata": {
                "project_id": "project-123",
                "collection_id": "collection-456",
                "analysis_mode": "deep_research",
            },
        },
        _make_request(),
    )

    assert payload["context"]["project_id"] == "project-123"
    assert payload["context"]["api_base_url"] == "http://localhost:5173"
    assert payload["metadata"]["analysis_mode"] == "deep_research"
    messages = payload["input"]["messages"]
    assert messages[0]["role"] == "system"
    assert "Current UTC date: 2026-03-19." in messages[0]["content"]
    assert messages[1]["content"] == "Research this topic."
