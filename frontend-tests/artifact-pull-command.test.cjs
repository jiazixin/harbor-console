"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const source = fs.readFileSync(path.join(__dirname, "../web/control-ui.js"), "utf8");

test("artifact pull commands use structured type-aware inputs", () => {
  const start = source.indexOf("function artifactPullCommand");
  const end = source.indexOf("\nfunction fullRepositoryName", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const implementation = source.slice(start, end);
  assert.match(implementation, /instanceHost/);
  assert.match(implementation, /artifact/);
  assert.match(implementation, /helm pull oci:\/\//);
  assert.match(implementation, /--version/);
  assert.match(implementation, /digest/);
  assert.doesNotMatch(implementation, /function artifactPullCommand\(project, repository, reference, digest\)/);
});

test("all artifact pull command consumers pass artifact type context", () => {
  assert.match(source, /artifactPullCommand\(\{[^}]*artifact: artifactItem/s);
  assert.doesNotMatch(source, /artifactPullCommand\(route\.project,/);
  assert.doesNotMatch(source, /artifactPullCommand\(state\.route\.project,/);
});
