# Agent Architecture

## Runtime Foundation

The runtime in [`services/langgraph-runtime`](/home/ubuntu/code/ARLIS/open-analyst/services/langgraph-runtime) is built around:

- `deepagents.create_deep_agent` with supervisor + subagent delegation pattern
- LangGraph checkpoints for short-term thread continuity
- LangGraph Postgres store for durable memory
- DeepAgents built-in middleware: `SummarizationMiddleware` (auto-compacts at 85% context), `AnthropicPromptCachingMiddleware`, `TodoListMiddleware` (`write_todos` tool), `SubAgentMiddleware` (`task` tool), `FilesystemMiddleware` (auto-included filesystem tools)
- Custom `SupervisorToolGuard` middleware to block built-in filesystem tools on the supervisor
- `interrupt_on` for human-in-the-loop approval on publish and execute tools

## Supervisor (Main Agent)

The supervisor is a thin coordinator. It has only 6 tools:

- `search_project_documents` — quick context checks before delegating
- `search_project_memories` — recall prior findings
- `list_active_skills` — answer "what can you do?"
- `describe_runtime_capabilities` — answer tool/connector questions
- `list_canvas_documents` — check current canvas state
- `propose_project_memory` — persist findings across threads

Plus auto-included by DeepAgents:
- `task` — delegate work to subagents (the primary tool)
- `write_todos` — create and update visible plans

The supervisor does NOT have filesystem tools. DeepAgents auto-injects `ls`, `read_file`, `write_file`, `edit_file`, `glob`, `grep`, `execute` via `FilesystemMiddleware`, but `SupervisorToolGuard` blocks them and returns an error directing the agent to delegate via `task()`.

## Specialist Subagents

Each subagent gets only the tools it needs. Skills are only assigned where relevant.

### researcher
- **Tools:** `search_literature`, `stage_literature_collection`, `stage_web_source`, `search_project_documents`, `read_project_document`, `search_project_memories`
- **Skills:** None (doesn't create artifacts)
- **Output:** Structured summary under 500 words with citations and confidence levels

### drafter
- **Tools:** `list_directory`, `search_project_documents`, `read_project_document`, `execute_command`, `capture_artifact`, `save_canvas_markdown`, `publish_canvas_document`, `publish_workspace_file`, `list_canvas_documents`
- **Skills:** All skill packs (needs SKILL.md for structured products)
- **Output:** Brief summary under 200 words (artifact is already saved)

### critic
- **Tools:** `search_project_documents`, `search_project_memories`, `read_project_document`
- **Skills:** None (reviews, doesn't create)
- **Output:** Structured critique under 400 words with severity levels

### general-purpose
- Overrides the DeepAgents auto-included default (which has a generic prompt and inherits all parent tools)
- Has both research and drafting tools plus all skills
- Fallback for tasks that don't fit the three specialists

## Subagent Observability

All events from `astream_events` carry `metadata.lc_agent_name` to identify which agent produced them. The stream maps this to the `actor` field in `RuntimeEvent`:
- Supervisor events: `actor="supervisor"` or `actor="open-analyst"`
- Subagent events: `actor="researcher"`, `actor="drafter"`, `actor="critic"`, etc.

Supervisor text streams to the user in real-time via `text_delta`. Subagent text is filtered out (internal working) — it returns to the supervisor as the `task` tool result.

## Human-in-the-Loop

The runtime uses `interrupt_on` for high-impact tools:
- `publish_canvas_document` — approve before publishing
- `publish_workspace_file` — approve before publishing artifacts
- `execute_command` — approve shell commands

When interrupted, the LangGraph checkpointer saves state. The web app detects the interrupt, sets the task to `waiting_for_approval`, and the user approves/rejects via the UI. The runtime `/resume` endpoint continues execution.

## Memory Model

### Short-Term Memory
- Persisted via LangGraph checkpointer, scoped to the active thread
- `SummarizationMiddleware` auto-compacts conversation at 85% of context window

### Long-Term Memory
- Stored in the LangGraph Postgres store
- Mirrored from approved app memory records
- Queried through `search_project_memories` tool

### Retrieval Corpus
- Project documents embedded into pgvector
- Promoted project memories
- External literature fetched on demand from Analyst MCP

## Skill Model

Repo `skills/*` are loaded into DeepAgents as runtime skills. Each subagent configured with `skills` gets its own isolated `SkillsMiddleware` instance. Skill state is fully isolated between agents.

- Project/thread-pinned skills are passed from the app
- Matched skills are included in runtime context
- Full SKILL.md body is injected into the supervisor's user prompt for active skills
- `skill-creator` remains excluded from normal end-user runtime behavior

## Context Bloat Prevention

- Supervisor only sees subagent final results (not their internal tool calls)
- All subagent system prompts enforce return size limits
- Subagents save large data to workspace files and return summaries
- `SummarizationMiddleware` truncates large tool outputs in older messages
- `task()` descriptions must be self-contained (subagents are stateless)

## Streaming Events

The runtime streams typed events:
- `status` — phase/progress updates, skill activation, plan updates, delegation status
- `tool_call_start` / `tool_call_end` — tool invocations with agent attribution
- `text_delta` — token-level streaming (supervisor only)
- `memory_proposal` — proposed project memories
- `error` — runtime failures
- `interrupt` — human-in-the-loop approval required
