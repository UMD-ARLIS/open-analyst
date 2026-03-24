from __future__ import annotations

from typing import Annotated

import typer

from .config import Settings

app = typer.Typer(invoke_without_command=True)


@app.callback()
def main() -> None:
    """Analyst MCP — academic search and paper acquisition service."""


@app.command()
def serve() -> None:
    """Run the MCP HTTP server."""
    import uvicorn

    settings = Settings()
    uvicorn.run("analyst_mcp.api:create_app", factory=True, host=settings.host, port=settings.port)
