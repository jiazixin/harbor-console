"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

test("operation indicator uses the declared translation helper", () => {
  const source = fs.readFileSync(path.join(__dirname, "../web/app.js"), "utf8");
  const start = source.indexOf("function updateOperationIndicator()");
  const end = source.indexOf("\nfunction formatDuration", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  assert.match(source.slice(start, end), /button\.title = translateUI\(/);
});

test("audit result filter uses Harbor's query model field", () => {
  const source = fs.readFileSync(path.join(__dirname, "../web/app.js"), "utf8");
  const start = source.indexOf("function auditControlQuery(route)");
  const end = source.indexOf("\nfunction auditQueryValue", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const implementation = source.slice(start, end);
  assert.match(implementation, /`op_result=\$\{/);
  assert.doesNotMatch(implementation, /`operation_result=\$\{/);
});

test("about page links to the current Harbor Swagger without an embedded API manifest", () => {
  const source = fs.readFileSync(path.join(__dirname, "../web/app.js"), "utf8");
  assert.match(source, /\/devcenter-api-2\.0\//);
  assert.match(source, /target="_blank" rel="noopener noreferrer"/);
  assert.doesNotMatch(source, /function aboutAPIReference\(/);
  assert.doesNotMatch(source, /function aboutOperationTable\(/);
});

test("replication and audit filter actions share the aligned toolbar layout", () => {
  const appSource = fs.readFileSync(path.join(__dirname, "../web/app.js"), "utf8");
  const controlSource = fs.readFileSync(path.join(__dirname, "../web/control-ui.js"), "utf8");
  const styles = fs.readFileSync(path.join(__dirname, "../web/styles.css"), "utf8");
  assert.match(appSource, /audit-filter-form filter-toolbar/);
  assert.match(controlSource, /replication-execution-filter" class="table-toolbar filter-toolbar/);
  assert.match(appSource, /filter-toolbar-actions/);
  assert.match(controlSource, /filter-toolbar-actions/);
  assert.match(styles, /\.filter-toolbar-actions \.button\s*\{[^}]*min-height:\s*36px/s);
});

test("retention editing uses Harbor metadata and preserves existing rule fields", () => {
  const source = fs.readFileSync(path.join(__dirname, "../web/control-ui.js"), "utf8");
  const start = source.indexOf("function retentionRuleFromForm");
  const end = source.indexOf("\nfunction retentionRuleFields", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const implementation = source.slice(start, end);
  assert.match(source, /controlData\("retention-metadatas"/);
  assert.match(implementation, /JSON\.parse\(JSON\.stringify\(existing\)\)/);
  assert.match(implementation, /repository_decoration/);
  assert.match(implementation, /tag_decoration/);
  assert.match(implementation, /tag\.extras\.untagged = true/);
  assert.match(source, /metadataAvailable \? "" : "disabled"/);
});
