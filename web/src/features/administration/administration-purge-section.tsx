import { useState } from "react";
import { globalAuditOperationLabel } from "../../app/audit-log";
import { UserInputError } from "../../app/errors";
import { useLocale } from "../../app/locale-context";
import type {
  AuditPurgeJob,
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
import {
  formatCount,
  formatDate,
  formatNumber,
} from "../../lib/format/formatters";

import { useControlMutation } from "../../app/use-control-mutation";
import {
  ActionButton,
  affectedQueries,
  jobParameters,
  normalizedScheduleType,
  numeric,
  OperationLogDialog,
  type PurgeData,
  type ScheduleType,
  scheduleTypeLabel,
  scheduleTypeOptions,
  scheduleValue,
} from "./administration-operations-support";
import styles from "./administration.module.css";

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

type PurgeDialogProps = {
  manual: boolean;
  current: HarborScheduleConfiguration;
  auditEvents: string[];
  onClose: () => void;
  onCompleted: (message: string) => void;
};

function PurgeDialog({
  manual,
  current,
  auditEvents,
  onClose,
  onCompleted,
}: PurgeDialogProps) {
  const mutate = useControlMutation(affectedQueries);
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
      dialogClass={resolveClasses("control-dialog-large")}
      onClose={onClose}
      onSubmit={async () => {
        if (!Number.isInteger(days) || days < 1 || days > 3_650_000)
          throw new UserInputError(t("审计日志保留天数必须是正整数"));
        if (!selected.size)
          throw new UserInputError(t("请至少选择一种审计事件类型"));
        const payload = {
          schedule: manual
            ? { type: "Manual" }
            : scheduleValue({
                type: type,
                current: schedule,
                cron: cron,
                defaultHour: 1,
              }),
          parameters: {
            audit_retention_hour: days * 24,
            dry_run: dryRun,
            include_event_types: Array.from(selected).join(","),
          },
        };
        await mutate({
          operation: "purge-schedule",
          parameters: {},
          method: manual || !current.id ? "POST" : "PUT",
          payload: payload,
        });
        onCompleted(
          manual ? "审计日志清理任务已启动" : "审计日志清理计划已更新",
        );
      }}
    >
      <div className={resolveClasses("form-grid two-columns")}>
        {!manual ? (
          <>
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
          </>
        ) : null}
        <label className={resolveClasses("field")}>
          <span>{t("保留天数")}</span>
          <FormInput
            type="number"
            min={1}
            max={3_650_000}
            step={1}
            required
            value={days}
            onChange={(event) => {
              setDays(Number(event.currentTarget.value));
            }}
          />
          <small className={resolveClasses("field-help")}>
            {t("早于该期限的选中事件将被清理。")}
          </small>
        </label>
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
            <small>{t("计算匹配记录但不从数据库删除")}</small>
          </span>
        </label>
      </div>
      <fieldset
        className={resolveClasses(
          `event-selector ${styles.purgeEventSelector}`,
        )}
      >
        <legend>{t("清理事件类型")}</legend>
        {events.map((eventName) => (
          <label className={resolveClasses("check-row")} key={eventName}>
            <FormInput
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

type AdministrationPurgeSectionProps = {
  data: PurgeData;
  navigate: (path: string) => void;
  onReload: () => void;
  onNotice: (message: string, error?: boolean) => void;
};

export function AdministrationPurgeSection({
  data,
  navigate,
  onReload,
  onNotice,
}: AdministrationPurgeSectionProps) {
  const mutate = useControlMutation(affectedQueries);
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
      <div
        className={resolveClasses(
          `${styles.maintenanceGrid} ${styles.purgeAdminLayout}`,
        )}
      >
        <section className={resolveClasses(styles.maintenanceCard)}>
          <div className={resolveClasses(styles.maintenanceCardHead)}>
            <div>
              <h2>{t("审计日志清理")}</h2>
              <p>{t("按保留期限和事件类型清理 Harbor 数据库审计记录")}</p>
            </div>
          </div>
          {data.purgeSchedule.load_error ? (
            <div className={resolveClasses("notice notice-warning")}>
              <Icon name="alert" />
              <span>{data.purgeSchedule.load_error}</span>
            </div>
          ) : (
            <dl className={resolveClasses(styles.maintenanceFacts)}>
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
                <dd>
                  {formatDate(schedule.next_scheduled_time, {
                    locale: locale,
                    timeZone: displayTimeZone(),
                  })}
                </dd>
              </div>
            </dl>
          )}
          <div className={resolveClasses(styles.maintenanceActions)}>
            <button
              className={resolveClasses("button button-small")}
              type="button"
              onClick={() => {
                setDialog({ kind: "schedule" });
              }}
            >
              <Icon name="settings" />
              <span>{t("清理计划")}</span>
            </button>
            <button
              className={resolveClasses("button button-small button-primary")}
              type="button"
              onClick={() => {
                setDialog({ kind: "run" });
              }}
            >
              <Icon name="play" />
              <span>{t("立即执行")}</span>
            </button>
          </div>
        </section>
        <section
          className={resolveClasses(`table-shell ${styles.maintenanceHistory}`)}
        >
          <div className={resolveClasses("table-toolbar")}>
            <PanelTitle
              title="审计清理执行历史"
              count={formatCount({
                total: data.collection.pagination.total,
                locale: locale,
                chineseUnit: "次执行",
                englishUnit: "executions",
              })}
            />
          </div>
          <div className={resolveClasses("table-scroll")}>
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
                    <th className={resolveClasses("id-column")}>{t("任务")}</th>
                    <th className={resolveClasses("table-cell-center")}>
                      {t("方式")}
                    </th>
                    <th className={resolveClasses("table-cell-center")}>
                      {t("保留期限")}
                    </th>
                    <th className={resolveClasses("table-cell-center")}>
                      {t("模式")}
                    </th>
                    <th className={resolveClasses("table-cell-center")}>
                      {t("状态")}
                    </th>
                    <th className={resolveClasses("table-cell-time")}>
                      {t("开始时间")}
                    </th>
                    <th className={resolveClasses("table-cell-time")}>
                      {t("最近更新")}
                    </th>
                    <th className={resolveClasses("table-cell-center")}>
                      {t("操作")}
                    </th>
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
                        <td className={resolveClasses("id-cell")}>#{job.id}</td>
                        <td className={resolveClasses("table-cell-center")}>
                          {t(scheduleTypeLabel(job.job_kind))}
                        </td>
                        <td className={resolveClasses("table-cell-center")}>
                          {formatNumber(
                            Math.ceil(
                              numeric(values.audit_retention_hour) / 24,
                            ),
                            locale,
                          )}{" "}
                          {t("天")}
                        </td>
                        <td className={resolveClasses("table-cell-center")}>
                          {values.dry_run === true ? (
                            <span
                              className={resolveClasses("badge badge-blue")}
                            >
                              {t("仅演练")}
                            </span>
                          ) : (
                            <span
                              className={resolveClasses("badge badge-orange")}
                            >
                              {t("正式清理")}
                            </span>
                          )}
                        </td>
                        <td className={resolveClasses("table-cell-center")}>
                          <StatusBadge status={job.job_status} />
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
                        <td className={resolveClasses("table-cell-center")}>
                          <div className={resolveClasses("row-actions")}>
                            <ActionButton
                              label="查看审计清理日志"
                              icon="history"
                              onClick={() => {
                                setDialog({ kind: "log", id: job.id });
                              }}
                            />
                            {canStop ? (
                              <ActionButton
                                label="停止审计清理任务"
                                icon="x"
                                danger
                                onClick={() => {
                                  setDialog({ kind: "stop", id: job.id });
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
                `administration/purge${page > 1 ? `?page=${String(page)}` : ""}`,
              );
            }}
          />
        </section>
      </div>
      {dialog?.kind === "schedule" ? (
        <PurgeDialog
          manual={false}
          current={data.purgeSchedule}
          auditEvents={data.auditEvents}
          onClose={() => {
            setDialog(undefined);
          }}
          onCompleted={complete}
        />
      ) : null}
      {dialog?.kind === "run" ? (
        <PurgeDialog
          manual
          current={data.purgeSchedule}
          auditEvents={data.auditEvents}
          onClose={() => {
            setDialog(undefined);
          }}
          onCompleted={complete}
        />
      ) : null}
      {dialog?.kind === "log" ? (
        <OperationLogDialog
          kind="purge"
          id={dialog.id}
          onClose={() => {
            setDialog(undefined);
          }}
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
          onClose={() => {
            setDialog(undefined);
          }}
          onSubmit={async () => {
            await mutate({
              operation: "purge-job",
              parameters: { id: dialog.id },
              method: "PUT",
            });
            complete("已向 Harbor 提交停止请求");
          }}
        >
          <div className={resolveClasses("notice notice-danger")}>
            <Icon name="alert" />
            <span>{t("停止请求将立即提交到 Harbor。")}</span>
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
  "control-dialog-large": uiStyles0.controlDialogLarge,
  "form-grid": uiStyles0.formGrid,
  "two-columns": uiStyles0.twoColumns,
  field: uiStyles0.field,
  "field-help": uiStyles0.fieldHelp,
  "check-row": uiStyles0.checkRow,
  "event-selector": uiStyles0.eventSelector,
  notice: uiStyles0.notice,
  "notice-warning": uiStyles0.noticeWarning,
  button: uiStyles0.button,
  "button-small": uiStyles0.buttonSmall,
  "button-primary": uiStyles0.buttonPrimary,
  "table-shell": uiStyles0.tableShell,
  "table-toolbar": uiStyles0.tableToolbar,
  "table-scroll": uiStyles0.tableScroll,
  "id-column": uiStyles0.idColumn,
  "table-cell-center": uiStyles0.tableCellCenter,
  "table-cell-time": uiStyles0.tableCellTime,
  "id-cell": uiStyles0.idCell,
  badge: uiStyles0.badge,
  "badge-blue": uiStyles0.badgeBlue,
  "badge-orange": uiStyles0.badgeOrange,
  "row-actions": uiStyles0.rowActions,
  "notice-danger": uiStyles0.noticeDanger,
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
