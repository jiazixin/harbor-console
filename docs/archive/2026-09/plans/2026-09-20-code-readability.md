# Code readability implementation plan

**Goal:** Improve naming and responsibility boundaries without changing observable behavior.

**Architecture:** Keep the existing Go package and React feature boundaries. Extract session state, domain dialog composition, and project section loading into named modules; preserve request concurrency, cancellation, permissions, and response shapes.

**Tech stack:** Go, React, TypeScript, ESLint, Vitest, Playwright.

## Implementation

1. Split demo replication, registry, and audit handlers. Share audit field filtering while preserving the existing difference in time filtering. Verify gateway and demo tests.
2. Extract application session lifecycle and dialog composition from `web/src/app/react-application.tsx`; use names that describe application-wide state. Verify application interaction tests.
3. Separate project routing and section loading from `project-detail-page.tsx`; replace the long positional result list with section-specific loaders and a small orchestrator. Verify project detail tests, especially permissions and partial errors.
4. Extract replication adapter state and policy payload construction from `replication-dialogs.tsx`. Improve operation-log state names. Verify replication and administration tests.
5. Document naming and function responsibilities in `docs/IMPLEMENTATION.md`; add practical lint checks without imposing arbitrary full-word names on ecosystem conventions.
6. Run formatting, lint, type checking, frontend tests/build, Go vet/race tests, and available browser coverage. Record actual results and limitations.

## Constraints

- Preserve the existing uncommitted directory migration and other user changes.
- Keep API field names and common identifiers such as `ctx`, `err`, and translation `t`.
- Do not move business logic into generic utility directories or alter CSS order.
- Use existing behavior tests; add regression coverage where extraction could change branching or error handling.
