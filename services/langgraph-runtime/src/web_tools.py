"""Web search and fetch tools using Tavily API."""

from __future__ import annotations

import logging
from typing import Any

import httpx

from config import settings

logger = logging.getLogger(__name__)

TAVILY_SEARCH_URL = "https://api.tavily.com/search"
TAVILY_EXTRACT_URL = "https://api.tavily.com/extract"


class TavilySearchProvider:
    """Tavily web search provider for AI agents."""

    def __init__(self, api_key: str = "") -> None:
        self.api_key = api_key or settings.tavily_api_key

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key)

    async def search(self, query: str, limit: int = 5) -> list[dict[str, Any]]:
        """Search the web and return structured results.

        Returns list of dicts with keys: title, url, content, score.
        """
        if not self.is_configured:
            return [{"error": "Web search is not configured. Set TAVILY_API_KEY to enable."}]

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    TAVILY_SEARCH_URL,
                    json={
                        "api_key": self.api_key,
                        "query": query,
                        "max_results": min(limit, 10),
                        "include_answer": True,
                        "include_raw_content": False,
                    },
                )
                response.raise_for_status()
                data = response.json()

            results = []
            for item in data.get("results", [])[:limit]:
                results.append({
                    "title": item.get("title", ""),
                    "url": item.get("url", ""),
                    "content": item.get("content", ""),
                    "score": item.get("score", 0.0),
                })

            answer = data.get("answer")
            return {
                "answer": answer or "",
                "results": results,
                "query": query,
            }
        except httpx.HTTPStatusError as exc:
            logger.warning("Tavily search failed (HTTP %s): %s", exc.response.status_code, exc)
            return {"error": f"Web search failed: HTTP {exc.response.status_code}", "query": query, "results": []}
        except Exception as exc:
            logger.warning("Tavily search failed: %s", exc)
            return {"error": f"Web search failed: {exc}", "query": query, "results": []}

    async def fetch(self, url: str) -> dict[str, Any]:
        """Fetch and extract content from a URL.

        Returns dict with keys: url, content, raw_content_length.
        """
        if not self.is_configured:
            return {"error": "Web fetch is not configured. Set TAVILY_API_KEY to enable.", "url": url}

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    TAVILY_EXTRACT_URL,
                    json={
                        "api_key": self.api_key,
                        "urls": [url],
                    },
                )
                response.raise_for_status()
                data = response.json()

            results = data.get("results", [])
            if results:
                item = results[0]
                return {
                    "url": item.get("url", url),
                    "content": item.get("raw_content", "")[:20000],
                    "raw_content_length": len(item.get("raw_content", "")),
                }
            return {"url": url, "content": "", "raw_content_length": 0, "error": "No content extracted"}
        except httpx.HTTPStatusError as exc:
            logger.warning("Tavily fetch failed (HTTP %s): %s", exc.response.status_code, exc)
            return {"error": f"Web fetch failed: HTTP {exc.response.status_code}", "url": url}
        except Exception as exc:
            logger.warning("Tavily fetch failed: %s", exc)
            return {"error": f"Web fetch failed: {exc}", "url": url}


_provider: TavilySearchProvider | None = None


def get_web_search_provider() -> TavilySearchProvider:
    global _provider
    if _provider is None:
        _provider = TavilySearchProvider()
    return _provider
