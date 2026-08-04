"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const sourceRoot = path.resolve(__dirname, "../src");
const localePath = path.join(sourceRoot, "app", "locale-context.tsx");

function files(directory = sourceRoot) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return files(target);
    return /\.(ts|tsx)$/.test(entry.name) && !entry.name.includes(".test.")
      ? [target]
      : [];
  });
}

function parse(file) {
  return ts.createSourceFile(
    file,
    fs.readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

function translationKeys() {
  const keys = new Set();
  const source = parse(localePath);
  function visit(node) {
    if (
      ts.isNewExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "Map"
    ) {
      const entries = node.arguments?.[0];
      if (entries && ts.isArrayLiteralExpression(entries)) {
        for (const entry of entries.elements) {
          if (
            ts.isArrayLiteralExpression(entry) &&
            ts.isStringLiteralLike(entry.elements[0])
          ) {
            keys.add(entry.elements[0].text);
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return keys;
}

test("every literal translation call has an English dictionary entry", () => {
  const keys = translationKeys();
  const missing = [];
  for (const file of files()) {
    const source = parse(file);
    function visit(node) {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === "t" &&
        ts.isStringLiteralLike(node.arguments[0]) &&
        !keys.has(node.arguments[0].text)
      ) {
        missing.push(
          `${node.arguments[0].text} (${path.relative(sourceRoot, file)})`,
        );
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  assert.deepEqual(missing, []);
});

test("locale switching retains the stable Chinese and English identifiers", () => {
  const source = fs.readFileSync(localePath, "utf8");
  const models = fs.readFileSync(
    path.join(sourceRoot, "app", "models.ts"),
    "utf8",
  );
  assert.match(models, /type Locale = "zh-CN" \| "en-US"/);
  assert.match(source, /harbor-console-language/);
  assert.match(source, /document\.documentElement\.lang = locale/);
});
