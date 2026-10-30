import { useState } from "react";
import { useLocale } from "../../app/locale-context";
import type {
  HarborSelector,
  ImmutableTagRule,
  RetentionMetadata,
} from "../../app/models";
import { useControlMutation } from "../../app/use-control-mutation";
import { ControlDialog } from "../../components/control-dialog";
import { FormInput } from "../../components/form-input";
import uiStyles0 from "../../components/shared-ui.module.css";
import { UnifiedSelect } from "../../components/unified-select";
import { createClassNames } from "../../lib/css/class-names";
import { affectedQueries } from "./project-rule-dialogs-support";
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
  return (() => {
    if (values.length) {
      return values;
    }
    if (type === "repository") {
      return fallbackRepositoryDecorations;
    }
    return fallbackTagDecorations;
  })();
}

type ImmutableTagRuleDialogProps = {
  project: string;
  rule?: ImmutableTagRule;
  metadata: RetentionMetadata;
  onClose: () => void;
  onSaved: () => void;
};

export function ImmutableTagRuleDialog({
  project,
  rule,
  metadata,
  onClose,
  onSaved,
}: ImmutableTagRuleDialogProps) {
  const mutate = useControlMutation(affectedQueries);
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
        await mutate({
          operation: rule ? "immutable-rule" : "immutable-rules",
          parameters: rule ? { project, id: rule.id } : { project },
          method: rule ? "PUT" : "POST",
          payload: payload,
        });
        onSaved();
      }}
    >
      <div className={resolveClasses("form-grid")}>
        <label className={resolveClasses("field")}>
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
        <label className={resolveClasses("field")}>
          <span>{t("仓库匹配")}</span>
          <FormInput
            name="repository_pattern"
            required
            maxLength={1024}
            value={repositoryPattern}
            placeholder={t("例如 release/**")}
            onChange={(event) => {
              setRepositoryPattern(event.currentTarget.value);
            }}
          />
        </label>
        <label className={resolveClasses("field")}>
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
        <label className={resolveClasses("field")}>
          <span>{t("Tag 匹配")}</span>
          <FormInput
            name="tag_pattern"
            required
            maxLength={1024}
            value={tagPattern}
            placeholder={t("例如 v*")}
            onChange={(event) => {
              setTagPattern(event.currentTarget.value);
            }}
          />
        </label>
        <label className={resolveClasses("check-row")}>
          <FormInput
            name="disabled"
            type="checkbox"
            checked={disabled}
            onChange={(event) => {
              setDisabled(event.currentTarget.checked);
            }}
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

const resolveClasses = createClassNames({
  "control-dialog": uiStyles0.controlDialog,
  "unified-select": uiStyles0.unifiedSelect,
  tag: uiStyles0.tag,
  "form-grid": uiStyles0.formGrid,
  field: uiStyles0.field,
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
