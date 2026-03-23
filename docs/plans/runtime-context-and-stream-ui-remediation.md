# Runtime Context And Stream UI Remediation

## Summary

This plan covers two separate defects:

1. Pydantic serializer warnings caused by a typed runtime context object leaking into Agent Server serialization paths that expect plain JSON-like `context`.
2. Browser main-thread lockups during planner/drafter-heavy runs caused by over-subscribed `useStream` updates, unstable message keys, and expensive render-time subagent lookups.

Reference material:

- LangChain Deep Agents customization and `context_schema`: https://docs.langchain.com/oss/python/deepagents/customization#customize-deep-agents
- LangChain Deep Agents frontend subagent streaming: https://docs.langchain.com/oss/javascript/deepagents/frontend/subagent-streaming#subagent-streaming

## Implementation Changes

### Runtime context serialization

- Keep the graph-level context contract explicit, but use a dict-shaped schema at the HTTP and Agent Server boundaries.
- Ensure any context emitted through run payloads, metadata, or debug payloads is a plain `dict[str, Any]`.
- Remove any dependence on `BaseModel.model_dump()` for the main runtime context path so the Agent Server sees plain JSON-like context instead of a `RuntimeProjectContext(...)` instance.

### Main thread stream performance

- Bound live-thread state history to the latest checkpoint snapshot instead of unbounded history.
- Add moderate stream throttling so planner/drafter event bursts do not force a React render on every tick.
- Narrow memo dependencies in the chat view to concrete slices of stream state instead of the entire `stream` object.
- Stabilize message IDs so React does not remount cards during streaming when the SDK omits a message id.
- Preserve message timestamps once per stable message ID instead of regenerating them on every render.
- Precompute subagent groupings outside the message render loop and avoid calling `getSubagentsByMessage(...)` inline for each assistant message.
- Limit interrupt extraction to known shapes instead of rescanning arbitrary objects in `stream.values`.

## Implemented

- `RuntimeProjectContext` was changed to a dict-shaped schema so the Agent Server and Pydantic serializer paths see plain JSON-like context instead of a `BaseModel` instance.
- Run enrichment now normalizes runtime context into a plain payload before injecting it into Agent Server requests.
- The main thread stream now uses bounded history (`limit: 1`) and moderate throttling (`32ms`) to reduce render pressure during planner/drafter bursts.
- The assistant workspace now uses stable fallback message IDs, preserves timestamps per message ID, defers noisy stream slices, and precomputes subagent groupings outside the render loop.
- `MessageCard` is memoized to reduce repeated rerenders during active streams.

## Test Plan

- Run a planner-heavy prompt and confirm the tab remains responsive while subagents are active.
- Run a drafter-heavy prompt and confirm there is no browser unresponsive dialog and no tab crash.
- Confirm prior thread content still loads after navigation and reconnecting to an in-progress run still works.
- Confirm subagent cards remain attached to the correct assistant message after the render-path changes.
- Confirm approvals still surface and can be resumed.
- Confirm the runtime log no longer emits the `field_name='context'` Pydantic serializer warning during normal runs.
- Run `pnpm lint`, `pnpm build`, and restart `pnpm dev:runtime` before manual verification.

## Assumptions

- Optimize for a balanced tradeoff: keep useful live subagent visibility, but prefer bounded history and modest throttling over maximal per-event fidelity.
- Do not change Deep Agents native skill wiring or the existing `matched_skill_ids` debug metadata flow as part of this work.

## Next Steps

- Run a real browser repro with planner-heavy and drafter-heavy prompts and confirm the tab no longer hits the browser unresponsive dialog.
- Watch runtime logs during those runs and confirm the previous `field_name='context'` serializer warning does not return.
- If the UI still feels heavy, profile the `AssistantWorkspaceView` render loop in React DevTools and consider moving subagent detail behind progressive disclosure or a separate panel.
- If needed, tune stream throttling further or reduce history/subagent reconstruction in the main chat view without removing reconnect support.
