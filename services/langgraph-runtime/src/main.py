"""Standalone entrypoint for the LangGraph Agent Server.

Replaces `langgraph dev` for production Docker deployments.
Sets the environment variables that langgraph_api expects, then
starts uvicorn with the Agent Server ASGI app.

No LangSmith license or cloud connection required — the inmem
edition runs fully self-hosted.  For persistent checkpoints and
store in production, set LANGGRAPH_RUNTIME_EDITION=postgres and
provide DATABASE_URI pointing to your Postgres instance.
"""

from __future__ import annotations

import json
import os
from pathlib import Path


def main() -> None:
    config_path = Path(__file__).resolve().parent.parent / "langgraph.json"
    with open(config_path) as f:
        config = json.load(f)

    # Runtime edition: "inmem" stores checkpoints on local disk,
    # "postgres" uses DATABASE_URI for durable persistence.
    runtime_edition = os.environ.get("LANGGRAPH_RUNTIME_EDITION", "inmem")

    # Set env vars that langgraph_api.server reads at import time.
    defaults = {
        "LANGGRAPH_RUNTIME_EDITION": runtime_edition,
        "LANGSERVE_GRAPHS": json.dumps(config.get("graphs", {})),
        "LANGGRAPH_HTTP": json.dumps(config.get("http", {})),
        "LANGGRAPH_AUTH": json.dumps(config.get("auth", {})),
        "LANGGRAPH_STORE": json.dumps(config.get("store", {})),
        "LANGGRAPH_CHECKPOINTER": json.dumps(config.get("checkpointer", {})),
        "LANGGRAPH_WEBHOOKS": json.dumps(config.get("webhooks", {})),
        "LANGSMITH_LANGGRAPH_API_VARIANT": "local_dev",
        "LANGGRAPH_NO_VERSION_CHECK": "true",
    }
    if runtime_edition == "inmem":
        defaults["DATABASE_URI"] = ":memory:"
        defaults["MIGRATIONS_PATH"] = "__inmem"

    for key, value in defaults.items():
        os.environ.setdefault(key, value)

    import uvicorn

    host = os.environ.get("HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", "8081"))

    uvicorn.run(
        "langgraph_api.server:app",
        host=host,
        port=port,
        reload=False,
        access_log=False,
    )


if __name__ == "__main__":
    main()
