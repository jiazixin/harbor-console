"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

test("replication policies use a heading count and support ID and update-time sorting", () => {
  const source = fs.readFileSync(path.join(__dirname, "../web/control-ui.js"), "utf8");
  const start = source.indexOf("function replicationPoliciesSection(");
  const end = source.indexOf("\nfunction replicationExecutionsSection", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const implementation = source.slice(start, end);

  assert.match(implementation, /replication-policy-heading/);
  assert.match(implementation, /section-count/);
  assert.match(implementation, /策略编号/);
  assert.match(implementation, /value="-update_time"[^>]*>\$\{translateUI\("最近更新"\)\}/);
  assert.match(implementation, /value="update_time"[^>]*>\$\{translateUI\("最早更新"\)\}/);
  assert.doesNotMatch(implementation, /toolbar-spacer"><\/div><span class="muted"/);
});

test("replication policy routes accept ID and both update-time sort directions", () => {
  const source = fs.readFileSync(path.join(__dirname, "../web/control-ui.js"), "utf8");
  assert.match(source, /\["id", "-id", "name", "-update_time", "update_time"\]/);
});

test("replication execution filters keep the submit action after trigger on the left", () => {
  const source = fs.readFileSync(path.join(__dirname, "../web/control-ui.js"), "utf8");
  const start = source.indexOf("function replicationExecutionsSection(");
  const end = source.indexOf("\nfunction bindReplicationListControls", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const implementation = source.slice(start, end);

  assert.match(implementation, /触发方式[\s\S]*filter-toolbar-actions/);
  assert.doesNotMatch(implementation, /<\/div><div class="filter-toolbar-actions"><button[^>]*type="submit"/);
});

test("replication execution labels and overview columns stay aligned", () => {
  const controlSource = fs.readFileSync(path.join(__dirname, "../web/control-ui.js"), "utf8");
  const appSource = fs.readFileSync(path.join(__dirname, "../web/app.js"), "utf8");
  const controlStart = controlSource.indexOf("function controlExecutionTable(");
  const controlEnd = controlSource.indexOf("\nasync function renderControlRegistries", controlStart);
  const overviewStart = appSource.indexOf("function replicationTable(");
  const overviewEnd = appSource.indexOf("\nasync function renderRegistries", overviewStart);
  assert.notEqual(controlStart, -1);
  assert.notEqual(controlEnd, -1);
  assert.notEqual(overviewStart, -1);
  assert.notEqual(overviewEnd, -1);

  const headers = "<th>执行编号</th><th>策略</th><th>触发方式</th><th>状态</th><th>任务统计</th><th>开始时间</th><th>耗时</th>";
  assert.match(controlSource.slice(controlStart, controlEnd), new RegExp(headers));
  const overview = appSource.slice(overviewStart, overviewEnd);
  assert.match(overview, new RegExp(headers));
  assert.match(overview, /const policyNames = new Map/);
  assert.match(appSource, /replicationTable\(replications\.slice\(0, 6\), replicationPolicies\)/);
});

test("projects support ID and both update-time sort directions", () => {
  const source = fs.readFileSync(path.join(__dirname, "../web/control-ui.js"), "utf8");
  assert.match(source, /\["project_id", "-project_id", "name", "-update_time", "update_time", "-repo_count"\]/);
  assert.match(source, /project-filter-toolbar/);
  assert.match(source, /<option value="project_id"[^>]*>ID<\/option>/);
  assert.match(source, /<option value="update_time"[^>]*>最早更新<\/option>/);
});

test("project and repository-asset toolbar controls use page-specific alignment rules", () => {
  const controlSource = fs.readFileSync(path.join(__dirname, "../web/control-ui.js"), "utf8");
  const appSource = fs.readFileSync(path.join(__dirname, "../web/app.js"), "utf8");
  const styles = fs.readFileSync(path.join(__dirname, "../web/styles.css"), "utf8");

  assert.match(controlSource, /control-project-filter" class="table-toolbar project-filter-toolbar/);
  assert.match(appSource, /table-toolbar repository-asset-toolbar/);
  assert.match(styles, /\.project-filter-toolbar > \.button\[type="submit"\]\s*\{[^}]*translateY\(-3px\)/s);
  assert.match(styles, /\.repository-asset-toolbar \.view-mode-toggle\s*\{[^}]*translateY\(-5px\)/s);
});

test("repository asset cards show their metrics as three aligned rows", () => {
  const styles = fs.readFileSync(path.join(__dirname, "../web/styles.css"), "utf8");
  assert.match(styles, /\.repository-asset-card-grid \.repository-card dl\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)[^}]*padding-top:\s*0/s);
  assert.match(styles, /\.repository-asset-card-grid \.repository-card dl > div\s*\{[^}]*display:\s*flex[^}]*justify-content:\s*space-between[^}]*border-top:/s);
  assert.match(styles, /\.repository-asset-card-grid \.repository-card dl > div:first-child\s*\{[^}]*border-top:\s*0/s);
});
