import { formatDate, formatNumber, formatCount } from "../../app/formatters";
import { useLocale } from "../../app/locale-context";
import type {
  ControlPagination,
  RetentionExecution,
  RetentionMetadata,
  RetentionPolicy,
  RetentionRule,
} from "../../app/models";
import { Pagination } from "../../components/data-table";
import { EmptyState } from "../../components/empty-state";
import { PanelTitle } from "../../components/page-elements";
import { Icon } from "../../components/icons";
import { OverflowText } from "../../components/overflow-text";
import { StatusBadge } from "../../components/status-badge";
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

export function ProjectRetentionSection({
  project,
  projectId,
  policy,
  executions,
  pagination,
  metadata,
  onPageChange,
  onAction,
}: {
  project: string;
  projectId: number;
  policy?: RetentionPolicy;
  executions: RetentionExecution[];
  pagination: ControlPagination;
  metadata: RetentionMetadata;
  onPageChange: (page: number) => void;
  onAction: (action: ProjectRetentionAction) => void;
}) {
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
      <section className="table-shell retention-empty">
        <div className="table-toolbar">
          <PanelTitle title="Tag 保留策略" />
          <div className="toolbar-spacer" />
          <button
            className="button button-small button-primary"
            type="button"
            disabled={!metadataAvailable}
            onClick={() =>
              onAction({
                kind: "create-policy",
                project,
                projectId,
                metadata,
              })
            }
          >
            <Icon name="plus" />
            <span>{t("创建策略")}</span>
          </button>
        </div>
        {metadataNotice ? (
          <p className="notice notice-warning">{metadataNotice}</p>
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
    <div className="retention-layout">
      <section className="retention-summary">
        <div className="retention-summary-head">
          <div>
            <span className="eyebrow">
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
          <div className="page-actions">
            <button
              className="button button-small"
              type="button"
              onClick={() => onAction({ kind: "run", policy, dryRun: true })}
            >
              <Icon name="play" />
              <span>{t("仅演练")}</span>
            </button>
            <button
              className="button button-small button-primary"
              type="button"
              onClick={() => onAction({ kind: "run", policy, dryRun: false })}
            >
              <Icon name="play" />
              <span>{t("正式执行")}</span>
            </button>
            <button
              className="icon-button"
              type="button"
              disabled={!metadataAvailable}
              title={t("编辑执行计划")}
              aria-label={t("编辑执行计划")}
              onClick={() =>
                onAction({
                  kind: "edit-schedule",
                  project,
                  projectId,
                  policy,
                })
              }
            >
              <Icon name="settings" />
            </button>
            <button
              className="icon-button danger-icon"
              type="button"
              title={t("删除 Tag 保留策略")}
              aria-label={t("删除 Tag 保留策略")}
              onClick={() => onAction({ kind: "delete-policy", policy })}
            >
              <Icon name="trash" />
            </button>
          </div>
        </div>
        <dl className="retention-facts">
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
            <dd className="mono">{cron || t("未配置")}</dd>
          </div>
          <div>
            <dt>{t("最近更新")}</dt>
            <dd>
              {formatDate(policy.update_time ?? policy.creation_time, locale)}
            </dd>
          </div>
        </dl>
      </section>

      <section className="table-shell">
        <div className="table-toolbar">
          <PanelTitle title="保留规则" />
          <div className="toolbar-spacer" />
          <button
            className="button button-small button-primary"
            type="button"
            disabled={!metadataAvailable}
            onClick={() =>
              onAction({
                kind: "add-rule",
                project,
                projectId,
                policy,
                metadata,
              })
            }
          >
            <Icon name="plus" />
            <span>{t("添加规则")}</span>
          </button>
        </div>
        {metadataNotice ? (
          <p className="notice notice-warning">{metadataNotice}</p>
        ) : null}
        <div className="table-scroll">
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
                      <div className="cell-stack">
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
                        className={`badge ${rule.disabled ? "" : "badge-green"}`.trim()}
                      >
                        {t(rule.disabled ? "已停用" : "已启用")}
                      </span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="icon-button"
                          type="button"
                          disabled={!metadataAvailable}
                          title={t("编辑保留规则")}
                          aria-label={t("编辑保留规则")}
                          onClick={() =>
                            onAction({
                              kind: "edit-rule",
                              project,
                              projectId,
                              policy,
                              metadata,
                              ruleIndex,
                            })
                          }
                        >
                          <Icon name="edit" />
                        </button>
                        <button
                          className="icon-button danger-icon"
                          type="button"
                          disabled={!metadataAvailable}
                          title={t("删除保留规则")}
                          aria-label={t("删除保留规则")}
                          onClick={() =>
                            onAction({
                              kind: "delete-rule",
                              projectId,
                              policy,
                              ruleIndex,
                            })
                          }
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

      <section className="table-shell">
        <div className="table-toolbar">
          <PanelTitle
            title="执行历史"
            count={formatCount(
              pagination.total,
              locale,
              "次执行",
              "executions",
            )}
          />
        </div>
        <div className="table-scroll">
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
                  <th className="id-column">{t("执行编号")}</th>
                  <th>{t("模式")}</th>
                  <th>{t("状态")}</th>
                  <th className="table-cell-time">{t("开始时间")}</th>
                  <th className="table-cell-time">{t("结束时间")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {executions.map((execution) => (
                  <tr key={execution.id}>
                    <td className="id-cell">#{execution.id}</td>
                    <td>
                      <span
                        className={`badge ${execution.dry_run ? "badge-blue" : "badge-orange"}`}
                      >
                        {t(execution.dry_run ? "仅演练" : "正式执行")}
                      </span>
                    </td>
                    <td>
                      <StatusBadge status={execution.status} />
                    </td>
                    <td className="table-cell-time">
                      {formatDate(execution.start_time, locale)}
                    </td>
                    <td className="table-cell-time">
                      {formatDate(execution.end_time, locale)}
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="icon-button"
                          type="button"
                          title={t("查看任务")}
                          aria-label={t("查看 Tag 保留任务")}
                          onClick={() =>
                            onAction({
                              kind: "view-execution",
                              project,
                              policy,
                              execution,
                            })
                          }
                        >
                          <Icon name="history" />
                        </button>
                        {canStopExecution(execution.status) ? (
                          <button
                            className="icon-button danger-icon"
                            type="button"
                            title={t("停止执行")}
                            aria-label={t("停止执行")}
                            onClick={() =>
                              onAction({
                                kind: "stop-execution",
                                policy,
                                execution,
                              })
                            }
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
