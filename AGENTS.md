# Repository Guidelines

## Project Structure & Module Organization
`app/` contains the React Router 7 UI, route modules, hooks, and shared libraries. Key areas are `app/components/`, `app/routes/`, and `app/lib/` for agent and database integrations. `services/strands-agent/` is the Python backend service, with source in `src/` and tests in `tests/`. Database migrations live in `drizzle/`, long-form design notes in `docs/`, reusable automation assets in `skills/`, and static files in `public/` and `resources/`. Treat `build/` and `test-results/` as generated output.

## Build, Test, and Development Commands
Use `pnpm` at the repo root and `uv` for the Python service.

- `pnpm dev`: start the web app on port `5173`.
- `pnpm dev:agent`: run the Strands agent from `services/strands-agent/`.
- `pnpm dev:all`: run both services together.
- `pnpm build`: create the production React Router build.
- `pnpm test -- --run`: run Vitest once for TypeScript tests.
- `pnpm test:e2e`: run Playwright specs from `tests/e2e/`.
- `pnpm test:agent`: run Python `pytest` coverage targets for the agent service.
- `pnpm lint` and `pnpm format`: lint `src`/TypeScript files and apply Prettier formatting.
- `pnpm db:generate` / `pnpm db:migrate`: generate and apply Drizzle migrations.

## Coding Style & Naming Conventions
TypeScript is strict-mode, ES2022, and uses path aliases like `~/components/...`. Prefer 2-space indentation in TypeScript/JSON/CSS and 4 spaces in Python. Use `PascalCase` for React components, `camelCase` for functions and variables, and `kebab-case` for non-component file names unless route conventions require otherwise. Follow ESLint rules in `eslint.config.cjs`; `@typescript-eslint/no-unused-vars` and React Hooks checks are enforced. Use Prettier before submitting UI changes.

## Testing Guidelines
Name frontend tests `*.test.ts` or `*.spec.ts` under `app/` or `tests/`. Put browser flows in `tests/e2e/*.spec.ts`. Python tests follow `test_*.py` under `services/strands-agent/tests/`. Vitest collects V8 coverage; no global threshold is configured, so keep touched paths covered and add regression tests for route, DB, or tool changes.

## Commit & Pull Request Guidelines
Recent history mixes short summaries and Conventional Commit prefixes such as `refactor:`, `docs:`, and `build(deps):`. Prefer concise, imperative subjects with an optional scope, for example `feat: add project artifact export`. PRs should describe the user-visible change, note schema or env updates, link the issue when available, and include screenshots for UI changes. Call out any commands you ran, especially `pnpm test -- --run`, `pnpm test:e2e`, or `pnpm test:agent`.
