import { useLocale } from "../../app/locale-context";
import type { ControlPagination, ProjectWebhook } from "../../app/models";
import { displayTimeZone } from "../../app/preferences";
import { EmptyState } from "../../components/empty-state";
import { Icon } from "../../components/icon";
import { OverflowText } from "../../components/overflow-text";
import { Pagination } from "../../components/pagination";
import { PanelTitle } from "../../components/panel-title";
import uiStyles0 from "../../components/shared-ui.module.css";
import { createClassNames } from "../../lib/css/class-names";
import { formatDate, formatNumber } from "../../lib/format/formatters";

function webhookTarget(webhook: ProjectWebhook) {
  return webhook.targets?.[0];
}

type ProjectWebhooksSectionProps = {
  project: string;
  webhooks: ProjectWebhook[];
  pagination: ControlPagination;
  onPageChange: (page: number) => void;
  onCreate: (project: string) => void;
  onEdit: (project: string, webhook: ProjectWebhook) => void;
  onHistory: (project: string, webhook: ProjectWebhook) => void;
  onDelete: (project: string, webhook: ProjectWebhook) => void;
};

export function ProjectWebhooksSection({
  project,
  webhooks,
  pagination,
  onPageChange,
  onCreate,
  onEdit,
  onHistory,
  onDelete,
}: ProjectWebhooksSectionProps) {
  const { locale, t } = useLocale();
  return (
    <section className={resolveClasses("table-shell")}>
      <div className={resolveClasses("table-toolbar")}>
        <PanelTitle title="Webhook 策略" />
        <div className={resolveClasses("toolbar-spacer")} />
        <button
          className={resolveClasses("button button-small button-primary")}
          type="button"
          onClick={() => {
            onCreate(project);
          }}
        >
          <Icon name="plus" />
          <span>{t("新建 Webhook")}</span>
        </button>
      </div>
      <div className={resolveClasses("table-scroll")}>
        {!webhooks.length ? (
          <EmptyState
            title="暂无 Webhook"
            description="创建 Webhook 后可将 Harbor 事件发送到外部系统。"
            icon="refresh"
          />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Webhook</th>
                <th>{t("目标地址")}</th>
                <th>{t("事件")}</th>
                <th>{t("状态")}</th>
                <th className={resolveClasses("table-cell-time")}>
                  {t("最近更新")}
                </th>
                <th />
              </tr>
            </thead>
            <tbody>
              {webhooks.map((webhook) => (
                <tr key={webhook.id}>
                  <td>
                    <div className={resolveClasses("cell-title")}>
                      <span className={resolveClasses("cell-icon")}>
                        <Icon name="refresh" />
                      </span>
                      <span className={resolveClasses("cell-stack")}>
                        <OverflowText as="strong">{webhook.name}</OverflowText>
                        <OverflowText as="small">
                          {webhook.description?.trim()
                            ? t(webhook.description)
                            : `${t("策略")} #${String(webhook.id)}`}
                        </OverflowText>
                      </span>
                    </div>
                  </td>
                  <td className={resolveClasses("mono")}>
                    <OverflowText>
                      {webhookTarget(webhook)?.address?.trim()
                        ? String(webhookTarget(webhook)?.address)
                        : "-"}
                    </OverflowText>
                  </td>
                  <td>
                    <span className={resolveClasses("badge badge-blue")}>
                      {locale === "en-US"
                        ? `${formatNumber(webhook.event_types?.length, locale)} event types`
                        : `${formatNumber(webhook.event_types?.length, locale)} 种事件`}
                    </span>
                  </td>
                  <td>
                    <span
                      className={resolveClasses(
                        `badge ${webhook.enabled ? "badge-green" : ""}`.trim(),
                      )}
                    >
                      {t(webhook.enabled ? "已启用" : "已停用")}
                    </span>
                  </td>
                  <td className={resolveClasses("table-cell-time")}>
                    {formatDate(webhook.update_time ?? webhook.creation_time, {
                      locale: locale,
                      timeZone: displayTimeZone(),
                    })}
                  </td>
                  <td>
                    <div className={resolveClasses("row-actions")}>
                      <button
                        className={resolveClasses("icon-button")}
                        type="button"
                        title={t("执行历史")}
                        aria-label={t("查看 Webhook 执行历史")}
                        onClick={() => {
                          onHistory(project, webhook);
                        }}
                      >
                        <Icon name="history" />
                      </button>
                      <button
                        className={resolveClasses("icon-button")}
                        type="button"
                        title={t("编辑 Webhook")}
                        aria-label={t("编辑 Webhook")}
                        onClick={() => {
                          onEdit(project, webhook);
                        }}
                      >
                        <Icon name="edit" />
                      </button>
                      <button
                        className={resolveClasses("icon-button danger-icon")}
                        type="button"
                        title={t("删除 Webhook")}
                        aria-label={t("删除 Webhook")}
                        onClick={() => {
                          onDelete(project, webhook);
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
      <Pagination pagination={pagination} onPageChange={onPageChange} />
    </section>
  );
}

const resolveClasses = createClassNames({
  "empty-state": uiStyles0.emptyState,
  icon: uiStyles0.icon,
  "overflow-text": uiStyles0.overflowText,
  "panel-title": uiStyles0.panelTitle,
  "table-shell": uiStyles0.tableShell,
  "table-toolbar": uiStyles0.tableToolbar,
  "toolbar-spacer": uiStyles0.toolbarSpacer,
  button: uiStyles0.button,
  "button-small": uiStyles0.buttonSmall,
  "button-primary": uiStyles0.buttonPrimary,
  "table-scroll": uiStyles0.tableScroll,
  "table-cell-time": uiStyles0.tableCellTime,
  "cell-title": uiStyles0.cellTitle,
  "cell-icon": uiStyles0.cellIcon,
  "cell-stack": uiStyles0.cellStack,
  mono: uiStyles0.mono,
  badge: uiStyles0.badge,
  "badge-blue": uiStyles0.badgeBlue,
  "badge-green": uiStyles0.badgeGreen,
  "row-actions": uiStyles0.rowActions,
  "icon-button": uiStyles0.iconButton,
  "danger-icon": uiStyles0.dangerIcon,
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
