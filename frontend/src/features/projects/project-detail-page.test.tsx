import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { controlApi } from "../../app/api-client";
import { parseHashRoute } from "../../app/hash-router";
import { LocaleProvider } from "../../app/locale-context";
import type {
  AuditLog,
  ProjectMember,
  ProjectDetailSummary,
  ProjectLabel,
  ProjectSummary,
  ProjectWebhook,
  ImmutableTagRule,
  RepositorySummary,
  RetentionExecution,
  RetentionPolicy,
  Session,
} from "../../app/models";
import { IconSprite } from "../../components/icons";
import { ProjectDetailPage } from "./project-detail-page";

const session: Session = {
  connection_id: "demo",
  instance_url: "https://harbor.demo.local",
  username: "demo-admin",
  demo: true,
  instance_count: 1,
  expires_at: "2026-08-04T00:00:00Z",
};

const project: ProjectSummary = {
  project_id: 1,
  name: "platform",
  owner_name: "demo-admin",
  metadata: { public: "true", auto_scan: "true", prevent_vul: "false" },
};

const summary: ProjectDetailSummary = {
  project_admin_count: 1,
  maintainer_count: 1,
  developer_count: 1,
};

const repositories: RepositorySummary[] = [
  {
    id: 4,
    name: "platform/api",
    description: "API image",
    artifact_count: 12,
    pull_count: 18,
    update_time: "2026-07-30T08:00:00Z",
  },
  {
    id: 8,
    name: "platform/web",
    artifact_count: 3,
    pull_count: 9,
    update_time: "2026-07-29T08:00:00Z",
  },
];

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ProjectDetailPage", () => {
  it("loads project settings through the exact Harbor operations and parameters", async () => {
    vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockImplementation(
      function (this: HTMLElement) {
        return this.classList.contains("resource-tabs") ? 900 : 0;
      },
    );
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(
      function (this: HTMLElement) {
        return this.classList.contains("resource-tabs") ? 390 : 0;
      },
    );
    vi.spyOn(HTMLElement.prototype, "offsetLeft", "get").mockImplementation(
      function (this: HTMLElement) {
        return this.getAttribute("aria-current") === "page" ? 760 : 0;
      },
    );
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(
      function (this: HTMLElement) {
        return this.getAttribute("aria-current") === "page" ? 90 : 0;
      },
    );
    const scanner = {
      uuid: "00000000-0000-4000-8000-000000000001",
      name: "Trivy",
    };
    const quota = {
      id: 17,
      ref: { id: 1, name: "platform" },
      hard: { storage: 20 * 1024 ** 3 },
    };
    const data = vi
      .spyOn(controlApi, "data")
      .mockImplementation((operation) => {
        if (operation === "project") return Promise.resolve(project);
        if (operation === "project-scanner") return Promise.resolve(scanner);
        return Promise.resolve(summary);
      });
    const list = vi
      .spyOn(controlApi, "list")
      .mockImplementation((operation) => {
        if (operation === "project-scanner-candidates") {
          return Promise.resolve({
            items: [scanner],
            pagination: { page: 1, page_size: 100, total: 1 },
          });
        }
        if (operation === "quotas") {
          return Promise.resolve({
            items: [quota],
            pagination: { page: 1, page_size: 1, total: 1 },
          });
        }
        return Promise.resolve({
          items: repositories,
          pagination: {
            page: 1,
            page_size: 100,
            total: repositories.length,
          },
        });
      });

    render(
      <LocaleProvider>
        <IconSprite />
        <ProjectDetailPage
          route={parseHashRoute("#/projects/platform/settings")}
          session={session}
          isSystemAdmin={true}
          refreshing={false}
          navigate={vi.fn()}
          onRefresh={vi.fn().mockResolvedValue(undefined)}
          onDeleteRepositories={vi.fn()}
          onShowPushCommand={vi.fn()}
          onAddMember={vi.fn()}
          onEditMember={vi.fn()}
          onDeleteMember={vi.fn()}
          onCreateRobot={vi.fn()}
          onEditRobot={vi.fn()}
          onResetRobotSecret={vi.fn()}
          onDeleteRobot={vi.fn()}
          onCreateWebhook={vi.fn()}
          onEditWebhook={vi.fn()}
          onShowWebhookHistory={vi.fn()}
          onDeleteWebhook={vi.fn()}
          onCreateImmutableRule={vi.fn()}
          onEditImmutableRule={vi.fn()}
          onDeleteImmutableRule={vi.fn()}
          onCreateProjectLabel={vi.fn()}
          onEditProjectLabel={vi.fn()}
          onDeleteProjectLabel={vi.fn()}
          onRetentionAction={vi.fn()}
        />
      </LocaleProvider>,
    );

    expect(
      await screen.findByRole("heading", { name: "访问与安全" }),
    ).toBeVisible();
    await waitFor(() =>
      expect(
        screen.getByRole("navigation", { name: "项目页面" }).scrollLeft,
      ).toBe(610),
    );
    expect(data).toHaveBeenCalledWith(
      "project-scanner",
      { project: "platform" },
      expect.any(AbortSignal),
    );
    expect(list).toHaveBeenCalledWith(
      "project-scanner-candidates",
      {
        project: "platform",
        page: 1,
        page_size: 100,
        sort: "name",
      },
      expect.any(AbortSignal),
    );
    expect(list).toHaveBeenCalledWith(
      "quotas",
      {
        page: 1,
        page_size: 1,
        reference: "project",
        reference_id: 1,
      },
      expect.any(AbortSignal),
    );
  });

  it("preserves repository selection, sorting, navigation, and actions", async () => {
    vi.spyOn(controlApi, "data").mockImplementation((operation) =>
      Promise.resolve(operation === "project" ? project : summary),
    );
    vi.spyOn(controlApi, "list").mockResolvedValue({
      items: repositories,
      pagination: { page: 1, page_size: 100, total: repositories.length },
    });
    const navigate = vi.fn();
    const deleteRepositories = vi.fn();
    const showPushCommand = vi.fn();

    render(
      <LocaleProvider>
        <IconSprite />
        <ProjectDetailPage
          route={parseHashRoute("#/projects/platform/repositories")}
          session={session}
          isSystemAdmin={true}
          refreshing={false}
          navigate={navigate}
          onRefresh={vi.fn().mockResolvedValue(undefined)}
          onDeleteRepositories={deleteRepositories}
          onShowPushCommand={showPushCommand}
          onAddMember={vi.fn()}
          onEditMember={vi.fn()}
          onDeleteMember={vi.fn()}
          onCreateRobot={vi.fn()}
          onEditRobot={vi.fn()}
          onResetRobotSecret={vi.fn()}
          onDeleteRobot={vi.fn()}
          onCreateWebhook={vi.fn()}
          onEditWebhook={vi.fn()}
          onShowWebhookHistory={vi.fn()}
          onDeleteWebhook={vi.fn()}
          onCreateImmutableRule={vi.fn()}
          onEditImmutableRule={vi.fn()}
          onDeleteImmutableRule={vi.fn()}
          onCreateProjectLabel={vi.fn()}
          onEditProjectLabel={vi.fn()}
          onDeleteProjectLabel={vi.fn()}
          onRetentionAction={vi.fn()}
        />
      </LocaleProvider>,
    );

    expect(
      await screen.findByRole("heading", { name: "platform" }),
    ).toBeVisible();
    expect(screen.getByRole("region", { name: "项目统计" })).toHaveTextContent(
      "15",
    );
    expect(screen.getByText("api")).toBeInTheDocument();
    expect(controlApi.list).toHaveBeenCalledWith(
      "repositories",
      {
        project: "platform",
        page: 1,
        page_size: 100,
        sort: "name",
      },
      expect.any(AbortSignal),
    );
    expect(controlApi.list).not.toHaveBeenCalledWith(
      "repositories",
      expect.objectContaining({ sort: "artifact_count" }),
      expect.any(AbortSignal),
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "选择 api" }));
    const deleteButton = screen.getByRole("button", { name: "删除仓库" });
    expect(deleteButton).toBeEnabled();
    fireEvent.click(deleteButton);
    expect(deleteRepositories).toHaveBeenCalledWith("platform", [
      repositories[0],
    ]);

    fireEvent.click(screen.getByRole("button", { name: "按拉取次数降序排序" }));
    expect(navigate).toHaveBeenCalledWith(
      "projects/platform/repositories?sort=-pull_count",
    );

    fireEvent.click(screen.getByRole("button", { name: "推送镜像" }));
    expect(showPushCommand).toHaveBeenCalledWith("platform");

    fireEvent.click(screen.getByText("api"));
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith(
        "projects/platform/repositories/platform%2Fapi/artifacts",
      ),
    );
  });

  it("sorts derived repository counts in both directions without remounting", async () => {
    vi.spyOn(controlApi, "data").mockImplementation((operation) =>
      Promise.resolve(operation === "project" ? project : summary),
    );
    const list = vi.spyOn(controlApi, "list").mockResolvedValue({
      items: repositories,
      pagination: { page: 1, page_size: 100, total: repositories.length },
    });
    const props = {
      session,
      isSystemAdmin: true,
      refreshing: false,
      navigate: vi.fn(),
      onRefresh: vi.fn().mockResolvedValue(undefined),
      onDeleteRepositories: vi.fn(),
      onShowPushCommand: vi.fn(),
      onAddMember: vi.fn(),
      onEditMember: vi.fn(),
      onDeleteMember: vi.fn(),
      onCreateRobot: vi.fn(),
      onEditRobot: vi.fn(),
      onResetRobotSecret: vi.fn(),
      onDeleteRobot: vi.fn(),
      onCreateWebhook: vi.fn(),
      onEditWebhook: vi.fn(),
      onShowWebhookHistory: vi.fn(),
      onDeleteWebhook: vi.fn(),
      onCreateImmutableRule: vi.fn(),
      onEditImmutableRule: vi.fn(),
      onDeleteImmutableRule: vi.fn(),
      onCreateProjectLabel: vi.fn(),
      onEditProjectLabel: vi.fn(),
      onDeleteProjectLabel: vi.fn(),
      onRetentionAction: vi.fn(),
    };
    const { rerender } = render(
      <LocaleProvider>
        <IconSprite />
        <ProjectDetailPage
          {...props}
          route={parseHashRoute(
            "#/projects/platform/repositories?sort=-artifact_count",
          )}
        />
      </LocaleProvider>,
    );

    await waitFor(() => {
      const rows = screen.getAllByRole("row");
      expect(rows[1]).toHaveTextContent("api");
      expect(rows[2]).toHaveTextContent("web");
    });
    const table = screen.getByRole("table");

    rerender(
      <LocaleProvider>
        <IconSprite />
        <ProjectDetailPage
          {...props}
          route={parseHashRoute(
            "#/projects/platform/repositories?sort=artifact_count",
          )}
        />
      </LocaleProvider>,
    );

    await waitFor(() => {
      const rows = screen.getAllByRole("row");
      expect(rows[1]).toHaveTextContent("web");
      expect(rows[2]).toHaveTextContent("api");
    });
    expect(screen.getByRole("table")).toBe(table);
    expect(list.mock.calls).not.toContainEqual([
      "repositories",
      expect.objectContaining({ sort: "artifact_count" }),
      expect.any(AbortSignal),
    ]);
  });

  it("preserves project member search, pagination, and row actions", async () => {
    const members: ProjectMember[] = [
      {
        id: 7,
        entity_name: "release-team",
        entity_type: "g",
        role_id: 4,
        role_name: "Maintainer",
      },
    ];
    vi.spyOn(controlApi, "data").mockImplementation((operation) =>
      Promise.resolve(operation === "project" ? project : summary),
    );
    vi.spyOn(controlApi, "list").mockImplementation((operation) =>
      Promise.resolve(
        operation === "project-members"
          ? {
              items: members,
              pagination: { page: 1, page_size: 50, total: 1 },
            }
          : {
              items: repositories,
              pagination: {
                page: 1,
                page_size: 100,
                total: repositories.length,
              },
            },
      ),
    );
    const navigate = vi.fn();
    const addMember = vi.fn();
    const editMember = vi.fn();
    const deleteMember = vi.fn();

    render(
      <LocaleProvider>
        <IconSprite />
        <ProjectDetailPage
          route={parseHashRoute("#/projects/platform/members")}
          session={session}
          isSystemAdmin={true}
          refreshing={false}
          navigate={navigate}
          onRefresh={vi.fn().mockResolvedValue(undefined)}
          onDeleteRepositories={vi.fn()}
          onShowPushCommand={vi.fn()}
          onAddMember={addMember}
          onEditMember={editMember}
          onDeleteMember={deleteMember}
          onCreateRobot={vi.fn()}
          onEditRobot={vi.fn()}
          onResetRobotSecret={vi.fn()}
          onDeleteRobot={vi.fn()}
          onCreateWebhook={vi.fn()}
          onEditWebhook={vi.fn()}
          onShowWebhookHistory={vi.fn()}
          onDeleteWebhook={vi.fn()}
          onCreateImmutableRule={vi.fn()}
          onEditImmutableRule={vi.fn()}
          onDeleteImmutableRule={vi.fn()}
          onCreateProjectLabel={vi.fn()}
          onEditProjectLabel={vi.fn()}
          onDeleteProjectLabel={vi.fn()}
          onRetentionAction={vi.fn()}
        />
      </LocaleProvider>,
    );

    expect(await screen.findByText("release-team")).toBeVisible();
    expect(screen.getByText("用户组")).toBeVisible();
    expect(screen.getByText("维护者")).toHaveClass("badge-blue");
    expect(controlApi.list).toHaveBeenCalledWith(
      "project-members",
      {
        project: "platform",
        page: 1,
        page_size: 50,
        entityname: "",
      },
      expect.any(AbortSignal),
    );

    fireEvent.change(
      screen.getByRole("searchbox", { name: "按成员名称搜索" }),
      {
        target: { value: "release" },
      },
    );
    const searchForm = screen
      .getByRole("searchbox", { name: "按成员名称搜索" })
      .closest("form");
    expect(searchForm).not.toBeNull();
    if (!searchForm) throw new Error("member search form is missing");
    fireEvent.submit(searchForm);
    expect(navigate).toHaveBeenCalledWith(
      "projects/platform/members?q=release",
    );

    fireEvent.click(screen.getByRole("button", { name: "添加成员" }));
    expect(addMember).toHaveBeenCalledWith("platform", members);
    fireEvent.click(screen.getByRole("button", { name: "修改角色" }));
    expect(editMember).toHaveBeenCalledWith("platform", members[0]);
    fireEvent.click(screen.getByRole("button", { name: "删除成员" }));
    expect(deleteMember).toHaveBeenCalledWith("platform", members[0]);
  });

  it("loads webhook policies and preserves row actions", async () => {
    const webhooks: ProjectWebhook[] = [
      {
        id: 41,
        name: "deploy-events",
        description: "Push release event",
        event_types: ["PUSH_ARTIFACT", "SCANNING_COMPLETED"],
        enabled: true,
        targets: [{ type: "http", address: "https://hooks.demo.local/harbor" }],
        update_time: "2026-03-18T08:00:00Z",
      },
    ];
    const eventMetadata = {
      event_type: ["PUSH_ARTIFACT", "SCANNING_COMPLETED"],
      payload_formats: [{ notify_type: "http", formats: ["Default"] }],
    };
    vi.spyOn(controlApi, "data").mockImplementation((operation) => {
      if (operation === "project") return Promise.resolve(project);
      if (operation === "webhook-events") return Promise.resolve(eventMetadata);
      return Promise.resolve(summary);
    });
    vi.spyOn(controlApi, "list").mockImplementation((operation) =>
      Promise.resolve(
        operation === "webhooks"
          ? {
              items: webhooks,
              pagination: { page: 1, page_size: 50, total: 1 },
            }
          : {
              items: repositories,
              pagination: {
                page: 1,
                page_size: 100,
                total: repositories.length,
              },
            },
      ),
    );
    const createWebhook = vi.fn();
    const editWebhook = vi.fn();
    const showWebhookHistory = vi.fn();
    const deleteWebhook = vi.fn();

    render(
      <LocaleProvider>
        <IconSprite />
        <ProjectDetailPage
          route={parseHashRoute("#/projects/platform/webhooks")}
          session={session}
          isSystemAdmin={true}
          refreshing={false}
          navigate={vi.fn()}
          onRefresh={vi.fn().mockResolvedValue(undefined)}
          onDeleteRepositories={vi.fn()}
          onShowPushCommand={vi.fn()}
          onAddMember={vi.fn()}
          onEditMember={vi.fn()}
          onDeleteMember={vi.fn()}
          onCreateRobot={vi.fn()}
          onEditRobot={vi.fn()}
          onResetRobotSecret={vi.fn()}
          onDeleteRobot={vi.fn()}
          onCreateWebhook={createWebhook}
          onEditWebhook={editWebhook}
          onShowWebhookHistory={showWebhookHistory}
          onDeleteWebhook={deleteWebhook}
          onCreateImmutableRule={vi.fn()}
          onEditImmutableRule={vi.fn()}
          onDeleteImmutableRule={vi.fn()}
          onCreateProjectLabel={vi.fn()}
          onEditProjectLabel={vi.fn()}
          onDeleteProjectLabel={vi.fn()}
          onRetentionAction={vi.fn()}
        />
      </LocaleProvider>,
    );

    expect(await screen.findByText("deploy-events")).toBeVisible();
    expect(screen.getByText("https://hooks.demo.local/harbor")).toBeVisible();
    expect(screen.getByText("2 种事件")).toBeVisible();
    expect(controlApi.list).toHaveBeenCalledWith(
      "webhooks",
      {
        project: "platform",
        page: 1,
        page_size: 50,
        sort: "name",
      },
      expect.any(AbortSignal),
    );
    expect(controlApi.data).toHaveBeenCalledWith(
      "webhook-events",
      { project: "platform" },
      expect.any(AbortSignal),
    );

    fireEvent.click(screen.getByRole("button", { name: "新建 Webhook" }));
    expect(createWebhook).toHaveBeenCalledWith("platform", eventMetadata);
    fireEvent.click(
      screen.getByRole("button", { name: "查看 Webhook 执行历史" }),
    );
    expect(showWebhookHistory).toHaveBeenCalledWith("platform", webhooks[0]);
    fireEvent.click(screen.getByRole("button", { name: "编辑 Webhook" }));
    expect(editWebhook).toHaveBeenCalledWith(
      "platform",
      webhooks[0],
      eventMetadata,
    );
    fireEvent.click(screen.getByRole("button", { name: "删除 Webhook" }));
    expect(deleteWebhook).toHaveBeenCalledWith("platform", webhooks[0]);
  });

  it("loads immutable rules and project labels with exact actions", async () => {
    const rules: ImmutableTagRule[] = [
      {
        id: 31,
        priority: 1,
        disabled: false,
        action: "immutable",
        template: "immutable_template",
        params: {},
        scope_selectors: {
          repository: [
            {
              kind: "doublestar",
              decoration: "repoMatches",
              pattern: "**",
            },
          ],
        },
        tag_selectors: [
          {
            kind: "doublestar",
            decoration: "matches",
            pattern: "release-*",
          },
        ],
      },
    ];
    const labels: ProjectLabel[] = [
      {
        id: 42,
        name: "候选",
        description: "待发布验证",
        color: "#e8a317",
        project_id: 1,
      },
    ];
    const retentionMetadata = {
      scope_selectors: [{ decorations: ["repoMatches", "repoExcludes"] }],
      tag_selectors: [{ decorations: ["matches", "excludes"] }],
    };
    vi.spyOn(controlApi, "data").mockImplementation((operation) => {
      if (operation === "project") return Promise.resolve(project);
      if (operation === "retention-metadatas") {
        return Promise.resolve(retentionMetadata);
      }
      return Promise.resolve(summary);
    });
    const list = vi
      .spyOn(controlApi, "list")
      .mockImplementation((operation) => {
        if (operation === "immutable-rules") {
          return Promise.resolve({
            items: rules,
            pagination: { page: 1, page_size: 100, total: 1 },
          });
        }
        if (operation === "labels") {
          return Promise.resolve({
            items: labels,
            pagination: { page: 1, page_size: 100, total: 1 },
          });
        }
        return Promise.resolve({
          items: repositories,
          pagination: {
            page: 1,
            page_size: 100,
            total: repositories.length,
          },
        });
      });
    const createRule = vi.fn();
    const editRule = vi.fn();
    const deleteRule = vi.fn();
    const createLabel = vi.fn();
    const editLabel = vi.fn();
    const deleteLabel = vi.fn();

    render(
      <LocaleProvider>
        <IconSprite />
        <ProjectDetailPage
          route={parseHashRoute("#/projects/platform/rules")}
          session={session}
          isSystemAdmin={true}
          refreshing={false}
          navigate={vi.fn()}
          onRefresh={vi.fn().mockResolvedValue(undefined)}
          onDeleteRepositories={vi.fn()}
          onShowPushCommand={vi.fn()}
          onAddMember={vi.fn()}
          onEditMember={vi.fn()}
          onDeleteMember={vi.fn()}
          onCreateRobot={vi.fn()}
          onEditRobot={vi.fn()}
          onResetRobotSecret={vi.fn()}
          onDeleteRobot={vi.fn()}
          onCreateWebhook={vi.fn()}
          onEditWebhook={vi.fn()}
          onShowWebhookHistory={vi.fn()}
          onDeleteWebhook={vi.fn()}
          onCreateImmutableRule={createRule}
          onEditImmutableRule={editRule}
          onDeleteImmutableRule={deleteRule}
          onCreateProjectLabel={createLabel}
          onEditProjectLabel={editLabel}
          onDeleteProjectLabel={deleteLabel}
          onRetentionAction={vi.fn()}
        />
      </LocaleProvider>,
    );

    expect(await screen.findByText("release-*")).toBeVisible();
    expect(screen.getByText("候选")).toBeVisible();
    expect(list).toHaveBeenCalledWith(
      "immutable-rules",
      {
        project: "platform",
        page: 1,
        page_size: 100,
        sort: "priority",
      },
      expect.any(AbortSignal),
    );
    expect(list).toHaveBeenCalledWith(
      "labels",
      {
        scope: "p",
        project_id: 1,
        page: 1,
        page_size: 100,
        sort: "name",
      },
      expect.any(AbortSignal),
    );

    fireEvent.click(screen.getByRole("button", { name: "新建规则" }));
    expect(createRule).toHaveBeenCalledWith("platform", retentionMetadata);
    fireEvent.click(screen.getByRole("button", { name: "编辑规则" }));
    expect(editRule).toHaveBeenCalledWith(
      "platform",
      rules[0],
      retentionMetadata,
    );
    fireEvent.click(screen.getByRole("button", { name: "删除规则" }));
    expect(deleteRule).toHaveBeenCalledWith("platform", rules[0]);
    fireEvent.click(screen.getByRole("button", { name: "新建标签" }));
    expect(createLabel).toHaveBeenCalledWith("platform", 1);
    fireEvent.click(screen.getByRole("button", { name: "编辑标签" }));
    expect(editLabel).toHaveBeenCalledWith("platform", 1, labels[0]);
    fireEvent.click(screen.getByRole("button", { name: "删除标签" }));
    expect(deleteLabel).toHaveBeenCalledWith(labels[0]);
  });

  it("loads tag retention policy, executions, and exact row actions", async () => {
    const retentionProject: ProjectSummary = {
      ...project,
      metadata: { ...project.metadata, retention_id: "31" },
    };
    const retentionPolicy: RetentionPolicy = {
      id: 31,
      algorithm: "or",
      rules: [
        {
          id: 1,
          priority: 1,
          disabled: false,
          action: "retain",
          template: "latestPushedK",
          params: { latestPushedK: 10 },
          tag_selectors: [
            {
              kind: "doublestar",
              decoration: "excludes",
              pattern: "scratch-*",
            },
          ],
          scope_selectors: {
            repository: [
              {
                kind: "doublestar",
                decoration: "repoExcludes",
                pattern: "sandbox/**",
              },
            ],
          },
        },
      ],
      trigger: { kind: "Schedule", settings: { cron: "0 0 2 * * *" } },
      scope: { level: "project", ref: 1 },
      update_time: "2026-07-20T02:00:00Z",
    };
    const retentionExecution: RetentionExecution = {
      id: 71,
      policy_id: 31,
      status: "Succeed",
      dry_run: true,
      start_time: "2026-07-27T02:00:00Z",
      end_time: "2026-07-27T02:00:18Z",
    };
    const retentionMetadata = {
      templates: [
        {
          rule_template: "latestPushedK",
          display_text: "保留最近推送的制品",
        },
      ],
      scope_selectors: [{ decorations: ["repoMatches", "repoExcludes"] }],
      tag_selectors: [{ decorations: ["matches", "excludes"] }],
    };
    vi.spyOn(controlApi, "data").mockImplementation((operation) => {
      if (operation === "project") return Promise.resolve(retentionProject);
      if (operation === "retention") return Promise.resolve(retentionPolicy);
      if (operation === "retention-metadatas") {
        return Promise.resolve(retentionMetadata);
      }
      return Promise.resolve(summary);
    });
    const list = vi.spyOn(controlApi, "list").mockImplementation((operation) =>
      Promise.resolve(
        operation === "retention-executions"
          ? {
              items: [retentionExecution],
              pagination: { page: 1, page_size: 20, total: 1 },
            }
          : {
              items: repositories,
              pagination: {
                page: 1,
                page_size: 100,
                total: repositories.length,
              },
            },
      ),
    );
    const retentionAction = vi.fn();

    render(
      <LocaleProvider>
        <IconSprite />
        <ProjectDetailPage
          route={parseHashRoute("#/projects/platform/retention")}
          session={session}
          isSystemAdmin={true}
          refreshing={false}
          navigate={vi.fn()}
          onRefresh={vi.fn().mockResolvedValue(undefined)}
          onDeleteRepositories={vi.fn()}
          onShowPushCommand={vi.fn()}
          onAddMember={vi.fn()}
          onEditMember={vi.fn()}
          onDeleteMember={vi.fn()}
          onCreateRobot={vi.fn()}
          onEditRobot={vi.fn()}
          onResetRobotSecret={vi.fn()}
          onDeleteRobot={vi.fn()}
          onCreateWebhook={vi.fn()}
          onEditWebhook={vi.fn()}
          onShowWebhookHistory={vi.fn()}
          onDeleteWebhook={vi.fn()}
          onCreateImmutableRule={vi.fn()}
          onEditImmutableRule={vi.fn()}
          onDeleteImmutableRule={vi.fn()}
          onCreateProjectLabel={vi.fn()}
          onEditProjectLabel={vi.fn()}
          onDeleteProjectLabel={vi.fn()}
          onRetentionAction={retentionAction}
        />
      </LocaleProvider>,
    );

    expect(await screen.findByText("sandbox/**")).toBeVisible();
    expect(screen.getByText("scratch-*")).toBeVisible();
    expect(screen.getByText("#71")).toBeVisible();
    expect(list).toHaveBeenCalledWith(
      "retention-executions",
      { id: 31, page: 1, page_size: 20 },
      expect.any(AbortSignal),
    );
    expect(controlApi.data).toHaveBeenCalledWith(
      "retention",
      { id: 31 },
      expect.any(AbortSignal),
    );

    fireEvent.click(screen.getByRole("button", { name: "仅演练" }));
    expect(retentionAction).toHaveBeenCalledWith({
      kind: "run",
      policy: retentionPolicy,
      dryRun: true,
    });
    fireEvent.click(screen.getByRole("button", { name: "编辑保留规则" }));
    expect(retentionAction).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "edit-rule",
        policy: retentionPolicy,
        ruleIndex: 0,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "查看 Tag 保留任务" }));
    expect(retentionAction).toHaveBeenCalledWith({
      kind: "view-execution",
      project: "platform",
      policy: retentionPolicy,
      execution: retentionExecution,
    });
  });

  it("loads project audit records with exact official endpoint parameters", async () => {
    const auditLogs: AuditLog[] = [
      {
        id: 48320,
        username: "ci-bot",
        resource: "platform/gateway:v3.18.4",
        resource_type: "artifact",
        operation: "push",
        operation_description: "push artifact manifest and blobs",
        operation_result: true,
        op_time: "2026-07-28T06:42:05Z",
      },
    ];
    vi.spyOn(controlApi, "data").mockImplementation((operation) =>
      Promise.resolve(operation === "project" ? project : summary),
    );
    const list = vi.spyOn(controlApi, "list").mockImplementation((operation) =>
      Promise.resolve(
        operation === "project-audit-logs"
          ? {
              items: auditLogs,
              pagination: { page: 2, page_size: 20, total: 21 },
            }
          : {
              items: repositories,
              pagination: {
                page: 1,
                page_size: 100,
                total: repositories.length,
              },
            },
      ),
    );

    render(
      <LocaleProvider>
        <IconSprite />
        <ProjectDetailPage
          route={parseHashRoute(
            "#/projects/platform/audit?page=2&page_size=20&q=gateway&sort=-id",
          )}
          session={session}
          isSystemAdmin={true}
          refreshing={false}
          navigate={vi.fn()}
          onRefresh={vi.fn().mockResolvedValue(undefined)}
          onDeleteRepositories={vi.fn()}
          onShowPushCommand={vi.fn()}
          onAddMember={vi.fn()}
          onEditMember={vi.fn()}
          onDeleteMember={vi.fn()}
          onCreateRobot={vi.fn()}
          onEditRobot={vi.fn()}
          onResetRobotSecret={vi.fn()}
          onDeleteRobot={vi.fn()}
          onCreateWebhook={vi.fn()}
          onEditWebhook={vi.fn()}
          onShowWebhookHistory={vi.fn()}
          onDeleteWebhook={vi.fn()}
          onCreateImmutableRule={vi.fn()}
          onEditImmutableRule={vi.fn()}
          onDeleteImmutableRule={vi.fn()}
          onCreateProjectLabel={vi.fn()}
          onEditProjectLabel={vi.fn()}
          onDeleteProjectLabel={vi.fn()}
          onRetentionAction={vi.fn()}
        />
      </LocaleProvider>,
    );

    expect(await screen.findByText("platform/gateway:v3.18.4")).toBeVisible();
    expect(list).toHaveBeenCalledWith(
      "project-audit-logs",
      {
        project: "platform",
        page: 2,
        page_size: 20,
        sort: "-id",
        q: "resource=~gateway",
      },
      expect.any(AbortSignal),
    );
  });

  it("filters project tabs and data requests by project permissions", async () => {
    vi.spyOn(controlApi, "data").mockImplementation((operation) =>
      Promise.resolve(operation === "project" ? project : summary),
    );
    const list = vi.spyOn(controlApi, "list").mockImplementation((operation) =>
      Promise.resolve(
        operation === "current-permissions"
          ? {
              items: [{ resource: "repository", action: "list" }],
              pagination: { page: 1, page_size: 20, total: 1 },
            }
          : {
              items: repositories,
              pagination: {
                page: 1,
                page_size: 100,
                total: repositories.length,
              },
            },
      ),
    );

    render(
      <LocaleProvider>
        <IconSprite />
        <ProjectDetailPage
          route={parseHashRoute("#/projects/platform/members")}
          session={session}
          isSystemAdmin={false}
          refreshing={false}
          navigate={vi.fn()}
          onRefresh={vi.fn().mockResolvedValue(undefined)}
          onDeleteRepositories={vi.fn()}
          onShowPushCommand={vi.fn()}
          onAddMember={vi.fn()}
          onEditMember={vi.fn()}
          onDeleteMember={vi.fn()}
          onCreateRobot={vi.fn()}
          onEditRobot={vi.fn()}
          onResetRobotSecret={vi.fn()}
          onDeleteRobot={vi.fn()}
          onCreateWebhook={vi.fn()}
          onEditWebhook={vi.fn()}
          onShowWebhookHistory={vi.fn()}
          onDeleteWebhook={vi.fn()}
          onCreateImmutableRule={vi.fn()}
          onEditImmutableRule={vi.fn()}
          onDeleteImmutableRule={vi.fn()}
          onCreateProjectLabel={vi.fn()}
          onEditProjectLabel={vi.fn()}
          onDeleteProjectLabel={vi.fn()}
          onRetentionAction={vi.fn()}
        />
      </LocaleProvider>,
    );

    expect(await screen.findByText("没有访问此项目页面的权限")).toBeVisible();
    expect(
      screen.queryByRole("link", { name: "成员" }),
    ).not.toBeInTheDocument();
    expect(list).not.toHaveBeenCalledWith(
      "project-members",
      expect.anything(),
      expect.anything(),
    );
  });
});
