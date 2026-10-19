"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const sourceRoot = path.resolve(__dirname, "../src");
const localePath = path.join(sourceRoot, "app", "locale-context.tsx");
const messagesPath = path.join(sourceRoot, "app", "locale-messages.ts");

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

function translationEntries() {
  const keys = [];
  const source = parse(messagesPath);
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
            keys.push(entry.elements[0].text);
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return keys;
}

function translationKeys() {
  return new Set(translationEntries());
}

test("the English dictionary defines each Chinese key once", () => {
  const seen = new Set();
  const duplicates = translationEntries().filter((key) => {
    if (seen.has(key)) return true;
    seen.add(key);
    return false;
  });
  assert.deepEqual(duplicates, []);
});

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

// Data files hold demo content (names, log lines, README text) rather than
// messages the server sends back as errors, so they are not translated.
const goDemoDataFiles = new Set([
  "demo_artifact_data.go",
  "demo_catalog.go",
  "demo_registry_metadata.go",
  "demo_security_data.go",
  "demo_state.go",
]);

function goServerMessages() {
  const goRoot = path.resolve(__dirname, "../../internal/app");
  const messages = new Map();
  for (const name of fs.readdirSync(goRoot)) {
    if (!name.endsWith(".go") || name.endsWith("_test.go")) continue;
    if (goDemoDataFiles.has(name)) continue;
    const text = fs.readFileSync(path.join(goRoot, name), "utf8");
    for (const match of text.matchAll(/"((?:[^"\\\n]|\\.)*)"/g)) {
      const literal = match[1];
      if (!/\p{Script=Han}/u.test(literal) || literal.includes("\\n")) continue;
      messages.set(literal.trim(), name);
    }
  }
  return messages;
}

function serverTranslationKeys() {
  const source = parse(path.join(sourceRoot, "app", "server-messages.ts"));
  const keys = [];
  function visit(node) {
    if (
      ts.isArrayLiteralExpression(node) &&
      node.elements.length === 2 &&
      node.elements.every((element) => ts.isStringLiteralLike(element))
    ) {
      keys.push(node.elements[0].text);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return keys;
}

test("every server message has an English translation", () => {
  const keys = serverTranslationKeys();
  const covered = (literal) => {
    const normalized = literal.replaceAll("%w", "%s");
    return keys.some(
      (key) =>
        key === normalized ||
        (key.startsWith(normalized) &&
          /^(%[sd]|[:：\s])+$/.test(key.slice(normalized.length))) ||
        key === `%s${normalized}`,
    );
  };
  const missing = [...goServerMessages()]
    .filter(([literal]) => !covered(literal))
    .map(([literal, file]) => `${literal} (${file})`);
  assert.deepEqual(missing, []);
});

test("robot permission resources and actions have English labels", () => {
  const matrix = fs.readFileSync(
    path.join(sourceRoot, "components", "robot-permission-matrix.tsx"),
    "utf8",
  );
  const keys = translationKeys();
  const labels = [
    ...matrix.matchAll(/^\s+(?:"[\w*-]+"|[\w]+):\s*"([^"]+)",$/gm),
  ]
    .map((match) => match[1])
    .filter((label) => /\p{Script=Han}/u.test(label));
  assert.ok(labels.length > 30);
  assert.deepEqual(
    labels.filter((label) => !keys.has(label)),
    [],
  );
});

// Loads a TypeScript module from src by transpiling it to CommonJS, so the
// contract uses the same translator as the console.
function loadSourceModule(relativePath, dependencies = {}) {
  const file = path.join(sourceRoot, relativePath);
  const { outputText } = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const module = { exports: {} };
  const load = (specifier) => {
    if (specifier in dependencies) return dependencies[specifier];
    throw new Error(`${relativePath} imports unexpected ${specifier}`);
  };
  new Function("exports", "require", "module", outputText)(
    module.exports,
    load,
    module,
  );
  return module.exports;
}

function interfaceTranslator() {
  const templates = loadSourceModule("app/message-templates.ts");
  const messages = loadSourceModule("app/locale-messages.ts", {
    "./message-templates": templates,
  });
  return templates.createEnglishTranslator([
    ...messages.englishMessages,
    ...messages.englishTemplates,
  ]);
}

const chineseText = /[\u3400-\u9fff]/;

// Language names are always shown in their own language.
const nativeLanguageNames = new Set(["中文"]);

// Files whose Chinese text is not shown in the English interface.
const chineseOnlyFiles = new Set([
  // Translates Harbor's English audit text into Chinese for the Chinese interface.
  "app/audit-log.ts",
  "app/locale-messages.ts",
  "app/server-messages.ts",
]);

/** True for the Chinese branch of `locale === "en-US" ? english : chinese`. */
function isChineseLocaleBranch(node) {
  for (let child = node; child.parent; child = child.parent) {
    const parent = child.parent;
    if (!ts.isConditionalExpression(parent)) continue;
    const condition = parent.condition.getText();
    if (/===\s*"en-US"/.test(condition) && child === parent.whenFalse) {
      return true;
    }
    if (/===\s*"zh-CN"/.test(condition) && child === parent.whenTrue) {
      return true;
    }
  }
  return false;
}

/** Interface text with each embedded value replaced by a sample value. */
function sampleText(node) {
  if (ts.isNoSubstitutionTemplateLiteral(node) || ts.isStringLiteral(node)) {
    return node.text;
  }
  if (ts.isJsxText(node)) return node.text.trim();
  return [
    node.head.text,
    ...node.templateSpans.map((span) => `1${span.literal.text}`),
  ].join("");
}

function literalText(node) {
  if (ts.isTemplateExpression(node)) {
    return [
      node.head.text,
      ...node.templateSpans.map((span) => span.literal.text),
    ].join("");
  }
  return node.text;
}

test("user-facing Chinese text has an English translation", () => {
  const translate = interfaceTranslator();
  const missing = [];
  for (const file of files()) {
    const relativePath = path.relative(sourceRoot, file);
    if (chineseOnlyFiles.has(relativePath)) continue;
    const source = parse(file);
    function visit(node) {
      const isText =
        ts.isStringLiteral(node) ||
        ts.isNoSubstitutionTemplateLiteral(node) ||
        ts.isTemplateExpression(node) ||
        ts.isJsxText(node);
      if (
        isText &&
        chineseText.test(literalText(node)) &&
        !nativeLanguageNames.has(sampleText(node)) &&
        !isChineseLocaleBranch(node) &&
        chineseText.test(translate(sampleText(node)))
      ) {
        missing.push(`${sampleText(node)} (${relativePath})`);
      }
      if (!ts.isTemplateExpression(node)) ts.forEachChild(node, visit);
      else node.templateSpans.forEach((span) => visit(span.expression));
    }
    visit(source);
  }
  assert.deepEqual(missing, []);
});
