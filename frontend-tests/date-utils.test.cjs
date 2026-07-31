"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

require("../web/date-utils.js");

const { compareDescending, format, latest, timestamp } = globalThis.HarborDates;

test("date formatting always includes the year", () => {
  assert.match(format("2025-06-15T12:30:00Z", "zh-CN"), /2025/);
  assert.match(format("2025-06-15T12:30:00Z", "en-US", false), /2025/);
});

test("date formatting can be pinned to UTC", () => {
  const value = format("2025-12-31T23:30:00Z", "en-GB", true, "utc");
  assert.match(value, /2025/);
  assert.match(value, /23:30/);
});

test("descending date comparison orders this year before last year", () => {
  const repositories = [
    { name: "last-year", update_time: "2025-12-31T23:59:59Z" },
    { name: "this-year", update_time: "2026-01-01T00:00:00Z" },
  ];

  repositories.sort((left, right) => compareDescending(left.update_time, right.update_time));
  assert.deepEqual(repositories.map((repository) => repository.name), ["this-year", "last-year"]);
});

test("comparison uses absolute timestamps instead of timestamp text", () => {
  const repositories = [
    { name: "earlier-with-new-year-text", update_time: "2026-01-01T00:30:00+01:00" },
    { name: "later-in-utc", update_time: "2025-12-31T23:45:00Z" },
  ];

  repositories.sort((left, right) => compareDescending(left.update_time, right.update_time));
  assert.deepEqual(repositories.map((repository) => repository.name), ["later-in-utc", "earlier-with-new-year-text"]);
});

test("missing and invalid dates sort after valid dates", () => {
  assert.equal(timestamp("not-a-date"), Number.NEGATIVE_INFINITY);
  assert.equal(compareDescending("2026-01-01T00:00:00Z", "not-a-date"), -1);
  assert.equal(compareDescending("", null), 0);
});

test("latest returns the newest valid repository update time", () => {
  assert.equal(latest([
    "2025-12-31T23:45:00Z",
    "not-a-date",
    "2026-01-01T00:30:00+01:00",
    "2026-01-01T00:00:00Z",
  ]), "2026-01-01T00:00:00Z");
  assert.equal(latest(["", null, "not-a-date"]), null);
});
