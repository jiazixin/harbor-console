import { useState } from "react";
import { useLocale } from "../../app/locale-context";
import type {
  HarborSelector,
  RetentionMetadata,
  RetentionRule,
} from "../../app/models";
import { FormInput } from "../../components/form-input";
import uiStyles0 from "../../components/shared-ui.module.css";
import { UnifiedSelect } from "../../components/unified-select";
import { createClassNames } from "../../lib/css/class-names";
import { decodeJson, objectSchema } from "../../lib/json/decode-json";
import { artifactKeys } from "../artifacts/public";
import { repositoryKeys } from "../repositories/public";
import { projectKeys } from "./project-keys";
import {
  fallbackRetentionTemplates,
  retentionTemplateOptionLabel,
  selectorDecorationLabel,
} from "./rule-labels";

export const affectedQueries = [
  projectKeys.all,
  repositoryKeys.all,
  artifactKeys.all,
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

function selectorExtras(value: string | undefined): Record<string, unknown> {
  return decodeJson(value || {}, objectSchema);
}

export function retentionPolicySubtitle(
  translate: (source: string) => string,
  policyId: number,
): string {
  return `${translate("策略")} #${String(policyId)}`;
}

type RetentionRuleEditor = ReturnType<typeof useRetentionRuleEditor>;

export function useRetentionRuleEditor(
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

export function retentionRulePayload(
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

export function retentionPolicyPayload({
  projectId,
  rules,
  algorithm,
  cron,
}: {
  projectId: number;
  rules: RetentionRule[];
  algorithm: string | undefined;
  cron: string | undefined;
}) {
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

type RetentionRuleFieldsProps = {
  editor: RetentionRuleEditor;
  cron?: string;
  onCronChange?: (value: string) => void;
};

export function RetentionRuleFields({
  editor,
  cron,
  onCronChange,
}: RetentionRuleFieldsProps) {
  const { t } = useLocale();
  return (
    <>
      <div className={resolveClasses("form-grid two-columns")}>
        <label className={resolveClasses("field field-span")}>
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
        <label className={resolveClasses("field")}>
          <span>{t("数量或天数")}</span>
          <FormInput
            name="amount"
            type="number"
            min={1}
            max={1_000_000}
            step={1}
            required
            disabled={editor.template === "always"}
            value={editor.amount}
            onChange={(event) => {
              editor.setAmount(Number(event.currentTarget.value));
            }}
          />
        </label>
        <label className={resolveClasses("field")}>
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
        <label className={resolveClasses("field")}>
          <span>{t("仓库匹配")}</span>
          <FormInput
            name="repository_pattern"
            required
            maxLength={1024}
            value={editor.repositoryPattern}
            placeholder={t("例如 release/**")}
            onChange={(event) => {
              editor.setRepositoryPattern(event.currentTarget.value);
            }}
          />
        </label>
        <label className={resolveClasses("field")}>
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
        <label className={resolveClasses("field")}>
          <span>{t("Tag 匹配")}</span>
          <FormInput
            name="tag_pattern"
            required
            maxLength={1024}
            value={editor.tagPattern}
            placeholder={t("例如 v*")}
            onChange={(event) => {
              editor.setTagPattern(event.currentTarget.value);
            }}
          />
        </label>
        {onCronChange ? (
          <label className={resolveClasses("field field-span")}>
            <span>{t("执行计划 Cron")}</span>
            <FormInput
              name="cron"
              maxLength={255}
              value={cron}
              placeholder={t("留空表示仅手动执行")}
              onChange={(event) => {
                onCronChange(event.currentTarget.value);
              }}
            />
            <small className={resolveClasses("field-help")}>
              {t("Harbor 使用含秒字段的 Cron 表达式。")}
            </small>
          </label>
        ) : null}
      </div>
      <label className={resolveClasses("check-row")}>
        <FormInput
          name="untagged"
          type="checkbox"
          checked={editor.includeUntagged}
          onChange={(event) => {
            editor.setIncludeUntagged(event.currentTarget.checked);
          }}
        />
        <span>
          <strong>{t("包含无 Tag 制品")}</strong>
          <small>{t("将未标记制品纳入该规则")}</small>
        </span>
      </label>
      <label className={resolveClasses("check-row")}>
        <FormInput
          name="disabled"
          type="checkbox"
          checked={editor.disabled}
          onChange={(event) => {
            editor.setDisabled(event.currentTarget.checked);
          }}
        />
        <span>
          <strong>{t("暂时停用规则")}</strong>
          <small>{t("保留规则配置，但执行时跳过")}</small>
        </span>
      </label>
    </>
  );
}

const resolveClasses = createClassNames({
  "unified-select": uiStyles0.unifiedSelect,
  tag: uiStyles0.tag,
  "form-grid": uiStyles0.formGrid,
  "two-columns": uiStyles0.twoColumns,
  field: uiStyles0.field,
  "field-span": uiStyles0.fieldSpan,
  "field-help": uiStyles0.fieldHelp,
  "check-row": uiStyles0.checkRow,
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
