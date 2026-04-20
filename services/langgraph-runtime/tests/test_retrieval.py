"""Tests for RuntimeRetrievalService._embed_query."""

from __future__ import annotations

import importlib
import logging

import httpx
import pytest
import respx


def _fresh_settings(**overrides):
    """Import config fresh to pick up monkeypatched env vars and return
    a new RuntimeSettings with optional overrides applied."""
    import config as config_module
    importlib.reload(config_module)
    s = config_module.RuntimeSettings()
    for key, value in overrides.items():
        object.__setattr__(s, key, value)
    # Clear cached_property cache entries produced by previous reloads
    for prop_name in list(vars(type(s))):
        if isinstance(getattr(type(s), prop_name, None), property):
            continue
    return s


# ---------------------------------------------------------------------------
# _embed_query
# ---------------------------------------------------------------------------

class TestEmbedQuery:
    """Tests targeting RuntimeRetrievalService._embed_query."""

    async def test_returns_empty_for_empty_query(self, monkeypatch):
        """Empty/whitespace query should short-circuit and return []."""
        monkeypatch.setenv("LITELLM_BASE_URL", "http://localhost:4000")
        monkeypatch.setenv("LITELLM_EMBEDDING_MODEL", "text-embedding-3-small")

        import config as config_module
        importlib.reload(config_module)

        import retrieval as retrieval_module
        importlib.reload(retrieval_module)

        service = retrieval_module.RuntimeRetrievalService()
        result = await service._embed_query("   ")
        assert result == []

    async def test_returns_empty_when_not_configured(self, monkeypatch):
        """When embedding service URL is empty, return []."""
        monkeypatch.setenv("LITELLM_BASE_URL", "")
        monkeypatch.setenv("LITELLM_EMBEDDING_MODEL", "")

        import config as config_module
        importlib.reload(config_module)

        import retrieval as retrieval_module
        importlib.reload(retrieval_module)

        service = retrieval_module.RuntimeRetrievalService()
        result = await service._embed_query("some query")
        assert result == []

    async def test_returns_embedding_on_success(self, monkeypatch):
        """Successful embedding API call returns float list."""
        monkeypatch.setenv("LITELLM_BASE_URL", "http://embed-test:4000")
        monkeypatch.setenv("LITELLM_EMBEDDING_MODEL", "text-embedding-3-small")
        monkeypatch.setenv("LITELLM_API_KEY", "test-key")

        import config as config_module
        importlib.reload(config_module)

        import retrieval as retrieval_module
        importlib.reload(retrieval_module)

        embedding_response = {
            "data": [{"embedding": [0.1, 0.2, 0.3, 0.4]}],
            "model": "text-embedding-3-small",
        }

        with respx.mock(assert_all_called=False) as router:
            router.post("http://embed-test:4000/embeddings").respond(200, json=embedding_response)
            service = retrieval_module.RuntimeRetrievalService()
            result = await service._embed_query("test query")

        assert result == [0.1, 0.2, 0.3, 0.4]

    async def test_returns_empty_on_http_error(self, monkeypatch, caplog):
        """HTTP 500 from embedding service should log warning and return []."""
        monkeypatch.setenv("LITELLM_BASE_URL", "http://embed-test:4000")
        monkeypatch.setenv("LITELLM_EMBEDDING_MODEL", "text-embedding-3-small")
        monkeypatch.setenv("LITELLM_API_KEY", "test-key")

        import config as config_module
        importlib.reload(config_module)

        import retrieval as retrieval_module
        importlib.reload(retrieval_module)

        with respx.mock(assert_all_called=False) as router:
            router.post("http://embed-test:4000/embeddings").respond(500)
            service = retrieval_module.RuntimeRetrievalService()
            with caplog.at_level(logging.WARNING):
                result = await service._embed_query("test query")

        assert result == []
        assert any("Embedding query failed" in record.message for record in caplog.records)

    async def test_returns_empty_on_malformed_response(self, monkeypatch):
        """When the response payload is missing the expected structure, return []."""
        monkeypatch.setenv("LITELLM_BASE_URL", "http://embed-test:4000")
        monkeypatch.setenv("LITELLM_EMBEDDING_MODEL", "text-embedding-3-small")

        import config as config_module
        importlib.reload(config_module)

        import retrieval as retrieval_module
        importlib.reload(retrieval_module)

        with respx.mock(assert_all_called=False) as router:
            router.post("http://embed-test:4000/embeddings").respond(200, json={"unexpected": "shape"})
            service = retrieval_module.RuntimeRetrievalService()
            result = await service._embed_query("test query")

        assert result == []
