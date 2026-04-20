# Agent Architecture

## Runtime Foundation

The runtime in [services/langgraph-runtime](/home/ubuntu/code/ARLIS/open-analyst/services/langgraph-runtime) is built on:

- LangGraph Agent Server for threads, runs, streaming, interrupts, and resume
- Deep Agents for planning, delegation, and subagent coordination
- LangGraph checkpoints for short-term thread continuity
- LangGraph Postgres store for durable project memory
- server-owned runtime-context assembly in [runtime_context.py](/home/ubuntu/code/ARLIS/open-analyst/services/langgraph-runtime/src/runtime_context.py)

This split is deliberate:

- Agent Server owns execution state
- Deep Agents owns workflow behavior
- Open Analyst owns product context, skill loading, and project APIs

## Supervisor Model

Open Analyst uses one supervisor per thread. It does not run separate supervisors for chat, research, and product work. Instead, the same supervisor adapts as the thread escalates between lightweight conversation, structured investigation, and deliverable production.

The supervisor is primarily a coordinator:

- it reads project context
- decides when to plan
- decides when to delegate
- presents approvals
- summarizes outcomes back to the user

The supervisor does not use broad filesystem tools directly. File and command work stays delegated to the appropriate subagent.

## Internal Workflow States

The runtime still carries internal workflow hints such as `chat`, `research`, and `product`, but they are execution states, not user-managed walls.

- `chat`: lightweight conversation and quick analysis
- `research`: evidence gathering, source import, synthesis, and memory capture
- `product`: drafting, packaging, and publication

The assistant should escalate between these states on the same thread and ask for approval when the transition implies heavier retrieval, durable source import, command execution, or publication.

## Specialist Subagents

### reviewer

- clarifies ambiguous requests before expensive work begins

### retriever

- searches academic databases (arxiv, openalex, semantic scholar) via Analyst MCP
- searches the web via Tavily (`web_search`, `web_fetch`) for non-academic topics
- stages literature and web sources for consolidated approval
- inspects current project evidence and memories before external retrieval

### researcher

- synthesizes evidence into findings, confidence, gaps, and implications

### argument-planner

- turns research into structured plans and outlines

### drafter

- writes and revises substantive content in canvas

### critic

- reviews products for evidence grounding, structure, and quality gaps

### packager

- generates final delivery formats such as `.docx`
- captures artifacts for project storage

### publisher

- publishes approved outputs into project-facing destinations

### general-purpose

- covers bounded cross-cutting tasks that do not fit the specialist set cleanly

## Workflow Patterns

### Research workflow

1. retrievers gather candidate sources (academic literature and/or web sources)
2. all candidates are batched — the supervisor presents one consolidated approval
3. approved sources are imported into the active collection (with dedup enforcement)
4. researchers synthesize the evidence

### Product workflow

1. planner creates the structure
2. drafter writes the working draft in canvas
3. critic reviews the draft
4. packager generates the final file
5. publisher or packaging flow publishes the result to the target destination

For ARLIS bulletins, the expected product path is planner, drafter, critic, then packager, with the resulting `.docx` captured and published to `Reports`.

## Human Interaction

The runtime uses approval gates for high-impact actions such as source import, publication, and command execution.

The user should stay in one continuous analyst thread while the assistant adapts internally. A common pattern is:

- start with a lightweight question
- escalate into structured retrieval on approval
- continue into drafting or publication on the same thread if needed

## Observability

All streamed events are tagged with agent attribution. The UI uses that data to show:

- supervisor progress
- delegated subagent work
- plan updates
- approvals
- tool activity

Subagent internal reasoning is not streamed as user-facing narrative. The supervisor receives the subagent result and communicates the outcome back into the thread.

## Memory And Retrieval

- short-term thread continuity: LangGraph checkpoints
- durable project memory: LangGraph Postgres store plus project memory records
- retrieval corpus: project documents, published reports, and promoted memories

## Current Operational Constraint

The workflow model is interruptible at thread boundaries and approval points. In-flight run interruption is still effectively `Stop` followed by a new turn, not arbitrary mid-step conversational interleaving.
