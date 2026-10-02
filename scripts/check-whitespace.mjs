import { fileURLToPath } from "node:url";

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";

process.chdir(fileURLToPath(new URL("..", import.meta.url)));

const files = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { encoding: "utf8" },
)
  .split("\0")
  .filter(Boolean);

const findings = [];
const generatedPrefixes = ["web/dist/", "web/node_modules/", "node_modules/"];

for (const file of files) {
  if (generatedPrefixes.some((prefix) => file.startsWith(prefix))) continue;
  if (!existsSync(file) || !statSync(file).isFile()) continue;

  const content = readFileSync(file);
  if (content.includes(0)) continue;

  const text = content.toString("utf8");
  if (text.length === 0) continue;

  const lines = text.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    if (/[\t ]+$/.test(lines[index])) {
      findings.push(`${file}:${index + 1}: trailing whitespace`);
    }
  }
  if (text.includes("\r")) {
    findings.push(`${file}: contains CRLF or carriage-return characters`);
  }
  if (!text.endsWith("\n")) {
    findings.push(`${file}: missing final newline`);
  } else if (text.endsWith("\n\n")) {
    findings.push(`${file}: extra blank line at end of file`);
  }
}

if (findings.length > 0) {
  process.stderr.write(`${findings.join("\n")}\n`);
  process.exitCode = 1;
}
