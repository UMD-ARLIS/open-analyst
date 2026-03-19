# Repository Guidelines

## Project Structure & Module Organization
`app/` contains the React Router 7 UI and product `/api/*` routes. The browser now talks directly to LangGraph Agent Server for chat threads/runs/streaming; the old `api.runtime` proxy route is gone. The main code paths are `app/components/`, `app/routes/`, `app/hooks/`, and `app/lib/` for chat state, skills, connectors, storage, and database logic. `services/langgraph-runtime/` contains the Python Agent Server + Deep Agents runtime in `src/` and its pytest suite in `tests/`. `services/analyst-mcp/` contains the external literature and acquisition service. Database migrations live in `drizzle/`, product skill bundles live in `skills/`, and repo docs live in `docs/`. Treat `build/`, `test-results/`, Python `__pycache__/`, and generated egg-info files as generated output.

## Build, Test, and Development Commands
Use `pnpm` at the repo root and `uv` through the provided scripts for Python services.

- `pnpm dev`: start the web app on port `5173`.
- `pnpm dev:runtime`: run the Deep Agents runtime from `services/langgraph-runtime/`.
- `pnpm dev:analyst-mcp`: run Analyst MCP from `services/analyst-mcp/`.
- `pnpm dev:all`: run web app, runtime, and Analyst MCP together.
- `pnpm build`: create the production React Router build.
- `pnpm start`: serve the built web app only.
- `pnpm test -- --run`: run Vitest once for TypeScript tests.
- `pnpm test:e2e`: run Playwright specs from `tests/e2e/`.
- `pnpm test:runtime`: run Python `pytest` for the Deep Agents runtime.
- `pnpm test:analyst-mcp`: run Python `pytest` for Analyst MCP.
- `pnpm lint`: lint the current TypeScript tree.
- `pnpm format`: apply Prettier formatting.
- `pnpm db:generate` / `pnpm db:migrate`: generate and apply Drizzle migrations.
- `pnpm setup:python`: create or refresh both Python virtual environments.

## Coding Style & Naming Conventions
TypeScript is strict-mode and uses `~/...` path aliases. Prefer 2-space indentation in TypeScript/JSON/CSS and 4 spaces in Python. Use `PascalCase` for React components, `camelCase` for functions and variables, and `kebab-case` for skill folders and non-component files unless React Router route naming requires otherwise. Keep chat changes structured: stream progress, tool calls, and status updates as typed event/content blocks, while final assistant text is persisted separately. In Python runtime code, prefer explicit typed payload shaping over passing raw provider responses through to the model.

## Testing Guidelines
Name frontend tests `*.test.ts` or `*.spec.ts` under `tests/rr7/`, `tests/e2e/`, or route-adjacent locations. Put browser flows in `tests/e2e/*.spec.ts`. Python runtime tests follow `test_*.py` under `services/langgraph-runtime/tests/`; Analyst MCP tests live under `services/analyst-mcp/tests/`. When changing chat or runtime behavior, cover both the direct Agent Server client path in the React app and the Python runtime middleware/graph flow. When changing research behavior, validate that research prompts prefer retrieval and MCP tools over filesystem wandering. The supervisor delegates research to the `researcher` subagent and document creation to the `drafter` subagent via the `task()` tool. The supervisor cannot use filesystem tools directly (`SupervisorToolGuard` blocks them).

## Current Status
As of March 19, 2026:

- The chat path is Agent Server-first and Deep Agents-first.
- `services/langgraph-runtime/src/webapp.py` owns CORS and request enrichment for Agent Server requests.
- `services/langgraph-runtime/src/runtime_context.py` builds project runtime context on the server from Postgres plus Open Analyst config files.
- `app/hooks/useAnalystStream.ts` points directly at `LANGGRAPH_RUNTIME_URL`.
- The browser sends lightweight thread metadata (`project_id`, `collection_id`, `analysis_mode`) and the server expands that into full runtime context.
- The old `app/routes/api.runtime.$.ts` proxy and its tests were removed.

## Known Issues / Next Fixes
- Convert `stage_literature_collection` away from the custom raw interrupt flow and into a native HITL/tool-policy pattern. Right now source collection still always stops for approval.
- Tighten subagent tool surfaces using native Deep Agents middleware/backend controls. Researcher and drafter still rely too much on default filesystem behavior and prompt discipline.
- Remove duplicated server-side config discovery where possible. `runtime_context.py` currently reconstructs skills/connectors from repo/config files because there is no shared native source yet.
- Consider server-side thread metadata rehydration for non-UI clients. The web UI path is covered because it sends thread metadata on run/resume, but generic external clients do not get that fallback yet.
- Keep updating docs under `docs/` to reflect the Agent Server-first shape; older run-proxy assumptions are obsolete.

## Commit & Pull Request Guidelines
Recent history mixes short imperative subjects and lightweight Conventional Commit prefixes. Prefer concise messages such as `Refactor workspace and deepagents runtime`. PRs should describe the user-visible change, note schema or env updates, link the issue when available, and include screenshots for UI changes. Always list the verification commands you ran.
