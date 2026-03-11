# Repository Map

Last updated: 2026-03-11

## Top Level

### `app/`

The React Router application. This contains both UI routes and API routes.

- `root.tsx`: document shell
- `entry.client.tsx`: client hydration entry
- `routes.ts`: route declaration
- `routes/`: page routes, loaders, and API resource routes
- `components/`: reusable UI components
- `hooks/`: client hooks such as chat streaming
- `lib/`: server and shared application logic
- `styles/`: global CSS
- `text/`: translation text

### `services/strands-agent/`

The Python agent service used by chat execution.

- `src/main.py`: runtime entrypoint
- `src/agent_factory.py`: model and tool composition
- `src/tools/`: tool implementations
- `tests/`: Python-side tool tests

### `drizzle/`

Generated database migrations and metadata for the Postgres schema.

### `docs/`

Current documentation and historical planning docs.

- `ARCHITECTURE.md`: current runtime architecture
- `REPOSITORY_MAP.md`: this file
- `plans/`: historical design and implementation plans

### `skills/`

Local built-in skill bundles plus helper scripts, references, and template assets used by the chat skill matcher.

### `build/`

Generated build output for the React Router app.

### `resources/`

Static project assets such as logos and packaging resources.

## `app/routes/`

This directory mixes rendered routes and JSON API endpoints.

### UI shell and pages

- `_app.tsx`: shared layout with top nav and sidebar
- `_app._index.tsx`: landing page when no project is selected
- `_app.projects.$projectId.tsx`: project dashboard route
- `_app.projects.$projectId.tasks.$taskId.tsx`: task chat route
- `_app.projects.$projectId.knowledge.tsx`: project knowledge route
- `_app.settings.tsx`: settings page

### Loaders

- `_app.loader.server.ts`: root app data hydration
- `_app.projects.$projectId.loader.server.ts`: project-scoped task and collection data
- `_app.projects.$projectId.tasks.$taskId.loader.server.ts`: task and message data
- `_app.projects.$projectId.knowledge.loader.server.ts`: knowledge page project data
- `_app.settings.loader.server.ts`: settings page data

### API routes

The `api.*.ts` files expose the browser-facing JSON API.

Major groups:

- `api.projects*`: projects, collections, documents, imports, tasks, runs, RAG
- `api.chat*`: synchronous and streaming chat
- `api.models.ts`: available models from LiteLLM
- `api.mcp*`: MCP presets, servers, status, and tools
- `api.skills*`: installed skills and validation/install toggles
- `api.credentials*`: stored credentials
- `api.logs*`: dev log controls
- `api.config.ts`, `api.workdir.ts`, `api.health.ts`: core runtime config

## `app/components/`

Key UI components:

- `TopNav.tsx`: project switcher and section navigation
- `Sidebar.tsx`: task list for the active project
- `QuickStartDashboard.tsx`: project landing page
- `ChatView.tsx`: task chat interface
- `KnowledgeWorkspace.tsx`: collection and document management
- `KnowledgePanel.tsx`: task-adjacent knowledge access
- `SettingsPanel.tsx`: settings UI
- `MessageCard.tsx`: rendered assistant/user message blocks

## `app/lib/`

### Agent integration

- `agent/interface.ts`: provider contract
- `agent/index.server.ts`: provider selection
- `agent/strands.server.ts`: Node-to-Python adapter

### Database

- `db/index.server.ts`: Drizzle client
- `db/schema.ts`: table definitions
- `db/queries/`: focused query modules

### Runtime utilities

- `chat.server.ts`: non-streaming agent wrapper
- `chat-stream.ts`: folds streamed agent events into structured assistant content
- `filesystem.server.ts`: per-project workspace paths
- `litellm.server.ts`: model discovery and resolution
- `env.server.ts`: validated environment variables
- `mcp.server.ts`: local MCP config persistence
- `skills.server.ts`: local skill config persistence
- `helpers.server.ts`: config-dir and JSON helpers
- `headless-api.ts`: browser-side wrappers for `/api/*`
- `store.ts`: Zustand state
- `types.ts`: shared type definitions

## `services/strands-agent/src/tools/`

Tool modules are split by concern:

- `file_tools.py`: workspace file reads/writes/search
- `command_tools.py`: shell command execution
- `web_tools.py`: web fetch/search style tools
- `research_tools.py`: higher-level research flows
- `project_tools.py`: interaction with the Node app for projects, collections, and captures

## Suggested Reading Order

For a fast codebase walkthrough, read:

1. `package.json`
2. `app/routes.ts`
3. `app/routes/_app.tsx`
4. `app/components/ChatView.tsx`
5. `app/routes/api.chat.stream.ts`
6. `app/lib/agent/strands.server.ts`
7. `services/strands-agent/src/agent_factory.py`
8. `app/lib/db/schema.ts`
