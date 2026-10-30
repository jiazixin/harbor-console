import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../src");

/** Reads the declarations in a cascade layer, independent of component ownership. */
export function readStyleLayer(name) {
  const chunks = [];
  const pattern = new RegExp(`@layer ui-${name}\\s*\\{`, "g");
  for (const file of fs
    .readdirSync(root, { recursive: true })
    .filter((file) => file.endsWith(".css"))) {
    const source = fs.readFileSync(path.join(root, file), "utf8");
    for (const match of source.matchAll(pattern)) {
      let depth = 1;
      let end = match.index + match[0].length;
      const start = end;
      for (; end < source.length && depth > 0; end += 1) {
        if (source[end] === "{") depth += 1;
        else if (source[end] === "}") depth -= 1;
      }
      chunks.push(source.slice(start, end - 1));
    }
  }
  return chunks.join("\n").replace(/:global\(\.hc_[a-f\d]+_(\w+)\)/g, ".$1");
}
