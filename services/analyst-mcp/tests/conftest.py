"""Shared fixtures for analyst-mcp tests."""

from __future__ import annotations

from pathlib import Path
from unittest.mock import AsyncMock

import httpx
import pytest
import respx

from analyst_mcp.config import Settings


@pytest.fixture()
def mock_settings(tmp_path: Path) -> Settings:
    """Return a Settings instance that does not require real env vars."""
    return Settings(
        api_key="test-key",
        contact_email="test@example.com",
        data_dir=tmp_path / "data",
        storage_root=tmp_path / "articles",
        index_root=tmp_path / "indexes",
        raw_root=tmp_path / "raw",
        postgres_dsn=None,
        semantic_scholar_api_key=None,
        openalex_api_key=None,
    )


@pytest.fixture()
def mock_httpx_client() -> httpx.AsyncClient:
    """Return an httpx.AsyncClient wired to respx for mocking."""
    with respx.mock(assert_all_called=False) as router:
        client = httpx.AsyncClient(transport=respx.MockTransport())
        yield client
