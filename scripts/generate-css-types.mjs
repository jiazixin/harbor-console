import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../web/src/", import.meta.url));
const check = process.argv.includes("--check");
let failed = false;
for (const file of fs
  .readdirSync(root, { recursive: true })
  .filter((file) => file.endsWith(".module.css"))) {
  const css = fs
    .readFileSync(path.join(root, file), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/:global\([^)]*\)/g, "");
  const names = [
    ...new Set(
      [...css.matchAll(/([^{};]+)\{/g)]
        .filter((match) => !match[1].trim().startsWith("@"))
        .flatMap((match) => [...match[1].matchAll(/\.([a-zA-Z][\w]*)/g)])
        .map((match) => match[1]),
    ),
  ].sort();
  const text =
    "// Generated from the adjacent CSS Module by node scripts/generate-css-types.mjs.\n" +
    "declare const styles: {\n" +
    names.map((name) => `  readonly ${name}: string;`).join("\n") +
    "\n};\nexport default styles;\n";
  const output = path.join(root, file.replace(/\.css$/, ".d.css.ts"));
  if (check) {
    if (!fs.existsSync(output) || fs.readFileSync(output, "utf8") !== text) {
      console.error(`css_types_stale file=${file}`);
      failed = true;
    }
  } else fs.writeFileSync(output, text);
}
if (failed) process.exitCode = 1;
