"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const stylesRoot = path.resolve(__dirname, "../src/styles");
const read = (name) => fs.readFileSync(path.join(stylesRoot, name), "utf8");

test("font, color, spacing, and motion tokens remain stable", () => {
  const tokens = read("styles.css");
  assert.match(tokens, /--font-body:[\s\S]*"Avenir Next"[\s\S]*"PingFang SC"/);
  assert.match(tokens, /--sidebar-width:\s*248px/);
  assert.match(tokens, /--topbar-height:\s*60px/);
  assert.match(tokens, /--space-control-compact:\s*4px/);
  assert.match(tokens, /--space-control:\s*8px/);
  assert.match(tokens, /--space-control-group:\s*16px/);
  assert.match(tokens, /--motion-standard:\s*220ms/);
});

test("top bar controls retain the legacy geometry", () => {
  const shell = read("application-shell.css");
  assert.match(shell, /\.global-search\s*\{[^}]*height:\s*34px/s);
  assert.match(shell, /\.account-button\s*\{[^}]*height:\s*34px/s);
  assert.match(shell, /\.top-instance-switcher\s*\{[^}]*height:\s*34px/s);
  assert.match(
    shell,
    /\.icon-button\s*\{[^}]*width:\s*34px;[^}]*height:\s*34px/s,
  );
  assert.match(shell, /border-radius:\s*4px/);
});

test("brand and sidebar instance card retain the legacy structure", () => {
  const connection = read("connection.css");
  const shell = read("application-shell.css");
  assert.match(
    connection,
    /\.brand-mark\s*\{[^}]*background:\s*var\(--orange\);[^}]*transform:\s*skew\(-8deg\)/s,
  );
  assert.match(connection, /\.brand-mark::after/);
  assert.match(shell, /\.instance-switcher\s*\{[^}]*margin:\s*16px 12px 6px/s);
  assert.match(
    shell,
    /\.instance-button\s*\{[^}]*min-height:\s*58px;[^}]*grid-template-columns:\s*32px minmax\(0, 1fr\) 16px/s,
  );
});

test("search, notice, and control overlays retain their fixed dimensions", () => {
  const overlays = read("overlays.css");
  const artifactManagement = read("artifact-management.css");
  assert.match(
    overlays,
    /\.search-dialog\s*\{[^}]*width:\s*min\(620px, 100%\)/s,
  );
  assert.match(overlays, /\.search-input-row\s*\{[^}]*height:\s*58px/s);
  assert.match(
    overlays,
    /\.notice-panel\s*\{[^}]*top:\s*53px;[^}]*right:\s*16px;[^}]*width:\s*min\(360px/s,
  );
  assert.match(
    artifactManagement,
    /\.control-dialog\s*\{[^}]*width:\s*min\(620px, 100%\)/s,
  );
  assert.match(overlays, /border-radius:\s*6px/);
});

test("mobile shell remains bounded to the viewport", () => {
  const overlays = read("overlays.css");
  assert.match(overlays, /@media \(max-width:\s*560px\)/);
  assert.match(overlays, /\.global-search\s*\{[^}]*width:\s*34px/s);
  assert.match(overlays, /\.top-instance-switcher\s*\{[^}]*width:\s*34px/s);
  assert.match(overlays, /\.account-button\s*\{[^}]*width:\s*34px/s);
  assert.match(
    overlays,
    /\.workspace\s*\{[^}]*max-width:\s*100vw;[^}]*overflow-x:\s*clip/s,
  );
  assert.match(overlays, /\.main-content\s*\{[^}]*max-width:\s*100vw/s);
});

test("buttons, panels, and overlays use the shared motion system", () => {
  const motion = read("motion-system.css");
  assert.match(
    motion,
    /\.global-search,[\s\S]*\.account-button,[\s\S]*\.top-instance-switcher/,
  );
  assert.match(motion, /\.dialog-backdrop:not\(\[hidden\]\)/);
  assert.match(motion, /\.notice-panel:not\(\[hidden\]\)/);
  assert.match(motion, /@media \(prefers-reduced-motion:\s*reduce\)/);
});

test("same-type data controls use shared compact metrics", () => {
  const forms = read("form-controls.css");
  const controls = read("control-plane.css");
  const shell = read("application-shell.css");
  assert.match(forms, /\.unified-select-trigger/);
  assert.match(forms, /input,\s*select\s*\{[^}]*height:\s*42px/s);
  assert.match(shell, /\.table-toolbar/);
  assert.match(controls, /\.control-pagination/);
});

test("dense artifact actions wrap without changing shared button geometry", () => {
  const artifacts = read("artifact-management.css");
  assert.match(
    artifacts,
    /\.artifact-detail-actions\s*\{[^}]*max-width:\s*640px;[^}]*flex-wrap:\s*wrap/s,
  );
});
