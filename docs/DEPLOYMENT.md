# Deployment

Open Analyst deploys as three cooperating services:

- web app
- LangGraph runtime
- Analyst MCP

## Required Configuration

- `DATABASE_URL`
- `LITELLM_API_KEY`

Common runtime variables:

- `LITELLM_BASE_URL`
- `LANGGRAPH_RUNTIME_URL`
- `NODE_API_BASE_URL`
- `ANALYST_MCP_API_KEY`
- `ANALYST_MCP_POSTGRES_DSN`

## Service Topology

- The web app serves the React Router build and same-origin API routes.
- The LangGraph runtime handles project-run execution and streaming.
- Analyst MCP provides literature search, collection, and download capabilities.
- PostgreSQL stores application state; Analyst MCP may use its own schema on the same database.

## Production Notes

- `pnpm start` serves only the web build.
- The LangGraph runtime must run as its own process or container.
- Analyst MCP must run as its own process or container when acquisition features are enabled.
- Shared artifact and workspace storage should be mounted consistently anywhere file-backed workflows are used.

## Health Checks

- Web app: application-level route or load balancer check
- LangGraph runtime: runtime HTTP health endpoint
- Analyst MCP: `/health` and `/api/health/details`

## Verification

Recommended production validation:

```bash
pnpm build
pnpm test -- --run
pnpm test:runtime
pnpm test:analyst-mcp
pnpm validate:inventory
```
