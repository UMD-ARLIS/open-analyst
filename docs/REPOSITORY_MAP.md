# Repository Map

## Application

- `app/routes.ts`: route tree for workspace pages and API resources
- `app/routes/`: React Router route modules
- `app/components/`: workspace views and shared UI
- `app/lib/`: database access, runtime integration, project services, and shared utilities
- `app/lib/db/schema.ts`: Drizzle schema for the project-native data model

## Runtime Services

- `services/langgraph-runtime/src/main.py`: FastAPI entrypoint for invoke and streaming endpoints
- `services/langgraph-runtime/src/graph.py`: LangGraph orchestration and node implementations
- `services/langgraph-runtime/src/models.py`: runtime request, event, and state models
- `services/langgraph-runtime/src/telemetry.py`: OpenTelemetry bootstrap helpers
- `services/analyst-mcp/`: external acquisition and article collection service

## Data And Tooling

- `drizzle/`: SQL migrations and drizzle metadata
- `scripts/`: developer scripts, validation helpers, and local maintenance utilities
- `tests/rr7/`: route, component, and server-side TypeScript tests
- `tests/e2e/`: Playwright end-to-end coverage
- `docs/`: architecture, deployment, validation, and implementation notes
- `skills/`: repository skill bundles

## Primary Workspace Surfaces

- `RunWorkspaceView`: live run timeline and streaming output
- `EvidenceWorkspaceView`: normalized project evidence
- `ArtifactsWorkspaceView`: artifact browser and version history entry point
- `CanvasWorkspaceView`: editable analyst documents and deliverables
