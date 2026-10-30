import { useState } from "react";
import { useLocale } from "../../app/locale-context";
import type {
  JobServicePool,
  JobServiceQueue,
  JobServiceSchedule,
  JobServiceWorker,
} from "../../app/models";
import { displayTimeZone } from "../../app/preferences";
import { ControlDialog } from "../../components/control-dialog";
import { EmptyState } from "../../components/empty-state";
import { Icon } from "../../components/icon";
import { Pagination } from "../../components/pagination";
import { PanelTitle } from "../../components/panel-title";
import uiStyles0 from "../../components/shared-ui.module.css";
import { StatCell } from "../../components/stat-cell";
import { StatusBadge } from "../../components/status-badge";
import { createClassNames } from "../../lib/css/class-names";
import { formatDate, formatNumber } from "../../lib/format/formatters";

import { errorText } from "../../app/errors";
import { useControlMutation } from "../../app/use-control-mutation";
import {
  type JobServiceData,
  ActionButton,
  affectedQueries,
  fallbackText,
  numeric,
  OperationLogDialog,
} from "./administration-operations-support";
import styles from "./administration.module.css";

type JobDialogState =
  | { kind: "log"; job: string }
  | { kind: "stop-job"; job: string }
  | { kind: "stop-queue"; type: string };

type JobPoolTableProps = { pools: JobServicePool[] };

function JobPoolTable({ pools }: JobPoolTableProps) {
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
          <th className={resolveClasses("table-cell-time")}>{t("启动时间")}</th>
          <th className={resolveClasses("table-cell-time")}>{t("最近心跳")}</th>
        </tr>
      </thead>
      <tbody>
        {pools.map((pool) => (
          <tr key={pool.worker_pool_id}>
            <td className={resolveClasses("mono")}>{pool.worker_pool_id}</td>
            <td>{fallbackText(pool.host)}</td>
            <td className={resolveClasses("mono")}>
              {String(pool.pid ?? "-")}
            </td>
            <td>{formatNumber(pool.concurrency, locale)}</td>
            <td className={resolveClasses("table-cell-time")}>
              {formatDate(pool.start_at, {
                locale: locale,
                timeZone: displayTimeZone(),
              })}
            </td>
            <td className={resolveClasses("table-cell-time")}>
              {formatDate(pool.heartbeat_at, {
                locale: locale,
                timeZone: displayTimeZone(),
              })}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

type JobWorkerTableProps = {
  workers: JobServiceWorker[];
  onLog: (job: string) => void;
  onStop: (job: string) => void;
};

function JobWorkerTable({ workers, onLog, onStop }: JobWorkerTableProps) {
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
          <th className={resolveClasses("table-cell-time")}>{t("开始时间")}</th>
          <th className={resolveClasses("table-cell-time")}>{t("最近签入")}</th>
          <th>{t("操作")}</th>
        </tr>
      </thead>
      <tbody>
        {workers.map((worker) => (
          <tr key={worker.id}>
            <td className={resolveClasses("mono")}>{worker.id}</td>
            <td className={resolveClasses("mono")}>
              {fallbackText(worker.pool_id)}
            </td>
            <td>{fallbackText(worker.job_name, t("空闲"))}</td>
            <td className={resolveClasses("mono")}>
              {fallbackText(worker.job_id)}
            </td>
            <td>
              <StatusBadge
                status={worker.job_id ? (worker.check_in ?? "running") : "idle"}
              />
            </td>
            <td className={resolveClasses("table-cell-time")}>
              {formatDate(worker.start_at, {
                locale: locale,
                timeZone: displayTimeZone(),
              })}
            </td>
            <td className={resolveClasses("table-cell-time")}>
              {formatDate(worker.checkin_at, {
                locale: locale,
                timeZone: displayTimeZone(),
              })}
            </td>
            <td>
              {worker.job_id ? (
                <div className={resolveClasses("row-actions")}>
                  <ActionButton
                    label="查看运行任务日志"
                    icon="history"
                    onClick={() => {
                      onLog(worker.job_id ?? "");
                    }}
                  />
                  <ActionButton
                    label="停止运行任务"
                    icon="x"
                    danger
                    onClick={() => {
                      onStop(worker.job_id ?? "");
                    }}
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

type JobQueueTableProps = {
  queues: JobServiceQueue[];
  onAction: (type: string, action: "pause" | "resume") => void;
  onStop: (type: string) => void;
};

function JobQueueTable({ queues, onAction, onStop }: JobQueueTableProps) {
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
                className={resolveClasses(
                  `badge ${queue.paused ? "badge-orange" : "badge-green"}`,
                )}
              >
                {t(queue.paused ? "已暂停" : "运行中")}
              </span>
            </td>
            <td>
              <div className={resolveClasses("row-actions")}>
                <ActionButton
                  label={queue.paused ? "恢复队列" : "暂停队列"}
                  icon={queue.paused ? "play" : "settings"}
                  onClick={() => {
                    onAction(queue.job_type, queue.paused ? "resume" : "pause");
                  }}
                />
                <ActionButton
                  label="停止队列中的待处理任务"
                  icon="x"
                  danger
                  disabled={numeric(queue.count) <= 0}
                  onClick={() => {
                    onStop(queue.job_type);
                  }}
                />
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

type JobScheduleTableProps = { schedules: JobServiceSchedule[] };

function JobScheduleTable({ schedules }: JobScheduleTableProps) {
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
          <th className={resolveClasses("table-cell-time")}>{t("最近更新")}</th>
        </tr>
      </thead>
      <tbody>
        {schedules.map((schedule) => (
          <tr key={schedule.id}>
            <td className={resolveClasses("mono")}>#{schedule.id}</td>
            <td>{fallbackText(schedule.vendor_type)}</td>
            <td className={resolveClasses("mono")}>
              #{String(schedule.vendor_id ?? "-")}
            </td>
            <td>
              <code>{fallbackText(schedule.cron)}</code>
            </td>
            <td className={resolveClasses("table-cell-time")}>
              {formatDate(schedule.update_time, {
                locale: locale,
                timeZone: displayTimeZone(),
              })}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

type AdministrationJobServiceSectionProps = {
  data: JobServiceData;
  navigate: (path: string) => void;
  onReload: () => void;
  onNotice: (message: string, error?: boolean) => void;
};

export function AdministrationJobServiceSection({
  data,
  navigate,
  onReload,
  onNotice,
}: AdministrationJobServiceSectionProps) {
  const mutate = useControlMutation(affectedQueries);
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
      await mutate({
        operation: "jobservice-queue",
        parameters: { type },
        method: "PUT",
        payload: { action },
      });
      onNotice(action === "pause" ? "任务队列已暂停" : "任务队列已恢复");
      onReload();
    } catch (error) {
      onNotice(errorText(error), true);
    }
  }
  const complete = (message: string) => {
    setDialog(undefined);
    onNotice(message);
    onReload();
  };
  return (
    <>
      <div className={resolveClasses(styles.jobserviceLayout)}>
        <section
          className={resolveClasses(`overview-stats ${styles.jobserviceStats}`)}
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
        <section className={resolveClasses("table-shell")}>
          <div className={resolveClasses("table-toolbar")}>
            <PanelTitle title="工作池" />
            <div className={resolveClasses("toolbar-spacer")} />
          </div>
          <div className={resolveClasses("table-scroll")}>
            <JobPoolTable pools={data.pools} />
          </div>
        </section>
        <section className={resolveClasses("table-shell")}>
          <div className={resolveClasses("table-toolbar")}>
            <PanelTitle title="工作器与运行任务" />
            <div className={resolveClasses("toolbar-spacer")} />
          </div>
          <div className={resolveClasses("table-scroll")}>
            <JobWorkerTable
              workers={data.workers}
              onLog={(job) => {
                setDialog({ kind: "log", job });
              }}
              onStop={(job) => {
                setDialog({ kind: "stop-job", job });
              }}
            />
          </div>
        </section>
        <section className={resolveClasses("table-shell")}>
          <div className={resolveClasses("table-toolbar")}>
            <PanelTitle title="任务队列" />
            <div className={resolveClasses("toolbar-spacer")} />
            <button
              className={resolveClasses("button button-small")}
              type="button"
              onClick={() => void queueAction("all", "resume")}
            >
              <Icon name="play" />
              <span>{t("恢复全部")}</span>
            </button>
            <button
              className={resolveClasses("button button-small")}
              type="button"
              onClick={() => void queueAction("all", "pause")}
            >
              <Icon name="settings" />
              <span>{t("暂停全部")}</span>
            </button>
            <button
              className={resolveClasses("button button-small button-danger")}
              type="button"
              onClick={() => {
                setDialog({ kind: "stop-queue", type: "all" });
              }}
            >
              <Icon name="x" />
              <span>{t("停止全部待处理")}</span>
            </button>
          </div>
          <div className={resolveClasses("table-scroll")}>
            <JobQueueTable
              queues={data.queues}
              onAction={(type, action) => void queueAction(type, action)}
              onStop={(type) => {
                setDialog({ kind: "stop-queue", type });
              }}
            />
          </div>
        </section>
        <section className={resolveClasses("table-shell")}>
          <div className={resolveClasses("table-toolbar")}>
            <PanelTitle title="定时任务" />
            <div className={resolveClasses("toolbar-spacer")} />
            <span className={resolveClasses("muted")}>
              {t(data.scheduleStatus.paused ? "已暂停" : "运行中")}
            </span>
          </div>
          <div className={resolveClasses("table-scroll")}>
            <JobScheduleTable schedules={data.schedules.items} />
          </div>
          <Pagination
            pagination={data.schedules.pagination}
            onPageChange={(page) => {
              navigate(
                "administration/jobs" +
                  (page > 1 ? "?page=" + String(page) : ""),
              );
            }}
          />
        </section>
      </div>
      {dialog?.kind === "log" ? (
        <OperationLogDialog
          kind="jobservice"
          id={dialog.job}
          onClose={() => {
            setDialog(undefined);
          }}
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
          onClose={() => {
            setDialog(undefined);
          }}
          onSubmit={async () => {
            await mutate({
              operation: "jobservice-job",
              parameters: { job: dialog.job },
              method: "PUT",
            });
            complete("运行任务已停止");
          }}
        >
          <div className={resolveClasses("notice notice-danger")}>
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
          onClose={() => {
            setDialog(undefined);
          }}
          onSubmit={async () => {
            await mutate({
              operation: "jobservice-queue",
              parameters: { type: dialog.type },
              method: "PUT",
              payload: {
                action: "stop",
              },
            });
            complete("待处理任务已停止并清除");
          }}
        >
          <div className={resolveClasses("notice notice-danger")}>
            <Icon name="alert" />
            <span>{t("此操作无法撤销")}</span>
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
  "stat-cell": uiStyles0.statCell,
  "status-badge": uiStyles0.statusBadge,
  "table-cell-time": uiStyles0.tableCellTime,
  mono: uiStyles0.mono,
  "row-actions": uiStyles0.rowActions,
  badge: uiStyles0.badge,
  "badge-orange": uiStyles0.badgeOrange,
  "badge-green": uiStyles0.badgeGreen,
  "overview-stats": uiStyles0.overviewStats,
  "table-shell": uiStyles0.tableShell,
  "table-toolbar": uiStyles0.tableToolbar,
  "toolbar-spacer": uiStyles0.toolbarSpacer,
  "table-scroll": uiStyles0.tableScroll,
  button: uiStyles0.button,
  "button-small": uiStyles0.buttonSmall,
  "button-danger": uiStyles0.buttonDanger,
  muted: uiStyles0.muted,
  notice: uiStyles0.notice,
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
