from __future__ import annotations

from typing import Annotated

import typer

from .config import Settings

app = typer.Typer(no_args_is_help=True)


@app.command()
def serve() -> None:
    """Run the MCP HTTP server."""
    import uvicorn

    settings = Settings()
    uvicorn.run("analyst_mcp.api:create_app", factory=True, host=settings.host, port=settings.port)
