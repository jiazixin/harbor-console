import { useState } from "react";

import { controlApi } from "../../app/api-client";
import { useLocale } from "../../app/locale-context";
import type {
  HarborSelector,
  ImmutableTagRule,
  ProjectLabel,
  RetentionMetadata,
} from "../../app/models";
import { ControlDialog } from "../../components/control-dialog";
import { Icon } from "../../components/icons";
import { UnifiedSelect } from "../../components/unified-select";
import { selectorDecorationLabel } from "./rule-labels";

const fallbackRepositoryDecorations = ["repoMatches", "repoExcludes"];
const fallbackTagDecorations = ["matches", "excludes"];

function firstSelector(selectors: HarborSelector[] | undefined) {
  return selectors?.[0];
}

function selectorDecorations(
  metadata: RetentionMetadata,
  type: "repository" | "tag",
): string[] {
  const values =
    (type === "repository"
      ? metadata.scope_selectors
      : metadata.tag_selectors)?.[0]?.decorations ?? [];
  return values.length
    ? values
    : type === "repository"
      ? fallbackRepositoryDecorations
      : fallbackTagDecorations;
}

function safeLabelColor(value: string | undefined): string {
  return /^#[0-9a-f]{6}$/i.test(value ?? "") ? String(value) : "#f48120";
}

export function ImmutableTagRuleDialog({
  project,
  rule,
  metadata,
  onClose,
  onSaved,
}: {
  project: string;
  rule?: ImmutableTagRule;
  metadata: RetentionMetadata;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useLocale();
  const repository = firstSelector(rule?.scope_selectors?.repository);
  const tag = firstSelector(rule?.tag_selectors);
  const repositoryDecorations = selectorDecorations(metadata, "repository");
  const tagDecorations = selectorDecorations(metadata, "tag");
  const [repositoryDecoration, setRepositoryDecoration] = useState(
    repository?.decoration ?? repositoryDecorations.at(0) ?? "repoMatches",
  );
  const [repositoryPattern, setRepositoryPattern] = useState(
    repository?.pattern ?? "**",
  );
  const [tagDecoration, setTagDecoration] = useState(
    tag?.decoration ?? tagDecorations.at(0) ?? "matches",
  );
  const [tagPattern, setTagPattern] = useState(tag?.pattern ?? "release-*");
  const [disabled, setDisabled] = useState(rule?.disabled === true);

  return (
    <ControlDialog
      title={rule ? "编辑不可变 Tag 规则" : "新建不可变 Tag 规则"}
      subtitle={project}
      submitLabel={rule ? "保存规则" : "创建规则"}
      onClose={onClose}
      onSubmit={async () => {
        const payload = {
          ...(rule?.priority === undefined ? {} : { priority: rule.priority }),
          disabled,
          action: rule?.action ?? "immutable",
          template: rule?.template ?? "immutable_template",
          params: rule?.params ?? {},
          tag_selectors: [
            {
              kind: "doublestar",
              decoration: tagDecoration,
              pattern: tagPattern.trim(),
            },
          ],
          scope_selectors: {
            repository: [
              {
                kind: "doublestar",
                decoration: repositoryDecoration,
                pattern: repositoryPattern.trim(),
              },
            ],
          },
        };
        await controlApi.mutate(
          rule ? "immutable-rule" : "immutable-rules",
          rule ? { project, id: rule.id } : { project },
          rule ? "PUT" : "POST",
          payload,
        );
        onSaved();
      }}
    >
      <div className="form-grid">
        <label className="field">
          <span>{t("仓库条件")}</span>
          <UnifiedSelect
            ariaLabel={t("仓库条件")}
            name="repository_decoration"
            value={repositoryDecoration}
            options={repositoryDecorations.map((value) => ({
              value,
              label: t(selectorDecorationLabel(value)),
            }))}
            onChange={setRepositoryDecoration}
          />
        </label>
        <label className="field">
          <span>{t("仓库匹配")}</span>
          <input
            name="repository_pattern"
            required
            maxLength={1024}
            value={repositoryPattern}
            placeholder={t("例如 release/**")}
            onChange={(event) =>
              setRepositoryPattern(event.currentTarget.value)
            }
          />
        </label>
        <label className="field">
          <span>{t("Tag 条件")}</span>
          <UnifiedSelect
            ariaLabel={t("Tag 条件")}
            name="tag_decoration"
            value={tagDecoration}
            options={tagDecorations.map((value) => ({
              value,
              label: t(selectorDecorationLabel(value)),
            }))}
            onChange={setTagDecoration}
          />
        </label>
        <label className="field">
          <span>{t("Tag 匹配")}</span>
          <input
            name="tag_pattern"
            required
            maxLength={1024}
            value={tagPattern}
            placeholder={t("例如 v*")}
            onChange={(event) => setTagPattern(event.currentTarget.value)}
          />
        </label>
        <label className="check-row">
          <input
            name="disabled"
            type="checkbox"
            checked={disabled}
            onChange={(event) => setDisabled(event.currentTarget.checked)}
          />
          <span>
            <strong>{t("暂时停用规则")}</strong>
            <small>{t("保留规则但不限制 Tag")}</small>
          </span>
        </label>
      </div>
    </ControlDialog>
  );
}

export function DeleteImmutableTagRuleDialog({
  project,
  rule,
  onClose,
  onDeleted,
}: {
  project: string;
  rule: ImmutableTagRule;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { t } = useLocale();
  return (
    <ControlDialog
      title="删除不可变 Tag 规则"
      subtitle="匹配该规则的 Tag 将恢复为可修改状态。"
      submitLabel="删除规则"
      destructive
      onClose={onClose}
      onSubmit={async () => {
        await controlApi.mutate(
          "immutable-rule",
          { project, id: rule.id },
          "DELETE",
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

export function ProjectLabelDialog({
  project,
  projectId,
  label,
  onClose,
  onSaved,
}: {
  project: string;
  projectId: number;
  label?: ProjectLabel;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useLocale();
  const [name, setName] = useState(label?.name ?? "");
  const [description, setDescription] = useState(label?.description ?? "");
  const [color, setColor] = useState(safeLabelColor(label?.color));
  return (
    <ControlDialog
      title={label ? "编辑项目标签" : "新建项目标签"}
      subtitle={project}
      submitLabel={label ? "保存标签" : "创建标签"}
      onClose={onClose}
      onSubmit={async () => {
        const payload = {
          name: name.trim(),
          description: description.trim(),
          color,
          scope: "p",
          project_id: projectId,
        };
        await controlApi.mutate(
          label ? "label" : "labels",
          label ? { id: label.id } : {},
          label ? "PUT" : "POST",
          payload,
        );
        onSaved();
      }}
    >
      <div className="form-grid">
        <label className="field">
          <span>{t("标签名称")}</span>
          <input
            name="name"
            required
            maxLength={128}
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
          />
        </label>
        <label className="field">
          <span>{t("标签颜色")}</span>
          <input
            name="color"
            type="color"
            value={color}
            onChange={(event) => setColor(event.currentTarget.value)}
          />
        </label>
        <label className="field">
          <span>{t("描述")}</span>
          <textarea
            name="description"
            rows={3}
            maxLength={1024}
            value={description}
            onChange={(event) => setDescription(event.currentTarget.value)}
          />
        </label>
      </div>
    </ControlDialog>
  );
}

export function DeleteProjectLabelDialog({
  label,
  onClose,
  onDeleted,
}: {
  label: ProjectLabel;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { locale, t } = useLocale();
  const subtitle =
    locale === "en-US"
      ? `Label ${label.name} will be removed from the project.`
      : `标签 ${label.name} 将从项目中删除。`;
  return (
    <ControlDialog
      title="删除项目标签"
      subtitle={subtitle}
      submitLabel="删除标签"
      destructive
      onClose={onClose}
      onSubmit={async () => {
        await controlApi.mutate("label", { id: label.id }, "DELETE");
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
