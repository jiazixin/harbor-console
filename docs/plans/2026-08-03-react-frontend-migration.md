# React Frontend Migration Implementation Plan

> Status: COMPLETE. Typed React owns the production application and the classic runtime has been removed; local quality and browser visual-preservation gates pass.

**Goal:** Rewrite the Harbor Console frontend with React while preserving the existing visual and interaction contract exactly.

**Implemented Architecture:** React owns the application root, session state, hash routing, overlays, and all rendered page content. Source lives in `frontend/`; Vite emits immutable production assets into `internal/webui/assets/`, which remains the Go embed boundary. Existing CSS selectors and token values are retained as the visual contract while repeated controls use typed shared components. No classic feature controller or compatibility runtime is shipped.

**Tech Stack:** React, TypeScript, Vite, Vitest, Testing Library, Playwright, Go `embed`

---

## Non-Negotiable Invariants

1. Preserve typography, spacing, layout, colors, controls, animation timing, responsive behavior, and visible copy.
2. Preserve Harbor v2.15.2 request paths, query fields, request fields, validation behavior, and permission behavior.
3. Do not ship the old global-script renderer, compatibility adapters, deprecated API operations, or handwritten files in the generated asset directory.
4. Reuse shared page headers, toolbars, tables, pagination, status badges, dialogs, toasts, form controls, and select controls.
5. Compare the same routes and states before and after migration at 1440x900, 1280x800, 390x844, and 360x800.

## Tasks

### 1. Lock The Baseline

- Run `make check` before modifying frontend sources.
- Capture the login, overview, project table, a dialog, and mobile shell in a real browser.
- Record console errors, visible DOM identity, focus behavior, and responsive overflow.

### 2. Establish The React Build

- Create `frontend/index.html`, `frontend/src/main.tsx`, and typed Vite configuration.
- Add React, Vite, TypeScript, ESLint, Vitest, Testing Library, and Playwright dependencies.
- Build into a temporary directory and copy only generated assets into `internal/webui/assets/`.
- Update `Makefile`, Docker build stages, Go embed patterns, ignore rules, and quality checks.

### 3. Build Shared Application Infrastructure

- Add typed API client, request cancellation, normalized errors, route parsing, preferences, theme, and i18n providers.
- Add shared icon, button, select, status badge, page header, toolbar, data table, pagination, dialog, toast, loading, empty, and error components.
- Reproduce the login/public-catalog shell and authenticated application shell with the existing DOM classes.

### 4. Migrate Feature Areas

- Migrate overview, projects, project detail, repositories, repository detail, artifact detail, and security.
- Migrate registries, replication, preheat, audit, administration, system status, and about.
- Migrate create/edit/delete dialogs, operation center, search, account, instance switching, language, and theme interactions.
- Remove old global scripts after their final consumers are migrated.

### 5. Verification

- Run TypeScript, ESLint, formatting, unit, component, and contract tests.
- Run `go test -race ./...`, `go vet ./...`, the stable API contract test, and the production build.
- Run browser interaction and screenshot comparison for Chinese and English desktop/mobile states.
- Fail the migration for unexplained pixel drift, overflow, overlap, focus loss, animation residue, console errors, or network-contract drift.

### 6. Documentation

- Correct `README.md`, `README.zh-CN.md`, `docs/DESIGN.md`, `docs/IMPLEMENTATION.md`, `docs/ACCEPTANCE.md`, and `docs/CHANGELOG.md` so they describe implemented facts rather than planned architecture.
- Record exact commands, test counts, browser viewports, known blockers, and the distinction between demo/browser evidence and real-Harbor evidence.

## Completion Evidence

- `make check`: PASS, including Go vet/race, frontend checks/tests/build, and production binary build.
- Frontend: 20 contract tests and 153 component tests across 44 files, all passing; TypeScript enforces unused-local and unused-parameter errors.
- Production build: domain chunks, maximum JavaScript chunk 181.71 kB raw / 57.17 kB gzip, no 500 kB warning.
- Production browser: an authenticated legacy/React matrix covered 24 routes, Chinese and English, and 1440x900, 1280x800, 390x844, and 360x800 viewports: 384 checks, zero failures, and zero unexpected console issues.
- Cross-browser production matrix: 47 route/tab states across Chromium, Firefox, and WebKit, Chinese and English, and the same four viewports: 1,128 authenticated route checks, all passing.
- Visual contract: all nine project-detail tabs match the legacy structural projections; representative create and destructive dialogs match the legacy field geometry; project settings identity and single-project deletion behavior match the baseline; no tested route has document/main horizontal overflow.
- Shared controls: every ordinary single-choice control uses `UnifiedSelect`; raw `<select>` is forbidden by the React architecture contract and the production browser checks cover representative toolbar and dialog flows.
- Real Harbor Gate: project, user/member/group, global/project label, Webhook, immutable/retention rule, system robot, artifact tag/label, quota, system configuration, registry, replication, scanner, P2P, long-value presentation, restoration, and complete cleanup passed against Harbor v2.15.2. Replication manual execution reached `Succeed`; scanner limits and default-scanner rules are enforced by both React and the Go gateway.
- Responsive boundary evidence: 390x844, 412x915, and 1280x720 kept document width equal to viewport; dialogs remained internally bounded and long values used local scrolling or 260px ellipsis with full `title`.
- Container runtime Gate: `harbor-console:dev` builds from immutable base-image digests, runs as `nonroot:nonroot` with UID 65532, serves health and every embedded hashed asset, reads the packaged configuration, and exits with code 0 after SIGTERM.
- Final acceptance: all in-scope repository, architecture, API contract, local runtime, real Harbor, browser UI, security, findings-regression, and container Gates pass. Native OIDC login remains outside the migration scope; direct macOS Safari application coverage is informational because Firefox and WebKit Gates pass.
