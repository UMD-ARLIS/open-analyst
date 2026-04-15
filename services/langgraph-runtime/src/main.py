"""Standalone entrypoint for the first-party Open Analyst runtime."""

from __future__ import annotations

import os


def main() -> None:
    import uvicorn

    host = os.environ.get("HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", "8081"))

    uvicorn.run(
        "runtime_api:app",
        host=host,
        port=port,
        reload=False,
        access_log=False,
    )


if __name__ == "__main__":
    main()
