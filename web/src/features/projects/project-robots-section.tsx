import { useLocale } from "../../app/locale-context";
import type { ControlPagination, ProjectRobot } from "../../app/models";
import { displayTimeZone } from "../../app/preferences";
import { EmptyState } from "../../components/empty-state";
import { Icon } from "../../components/icon";
import { OverflowText } from "../../components/overflow-text";
import { Pagination } from "../../components/pagination";
import { PanelTitle } from "../../components/panel-title";
import uiStyles0 from "../../components/shared-ui.module.css";
import { createClassNames } from "../../lib/css/class-names";
import { formatDate, formatNumber } from "../../lib/format/formatters";

function formatExpiration(
  value: number | undefined,
  locale: "zh-CN" | "en-US",
) {
  if (value === -1) return locale === "en-US" ? "Never expires" : "永不过期";
  if (!value || value < 0) return locale === "en-US" ? "N/A" : "暂无";
  return formatDate(new Date(value * 1000).toISOString(), {
    locale: locale,
    timeZone: displayTimeZone(),
    includeTime: false,
  });
}

function permissionSummary(robot: ProjectRobot): {
  count: number;
  writable: boolean;
} {
  const access = (robot.permissions ?? []).flatMap(
    (permission) => permission.access ?? [],
  );
  return {
    count: access.length,
    writable: access.some(
      (item) => item.action === "push" || item.action === "create",
    ),
  };
}

type ProjectRobotsSectionProps = {
  project: string;
  robots: ProjectRobot[];
  pagination: ControlPagination;
  onPageChange: (page: number) => void;
  onCreate: (project: string) => void;
  onEdit: (project: string, robot: ProjectRobot) => void;
  onResetSecret: (project: string, robot: ProjectRobot) => void;
  onDelete: (project: string, robot: ProjectRobot) => void;
};

export function ProjectRobotsSection({
  project,
  robots,
  pagination,
  onPageChange,
  onCreate,
  onEdit,
  onResetSecret,
  onDelete,
}: ProjectRobotsSectionProps) {
  const { locale, t } = useLocale();
  return (
    <section className={resolveClasses("table-shell")}>
      <div className={resolveClasses("table-toolbar")}>
        <PanelTitle title="项目机器人账号" />
        <div className={resolveClasses("toolbar-spacer")} />
        <button
          className={resolveClasses("button button-small button-primary")}
          type="button"
          onClick={() => {
            onCreate(project);
          }}
        >
          <Icon name="plus" />
          <span>{t("新建机器人账号")}</span>
        </button>
      </div>
      <div className={resolveClasses("table-scroll")}>
        {!robots.length ? (
          <EmptyState
            title="暂无机器人账号"
            description="创建项目机器人账号后可用于 CI/CD 拉取和推送。"
            icon="terminal"
          />
        ) : (
          <table>
            <thead>
              <tr>
                <th>{t("机器人账号")}</th>
                <th>{t("权限")}</th>
                <th>{t("状态")}</th>
                <th className={resolveClasses("table-cell-time")}>
                  {t("到期时间")}
                </th>
                <th className={resolveClasses("table-cell-time")}>
                  {t("创建时间")}
                </th>
                <th />
              </tr>
            </thead>
            <tbody>
              {robots.map((robot) => {
                const permission = permissionSummary(robot);
                return (
                  <tr key={robot.id}>
                    <td>
                      <div className={resolveClasses("cell-title")}>
                        <span className={resolveClasses("cell-icon")}>
                          <Icon name="terminal" />
                        </span>
                        <span className={resolveClasses("cell-stack")}>
                          <OverflowText as="strong">{robot.name}</OverflowText>
                          <OverflowText as="small">
                            {robot.description?.trim()
                              ? t(robot.description)
                              : `${t("账号")} #${String(robot.id)}`}
                          </OverflowText>
                        </span>
                      </div>
                    </td>
                    <td>
                      <span
                        className={resolveClasses(
                          `badge ${permission.writable ? "badge-orange" : "badge-blue"}`,
                        )}
                      >
                        {locale === "en-US"
                          ? `${formatNumber(permission.count, locale)} permissions · ${permission.writable ? "includes write access" : "read-only"}`
                          : `${formatNumber(permission.count, locale)} 项 · ${permission.writable ? "含写入" : "只读"}`}
                      </span>
                    </td>
                    <td>
                      <span
                        className={resolveClasses(
                          `badge ${robot.disable ? "badge-red" : "badge-green"}`,
                        )}
                      >
                        {t(robot.disable ? "已停用" : "已启用")}
                      </span>
                    </td>
                    <td className={resolveClasses("table-cell-time")}>
                      {formatExpiration(robot.expires_at, locale)}
                    </td>
                    <td className={resolveClasses("table-cell-time")}>
                      {formatDate(robot.creation_time, {
                        locale: locale,
                        timeZone: displayTimeZone(),
                      })}
                    </td>
                    <td>
                      <div className={resolveClasses("row-actions")}>
                        <button
                          className={resolveClasses("icon-button")}
                          type="button"
                          title={t("重置密钥")}
                          aria-label={t("重置密钥")}
                          onClick={() => {
                            onResetSecret(project, robot);
                          }}
                        >
                          <Icon name="refresh" />
                        </button>
                        <button
                          className={resolveClasses("icon-button")}
                          type="button"
                          title={t("编辑机器人账号")}
                          aria-label={t("编辑机器人账号")}
                          onClick={() => {
                            onEdit(project, robot);
                          }}
                        >
                          <Icon name="edit" />
                        </button>
                        <button
                          className={resolveClasses("icon-button danger-icon")}
                          type="button"
                          title={t("删除机器人账号")}
                          aria-label={t("删除机器人账号")}
                          onClick={() => {
                            onDelete(project, robot);
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
  badge: uiStyles0.badge,
  "badge-orange": uiStyles0.badgeOrange,
  "badge-blue": uiStyles0.badgeBlue,
  "badge-red": uiStyles0.badgeRed,
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
