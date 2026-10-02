import { formatDate, formatNumber } from "../../app/formatters";
import { useLocale } from "../../app/locale-context";
import type { ControlPagination, ProjectWebhook } from "../../app/models";
import { Pagination } from "../../components/data-table";
import { Icon } from "../../components/icons";
import { OverflowText } from "../../components/overflow-text";

function webhookTarget(webhook: ProjectWebhook) {
  return webhook.targets?.[0];
}

export function ProjectWebhooksSection({
  project,
  webhooks,
  pagination,
  onPageChange,
  onCreate,
  onEdit,
  onHistory,
  onDelete,
}: {
  project: string;
  webhooks: ProjectWebhook[];
  pagination: ControlPagination;
  onPageChange: (page: number) => void;
  onCreate: (project: string) => void;
  onEdit: (project: string, webhook: ProjectWebhook) => void;
  onHistory: (project: string, webhook: ProjectWebhook) => void;
  onDelete: (project: string, webhook: ProjectWebhook) => void;
}) {
  const { locale, t } = useLocale();
  return (
    <section className="table-shell">
      <div className="table-toolbar">
        <strong>{t("Webhook 策略")}</strong>
        <div className="toolbar-spacer" />
        <button
          className="button button-small button-primary"
          type="button"
          onClick={() => onCreate(project)}
        >
          <Icon name="plus" />
          <span>{t("新建 Webhook")}</span>
        </button>
      </div>
      <div className="table-scroll">
        {!webhooks.length ? (
          <div className="empty-state">
            <div>
              <span className="state-icon">
                <Icon name="refresh" />
              </span>
              <h2>{t("暂无 Webhook")}</h2>
              <p>{t("创建 Webhook 后可将 Harbor 事件发送到外部系统。")}</p>
            </div>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Webhook</th>
                <th>{t("目标地址")}</th>
                <th>{t("事件")}</th>
                <th>{t("状态")}</th>
                <th className="table-cell-time">{t("最近更新")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {webhooks.map((webhook) => (
                <tr key={webhook.id}>
                  <td>
                    <div className="cell-title">
                      <span className="cell-icon">
                        <Icon name="refresh" />
                      </span>
                      <span className="cell-stack">
                        <OverflowText as="strong">{webhook.name}</OverflowText>
                        <OverflowText as="small">
                          {webhook.description?.trim()
                            ? t(webhook.description)
                            : `${t("策略")} #${String(webhook.id)}`}
                        </OverflowText>
                      </span>
                    </div>
                  </td>
                  <td className="mono">
                    <OverflowText>
                      {webhookTarget(webhook)?.address?.trim()
                        ? String(webhookTarget(webhook)?.address)
                        : "-"}
                    </OverflowText>
                  </td>
                  <td>
                    <span className="badge badge-blue">
                      {locale === "en-US"
                        ? `${formatNumber(webhook.event_types?.length, locale)} event types`
                        : `${formatNumber(webhook.event_types?.length, locale)} 种事件`}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`badge ${webhook.enabled ? "badge-green" : ""}`.trim()}
                    >
                      {t(webhook.enabled ? "已启用" : "已停用")}
                    </span>
                  </td>
                  <td className="table-cell-time">
                    {formatDate(
                      webhook.update_time ?? webhook.creation_time,
                      locale,
                    )}
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="icon-button"
                        type="button"
                        title={t("执行历史")}
                        aria-label={t("查看 Webhook 执行历史")}
                        onClick={() => onHistory(project, webhook)}
                      >
                        <Icon name="history" />
                      </button>
                      <button
                        className="icon-button"
                        type="button"
                        title={t("编辑 Webhook")}
                        aria-label={t("编辑 Webhook")}
                        onClick={() => onEdit(project, webhook)}
                      >
                        <Icon name="edit" />
                      </button>
                      <button
                        className="icon-button danger-icon"
                        type="button"
                        title={t("删除 Webhook")}
                        aria-label={t("删除 Webhook")}
                        onClick={() => onDelete(project, webhook)}
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
      <Pagination pagination={pagination} onPageChange={onPageChange} />
    </section>
  );
}
