# React UI Consistency Follow-Up Plan

> Status: OPEN
> Recorded: 2026-08-04
> Scope: documentation and next implementation cycle; no code change is included in this documentation update.

## 1. Goal

Complete the product-level UI work that was missing or regressed after the React rewrite, while preserving the current visual language and the successful typed React architecture.

This work must not restore the deleted classic runtime and must not replace the interface with a newly designed UI. Small visual changes are allowed only where shared components are currently inconsistent or where removing a non-semantic icon is an explicit requirement.

## 2. Open Requirements

### UI-013: Table-Header Sorting

- Remove independent sorting selects or buttons from toolbars, filters, page headers, and other duplicate locations.
- Keep sorting capability in the relevant sortable column header only.
- Render a shared header button with the column label and two small triangles for ascending and descending order.
- The neutral, ascending, and descending states must be visually clear, keyboard accessible, and exposed through `aria-sort` or an equivalent table contract.
- Map each column to its supported Harbor server-side `sort` value. Changing direction returns to page 1 and preserves valid filters.
- Pages must not implement their own arrow geometry, sort-state cycle, fonts, spacing, or query serialization.

### UI-014: Unified Pagination Footer

- Move every page-size selector, including the common “每页 50 条” control, into the lower-left table footer.
- The left-side order is fixed: range and total first, then the page-size selector. Example: “第 1-50 项，共 128 项 每页 50 条”.
- Page number, previous, and next controls remain on the right.
- Desktop, compact desktop, mobile, Chinese, and English use the same shared pagination primitive. Narrow layouts may wrap logical groups without changing their semantic order.
- Changing page size returns to page 1 and preserves valid filters and sorting.

### UI-015: Project Owner And Visibility Geometry

- Reduce the excessive width of the “项目所有者” filter/control using a bounded width that fits its expected content and does not grow without limit.
- Align “项目所有者” and “可见性” on the same vertical centerline and shared control height.
- Before editing CSS, capture computed height, line-height, vertical padding, border width, icon box, and parent alignment for both controls.
- Fix the responsible shared form/control primitive or token. Do not use page-specific top, margin, translate, or arbitrary pixel offsets to imitate alignment.
- Verify long owner names, Chinese/English labels, 125% zoom, and compact/mobile wrapping.

### UI-016: Project Page Terminology

- Change the Chinese project page/navigation label from “项目” to “项目中心”.
- Change “镜像资产” to “镜像仓库”.
- Apply the terminology through the locale context to navigation, page titles, breadcrumbs, empty/error states, search placeholders, and related accessible labels.
- Review the English equivalents for matching product meaning; do not use DOM text replacement.

### UI-017: Project Overview Metrics

- Restore four overview metrics above the project list: 项目总数、仓库数量、自动扫描覆盖、漏洞阻止覆盖.
- Project and repository counts use the current account's visible Harbor resources.
- Coverage metrics use visible projects as the denominator and show both enabled count and percentage. With zero visible projects, show `0%` without invalid numeric output.
- Use one shared overview primitive and preserve the established typography, spacing, responsive grid, loading state, error state, and animation behavior.
- Partial request failure must be visible and must not silently replace authoritative values with demo or fabricated numbers.

### UI-018: Remove Non-Semantic Resource Icons

- Remove the gray/yellow folder-style icon from project name cells.
- Remove the corresponding decorative icon from image repository name cells.
- Preserve the resource name, secondary metadata, row height, click target, keyboard behavior, and mobile table width.
- Do not remove icons that communicate a real state or invoke an action; any retained leading icon needs an explicit semantic reason.

### UI-019: Complete Route Motion Coverage

- Apply the existing shared linear route-enter motion to every first-level application page, not only Overview and Projects.
- Inventory repositories, security, replication, P2P distribution, audit, administration, system status, about, and every other sidebar route.
- Use the same motion tokens for duration, distance, delay, stagger, and timing. Feature pages must not introduce private keyframes.
- Keep page headers and persistent navigation stable while the owned route content enters.

### UI-020: Unified In-Page Content Motion

- Apply the shared content-enter motion when switching Replication Policies and Execution Records.
- Extend the same contract to domain tabs, filtered results, local refreshes, and list/card view changes across the application.
- Animate the content owner once per interaction. Do not animate both parent and child trees or remount persistent page chrome to obtain an effect.
- Preserve focus, scroll ownership, pending state, and `prefers-reduced-motion` behavior.

### UI-021: Centered Shared Empty States

- Replace left-aligned, row-like empty content with one shared empty-state primitive.
- Center the optional semantic icon, short title, and supporting description as a vertical group within the owning panel, table body, or content region.
- Cover the screenshot cases “没有高风险 CVE”, “没有危险制品”, and “暂无 P2P 实例”, then inventory all other no-data and no-result states.
- Use a consistent minimum content height without centering against the full viewport or creating excessive blank space.
- Keep no-data, no-results, permission, and error states semantically distinct.

### UI-022: Restore Repository List And View Toggle

- Restore list rendering on the cross-project repository page previously named “镜像资产” and scheduled to be renamed “镜像仓库”.
- Place the shared list/card segmented icon control on the right side of the toolbar, matching the existing project-repository `ViewModeToggle` exactly.
- Both modes use the same authoritative data, active filters, sorting, page size, pagination, and persisted preference.
- Switching modes uses the shared content motion and must not resize the toolbar, lose focus, reset the route, or create page-level overflow.

### UI-023: Restore Clear-Filter Actions

- Show a visible “取消筛选” action whenever a list has one or more active search, select, or compound-query filters.
- Hide the action when no filter is active.
- Clearing filters resets only filter-related route state and returns to page 1, while preserving view mode, page size, and valid sorting.
- Use one active-filter helper and one shared action pattern rather than page-specific checks and labels.

### UI-024: Simplify P2P Provider Presentation

- Display Dragonfly, Kraken, and other Provider names without version numbers in the official Provider cards.
- Do not replace returned versions with hard-coded, fixture, or default versions. The UI should not imply compatibility is pinned to a specific Provider release.
- Keep actual provider capabilities and gateway/API validation authoritative even though the version is not presented.
- Render the no-instance state through the shared centered empty-state primitive.

### UI-025: Consistent Section Count Summaries

- Add an authoritative total beside or below list section headings wherever a count improves scanning and is available without unsafe or unbounded requests.
- Required initial coverage includes cross-project repositories, audit logs, administration users, user groups, and system robot accounts; perform a full application inventory beyond these examples.
- Use server pagination totals or an already-complete permission-scoped aggregation, never the current page length as the overall total.
- Standardize typography, spacing, number formatting, Chinese measure words, English pluralization, loading, error, and stale-data behavior through a shared heading/count primitive.

## 3. Implementation Order

1. Inventory every list, sortable field, page-size control, pagination footer, and affected project/repository name cell.
2. Extend shared table and pagination primitives first, with component and architecture tests.
3. Diagnose and fix shared form-control geometry before changing the project center layout.
4. Update locale-driven product terminology.
5. Restore project overview metrics with explicit data contracts and permission-scoped aggregation.
6. Remove decorative resource icons and perform final layout regression.
7. Build a route/tab motion coverage matrix and attach shared motion classes at the correct content owners.
8. Replace scattered empty-state markup with the centered shared primitive.
9. Restore the cross-project repository list and shared list/card toggle.
10. Restore shared clear-filter actions across every filterable list.
11. Remove P2P Provider version presentation and normalize its empty state.
12. Inventory and add authoritative section count summaries.

## 4. Required Verification

- Focused component tests for sortable headers, pagination order, page-size changes, project filters, overview metrics, and icon-free name cells.
- Contract tests preventing independent sort controls and page-size selectors outside the shared footer.
- Browser verification in Chromium, Firefox, and WebKit at 1440x900, 1280x800, 390x844, and 360x800, in Simplified Chinese and English.
- At least one 125% zoom pass for project filters and pagination.
- Sorting must exercise every supported direction against real Harbor or an authoritative contract fixture, including filter preservation and page reset.
- Project overview must cover populated, zero-project, permission-limited, loading, and partial-error states.
- Screenshot/geometry comparison must confirm unchanged typography, buttons, spacing, row height, animation, focus behavior, and page-level overflow outside the explicitly requested adjustments.
- Motion verification must cover every first-level route and representative tab/filter/view-mode transitions, including Replication Policies and Execution Records, with and without reduced motion.
- Empty-state verification must cover security, P2P, repositories, filtered no-results, mobile widths, English text, and error-state separation.
- Repository view verification must cover list/card persistence, route history, filters, sorting, pagination, focus, and transition behavior.
- Filter verification must prove the cancel action appears only for active filters and clears all supported filter types without resetting unrelated state.
- P2P verification must prove Provider versions are absent from visible text and accessible labels while Provider identity remains clear.
- Count-summary verification must compare every displayed count with its authoritative pagination total or documented complete aggregation.
- Run the full repository, frontend, browser, security, real Harbor, and container Gates required by the affected surface before a new release conclusion.

## 5. Completion Conditions

- UI-013 through UI-025 are implemented through shared primitives or clearly owned feature modules.
- No deleted classic code, compatibility renderer, deprecated field, duplicate select, duplicate pagination, or page-specific alignment patch is reintroduced.
- All required tests pass and the browser evidence has no unexplained visual drift.
- `DESIGN.md`, `IMPLEMENTATION.md`, `ACCEPTANCE.md`, and `CHANGELOG.md` are updated with implemented facts and a new acceptance conclusion.

## 6. Pause Checkpoint: 2026-08-05 19:44 Asia/Shanghai

The user explicitly paused the task at this checkpoint. Do not report UI-031 or changelog section 2.10 as finally closed until every remaining item below is completed.

### 6.1 Completed Before Pause

- Centered sortable headers now reserve a 10px counterweight opposite the 10px sort indicator, so the label itself remains on the column axis.
- Project Center, project detail, cross-project repositories, replication policies, replication executions, and audit tables now pair shared `table-cell-center`, `table-cell-number`, and `table-cell-time` classes between headers and body cells. The project-table `nth-child` alignment patch was removed.
- Replication policy and execution tables now use locale-safe stable minimum widths. Direction, status, task statistics, and duration columns were recalculated against the longest supported English header/content instead of the shorter Chinese labels.
- `frontend/e2e/route-matrix.spec.ts` measures header-label, body-content, and cross-axis deltas with a maximum absolute difference of 1px. It also rejects header/body content wider than the cell's padding-adjusted content box.
- Architecture contracts lock the sortable-header counterweight and stable replication-table widths, and reject restoration of the project-specific `nth-child` alignment patch.
- UI-031 and the corresponding design/implementation rules are recorded in `DESIGN.md`, `IMPLEMENTATION.md`, `ACCEPTANCE.md`, and `CHANGELOG.md`.
- A separate flaky search-submit root cause found during the full suite was fixed in the shared `ToolbarSearchForm`: the current input draft survives an unrelated parent rerender, while a real external route-value change still replaces the draft. A focused regression test was added.

### 6.2 Last Passing Evidence

- `npm run check`: PASS after the final shared search-draft change.
- `npm test`: PASS, 27 contract tests plus 46 component test files / 171 component tests after the final shared search-draft change.
- `go test ./...`: PASS after the final shared search-draft change.
- `npm run build`: PASS after the final shared search-draft change; embedded Vite assets match the current source.
- `npm run test:browser`: PASS, 24/24 Chromium/Firefox/WebKit scenarios for Chinese/English at 1440x900, 1280x800, 390x844, and 360x800. This pass occurred before the final `ToolbarSearchForm` draft fix, so it must be rerun once after resume.
- In-app Browser DOM verification reached `http://127.0.0.1:18484/#/replication?tab=executions`, title `Replication · Harbor Console`, rendered the final English execution table, and reported no console warning/error.

### 6.3 Remaining Work After Resume

1. Rebuild/start the current server at `http://127.0.0.1:18484/`; the server was intentionally stopped when the task was paused.
2. Rerun `npm run test:browser` after the final shared search-draft change and require 24/24 scenarios to pass again.
3. Capture final 1280x800 and 390x844 screenshots for replication policies and executions. Record the measured UI-031 deltas, padding-adjusted overflow values, local table-scroll ownership, document/main overflow, and console warning/error results.
4. The interrupted screenshot helper timed out waiting for `.replication-policy-table` after a demo session reset. Treat it only as incomplete evidence, not as a product failure or a pass; rerun the visual capture from a fresh demo login.
5. Run `git diff --check` after all final documentation edits.
6. Update changelog section 2.10 with the final browser evidence and remove its paused/pending wording only after items 1-5 pass.
7. Review the final diff without reverting unrelated pre-existing worktree changes, then provide the user with the completed summary and test URL.

### 6.4 Resumed Completion: 2026-08-05

All items in 6.3 were completed after the user resumed the task:

- Rebuilt the embedded Vite assets and started the demo server at `http://127.0.0.1:18484/`.
- Reran `npm run test:browser` after the final `ToolbarSearchForm` change: 24/24 passed across Chromium, Firefox, and WebKit; Chinese/English; 1440x900, 1280x800, 390x844, and 360x800.
- Captured final in-app Browser screenshots for replication policies and executions at 1280x800 and 390x844 after a fresh demo login. The desktop and mobile screenshots show the table headers and body content on the same axes; mobile tables scroll inside `.table-scroll` instead of widening the document.
- Final desktop measurements at 1280x800: every tested replication execution column had `headerDelta`, `cellDelta`, and `crossDelta` of `0` or `-0.0039px`; all header/body overflow values were `<= 0`. Policy columns had maximum axis delta `0.0039px` and maximum positive header overflow `0.3516px`.
- Final mobile measurements at 390x844: every tested execution column had axis deltas `0` or `-0.0039px` and header/body overflow `<= 0`; policy columns had maximum axis delta `0.0039px` and maximum positive header overflow `0.4609px`. Both tables stayed inside their local scroll owners (`920px` policy width and `950px` execution width); document and main overflow were `0`.
- All four final Browser pages reported an empty error/warning console log. Page identity was `Replication · Harbor Console` at the expected policy/execution URLs, and the DOM snapshot contained the complete table rather than a blank or framework error state.
- Ran `git diff --check` after the final documentation changes: PASS.
- UI-031 and changelog section 2.10 are now eligible for final closure. The overall release conclusion remains subject to the independent real Harbor/container scope already defined elsewhere in this document.
