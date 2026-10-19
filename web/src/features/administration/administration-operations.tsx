import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { controlApi } from "../../app/api-client";
import { globalAuditOperationLabel } from "../../app/audit-log";
import { downloadText } from "../../app/download-text";
import { formatDate, formatNumber, formatCount } from "../../app/formatters";
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
import { ControlDialog } from "../../components/control-dialog";
import { Pagination } from "../../components/data-table";
import { EmptyState } from "../../components/empty-state";
import { Icon, type IconName } from "../../components/icons";
import { StatCell, PanelTitle } from "../../components/page-elements";
import { StatusBadge } from "../../components/status-badge";
import {
  LogTimezoneControl,
  StructuredLog,
  type LogTimezone,
} from "../../components/structured-log";
import {
  type SelectOption,
  UnifiedSelect,
} from "../../components/unified-select";

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

type ScheduleType = "Custom" | "Daily" | "Hourly" | "None" | "Weekly";

const workerOptions = Array.from({ length: 10 }, (_, index) => {
  const value = String(index + 1);
  return { value, label: value };
});

function scheduleTypeOptions(
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

function fallbackText(value: string | undefined, fallback = "-") {
  return value?.trim() ? value : fallback;
}

function numeric(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function jobParameters(
  value: Record<string, unknown> | string | undefined,
): Record<string, unknown> {
  if (typeof value !== "string") return objectValue(value);
  try {
    return objectValue(JSON.parse(value) as unknown);
  } catch {
    return {};
  }
}

function scheduleTypeLabel(value: string | undefined): string {
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

function normalizedScheduleType(value: string | undefined): ScheduleType {
  return ["Custom", "Daily", "Hourly", "None", "Weekly"].includes(value ?? "")
    ? (value as ScheduleType)
    : value === "Schedule"
      ? "Custom"
      : "Daily";
}

function scheduleUsesCron(type: string): boolean {
  return type === "Custom" || type === "Schedule";
}

function presetCron(type: ScheduleType, hour: number): string {
  const normalizedHour = Math.min(23, Math.max(0, Math.trunc(hour)));
  if (type === "Hourly") return "0 0 * * * *";
  if (type === "Daily") return `0 0 ${String(normalizedHour)} * * *`;
  if (type === "Weekly") return `0 0 ${String(normalizedHour)} * * 0`;
  return "";
}

function scheduleValue(
  type: ScheduleType,
  current: HarborSchedule | undefined,
  cron: string,
  defaultHour: number,
): HarborSchedule {
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

function ActionButton({
  label,
  title,
  icon,
  danger = false,
  disabled = false,
  onClick,
}: {
  label: string;
  title?: string;
  icon: IconName;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  const { t } = useLocale();
  return (
    <button
      className={`icon-button${danger ? " danger-icon" : ""}`}
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

function MaintenanceCard({
  title,
  description,
  value,
  actions,
}: {
  title: string;
  description: string;
  value: HarborScheduleConfiguration;
  actions: ReactNode;
}) {
  const { locale, t } = useLocale();
  const schedule = value.schedule ?? {};
  const custom = scheduleUsesCron(schedule.type ?? "");
  return (
    <section className="maintenance-card">
      <div className="maintenance-card-head">
        <div>
          <h2>{t(title)}</h2>
          <p>{t(description)}</p>
        </div>
      </div>
      {value.load_error ? (
        <div className="notice notice-warning">
          <Icon name="alert" />
          <span>{value.load_error}</span>
        </div>
      ) : (
        <dl
          className={`maintenance-facts${custom ? "" : " maintenance-facts-compact"}`}
        >
          <div>
            <dt>{t("计划类型")}</dt>
            <dd>{t(scheduleTypeLabel(schedule.type))}</dd>
          </div>
          <div>
            <dt>{t("下次运行")}</dt>
            <dd>{formatDate(schedule.next_scheduled_time, locale)}</dd>
          </div>
          {custom ? (
            <div>
              <dt>Cron</dt>
              <dd className="mono">{fallbackText(schedule.cron)}</dd>
            </div>
          ) : null}
        </dl>
      )}
      <div className="maintenance-actions">{actions}</div>
    </section>
  );
}

function garbageCollectionParameters(
  value: HarborScheduleConfiguration,
): Record<string, unknown> {
  if (value.parameters && Object.keys(value.parameters).length)
    return value.parameters;
  return jobParameters(value.job_parameters);
}

function garbageCollectionWorkers(parameters: Record<string, unknown>) {
  const workers = numeric(parameters.workers);
  return Number.isInteger(workers) && workers >= 1 && workers <= 10
    ? workers
    : 1;
}

type ScheduleDialogKind = "gc" | "scan";

function ScheduleDialog({
  kind,
  current,
  onClose,
  onCompleted,
}: {
  kind: ScheduleDialogKind;
  current: HarborScheduleConfiguration;
  onClose: () => void;
  onCompleted: (message: string) => void;
}) {
  const { t } = useLocale();
  const schedule = current.schedule ?? {};
  const parameters = garbageCollectionParameters(current);
  const [type, setType] = useState<ScheduleType>(() =>
    normalizedScheduleType(schedule.type),
  );
  const [cron, setCron] = useState(
    schedule.cron ?? (kind === "gc" ? "0 0 2 * * *" : "0 0 3 * * *"),
  );
  const [deleteUntagged, setDeleteUntagged] = useState(
    parameters.delete_untagged === true,
  );
  const [deleteTag, setDeleteTag] = useState(parameters.delete_tag === true);
  const [workers, setWorkers] = useState(() =>
    garbageCollectionWorkers(parameters),
  );
  return (
    <ControlDialog
      title={kind === "gc" ? "垃圾清理计划" : "全量扫描计划"}
      subtitle="计划使用 Harbor 官方 Schedule 模型"
      submitLabel="保存计划"
      onClose={onClose}
      onSubmit={async () => {
        const payload: {
          schedule: HarborSchedule;
          parameters?: Record<string, unknown>;
        } = {
          schedule: scheduleValue(type, schedule, cron, kind === "gc" ? 2 : 3),
        };
        if (kind === "gc") {
          payload.parameters = {
            delete_untagged: deleteUntagged,
            delete_tag: deleteTag,
            workers,
            dry_run: false,
          };
        }
        await controlApi.mutate(
          kind === "gc" ? "gc-schedule" : "scan-all-schedule",
          {},
          current.id ? "PUT" : "POST",
          payload,
        );
        onCompleted("任务计划已更新");
      }}
    >
      <div className="form-grid">
        <label className="field">
          <span>{t("执行频率")}</span>
          <UnifiedSelect
            ariaLabel={t("执行频率")}
            value={type}
            options={scheduleTypeOptions(t)}
            onChange={setType}
          />
        </label>
        {type === "Custom" ? (
          <label className="field">
            <span>{t("Cron 表达式")}</span>
            <input
              required
              maxLength={255}
              value={cron}
              onChange={(event) => setCron(event.currentTarget.value)}
            />
          </label>
        ) : null}
        {kind === "gc" ? (
          <>
            <label className="check-row">
              <input
                type="checkbox"
                checked={deleteUntagged}
                onChange={(event) =>
                  setDeleteUntagged(event.currentTarget.checked)
                }
              />
              <span>
                <strong>{t("允许回收无 Tag 制品")}</strong>
                <small>{t("同时清理未被任何 Tag 引用的制品")}</small>
              </span>
            </label>
            <label className="check-row">
              <input
                type="checkbox"
                checked={deleteTag}
                onChange={(event) => setDeleteTag(event.currentTarget.checked)}
              />
              <span>
                <strong>{t("允许移除后端存储中的 Tag 文件")}</strong>
                <small>
                  {t("垃圾回收时一并清理 Registry 后端残留的 Tag 引用文件")}
                </small>
              </span>
            </label>
            <label className="field">
              <span>{t("并行工作数")}</span>
              <UnifiedSelect
                ariaLabel={t("并行工作数")}
                value={String(workers)}
                options={workerOptions}
                onChange={(value) => setWorkers(Number(value))}
              />
              <small className="field-help">
                {t("Harbor 支持 1 到 10 个并行工作任务。")}
              </small>
            </label>
          </>
        ) : null}
      </div>
    </ControlDialog>
  );
}

function RunGarbageCollectionDialog({
  current,
  onClose,
  onCompleted,
}: {
  current: HarborScheduleConfiguration;
  onClose: () => void;
  onCompleted: (message: string) => void;
}) {
  const { t } = useLocale();
  const parameters = garbageCollectionParameters(current);
  const [dryRun, setDryRun] = useState(true);
  const [deleteUntagged, setDeleteUntagged] = useState(
    parameters.delete_untagged === true,
  );
  const [deleteTag, setDeleteTag] = useState(parameters.delete_tag === true);
  const [workers, setWorkers] = useState(() =>
    garbageCollectionWorkers(parameters),
  );
  return (
    <ControlDialog
      title="立即执行垃圾清理"
      subtitle="清理不再被制品清单引用的存储对象"
      submitLabel="开始清理"
      destructive
      onClose={onClose}
      onSubmit={async () => {
        await controlApi.mutate("gc-schedule", {}, "POST", {
          schedule: { type: "Manual" },
          parameters: {
            dry_run: dryRun,
            delete_untagged: deleteUntagged,
            delete_tag: deleteTag,
            workers,
          },
        });
        onCompleted("垃圾清理任务已启动");
      }}
    >
      <div className="notice notice-danger">
        <Icon name="alert" />
        <span>{t("正式清理会删除不可恢复的存储对象，建议先执行演练。")}</span>
      </div>
      <div className="form-grid">
        <label className="check-row">
          <input
            type="checkbox"
            checked={dryRun}
            onChange={(event) => setDryRun(event.currentTarget.checked)}
          />
          <span>
            <strong>{t("仅演练")}</strong>
            <small>{t("计算可清理内容但不实际删除")}</small>
          </span>
        </label>
        <label className="check-row">
          <input
            type="checkbox"
            checked={deleteUntagged}
            onChange={(event) => setDeleteUntagged(event.currentTarget.checked)}
          />
          <span>
            <strong>{t("允许回收无 Tag 制品")}</strong>
            <small>{t("同时清理未被任何 Tag 引用的制品")}</small>
          </span>
        </label>
        <label className="check-row">
          <input
            type="checkbox"
            checked={deleteTag}
            onChange={(event) => setDeleteTag(event.currentTarget.checked)}
          />
          <span>
            <strong>{t("允许移除后端存储中的 Tag 文件")}</strong>
            <small>
              {t("垃圾回收时一并清理 Registry 后端残留的 Tag 引用文件")}
            </small>
          </span>
        </label>
        <label className="field">
          <span>{t("并行工作数")}</span>
          <UnifiedSelect
            ariaLabel={t("并行工作数")}
            value={String(workers)}
            options={workerOptions}
            onChange={(value) => setWorkers(Number(value))}
          />
          <small className="field-help">
            {t("Harbor 支持 1 到 10 个并行工作任务。")}
          </small>
        </label>
      </div>
    </ControlDialog>
  );
}

type LogKind = "gc" | "jobservice" | "purge";

function OperationLogDialog({
  kind,
  id,
  onClose,
  onNotice,
}: {
  kind: LogKind;
  id: number | string;
  onClose: () => void;
  onNotice: (message: string, error?: boolean) => void;
}) {
  const { locale, t } = useLocale();
  const [logContent, setLogContent] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [timezone, setTimezone] = useState<LogTimezone>("local");
  const requestVersion = useRef(0);
  const requestController = useRef<AbortController | undefined>(undefined);
  const title =
    kind === "gc"
      ? "垃圾清理日志"
      : kind === "purge"
        ? "审计清理日志"
        : "Job Service 任务日志";
  const empty =
    kind === "purge"
      ? "Harbor 没有返回审计清理日志。"
      : kind === "jobservice"
        ? "Harbor 没有返回 Job Service 任务日志。"
        : "Harbor 没有返回日志内容。";
  const filename =
    kind === "gc"
      ? `harbor-gc-${String(id).replace(/[^0-9]/g, "") || "job"}.log`
      : kind === "purge"
        ? `harbor-purge-audit-${String(id)}.log`
        : `harbor-jobservice-${String(id)}.log`;
  const logLabel =
    kind === "gc"
      ? "垃圾清理日志"
      : kind === "purge"
        ? "审计清理日志"
        : "Job Service 日志";

  const loadOperationLog = useCallback(async () => {
    requestController.current?.abort();
    const controller = new AbortController();
    requestController.current = controller;
    const currentRequestVersion = requestVersion.current + 1;
    requestVersion.current = currentRequestVersion;
    setLoading(true);
    setError("");
    try {
      const operation =
        kind === "gc"
          ? "gc-log"
          : kind === "purge"
            ? "purge-log"
            : "jobservice-job-log";
      const parameters = kind === "jobservice" ? { job: id } : { id };
      const logResponse = await controlApi.data<unknown>(
        operation,
        parameters,
        controller.signal,
      );
      if (requestVersion.current !== currentRequestVersion) return;
      setLogContent(
        typeof logResponse === "string"
          ? logResponse
          : JSON.stringify(logResponse ?? "", null, 2),
      );
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === "AbortError")
        return;
      if (requestVersion.current === currentRequestVersion)
        setError(
          loadError instanceof Error ? loadError.message : String(loadError),
        );
    } finally {
      if (requestVersion.current === currentRequestVersion) setLoading(false);
    }
  }, [id, kind]);

  useEffect(() => {
    void loadOperationLog();
    return () => requestController.current?.abort();
  }, [loadOperationLog]);

  const status = loading
    ? kind === "gc"
      ? "正在读取 Harbor 清理日志..."
      : kind === "purge"
        ? "正在读取 Harbor 审计清理日志..."
        : "正在读取 Job Service 日志..."
    : error
      ? "日志载入失败"
      : locale === "en-US"
        ? `Loaded ${formatNumber(logContent.length, locale)} characters`
        : `已载入 ${formatNumber(logContent.length, locale)} 个字符`;

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
        kind === "gc"
          ? "当前没有可下载的垃圾清理日志"
          : kind === "purge"
            ? "当前没有可下载的审计清理日志"
            : "当前没有可下载的 Job Service 任务日志",
        true,
      );
      return;
    }
    downloadText(logContent, filename);
    onNotice(
      kind === "gc"
        ? "垃圾清理日志已下载"
        : kind === "purge"
          ? "审计清理日志已下载"
          : "Job Service 任务日志已下载",
    );
  }

  return (
    <ControlDialog
      title={title}
      subtitle={
        kind === "jobservice"
          ? String(id)
          : locale === "en-US"
            ? `Task #${String(id)}`
            : `任务 #${String(id)}`
      }
      submitLabel="关闭"
      submitIcon="x"
      showCancel={false}
      dialogClass="control-dialog-large"
      onClose={onClose}
      onSubmit={() => Promise.resolve(onClose())}
    >
      <section className="scan-log-panel">
        <div className="scan-log-toolbar">
          <span>{t(status)}</span>
          <div>
            <LogTimezoneControl value={timezone} onChange={setTimezone} />
            <ActionButton
              label={`刷新${logLabel}`}
              title="刷新日志"
              icon="refresh"
              onClick={() => void loadOperationLog()}
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
        {loading ? (
          <div className="dialog-loading">
            <span className="spinner" />
            <span>{t(status)}</span>
          </div>
        ) : error ? (
          <div className="directory-state directory-state-error">
            <Icon name="alert" />
            <div>
              <strong>{t("日志载入失败")}</strong>
              <span>{error}</span>
            </div>
          </div>
        ) : (
          <StructuredLog
            value={logContent}
            timezone={timezone}
            emptyMessage={empty}
            ariaLabel={title}
          />
        )}
      </section>
    </ControlDialog>
  );
}

type MaintenanceDialogState =
  | { kind: "gc-log"; id: number }
  | { kind: "gc-run" }
  | { kind: "gc-schedule" }
  | { kind: "gc-stop"; id: number }
  | { kind: "scan-schedule" };

export function AdministrationMaintenanceSection({
  data,
  navigate,
  onReload,
  onNotice,
}: {
  data: MaintenanceData;
  navigate: (path: string) => void;
  onReload: () => void;
  onNotice: (message: string, error?: boolean) => void;
}) {
  const { locale, t } = useLocale();
  const [dialog, setDialog] = useState<MaintenanceDialogState>();
  // Harbor answers the scan-all endpoints with 412 when no default scanner exists.
  const scannerMissing = [data.scanSchedule, data.scanMetrics].some(
    (value) => value.load_status === 412,
  );

  async function runScanAll() {
    try {
      await controlApi.mutate("scan-all-schedule", {}, "POST", {
        schedule: { type: "Manual" },
      });
      onNotice("全量漏洞扫描已启动");
      onReload();
    } catch (error) {
      onNotice(error instanceof Error ? error.message : String(error), true);
    }
  }

  async function stopScanAll() {
    try {
      await controlApi.mutate("scan-all-stop", {}, "POST");
      onNotice("已请求停止全量扫描");
      onReload();
    } catch (error) {
      onNotice(error instanceof Error ? error.message : String(error), true);
    }
  }

  function complete(message: string) {
    setDialog(undefined);
    onNotice(message);
    onReload();
  }

  return (
    <>
      <div className="maintenance-grid">
        <MaintenanceCard
          title="垃圾清理"
          description="删除不再被清单引用的存储对象"
          value={data.gcSchedule}
          actions={
            <>
              <button
                className="button button-small"
                type="button"
                onClick={() => setDialog({ kind: "gc-schedule" })}
              >
                <Icon name="settings" />
                <span>{t("计划")}</span>
              </button>
              <button
                className="button button-small button-primary"
                type="button"
                onClick={() => setDialog({ kind: "gc-run" })}
              >
                <Icon name="play" />
                <span>{t("立即执行")}</span>
              </button>
            </>
          }
        />
        <MaintenanceCard
          title="全量漏洞扫描"
          description={
            locale === "en-US"
              ? `Latest progress ${formatNumber(data.scanMetrics.completed, locale)} / ${formatNumber(data.scanMetrics.total, locale)}`
              : `最近进度 ${formatNumber(data.scanMetrics.completed, locale)} / ${formatNumber(data.scanMetrics.total, locale)}`
          }
          value={{
            ...data.scanSchedule,
            load_error: scannerMissing
              ? t(
                  "尚未配置默认扫描器，无法执行全量漏洞扫描。请先在制品安全中注册扫描器。",
                )
              : (data.scanSchedule.load_error ?? data.scanMetrics.load_error),
          }}
          actions={
            scannerMissing ? (
              <button
                className="button button-small"
                type="button"
                onClick={() => navigate("security/scanners")}
              >
                <Icon name="shield" />
                <span>{t("前往扫描器")}</span>
              </button>
            ) : (
              <>
                <button
                  className="button button-small"
                  type="button"
                  onClick={() => setDialog({ kind: "scan-schedule" })}
                >
                  <Icon name="settings" />
                  <span>{t("计划")}</span>
                </button>
                <button
                  className="button button-small"
                  type="button"
                  onClick={() => void stopScanAll()}
                >
                  <Icon name="x" />
                  <span>{t("停止")}</span>
                </button>
                <button
                  className="button button-small button-primary"
                  type="button"
                  onClick={() => void runScanAll()}
                >
                  <Icon name="play" />
                  <span>{t("立即扫描")}</span>
                </button>
              </>
            )
          }
        />
        <section className="table-shell maintenance-history">
          <div className="table-toolbar">
            <PanelTitle title="垃圾清理执行历史" />
            <div className="toolbar-spacer" />
          </div>
          <div className="table-scroll">
            {!data.collection.items.length ? (
              <EmptyState
                title="暂无清理记录"
                description="执行垃圾清理后会显示在这里。"
                icon="history"
              />
            ) : (
              <table className="gc-history-table">
                <thead>
                  <tr>
                    <th>{t("任务")}</th>
                    <th>{t("方式")}</th>
                    <th>{t("状态")}</th>
                    <th>{t("清理结果")}</th>
                    <th className="table-cell-time">{t("开始时间")}</th>
                    <th className="table-cell-time">{t("最近更新")}</th>
                    <th>{t("操作")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.collection.items.map((job) => {
                    const running = ["pending", "running"].includes(
                      job.job_status?.toLowerCase() ?? "",
                    );
                    return (
                      <tr key={job.id}>
                        <td className="mono">#{job.id}</td>
                        <td>
                          {t(
                            scheduleTypeLabel(
                              job.schedule?.type ?? job.job_kind,
                            ),
                          )}
                        </td>
                        <td>
                          <StatusBadge status={job.job_status} />
                        </td>
                        <td>
                          {job.dry_run ? (
                            <span className="badge badge-blue">
                              {t("仅演练")}
                            </span>
                          ) : job.deleted ? (
                            <span className="badge badge-green">
                              {t("已清理")}
                            </span>
                          ) : (
                            <span className="badge">{t("未删除")}</span>
                          )}
                        </td>
                        <td className="table-cell-time">
                          {formatDate(job.creation_time, locale)}
                        </td>
                        <td className="table-cell-time">
                          {formatDate(job.update_time, locale)}
                        </td>
                        <td>
                          <div className="row-actions">
                            <ActionButton
                              label="查看日志"
                              icon="history"
                              onClick={() =>
                                setDialog({ kind: "gc-log", id: job.id })
                              }
                            />
                            {running ? (
                              <ActionButton
                                label="停止任务"
                                icon="x"
                                danger
                                onClick={() =>
                                  setDialog({ kind: "gc-stop", id: job.id })
                                }
                              />
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          <Pagination
            pagination={data.collection.pagination}
            onPageChange={(page) =>
              navigate(
                `administration/maintenance${page > 1 ? `?page=${String(page)}` : ""}`,
              )
            }
          />
        </section>
      </div>
      {dialog?.kind === "gc-schedule" ? (
        <ScheduleDialog
          kind="gc"
          current={data.gcSchedule}
          onClose={() => setDialog(undefined)}
          onCompleted={complete}
        />
      ) : null}
      {dialog?.kind === "scan-schedule" ? (
        <ScheduleDialog
          kind="scan"
          current={data.scanSchedule}
          onClose={() => setDialog(undefined)}
          onCompleted={complete}
        />
      ) : null}
      {dialog?.kind === "gc-run" ? (
        <RunGarbageCollectionDialog
          current={data.gcSchedule}
          onClose={() => setDialog(undefined)}
          onCompleted={complete}
        />
      ) : null}
      {dialog?.kind === "gc-log" ? (
        <OperationLogDialog
          kind="gc"
          id={dialog.id}
          onClose={() => setDialog(undefined)}
          onNotice={onNotice}
        />
      ) : null}
      {dialog?.kind === "gc-stop" ? (
        <ControlDialog
          title="停止垃圾清理任务"
          subtitle={
            locale === "en-US"
              ? `Task #${String(dialog.id)}`
              : `任务 #${String(dialog.id)}`
          }
          submitLabel="停止任务"
          destructive
          onClose={() => setDialog(undefined)}
          onSubmit={async () => {
            await controlApi.mutate("gc-job", { id: dialog.id }, "PUT");
            complete("垃圾清理任务已停止");
          }}
        >
          <div className="notice notice-danger">
            <Icon name="alert" />
            <span>{t("正在运行的垃圾清理任务将被请求停止。")}</span>
          </div>
        </ControlDialog>
      ) : null}
    </>
  );
}

type PurgeDialogState =
  | { kind: "log"; id: number }
  | { kind: "run" }
  | { kind: "schedule" }
  | { kind: "stop"; id: number };

function purgeParameters(job: AuditPurgeJob): Record<string, unknown> {
  return Object.keys(job.parameters ?? {}).length
    ? (job.parameters ?? {})
    : jobParameters(job.job_parameters);
}

function PurgeDialog({
  manual,
  current,
  auditEvents,
  onClose,
  onCompleted,
}: {
  manual: boolean;
  current: HarborScheduleConfiguration;
  auditEvents: string[];
  onClose: () => void;
  onCompleted: (message: string) => void;
}) {
  const { locale, t } = useLocale();
  const schedule = current.schedule ?? {};
  const parameters = current.parameters ?? {};
  const events = auditEvents.length
    ? auditEvents
    : [
        "create_artifact",
        "delete_artifact",
        "pull_artifact",
        "push_artifact",
        "scan_artifact",
      ];
  const configuredEvents = (
    typeof parameters.include_event_types === "string"
      ? parameters.include_event_types
      : ""
  )
    .split(",")
    .filter(Boolean);
  const [type, setType] = useState<ScheduleType>(() =>
    manual ? "Daily" : normalizedScheduleType(schedule.type),
  );
  const [cron, setCron] = useState(schedule.cron ?? "0 0 1 * * 0");
  const [days, setDays] = useState(() =>
    Math.max(
      1,
      Math.ceil(numeric(parameters.audit_retention_hour ?? 720) / 24),
    ),
  );
  const [dryRun, setDryRun] = useState(manual || parameters.dry_run === true);
  const [selected, setSelected] = useState(
    () => new Set(configuredEvents.length ? configuredEvents : events),
  );
  return (
    <ControlDialog
      title={manual ? "立即清理审计日志" : "审计日志清理计划"}
      subtitle={
        manual
          ? "手动执行 Harbor 审计日志清理任务"
          : "设置保留期限、事件范围和执行频率"
      }
      submitLabel={manual ? "开始执行" : "保存计划"}
      submitIcon={manual ? "play" : undefined}
      dialogClass="control-dialog-large"
      onClose={onClose}
      onSubmit={async () => {
        if (!Number.isInteger(days) || days < 1 || days > 3_650_000)
          throw new Error(t("审计日志保留天数必须是正整数"));
        if (!selected.size) throw new Error(t("请至少选择一种审计事件类型"));
        const payload = {
          schedule: manual
            ? { type: "Manual" }
            : scheduleValue(type, schedule, cron, 1),
          parameters: {
            audit_retention_hour: days * 24,
            dry_run: dryRun,
            include_event_types: Array.from(selected).join(","),
          },
        };
        await controlApi.mutate(
          "purge-schedule",
          {},
          manual || !current.id ? "POST" : "PUT",
          payload,
        );
        onCompleted(
          manual ? "审计日志清理任务已启动" : "审计日志清理计划已更新",
        );
      }}
    >
      <div className="form-grid two-columns">
        {!manual ? (
          <>
            <label className="field">
              <span>{t("执行频率")}</span>
              <UnifiedSelect
                ariaLabel={t("执行频率")}
                value={type}
                options={scheduleTypeOptions(t)}
                onChange={setType}
              />
            </label>
            {type === "Custom" ? (
              <label className="field">
                <span>{t("Cron 表达式")}</span>
                <input
                  required
                  maxLength={255}
                  value={cron}
                  onChange={(event) => setCron(event.currentTarget.value)}
                />
              </label>
            ) : null}
          </>
        ) : null}
        <label className="field">
          <span>{t("保留天数")}</span>
          <input
            type="number"
            min={1}
            max={3_650_000}
            step={1}
            required
            value={days}
            onChange={(event) => setDays(Number(event.currentTarget.value))}
          />
          <small className="field-help">
            {t("早于该期限的选中事件将被清理。")}
          </small>
        </label>
        <label className="check-row">
          <input
            type="checkbox"
            checked={dryRun}
            onChange={(event) => setDryRun(event.currentTarget.checked)}
          />
          <span>
            <strong>{t("仅演练")}</strong>
            <small>{t("计算匹配记录但不从数据库删除")}</small>
          </span>
        </label>
      </div>
      <fieldset className="event-selector purge-event-selector">
        <legend>{t("清理事件类型")}</legend>
        {events.map((eventName) => (
          <label className="check-row" key={eventName}>
            <input
              type="checkbox"
              checked={selected.has(eventName)}
              onChange={(event) => {
                const next = new Set(selected);
                if (event.currentTarget.checked) next.add(eventName);
                else next.delete(eventName);
                setSelected(next);
              }}
            />
            <span>
              <strong>{globalAuditOperationLabel(eventName, locale, t)}</strong>
              <small>{eventName}</small>
            </span>
          </label>
        ))}
      </fieldset>
    </ControlDialog>
  );
}

export function AdministrationPurgeSection({
  data,
  navigate,
  onReload,
  onNotice,
}: {
  data: PurgeData;
  navigate: (path: string) => void;
  onReload: () => void;
  onNotice: (message: string, error?: boolean) => void;
}) {
  const { locale, t } = useLocale();
  const [dialog, setDialog] = useState<PurgeDialogState>();
  const schedule = data.purgeSchedule.schedule ?? {};
  const parameters = data.purgeSchedule.parameters ?? {};
  const complete = (message: string) => {
    setDialog(undefined);
    onNotice(message);
    onReload();
  };
  return (
    <>
      <div className="maintenance-grid purge-admin-layout">
        <section className="maintenance-card">
          <div className="maintenance-card-head">
            <div>
              <h2>{t("审计日志清理")}</h2>
              <p>{t("按保留期限和事件类型清理 Harbor 数据库审计记录")}</p>
            </div>
          </div>
          {data.purgeSchedule.load_error ? (
            <div className="notice notice-warning">
              <Icon name="alert" />
              <span>{data.purgeSchedule.load_error}</span>
            </div>
          ) : (
            <dl className="maintenance-facts">
              <div>
                <dt>{t("执行计划")}</dt>
                <dd>{t(scheduleTypeLabel(schedule.type))}</dd>
              </div>
              <div>
                <dt>{t("保留期限")}</dt>
                <dd>
                  {parameters.audit_retention_hour
                    ? `${formatNumber(Math.ceil(numeric(parameters.audit_retention_hour) / 24), locale)} ${t("天")}`
                    : t("未配置")}
                </dd>
              </div>
              <div>
                <dt>{t("下次运行")}</dt>
                <dd>{formatDate(schedule.next_scheduled_time, locale)}</dd>
              </div>
            </dl>
          )}
          <div className="maintenance-actions">
            <button
              className="button button-small"
              type="button"
              onClick={() => setDialog({ kind: "schedule" })}
            >
              <Icon name="settings" />
              <span>{t("清理计划")}</span>
            </button>
            <button
              className="button button-small button-primary"
              type="button"
              onClick={() => setDialog({ kind: "run" })}
            >
              <Icon name="play" />
              <span>{t("立即执行")}</span>
            </button>
          </div>
        </section>
        <section className="table-shell maintenance-history">
          <div className="table-toolbar">
            <PanelTitle
              title="审计清理执行历史"
              count={formatCount(
                data.collection.pagination.total,
                locale,
                "次执行",
                "executions",
              )}
            />
          </div>
          <div className="table-scroll">
            {!data.collection.items.length ? (
              <EmptyState
                title="暂无审计清理记录"
                description="执行审计日志清理后会显示在这里。"
                icon="history"
              />
            ) : (
              <table>
                <thead>
                  <tr>
                    <th className="id-column">{t("任务")}</th>
                    <th className="table-cell-center">{t("方式")}</th>
                    <th className="table-cell-center">{t("保留期限")}</th>
                    <th className="table-cell-center">{t("模式")}</th>
                    <th className="table-cell-center">{t("状态")}</th>
                    <th className="table-cell-time">{t("开始时间")}</th>
                    <th className="table-cell-time">{t("最近更新")}</th>
                    <th className="table-cell-center">{t("操作")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.collection.items.map((job) => {
                    const values = purgeParameters(job);
                    const canStop = [
                      "running",
                      "pending",
                      "inprogress",
                      "in_progress",
                    ].includes(job.job_status?.toLowerCase() ?? "");
                    return (
                      <tr key={job.id}>
                        <td className="id-cell">#{job.id}</td>
                        <td className="table-cell-center">
                          {t(scheduleTypeLabel(job.job_kind))}
                        </td>
                        <td className="table-cell-center">
                          {formatNumber(
                            Math.ceil(
                              numeric(values.audit_retention_hour) / 24,
                            ),
                            locale,
                          )}{" "}
                          {t("天")}
                        </td>
                        <td className="table-cell-center">
                          {values.dry_run === true ? (
                            <span className="badge badge-blue">
                              {t("仅演练")}
                            </span>
                          ) : (
                            <span className="badge badge-orange">
                              {t("正式清理")}
                            </span>
                          )}
                        </td>
                        <td className="table-cell-center">
                          <StatusBadge status={job.job_status} />
                        </td>
                        <td className="table-cell-time">
                          {formatDate(job.creation_time, locale)}
                        </td>
                        <td className="table-cell-time">
                          {formatDate(job.update_time, locale)}
                        </td>
                        <td className="table-cell-center">
                          <div className="row-actions">
                            <ActionButton
                              label="查看审计清理日志"
                              icon="history"
                              onClick={() =>
                                setDialog({ kind: "log", id: job.id })
                              }
                            />
                            {canStop ? (
                              <ActionButton
                                label="停止审计清理任务"
                                icon="x"
                                danger
                                onClick={() =>
                                  setDialog({ kind: "stop", id: job.id })
                                }
                              />
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          <Pagination
            pagination={data.collection.pagination}
            onPageChange={(page) =>
              navigate(
                `administration/purge${page > 1 ? `?page=${String(page)}` : ""}`,
              )
            }
          />
        </section>
      </div>
      {dialog?.kind === "schedule" ? (
        <PurgeDialog
          manual={false}
          current={data.purgeSchedule}
          auditEvents={data.auditEvents}
          onClose={() => setDialog(undefined)}
          onCompleted={complete}
        />
      ) : null}
      {dialog?.kind === "run" ? (
        <PurgeDialog
          manual
          current={data.purgeSchedule}
          auditEvents={data.auditEvents}
          onClose={() => setDialog(undefined)}
          onCompleted={complete}
        />
      ) : null}
      {dialog?.kind === "log" ? (
        <OperationLogDialog
          kind="purge"
          id={dialog.id}
          onClose={() => setDialog(undefined)}
          onNotice={onNotice}
        />
      ) : null}
      {dialog?.kind === "stop" ? (
        <ControlDialog
          title="停止审计日志清理"
          subtitle={
            locale === "en-US"
              ? `Audit purge job #${String(dialog.id)} will be requested to stop.`
              : `正在执行的审计清理任务 #${String(dialog.id)} 将被请求停止。`
          }
          submitLabel="停止任务"
          destructive
          onClose={() => setDialog(undefined)}
          onSubmit={async () => {
            await controlApi.mutate("purge-job", { id: dialog.id }, "PUT");
            complete("已向 Harbor 提交停止请求");
          }}
        >
          <div className="notice notice-danger">
            <Icon name="alert" />
            <span>{t("停止请求将立即提交到 Harbor。")}</span>
          </div>
        </ControlDialog>
      ) : null}
    </>
  );
}

type JobDialogState =
  | { kind: "log"; job: string }
  | { kind: "stop-job"; job: string }
  | { kind: "stop-queue"; type: string };

function JobPoolTable({ pools }: { pools: JobServicePool[] }) {
  const { locale, t } = useLocale();
  if (!pools.length) {
    return (
      <EmptyState
        title="暂无工作池"
        description="当前 Harbor 未返回 Job Service 工作池。"
        icon="terminal"
      />
    );
  }
  return (
    <table>
      <thead>
        <tr>
          <th>{t("工作池")}</th>
          <th>{t("主机")}</th>
          <th>{t("进程")}</th>
          <th>{t("并发数")}</th>
          <th className="table-cell-time">{t("启动时间")}</th>
          <th className="table-cell-time">{t("最近心跳")}</th>
        </tr>
      </thead>
      <tbody>
        {pools.map((pool) => (
          <tr key={pool.worker_pool_id}>
            <td className="mono">{pool.worker_pool_id}</td>
            <td>{fallbackText(pool.host)}</td>
            <td className="mono">{String(pool.pid ?? "-")}</td>
            <td>{formatNumber(pool.concurrency, locale)}</td>
            <td className="table-cell-time">
              {formatDate(pool.start_at, locale)}
            </td>
            <td className="table-cell-time">
              {formatDate(pool.heartbeat_at, locale)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function JobWorkerTable({
  workers,
  onLog,
  onStop,
}: {
  workers: JobServiceWorker[];
  onLog: (job: string) => void;
  onStop: (job: string) => void;
}) {
  const { locale, t } = useLocale();
  if (!workers.length) {
    return (
      <EmptyState
        title="暂无工作器"
        description="当前工作池没有返回工作器。"
        icon="users"
      />
    );
  }
  return (
    <table>
      <thead>
        <tr>
          <th>{t("工作器")}</th>
          <th>{t("工作池")}</th>
          <th>{t("任务类型")}</th>
          <th>{t("任务 ID")}</th>
          <th>{t("状态")}</th>
          <th className="table-cell-time">{t("开始时间")}</th>
          <th className="table-cell-time">{t("最近签入")}</th>
          <th>{t("操作")}</th>
        </tr>
      </thead>
      <tbody>
        {workers.map((worker) => (
          <tr key={worker.id}>
            <td className="mono">{worker.id}</td>
            <td className="mono">{fallbackText(worker.pool_id)}</td>
            <td>{fallbackText(worker.job_name, t("空闲"))}</td>
            <td className="mono">{fallbackText(worker.job_id)}</td>
            <td>
              <StatusBadge
                status={worker.job_id ? (worker.check_in ?? "running") : "idle"}
              />
            </td>
            <td className="table-cell-time">
              {formatDate(worker.start_at, locale)}
            </td>
            <td className="table-cell-time">
              {formatDate(worker.checkin_at, locale)}
            </td>
            <td>
              {worker.job_id ? (
                <div className="row-actions">
                  <ActionButton
                    label="查看运行任务日志"
                    icon="history"
                    onClick={() => onLog(worker.job_id ?? "")}
                  />
                  <ActionButton
                    label="停止运行任务"
                    icon="x"
                    danger
                    onClick={() => onStop(worker.job_id ?? "")}
                  />
                </div>
              ) : (
                "-"
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function JobQueueTable({
  queues,
  onAction,
  onStop,
}: {
  queues: JobServiceQueue[];
  onAction: (type: string, action: "pause" | "resume") => void;
  onStop: (type: string) => void;
}) {
  const { locale, t } = useLocale();
  if (!queues.length) {
    return (
      <EmptyState
        title="暂无任务队列"
        description="当前 Harbor 未返回 Job Service 队列。"
        icon="history"
      />
    );
  }
  return (
    <table>
      <thead>
        <tr>
          <th>{t("任务类型")}</th>
          <th>{t("待处理")}</th>
          <th>{t("延迟")}</th>
          <th>{t("状态")}</th>
          <th>{t("操作")}</th>
        </tr>
      </thead>
      <tbody>
        {queues.map((queue) => (
          <tr key={queue.job_type}>
            <td>
              <strong>{queue.job_type}</strong>
            </td>
            <td>{formatNumber(queue.count, locale)}</td>
            <td>
              {formatNumber(queue.latency, locale)} {t("秒")}
            </td>
            <td>
              <span
                className={`badge ${queue.paused ? "badge-orange" : "badge-green"}`}
              >
                {t(queue.paused ? "已暂停" : "运行中")}
              </span>
            </td>
            <td>
              <div className="row-actions">
                <ActionButton
                  label={queue.paused ? "恢复队列" : "暂停队列"}
                  icon={queue.paused ? "play" : "settings"}
                  onClick={() =>
                    onAction(queue.job_type, queue.paused ? "resume" : "pause")
                  }
                />
                <ActionButton
                  label="停止队列中的待处理任务"
                  icon="x"
                  danger
                  disabled={numeric(queue.count) <= 0}
                  onClick={() => onStop(queue.job_type)}
                />
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function JobScheduleTable({ schedules }: { schedules: JobServiceSchedule[] }) {
  const { locale, t } = useLocale();
  if (!schedules.length) {
    return (
      <EmptyState
        title="暂无定时任务"
        description="当前 Harbor 未注册 Job Service 定时任务。"
        icon="settings"
      />
    );
  }
  return (
    <table>
      <thead>
        <tr>
          <th>{t("计划")}</th>
          <th>{t("任务类型")}</th>
          <th>{t("关联资源")}</th>
          <th>Cron</th>
          <th className="table-cell-time">{t("最近更新")}</th>
        </tr>
      </thead>
      <tbody>
        {schedules.map((schedule) => (
          <tr key={schedule.id}>
            <td className="mono">#{schedule.id}</td>
            <td>{fallbackText(schedule.vendor_type)}</td>
            <td className="mono">#{String(schedule.vendor_id ?? "-")}</td>
            <td>
              <code>{fallbackText(schedule.cron)}</code>
            </td>
            <td className="table-cell-time">
              {formatDate(schedule.update_time, locale)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function AdministrationJobServiceSection({
  data,
  navigate,
  onReload,
  onNotice,
}: {
  data: JobServiceData;
  navigate: (path: string) => void;
  onReload: () => void;
  onNotice: (message: string, error?: boolean) => void;
}) {
  const { locale, t } = useLocale();
  const [dialog, setDialog] = useState<JobDialogState>();
  const activeWorkers = data.workers.filter((worker) => worker.job_id);
  const queued = data.queues.reduce(
    (sum, queue) => sum + numeric(queue.count),
    0,
  );
  const pausedQueues = data.queues.filter((queue) => queue.paused).length;

  async function queueAction(type: string, action: "pause" | "resume") {
    try {
      await controlApi.mutate("jobservice-queue", { type }, "PUT", { action });
      onNotice(action === "pause" ? "任务队列已暂停" : "任务队列已恢复");
      onReload();
    } catch (error) {
      onNotice(error instanceof Error ? error.message : String(error), true);
    }
  }
  const complete = (message: string) => {
    setDialog(undefined);
    onNotice(message);
    onReload();
  };
  return (
    <>
      <div className="jobservice-layout">
        <section
          className="overview-stats jobservice-stats"
          aria-label={t("Job Service 统计")}
        >
          <StatCell
            label={t("工作池")}
            value={formatNumber(data.pools.length, locale)}
            foot={t("Job Service 进程池")}
            icon="terminal"
          />
          <StatCell
            label={t("工作器")}
            value={formatNumber(data.workers.length, locale)}
            foot={
              locale === "en-US"
                ? `${formatNumber(activeWorkers.length, locale)} running`
                : `${formatNumber(activeWorkers.length, locale)} 个正在执行`
            }
            icon="users"
          />
          <StatCell
            label={t("排队任务")}
            value={formatNumber(queued, locale)}
            foot={
              locale === "en-US"
                ? `${formatNumber(pausedQueues, locale)} queues paused`
                : `${formatNumber(pausedQueues, locale)} 个队列已暂停`
            }
            icon="history"
          />
          <StatCell
            label={t("定时任务")}
            value={formatNumber(
              data.schedules.pagination.total || data.schedules.items.length,
              locale,
            )}
            foot={t(
              data.scheduleStatus.paused ? "调度器已暂停" : "调度器运行中",
            )}
            icon="settings"
          />
        </section>
        <section className="table-shell">
          <div className="table-toolbar">
            <PanelTitle title="工作池" />
            <div className="toolbar-spacer" />
          </div>
          <div className="table-scroll">
            <JobPoolTable pools={data.pools} />
          </div>
        </section>
        <section className="table-shell">
          <div className="table-toolbar">
            <PanelTitle title="工作器与运行任务" />
            <div className="toolbar-spacer" />
          </div>
          <div className="table-scroll">
            <JobWorkerTable
              workers={data.workers}
              onLog={(job) => setDialog({ kind: "log", job })}
              onStop={(job) => setDialog({ kind: "stop-job", job })}
            />
          </div>
        </section>
        <section className="table-shell">
          <div className="table-toolbar">
            <PanelTitle title="任务队列" />
            <div className="toolbar-spacer" />
            <button
              className="button button-small"
              type="button"
              onClick={() => void queueAction("all", "resume")}
            >
              <Icon name="play" />
              <span>{t("恢复全部")}</span>
            </button>
            <button
              className="button button-small"
              type="button"
              onClick={() => void queueAction("all", "pause")}
            >
              <Icon name="settings" />
              <span>{t("暂停全部")}</span>
            </button>
            <button
              className="button button-small button-danger"
              type="button"
              onClick={() => setDialog({ kind: "stop-queue", type: "all" })}
            >
              <Icon name="x" />
              <span>{t("停止全部待处理")}</span>
            </button>
          </div>
          <div className="table-scroll">
            <JobQueueTable
              queues={data.queues}
              onAction={(type, action) => void queueAction(type, action)}
              onStop={(type) => setDialog({ kind: "stop-queue", type })}
            />
          </div>
        </section>
        <section className="table-shell">
          <div className="table-toolbar">
            <PanelTitle title="定时任务" />
            <div className="toolbar-spacer" />
            <span className="muted">
              {t(data.scheduleStatus.paused ? "已暂停" : "运行中")}
            </span>
          </div>
          <div className="table-scroll">
            <JobScheduleTable schedules={data.schedules.items} />
          </div>
          <Pagination
            pagination={data.schedules.pagination}
            onPageChange={(page) =>
              navigate(
                "administration/jobs" +
                  (page > 1 ? "?page=" + String(page) : ""),
              )
            }
          />
        </section>
      </div>
      {dialog?.kind === "log" ? (
        <OperationLogDialog
          kind="jobservice"
          id={dialog.job}
          onClose={() => setDialog(undefined)}
          onNotice={onNotice}
        />
      ) : null}
      {dialog?.kind === "stop-job" ? (
        <ControlDialog
          title="停止运行任务"
          subtitle={
            locale === "en-US"
              ? `Job Service job ${dialog.job} will be requested to stop.`
              : `Job Service 任务 ${dialog.job} 将被请求停止。`
          }
          submitLabel="停止任务"
          destructive
          onClose={() => setDialog(undefined)}
          onSubmit={async () => {
            await controlApi.mutate(
              "jobservice-job",
              { job: dialog.job },
              "PUT",
            );
            complete("运行任务已停止");
          }}
        >
          <div className="notice notice-danger">
            <Icon name="alert" />
            <span>{t("停止请求将立即提交到 Job Service。")}</span>
          </div>
        </ControlDialog>
      ) : null}
      {dialog?.kind === "stop-queue" ? (
        <ControlDialog
          title="停止待处理任务"
          subtitle={`${dialog.type === "all" ? t("全部队列") : dialog.type} ${t("中尚未执行的任务将被停止并从队列清除，运行中的任务不受影响。")}`}
          submitLabel="停止并清除"
          destructive
          onClose={() => setDialog(undefined)}
          onSubmit={async () => {
            await controlApi.mutate(
              "jobservice-queue",
              { type: dialog.type },
              "PUT",
              { action: "stop" },
            );
            complete("待处理任务已停止并清除");
          }}
        >
          <div className="notice notice-danger">
            <Icon name="alert" />
            <span>{t("此操作无法撤销")}</span>
          </div>
        </ControlDialog>
      ) : null}
    </>
  );
}
