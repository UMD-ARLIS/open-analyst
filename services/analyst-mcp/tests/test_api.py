"""Tests for the analyst-mcp HTTP API endpoints."""

from __future__ import annotations

from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from analyst_mcp.models import (
    HealthComponent,
    HealthDetailsResponse,
    PaperDetailResponse,
    PaperRecord,
    SearchResponse,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def _env_defaults(monkeypatch, tmp_path):
    """Set minimal env vars so Settings() can be constructed."""
    monkeypatch.setenv("ANALYST_MCP_API_KEY", "test-key")
    monkeypatch.setenv("ANALYST_MCP_CONTACT_EMAIL", "test@example.com")
    monkeypatch.setenv("ANALYST_MCP_DATA_DIR", str(tmp_path / "data"))
    monkeypatch.setenv("ANALYST_MCP_STORAGE_ROOT", str(tmp_path / "articles"))
    monkeypatch.setenv("ANALYST_MCP_INDEX_ROOT", str(tmp_path / "indexes"))
    monkeypatch.setenv("ANALYST_MCP_RAW_ROOT", str(tmp_path / "raw"))


@pytest.fixture()
def mock_service():
    """Return an AsyncMock standing in for AnalystService."""
    service = AsyncMock()
    service.health_details.return_value = HealthDetailsResponse(
        ok=True,
        service_name="analyst-mcp",
        current_date="2024-01-01",
        components=[
            HealthComponent(name="storage", ok=True, detail="ok"),
            HealthComponent(name="providers", ok=True, detail="ok"),
        ],
        search_available=True,
    )
    return service


def _build_test_app(mock_service) -> FastAPI:
    """Build a simplified FastAPI app that mirrors the real endpoints
    but skips the MCP lifespan and session manager."""
    from analyst_mcp.config import Settings
    from analyst_mcp.request_context import OpenAnalystRequestContext, reset_request_context, set_request_context

    settings = Settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.settings = settings
        app.state.service = mock_service
        yield

    app = FastAPI(title="analyst-mcp-test", lifespan=lifespan)
    app.state.settings = settings
    app.state.service = mock_service

    @app.middleware("http")
    async def api_key_guard(request, call_next):
        context = OpenAnalystRequestContext(
            project_id=request.headers.get("x-open-analyst-project-id", "").strip(),
            project_name=request.headers.get("x-open-analyst-project-name", "").strip(),
            workspace_slug=request.headers.get("x-open-analyst-workspace-slug", "").strip(),
            api_base_url=request.headers.get("x-open-analyst-api-base-url", "").strip(),
            artifact_backend=request.headers.get("x-open-analyst-artifact-backend", "").strip(),
            local_artifact_root=request.headers.get("x-open-analyst-local-artifact-root", "").strip(),
            s3_bucket=request.headers.get("x-open-analyst-s3-bucket", "").strip(),
            s3_region=request.headers.get("x-open-analyst-s3-region", "").strip(),
            s3_endpoint=request.headers.get("x-open-analyst-s3-endpoint", "").strip(),
            s3_prefix=request.headers.get("x-open-analyst-s3-prefix", "").strip(),
        )
        token = set_request_context(context)
        if request.url.path.startswith("/api/"):
            expected = settings.api_key.get_secret_value()
            bearer = request.headers.get("authorization", "")
            supplied = None
            if bearer.lower().startswith("bearer "):
                supplied = bearer.split(" ", 1)[1].strip()
            else:
                supplied = request.headers.get("x-api-key")
            if supplied != expected:
                reset_request_context(token)
                from fastapi.responses import JSONResponse
                return JSONResponse(status_code=401, content={"detail": "invalid_api_key"})
        try:
            return await call_next(request)
        finally:
            reset_request_context(token)

    @app.get("/")
    async def root():
        return {
            "service": settings.service_name,
            "mcp_path": settings.mcp_path,
            "timezone": settings.timezone,
            "providers": ["arxiv", "openalex", "semantic_scholar"],
        }

    @app.get("/health")
    async def health():
        details = await app.state.service.health_details()
        return {"status": "ok" if details.ok else "degraded"}

    @app.get("/api/search")
    async def api_search_literature(
        query: str,
        sources: list[str] | None = None,
        date_from: str | None = None,
        date_to: str | None = None,
        limit: int = 10,
    ):
        return (
            await app.state.service.search_literature(
                query=query, sources=sources, date_from=date_from, date_to=date_to, limit=limit,
            )
        ).model_dump(mode="json")

    @app.get("/api/papers/{identifier}")
    async def api_get_paper(identifier: str, provider: str | None = None):
        from fastapi import HTTPException
        detail = await app.state.service.paper_detail(
            identifier, provider=provider, include_graph=False, graph_limit=1,
        )
        if detail is None:
            raise HTTPException(status_code=404, detail="paper_not_found")
        return detail.model_dump(mode="json")

    return app


@pytest.fixture()
def client(_env_defaults, mock_service):
    """Create a TestClient with mocked AnalystService."""
    app = _build_test_app(mock_service)
    with TestClient(app, raise_server_exceptions=False) as tc:
        yield tc


def _auth_headers() -> dict[str, str]:
    return {"Authorization": "Bearer test-key"}


# ---------------------------------------------------------------------------
# Health endpoint
# ---------------------------------------------------------------------------

class TestHealthEndpoint:
    def test_health_returns_200(self, client, mock_service):
        response = client.get("/health")
        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "ok"

    def test_health_degraded(self, client, mock_service):
        mock_service.health_details.return_value = HealthDetailsResponse(
            ok=False,
            service_name="analyst-mcp",
            current_date="2024-01-01",
            components=[],
            search_available=False,
        )
        response = client.get("/health")
        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "degraded"


# ---------------------------------------------------------------------------
# Search endpoint
# ---------------------------------------------------------------------------

class TestSearchEndpoint:
    def test_search_requires_api_key(self, client):
        response = client.get("/api/search", params={"query": "test"})
        assert response.status_code == 401

    def test_search_returns_results(self, client, mock_service):
        mock_service.search_literature.return_value = SearchResponse(
            query="transformers",
            current_date="2024-01-01",
            results=[
                PaperRecord(
                    canonical_id="paper:abc123",
                    provider="arxiv",
                    source_id="2401.00001",
                    title="Test Paper",
                    abstract="An abstract.",
                ),
            ],
            sources_used=["arxiv"],
            status="ok",
        )

        response = client.get(
            "/api/search",
            params={"query": "transformers", "limit": 5},
            headers=_auth_headers(),
        )
        assert response.status_code == 200
        body = response.json()
        assert body["query"] == "transformers"
        assert len(body["results"]) == 1
        assert body["results"][0]["title"] == "Test Paper"
        assert body["status"] == "ok"

    def test_search_with_sources_filter(self, client, mock_service):
        mock_service.search_literature.return_value = SearchResponse(
            query="test",
            current_date="2024-01-01",
            results=[],
            sources_used=["openalex"],
            status="ok",
        )

        response = client.get(
            "/api/search",
            params={"query": "test", "sources": "openalex"},
            headers=_auth_headers(),
        )
        assert response.status_code == 200


# ---------------------------------------------------------------------------
# Paper detail endpoint
# ---------------------------------------------------------------------------

class TestPaperDetailEndpoint:
    def test_get_paper_returns_detail(self, client, mock_service):
        paper = PaperRecord(
            canonical_id="paper:xyz789",
            provider="openalex",
            source_id="W9876543210",
            title="Detail Paper",
            abstract="Detailed abstract.",
        )
        mock_service.paper_detail.return_value = PaperDetailResponse(
            paper=paper,
            artifacts=[],
            external_links={"paper_url": "https://example.com", "pdf_url": None, "source_urls": []},
            has_local_artifacts=False,
            artifact_status="none",
        )

        response = client.get(
            "/api/papers/paper%3Axyz789",
            headers=_auth_headers(),
        )
        assert response.status_code == 200
        body = response.json()
        assert body["paper"]["title"] == "Detail Paper"
        assert body["artifact_status"] == "none"

    def test_get_paper_not_found(self, client, mock_service):
        mock_service.paper_detail.return_value = None

        response = client.get(
            "/api/papers/paper%3Anotfound",
            headers=_auth_headers(),
        )
        assert response.status_code == 404
        body = response.json()
        assert body["detail"] == "paper_not_found"

    def test_get_paper_with_provider(self, client, mock_service):
        paper = PaperRecord(
            canonical_id="paper:prov1",
            provider="semantic_scholar",
            source_id="s2id",
            title="S2 Paper",
        )
        mock_service.paper_detail.return_value = PaperDetailResponse(
            paper=paper,
            artifacts=[],
            external_links={},
        )

        response = client.get(
            "/api/papers/paper%3Aprov1",
            params={"provider": "semantic_scholar"},
            headers=_auth_headers(),
        )
        assert response.status_code == 200


# ---------------------------------------------------------------------------
# Root / info endpoint
# ---------------------------------------------------------------------------

class TestRootEndpoint:
    def test_root_returns_service_info(self, client):
        response = client.get("/")
        assert response.status_code == 200
        body = response.json()
        assert body["service"] == "analyst-mcp"
        assert "providers" in body
