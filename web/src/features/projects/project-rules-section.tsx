import { useLocale } from "../../app/locale-context";
import type {
  HarborSelector,
  ImmutableTagRule,
  ProjectLabel,
  RetentionMetadata,
} from "../../app/models";
import { displayTimeZone } from "../../app/preferences";
import { EmptyState } from "../../components/empty-state";
import { Icon } from "../../components/icon";
import { OverflowText } from "../../components/overflow-text";
import uiStyles0 from "../../components/shared-ui.module.css";
import { createClassNames } from "../../lib/css/class-names";
import { formatDate, formatNumber } from "../../lib/format/formatters";
import styles from "./projects.module.css";

function firstSelector(selectors: HarborSelector[] | undefined) {
  return selectors?.[0];
}

function safeLabelColor(value: string | undefined): string {
  return /^#[0-9a-f]{6}$/i.test(value ?? "") ? String(value) : "#7b7b82";
}

type LabelSwatchProps = { color: string | undefined };

function LabelSwatch({ color }: LabelSwatchProps) {
  return (
    <svg
      className={resolveClasses("label-swatch")}
      viewBox="0 0 12 12"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="12" height="12" rx="3" fill={safeLabelColor(color)} />
    </svg>
  );
}

type ProjectRulesSectionProps = {
  project: string;
  projectId: number;
  rules: ImmutableTagRule[];
  labels: ProjectLabel[];
  metadata: RetentionMetadata;
  onCreateRule: (project: string, metadata: RetentionMetadata) => void;
  onEditRule: (
    project: string,
    rule: ImmutableTagRule,
    metadata: RetentionMetadata,
  ) => void;
  onDeleteRule: (project: string, rule: ImmutableTagRule) => void;
  onCreateLabel: (project: string, projectId: number) => void;
  onEditLabel: (
    project: string,
    projectId: number,
    label: ProjectLabel,
  ) => void;
  onDeleteLabel: (label: ProjectLabel) => void;
};

export function ProjectRulesSection({
  project,
  projectId,
  rules,
  labels,
  metadata,
  onCreateRule,
  onEditRule,
  onDeleteRule,
  onCreateLabel,
  onEditLabel,
  onDeleteLabel,
}: ProjectRulesSectionProps) {
  const { locale, t } = useLocale();
  const metadataAvailable =
    !metadata.load_error &&
    Boolean(metadata.scope_selectors?.length) &&
    Boolean(metadata.tag_selectors?.length);
  return (
    <div className={resolveClasses(styles.rulesLayout)}>
      <section>
        <div className={resolveClasses("section-heading")}>
          <div>
            <h2>{t("不可变 Tag 规则")}</h2>
            <p>
              {formatNumber(rules.length, locale)} {t("条规则")}
            </p>
          </div>
          <button
            className={resolveClasses("button button-small button-primary")}
            type="button"
            disabled={!metadataAvailable}
            onClick={() => {
              onCreateRule(project, metadata);
            }}
          >
            <Icon name="plus" />
            <span>{t("新建规则")}</span>
          </button>
        </div>
        {!metadataAvailable ? (
          <p className={resolveClasses("notice notice-warning")}>
            {metadata.load_error ??
              t(
                "当前 Harbor 实例未提供 selector metadata，不可变规则编辑已禁用。",
              )}
          </p>
        ) : null}
        <div className={resolveClasses("table-shell")}>
          <div className={resolveClasses("table-scroll")}>
            {!rules.length ? (
              <EmptyState
                title="暂无不可变规则"
                description="创建规则后，匹配的 Tag 将禁止覆盖或删除。"
                icon="shield"
              />
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>{t("仓库范围")}</th>
                    <th>{t("Tag 范围")}</th>
                    <th>{t("状态")}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rules.map((rule) => {
                    const repository = firstSelector(
                      rule.scope_selectors?.repository,
                    );
                    const tag = firstSelector(rule.tag_selectors);
                    return (
                      <tr key={rule.id}>
                        <td>
                          <OverflowText as="code">
                            {repository?.pattern ?? "**"}
                          </OverflowText>
                        </td>
                        <td>
                          <OverflowText as="code">
                            {tag?.pattern ?? "**"}
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
                              title={t("编辑规则")}
                              aria-label={t("编辑规则")}
                              onClick={() => {
                                onEditRule(project, rule, metadata);
                              }}
                            >
                              <Icon name="edit" />
                            </button>
                            <button
                              className={resolveClasses(
                                "icon-button danger-icon",
                              )}
                              type="button"
                              title={t("删除规则")}
                              aria-label={t("删除规则")}
                              onClick={() => {
                                onDeleteRule(project, rule);
                              }}
                            >
                              <Icon name="trash" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </section>
      <section>
        <div className={resolveClasses("section-heading")}>
          <div>
            <h2>{t("项目标签")}</h2>
            <p>
              {formatNumber(labels.length, locale)} {t("个标签")}
            </p>
          </div>
          <button
            className={resolveClasses("button button-small button-primary")}
            type="button"
            onClick={() => {
              onCreateLabel(project, projectId);
            }}
          >
            <Icon name="plus" />
            <span>{t("新建标签")}</span>
          </button>
        </div>
        <div className={resolveClasses("table-shell")}>
          <div className={resolveClasses("table-scroll")}>
            {!labels.length ? (
              <EmptyState
                title="暂无项目标签"
                description="标签可用于标记和筛选制品。"
                icon="tag"
              />
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>{t("标签")}</th>
                    <th>{t("描述")}</th>
                    <th className={resolveClasses("table-cell-time")}>
                      {t("最近更新")}
                    </th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {labels.map((label) => (
                    <tr key={label.id}>
                      <td>
                        <div className={resolveClasses("cell-title")}>
                          <LabelSwatch color={label.color} />
                          <OverflowText as="strong">
                            {t(label.name)}
                          </OverflowText>
                        </div>
                      </td>
                      <td>
                        <OverflowText>
                          {label.description ? t(label.description) : "-"}
                        </OverflowText>
                      </td>
                      <td className={resolveClasses("table-cell-time")}>
                        {formatDate(label.update_time ?? label.creation_time, {
                          locale: locale,
                          timeZone: displayTimeZone(),
                        })}
                      </td>
                      <td>
                        <div className={resolveClasses("row-actions")}>
                          <button
                            className={resolveClasses("icon-button")}
                            type="button"
                            title={t("编辑标签")}
                            aria-label={t("编辑标签")}
                            onClick={() => {
                              onEditLabel(project, projectId, label);
                            }}
                          >
                            <Icon name="edit" />
                          </button>
                          <button
                            className={resolveClasses(
                              "icon-button danger-icon",
                            )}
                            type="button"
                            title={t("删除标签")}
                            aria-label={t("删除标签")}
                            onClick={() => {
                              onDeleteLabel(label);
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
        </div>
      </section>
    </div>
  );
}

const resolveClasses = createClassNames({
  "empty-state": uiStyles0.emptyState,
  icon: uiStyles0.icon,
  "overflow-text": uiStyles0.overflowText,
  "label-swatch": uiStyles0.labelSwatch,
  "section-heading": uiStyles0.sectionHeading,
  button: uiStyles0.button,
  "button-small": uiStyles0.buttonSmall,
  "button-primary": uiStyles0.buttonPrimary,
  notice: uiStyles0.notice,
  "notice-warning": uiStyles0.noticeWarning,
  "table-shell": uiStyles0.tableShell,
  "table-scroll": uiStyles0.tableScroll,
  badge: uiStyles0.badge,
  "badge-green": uiStyles0.badgeGreen,
  "row-actions": uiStyles0.rowActions,
  "icon-button": uiStyles0.iconButton,
  "danger-icon": uiStyles0.dangerIcon,
  tag: uiStyles0.tag,
  "table-cell-time": uiStyles0.tableCellTime,
  "cell-title": uiStyles0.cellTitle,
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
