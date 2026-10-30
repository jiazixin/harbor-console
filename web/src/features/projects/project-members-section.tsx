import { useLocale } from "../../app/locale-context";
import type { ControlPagination, ProjectMember } from "../../app/models";
import { EmptyState } from "../../components/empty-state";
import { Icon } from "../../components/icon";
import { OverflowText } from "../../components/overflow-text";
import { Pagination } from "../../components/pagination";
import uiStyles0 from "../../components/shared-ui.module.css";
import { ToolbarSearchForm } from "../../components/toolbar-search-form";
import { createClassNames } from "../../lib/css/class-names";
import { formatNumber } from "../../lib/format/formatters";
import { useResettableState } from "../../lib/state/use-resettable-state";

const roleLabels: Partial<Record<number, string>> = {
  1: "项目管理员",
  2: "开发者",
  3: "访客",
  4: "维护者",
};

type ProjectMembersSectionProps = {
  project: string;
  members: ProjectMember[];
  pagination: ControlPagination;
  initialQuery: string;
  onSearch: (query: string) => void;
  onPageChange: (page: number) => void;
  onAddMember: (project: string, members: ProjectMember[]) => void;
  onEditMember: (project: string, member: ProjectMember) => void;
  onDeleteMember: (project: string, member: ProjectMember) => void;
};

export function ProjectMembersSection({
  project,
  members,
  pagination,
  initialQuery,
  onSearch,
  onPageChange,
  onAddMember,
  onEditMember,
  onDeleteMember,
}: ProjectMembersSectionProps) {
  const { locale, t } = useLocale();
  const [query, setQuery] = useResettableState(initialQuery);

  return (
    <section className={resolveClasses("table-shell")}>
      <div className={resolveClasses("table-toolbar")}>
        <ToolbarSearchForm
          name="q"
          placeholder="按成员名称搜索"
          value={query}
          onChange={setQuery}
          onSubmit={onSearch}
        />
        <div className={resolveClasses("toolbar-spacer")} />
        <button
          className={resolveClasses("button button-small button-primary")}
          type="button"
          onClick={() => {
            onAddMember(project, members);
          }}
        >
          <Icon name="plus" />
          <span>{t("添加成员")}</span>
        </button>
      </div>
      <div className={resolveClasses("table-scroll")}>
        {!members.length ? (
          <EmptyState
            title="暂无成员"
            description="当前项目中没有匹配的成员。"
            icon="users"
          />
        ) : (
          <table>
            <thead>
              <tr>
                <th>{t("成员")}</th>
                <th>{t("类型")}</th>
                <th>{t("角色")}</th>
                <th>{t("成员编号")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {members.map((member) => {
                const role =
                  roleLabels[member.role_id ?? 0] ?? member.role_name ?? "未知";
                return (
                  <tr key={member.id}>
                    <td>
                      <div className={resolveClasses("cell-title")}>
                        <span className={resolveClasses("cell-icon")}>
                          <Icon name="users" />
                        </span>
                        <span className={resolveClasses("cell-stack")}>
                          <OverflowText as="strong">
                            {member.entity_name}
                          </OverflowText>
                          <small>
                            {t("实体编号")} {member.entity_id ?? "-"}
                          </small>
                        </span>
                      </div>
                    </td>
                    <td>{t(member.entity_type === "g" ? "用户组" : "用户")}</td>
                    <td>
                      <span
                        className={resolveClasses(
                          `badge ${member.role_id === 1 ? "badge-orange" : "badge-blue"}`,
                        )}
                      >
                        {t(role)}
                      </span>
                    </td>
                    <td className={resolveClasses("mono")}>#{member.id}</td>
                    <td>
                      <div className={resolveClasses("row-actions")}>
                        <button
                          className={resolveClasses("icon-button")}
                          type="button"
                          title={t("修改角色")}
                          aria-label={t("修改角色")}
                          onClick={() => {
                            onEditMember(project, member);
                          }}
                        >
                          <Icon name="edit" />
                        </button>
                        <button
                          className={resolveClasses("icon-button danger-icon")}
                          type="button"
                          title={t("删除成员")}
                          aria-label={t("删除成员")}
                          onClick={() => {
                            onDeleteMember(project, member);
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
      <Pagination
        pagination={{
          ...pagination,
          total: Math.max(0, pagination.total),
        }}
        onPageChange={onPageChange}
      />
      <span className={resolveClasses("sr-only")}>
        {formatNumber(pagination.total, locale)} {t("项")}
      </span>
    </section>
  );
}

const resolveClasses = createClassNames({
  "empty-state": uiStyles0.emptyState,
  icon: uiStyles0.icon,
  "overflow-text": uiStyles0.overflowText,
  "table-shell": uiStyles0.tableShell,
  "table-toolbar": uiStyles0.tableToolbar,
  "toolbar-spacer": uiStyles0.toolbarSpacer,
  button: uiStyles0.button,
  "button-small": uiStyles0.buttonSmall,
  "button-primary": uiStyles0.buttonPrimary,
  "table-scroll": uiStyles0.tableScroll,
  "cell-title": uiStyles0.cellTitle,
  "cell-icon": uiStyles0.cellIcon,
  "cell-stack": uiStyles0.cellStack,
  badge: uiStyles0.badge,
  "badge-orange": uiStyles0.badgeOrange,
  "badge-blue": uiStyles0.badgeBlue,
  mono: uiStyles0.mono,
  "row-actions": uiStyles0.rowActions,
  "icon-button": uiStyles0.iconButton,
  "danger-icon": uiStyles0.dangerIcon,
  "sr-only": uiStyles0.srOnly,
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
