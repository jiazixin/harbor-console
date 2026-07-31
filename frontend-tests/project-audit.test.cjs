"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

test("project audit uses the extended endpoint before an explicit 404 fallback", () => {
  const source = fs.readFileSync(path.join(__dirname, "../web/control-ui.js"), "utf8");
  const start = source.indexOf('route.section === "audit"');
  const end = source.indexOf('route.section === "preheat"', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const implementation = source.slice(start, end);
  assert.match(implementation, /controlList\("project-audit-logs", params\)/);
  assert.match(implementation, /error\.status !== 404/);
  assert.match(implementation, /controlList\("legacy-project-audit-logs", params\)/);
  assert.match(source, /\["audit", "审计", "history", "audit-log", "list"\]/);
});
