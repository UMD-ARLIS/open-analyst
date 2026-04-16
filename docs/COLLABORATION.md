# Collaboration

## Project Access Model

Projects remain the primary security and persistence boundary.

Each project can now have:

- `owner`
- `editor`
- `viewer`

The project owner is still stored on the `projects.user_id` column. Additional collaborators are
stored in `project_members`.

## Roles

- `owner`
  - rename or delete the project
  - change project-level storage and runtime defaults
  - add, remove, and change project members
- `editor`
  - create and run threads
  - import sources
  - create and publish project artifacts
  - update project-scoped working content
- `viewer`
  - open the project
  - inspect threads, sources, artifacts, and diagnostics
  - cannot mutate project state

## Identity Resolution

Membership is attached to app-known users in `app_users`.

The app records a user in `app_users` when they successfully sign in through Keycloak. A project
owner can add a collaborator by email or username after that user has logged in at least once.

This avoids introducing a second user system inside the app while still giving the project owner a
practical way to share access.

## Enforcement

Access is centralized in [project-access.server.ts](/home/ubuntu/code/ARLIS/open-analyst/app/lib/project-access.server.ts).

- page loaders default to `viewer`
- API `GET` routes default to `viewer`
- API mutation routes default to `editor`
- owner-only routes explicitly request `owner`

Runtime proxy routes follow the same policy:

- thread search and thread inspection are `viewer`
- thread creation, run creation, patch/delete, and cancel are `editor`

## Persistence Boundary

Collections, documents, artifacts, canvas documents, and source-ingest batches remain
project-scoped. Membership changes who may access or mutate those project records; it does not
copy project data per user.
