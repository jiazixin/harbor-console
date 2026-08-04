import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const findings = [];
const workflowDirectory = ".github/workflows";
const goModFile = "go.mod";
const actionReference =
  /^\s*uses:\s*[^@\s]+@([0-9a-f]{40})\s+#\s+v\d+\.\d+\.\d+\s*$/;
const imageReference = /^FROM\s+\S+@sha256:[0-9a-f]{64}(?:\s+AS\s+\S+)?\s*$/i;
const goDirective = /^go\s+(\d+\.\d+\.\d+)\s*$/m;

let requiredGoVersion;
if (!existsSync(goModFile)) {
  findings.push(`${goModFile}: missing Go module definition`);
} else {
  const match = readFileSync(goModFile, "utf8").match(goDirective);
  if (!match) {
    findings.push(`${goModFile}: go directive must pin a full patch version`);
  } else {
    requiredGoVersion = match[1];
  }
}

if (!existsSync(workflowDirectory)) {
  findings.push(`${workflowDirectory}: missing workflow directory`);
} else {
  const workflowFiles = readdirSync(workflowDirectory)
    .filter((file) => /\.ya?ml$/i.test(file))
    .map((file) => join(workflowDirectory, file));

  for (const file of workflowFiles) {
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, index) => {
      if (line.includes("uses:") && !actionReference.test(line)) {
        findings.push(
          `${file}:${index + 1}: action must use a full SHA and version comment`,
        );
      }
    });
  }
}

const dockerfile = "Dockerfile";
if (!existsSync(dockerfile)) {
  findings.push(`${dockerfile}: missing Dockerfile`);
} else {
  const lines = readFileSync(dockerfile, "utf8").split("\n");
  lines.forEach((line, index) => {
    if (/^FROM\s+/i.test(line) && !imageReference.test(line)) {
      findings.push(
        `${dockerfile}:${index + 1}: base image must use an immutable sha256 digest`,
      );
    }
  });

  const builder = lines.find((line) =>
    /^FROM\s+docker\.io\/library\/golang:/i.test(line),
  );
  if (!builder) {
    findings.push(`${dockerfile}: missing official Go builder image`);
  } else if (
    requiredGoVersion &&
    !builder.startsWith(`FROM docker.io/library/golang:${requiredGoVersion}-`)
  ) {
    findings.push(
      `${dockerfile}: Go builder tag must match go.mod version ${requiredGoVersion}`,
    );
  }
}

const dependabotFile = ".github/dependabot.yml";
if (!existsSync(dependabotFile)) {
  findings.push(
    `${dependabotFile}: missing automated dependency update configuration`,
  );
} else {
  const contents = readFileSync(dependabotFile, "utf8");
  for (const ecosystem of ["github-actions", "docker", "gomod", "npm"]) {
    if (!contents.includes(`package-ecosystem: ${ecosystem}`)) {
      findings.push(
        `${dependabotFile}: missing ${ecosystem} update configuration`,
      );
    }
  }
}

if (findings.length > 0) {
  process.stderr.write(`${findings.join("\n")}\n`);
  process.exitCode = 1;
}
