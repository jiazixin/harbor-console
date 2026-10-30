import { type ReactNode, useState } from "react";
import { useLocale } from "../../app/locale-context";
import type {
  HarborSchedule,
  HarborScheduleConfiguration,
} from "../../app/models";
import { displayTimeZone } from "../../app/preferences";
import { ControlDialog } from "../../components/control-dialog";
import { EmptyState } from "../../components/empty-state";
import { FormInput } from "../../components/form-input";
import { Icon } from "../../components/icon";
import { Pagination } from "../../components/pagination";
import { PanelTitle } from "../../components/panel-title";
import uiStyles0 from "../../components/shared-ui.module.css";
import { StatusBadge } from "../../components/status-badge";
import { UnifiedSelect } from "../../components/unified-select";
import { createClassNames } from "../../lib/css/class-names";
import { formatDate, formatNumber } from "../../lib/format/formatters";

import { errorText } from "../../app/errors";
import { useControlMutation } from "../../app/use-control-mutation";
import {
  type MaintenanceData,
  type ScheduleType,
  ActionButton,
  affectedQueries,
  fallbackText,
  jobParameters,
  normalizedScheduleType,
  numeric,
  OperationLogDialog,
  scheduleTypeLabel,
  scheduleTypeOptions,
  scheduleValue,
} from "./administration-operations-support";
import styles from "./administration.module.css";

const workerOptions = Array.from({ length: 10 }, (_, index) => {
  const value = String(index + 1);
  return { value, label: value };
});

function scheduleUsesCron(type: string): boolean {
  return type === "Custom" || type === "Schedule";
}

type MaintenanceCardProps = {
  title: string;
  description: string;
  value: HarborScheduleConfiguration;
  actions: ReactNode;
};

function MaintenanceCard({
  title,
  description,
  value,
  actions,
}: MaintenanceCardProps) {
  const { locale, t } = useLocale();
  const schedule = value.schedule ?? {};
  const custom = scheduleUsesCron(schedule.type ?? "");
  return (
    <section className={resolveClasses(styles.maintenanceCard)}>
      <div className={resolveClasses(styles.maintenanceCardHead)}>
        <div>
          <h2>{t(title)}</h2>
          <p>{t(description)}</p>
        </div>
      </div>
      {value.load_error ? (
        <div className={resolveClasses("notice notice-warning")}>
          <Icon name="alert" />
          <span>{value.load_error}</span>
        </div>
      ) : (
        <dl
          className={resolveClasses(
            `${styles.maintenanceFacts}${custom ? "" : ` ${styles.maintenanceFactsCompact}`}`,
          )}
        >
          <div>
            <dt>{t("计划类型")}</dt>
            <dd>{t(scheduleTypeLabel(schedule.type))}</dd>
          </div>
          <div>
            <dt>{t("下次运行")}</dt>
            <dd>
              {formatDate(schedule.next_scheduled_time, {
                locale: locale,
                timeZone: displayTimeZone(),
              })}
            </dd>
          </div>
          {custom ? (
            <div>
              <dt>Cron</dt>
              <dd className={resolveClasses("mono")}>
                {fallbackText(schedule.cron)}
              </dd>
            </div>
          ) : null}
        </dl>
      )}
      <div className={resolveClasses(styles.maintenanceActions)}>{actions}</div>
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

type ScheduleDialogProps = {
  kind: ScheduleDialogKind;
  current: HarborScheduleConfiguration;
  onClose: () => void;
  onCompleted: (message: string) => void;
};

function ScheduleDialog({
  kind,
  current,
  onClose,
  onCompleted,
}: ScheduleDialogProps) {
  const mutate = useControlMutation(affectedQueries);
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
          schedule: scheduleValue({
            type: type,
            current: schedule,
            cron: cron,
            defaultHour: kind === "gc" ? 2 : 3,
          }),
        };
        if (kind === "gc") {
          payload.parameters = {
            delete_untagged: deleteUntagged,
            delete_tag: deleteTag,
            workers,
            dry_run: false,
          };
        }
        await mutate({
          operation: kind === "gc" ? "gc-schedule" : "scan-all-schedule",
          parameters: {},
          method: current.id ? "PUT" : "POST",
          payload: payload,
        });
        onCompleted("任务计划已更新");
      }}
    >
      <div className={resolveClasses("form-grid")}>
        <label className={resolveClasses("field")}>
          <span>{t("执行频率")}</span>
          <UnifiedSelect
            ariaLabel={t("执行频率")}
            value={type}
            options={scheduleTypeOptions(t)}
            onChange={setType}
          />
        </label>
        {type === "Custom" ? (
          <label className={resolveClasses("field")}>
            <span>{t("Cron 表达式")}</span>
            <FormInput
              required
              maxLength={255}
              value={cron}
              onChange={(event) => {
                setCron(event.currentTarget.value);
              }}
            />
          </label>
        ) : null}
        {kind === "gc" ? (
          <>
            <label className={resolveClasses("check-row")}>
              <FormInput
                type="checkbox"
                checked={deleteUntagged}
                onChange={(event) => {
                  setDeleteUntagged(event.currentTarget.checked);
                }}
              />
              <span>
                <strong>{t("允许回收无 Tag 制品")}</strong>
                <small>{t("同时清理未被任何 Tag 引用的制品")}</small>
              </span>
            </label>
            <label className={resolveClasses("check-row")}>
              <FormInput
                type="checkbox"
                checked={deleteTag}
                onChange={(event) => {
                  setDeleteTag(event.currentTarget.checked);
                }}
              />
              <span>
                <strong>{t("允许移除后端存储中的 Tag 文件")}</strong>
                <small>
                  {t("垃圾回收时一并清理 Registry 后端残留的 Tag 引用文件")}
                </small>
              </span>
            </label>
            <label className={resolveClasses("field")}>
              <span>{t("并行工作数")}</span>
              <UnifiedSelect
                ariaLabel={t("并行工作数")}
                value={String(workers)}
                options={workerOptions}
                onChange={(value) => {
                  setWorkers(Number(value));
                }}
              />
              <small className={resolveClasses("field-help")}>
                {t("Harbor 支持 1 到 10 个并行工作任务。")}
              </small>
            </label>
          </>
        ) : null}
      </div>
    </ControlDialog>
  );
}

type RunGarbageCollectionDialogProps = {
  current: HarborScheduleConfiguration;
  onClose: () => void;
  onCompleted: (message: string) => void;
};

function RunGarbageCollectionDialog({
  current,
  onClose,
  onCompleted,
}: RunGarbageCollectionDialogProps) {
  const mutate = useControlMutation(affectedQueries);
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
        await mutate({
          operation: "gc-schedule",
          parameters: {},
          method: "POST",
          payload: {
            schedule: { type: "Manual" },
            parameters: {
              dry_run: dryRun,
              delete_untagged: deleteUntagged,
              delete_tag: deleteTag,
              workers,
            },
          },
        });
        onCompleted("垃圾清理任务已启动");
      }}
    >
      <div className={resolveClasses("notice notice-danger")}>
        <Icon name="alert" />
        <span>{t("正式清理会删除不可恢复的存储对象，建议先执行演练。")}</span>
      </div>
      <div className={resolveClasses("form-grid")}>
        <label className={resolveClasses("check-row")}>
          <FormInput
            type="checkbox"
            checked={dryRun}
            onChange={(event) => {
              setDryRun(event.currentTarget.checked);
            }}
          />
          <span>
            <strong>{t("仅演练")}</strong>
            <small>{t("计算可清理内容但不实际删除")}</small>
          </span>
        </label>
        <label className={resolveClasses("check-row")}>
          <FormInput
            type="checkbox"
            checked={deleteUntagged}
            onChange={(event) => {
              setDeleteUntagged(event.currentTarget.checked);
            }}
          />
          <span>
            <strong>{t("允许回收无 Tag 制品")}</strong>
            <small>{t("同时清理未被任何 Tag 引用的制品")}</small>
          </span>
        </label>
        <label className={resolveClasses("check-row")}>
          <FormInput
            type="checkbox"
            checked={deleteTag}
            onChange={(event) => {
              setDeleteTag(event.currentTarget.checked);
            }}
          />
          <span>
            <strong>{t("允许移除后端存储中的 Tag 文件")}</strong>
            <small>
              {t("垃圾回收时一并清理 Registry 后端残留的 Tag 引用文件")}
            </small>
          </span>
        </label>
        <label className={resolveClasses("field")}>
          <span>{t("并行工作数")}</span>
          <UnifiedSelect
            ariaLabel={t("并行工作数")}
            value={String(workers)}
            options={workerOptions}
            onChange={(value) => {
              setWorkers(Number(value));
            }}
          />
          <small className={resolveClasses("field-help")}>
            {t("Harbor 支持 1 到 10 个并行工作任务。")}
          </small>
        </label>
      </div>
    </ControlDialog>
  );
}

type MaintenanceDialogState =
  | { kind: "gc-log"; id: number }
  | { kind: "gc-run" }
  | { kind: "gc-schedule" }
  | { kind: "gc-stop"; id: number }
  | { kind: "scan-schedule" };

type AdministrationMaintenanceSectionProps = {
  data: MaintenanceData;
  navigate: (path: string) => void;
  onReload: () => void;
  onNotice: (message: string, error?: boolean) => void;
};

export function AdministrationMaintenanceSection({
  data,
  navigate,
  onReload,
  onNotice,
}: AdministrationMaintenanceSectionProps) {
  const mutate = useControlMutation(affectedQueries);
  const { locale, t } = useLocale();
  const [dialog, setDialog] = useState<MaintenanceDialogState>();
  // Harbor answers the scan-all endpoints with 412 when no default scanner exists.
  const scannerMissing = [data.scanSchedule, data.scanMetrics].some(
    (value) => value.load_status === 412,
  );

  async function runScanAll() {
    try {
      await mutate({
        operation: "scan-all-schedule",
        parameters: {},
        method: "POST",
        payload: {
          schedule: { type: "Manual" },
        },
      });
      onNotice("全量漏洞扫描已启动");
      onReload();
    } catch (error) {
      onNotice(errorText(error), true);
    }
  }

  async function stopScanAll() {
    try {
      await mutate({
        operation: "scan-all-stop",
        parameters: {},
        method: "POST",
      });
      onNotice("已请求停止全量扫描");
      onReload();
    } catch (error) {
      onNotice(errorText(error), true);
    }
  }

  function complete(message: string) {
    setDialog(undefined);
    onNotice(message);
    onReload();
  }

  return (
    <>
      <div className={resolveClasses(styles.maintenanceGrid)}>
        <MaintenanceCard
          title="垃圾清理"
          description="删除不再被清单引用的存储对象"
          value={data.gcSchedule}
          actions={
            <>
              <button
                className={resolveClasses("button button-small")}
                type="button"
                onClick={() => {
                  setDialog({ kind: "gc-schedule" });
                }}
              >
                <Icon name="settings" />
                <span>{t("计划")}</span>
              </button>
              <button
                className={resolveClasses("button button-small button-primary")}
                type="button"
                onClick={() => {
                  setDialog({ kind: "gc-run" });
                }}
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
                className={resolveClasses("button button-small")}
                type="button"
                onClick={() => {
                  navigate("security/scanners");
                }}
              >
                <Icon name="shield" />
                <span>{t("前往扫描器")}</span>
              </button>
            ) : (
              <>
                <button
                  className={resolveClasses("button button-small")}
                  type="button"
                  onClick={() => {
                    setDialog({ kind: "scan-schedule" });
                  }}
                >
                  <Icon name="settings" />
                  <span>{t("计划")}</span>
                </button>
                <button
                  className={resolveClasses("button button-small")}
                  type="button"
                  onClick={() => void stopScanAll()}
                >
                  <Icon name="x" />
                  <span>{t("停止")}</span>
                </button>
                <button
                  className={resolveClasses(
                    "button button-small button-primary",
                  )}
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
        <section
          className={resolveClasses(`table-shell ${styles.maintenanceHistory}`)}
        >
          <div className={resolveClasses("table-toolbar")}>
            <PanelTitle title="垃圾清理执行历史" />
            <div className={resolveClasses("toolbar-spacer")} />
          </div>
          <div className={resolveClasses("table-scroll")}>
            {!data.collection.items.length ? (
              <EmptyState
                title="暂无清理记录"
                description="执行垃圾清理后会显示在这里。"
                icon="history"
              />
            ) : (
              <table className={resolveClasses("gc-history-table")}>
                <thead>
                  <tr>
                    <th>{t("任务")}</th>
                    <th>{t("方式")}</th>
                    <th>{t("状态")}</th>
                    <th>{t("清理结果")}</th>
                    <th className={resolveClasses("table-cell-time")}>
                      {t("开始时间")}
                    </th>
                    <th className={resolveClasses("table-cell-time")}>
                      {t("最近更新")}
                    </th>
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
                        <td className={resolveClasses("mono")}>#{job.id}</td>
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
                          {(() => {
                            if (job.dry_run) {
                              return (
                                <span
                                  className={resolveClasses("badge badge-blue")}
                                >
                                  {t("仅演练")}
                                </span>
                              );
                            }
                            if (job.deleted) {
                              return (
                                <span
                                  className={resolveClasses(
                                    "badge badge-green",
                                  )}
                                >
                                  {t("已清理")}
                                </span>
                              );
                            }
                            return (
                              <span className={resolveClasses("badge")}>
                                {t("未删除")}
                              </span>
                            );
                          })()}
                        </td>
                        <td className={resolveClasses("table-cell-time")}>
                          {formatDate(job.creation_time, {
                            locale: locale,
                            timeZone: displayTimeZone(),
                          })}
                        </td>
                        <td className={resolveClasses("table-cell-time")}>
                          {formatDate(job.update_time, {
                            locale: locale,
                            timeZone: displayTimeZone(),
                          })}
                        </td>
                        <td>
                          <div className={resolveClasses("row-actions")}>
                            <ActionButton
                              label="查看日志"
                              icon="history"
                              onClick={() => {
                                setDialog({ kind: "gc-log", id: job.id });
                              }}
                            />
                            {running ? (
                              <ActionButton
                                label="停止任务"
                                icon="x"
                                danger
                                onClick={() => {
                                  setDialog({ kind: "gc-stop", id: job.id });
                                }}
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
            onPageChange={(page) => {
              navigate(
                `administration/maintenance${page > 1 ? `?page=${String(page)}` : ""}`,
              );
            }}
          />
        </section>
      </div>
      {dialog?.kind === "gc-schedule" ? (
        <ScheduleDialog
          kind="gc"
          current={data.gcSchedule}
          onClose={() => {
            setDialog(undefined);
          }}
          onCompleted={complete}
        />
      ) : null}
      {dialog?.kind === "scan-schedule" ? (
        <ScheduleDialog
          kind="scan"
          current={data.scanSchedule}
          onClose={() => {
            setDialog(undefined);
          }}
          onCompleted={complete}
        />
      ) : null}
      {dialog?.kind === "gc-run" ? (
        <RunGarbageCollectionDialog
          current={data.gcSchedule}
          onClose={() => {
            setDialog(undefined);
          }}
          onCompleted={complete}
        />
      ) : null}
      {dialog?.kind === "gc-log" ? (
        <OperationLogDialog
          kind="gc"
          id={dialog.id}
          onClose={() => {
            setDialog(undefined);
          }}
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
          onClose={() => {
            setDialog(undefined);
          }}
          onSubmit={async () => {
            await mutate({
              operation: "gc-job",
              parameters: { id: dialog.id },
              method: "PUT",
            });
            complete("垃圾清理任务已停止");
          }}
        >
          <div className={resolveClasses("notice notice-danger")}>
            <Icon name="alert" />
            <span>{t("正在运行的垃圾清理任务将被请求停止。")}</span>
          </div>
        </ControlDialog>
      ) : null}
    </>
  );
}

const resolveClasses = createClassNames({
  "control-dialog": uiStyles0.controlDialog,
  "empty-state": uiStyles0.emptyState,
  icon: uiStyles0.icon,
  "panel-title": uiStyles0.panelTitle,
  "status-badge": uiStyles0.statusBadge,
  "unified-select": uiStyles0.unifiedSelect,
  notice: uiStyles0.notice,
  "notice-warning": uiStyles0.noticeWarning,
  mono: uiStyles0.mono,
  "form-grid": uiStyles0.formGrid,
  field: uiStyles0.field,
  "check-row": uiStyles0.checkRow,
  "field-help": uiStyles0.fieldHelp,
  "notice-danger": uiStyles0.noticeDanger,
  button: uiStyles0.button,
  "button-small": uiStyles0.buttonSmall,
  "button-primary": uiStyles0.buttonPrimary,
  "table-shell": uiStyles0.tableShell,
  "table-toolbar": uiStyles0.tableToolbar,
  "toolbar-spacer": uiStyles0.toolbarSpacer,
  "table-scroll": uiStyles0.tableScroll,
  "table-cell-time": uiStyles0.tableCellTime,
  badge: uiStyles0.badge,
  "badge-blue": uiStyles0.badgeBlue,
  "badge-green": uiStyles0.badgeGreen,
  "row-actions": uiStyles0.rowActions,
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
