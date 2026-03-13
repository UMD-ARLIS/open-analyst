# Agent Architecture

Open Analyst now uses a conservative multi-agent structure:

- `primary chat agent`: owns the user session, tool orchestration, and final answer
- `research worker`: optional specialist for `deep_research` turns
- `analyst-mcp`: remains a tool service, not an autonomous peer agent

## Current delegation model

The browser and web app contract does not change. Requests still flow through the React Router server into the Strands service.

When `deep_research` is enabled:

1. The primary agent invokes a bounded research worker first.
2. The worker receives a narrowed tool set focused on web, paper, and MCP research tools.
3. The worker returns a compact evidence bundle.
4. The primary agent uses that evidence to produce the final answer.

If the worker fails, the primary agent continues without it.

## Why this shape

This repo benefits from specialization on research-heavy tasks, but it does not yet need a general-purpose agent swarm.

- Reliability: one agent still owns the conversation and persistence.
- Efficiency: delegation happens only on explicitly research-oriented turns.
- Resilience: worker failure degrades to the existing single-agent path.
- Containment: tools remain deterministic capabilities instead of autonomous peers.

## Near-term guidance

- Keep session memory on the primary agent only.
- Keep research-worker memory ephemeral and request-scoped.
- Pass only a compact brief into the worker and a compact evidence bundle back out.
- Add more specialists only when a task class is frequent, clearly separable, and measurably improves latency or answer quality.

## Future expansion

If the system needs more specialization later, add workers in this order:

1. `research worker` for breadth-first evidence gathering
2. `execution worker` only if long-running deterministic tool workflows become common
3. Avoid peer-to-peer autonomous agent meshes until there is a concrete eval-backed need
