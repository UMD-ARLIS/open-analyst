# Workspace Settings And Approvals

## Settings Model

Open Analyst now treats workspace settings as one product surface with explicit ownership boundaries.

User-owned registries:

- connectors
- credentials
- skills
- logs and diagnostics preferences

Project-owned defaults:

- active connector selection
- pinned project skills
- memory policy
- retrieval policy
- storage overrides
- runtime brief and project context

The UI surface for these settings is the workspace settings panel. Legacy settings tabs such as `Sandbox` are removed from the supported product model.

## Effective Configuration

The runtime resolves thread behavior from three layers:

1. user-owned registries
2. project defaults
3. thread metadata and runtime context

The browser should display the effective configuration, but the runtime remains the source of truth for execution behavior.

## Connectors

Connectors are stored as user-scoped records and then activated per project. A connector may be:

- disabled in the user registry
- enabled globally for the user
- selected or unselected for a project

Connector definitions support:

- transport type (`stdio`, `http`, `sse`)
- command and args
- environment variables
- headers
- endpoint URL

Connector-specific options belong in the connector definition itself, not in ad hoc project UI state.

## Skills

Skills have three different states that should not be conflated:

- enabled: available to the user
- pinned: explicitly attached to a project
- auto-matched: selected by runtime context based on the repository or task

The workspace settings UI should make those differences visible so operators can tell what is active and why.

## Credentials

Credentials are user-scoped records. They are not shared across users or implicitly global to the host machine.

If a credential is referenced by a connector or runtime integration, that relationship should be inspectable in the UI. Free-form stored credentials with no execution path should be considered dead weight and removed rather than left ambiguous.

## Memory And Retrieval

`Memory` and `Retrieval` settings are only valid if they change runtime behavior.

Memory settings should affect:

- proposal and promotion behavior
- durable project memory visibility
- retrieval participation during runs

Retrieval settings should affect:

- evidence channel participation
- ranking and candidate limits
- whether memories and project documents are included

Settings that do not change runtime behavior should not remain in the product.

## Approval Model

Runtime approvals belong to the active thread workspace. They should not be duplicated in other product surfaces.

The supported model is:

1. the supervisor gathers candidate work
2. the runtime emits one interrupt or ordered interrupt batch
3. the user approves, rejects, or edits in the thread workspace
4. the runtime resumes on the same thread and checkpoint

The `Sources` panel is a browsing and staging surface. It may show ingest status, but it should not render generic runtime approval cards.

## Mode Escalation

Mode switches are approval-gated runtime actions.

The intended flow is:

1. a run starts in `chat`, `research`, or `product`
2. the supervisor decides a stronger mode is required
3. the runtime emits a mode escalation approval
4. the user approves or rejects
5. the same thread resumes in the approved mode

Users should not need to pre-toggle modes manually just to let the agent continue reasonable work.

## Diagnostics

Diagnostics should answer operational questions directly:

- which model is active
- which connectors are active
- which skills are enabled, pinned, or auto-matched
- which interrupts are pending
- which runtime and storage backends are in force

Diagnostics are not just raw logs. Logs are one input to diagnosis, not the whole diagnostics surface.
