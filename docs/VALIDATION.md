# Validation

## Main Commands

Run these from the repo root.

### Web/App

```bash
pnpm lint
pnpm build
pnpm test -- --run
```

### Runtime

```bash
pnpm test:runtime
```

### Analyst MCP

```bash
pnpm test:analyst-mcp
```

### Browser

```bash
pnpm test:e2e
```

## Recommended Validation Order

1. `pnpm lint`
2. `pnpm build`
3. `pnpm test -- --run`
4. `pnpm test:runtime`
5. `pnpm test:analyst-mcp`
6. `pnpm test:e2e` when a real browser stack is available

## Manual Checks

Use these when validating the full system:

1. Start the stack with `pnpm dev:all`.
2. Create or select a project.
3. Send a normal chat prompt.
4. Send a research-heavy prompt and confirm:
   - literature search tools are used
   - no repo filesystem wandering occurs
   - the response completes cleanly
5. Ask the assistant to collect sources and confirm:
   - a staged batch appears in the Sources panel
   - approval imports the files into Sources
   - imported documents receive storage-backed artifact metadata
   - retrieval can find the imported content
6. Open a source preview or canvas on the right panel and confirm it opens in-panel instead of jumping to a direct storage URL.
7. Capture or generate an artifact and confirm:
   - a real artifact row appears in the Artifacts workspace
   - a first artifact version is created
   - the content route serves `inline` preview by default and `attachment` only with `?download=1`
8. Promote a memory and confirm it appears in runtime-backed memory retrieval.
9. Open settings from the left panel.

## Infrastructure Checks

```bash
curl http://localhost:5173/api/health
curl http://localhost:8081/health
curl http://localhost:8000/health
curl -H "x-api-key: $ANALYST_MCP_API_KEY" http://localhost:8000/api/capabilities
```

## Notes

- Playwright and some integration tests may require Docker or a working browser runtime.
- Runtime issues that look like LiteLLM failures can still be generic runtime exceptions; inspect runtime error events and logs rather than assuming model connectivity is the cause.
