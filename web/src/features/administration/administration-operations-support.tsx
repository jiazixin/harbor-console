import { useState } from "react";
import { controlApi } from "../../app/api-client";
import { downloadText } from "../../app/download-text";
import { useLocale } from "../../app/locale-context";
import type {
  AuditPurgeJob,
  ControlList,
  GarbageCollectionJob,
  HarborSchedule,
  HarborScheduleConfiguration,
  JobServicePool,
  JobServiceQueue,
  JobServiceSchedule,
  JobServiceScheduleStatus,
  JobServiceWorker,
  ScanAllMetrics,
} from "../../app/models";
import { useLoadedQuery } from "../../app/use-loaded-query";
import { ControlDialog } from "../../components/control-dialog";
import { Icon } from "../../components/icon";
import { type IconName } from "../../components/icons-support";
import { LogTimezoneControl } from "../../components/log-timezone-control";
import uiStyles0 from "../../components/shared-ui.module.css";
import { StructuredLog } from "../../components/structured-log";
import { type LogTimezone } from "../../components/structured-log-support";
import { type SelectOption } from "../../components/unified-select";
import { createClassNames } from "../../lib/css/class-names";
import { formatNumber } from "../../lib/format/formatters";
import { decodeJson, objectSchema } from "../../lib/json/decode-json";

import { administrationKeys } from "./administration-keys";

export const affectedQueries = [administrationKeys.all];

export type MaintenanceData = {
  section: "maintenance";
  collection: ControlList<GarbageCollectionJob>;
  gcSchedule: HarborScheduleConfiguration;
  scanSchedule: HarborScheduleConfiguration;
  scanMetrics: ScanAllMetrics;
};

export type PurgeData = {
  section: "purge";
  collection: ControlList<AuditPurgeJob>;
  purgeSchedule: HarborScheduleConfiguration;
  auditEvents: string[];
};

export type JobServiceData = {
  section: "jobs";
  pools: JobServicePool[];
  workers: JobServiceWorker[];
  queues: JobServiceQueue[];
  schedules: ControlList<JobServiceSchedule>;
  scheduleStatus: JobServiceScheduleStatus;
};

export type ScheduleType = "Custom" | "Daily" | "Hourly" | "None" | "Weekly";

export function scheduleTypeOptions(
  t: (value: string) => string,
): SelectOption<ScheduleType>[] {
  return [
    { value: "Hourly", label: t("每小时") },
    { value: "Daily", label: t("每天") },
    { value: "Weekly", label: t("每周") },
    { value: "Custom", label: t("自定义 Cron") },
    { value: "None", label: t("关闭计划") },
  ];
}

export function fallbackText(value: string | undefined, fallback = "-") {
  return value?.trim() ? value : fallback;
}

export function numeric(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function jobParameters(
  value: Record<string, unknown> | string | undefined,
): Record<string, unknown> {
  return decodeJson(value ?? {}, objectSchema);
}

export function scheduleTypeLabel(value: string | undefined): string {
  return (
    {
      Hourly: "每小时",
      Daily: "每天",
      Weekly: "每周",
      Custom: "自定义",
      Schedule: "定时",
      Manual: "手动",
      None: "已关闭",
    }[value ?? ""] ??
    value ??
    "未配置"
  );
}

export function normalizedScheduleType(
  value: string | undefined,
): ScheduleType {
  return (() => {
    if (["Custom", "Daily", "Hourly", "None", "Weekly"].includes(value ?? "")) {
      return value as ScheduleType;
    }
    if (value === "Schedule") {
      return "Custom";
    }
    return "Daily";
  })();
}

function presetCron(type: ScheduleType, hour: number): string {
  const normalizedHour = Math.min(23, Math.max(0, Math.trunc(hour)));
  if (type === "Hourly") return "0 0 * * * *";
  if (type === "Daily") return `0 0 ${String(normalizedHour)} * * *`;
  if (type === "Weekly") return `0 0 ${String(normalizedHour)} * * 0`;
  return "";
}

export function scheduleValue({
  type,
  current,
  cron,
  defaultHour,
}: {
  type: ScheduleType;
  current: HarborSchedule | undefined;
  cron: string;
  defaultHour: number;
}): HarborSchedule {
  if (type === "Custom") return { type, cron: cron.trim() };
  if (type === "Hourly" || type === "Daily" || type === "Weekly") {
    return {
      type,
      cron:
        current?.type === type && current.cron?.trim()
          ? current.cron
          : presetCron(type, defaultHour),
    };
  }
  return { type };
}

type ActionButtonProps = {
  label: string;
  title?: string;
  icon: IconName;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
};

export function ActionButton({
  label,
  title,
  icon,
  danger = false,
  disabled = false,
  onClick,
}: ActionButtonProps) {
  const { t } = useLocale();
  return (
    <button
      className={resolveClasses(`icon-button${danger ? " danger-icon" : ""}`)}
      type="button"
      disabled={disabled}
      title={t(title ?? label)}
      aria-label={t(label)}
      onClick={onClick}
    >
      <Icon name={icon} />
    </button>
  );
}

type LogKind = "gc" | "jobservice" | "purge";

type OperationLogDialogProps = {
  kind: LogKind;
  id: number | string;
  onClose: () => void;
  onNotice: (message: string, error?: boolean) => void;
};

export function OperationLogDialog({
  kind,
  id,
  onClose,
  onNotice,
}: OperationLogDialogProps) {
  const { locale, t } = useLocale();
  const [timezone, setTimezone] = useState<LogTimezone>("local");
  const logQuery = useOperationLogData({ kind, id });
  const logContent = logQuery.data ?? "";
  const error = logQuery.error;
  const loading = logQuery.loading;
  const title = (() => {
    if (kind === "gc") {
      return "垃圾清理日志";
    }
    if (kind === "purge") {
      return "审计清理日志";
    }
    return "Job Service 任务日志";
  })();
  const empty = (() => {
    if (kind === "purge") {
      return "Harbor 没有返回审计清理日志。";
    }
    if (kind === "jobservice") {
      return "Harbor 没有返回 Job Service 任务日志。";
    }
    return "Harbor 没有返回日志内容。";
  })();
  const filename = (() => {
    if (kind === "gc") {
      return `harbor-gc-${String(id).replace(/[^0-9]/g, "") || "job"}.log`;
    }
    if (kind === "purge") {
      return `harbor-purge-audit-${String(id)}.log`;
    }
    return `harbor-jobservice-${String(id)}.log`;
  })();
  const logLabel = (() => {
    if (kind === "gc") {
      return "垃圾清理日志";
    }
    if (kind === "purge") {
      return "审计清理日志";
    }
    return "Job Service 日志";
  })();

  const status = (() => {
    if (loading) {
      if (kind === "gc") {
        return "正在读取 Harbor 清理日志...";
      }
      if (kind === "purge") {
        return "正在读取 Harbor 审计清理日志...";
      }
      return "正在读取 Job Service 日志...";
    }
    if (error) {
      return "日志载入失败";
    }
    if (locale === "en-US") {
      return `Loaded ${formatNumber(logContent.length, locale)} characters`;
    }
    return `已载入 ${formatNumber(logContent.length, locale)} 个字符`;
  })();

  async function copy() {
    try {
      await navigator.clipboard.writeText(logContent);
      onNotice("已复制到剪贴板");
    } catch {
      onNotice("浏览器未允许复制，请手动选择内容。", true);
    }
  }

  function download() {
    if (!logContent) {
      onNotice(
        (() => {
          if (kind === "gc") {
            return "当前没有可下载的垃圾清理日志";
          }
          if (kind === "purge") {
            return "当前没有可下载的审计清理日志";
          }
          return "当前没有可下载的 Job Service 任务日志";
        })(),
        true,
      );
      return;
    }
    downloadText(logContent, filename);
    onNotice(
      (() => {
        if (kind === "gc") {
          return "垃圾清理日志已下载";
        }
        if (kind === "purge") {
          return "审计清理日志已下载";
        }
        return "Job Service 任务日志已下载";
      })(),
    );
  }

  return (
    <ControlDialog
      title={title}
      subtitle={(() => {
        if (kind === "jobservice") {
          return String(id);
        }
        if (locale === "en-US") {
          return `Task #${String(id)}`;
        }
        return `任务 #${String(id)}`;
      })()}
      submitLabel="关闭"
      submitIcon="x"
      showCancel={false}
      dialogClass={resolveClasses("control-dialog-large")}
      onClose={onClose}
      onSubmit={onClose}
    >
      <section className={resolveClasses("scan-log-panel")}>
        <div className={resolveClasses("scan-log-toolbar")}>
          <span>{t(status)}</span>
          <div>
            <LogTimezoneControl value={timezone} onChange={setTimezone} />
            <ActionButton
              label={`刷新${logLabel}`}
              title="刷新日志"
              icon="refresh"
              onClick={logQuery.reload}
            />
            <ActionButton
              label={`复制${logLabel}`}
              title="复制日志"
              icon="copy"
              onClick={() => void copy()}
            />
            <ActionButton
              label={`下载${logLabel}`}
              title="下载日志"
              icon="download"
              onClick={download}
            />
          </div>
        </div>
        {(() => {
          if (loading) {
            return (
              <div className={resolveClasses("dialog-loading")}>
                <span className={resolveClasses("spinner")} />
                <span>{t(status)}</span>
              </div>
            );
          }
          if (error) {
            return (
              <div
                className={resolveClasses(
                  "directory-state directory-state-error",
                )}
              >
                <Icon name="alert" />
                <div>
                  <strong>{t("日志载入失败")}</strong>
                  <span>{error}</span>
                </div>
              </div>
            );
          }
          return (
            <StructuredLog
              value={logContent}
              timezone={timezone}
              emptyMessage={empty}
              ariaLabel={title}
            />
          );
        })()}
      </section>
    </ControlDialog>
  );
}

const resolveClasses = createClassNames({
  "control-dialog": uiStyles0.controlDialog,
  icon: uiStyles0.icon,
  "log-timezone-control": uiStyles0.logTimezoneControl,
  "unified-select": uiStyles0.unifiedSelect,
  "icon-button": uiStyles0.iconButton,
  "danger-icon": uiStyles0.dangerIcon,
  button: uiStyles0.button,
  "control-dialog-large": uiStyles0.controlDialogLarge,
  "scan-log-panel": uiStyles0.scanLogPanel,
  "scan-log-toolbar": uiStyles0.scanLogToolbar,
  "dialog-loading": uiStyles0.dialogLoading,
  spinner: uiStyles0.spinner,
  "directory-state": uiStyles0.directoryState,
  "directory-state-error": uiStyles0.directoryStateError,
  "harbor-banner-warning": uiStyles0.harborBannerWarning,
  "harbor-banner-success": uiStyles0.harborBannerSuccess,
  "harbor-banner-info": uiStyles0.harborBannerInfo,
  "harbor-banner-danger": uiStyles0.harborBannerDanger,
  clickable: uiStyles0.clickable,
  "overlay-open": uiStyles0.overlayOpen,
  "log-level-trace": uiStyles0.logLevelTrace,
  "log-level-debug": uiStyles0.logLevelDebug,
  "log-level-log": uiStyles0.logLevelLog,
  "log-level-info": uiStyles0.logLevelInfo,
  "log-level-warn": uiStyles0.logLevelWarn,
  "log-level-error": uiStyles0.logLevelError,
  "log-level-fatal": uiStyles0.logLevelFatal,
});

function useOperationLogData({
  kind,
  id,
}: {
  kind: LogKind;
  id: string | number;
}) {
  return useLoadedQuery(administrationKeys.operationLog(kind, id), (signal) => {
    const operation = (() => {
      if (kind === "gc") {
        return "gc-log";
      }
      if (kind === "purge") {
        return "purge-log";
      }
      return "jobservice-job-log";
    })();
    const parameters = kind === "jobservice" ? { job: id } : { id };
    return controlApi
      .data<unknown>(operation, parameters, signal)
      .then((logResponse) =>
        typeof logResponse === "string"
          ? logResponse
          : JSON.stringify(logResponse ?? "", null, 2),
      );
  });
}
