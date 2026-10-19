import { formatNumber } from "../../app/formatters";
import { useLocale } from "../../app/locale-context";
import type { ControlPagination, ProjectMember } from "../../app/models";
import { Pagination } from "../../components/data-table";
import { EmptyState } from "../../components/empty-state";
import { Icon } from "../../components/icons";
import { OverflowText } from "../../components/overflow-text";
import { ToolbarSearchForm } from "../../components/toolbar-search-form";
import { useResettableState } from "../../components/use-resettable-state";

const roleLabels: Partial<Record<number, string>> = {
  1: "项目管理员",
  2: "开发者",
  3: "访客",
  4: "维护者",
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
}: {
  project: string;
  members: ProjectMember[];
  pagination: ControlPagination;
  initialQuery: string;
  onSearch: (query: string) => void;
  onPageChange: (page: number) => void;
  onAddMember: (project: string, members: ProjectMember[]) => void;
  onEditMember: (project: string, member: ProjectMember) => void;
  onDeleteMember: (project: string, member: ProjectMember) => void;
}) {
  const { locale, t } = useLocale();
  const [query, setQuery] = useResettableState(initialQuery);

  return (
    <section className="table-shell">
      <div className="table-toolbar">
        <ToolbarSearchForm
          name="q"
          placeholder="按成员名称搜索"
          value={query}
          onChange={setQuery}
          onSubmit={onSearch}
        />
        <div className="toolbar-spacer" />
        <button
          className="button button-small button-primary"
          type="button"
          onClick={() => onAddMember(project, members)}
        >
          <Icon name="plus" />
          <span>{t("添加成员")}</span>
        </button>
      </div>
      <div className="table-scroll">
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
                      <div className="cell-title">
                        <span className="cell-icon">
                          <Icon name="users" />
                        </span>
                        <span className="cell-stack">
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
                        className={`badge ${member.role_id === 1 ? "badge-orange" : "badge-blue"}`}
                      >
                        {t(role)}
                      </span>
                    </td>
                    <td className="mono">#{member.id}</td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="icon-button"
                          type="button"
                          title={t("修改角色")}
                          aria-label={t("修改角色")}
                          onClick={() => onEditMember(project, member)}
                        >
                          <Icon name="edit" />
                        </button>
                        <button
                          className="icon-button danger-icon"
                          type="button"
                          title={t("删除成员")}
                          aria-label={t("删除成员")}
                          onClick={() => onDeleteMember(project, member)}
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
      <span className="sr-only">
        {formatNumber(pagination.total, locale)} {t("项")}
      </span>
    </section>
  );
}
