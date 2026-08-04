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
