import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { controlApi, instanceApi, searchApi } from "../app/api-client";
import type {
  Dashboard,
  HarborIdentity,
  HarborInstance,
  Session,
} from "../app/models";
import { IconSprite } from "../components/icon-sprite";
import { TestProviders } from "../test/test-providers";
import { replaceText, setupUser } from "../test/user";
import { ApplicationShell } from "./application-shell";

const session: Session = {
  connection_id: "primary",
  instance_url: "https://harbor.example.com",
  username: "admin",
  demo: false,
  instance_count: 2,
  expires_at: "2026-08-04T00:00:00Z",
};

const identity: HarborIdentity = {
  user_id: 1,
  username: "admin",
  realname: "Harbor Admin",
  email: "admin@example.com",
  comment: "owner",
  sysadmin_flag: true,
};

const dashboard: Dashboard = {
  health: { status: "healthy" },
  systeminfo: { auth_mode: "db_auth" },
  warnings: [],
};

const instances: HarborInstance[] = [
  {
    connection_id: "primary",
    instance_url: "https://harbor.example.com",
    username: "admin",
    demo: false,
    active: true,
  },
  {
    connection_id: "secondary",
    instance_url: "https://mirror.example.com",
    username: "operator",
    demo: false,
    active: false,
  },
];

function renderShell(
  overrides: Partial<React.ComponentProps<typeof ApplicationShell>> = {},
) {
  const props: React.ComponentProps<typeof ApplicationShell> = {
    session,
    dashboard,
    identity,
    permissions: [],
    activeView: "overview",
    navigate: vi.fn(),
    onNotice: vi.fn(),
    onIdentityChanged: vi.fn(),
    onSessionChanged: vi.fn(),
    onLogout: vi.fn(),
    children: <div>Workspace content</div>,
    ...overrides,
  };
  render(
    <TestProviders>
      <IconSprite />
      <ApplicationShell {...props} />
    </TestProviders>,
  );
  return props;
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("ApplicationShell overlays", () => {
  it("uses the favicon brand, omits the duplicate instance card, and preserves navigation order", () => {
    const { container } = render(
      <TestProviders>
        <IconSprite />
        <ApplicationShell
          session={session}
          dashboard={dashboard}
          identity={identity}
          permissions={[]}
          activeView="overview"
          navigate={vi.fn()}
          onNotice={vi.fn()}
          onIdentityChanged={vi.fn()}
          onSessionChanged={vi.fn()}
          onLogout={vi.fn()}
        >
          <div>Workspace content</div>
        </ApplicationShell>
      </TestProviders>,
    );

    expect(
      container.querySelector(".hc_b1735595_brandMark img"),
    ).toHaveAttribute("src", "/favicon.svg");
    expect(container.querySelector(".instance-button")).toBeNull();
    expect(
      screen.getByRole("button", { name: "切换 Harbor 实例" }),
    ).toBeVisible();
    expect(
      Array.from(container.querySelectorAll(".hc_9a652fa2_primaryNav a")).map(
        (link) => link.textContent.trim(),
      ),
    ).toEqual([
      "概览",
      "项目中心",
      "镜像仓库",
      "制品安全",
      "复制管理",
      "远端仓库",
      "P2P 分发",
      "审计日志",
      "管理中心",
      "系统状态",
      "关于与 API",
    ]);
  });

  it("debounces global search, navigates to results, and restores focus", async () => {
    const user = setupUser();
    vi.spyOn(searchApi, "search").mockResolvedValue({
      project: [{ name: "platform" }],
      repository: [
        {
          project_name: "platform",
          repository_name: "gateway",
          artifact_count: 18,
        },
      ],
    });
    const navigate = vi.fn();
    renderShell({ navigate });

    const opener = screen.getByRole("button", { name: "全局搜索" });
    await user.click(opener);
    const input = await screen.findByPlaceholderText("搜索项目或仓库...");
    await replaceText(user, input, "pl");

    await waitFor(() => {
      expect(searchApi.search).toHaveBeenCalledWith(
        "pl",
        expect.any(AbortSignal) as unknown,
      );
    });
    await user.click(await screen.findByRole("button", { name: /platform/ }));
    expect(navigate).toHaveBeenCalledWith("projects/platform");
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it("supports slash, Escape, panel toggling, and panel focus restoration", async () => {
    const user = setupUser();
    renderShell();
    const searchOpener = screen.getByRole("button", { name: "全局搜索" });
    searchOpener.focus();
    await user.keyboard("/");
    const searchInput = await screen.findByPlaceholderText("搜索项目或仓库...");
    await waitFor(() => expect(searchInput).toHaveFocus());
    await user.keyboard("{Escape}");
    await waitFor(() => expect(searchOpener).toHaveFocus());

    const accountOpener = screen.getByRole("button", { name: "账户" });
    await user.click(accountOpener);
    expect(
      await screen.findByRole("button", { name: /编辑个人资料/ }),
    ).toHaveFocus();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(accountOpener).toHaveFocus());
  });

  it("updates the current user profile with the exact Harbor payload", async () => {
    const user = setupUser();
    const mutate = vi.spyOn(controlApi, "mutate").mockResolvedValue(undefined);
    const onIdentityChanged = vi.fn();
    renderShell({ onIdentityChanged });

    await user.click(screen.getByRole("button", { name: "账户" }));
    await user.click(
      await screen.findByRole("button", { name: /编辑个人资料/ }),
    );
    await replaceText(
      user,
      screen.getByRole("textbox", { name: "姓名" }),
      "Release Admin",
    );
    await replaceText(
      user,
      screen.getByRole("textbox", { name: "邮箱" }),
      "release@example.com",
    );
    await replaceText(
      user,
      screen.getByRole("textbox", { name: "备注" }),
      "release owner",
    );
    await user.click(screen.getByRole("button", { name: "保存资料" }));

    await waitFor(() => {
      expect(onIdentityChanged).toHaveBeenCalled();
    });
    expect(mutate).toHaveBeenCalledWith({
      operation: "user",
      parameters: { id: 1 },
      method: "PUT",
      payload: {
        realname: "Release Admin",
        email: "release@example.com",
        comment: "release owner",
      },
      signal: expect.any(AbortSignal) as unknown,
      idempotencyKey: undefined,
    });
    expect(onIdentityChanged).toHaveBeenCalledWith(
      expect.objectContaining({
        realname: "Release Admin",
        email: "release@example.com",
        comment: "release owner",
      }) as unknown,
      "个人资料已更新",
    );
  });

  it("lists, switches, adds, and removes Harbor instances", async () => {
    const user = setupUser();
    vi.spyOn(instanceApi, "list").mockResolvedValue({
      active_id: "primary",
      items: instances,
      expires_at: session.expires_at,
    });
    const switchInstance = vi
      .spyOn(instanceApi, "switch")
      .mockResolvedValue({ ...session, connection_id: "secondary" });
    const addInstance = vi
      .spyOn(instanceApi, "add")
      .mockResolvedValue({ ...session, connection_id: "third" });
    const removeInstance = vi
      .spyOn(instanceApi, "remove")
      .mockResolvedValue(session);
    const onSessionChanged = vi.fn();
    renderShell({ onSessionChanged });

    const switcher = screen.getByRole("button", {
      name: "切换 Harbor 实例",
    });
    await user.click(switcher);
    await user.click(
      await screen.findByRole("button", {
        name: /operator · Harbor API v2/,
      }),
    );
    await waitFor(() => {
      expect(switchInstance).toHaveBeenCalledWith("secondary");
    });
    expect(onSessionChanged).toHaveBeenCalledWith(
      expect.objectContaining({ connection_id: "secondary" }) as unknown,
      "Harbor 实例已切换",
    );

    await user.click(switcher);
    await user.click(await screen.findByRole("button", { name: "新增实例" }));
    await replaceText(
      user,
      screen.getByRole("textbox", { name: "Harbor 地址" }),
      "third.example.com",
    );
    await replaceText(
      user,
      screen.getByRole("textbox", { name: "用户名" }),
      "release",
    );
    await replaceText(user, screen.getByLabelText("密码"), "Secret123");
    await user.click(screen.getByRole("button", { name: "验证并连接" }));
    await waitFor(() => {
      expect(addInstance).toHaveBeenCalled();
    });
    expect(addInstance).toHaveBeenCalledWith({
      url: "https://third.example.com",
      username: "release",
      password: "Secret123",
      skip_tls_verify: false,
    });

    await user.click(switcher);
    await user.click(
      await screen.findByRole("button", {
        name: "移除此实例 mirror.example.com",
      }),
    );
    await user.click(screen.getByRole("button", { name: "移除连接" }));
    await waitFor(() => {
      expect(removeInstance).toHaveBeenCalledWith("secondary");
    });
    expect(onSessionChanged).toHaveBeenLastCalledWith(
      session,
      "实例连接已移除",
    );
  });
});
