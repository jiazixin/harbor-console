"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

test("project member dialog uses directory search with stale-response protection", () => {
  const source = fs.readFileSync(path.join(__dirname, "../web/control-ui.js"), "utf8");
  const start = source.indexOf("function showAddMemberDialog()");
  const end = source.indexOf("\nfunction showEditMemberDialog", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const implementation = source.slice(start, end);
  assert.match(implementation, /controlList\("users-search", \{ username: term, page: 1, page_size: 20 \}\)/);
  assert.match(implementation, /controlList\("user-groups-search", \{ groupname: term, page: 1, page_size: 20 \}\)/);
  assert.match(implementation, /window\.setTimeout\(\(\) => search\(term\), 320\)/);
  assert.match(implementation, /requestID !== state\.memberDirectoryRequest/);
  assert.match(implementation, /projectMemberAlreadyExists/);
});
