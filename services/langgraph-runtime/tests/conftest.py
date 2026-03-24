"""Shared fixtures for langgraph-runtime tests."""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import patch

import pytest

# Ensure src/ is on sys.path so bare `import config` works.
_src_dir = str(Path(__file__).resolve().parent.parent / "src")
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)


@pytest.fixture(autouse=True)
def _default_env(monkeypatch):
    """Provide safe default env vars so RuntimeSettings() can be constructed
    without a real .env file."""
    monkeypatch.setenv("DATABASE_URL", "")
    monkeypatch.setenv("LITELLM_BASE_URL", "http://localhost:4000")
    monkeypatch.setenv("LITELLM_API_KEY", "test-key")
    monkeypatch.setenv("LITELLM_CHAT_MODEL", "gpt-4.1-mini")
    monkeypatch.setenv("LITELLM_EMBEDDING_MODEL", "text-embedding-3-small")
    monkeypatch.setenv("TAVILY_API_KEY", "")
