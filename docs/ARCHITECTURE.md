# Architecture

Open Analyst v3 is a project-native analyst workspace built around project runs rather than task chat sessions.

## Core Services

- `app/`: React Router 7 application, UI surfaces, and same-origin `/api/*` routes.
- `services/langgraph-runtime/`: Python runtime that executes project runs with LangGraph.
- `services/analyst-mcp/`: acquisition and research service for literature search, collection, and downloads.
- PostgreSQL: system of record for projects, runs, evidence, artifacts, and canvas documents.

## Runtime Flow

1. A user starts or resumes a run from a project workspace.
2. The web app persists the run and calls the LangGraph runtime.
3. The runtime executes bounded graph nodes such as planning, research, drafting, and review.
4. Large intermediate outputs are kept in persisted run state or project storage instead of being re-injected into prompts.
5. Evidence, artifact versions, approvals, and run steps are written back to the app database.
6. The UI streams progress into the Runs workspace and related evidence or canvas surfaces.

## Product Model

- `projects`: top-level workspace boundary
- `project_profiles`: project brief, retrieval policy, memory profile, templates, and agent policies
- `project_threads`: analyst-facing conversation or work threads
- `project_runs`: executable runs within a project
- `run_steps`: timeline events and specialist activity
- `approvals`: human-in-the-loop checkpoints
- `evidence_items`: normalized research evidence with provenance
- `artifacts`: generated or imported deliverables
- `artifact_versions`: version history for artifacts
- `canvas_documents`: editable workspace documents

Legacy `tasks`, `messages`, and `task_events` may still exist in older databases during migration windows, but they are no longer the active product model.

## API Shape

The run model centers on project-scoped APIs such as:

- `POST /api/projects/:projectId/runs`
- `GET /api/projects/:projectId/runs/:runId/stream`
- `GET /api/projects/:projectId/runs/:runId/steps`
- `POST /api/projects/:projectId/runs/:runId/interrupt`
- `POST /api/projects/:projectId/runs/:runId/approve`
- `GET /api/projects/:projectId/evidence`
- `POST /api/projects/:projectId/canvas-documents`
- `POST /api/projects/:projectId/artifacts/:artifactId/versions`

## Observability

The runtime is instrumented around OpenTelemetry-friendly spans for:

- run lifecycle
- graph node execution
- retrieval and connector calls
- approvals
- artifact creation
- persistence

LangSmith is the primary evaluation and tracing destination, with room for other OpenTelemetry-compatible backends.
