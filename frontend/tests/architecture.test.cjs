"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "../..");
const frontendRoot = path.join(repositoryRoot, "frontend");
const sourceRoot = path.join(frontendRoot, "src");

function read(relativePath) {
  return fs.readFileSync(path.join(repositoryRoot, relativePath), "utf8");
}

function sourceFiles(directory = sourceRoot) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(target);
    return /\.(ts|tsx)$/.test(entry.name) && !entry.name.includes(".test.")
      ? [target]
      : [];
  });
}

test("production entry mounts the typed React application", () => {
  const main = read("frontend/src/main.tsx");
  assert.match(main, /createRoot\(root\)\.render\(/);
  assert.match(main, /<LocaleProvider>/);
  assert.match(main, /<ReactApplication \/>/);
  assert.doesNotMatch(main, /html-react-parser|loadRuntimeScripts|\?raw/);
});

test("legacy runtime, parser dependency, and preview entry are removed", () => {
  const packageManifest = read("package.json");
  const runtimeDirectory = path.join(frontendRoot, "public", "runtime");
  assert.equal(fs.existsSync(runtimeDirectory), false);
  assert.equal(fs.existsSync(path.join(sourceRoot, "runtime")), false);
  assert.equal(
    fs.existsSync(path.join(sourceRoot, "shell", "application-shell.html")),
    false,
  );
  assert.equal(
    fs.existsSync(path.join(frontendRoot, "react-preview.html")),
    false,
  );
  assert.doesNotMatch(packageManifest, /html-react-parser|check:runtime/);
});

test("embedded web UI boundary contains only Go ownership and generated assets", () => {
  const webUIRoot = path.join(repositoryRoot, "internal", "webui");
  assert.deepEqual(fs.readdirSync(webUIRoot).sort(), ["assets", "embed.go"]);

  const unexpectedFiles = fs
    .readdirSync(path.join(webUIRoot, "assets"), {
      recursive: true,
      withFileTypes: true,
    })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => /\.(?:cjs|map|ts|tsx)$/.test(name));
  assert.deepEqual(unexpectedFiles, []);
});

test("typed source does not recreate classic string-template controllers", () => {
  const source = sourceFiles()
    .map((file) => fs.readFileSync(file, "utf8"))
    .join("\n");
  assert.doesNotMatch(
    source,
    /dangerouslySetInnerHTML|\.innerHTML\s*=|insertAdjacentHTML|createElement\(["']script["']\)/,
  );
  assert.doesNotMatch(
    source,
    /@deprecated|legacy[_-]compat|compatibility[_-]mode/i,
  );
});

test("application routes are rendered by React feature modules", () => {
  const application = read("frontend/src/app/react-application.tsx");
  for (const feature of [
    "OverviewPage",
    "ProjectsPage",
    "RepositoriesPage",
    "ProjectDetailPage",
    "RepositoryDetailPage",
    "ArtifactDetailPage",
    "SecurityPage",
    "RegistriesPage",
    "ReplicationPage",
    "PreheatPage",
    "AuditPage",
    "AdministrationPage",
    "SystemPage",
    "AboutPage",
  ]) {
    assert.match(application, new RegExp(`<${feature}\\b`), feature);
  }
  assert.match(application, /<ApplicationShell/);
});

test("public catalog entry owns a typed React view and click handler", () => {
  const login = read("frontend/src/features/auth/login-page.tsx");
  const catalog = read("frontend/src/features/auth/public-catalog-view.tsx");
  assert.match(login, /id="public-catalog-button"/);
  assert.match(login, /onClick=\{openPublicCatalog\}/);
  assert.match(login, /<PublicCatalogView\b/);
  assert.match(catalog, /publicCatalogApi\.(projects|repositories|artifacts)/);
  assert.doesNotMatch(catalog, /dangerouslySetInnerHTML|\.innerHTML\s*=/);
});

test("shared controls are reused across domain features", () => {
  const sources = sourceFiles().map((file) => fs.readFileSync(file, "utf8"));
  const controlDialogConsumers = sources.filter((source) =>
    source.includes('components/control-dialog"'),
  );
  const selectConsumers = sources.filter((source) =>
    source.includes('components/unified-select"'),
  );
  const tableConsumers = sources.filter((source) =>
    source.includes('components/data-table"'),
  );
  assert.ok(controlDialogConsumers.length >= 10);
  assert.ok(selectConsumers.length >= 8);
  assert.ok(tableConsumers.length >= 5);
});

test("single-choice controls use the shared React select", () => {
  const source = sourceFiles()
    .map((file) => fs.readFileSync(file, "utf8"))
    .join("\n");
  assert.doesNotMatch(source, /<select\b/);
  assert.match(source, /<UnifiedSelect\b/);
});

test("shared select menus escape clipping owners and stay inside the viewport", () => {
  const select = read("frontend/src/components/unified-select.tsx");
  const styles = read("frontend/src/styles/form-controls.css");
  assert.match(select, /createPortal\(menu, document\.body\)/);
  assert.match(select, /availableAbove/);
  assert.match(select, /availableBelow/);
  assert.match(select, /window\.visualViewport/);
  assert.match(
    styles,
    /\.unified-select-menu\s*\{[^}]*position:\s*fixed[^}]*overflow-y:\s*auto/s,
  );
  assert.doesNotMatch(
    styles,
    /\.unified-select-menu\s*\{[^}]*top:\s*calc\(100%/s,
  );
});

test("sorting contracts generate both directions from one field list", () => {
  for (const relativePath of [
    "frontend/src/features/projects/projects-page.tsx",
    "frontend/src/features/projects/project-detail-page.tsx",
    "frontend/src/features/repositories/repositories-page.tsx",
    "frontend/src/features/replication/replication-page.tsx",
  ]) {
    const source = read(relativePath);
    assert.match(source, /createSortValues\(/, relativePath);
    assert.doesNotMatch(
      source,
      /const\s+\w*Sorts?\s*=\s*new Set\(/,
      relativePath,
    );
  }
});

test("data refinements do not remount animated content owners", () => {
  const source = sourceFiles()
    .map((file) => fs.readFileSync(file, "utf8"))
    .join("\n");
  assert.doesNotMatch(
    source,
    /key=\{[^}\n]*(?:routeKey|loadKey|contentVersion|sort)[^}\n]*\}/,
  );
  assert.doesNotMatch(source, /setContentVersion/);
});

test("route entry motion has one owner in the application shell", () => {
  const shell = read("frontend/src/layouts/application-shell.tsx");
  const features = sourceFiles(path.join(sourceRoot, "features"))
    .map((file) => fs.readFileSync(file, "utf8"))
    .join("\n");
  assert.match(
    shell,
    /key=\{contentKey \?\? activeView\} className="motion-route-enter"/,
  );
  assert.doesNotMatch(features, /motion-route-enter/);
});

test("stable data tables keep sortable targets distinct on narrow screens", () => {
  const styles = read("frontend/src/styles/application-shell.css");
  const replicationStyles = read(
    "frontend/src/styles/replication-management.css",
  );
  assert.match(styles, /\.table-scroll\s*\{[^}]*overflow-x:\s*auto/s);
  assert.match(
    styles,
    /\.table-scroll\s*>\s*\.data-table-stable\s*\{[^}]*min-width:\s*max\(100%,\s*760px\)[^}]*table-layout:\s*fixed/s,
  );
  assert.match(
    replicationStyles,
    /\.replication-policy-table\s*\{[^}]*min-width:\s*920px[^}]*table-layout:\s*fixed/s,
  );
  assert.match(
    replicationStyles,
    /\.replication-execution-table\s*\{[^}]*min-width:\s*950px[^}]*table-layout:\s*fixed/s,
  );
});

test("centered sortable headers balance the indicator outside the label axis", () => {
  const styles = read("frontend/src/styles/application-shell.css");
  const workspaceStyles = read("frontend/src/styles/workspace.css");
  assert.match(
    styles,
    /:is\(\.table-cell-center, \.table-cell-number, \.table-cell-time\)\s+\.table-sort-button::before\s*\{[^}]*width:\s*10px[^}]*flex:\s*0 0 10px/s,
  );
  assert.doesNotMatch(
    workspaceStyles,
    /project-select-table[^{]*nth-child[^}]*table-sort-button/s,
  );
});

test("project table keeps semantic alignment classes paired in header and body", () => {
  const source = read("frontend/src/features/projects/projects-page.tsx");
  assert.match(
    source,
    /<SortableHeader\s+label="可见性"[\s\S]*?className="table-cell-center"[\s\S]*?\/\>[\s\S]*?<td\s+className="table-cell-center">[\s\S]*?\{t\(publicProject \? "公开" : "私有"\)\}/,
  );
  assert.doesNotMatch(
    source,
    /<SortableHeader\s+label="可见性"[\s\S]*?className="table-cell-center"[\s\S]*?\/\>[\s\S]*?<td>\s*<span[\s\S]*?publicProject/,
  );
});

test("repository update_time surfaces do not call the value a push time", () => {
  for (const relativePath of [
    "frontend/src/features/repositories/repositories-page.tsx",
    "frontend/src/features/projects/project-detail-page.tsx",
    "frontend/src/features/artifacts/repository-detail-page.tsx",
    "frontend/src/features/auth/public-catalog-view.tsx",
  ]) {
    const source = read(relativePath);
    assert.doesNotMatch(source, /最近推送|Last pushed/, relativePath);
  }
});

test("search uses only the official Harbor response fields", () => {
  const models = read("frontend/src/app/models.ts");
  const overlays = read("frontend/src/layouts/application-overlays.tsx");
  assert.match(
    models,
    /type SearchResults = \{\s*project\?: SearchProject\[\];\s*repository\?: SearchRepository\[\];\s*\};/s,
  );
  assert.doesNotMatch(
    models,
    /projects\?: SearchProject|repositories\?: SearchRepository/,
  );
  assert.match(overlays, /results\?\.project \?\? \[\]/);
  assert.match(overlays, /results\?\.repository \?\? \[\]/);
});

test("production HTML is offline and references only bundled assets", () => {
  const index = read("frontend/index.html");
  assert.match(index, /src="\/src\/main\.tsx"/);
  assert.doesNotMatch(index, /https?:\/\/|\/\/cdn\./);
});
