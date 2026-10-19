import { useLocale } from "../app/locale-context";

type StatusPresentation = {
  label: string;
  className: string;
};

const statusPresentations: Record<string, StatusPresentation> = {
  healthy: { label: "正常", className: "status-healthy" },
  succeed: { label: "成功", className: "status-success" },
  success: { label: "成功", className: "status-success" },
  completed: { label: "已完成", className: "status-success" },
  running: { label: "运行中", className: "status-running" },
  inprogress: { label: "进行中", className: "status-running" },
  in_progress: { label: "进行中", className: "status-running" },
  pending: { label: "等待中", className: "status-running" },
  queued: { label: "排队中", className: "status-running" },
  scheduled: { label: "已计划", className: "status-running" },
  idle: { label: "空闲", className: "status-stopped" },
  "not scanned": { label: "未扫描", className: "" },
  unscanned: { label: "未扫描", className: "" },
  paused: { label: "已暂停", className: "status-stopped" },
  failed: { label: "失败", className: "status-failed" },
  error: { label: "异常", className: "status-failed" },
  unhealthy: { label: "异常", className: "status-failed" },
  stopped: { label: "已停止", className: "status-stopped" },
  canceled: { label: "已取消", className: "status-stopped" },
  cancelled: { label: "已取消", className: "status-stopped" },
  disabled: { label: "已停用", className: "status-stopped" },
  unknown: { label: "未知", className: "" },
};

export function StatusBadge({
  status,
  label,
}: {
  status: string | undefined;
  label?: string;
}) {
  const { t } = useLocale();
  const presentation = statusPresentations[status?.toLowerCase() ?? ""] ?? {
    label: status?.trim() ? status : "未知",
    className: "",
  };
  return (
    <span className={`status-badge ${presentation.className}`.trim()}>
      {t(label ?? presentation.label)}
    </span>
  );
}

const severityPresentations: Partial<
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

export function SeverityBadge({ severity }: { severity: string | undefined }) {
  const { t } = useLocale();
  const presentation = severityPresentations[
    severity?.toLowerCase() ?? "unknown"
  ] ?? {
    label: severity?.trim() ? severity : "未扫描",
    className: "",
  };
  return (
    <span className={`badge ${presentation.className}`.trim()}>
      {t(presentation.label)}
    </span>
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
