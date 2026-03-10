# Open Analyst Architecture

Last updated: 2026-03-10

## Overview

Open Analyst has two runtime services:

- a React Router 7 application that serves both the UI and the HTTP API
- a Python Strands agent service that performs model orchestration and tool execution

The React Router app is the system of record for projects, tasks, documents, settings, skills, and MCP configuration. The Strands service is a worker-style dependency used by chat routes.

## Runtime Topology

```text
Browser
  -> React Router UI routes
  -> React Router API routes (/api/*)
     -> Postgres via Drizzle
     -> local config/workspace files
     -> Strands agent service
        -> file/web/research/project tools
        -> LiteLLM gateway
```

## Major Layers

### 1. Web application and API

The `app/` directory contains both rendered UI routes and JSON API routes.

- `app/root.tsx` defines the document shell.
- `app/routes.ts` declares the route tree.
- `app/routes/_app.tsx` is the main authenticated-style shell with the top nav, sidebar, modals, and nested outlet.
- `app/routes/api.*.ts` contains the server endpoints used by the browser and, in some cases, the Python agent.

This is not a separate frontend plus separate Node API server anymore. The React Router dev/build pipeline handles both.

### 2. Client state

Client-side ephemeral UI state lives in Zustand in `app/lib/store.ts`.

This store is used for:

- project list hydration
- active project and collection selection
- UI flags such as modal visibility
- theme and sandbox sync UI state

Authoritative data still comes from route loaders and API routes.

### 3. Database layer

Core domain data is stored in Postgres.

Schema:

- `projects`
- `collections`
- `documents`
- `tasks`
- `messages`
- `task_events`
- `settings`

The schema is defined in `app/lib/db/schema.ts`. Access is organized through small query modules under `app/lib/db/queries/`.

### 4. Agent boundary

Chat does not call the model directly from the browser.

Instead:

1. `ChatView` posts to `/api/chat/stream`
2. `app/routes/api.chat.stream.ts` creates or resumes a task
3. the route selects an agent provider from `app/lib/agent/index.server.ts`
4. the current provider, `StrandsProvider`, forwards the request to the Python service
5. streamed events are persisted as task events and forwarded back to the browser over SSE

### 5. Python Strands service

The Python service lives in `services/strands-agent/`.

Key files:

- `src/main.py`: service entrypoint and streaming handler
- `src/agent_factory.py`: system prompt, model wiring, tool registration
- `src/tools/`: tool implementations for file, command, web, research, and project operations

The Node app sends the Python service:

- chat messages
- project id
- workspace directory
- collection context
- LiteLLM connection details

### 6. Retrieval and knowledge management

Knowledge is stored as project documents linked to collections.

The current retrieval path is lexical ranking implemented in `app/lib/db/queries/documents.server.ts`. The schema already includes an `embedding` column, but the production query path is not vector-based yet.

### 7. Local filesystem state

Not everything is stored in Postgres.

Local JSON files under the Open Analyst config directory are still used for:

- MCP server definitions
- installed skills
- some operational settings files

Per-project working files are stored in workspace folders created by `app/lib/filesystem.server.ts`.

## Main User Flows

### Project dashboard flow

1. User selects or creates a project in the top nav.
2. The project route loader fetches tasks and collections.
3. `QuickStartDashboard` lets the user start a task or jump to knowledge management.

### Chat flow

1. User opens a task route.
2. The task loader fetches task metadata and stored messages.
3. `ChatView` streams responses from `/api/chat/stream`.
4. The browser appends live text while the server persists the final assistant message.

### Knowledge flow

1. User opens `/projects/:projectId/knowledge`.
2. `KnowledgeWorkspace` fetches collections and documents through API routes.
3. Sources can be created manually or imported from URLs/files.
4. The RAG query endpoint searches project documents.

## Configuration and External Dependencies

The main external systems are:

- Postgres
- LiteLLM
- Strands service

Environment variables are validated in `app/lib/env.server.ts` for the Node app and in `services/strands-agent/src/config.py` for the Python service.

## Current Documentation Set

The current source-of-truth docs are:

- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/REPOSITORY_MAP.md`

Historical implementation plans remain under `docs/plans/`.
