import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "../../app/locale-context";
import { IconSprite } from "../../components/icons";
import { ProjectMembersSection } from "./project-members-section";
import { ProjectPreheatSection } from "./project-preheat-section";
import { ProjectRobotsSection } from "./project-robots-section";
import { ProjectRulesSection } from "./project-rules-section";
import { ProjectWebhooksSection } from "./project-webhooks-section";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.restoreAllMocks();
});

function renderLocalized(node: React.ReactNode) {
  return render(
    <LocaleProvider>
      <IconSprite />
      {node}
    </LocaleProvider>,
  );
}

function tableHeaders(table: HTMLElement) {
  return within(table)
    .getAllByRole("columnheader")
    .map((header) => header.textContent);
}

describe("project detail legacy table parity", () => {
  it("keeps the member identity and column order", () => {
    const memberName = "member-".repeat(36);
    renderLocalized(
      <ProjectMembersSection
        project="library"
        members={[
          {
            id: 17,
            entity_id: 23,
            entity_name: memberName,
            entity_type: "u",
            role_id: 4,
          },
        ]}
        pagination={{ page: 1, page_size: 50, total: 1 }}
        initialQuery=""
        onSearch={vi.fn()}
        onPageChange={vi.fn()}
        onAddMember={vi.fn()}
        onEditMember={vi.fn()}
        onDeleteMember={vi.fn()}
      />,
    );

    const table = screen.getByRole("table");
    expect(tableHeaders(table)).toEqual([
      "成员",
      "类型",
      "角色",
      "成员编号",
      "",
    ]);
    expect(screen.getByText("实体编号 23")).toBeInTheDocument();
    expect(screen.getByText(memberName)).toHaveAttribute("title", memberName);
    expect(
      table.querySelector('.cell-icon use[href="#i-users"]'),
    ).not.toBeNull();
  });

  it("keeps robot and webhook ids in their identity subtitles", () => {
    const robotName = "robot$" + "r".repeat(180);
    const robotDescription = "d".repeat(1024);
    const { rerender } = renderLocalized(
      <ProjectRobotsSection
        project="library"
        robots={[
          {
            id: 31,
            name: robotName,
            description: robotDescription,
            expires_at: -1,
          },
        ]}
        pagination={{ page: 1, page_size: 50, total: 1 }}
        onPageChange={vi.fn()}
        onCreate={vi.fn()}
        onEdit={vi.fn()}
        onResetSecret={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    let table = screen.getByRole("table");
    expect(tableHeaders(table)).toEqual([
      "机器人账号",
      "权限",
      "状态",
      "到期时间",
      "创建时间",
      "",
    ]);
    expect(screen.getByText(robotName)).toHaveAttribute("title", robotName);
    expect(screen.getByText(robotDescription)).toHaveAttribute(
      "title",
      robotDescription,
    );
    expect(
      table.querySelector('.cell-icon use[href="#i-terminal"]'),
    ).not.toBeNull();

    rerender(
      <LocaleProvider>
        <IconSprite />
        <ProjectWebhooksSection
          project="library"
          webhooks={[
            {
              id: 41,
              name: "w".repeat(255),
              description: "h".repeat(1024),
              enabled: true,
              targets: [{ address: `https://example.test/${"a".repeat(512)}` }],
            },
          ]}
          pagination={{ page: 1, page_size: 50, total: 1 }}
          onPageChange={vi.fn()}
          onCreate={vi.fn()}
          onEdit={vi.fn()}
          onHistory={vi.fn()}
          onDelete={vi.fn()}
        />
      </LocaleProvider>,
    );

    table = screen.getByRole("table");
    expect(tableHeaders(table)).toEqual([
      "Webhook",
      "目标地址",
      "事件",
      "状态",
      "最近更新",
      "",
    ]);
    expect(screen.getByText("w".repeat(255))).toHaveAttribute(
      "title",
      "w".repeat(255),
    );
    expect(screen.getByText("h".repeat(1024))).toHaveAttribute(
      "title",
      "h".repeat(1024),
    );
    expect(
      table.querySelector('.cell-icon use[href="#i-refresh"]'),
    ).not.toBeNull();
  });

  it("keeps project labels and preheat policies in the legacy table shape", () => {
    const labelName = "l".repeat(128);
    const labelDescription = "x".repeat(1024);
    const { rerender } = renderLocalized(
      <ProjectRulesSection
        project="library"
        projectId={1}
        rules={[]}
        labels={[
          {
            id: 51,
            name: labelName,
            description: labelDescription,
            color: "#00a0d2",
          },
        ]}
        metadata={{ scope_selectors: [], tag_selectors: [] }}
        onCreateRule={vi.fn()}
        onEditRule={vi.fn()}
        onDeleteRule={vi.fn()}
        onCreateLabel={vi.fn()}
        onEditLabel={vi.fn()}
        onDeleteLabel={vi.fn()}
      />,
    );

    let table = screen.getByRole("table");
    expect(tableHeaders(table)).toEqual(["标签", "描述", "最近更新", ""]);
    expect(screen.queryByText("#51")).not.toBeInTheDocument();
    expect(table.querySelector(".label-swatch")).not.toBeNull();
    expect(screen.getByText(labelName)).toHaveAttribute("title", labelName);
    expect(screen.getByText(labelDescription)).toHaveAttribute(
      "title",
      labelDescription,
    );

    rerender(
      <LocaleProvider>
        <IconSprite />
        <ProjectPreheatSection
          project="library"
          projectId={1}
          policies={[{ id: 61, name: "release-images", provider_id: 71 }]}
          providers={[{ id: 71, provider: "dragonfly" }]}
          pagination={{ page: 1, page_size: 50, total: 1 }}
          initialQuery=""
          errors={[]}
          onSearch={vi.fn()}
          onPageChange={vi.fn()}
          onAction={vi.fn()}
        />
      </LocaleProvider>,
    );

    table = screen.getByRole("table");
    expect(tableHeaders(table)).toEqual([
      "策略",
      "Provider",
      "筛选范围",
      "触发方式",
      "状态",
      "最近更新",
      "",
    ]);
    expect(screen.getByText("策略 #61")).toBeInTheDocument();
    expect(
      table.querySelector('.cell-icon use[href="#i-play"]'),
    ).not.toBeNull();
  });

  it("constrains immutable-rule boundary selectors without losing their value", () => {
    const selector = "acceptance-boundary-*" + "x".repeat(1003);
    renderLocalized(
      <ProjectRulesSection
        project="library"
        projectId={1}
        rules={[
          {
            id: 61,
            tag_selectors: [
              {
                kind: "doublestar",
                decoration: "matches",
                pattern: selector,
              },
            ],
            scope_selectors: {
              repository: [
                {
                  kind: "doublestar",
                  decoration: "repoMatches",
                  pattern: selector,
                },
              ],
            },
          },
        ]}
        labels={[]}
        metadata={{
          scope_selectors: [
            { kind: "doublestar", decorations: ["repoMatches"] },
          ],
          tag_selectors: [{ kind: "doublestar", decorations: ["matches"] }],
        }}
        onCreateRule={vi.fn()}
        onEditRule={vi.fn()}
        onDeleteRule={vi.fn()}
        onCreateLabel={vi.fn()}
        onEditLabel={vi.fn()}
        onDeleteLabel={vi.fn()}
      />,
    );

    screen
      .getAllByText(selector)
      .forEach((element) => expect(element).toHaveAttribute("title", selector));
  });
});
