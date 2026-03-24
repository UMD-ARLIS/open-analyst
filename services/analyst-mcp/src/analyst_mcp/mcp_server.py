from __future__ import annotations

from datetime import datetime
from typing import Annotated

from mcp.server.fastmcp import FastMCP
from pydantic import Field

from .services import AnalystService


def build_mcp_server(service: AnalystService) -> FastMCP:
    mcp = FastMCP("analyst-mcp", host=service.settings.host, streamable_http_path="/")

    @mcp.tool(description="Search academic and research sources with date awareness and provider filters.")
    async def search_literature(
        query: Annotated[str, Field(description="Natural language search query")],
        sources: Annotated[list[str] | None, Field(description="Subset of providers to search")] = None,
        date_from: Annotated[str | None, Field(description="Inclusive YYYY-MM-DD lower bound")] = None,
        date_to: Annotated[str | None, Field(description="Inclusive YYYY-MM-DD upper bound")] = None,
        limit: Annotated[int, Field(description="Maximum papers to return", ge=1, le=25)] = 10,
    ) -> dict:
        return (await service.search_literature(query, sources, date_from, date_to, limit)).model_dump(mode="json")

    @mcp.tool(description="Get a normalized paper record by canonical id or source id.")
    async def get_paper(
        identifier: Annotated[str, Field(description="Canonical paper id or provider-specific id")],
        provider: Annotated[str | None, Field(description="Optional provider hint")] = None,
        include_artifacts: Annotated[bool, Field(description="Include locally stored artifacts in the response")] = True,
    ) -> dict:
        detail = await service.paper_detail(
            identifier,
            provider=provider,
            include_graph=False,
            graph_limit=1,
        )
        if detail is None:
            return {"error": "paper_not_found", "identifier": identifier}
        payload = {"paper": detail.paper.model_dump(mode="json")}
        if include_artifacts:
            payload["artifacts"] = [artifact.model_dump(mode="json") for artifact in detail.artifacts]
            payload["external_links"] = detail.external_links
        return payload

    @mcp.tool(description="Describe the MCP server capabilities, workflows, and collection model.")
    async def describe_capabilities() -> dict:
        return (await service.describe_capabilities()).model_dump(mode="json")

    @mcp.tool(description="Check whether the configured local or S3 artifact store is reachable.")
    async def storage_health() -> dict:
        return (await service.storage_health()).model_dump(mode="json")

    @mcp.resource("time://today", description="Current date context for relative research queries.")
    def current_date() -> str:
        return f"{service.settings.timezone} {datetime.now(service.settings.tzinfo).date().isoformat()}"

    @mcp.resource("paper://id/{canonical_id}", description="Normalized paper record by canonical id.")
    async def paper_resource(canonical_id: str) -> dict:
        paper = await service.get_paper(canonical_id)
        return {} if paper is None else paper.model_dump(mode="json")

    return mcp
