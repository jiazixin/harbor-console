import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Dashboard, Session } from "../../app/models";
import { IconSprite } from "../../components/icon-sprite";
import { TestProviders } from "../../test/test-providers";
import { setupUser } from "../../test/user";
import { OverviewPage } from "./overview-page";

const session: Session = {
  connection_id: "demo",
  instance_url: "https://harbor.demo.local",
  username: "demo-admin",
  demo: true,
  instance_count: 1,
  expires_at: "2026-08-04T00:00:00Z",
};

const dashboard: Dashboard = {
  health: { status: "healthy" },
  systeminfo: { harbor_version: "v2.15.2" },
  statistics: {
    total_project_count: 2,
    private_project_count: 1,
    total_repo_count: 5,
    public_repo_count: 2,
    total_storage_consumption: 1073741824,
  },
  projects: [
    {
      name: "library",
      storage_used: 1073741824,
      repo_count: 4,
      artifact_count: 12,
    },
    { name: "sandbox", storage_used: 0, repo_count: 1, artifact_count: 2 },
  ],
  replications: [],
  replication_policies: [],
};

describe("OverviewPage", () => {
  it("renders the visual-contract statistics and switches asset metrics", async () => {
    const user = setupUser();
    render(
      <TestProviders>
        <IconSprite />
        <OverviewPage
          session={session}
          dashboard={dashboard}
          refreshing={false}
          onRefresh={vi.fn()}
        />
      </TestProviders>,
    );

    expect(
      screen.getByRole("heading", { name: "实例概览" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("1.0 GiB")).toHaveLength(3);
    await user.click(screen.getByRole("button", { name: "项目资产排序" }));
    await user.click(screen.getByRole("option", { name: "仓库数量" }));
    expect(screen.getByText("按镜像仓库数量排序")).toBeInTheDocument();
  });

  it("keeps the recent replication duration header and cells on one axis", () => {
    render(
      <TestProviders>
        <IconSprite />
        <OverviewPage
          session={session}
          dashboard={{
            ...dashboard,
            replications: [
              {
                id: 26370,
                policy_id: 1,
                trigger: "scheduled",
                status: "succeed",
                succeed: 1,
                failed: 0,
                in_progress: 0,
                start_time: "2026-08-05T12:00:00Z",
                end_time: "2026-08-05T12:00:06Z",
              },
            ],
            replication_policies: [{ id: 1, name: "daily-sync" }],
          }}
          refreshing={false}
          onRefresh={vi.fn()}
        />
      </TestProviders>,
    );

    expect(screen.getByRole("columnheader", { name: "耗时" })).toHaveClass(
      "hc_8b938f52_tableCellTime",
    );
    expect(screen.getByRole("cell", { name: "6 秒" })).toHaveClass(
      "hc_8b938f52_tableCellTime",
    );
  });
});
