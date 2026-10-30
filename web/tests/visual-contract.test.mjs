import { readStyleLayer } from "./style-layers.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "vitest";

const stylesRoot = path.resolve(import.meta.dirname, "../src/styles");
const read = (name) =>
  [
    "base",
    "shell",
    "page",
    "controls",
    "collections",
    "feedback",
    "dialogs",
    "logs",
    "motion",
  ].includes(name.replace(/\.css$/, ""))
    ? readStyleLayer(name.replace(/\.css$/, ""))
    : fs.readFileSync(path.join(stylesRoot, name), "utf8");

test("font, color, spacing, and motion tokens remain stable", () => {
  const tokens = read("tokens.css");
  assert.match(tokens, /--font-body:[\s\S]*"Avenir Next"[\s\S]*"PingFang SC"/);
  assert.match(tokens, /--sidebar-width:\s*248px/);
  assert.match(tokens, /--topbar-height:\s*60px/);
  assert.match(tokens, /--space-control-compact:\s*4px/);
  assert.match(tokens, /--space-control:\s*8px/);
  assert.match(tokens, /--space-control-group:\s*16px/);
  assert.match(tokens, /--motion-standard:\s*220ms/);
});

test("top bar controls share compact geometry", () => {
  const shell = read("shell.css");
  const controls = read("controls.css");
  assert.match(shell, /\.globalSearch\s*\{[^}]*height:\s*34px/s);
  assert.match(shell, /\.accountButton\s*\{[^}]*height:\s*34px/s);
  assert.match(shell, /\.topInstanceSwitcher\s*\{[^}]*height:\s*34px/s);
  assert.match(
    controls,
    /\.iconButton\s*\{[^}]*width:\s*34px;[^}]*height:\s*34px/s,
  );
  assert.match(shell, /border-radius:\s*var\(--radius-control\)/);
});

test("brand reuses the favicon and instance switching has one shell owner", () => {
  const shell = read("shell.css");
  assert.match(shell, /\.brandMark\s*\{[^}]*border-radius:\s*8px/s);
  assert.match(shell, /\.brandMark img\s*\{[^}]*width:\s*100%/s);
  assert.doesNotMatch(shell, /\.brandMark::after/);
  assert.doesNotMatch(shell, /\.instance-button|\.instance-switcher/);
  assert.match(shell, /\.topInstanceSwitcher\s*\{/);
});

test("search, notice, and control overlays retain their fixed dimensions", () => {
  const overlays = read("dialogs.css");
  assert.match(
    overlays,
    /\.searchDialog\s*\{[^}]*width:\s*min\(620px, 100%\)/s,
  );
  assert.match(overlays, /\.searchInputRow\s*\{[^}]*height:\s*58px/s);
  assert.match(
    overlays,
    /\.noticePanel\s*\{[^}]*top:\s*53px;[^}]*right:\s*16px;[^}]*width:\s*min\(360px/s,
  );
  assert.match(
    overlays,
    /\.controlDialog\s*\{[^}]*width:\s*min\(620px, 100%\)/s,
  );
  assert.match(overlays, /border-radius:\s*var\(--radius-dialog\)/);
});

test("mobile shell remains bounded to the viewport", () => {
  const overlays = read("shell.css");
  assert.match(overlays, /@media \(max-width:\s*560px\)/);
  assert.match(overlays, /\.globalSearch\s*\{[^}]*width:\s*34px/s);
  assert.match(overlays, /\.topInstanceSwitcher\s*\{[^}]*width:\s*34px/s);
  assert.match(overlays, /\.accountButton\s*\{[^}]*width:\s*34px/s);
  assert.match(
    overlays,
    /\.workspace\s*\{[^}]*max-width:\s*100vw;[^}]*overflow-x:\s*clip/s,
  );
  assert.match(overlays, /\.mainContent\s*\{[^}]*max-width:\s*100vw/s);
});

test("buttons, panels, and overlays use the shared motion system", () => {
  const controls = read("controls.css");
  const dialogs = read("dialogs.css");
  const base = read("base.css");
  assert.match(
    controls,
    /\.globalSearch,[\s\S]*\.accountButton,[\s\S]*\.topInstanceSwitcher/,
  );
  assert.match(dialogs, /\.dialogBackdrop:not\(\[hidden\]\)/);
  assert.match(dialogs, /\.noticePanel:not\(\[hidden\]\)/);
  assert.match(base, /@media \(prefers-reduced-motion:\s*reduce\)/);
});

test("same-type data controls use shared compact metrics", () => {
  const controls = read("controls.css");
  const base = read("base.css");
  const collections = read("collections.css");
  assert.match(controls, /\.unifiedSelectTrigger/);
  assert.match(
    base,
    /input,\s*select\s*\{[^}]*height:\s*var\(--control-height\)/s,
  );
  assert.match(collections, /\.tableToolbar/);
  assert.match(collections, /\.controlPagination/);
});

test("dense artifact actions wrap without changing shared button geometry", () => {
  const artifacts = read("../features/artifacts/artifacts.module.css");
  assert.match(
    artifacts,
    /\.artifactDetailActions\s*\{[^}]*max-width:\s*640px;[^}]*flex-wrap:\s*wrap/s,
  );
});

test("shared and feature styles do not reference undefined design tokens", () => {
  const sourceRoot = path.resolve(stylesRoot, "..");
  const styles = fs
    .readdirSync(sourceRoot, { recursive: true })
    .filter((file) => file.endsWith(".css"))
    .map((file) => fs.readFileSync(path.join(sourceRoot, file), "utf8"))
    .join("\n");
  const defined = new Set(
    [...styles.matchAll(/(--[\w-]+)\s*:/g)].map((match) => match[1]),
  );
  const used = new Set(
    [...styles.matchAll(/var\((--[\w-]+)/g)].map((match) => match[1]),
  );
  assert.deepEqual(
    [...used].filter((token) => !defined.has(token)),
    [],
  );
});
