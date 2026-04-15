# Persistence Map

This document describes where Open Analyst persists data today. It is intentionally concrete: browser state, app-owned PostgreSQL records, runtime durability, filesystem/S3 artifacts, and Analyst MCP storage are all listed here.

## Quick Map

| Layer | What persists there | Primary code |
| --- | --- | --- |
| Browser `localStorage` | theme, browser API/model config fallback, panel widths, canvas draft backup | [browser-config.ts](/home/ubuntu/code/ARLIS/open-analyst/app/lib/browser-config.ts), [theme.ts](/home/ubuntu/code/ARLIS/open-analyst/app/lib/theme.ts), [CanvasPanel.tsx](/home/ubuntu/code/ARLIS/open-analyst/app/components/CanvasPanel.tsx) |
| Browser cookie | authenticated session pointer and minimal user identity | [session.server.ts](/home/ubuntu/code/ARLIS/open-analyst/app/lib/auth/session.server.ts) |
| Web app PostgreSQL | projects, collections, documents, settings, project profiles, artifacts, evidence, source ingest, canvas docs, server-side auth tokens | [schema.ts](/home/ubuntu/code/ARLIS/open-analyst/app/lib/db/schema.ts), query modules under [app/lib/db/queries](/home/ubuntu/code/ARLIS/open-analyst/app/lib/db/queries) |
| Runtime PostgreSQL | runtime threads, runs, replayable stream events, pending/resolved interrupts | [runtime_db.py](/home/ubuntu/code/ARLIS/open-analyst/services/langgraph-runtime/src/runtime_db.py) |
| LangGraph checkpointer/store | graph checkpoints and durable project memory namespaces | [runtime_engine.py](/home/ubuntu/code/ARLIS/open-analyst/services/langgraph-runtime/src/runtime_engine.py), [runtime_context.py](/home/ubuntu/code/ARLIS/open-analyst/services/langgraph-runtime/src/runtime_context.py) |
| Local filesystem | workspace files, local artifacts, credentials, MCP config, skills config, logs | [helpers.server.ts](/home/ubuntu/code/ARLIS/open-analyst/app/lib/helpers.server.ts), [project-storage.server.ts](/home/ubuntu/code/ARLIS/open-analyst/app/lib/project-storage.server.ts) |
| S3 | project artifacts when `ARTIFACT_STORAGE_BACKEND=s3` or project override selects S3 | [project-storage.server.ts](/home/ubuntu/code/ARLIS/open-analyst/app/lib/project-storage.server.ts), [artifacts.server.ts](/home/ubuntu/code/ARLIS/open-analyst/app/lib/artifacts.server.ts) |
| Analyst MCP local/PG storage | paper metadata index and raw acquisition content | [config.py](/home/ubuntu/code/ARLIS/open-analyst/services/analyst-mcp/src/analyst_mcp/config.py), [paper_store.py](/home/ubuntu/code/ARLIS/open-analyst/services/analyst-mcp/src/analyst_mcp/paper_store.py) |

## Browser Persistence

### `localStorage`

- `open-analyst.browser.config.v1`
  - Stores browser-side fallback model/provider/base URL config.
  - This is no longer authoritative for the active model; the DB-backed settings loader wins when available.
  - Code: [browser-config.ts](/home/ubuntu/code/ARLIS/open-analyst/app/lib/browser-config.ts)
- `open-analyst.theme`
  - Stores light/dark preference.
  - Code: [theme.ts](/home/ubuntu/code/ARLIS/open-analyst/app/lib/theme.ts)
- `open-analyst:canvas:list-width`
  - Stores the canvas list pane width.
  - Code: [CanvasPanel.tsx](/home/ubuntu/code/ARLIS/open-analyst/app/components/CanvasPanel.tsx)
- `open-analyst:canvas:draft-backup:<projectId>`
  - Stores the last unsaved canvas draft so reloads can recover edits.
  - Code: [CanvasPanel.tsx](/home/ubuntu/code/ARLIS/open-analyst/app/components/CanvasPanel.tsx)
- Right-dock and side-panel width keys
  - Used for panel sizing only.
  - Code: [ProjectRightDock.tsx](/home/ubuntu/code/ARLIS/open-analyst/app/components/ProjectRightDock.tsx), [ProjectLeftPanel.tsx](/home/ubuntu/code/ARLIS/open-analyst/app/components/ProjectLeftPanel.tsx), [KnowledgePanel.tsx](/home/ubuntu/code/ARLIS/open-analyst/app/components/KnowledgePanel.tsx)

### Cookie Session

- Cookie name: `__oa_session`
- Stores only minimal user identity:
  - `userId`
  - `email`
  - `name`
- Auth tokens are not stored in the cookie; they are hydrated from the DB.
- Code: [session.server.ts](/home/ubuntu/code/ARLIS/open-analyst/app/lib/auth/session.server.ts)

### Not persisted in browser

- Zustand app store is intentionally ephemeral.
- Thread messages, plans, subagents, and interrupts are not supposed to be browser-source-of-truth data.
- Code: [store.ts](/home/ubuntu/code/ARLIS/open-analyst/app/lib/store.ts)

## Web App PostgreSQL

The app owns the user-facing project data model.

### `projects`

- Workspace boundary and project-level storage configuration.
- Important fields:
  - `user_id`
  - `workspace_slug`
  - `workspace_local_root`
  - `artifact_backend`
  - `artifact_local_root`
  - `artifact_s3_bucket`
  - `artifact_s3_region`
  - `artifact_s3_endpoint`
  - `artifact_s3_prefix`
- Code: [schema.ts](/home/ubuntu/code/ARLIS/open-analyst/app/lib/db/schema.ts), [projects.server.ts](/home/ubuntu/code/ARLIS/open-analyst/app/lib/db/queries/projects.server.ts)

### `collections`

- Named source/report buckets inside a project.
- Code: [documents.server.ts](/home/ubuntu/code/ARLIS/open-analyst/app/lib/db/queries/documents.server.ts)

### `documents`

- Imported or published project documents.
- Important fields:
  - `collection_id`
  - `source_type`
  - `source_uri`
  - `storage_uri`
  - `content`
  - `metadata`
  - `embedding`
  - `embedding_vector`
- `embedding_vector` is the pgvector-backed retrieval field.
- Code: [schema.ts](/home/ubuntu/code/ARLIS/open-analyst/app/lib/db/schema.ts), [documents.server.ts](/home/ubuntu/code/ARLIS/open-analyst/app/lib/db/queries/documents.server.ts)

### `settings`

- Per-user app settings.
- Important fields:
  - `active_project_id`
  - `model`
  - `working_dir`
  - `working_dir_type`
  - `s3_uri`
  - `agent_backend`
  - `dev_logs_enabled`
- Code: [schema.ts](/home/ubuntu/code/ARLIS/open-analyst/app/lib/db/schema.ts), [settings.server.ts](/home/ubuntu/code/ARLIS/open-analyst/app/lib/db/queries/settings.server.ts)

### `project_profiles`

- Project briefing and reusable operating policy for the runtime.
- Important fields:
  - `brief`
  - `retrieval_policy`
  - `memory_profile`
  - `templates`
  - `agent_policies`
  - `default_connector_ids`
- Code: [schema.ts](/home/ubuntu/code/ARLIS/open-analyst/app/lib/db/schema.ts), [workspace.server.ts](/home/ubuntu/code/ARLIS/open-analyst/app/lib/db/queries/workspace.server.ts)

### `artifacts` and `artifact_versions`

- Artifact metadata plus version history for generated outputs.
- `artifacts.storage_uri` points to local or S3-backed object storage.
- `artifact_versions.content_text` stores text snapshots for version history.
- Code: [schema.ts](/home/ubuntu/code/ARLIS/open-analyst/app/lib/db/schema.ts), [workspace.server.ts](/home/ubuntu/code/ARLIS/open-analyst/app/lib/db/queries/workspace.server.ts)

### `evidence_items`

- Structured evidence snippets tied to documents or artifacts.
- Code: [schema.ts](/home/ubuntu/code/ARLIS/open-analyst/app/lib/db/schema.ts), [evidence.server.ts](/home/ubuntu/code/ARLIS/open-analyst/app/lib/db/queries/evidence.server.ts)

### `source_ingest_batches` and `source_ingest_items`

- Staging area for source approvals before final import.
- `source_ingest_batches`
  - overall approval/import status
  - source query and summary
  - requested/imported counts
- `source_ingest_items`
  - candidate source URL/metadata
  - storage URI of staged capture
  - import status and error
- Code: [schema.ts](/home/ubuntu/code/ARLIS/open-analyst/app/lib/db/schema.ts), [source-ingest.server.ts](/home/ubuntu/code/ARLIS/open-analyst/app/lib/db/queries/source-ingest.server.ts), [source-ingest.server.ts](/home/ubuntu/code/ARLIS/open-analyst/app/lib/source-ingest.server.ts)

### `canvas_documents`

- Editable working drafts used by the canvas panel.
- `content` is JSON; markdown currently lives at `content.markdown`.
- `artifact_id` links a canvas draft to a published artifact when applicable.
- Code: [schema.ts](/home/ubuntu/code/ARLIS/open-analyst/app/lib/db/schema.ts), [workspace.server.ts](/home/ubuntu/code/ARLIS/open-analyst/app/lib/db/queries/workspace.server.ts)

### `auth_sessions`

- Server-side OIDC token store keyed by user.
- Stores:
  - `access_token`
  - `refresh_token`
  - `id_token`
  - `expires_at`
- Code: [auth-sessions.server.ts](/home/ubuntu/code/ARLIS/open-analyst/app/lib/db/queries/auth-sessions.server.ts), [token-store.server.ts](/home/ubuntu/code/ARLIS/open-analyst/app/lib/auth/token-store.server.ts)

## Runtime PostgreSQL

The runtime owns execution durability and replayable thread state.

### `runtime_threads`

- Canonical runtime thread record.
- Important fields:
  - `project_id`
  - `title`
  - `summary`
  - `analysis_mode`
  - `collection_id`
  - `metadata`
  - `last_values`
  - `current_run_id`
  - `status`
- `last_values` is the last durable runtime state snapshot the UI hydrates from.
- Code: [runtime_db.py](/home/ubuntu/code/ARLIS/open-analyst/services/langgraph-runtime/src/runtime_db.py)

### `runtime_runs`

- One record per run.
- Stores:
  - `status`
  - `input_payload`
  - `command_payload`
  - `error`
  - `last_event_seq`
  - `completed_at`
- Code: [runtime_db.py](/home/ubuntu/code/ARLIS/open-analyst/services/langgraph-runtime/src/runtime_db.py)

### `runtime_run_events`

- Replayable SSE/event log for each run.
- Stores:
  - `sequence_no`
  - `event_type`
  - `payload`
- Stream endpoint replays from here before subscribing to live runtime updates.
- Code: [runtime_db.py](/home/ubuntu/code/ARLIS/open-analyst/services/langgraph-runtime/src/runtime_db.py), [runtime_api.py](/home/ubuntu/code/ARLIS/open-analyst/services/langgraph-runtime/src/runtime_api.py)

### `runtime_interrupts`

- Durable pending/resolved approval records.
- Stores:
  - `interrupt_type`
  - `payload`
  - `status`
  - `resolution`
- Code: [runtime_db.py](/home/ubuntu/code/ARLIS/open-analyst/services/langgraph-runtime/src/runtime_db.py)

## LangGraph Checkpointer And Store

- Graph checkpoints are persisted through the runtime checkpointer.
- Shared project memory is persisted in the LangGraph store, not in the browser.
- Project memory namespace is assembled under the runtime context service and searched through `/store/items/search`.
- The web app uses that memory to build the workspace context shown in the shell.
- Code: [runtime_engine.py](/home/ubuntu/code/ARLIS/open-analyst/services/langgraph-runtime/src/runtime_engine.py), [runtime_context.py](/home/ubuntu/code/ARLIS/open-analyst/services/langgraph-runtime/src/runtime_context.py), [workspace-context.server.ts](/home/ubuntu/code/ARLIS/open-analyst/app/lib/workspace-context.server.ts)

## Filesystem Persistence

Default base directory:

- `${OPEN_ANALYST_DATA_DIR}` if set
- otherwise `~/.config/open-analyst`

Code: [helpers.server.ts](/home/ubuntu/code/ARLIS/open-analyst/app/lib/helpers.server.ts)

### Workspace files

- Default workspace root:
  - `${OPEN_ANALYST_DATA_DIR}/workspaces`
  - or `PROJECT_WORKSPACES_ROOT`
- Actual project workspace path:
  - `<workspace root>/<workspace slug>`
- Code: [project-storage.server.ts](/home/ubuntu/code/ARLIS/open-analyst/app/lib/project-storage.server.ts), [filesystem.server.ts](/home/ubuntu/code/ARLIS/open-analyst/app/lib/filesystem.server.ts)

### Local artifacts

- Default local artifact root:
  - `${OPEN_ANALYST_DATA_DIR}/captures`
  - or `ARTIFACT_LOCAL_DIR`
- Per-project artifact directory:
  - `<artifact root>/<workspace slug>/artifacts`
- Code: [project-storage.server.ts](/home/ubuntu/code/ARLIS/open-analyst/app/lib/project-storage.server.ts), [artifacts.server.ts](/home/ubuntu/code/ARLIS/open-analyst/app/lib/artifacts.server.ts)

### Config JSON files

- `credentials.json`
  - Stored service/account credentials from the Settings UI.
  - Code: [credentials.server.ts](/home/ubuntu/code/ARLIS/open-analyst/app/lib/credentials.server.ts)
- `mcp-servers.json`
  - Stored MCP connector definitions.
  - Code: [mcp.server.ts](/home/ubuntu/code/ARLIS/open-analyst/app/lib/mcp.server.ts)
- `skills.json`
  - Stored enabled/installed skill records.
  - Code: [skills.server.ts](/home/ubuntu/code/ARLIS/open-analyst/app/lib/skills.server.ts)

### Logs

- Logs directory:
  - `${OPEN_ANALYST_DATA_DIR}/logs`
- Default headless log file:
  - `headless.log`
- Code: [logs.server.ts](/home/ubuntu/code/ARLIS/open-analyst/app/lib/logs.server.ts)

## S3 Persistence

When artifact storage resolves to S3:

- bucket comes from project override or env
- region/endpoint/prefix come from project override or env
- final key prefix is:
  - `<base prefix>/<workspace slug>/artifacts/...`

Code: [project-storage.server.ts](/home/ubuntu/code/ARLIS/open-analyst/app/lib/project-storage.server.ts)

## Analyst MCP Persistence

Analyst MCP has its own persistence layer separate from the web app and runtime.

- `storage_root`
  - local service storage root
- `index_root`
  - local metadata index root
- `raw_root`
  - raw fetched content
- metadata backend
  - local JSON manifest at `index_root/papers.json`, or
  - PostgreSQL table in schema `analyst_mcp` when `postgres_dsn` is configured
- optional MinIO/S3-backed object storage can also be configured

Code: [config.py](/home/ubuntu/code/ARLIS/open-analyst/services/analyst-mcp/src/analyst_mcp/config.py), [paper_store.py](/home/ubuntu/code/ARLIS/open-analyst/services/analyst-mcp/src/analyst_mcp/paper_store.py)

## What The UI Reads Back

The main shell reconstructs user-visible state from these durable stores:

- thread state and current run status from runtime `/threads/:id/state`
- replayable stream events from runtime `/events/stream`
- project/workspace context from app tables plus runtime store-backed memories
- artifacts/documents/canvas from app DB and storage backends

Code: [useAnalystStream.ts](/home/ubuntu/code/ARLIS/open-analyst/app/hooks/useAnalystStream.ts), [runtime_api.py](/home/ubuntu/code/ARLIS/open-analyst/services/langgraph-runtime/src/runtime_api.py), [workspace-context.server.ts](/home/ubuntu/code/ARLIS/open-analyst/app/lib/workspace-context.server.ts)
