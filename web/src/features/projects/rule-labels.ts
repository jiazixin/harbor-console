// Harbor describes retention templates and selector decorations with API
// identifiers and English display text. The console shows its own localized
// labels for the values it knows and falls back to Harbor's text otherwise.

export const fallbackRetentionTemplates = [
  { value: "latestPushedK", label: "保留最近推送的制品" },
  { value: "latestPulledN", label: "保留最近拉取的制品" },
  { value: "nDaysSinceLastPush", label: "保留最近推送天数内的制品" },
  { value: "nDaysSinceLastPull", label: "保留最近拉取天数内的制品" },
  { value: "always", label: "永久保留全部匹配制品" },
];

const retentionTemplateOptions: Partial<Record<string, string>> =
  Object.fromEntries(
    fallbackRetentionTemplates.map(({ value, label }) => [value, label]),
  );

const retentionTemplateSummaries: Partial<Record<string, string>> = {
  latestPushedK: "最近推送",
  latestPulledN: "最近拉取",
  nDaysSinceLastPush: "推送时间范围",
  nDaysSinceLastPull: "拉取时间范围",
  always: "永久保留",
};

const selectorDecorations: Partial<Record<string, string>> = {
  repoMatches: "匹配",
  repoExcludes: "排除",
  matches: "匹配",
  excludes: "排除",
};

/** Label for a retention template in the rule editor's template list. */
export function retentionTemplateOptionLabel(
  template: string,
  harborDisplayText = "",
): string {
  return retentionTemplateOptions[template] ?? (harborDisplayText || template);
}

/** Short label for a retention template in rule summaries and tables. */
export function retentionTemplateSummary(template: string | undefined): string {
  return retentionTemplateSummaries[template ?? ""] ?? template ?? "保留规则";
}

/** Label for a repository or tag selector decoration such as repoMatches. */
export function selectorDecorationLabel(decoration: string): string {
  return selectorDecorations[decoration] ?? decoration;
}
