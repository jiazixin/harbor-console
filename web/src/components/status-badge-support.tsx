export type StatusPresentation = {
  label: string;
  className: string;
};

export const severityPresentations: Partial<
  Record<string, Pick<StatusPresentation, "className" | "label">>
> = {
  critical: { label: "严重", className: "severity-critical" },
  high: { label: "高危", className: "severity-high" },
  medium: { label: "中危", className: "severity-medium" },
  low: { label: "低危", className: "badge-blue" },
  negligible: { label: "可忽略", className: "" },
  none: { label: "无风险", className: "badge-green" },
  unknown: { label: "未扫描", className: "" },
};

/** Chinese label for a Harbor severity such as "High"; unknown values pass through. */
export function severityLabel(severity: string | undefined): string {
  return (
    severityPresentations[severity?.toLowerCase() ?? "unknown"]?.label ??
    severity ??
    "未扫描"
  );
}

export function triggerLabel(
  value: string | undefined,
  translate: (source: string) => string,
): string {
  return translate(
    {
      scheduled: "定时触发",
      event_based: "事件触发",
      manual: "手动触发",
    }[value?.toLowerCase() ?? ""] ?? "未知方式",
  );
}
