# ORIGO Trade Agent Rules

This file defines how AI coding agents should work in this repository.

## First Response Rule

Before making any code change, state the work scope first.

Use exactly one of these scopes:

- `frontend`
- `backend`

The first working response should include:

1. `Scope: <frontend|backend>`

Example:

- `Scope: backend`

## Scope Definitions

### `frontend`

Use this when changing UI-only behavior:

- pages
- components
- client-side state
- routing
- visual layout
- form behavior

Do not change backend contracts in this scope.

### `backend`

Use this when changing server-side behavior:

- API routes
- validation
- auth / RBAC
- database access
- migrations
- upload handling
- Supabase functions

Do not change frontend page flow in this scope.

## Repository Boundaries

### Frontend-owned paths

- `src/app`
- `src/features`
- `src/components`
- `src/contexts`
- `src/hooks`

### Backend-owned paths

- `server/app`
- `server/routes`
- `server/services`
- `server/db`
- `server/middleware`
- `server/config`
- `server/migrations`
- `supabase`

### Cross-boundary paths

- `src/services`
- `src/data-access`
- `src/types`

Changes in these paths must still be declared as either `frontend` or `backend`.

If they affect API shape, schema, auth flow, or data contract, default to `backend`.

## Change Rules

- Do not silently cross from frontend to backend or backend to frontend.
- Keep changes inside the declared scope unless cross-boundary edits are explicitly stated.
- If a contract changes, state it explicitly before editing.
- Prefer the smallest safe change set for the requested task.
- Do not move or rename files outside the declared scope unless required by the task.

If a task touches both sides, still choose only one scope:

- choose `frontend` if the task is primarily UI-driven
- choose `backend` if the task changes contracts, schema, auth, API logic, or data shape

Then explicitly state that there is cross-boundary impact.

## Verification Rules

Run checks that match the declared scope:

- `frontend`: `npm run build`, `npm run lint`
- `backend`: relevant route/service checks, targeted tests, syntax checks

If a declared `frontend` or `backend` task includes cross-boundary changes, also run the checks needed by the affected side.

If a check cannot be run, say exactly what could not be verified.

## When Unclear

If the request is ambiguous, ask one short clarifying question before making broad changes.

If the request is clear, do not ask for confirmation just to begin.
