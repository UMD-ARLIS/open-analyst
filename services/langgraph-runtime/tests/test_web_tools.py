"""Tests for TavilySearchProvider web search and fetch."""

from __future__ import annotations

import importlib

import httpx
import pytest
import respx


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _reload_web_tools(monkeypatch, tavily_key: str = ""):
    """Reload web_tools module with fresh config after env change."""
    monkeypatch.setenv("TAVILY_API_KEY", tavily_key)

    import config as config_module
    importlib.reload(config_module)

    import web_tools as web_tools_module
    importlib.reload(web_tools_module)

    return web_tools_module


# ---------------------------------------------------------------------------
# TavilySearchProvider.search()
# ---------------------------------------------------------------------------

class TestTavilySearch:
    async def test_search_returns_structured_results(self, monkeypatch):
        wt = _reload_web_tools(monkeypatch, tavily_key="tvly-test-key")

        tavily_response = {
            "answer": "Machine learning is a subset of AI.",
            "results": [
                {
                    "title": "ML Overview",
                    "url": "https://example.com/ml",
                    "content": "Machine learning overview content.",
                    "score": 0.95,
                },
                {
                    "title": "Deep Learning Guide",
                    "url": "https://example.com/dl",
                    "content": "Deep learning guide content.",
                    "score": 0.88,
                },
            ],
        }

        with respx.mock(assert_all_called=False) as router:
            router.post("https://api.tavily.com/search").respond(200, json=tavily_response)
            provider = wt.TavilySearchProvider(api_key="tvly-test-key")
            result = await provider.search("machine learning", limit=5)

        assert result["answer"] == "Machine learning is a subset of AI."
        assert len(result["results"]) == 2
        assert result["results"][0]["title"] == "ML Overview"
        assert result["results"][0]["url"] == "https://example.com/ml"
        assert result["results"][0]["score"] == 0.95
        assert result["query"] == "machine learning"

    async def test_search_returns_error_when_no_api_key(self, monkeypatch):
        wt = _reload_web_tools(monkeypatch, tavily_key="")

        provider = wt.TavilySearchProvider(api_key="")
        result = await provider.search("test query")

        assert isinstance(result, list)
        assert len(result) == 1
        assert "error" in result[0]
        assert "not configured" in result[0]["error"]

    async def test_search_handles_http_error(self, monkeypatch):
        wt = _reload_web_tools(monkeypatch, tavily_key="tvly-test-key")

        with respx.mock(assert_all_called=False) as router:
            router.post("https://api.tavily.com/search").respond(429)
            provider = wt.TavilySearchProvider(api_key="tvly-test-key")
            result = await provider.search("test query")

        assert "error" in result
        assert "429" in result["error"]

    async def test_search_handles_network_error(self, monkeypatch):
        wt = _reload_web_tools(monkeypatch, tavily_key="tvly-test-key")

        with respx.mock(assert_all_called=False) as router:
            router.post("https://api.tavily.com/search").mock(
                side_effect=httpx.ConnectError("connection refused")
            )
            provider = wt.TavilySearchProvider(api_key="tvly-test-key")
            result = await provider.search("test query")

        assert "error" in result


# ---------------------------------------------------------------------------
# TavilySearchProvider.fetch()
# ---------------------------------------------------------------------------

class TestTavilyFetch:
    async def test_fetch_returns_extracted_content(self, monkeypatch):
        wt = _reload_web_tools(monkeypatch, tavily_key="tvly-test-key")

        extract_response = {
            "results": [
                {
                    "url": "https://example.com/article",
                    "raw_content": "This is the extracted article content from the page." * 10,
                }
            ]
        }

        with respx.mock(assert_all_called=False) as router:
            router.post("https://api.tavily.com/extract").respond(200, json=extract_response)
            provider = wt.TavilySearchProvider(api_key="tvly-test-key")
            result = await provider.fetch("https://example.com/article")

        assert result["url"] == "https://example.com/article"
        assert "extracted article content" in result["content"]
        assert result["raw_content_length"] > 0

    async def test_fetch_handles_http_error(self, monkeypatch):
        wt = _reload_web_tools(monkeypatch, tavily_key="tvly-test-key")

        with respx.mock(assert_all_called=False) as router:
            router.post("https://api.tavily.com/extract").respond(500)
            provider = wt.TavilySearchProvider(api_key="tvly-test-key")
            result = await provider.fetch("https://example.com/broken")

        assert "error" in result
        assert "500" in result["error"]
        assert result["url"] == "https://example.com/broken"

    async def test_fetch_not_configured(self, monkeypatch):
        wt = _reload_web_tools(monkeypatch, tavily_key="")

        provider = wt.TavilySearchProvider(api_key="")
        result = await provider.fetch("https://example.com")

        assert "error" in result
        assert "not configured" in result["error"]

    async def test_fetch_empty_results(self, monkeypatch):
        wt = _reload_web_tools(monkeypatch, tavily_key="tvly-test-key")

        with respx.mock(assert_all_called=False) as router:
            router.post("https://api.tavily.com/extract").respond(200, json={"results": []})
            provider = wt.TavilySearchProvider(api_key="tvly-test-key")
            result = await provider.fetch("https://example.com/empty")

        assert result["content"] == ""
        assert result["raw_content_length"] == 0
        assert "error" in result  # "No content extracted"

    async def test_fetch_handles_network_error(self, monkeypatch):
        wt = _reload_web_tools(monkeypatch, tavily_key="tvly-test-key")

        with respx.mock(assert_all_called=False) as router:
            router.post("https://api.tavily.com/extract").mock(
                side_effect=httpx.ConnectError("connection refused")
            )
            provider = wt.TavilySearchProvider(api_key="tvly-test-key")
            result = await provider.fetch("https://example.com/unreachable")

        assert "error" in result
