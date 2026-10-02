import { formatDate, formatNumber } from "../../app/formatters";
import { useLocale } from "../../app/locale-context";
import type { ControlPagination, ProjectRobot } from "../../app/models";
import { Pagination } from "../../components/data-table";
import { Icon } from "../../components/icons";
import { OverflowText } from "../../components/overflow-text";

function formatExpiration(
  value: number | undefined,
  locale: "zh-CN" | "en-US",
) {
  if (value === -1) return locale === "en-US" ? "Never expires" : "永不过期";
  if (!value || value < 0) return locale === "en-US" ? "N/A" : "暂无";
  return formatDate(new Date(value * 1000).toISOString(), locale, false);
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

export function ProjectRobotsSection({
  project,
  robots,
  pagination,
  onPageChange,
  onCreate,
  onEdit,
  onResetSecret,
  onDelete,
}: {
  project: string;
  robots: ProjectRobot[];
  pagination: ControlPagination;
  onPageChange: (page: number) => void;
  onCreate: (project: string) => void;
  onEdit: (project: string, robot: ProjectRobot) => void;
  onResetSecret: (project: string, robot: ProjectRobot) => void;
  onDelete: (project: string, robot: ProjectRobot) => void;
}) {
  const { locale, t } = useLocale();
  return (
    <section className="table-shell">
      <div className="table-toolbar">
        <strong>{t("项目机器人账号")}</strong>
        <div className="toolbar-spacer" />
        <button
          className="button button-small button-primary"
          type="button"
          onClick={() => onCreate(project)}
        >
          <Icon name="plus" />
          <span>{t("新建机器人账号")}</span>
        </button>
      </div>
      <div className="table-scroll">
        {!robots.length ? (
          <div className="empty-state">
            <div>
              <span className="state-icon">
                <Icon name="terminal" />
              </span>
              <h2>{t("暂无机器人账号")}</h2>
              <p>{t("创建项目机器人账号后可用于 CI/CD 拉取和推送。")}</p>
            </div>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>{t("机器人账号")}</th>
                <th>{t("权限")}</th>
                <th>{t("状态")}</th>
                <th className="table-cell-time">{t("到期时间")}</th>
                <th className="table-cell-time">{t("创建时间")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {robots.map((robot) => {
                const permission = permissionSummary(robot);
                return (
                  <tr key={robot.id}>
                    <td>
                      <div className="cell-title">
                        <span className="cell-icon">
                          <Icon name="terminal" />
                        </span>
                        <span className="cell-stack">
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
                        className={`badge ${permission.writable ? "badge-orange" : "badge-blue"}`}
                      >
                        {locale === "en-US"
                          ? `${formatNumber(permission.count, locale)} permissions · ${permission.writable ? "includes write access" : "read-only"}`
                          : `${formatNumber(permission.count, locale)} 项 · ${permission.writable ? "含写入" : "只读"}`}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`badge ${robot.disable ? "badge-red" : "badge-green"}`}
                      >
                        {t(robot.disable ? "已停用" : "已启用")}
                      </span>
                    </td>
                    <td className="table-cell-time">
                      {formatExpiration(robot.expires_at, locale)}
                    </td>
                    <td className="table-cell-time">
                      {formatDate(robot.creation_time, locale)}
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="icon-button"
                          type="button"
                          title={t("重置密钥")}
                          aria-label={t("重置密钥")}
                          onClick={() => onResetSecret(project, robot)}
                        >
                          <Icon name="refresh" />
                        </button>
                        <button
                          className="icon-button"
                          type="button"
                          title={t("编辑机器人账号")}
                          aria-label={t("编辑机器人账号")}
                          onClick={() => onEdit(project, robot)}
                        >
                          <Icon name="edit" />
                        </button>
                        <button
                          className="icon-button danger-icon"
                          type="button"
                          title={t("删除机器人账号")}
                          aria-label={t("删除机器人账号")}
                          onClick={() => onDelete(project, robot)}
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
