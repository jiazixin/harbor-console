"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const app = fs.readFileSync(path.join(__dirname, "../web/app.js"), "utf8");
const control = fs.readFileSync(path.join(__dirname, "../web/control-ui.js"), "utf8");
const admin = fs.readFileSync(path.join(__dirname, "../web/admin-ui.js"), "utf8");
const i18n = fs.readFileSync(path.join(__dirname, "../web/i18n.js"), "utf8");

test("dynamic English labels are translated while rendering", () => {
  assert.match(app, /function authModeLabel[\s\S]*translateUI\(/);
  assert.match(app, /function usersManagedByAuthModeLabel[\s\S]*Users are managed by/);
  assert.match(admin, /usersManagedByAuthModeLabel\(mode\)/);
  assert.match(control, /translateUI\("策略编号"\)/);
  assert.match(control, /translateUI\("策略编号（倒序）"\)/);
  assert.match(control, /translateUI\("最早更新"\)/);
});

test("English dictionary covers the dynamic regression labels", () => {
  for (const label of ["Users are managed by", "Policy ID", "Policy ID (descending)", "Oldest updated"]) {
    assert.match(i18n, new RegExp(`"${label.replace(/[()]/g, "\\$&")}"`));
  }
});
