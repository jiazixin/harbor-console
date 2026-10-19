import { useEffect, useMemo, useState } from "react";

import { controlApi } from "../../app/api-client";
import { formatDate, formatDuration, formatNumber } from "../../app/formatters";
import { useLocale } from "../../app/locale-context";
import type {
  ControlPagination,
  HarborSelector,
  RetentionExecution,
  RetentionMetadata,
  RetentionPolicy,
  RetentionRule,
  RetentionTask,
} from "../../app/models";
import { ControlDialog } from "../../components/control-dialog";
import { EmptyState } from "../../components/empty-state";
import {
  DialogLoading,
  ExecutionSection,
  ExecutionSummary,
} from "../../components/execution-summary";
import { ErrorView } from "../../components/feedback";
import { Icon } from "../../components/icons";
import { StatusBadge } from "../../components/status-badge";
import { TaskLogPanel, useTaskLog } from "../../components/task-log-panel";
import { UnifiedSelect } from "../../components/unified-select";
import { DialogPagination } from "./dialog-pagination";
import {
  fallbackRetentionTemplates,
  retentionTemplateOptionLabel,
  retentionTemplateSummary,
  selectorDecorationLabel,
} from "./rule-labels";

const fallbackRepositoryDecorations = ["repoMatches", "repoExcludes"];
const fallbackTagDecorations = ["matches", "excludes"];

function firstSelector(selectors: HarborSelector[] | undefined) {
  return selectors?.[0];
}

function selectorDecorations(
  metadata: RetentionMetadata,
  type: "repository" | "tag",
): string[] {
  const candidates =
    (type === "repository"
      ? metadata.scope_selectors
      : metadata.tag_selectors)?.[0]?.decorations ?? [];
  if (candidates.length) return candidates;
  return type === "repository"
    ? fallbackRepositoryDecorations
    : fallbackTagDecorations;
}

function templateOptions(metadata: RetentionMetadata) {
  const candidates =
    metadata.templates
      ?.map((template) => {
        const value = template.rule_template?.trim() ?? "";
        return {
          value,
          label: retentionTemplateOptionLabel(
            value,
            template.display_text?.trim(),
          ),
        };
      })
      .filter((template) => template.value) ?? [];
  return candidates.length ? candidates : fallbackRetentionTemplates;
}

function numericParameter(rule: RetentionRule | undefined): number {
  if (!rule || rule.template === "always") return 10;
  const rawValue = rule.template ? rule.params?.[rule.template] : undefined;
  const value = typeof rawValue === "number" ? rawValue : Number(rawValue);
  return Number.isFinite(value) && value >= 1 ? value : 10;
}

function displayText(value: string | undefined): string {
  const normalized = value?.trim();
  if (normalized === undefined || normalized.length === 0) return "-";
  return normalized;
}

function selectorExtras(value: string | undefined): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function retentionPolicySubtitle(
  translate: (source: string) => string,
  policyId: number,
): string {
  return `${translate("策略")} #${String(policyId)}`;
}

type RetentionRuleEditor = ReturnType<typeof useRetentionRuleEditor>;

function useRetentionRuleEditor(
  rule: RetentionRule | undefined,
  metadata: RetentionMetadata,
) {
  const repository = firstSelector(rule?.scope_selectors?.repository);
  const tag = firstSelector(rule?.tag_selectors);
  const repositoryDecorations = selectorDecorations(metadata, "repository");
  const tagDecorations = selectorDecorations(metadata, "tag");
  const templates = templateOptions(metadata);
  const [template, setTemplate] = useState(
    rule?.template ?? templates.at(0)?.value ?? "latestPushedK",
  );
  const [amount, setAmount] = useState(numericParameter(rule));
  const [repositoryDecoration, setRepositoryDecoration] = useState(
    repository?.decoration ?? repositoryDecorations.at(0) ?? "repoMatches",
  );
  const [repositoryPattern, setRepositoryPattern] = useState(
    repository?.pattern ?? "**",
  );
  const [tagDecoration, setTagDecoration] = useState(
    tag?.decoration ?? tagDecorations.at(0) ?? "matches",
  );
  const [tagPattern, setTagPattern] = useState(tag?.pattern ?? "**");
  const [includeUntagged, setIncludeUntagged] = useState(
    selectorExtras(tag?.extras).untagged === true,
  );
  const [disabled, setDisabled] = useState(rule?.disabled === true);
  return {
    templates,
    repositoryDecorations,
    tagDecorations,
    template,
    setTemplate,
    amount,
    setAmount,
    repositoryDecoration,
    setRepositoryDecoration,
    repositoryPattern,
    setRepositoryPattern,
    tagDecoration,
    setTagDecoration,
    tagPattern,
    setTagPattern,
    includeUntagged,
    setIncludeUntagged,
    disabled,
    setDisabled,
  };
}

function retentionRulePayload(
  existing: RetentionRule | undefined,
  editor: RetentionRuleEditor,
): RetentionRule {
  const repository = firstSelector(existing?.scope_selectors?.repository);
  const tag = firstSelector(existing?.tag_selectors);
  const extras = selectorExtras(tag?.extras);
  if (editor.includeUntagged) extras.untagged = true;
  else delete extras.untagged;
  const params = { ...(existing?.params ?? {}) };
  if (editor.template === "always") delete params.always;
  else params[editor.template] = editor.amount;
  return {
    ...(existing ?? {}),
    priority: existing?.priority ?? 1,
    disabled: editor.disabled,
    action: "retain",
    template: editor.template,
    params,
    tag_selectors: [
      {
        ...(tag ?? {}),
        kind: "doublestar",
        decoration: editor.tagDecoration,
        pattern: editor.tagPattern.trim(),
        ...(Object.keys(extras).length
          ? { extras: JSON.stringify(extras) }
          : {}),
      },
    ],
    scope_selectors: {
      ...(existing?.scope_selectors ?? {}),
      repository: [
        {
          ...(repository ?? {}),
          kind: "doublestar",
          decoration: editor.repositoryDecoration,
          pattern: editor.repositoryPattern.trim(),
        },
      ],
    },
  };
}

function retentionPolicyPayload(
  projectId: number,
  rules: RetentionRule[],
  algorithm: string | undefined,
  cron: string | undefined,
) {
  return {
    algorithm: algorithm === "and" ? "and" : "or",
    rules: rules.map((rule, index) => ({ ...rule, priority: index + 1 })),
    trigger: {
      kind: "Schedule",
      settings: { cron: cron?.trim() ?? "" },
    },
    scope: { level: "project", ref: projectId },
  };
}

function RetentionRuleFields({
  editor,
  cron,
  onCronChange,
}: {
  editor: RetentionRuleEditor;
  cron?: string;
  onCronChange?: (value: string) => void;
}) {
  const { t } = useLocale();
  return (
    <>
      <div className="form-grid two-columns">
        <label className="field field-span">
          <span>{t("保留条件")}</span>
          <UnifiedSelect
            ariaLabel={t("保留条件")}
            name="template"
            value={editor.template}
            options={editor.templates.map((option) => ({
              value: option.value,
              label: t(option.label),
            }))}
            onChange={editor.setTemplate}
          />
        </label>
        <label className="field">
          <span>{t("数量或天数")}</span>
          <input
            name="amount"
            type="number"
            min={1}
            max={1_000_000}
            step={1}
            required
            disabled={editor.template === "always"}
            value={editor.amount}
            onChange={(event) =>
              editor.setAmount(Number(event.currentTarget.value))
            }
          />
        </label>
        <label className="field">
          <span>{t("仓库条件")}</span>
          <UnifiedSelect
            ariaLabel={t("仓库条件")}
            name="repository_decoration"
            value={editor.repositoryDecoration}
            options={editor.repositoryDecorations.map((value) => ({
              value,
              label: t(selectorDecorationLabel(value)),
            }))}
            onChange={editor.setRepositoryDecoration}
          />
        </label>
        <label className="field">
          <span>{t("仓库匹配")}</span>
          <input
            name="repository_pattern"
            required
            maxLength={1024}
            value={editor.repositoryPattern}
            placeholder={t("例如 release/**")}
            onChange={(event) =>
              editor.setRepositoryPattern(event.currentTarget.value)
            }
          />
        </label>
        <label className="field">
          <span>{t("Tag 条件")}</span>
          <UnifiedSelect
            ariaLabel={t("Tag 条件")}
            name="tag_decoration"
            value={editor.tagDecoration}
            options={editor.tagDecorations.map((value) => ({
              value,
              label: t(selectorDecorationLabel(value)),
            }))}
            onChange={editor.setTagDecoration}
          />
        </label>
        <label className="field">
          <span>{t("Tag 匹配")}</span>
          <input
            name="tag_pattern"
            required
            maxLength={1024}
            value={editor.tagPattern}
            placeholder={t("例如 v*")}
            onChange={(event) =>
              editor.setTagPattern(event.currentTarget.value)
            }
          />
        </label>
        {onCronChange ? (
          <label className="field field-span">
            <span>{t("执行计划 Cron")}</span>
            <input
              name="cron"
              maxLength={255}
              value={cron}
              placeholder={t("留空表示仅手动执行")}
              onChange={(event) => onCronChange(event.currentTarget.value)}
            />
            <small className="field-help">
              {t("Harbor 使用含秒字段的 Cron 表达式。")}
            </small>
          </label>
        ) : null}
      </div>
      <label className="check-row">
        <input
          name="untagged"
          type="checkbox"
          checked={editor.includeUntagged}
          onChange={(event) =>
            editor.setIncludeUntagged(event.currentTarget.checked)
          }
        />
        <span>
          <strong>{t("包含无 Tag 制品")}</strong>
          <small>{t("将未标记制品纳入该规则")}</small>
        </span>
      </label>
      <label className="check-row">
        <input
          name="disabled"
          type="checkbox"
          checked={editor.disabled}
          onChange={(event) => editor.setDisabled(event.currentTarget.checked)}
        />
        <span>
          <strong>{t("暂时停用规则")}</strong>
          <small>{t("保留规则配置，但执行时跳过")}</small>
        </span>
      </label>
    </>
  );
}

export function CreateRetentionPolicyDialog({
  project,
  projectId,
  metadata,
  onClose,
  onSaved,
}: {
  project: string;
  projectId: number;
  metadata: RetentionMetadata;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editor = useRetentionRuleEditor(undefined, metadata);
  const [cron, setCron] = useState("");
  return (
    <ControlDialog
      title="创建 Tag 保留策略"
      subtitle={project}
      submitLabel="创建策略"
      onClose={onClose}
      onSubmit={async () => {
        const rule = retentionRulePayload(undefined, editor);
        await controlApi.mutate(
          "retentions",
          {},
          "POST",
          retentionPolicyPayload(projectId, [rule], "or", cron),
        );
        onSaved();
      }}
    >
      <RetentionRuleFields editor={editor} cron={cron} onCronChange={setCron} />
    </ControlDialog>
  );
}

export function RetentionScheduleDialog({
  projectId,
  policy,
  onClose,
  onSaved,
}: {
  projectId: number;
  policy: RetentionPolicy;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useLocale();
  const [algorithm, setAlgorithm] = useState(
    policy.algorithm === "and" ? "and" : "or",
  );
  const [cron, setCron] = useState(policy.trigger?.settings?.cron ?? "");
  return (
    <ControlDialog
      title="编辑保留策略计划"
      subtitle={retentionPolicySubtitle(t, policy.id)}
      submitLabel="保存计划"
      onClose={onClose}
      onSubmit={async () => {
        await controlApi.mutate(
          "retention",
          { id: policy.id },
          "PUT",
          retentionPolicyPayload(
            projectId,
            policy.rules ?? [],
            algorithm,
            cron,
          ),
        );
        onSaved();
      }}
    >
      <div className="form-grid">
        <label className="field">
          <span>{t("规则组合方式")}</span>
          <UnifiedSelect
            ariaLabel={t("规则组合方式")}
            name="algorithm"
            value={algorithm}
            options={[
              { value: "or", label: t("匹配任意规则") },
              { value: "and", label: t("同时匹配全部规则") },
            ]}
            onChange={setAlgorithm}
          />
        </label>
        <label className="field">
          <span>{t("执行计划 Cron")}</span>
          <input
            name="cron"
            maxLength={255}
            value={cron}
            placeholder={t("留空表示仅手动执行")}
            onChange={(event) => setCron(event.currentTarget.value)}
          />
          <small className="field-help">
            {t("Harbor 使用含秒字段的 Cron 表达式。")}
          </small>
        </label>
      </div>
    </ControlDialog>
  );
}

export function RetentionRuleDialog({
  projectId,
  policy,
  metadata,
  ruleIndex,
  onClose,
  onSaved,
}: {
  projectId: number;
  policy: RetentionPolicy;
  metadata: RetentionMetadata;
  ruleIndex?: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useLocale();
  const rules = policy.rules ?? [];
  const editingIndex =
    ruleIndex !== undefined && ruleIndex >= 0 && ruleIndex < rules.length
      ? ruleIndex
      : undefined;
  const existing = editingIndex === undefined ? undefined : rules[editingIndex];
  const editor = useRetentionRuleEditor(existing, metadata);
  return (
    <ControlDialog
      title={
        editingIndex === undefined ? "添加 Tag 保留规则" : "编辑 Tag 保留规则"
      }
      subtitle={retentionPolicySubtitle(t, policy.id)}
      submitLabel={editingIndex === undefined ? "添加规则" : "保存规则"}
      onClose={onClose}
      onSubmit={async () => {
        const nextRules = rules.map((rule) => ({ ...rule }));
        const nextRule = retentionRulePayload(existing, editor);
        if (editingIndex !== undefined) nextRules[editingIndex] = nextRule;
        else nextRules.push(nextRule);
        await controlApi.mutate(
          "retention",
          { id: policy.id },
          "PUT",
          retentionPolicyPayload(
            projectId,
            nextRules,
            policy.algorithm,
            policy.trigger?.settings?.cron,
          ),
        );
        onSaved();
      }}
    >
      <RetentionRuleFields editor={editor} />
    </ControlDialog>
  );
}

export function DeleteRetentionRuleDialog({
  projectId,
  policy,
  ruleIndex,
  onClose,
  onDeleted,
}: {
  projectId: number;
  policy: RetentionPolicy;
  ruleIndex: number;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { locale, t } = useLocale();
  const rules = policy.rules ?? [];
  const rule = rules[ruleIndex];
  const label = retentionTemplateSummary(rule.template);
  const subtitle =
    locale === "en-US"
      ? `The ${t(label)} rule will be deleted.`
      : `将删除“${t(label)}”规则。`;
  return (
    <ControlDialog
      title="删除 Tag 保留规则"
      subtitle={subtitle}
      submitLabel="删除规则"
      destructive
      onClose={onClose}
      onSubmit={async () => {
        const nextRules = rules.filter((_, index) => index !== ruleIndex);
        await controlApi.mutate(
          "retention",
          { id: policy.id },
          "PUT",
          retentionPolicyPayload(
            projectId,
            nextRules,
            policy.algorithm,
            policy.trigger?.settings?.cron,
          ),
        );
        onDeleted();
      }}
    >
      <div className="notice notice-danger">
        <Icon name="alert" />
        <span>{t("此操作无法撤销")}</span>
      </div>
    </ControlDialog>
  );
}

export function DeleteRetentionPolicyDialog({
  policy,
  onClose,
  onDeleted,
}: {
  policy: RetentionPolicy;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { t } = useLocale();
  return (
    <ControlDialog
      title="删除 Tag 保留策略"
      subtitle="该项目将不再自动清理旧 Tag，已有制品不会在此操作中删除。"
      submitLabel="删除策略"
      destructive
      onClose={onClose}
      onSubmit={async () => {
        await controlApi.mutate("retention", { id: policy.id }, "DELETE");
        onDeleted();
      }}
    >
      <div className="notice notice-danger">
        <Icon name="alert" />
        <span>{t("此操作无法撤销")}</span>
      </div>
    </ControlDialog>
  );
}

export function RunRetentionDialog({
  policy,
  dryRun,
  onClose,
  onStarted,
}: {
  policy: RetentionPolicy;
  dryRun: boolean;
  onClose: () => void;
  onStarted: () => void;
}) {
  const { t } = useLocale();
  return (
    <ControlDialog
      title={dryRun ? "执行 Tag 保留演练" : "正式执行 Tag 保留"}
      subtitle={
        dryRun
          ? "只计算匹配结果，不会删除任何 Tag"
          : "匹配规则的旧 Tag 可能被永久删除"
      }
      submitLabel={dryRun ? "开始演练" : "确认执行"}
      submitIcon="play"
      destructive={!dryRun}
      onClose={onClose}
      onSubmit={async () => {
        await controlApi.mutate(
          "retention-executions",
          { id: policy.id },
          "POST",
          { dry_run: dryRun },
        );
        onStarted();
      }}
    >
      <div className={`notice ${dryRun ? "notice-info" : "notice-danger"}`}>
        <Icon name={dryRun ? "shield" : "alert"} />
        <span>
          {t(
            dryRun
              ? "建议先查看演练结果，再执行正式清理。"
              : "正式执行后无法通过控制台恢复已删除的 Tag。",
          )}
        </span>
      </div>
    </ControlDialog>
  );
}

export function StopRetentionExecutionDialog({
  policy,
  execution,
  onClose,
  onStopped,
}: {
  policy: RetentionPolicy;
  execution: RetentionExecution;
  onClose: () => void;
  onStopped: () => void;
}) {
  const { t } = useLocale();
  return (
    <ControlDialog
      title="停止 Tag 保留执行"
      subtitle={`执行 #${String(execution.id)}`}
      submitLabel="停止执行"
      submitIcon="x"
      destructive
      onClose={onClose}
      onSubmit={async () => {
        await controlApi.mutate(
          "retention-execution",
          { id: policy.id, eid: execution.id },
          "PATCH",
          { action: "stop" },
        );
        onStopped();
      }}
    >
      <div className="notice notice-danger">
        <Icon name="alert" />
        <span>
          {t("正在处理的单个任务可能已完成，停止操作不会恢复已经删除的 Tag。")}
        </span>
      </div>
    </ControlDialog>
  );
}

function emptyPagination(): ControlPagination {
  return { page: 1, page_size: 20, total: 0 };
}

function failedTask(task: RetentionTask): boolean {
  return ["failed", "error"].includes(task.status?.toLowerCase() ?? "");
}

function runningTask(task: RetentionTask): boolean {
  return ["running", "inprogress", "in_progress"].includes(
    task.status?.toLowerCase() ?? "",
  );
}

export function RetentionExecutionDialog({
  project,
  policy,
  execution,
  onClose,
  onNotice,
}: {
  project: string;
  policy: RetentionPolicy;
  execution: RetentionExecution;
  onClose: () => void;
  onNotice: (message: string, error?: boolean) => void;
}) {
  const { locale, t } = useLocale();
  const [page, setPage] = useState(1);
  const [tasks, setTasks] = useState<RetentionTask[]>([]);
  const [pagination, setPagination] = useState(emptyPagination);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const taskLog = useTaskLog<RetentionTask>((task, signal) =>
    controlApi.data<string>(
      "retention-task-log",
      { id: policy.id, eid: execution.id, tid: task.id },
      signal,
    ),
  );

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void controlApi
      .list<RetentionTask>(
        "retention-tasks",
        {
          id: policy.id,
          eid: execution.id,
          page,
          page_size: 20,
        },
        controller.signal,
      )
      .then((collection) => {
        setTasks(collection.items);
        setPagination(collection.pagination);
      })
      .catch((loadError: unknown) => {
        if (
          loadError instanceof DOMException &&
          loadError.name === "AbortError"
        )
          return;
        setError(
          loadError instanceof Error ? loadError.message : String(loadError),
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [execution.id, page, policy.id]);

  const metrics = useMemo(() => {
    const total = tasks.reduce((sum, task) => sum + (task.total ?? 0), 0);
    const retained = tasks.reduce((sum, task) => sum + (task.retained ?? 0), 0);
    return {
      total,
      retained,
      cleanup: Math.max(0, total - retained),
      failed: tasks.filter(failedTask).length,
      running: tasks.filter(runningTask).length,
    };
  }, [tasks]);

  return (
    <ControlDialog
      title={`Tag 保留执行 #${String(execution.id)}`}
      subtitle={project}
      submitLabel="关闭"
      submitIcon="x"
      showCancel={false}
      dialogClass="control-dialog-wide"
      initialFocusSelector={null}
      onClose={onClose}
      onSubmit={() => Promise.resolve(onClose())}
    >
      {loading ? (
        <DialogLoading message="正在载入 Tag 保留任务..." />
      ) : error ? (
        <ErrorView title="Tag 保留任务载入失败" message={error} />
      ) : (
        <>
          <ExecutionSummary
            status={execution.status}
            details={[
              t(execution.dry_run ? "仅演练" : "正式执行"),
              formatDate(execution.start_time, locale),
            ]}
            stats={[
              { label: "仓库任务", value: pagination.total },
              { label: "匹配 Tag", value: metrics.total },
              { label: "保留 Tag", value: metrics.retained, tone: "success" },
              { label: "清理 Tag", value: metrics.cleanup },
              { label: "失败", value: metrics.failed, tone: "danger" },
              { label: "进行中", value: metrics.running },
            ]}
          />
          <ExecutionSection
            title="仓库处理结果"
            summary={
              locale === "en-US"
                ? `${formatNumber(pagination.total, locale)} items`
                : `共 ${formatNumber(pagination.total, locale)} 项`
            }
          >
            <div className="table-scroll replication-task-table">
              {!tasks.length ? (
                <EmptyState
                  title="暂无仓库任务"
                  description="该执行记录还没有返回仓库处理结果。"
                  icon="history"
                />
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>{t("仓库")}</th>
                      <th>{t("匹配 Tag")}</th>
                      <th>{t("保留")}</th>
                      <th>{t("清理")}</th>
                      <th>{t("状态码")}</th>
                      <th>{t("状态")}</th>
                      <th className="table-cell-time">{t("耗时")}</th>
                      <th>{t("日志")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map((task, taskIndex) => (
                      <tr
                        key={`${String(task.id)}-${String(task.repository ?? taskIndex)}`}
                      >
                        <td>
                          <div className="cell-title">
                            <strong>{displayText(task.repository)}</strong>
                          </div>
                        </td>
                        <td>{formatNumber(task.total, locale)}</td>
                        <td className="success-text">
                          {formatNumber(task.retained, locale)}
                        </td>
                        <td>
                          {formatNumber(
                            Math.max(
                              0,
                              (task.total ?? 0) - (task.retained ?? 0),
                            ),
                            locale,
                          )}
                        </td>
                        <td className="mono">{task.status_code ?? "-"}</td>
                        <td>
                          <StatusBadge status={task.status} />
                        </td>
                        <td>
                          {formatDuration(
                            task.start_time,
                            task.end_time,
                            locale,
                          )}
                        </td>
                        <td>
                          <button
                            className="icon-button"
                            type="button"
                            title={t("查看日志")}
                            aria-label={t("查看 Tag 保留任务日志")}
                            onClick={() => void taskLog.open(task)}
                          >
                            <Icon name="history" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <DialogPagination pagination={pagination} onPageChange={setPage} />
          </ExecutionSection>
          <TaskLogPanel
            log={taskLog}
            executionId={execution.id}
            fileName={`harbor-retention-${String(execution.id)}-${String(taskLog.task?.id ?? "")}.log`}
            labels={{
              refresh: "刷新 Tag 保留任务日志",
              copy: "复制 Tag 保留任务日志",
              download: "下载 Tag 保留任务日志",
              close: "关闭 Tag 保留任务日志",
              empty: "Harbor 没有返回 Tag 保留任务日志。",
              nothingToDownload: "当前没有可下载的 Tag 保留任务日志",
              downloaded: "Tag 保留任务日志已下载",
            }}
            onNotice={onNotice}
          />
        </>
      )}
    </ControlDialog>
  );
}
