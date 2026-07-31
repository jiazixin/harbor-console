"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const source = fs.readFileSync(path.join(__dirname, "../web/control-ui.js"), "utf8");

test("artifact list requests accessories and represents signature state conservatively", () => {
  assert.match(source, /with_accessory:\s*true/);
  const start = source.indexOf("function artifactSignatureState");
  const end = source.indexOf("\nfunction artifactSignatureBadge", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const implementation = source.slice(start, end);
  assert.match(implementation, /cosign\|notation/i);
  assert.match(implementation, /"signed"/);
  assert.match(implementation, /"unsigned"/);
  assert.match(implementation, /"unknown"/);
  assert.doesNotMatch(implementation, /signature\)/i);
});

test("artifact annotations have compact list and complete detail renderers", () => {
  assert.match(source, /<th>注释<\/th>/);
  assert.match(source, /function artifactAnnotationSummary/);
  assert.match(source, /function artifactAnnotationsSection/);
  const overviewStart = source.indexOf("function artifactOverview");
  const overviewEnd = source.indexOf("\nfunction artifactPlatformSection", overviewStart);
  assert.notEqual(overviewStart, -1);
  assert.notEqual(overviewEnd, -1);
  assert.doesNotMatch(source.slice(overviewStart, overviewEnd), /slice\(0, 3\)/);
});
