import { useEffect, useMemo, useRef, useState } from "react";

import { controlApi } from "../../app/api-client";
import { downloadText } from "../../app/download-text";
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
import { DialogPagination } from "../../components/dialog-pagination";
import { Icon } from "../../components/icons";
import {
  LogTimezoneControl,
  StructuredLog,
  type LogTimezone,
} from "../../components/structured-log";
import { StatusBadge } from "../../components/status-badge";
import { UnifiedSelect } from "../../components/unified-select";

const fallbackTemplates = [
  { value: "latestPushedK", label: "保留最近推送的制品" },
  { value: "latestPulledN", label: "保留最近拉取的制品" },
  { value: "nDaysSinceLastPush", label: "保留最近推送天数内的制品" },
  { value: "nDaysSinceLastPull", label: "保留最近拉取天数内的制品" },
  { value: "always", label: "永久保留全部匹配制品" },
];
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
      ?.map((template) => ({
        value: template.rule_template?.trim() ?? "",
        label:
          template.display_text?.trim() ?? template.rule_template?.trim() ?? "",
      }))
      .filter((template) => template.value) ?? [];
  return candidates.length ? candidates : fallbackTemplates;
}

function retentionTemplateLabel(template: string | undefined): string {
  return (
    {
      latestPushedK: "最近推送",
      latestPulledN: "最近拉取",
      nDaysSinceLastPush: "推送时间范围",
      nDaysSinceLastPull: "拉取时间范围",
      always: "永久保留",
    }[template ?? ""] ?? "保留规则"
  );
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
              label: value,
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
              label: value,
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
  const label = retentionTemplateLabel(rule.template);
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
      <div className="destructive-message">
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
      <div className="destructive-message">
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
      <div className={dryRun ? "info-banner" : "destructive-message"}>
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
      <div className="destructive-message">
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
  const requestVersion = useRef(0);
  const logController = useRef<AbortController | undefined>(undefined);
  const logViewRef = useRef<HTMLElement>(null);
  const [page, setPage] = useState(1);
  const [tasks, setTasks] = useState<RetentionTask[]>([]);
  const [pagination, setPagination] = useState(emptyPagination);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedTask, setSelectedTask] = useState<RetentionTask>();
  const [taskLog, setTaskLog] = useState("");
  const [logLoading, setLogLoading] = useState(false);
  const [timezone, setTimezone] = useState<LogTimezone>("local");

  useEffect(
    () => () => {
      requestVersion.current += 1;
      logController.current?.abort();
    },
    [],
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

  useEffect(() => {
    if (!selectedTask || logLoading) return;
    logViewRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
    logViewRef.current?.focus({ preventScroll: true });
  }, [logLoading, selectedTask]);

  async function loadTaskLog(task: RetentionTask) {
    logController.current?.abort();
    const controller = new AbortController();
    logController.current = controller;
    const version = requestVersion.current + 1;
    requestVersion.current = version;
    setSelectedTask(task);
    setLogLoading(true);
    try {
      const value = await controlApi.data<string>(
        "retention-task-log",
        { id: policy.id, eid: execution.id, tid: task.id },
        controller.signal,
      );
      if (requestVersion.current === version) setTaskLog(value ?? "");
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === "AbortError")
        return;
      if (requestVersion.current === version) {
        setTaskLog(
          loadError instanceof Error ? loadError.message : String(loadError),
        );
      }
    } finally {
      if (requestVersion.current === version) setLogLoading(false);
    }
  }

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
        <div className="dialog-loading" role="status">
          <span className="spinner" />
          <span>{t("正在载入 Tag 保留任务...")}</span>
        </div>
      ) : error ? (
        <div className="empty-table permission-table">
          <strong>{t("Tag 保留任务载入失败")}</strong>
          <span>{error}</span>
        </div>
      ) : (
        <>
          <section className="execution-summary">
            <div className="execution-summary-head">
              <div>
                <StatusBadge status={execution.status} />
                <span>{t(execution.dry_run ? "仅演练" : "正式执行")}</span>
                <span>{formatDate(execution.start_time, locale)}</span>
              </div>
            </div>
            <dl className="execution-stats">
              {[
                { label: "仓库任务", value: pagination.total },
                { label: "匹配 Tag", value: metrics.total },
                {
                  label: "保留 Tag",
                  value: metrics.retained,
                  className: "success-text",
                },
                { label: "清理 Tag", value: metrics.cleanup },
                {
                  label: "失败",
                  value: metrics.failed,
                  className: "danger-text",
                },
                { label: "进行中", value: metrics.running },
              ].map(({ label, value, className }) => (
                <div key={label}>
                  <dt>{t(label)}</dt>
                  <dd className={className}>{formatNumber(value, locale)}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section className="replication-task-section">
            <div className="section-heading compact-heading">
              <div>
                <h3>{t("仓库处理结果")}</h3>
                <p>
                  {locale === "en-US"
                    ? `${formatNumber(pagination.total, locale)} items`
                    : `共 ${formatNumber(pagination.total, locale)} 项`}
                </p>
              </div>
            </div>
            <div className="table-scroll replication-task-table">
              {!tasks.length ? (
                <div className="empty-table">
                  <strong>{t("暂无仓库任务")}</strong>
                  <span>{t("该执行记录还没有返回仓库处理结果。")}</span>
                </div>
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
                      <th>{t("耗时")}</th>
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
                            onClick={() => void loadTaskLog(task)}
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
          </section>
          {selectedTask ? (
            <section
              ref={logViewRef}
              className="replication-log-view"
              tabIndex={-1}
            >
              <header>
                <div>
                  <h3>{t("任务日志")}</h3>
                  <p>
                    {locale === "en-US"
                      ? `Execution #${String(execution.id)} · Task #${String(selectedTask.id)}`
                      : `执行 #${String(execution.id)} · 任务 #${String(selectedTask.id)}`}
                  </p>
                </div>
                <div className="log-view-actions">
                  <span>
                    {logLoading
                      ? t("正在读取")
                      : locale === "en-US"
                        ? `${formatNumber(taskLog.length, locale)} characters`
                        : `${formatNumber(taskLog.length, locale)} 字符`}
                  </span>
                  <LogTimezoneControl value={timezone} onChange={setTimezone} />
                  <button
                    className="icon-button"
                    type="button"
                    title={t("刷新日志")}
                    aria-label={t("刷新 Tag 保留任务日志")}
                    onClick={() => void loadTaskLog(selectedTask)}
                  >
                    <Icon name="refresh" />
                  </button>
                  <button
                    className="icon-button"
                    type="button"
                    title={t("复制日志")}
                    aria-label={t("复制 Tag 保留任务日志")}
                    onClick={() =>
                      void navigator.clipboard
                        .writeText(taskLog)
                        .then(() => onNotice("已复制到剪贴板"))
                        .catch(() => onNotice("无法写入剪贴板", true))
                    }
                  >
                    <Icon name="copy" />
                  </button>
                  <button
                    className="icon-button"
                    type="button"
                    title={t("下载日志")}
                    aria-label={t("下载 Tag 保留任务日志")}
                    onClick={() => {
                      if (!taskLog) {
                        onNotice("当前没有可下载的 Tag 保留任务日志", true);
                        return;
                      }
                      downloadText(
                        taskLog,
                        `harbor-retention-${String(execution.id)}-${String(selectedTask.id)}.log`,
                      );
                      onNotice("Tag 保留任务日志已下载");
                    }}
                  >
                    <Icon name="download" />
                  </button>
                  <button
                    className="icon-button"
                    type="button"
                    title={t("关闭日志")}
                    aria-label={t("关闭 Tag 保留任务日志")}
                    onClick={() => {
                      requestVersion.current += 1;
                      logController.current?.abort();
                      setSelectedTask(undefined);
                      setTaskLog("");
                    }}
                  >
                    <Icon name="x" />
                  </button>
                </div>
              </header>
              <StructuredLog
                value={taskLog}
                timezone={timezone}
                emptyMessage="Harbor 没有返回 Tag 保留任务日志。"
              />
            </section>
          ) : null}
        </>
      )}
    </ControlDialog>
  );
}
