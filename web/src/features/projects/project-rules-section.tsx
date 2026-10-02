import { formatDate, formatNumber } from "../../app/formatters";
import { useLocale } from "../../app/locale-context";
import type {
  HarborSelector,
  ImmutableTagRule,
  ProjectLabel,
  RetentionMetadata,
} from "../../app/models";
import { Icon } from "../../components/icons";
import { OverflowText } from "../../components/overflow-text";

function firstSelector(selectors: HarborSelector[] | undefined) {
  return selectors?.[0];
}

function safeLabelColor(value: string | undefined): string {
  return /^#[0-9a-f]{6}$/i.test(value ?? "") ? String(value) : "#7b7b82";
}

function LabelSwatch({ color }: { color: string | undefined }) {
  return (
    <svg
      className="label-swatch"
      viewBox="0 0 12 12"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="12" height="12" rx="3" fill={safeLabelColor(color)} />
    </svg>
  );
}

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
}: {
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
}) {
  const { locale, t } = useLocale();
  const metadataAvailable =
    !metadata.load_error &&
    Boolean(metadata.scope_selectors?.length) &&
    Boolean(metadata.tag_selectors?.length);
  return (
    <div className="rules-layout">
      <section>
        <div className="section-heading">
          <div>
            <h2>{t("不可变 Tag 规则")}</h2>
            <p>
              {formatNumber(rules.length, locale)} {t("条规则")}
            </p>
          </div>
          <button
            className="button button-small button-primary"
            type="button"
            disabled={!metadataAvailable}
            onClick={() => onCreateRule(project, metadata)}
          >
            <Icon name="plus" />
            <span>{t("新建规则")}</span>
          </button>
        </div>
        {!metadataAvailable ? (
          <p className="section-notice warning-notice">
            {metadata.load_error ??
              t(
                "当前 Harbor 实例未提供 selector metadata，不可变规则编辑已禁用。",
              )}
          </p>
        ) : null}
        <div className="table-shell">
          <div className="table-scroll">
            {!rules.length ? (
              <div className="empty-table">
                <strong>{t("暂无不可变规则")}</strong>
                <span>{t("创建规则后，匹配的 Tag 将禁止覆盖或删除。")}</span>
              </div>
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
                              title={t("编辑规则")}
                              aria-label={t("编辑规则")}
                              onClick={() =>
                                onEditRule(project, rule, metadata)
                              }
                            >
                              <Icon name="edit" />
                            </button>
                            <button
                              className="icon-button danger-icon"
                              type="button"
                              title={t("删除规则")}
                              aria-label={t("删除规则")}
                              onClick={() => onDeleteRule(project, rule)}
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
        <div className="section-heading">
          <div>
            <h2>{t("项目标签")}</h2>
            <p>
              {formatNumber(labels.length, locale)} {t("个标签")}
            </p>
          </div>
          <button
            className="button button-small button-primary"
            type="button"
            onClick={() => onCreateLabel(project, projectId)}
          >
            <Icon name="plus" />
            <span>{t("新建标签")}</span>
          </button>
        </div>
        <div className="table-shell">
          <div className="table-scroll">
            {!labels.length ? (
              <div className="empty-table">
                <strong>{t("暂无项目标签")}</strong>
                <span>{t("标签可用于标记和筛选制品。")}</span>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>{t("标签")}</th>
                    <th>{t("描述")}</th>
                    <th className="table-cell-time">{t("最近更新")}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {labels.map((label) => (
                    <tr key={label.id}>
                      <td>
                        <div className="cell-title">
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
                      <td className="table-cell-time">
                        {formatDate(
                          label.update_time ?? label.creation_time,
                          locale,
                        )}
                      </td>
                      <td>
                        <div className="row-actions">
                          <button
                            className="icon-button"
                            type="button"
                            title={t("编辑标签")}
                            aria-label={t("编辑标签")}
                            onClick={() =>
                              onEditLabel(project, projectId, label)
                            }
                          >
                            <Icon name="edit" />
                          </button>
                          <button
                            className="icon-button danger-icon"
                            type="button"
                            title={t("删除标签")}
                            aria-label={t("删除标签")}
                            onClick={() => onDeleteLabel(label)}
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
