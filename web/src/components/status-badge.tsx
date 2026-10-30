import { useLocale } from "../app/locale-context";
import { createClassNames } from "../lib/css/class-names";
import uiStyles1 from "./shared-ui.module.css";
import { type StatusPresentation } from "./status-badge-support";
import uiStyles0 from "./status-badge.module.css";

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

type StatusBadgeProps = {
  status: string | undefined;
  label?: string;
};

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const { t } = useLocale();
  const presentation = statusPresentations[status?.toLowerCase() ?? ""] ?? {
    label: status?.trim() ? status : "未知",
    className: "",
  };
  return (
    <span
      className={resolveClasses(
        `status-badge ${presentation.className}`.trim(),
      )}
    >
      {t(label ?? presentation.label)}
    </span>
  );
}

const resolveClasses = createClassNames({
  "status-healthy": uiStyles0.statusHealthy,
  "status-success": uiStyles0.statusSuccess,
  "status-running": uiStyles0.statusRunning,
  "status-stopped": uiStyles0.statusStopped,
  "status-failed": uiStyles0.statusFailed,
  "status-badge": uiStyles1.statusBadge,
  "harbor-banner-warning": uiStyles1.harborBannerWarning,
  "harbor-banner-success": uiStyles1.harborBannerSuccess,
  "harbor-banner-info": uiStyles1.harborBannerInfo,
  "harbor-banner-danger": uiStyles1.harborBannerDanger,
  clickable: uiStyles1.clickable,
  "overlay-open": uiStyles1.overlayOpen,
  "log-level-trace": uiStyles1.logLevelTrace,
  "log-level-debug": uiStyles1.logLevelDebug,
  "log-level-log": uiStyles1.logLevelLog,
  "log-level-info": uiStyles1.logLevelInfo,
  "log-level-warn": uiStyles1.logLevelWarn,
  "log-level-error": uiStyles1.logLevelError,
  "log-level-fatal": uiStyles1.logLevelFatal,
});
