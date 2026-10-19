/*
 * Translates Chinese interface and server messages into English.
 *
 * A Chinese source may embed runtime values with Go-style format verbs: %s and
 * %w match any text, %d matches an integer. Matched text that is itself a known
 * message is translated recursively, so composed messages such as
 * "第 2 条 Tag 保留规则无效：tag_selectors 必须包含 1 到 32 个选择器" are
 * translated as a whole.
 */

/** A Chinese source message and its English translation. */
export type MessageEntry = readonly [chinese: string, english: string];

type CompiledTemplate = {
  pattern: RegExp;
  english: string;
  placeholders: ("integer" | "text")[];
};

const formatVerb = /%[sdw]/;
const maxNestingDepth = 4;

function compileTemplate([chinese, english]: MessageEntry): CompiledTemplate {
  const placeholders: CompiledTemplate["placeholders"] = [];
  const source = chinese
    .split(/(%[sdw])/)
    .map((part) => {
      if (part === "%d") {
        placeholders.push("integer");
        return "(-?\\d+)";
      }
      if (part === "%s" || part === "%w") {
        placeholders.push("text");
        return "(.+?)";
      }
      return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("");
  return { pattern: new RegExp(`^${source}$`, "s"), english, placeholders };
}

/** Length of the fixed text of a template, used to prefer specific templates. */
function fixedTextLength(template: CompiledTemplate): number {
  return template.pattern.source.replace(/\(.+?\)/g, "").length;
}

/**
 * Builds a translator from exact messages and templates. Unknown messages are
 * returned unchanged.
 */
export function createEnglishTranslator(
  entries: Iterable<MessageEntry>,
): (message: string) => string {
  const exactMessages = new Map<string, string>();
  const templates: CompiledTemplate[] = [];
  for (const entry of entries) {
    if (formatVerb.test(entry[0])) templates.push(compileTemplate(entry));
    else exactMessages.set(entry[0], entry[1]);
  }
  // Prefer the template with the most fixed text, so "第 %d 条 Tag 保留规则无效：%s"
  // wins over the generic "%s 无效：%s".
  templates.sort(
    (left, right) => fixedTextLength(right) - fixedTextLength(left),
  );

  function translate(message: string, depth: number): string {
    const exact = exactMessages.get(message);
    if (exact !== undefined) return exact;
    if (depth > maxNestingDepth) return message;
    for (const template of templates) {
      const match = template.pattern.exec(message);
      if (!match) continue;
      const values = match
        .slice(1)
        .map((value, index) =>
          template.placeholders[index] === "text"
            ? translate(value, depth + 1)
            : value,
        );
      let valueIndex = 0;
      return template.english.replace(
        /%[sd]/g,
        () => values[valueIndex++] ?? "",
      );
    }
    return message;
  }

  return (message) => translate(message, 0);
}
