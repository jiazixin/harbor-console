import { useLocale } from "../../app/locale-context";
import type {
  ControlPagination,
  RetentionExecution,
  RetentionMetadata,
  RetentionPolicy,
  RetentionRule,
} from "../../app/models";
import { displayTimeZone } from "../../app/preferences";
import { EmptyState } from "../../components/empty-state";
import { Icon } from "../../components/icon";
import { OverflowText } from "../../components/overflow-text";
import { Pagination } from "../../components/pagination";
import { PanelTitle } from "../../components/panel-title";
import uiStyles0 from "../../components/shared-ui.module.css";
import { StatusBadge } from "../../components/status-badge";
import { createClassNames } from "../../lib/css/class-names";
import {
  formatCount,
  formatDate,
  formatNumber,
} from "../../lib/format/formatters";
import styles from "./projects.module.css";
import { retentionTemplateSummary } from "./rule-labels";

export type ProjectRetentionAction =
  | {
      kind: "create-policy";
      project: string;
      projectId: number;
      metadata: RetentionMetadata;
    }
  | {
      kind: "edit-schedule";
      project: string;
      projectId: number;
      policy: RetentionPolicy;
    }
  | {
      kind: "add-rule";
      project: string;
      projectId: number;
      policy: RetentionPolicy;
      metadata: RetentionMetadata;
    }
  | {
      kind: "edit-rule";
      project: string;
      projectId: number;
      policy: RetentionPolicy;
      metadata: RetentionMetadata;
      ruleIndex: number;
    }
  | {
      kind: "delete-rule";
      projectId: number;
      policy: RetentionPolicy;
      ruleIndex: number;
    }
  | { kind: "delete-policy"; policy: RetentionPolicy }
  | { kind: "run"; policy: RetentionPolicy; dryRun: boolean }
  | {
      kind: "stop-execution";
      policy: RetentionPolicy;
      execution: RetentionExecution;
    }
  | {
      kind: "view-execution";
      project: string;
      policy: RetentionPolicy;
      execution: RetentionExecution;
    };

function firstRepositorySelector(rule: RetentionRule) {
  return rule.scope_selectors?.repository?.[0];
}

function firstTagSelector(rule: RetentionRule) {
  return rule.tag_selectors?.[0];
}

function retentionRuleParameter(
  rule: RetentionRule,
  locale: "zh-CN" | "en-US",
  translate: (value: string) => string,
): string {
  if (rule.template === "always") return translate("所有匹配制品");
  const rawValue = rule.template ? rule.params?.[rule.template] : undefined;
  const value = typeof rawValue === "number" ? rawValue : Number(rawValue ?? 0);
  const formatted = formatNumber(Number.isFinite(value) ? value : 0, locale);
  if (rule.template === "latestPushedK" || rule.template === "latestPulledN") {
    return locale === "en-US"
      ? `Keep ${formatted} artifacts`
      : `保留 ${formatted} 个制品`;
  }
  return locale === "en-US"
    ? `Keep artifacts from the last ${formatted} days`
    : `保留最近 ${formatted} 天的制品`;
}

function canStopExecution(status: string | undefined): boolean {
  return ["running", "pending", "inprogress", "in_progress"].includes(
    status?.toLowerCase() ?? "",
  );
}

type ProjectRetentionSectionProps = {
  project: string;
  projectId: number;
  policy?: RetentionPolicy;
  executions: RetentionExecution[];
  pagination: ControlPagination;
  metadata: RetentionMetadata;
  onPageChange: (page: number) => void;
  onAction: (action: ProjectRetentionAction) => void;
};

export function ProjectRetentionSection({
  project,
  projectId,
  policy,
  executions,
  pagination,
  metadata,
  onPageChange,
  onAction,
}: ProjectRetentionSectionProps) {
  const { locale, t } = useLocale();
  const metadataAvailable =
    !metadata.load_error &&
    Boolean(metadata.templates?.length) &&
    Boolean(metadata.scope_selectors?.length) &&
    Boolean(metadata.tag_selectors?.length);
  const metadataNotice = metadataAvailable
    ? ""
    : (metadata.load_error ??
      t(
        "当前 Harbor 实例未提供 Retention metadata，规则仍可查看但已禁用危险编辑。",
      ));

  if (!policy) {
    return (
      <section
        className={resolveClasses(`table-shell ${styles.retentionEmpty}`)}
      >
        <div className={resolveClasses("table-toolbar")}>
          <PanelTitle title="Tag 保留策略" />
          <div className={resolveClasses("toolbar-spacer")} />
          <button
            className={resolveClasses("button button-small button-primary")}
            type="button"
            disabled={!metadataAvailable}
            onClick={() => {
              onAction({
                kind: "create-policy",
                project,
                projectId,
                metadata,
              });
            }}
          >
            <Icon name="plus" />
            <span>{t("创建策略")}</span>
          </button>
        </div>
        {metadataNotice ? (
          <p className={resolveClasses("notice notice-warning")}>
            {metadataNotice}
          </p>
        ) : null}
        <EmptyState
          title="尚未配置 Tag 保留"
          description="创建策略后，Harbor 会按规则自动清理不再需要的 Tag。"
          icon="history"
        />
      </section>
    );
  }

  const rules = policy.rules ?? [];
  const cron = policy.trigger?.settings?.cron?.trim() ?? "";
  return (
    <div className={resolveClasses(styles.retentionLayout)}>
      <section className={resolveClasses(styles.retentionSummary)}>
        <div className={resolveClasses(styles.retentionSummaryHead)}>
          <div>
            <span className={resolveClasses("eyebrow")}>
              {t("策略")} #{policy.id}
            </span>
            <h2>{t("Tag 保留策略")}</h2>
            <p>
              {t(
                policy.algorithm === "and"
                  ? "规则按全部匹配方式执行"
                  : "规则按任意匹配方式执行",
              )}
            </p>
          </div>
          <div className={resolveClasses("page-actions")}>
            <button
              className={resolveClasses("button button-small")}
              type="button"
              onClick={() => {
                onAction({ kind: "run", policy, dryRun: true });
              }}
            >
              <Icon name="play" />
              <span>{t("仅演练")}</span>
            </button>
            <button
              className={resolveClasses("button button-small button-primary")}
              type="button"
              onClick={() => {
                onAction({ kind: "run", policy, dryRun: false });
              }}
            >
              <Icon name="play" />
              <span>{t("正式执行")}</span>
            </button>
            <button
              className={resolveClasses("icon-button")}
              type="button"
              disabled={!metadataAvailable}
              title={t("编辑执行计划")}
              aria-label={t("编辑执行计划")}
              onClick={() => {
                onAction({
                  kind: "edit-schedule",
                  project,
                  projectId,
                  policy,
                });
              }}
            >
              <Icon name="settings" />
            </button>
            <button
              className={resolveClasses("icon-button danger-icon")}
              type="button"
              title={t("删除 Tag 保留策略")}
              aria-label={t("删除 Tag 保留策略")}
              onClick={() => {
                onAction({ kind: "delete-policy", policy });
              }}
            >
              <Icon name="trash" />
            </button>
          </div>
        </div>
        <dl className={resolveClasses(styles.retentionFacts)}>
          <div>
            <dt>{t("规则数量")}</dt>
            <dd>
              {formatNumber(rules.length, locale)} {t("条")}
            </dd>
          </div>
          <div>
            <dt>{t("执行计划")}</dt>
            <dd>{t(cron ? "定时执行" : "仅手动")}</dd>
          </div>
          <div>
            <dt>Cron</dt>
            <dd className={resolveClasses("mono")}>{cron || t("未配置")}</dd>
          </div>
          <div>
            <dt>{t("最近更新")}</dt>
            <dd>
              {formatDate(policy.update_time ?? policy.creation_time, {
                locale: locale,
                timeZone: displayTimeZone(),
              })}
            </dd>
          </div>
        </dl>
      </section>

      <section className={resolveClasses("table-shell")}>
        <div className={resolveClasses("table-toolbar")}>
          <PanelTitle title="保留规则" />
          <div className={resolveClasses("toolbar-spacer")} />
          <button
            className={resolveClasses("button button-small button-primary")}
            type="button"
            disabled={!metadataAvailable}
            onClick={() => {
              onAction({
                kind: "add-rule",
                project,
                projectId,
                policy,
                metadata,
              });
            }}
          >
            <Icon name="plus" />
            <span>{t("添加规则")}</span>
          </button>
        </div>
        {metadataNotice ? (
          <p className={resolveClasses("notice notice-warning")}>
            {metadataNotice}
          </p>
        ) : null}
        <div className={resolveClasses("table-scroll")}>
          {!rules.length ? (
            <EmptyState
              title="暂无保留规则"
              description="策略至少需要一条启用或停用的保留规则。"
              icon="history"
            />
          ) : (
            <table>
              <thead>
                <tr>
                  <th>{t("保留条件")}</th>
                  <th>{t("仓库范围")}</th>
                  <th>{t("Tag 范围")}</th>
                  <th>{t("状态")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rules.map((rule, ruleIndex) => (
                  <tr key={`${String(rule.id ?? "new")}-${String(ruleIndex)}`}>
                    <td>
                      <div className={resolveClasses("cell-stack")}>
                        <strong>
                          {t(retentionTemplateSummary(rule.template))}
                        </strong>
                        <small>{retentionRuleParameter(rule, locale, t)}</small>
                      </div>
                    </td>
                    <td>
                      <OverflowText as="code">
                        {firstRepositorySelector(rule)?.pattern ?? "**"}
                      </OverflowText>
                    </td>
                    <td>
                      <OverflowText as="code">
                        {firstTagSelector(rule)?.pattern ?? "**"}
                      </OverflowText>
                    </td>
                    <td>
                      <span
                        className={resolveClasses(
                          `badge ${rule.disabled ? "" : "badge-green"}`.trim(),
                        )}
                      >
                        {t(rule.disabled ? "已停用" : "已启用")}
                      </span>
                    </td>
                    <td>
                      <div className={resolveClasses("row-actions")}>
                        <button
                          className={resolveClasses("icon-button")}
                          type="button"
                          disabled={!metadataAvailable}
                          title={t("编辑保留规则")}
                          aria-label={t("编辑保留规则")}
                          onClick={() => {
                            onAction({
                              kind: "edit-rule",
                              project,
                              projectId,
                              policy,
                              metadata,
                              ruleIndex,
                            });
                          }}
                        >
                          <Icon name="edit" />
                        </button>
                        <button
                          className={resolveClasses("icon-button danger-icon")}
                          type="button"
                          disabled={!metadataAvailable}
                          title={t("删除保留规则")}
                          aria-label={t("删除保留规则")}
                          onClick={() => {
                            onAction({
                              kind: "delete-rule",
                              projectId,
                              policy,
                              ruleIndex,
                            });
                          }}
                        >
                          <Icon name="trash" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className={resolveClasses("table-shell")}>
        <div className={resolveClasses("table-toolbar")}>
          <PanelTitle
            title="执行历史"
            count={formatCount({
              total: pagination.total,
              locale: locale,
              chineseUnit: "次执行",
              englishUnit: "executions",
            })}
          />
        </div>
        <div className={resolveClasses("table-scroll")}>
          {!executions.length ? (
            <EmptyState
              title="暂无执行记录"
              description="执行演练或正式清理后会显示在这里。"
              icon="history"
            />
          ) : (
            <table>
              <thead>
                <tr>
                  <th className={resolveClasses("id-column")}>
                    {t("执行编号")}
                  </th>
                  <th>{t("模式")}</th>
                  <th>{t("状态")}</th>
                  <th className={resolveClasses("table-cell-time")}>
                    {t("开始时间")}
                  </th>
                  <th className={resolveClasses("table-cell-time")}>
                    {t("结束时间")}
                  </th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {executions.map((execution) => (
                  <tr key={execution.id}>
                    <td className={resolveClasses("id-cell")}>
                      #{execution.id}
                    </td>
                    <td>
                      <span
                        className={resolveClasses(
                          `badge ${execution.dry_run ? "badge-blue" : "badge-orange"}`,
                        )}
                      >
                        {t(execution.dry_run ? "仅演练" : "正式执行")}
                      </span>
                    </td>
                    <td>
                      <StatusBadge status={execution.status} />
                    </td>
                    <td className={resolveClasses("table-cell-time")}>
                      {formatDate(execution.start_time, {
                        locale: locale,
                        timeZone: displayTimeZone(),
                      })}
                    </td>
                    <td className={resolveClasses("table-cell-time")}>
                      {formatDate(execution.end_time, {
                        locale: locale,
                        timeZone: displayTimeZone(),
                      })}
                    </td>
                    <td>
                      <div className={resolveClasses("row-actions")}>
                        <button
                          className={resolveClasses("icon-button")}
                          type="button"
                          title={t("查看任务")}
                          aria-label={t("查看 Tag 保留任务")}
                          onClick={() => {
                            onAction({
                              kind: "view-execution",
                              project,
                              policy,
                              execution,
                            });
                          }}
                        >
                          <Icon name="history" />
                        </button>
                        {canStopExecution(execution.status) ? (
                          <button
                            className={resolveClasses(
                              "icon-button danger-icon",
                            )}
                            type="button"
                            title={t("停止执行")}
                            aria-label={t("停止执行")}
                            onClick={() => {
                              onAction({
                                kind: "stop-execution",
                                policy,
                                execution,
                              });
                            }}
                          >
                            <Icon name="x" />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <Pagination pagination={pagination} onPageChange={onPageChange} />
      </section>
    </div>
  );
}

const resolveClasses = createClassNames({
  "empty-state": uiStyles0.emptyState,
  icon: uiStyles0.icon,
  "overflow-text": uiStyles0.overflowText,
  "panel-title": uiStyles0.panelTitle,
  "status-badge": uiStyles0.statusBadge,
  "table-shell": uiStyles0.tableShell,
  "table-toolbar": uiStyles0.tableToolbar,
  "toolbar-spacer": uiStyles0.toolbarSpacer,
  button: uiStyles0.button,
  "button-small": uiStyles0.buttonSmall,
  "button-primary": uiStyles0.buttonPrimary,
  notice: uiStyles0.notice,
  "notice-warning": uiStyles0.noticeWarning,
  eyebrow: uiStyles0.eyebrow,
  "page-actions": uiStyles0.pageActions,
  "icon-button": uiStyles0.iconButton,
  "danger-icon": uiStyles0.dangerIcon,
  mono: uiStyles0.mono,
  "table-scroll": uiStyles0.tableScroll,
  "cell-stack": uiStyles0.cellStack,
  badge: uiStyles0.badge,
  "badge-green": uiStyles0.badgeGreen,
  "row-actions": uiStyles0.rowActions,
  "id-column": uiStyles0.idColumn,
  "table-cell-time": uiStyles0.tableCellTime,
  "id-cell": uiStyles0.idCell,
  "badge-blue": uiStyles0.badgeBlue,
  "badge-orange": uiStyles0.badgeOrange,
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
