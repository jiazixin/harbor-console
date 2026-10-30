import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, controlApi } from "../../app/api-client";
import { parseConsoleRoute } from "../../app/console-route";
import type { ProjectQuota } from "../../app/models";
import { IconSprite } from "../../components/icon-sprite";
import { TestProviders } from "../../test/test-providers";
import { replaceText, setupUser } from "../../test/user";
import { AdministrationPage } from "./administration-page";
import {
  AdministrationDialog,
  type AdministrationAction,
} from "./administration-resource-dialogs";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderPage(hash: string, authMode = "db_auth", navigate = vi.fn()) {
  render(
    <TestProviders>
      <IconSprite />
      <AdministrationPage
        route={parseConsoleRoute(hash)}
        demo
        authMode={authMode}
        hasRootCertificate
        refreshing={false}
        navigate={navigate}
        onRefresh={vi.fn()}
        onNotice={vi.fn()}
      />
    </TestProviders>,
  );
  return navigate;
}

describe("administration resources", () => {
  it("loads users with the legacy Harbor query and preserves the resource table", async () => {
    const user = setupUser();
    const list = vi.spyOn(controlApi, "list").mockResolvedValue({
      items: [
        {
          user_id: 7,
          username: "release-admin",
          realname: "Release Admin",
          email: "release@example.com",
          sysadmin_flag: true,
          creation_time: "2026-07-31T08:00:00Z",
        },
      ],
      pagination: { page: 2, page_size: 20, total: 21 },
    });
    const navigate = renderPage("#/administration/users?page=2&q=release");

    expect(await screen.findByText("release-admin")).toBeVisible();
    expect(screen.getByText("release@example.com")).toHaveAttribute(
      "title",
      "release@example.com",
    );
    expect(screen.getByText("系统管理员")).toBeVisible();
    expect(screen.getByRole("button", { name: "新建本地用户" })).toBeVisible();
    expect(list).toHaveBeenCalledWith(
      "users",
      {
        page: 2,
        page_size: 20,
        sort: "username",
        q: "username=~release",
      },
      expect.any(AbortSignal) as unknown,
    );

    await replaceText(
      user,
      screen.getByRole("searchbox", { name: "按用户名搜索" }),
      "platform",
    );
    await user.click(screen.getByRole("button", { name: "搜索" }));
    expect(navigate).toHaveBeenCalledWith("administration/users?q=platform");
  });

  it("loads system robots, permission metadata, and all visible projects in parallel", async () => {
    const user = setupUser();
    const list = vi
      .spyOn(controlApi, "list")
      .mockImplementation((operation) => {
        if (operation === "projects") {
          return Promise.resolve({
            items: [{ name: "library", repo_count: 4 }],
            pagination: { page: 1, page_size: 100, total: 1 },
          });
        }
        return Promise.resolve({
          items: [
            {
              id: 3,
              name: "robot$global-mirror",
              level: "system",
              duration: -1,
              expires_at: -1,
              permissions: [
                {
                  kind: "system",
                  namespace: "/",
                  access: [{ resource: "user", action: "read" }],
                },
              ],
            },
          ],
          pagination: { page: 1, page_size: 20, total: 1 },
        });
      });
    vi.spyOn(controlApi, "data").mockResolvedValue({
      system: [{ resource: "user", action: "read" }],
      project: [{ resource: "repository", action: "pull" }],
    });

    renderPage("#/administration/robots");
    expect(await screen.findByText("robot$global-mirror")).toBeVisible();
    expect(screen.getByText("永不过期")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "编辑系统机器人" }));
    expect(
      screen.getByRole("dialog", { name: "编辑系统机器人" }),
    ).toBeVisible();
    expect(screen.getByText("系统权限")).toBeVisible();
    expect(screen.getByText("项目权限")).toBeVisible();
    expect(list).toHaveBeenCalledWith(
      "robots",
      {
        page: 1,
        page_size: 20,
        sort: "name",
        q: "Level=system",
      },
      expect.any(AbortSignal) as unknown,
    );
  });
});

describe("administration operations", () => {
  it("loads maintenance contracts and starts a manual full scan", async () => {
    const user = setupUser();
    const list = vi.spyOn(controlApi, "list").mockResolvedValue({
      items: [
        {
          id: 101,
          job_kind: "Manual",
          job_status: "Success",
          job_parameters: { dry_run: true, freed_space: 4096 },
          creation_time: "2026-08-01T08:00:00Z",
          update_time: "2026-08-01T08:01:00Z",
        },
      ],
      pagination: { page: 2, page_size: 10, total: 11 },
    });
    const data = vi
      .spyOn(controlApi, "data")
      .mockImplementation((operation) => {
        if (operation === "scan-all-metrics") {
          return Promise.resolve({ total: 12, completed: 10 });
        }
        return Promise.resolve({
          id: 1,
          schedule: {
            type: "Daily",
            cron: "0 0 2 * * *",
            next_scheduled_time: "2026-08-02T02:00:00Z",
          },
        });
      });
    const mutate = vi.spyOn(controlApi, "mutate").mockResolvedValue(undefined);

    renderPage("#/administration/maintenance?page=2");

    expect(await screen.findByText("垃圾清理执行历史")).toBeVisible();
    expect(screen.getByText("最近进度 10 / 12")).toBeVisible();
    expect(list).toHaveBeenCalledWith(
      "gc-history",
      { page: 2, page_size: 10, sort: "-creation_time" },
      expect.any(AbortSignal) as unknown,
    );
    expect(data).toHaveBeenCalledWith(
      "scan-all-metrics",
      {},
      expect.any(AbortSignal) as unknown,
    );

    await user.click(screen.getByRole("button", { name: "立即扫描" }));
    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith({
        operation: "scan-all-schedule",
        parameters: {},
        method: "POST",
        payload: {
          schedule: { type: "Manual" },
        },
        signal: expect.any(AbortSignal) as unknown,
        idempotencyKey: expect.any(String) as unknown,
      });
    });
  });

  it("explains that a full scan needs a scanner when Harbor reports none", async () => {
    const user = setupUser();
    vi.spyOn(controlApi, "list").mockResolvedValue({
      items: [],
      pagination: { page: 1, page_size: 10, total: 0 },
    });
    vi.spyOn(controlApi, "data").mockImplementation((operation) =>
      operation.startsWith("scan-all")
        ? Promise.reject(
            new ApiError("Harbor precondition failed", {
              status: 412,
              code: "harbor_precondition_failed",
              requestId: "",
              details: {
                harbor_message:
                  "No scanner is configured; scanning cannot be performed.",
              },
            }),
          )
        : Promise.resolve({ id: 1, schedule: { type: "None" } }),
    );
    const navigate = renderPage("#/administration/maintenance");

    expect(
      await screen.findByText(
        "尚未配置默认扫描器，无法执行全量漏洞扫描。请先在制品安全中注册扫描器。",
      ),
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: "立即扫描" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "前往扫描器" }));
    expect(navigate).toHaveBeenCalledWith("security/scanners");
  });

  it("loads audit purge data and submits the legacy manual payload", async () => {
    const user = setupUser();
    vi.spyOn(controlApi, "list").mockResolvedValue({
      items: [],
      pagination: { page: 1, page_size: 20, total: 0 },
    });
    vi.spyOn(controlApi, "data").mockImplementation((operation) => {
      if (operation === "audit-log-events") {
        return Promise.resolve([
          { event_type: "create_artifact" },
          { event_type: "delete_artifact" },
        ]);
      }
      return Promise.resolve({
        id: 1,
        schedule: { type: "Weekly", cron: "0 0 1 * * 0" },
        parameters: { audit_retention_hour: 720, dry_run: false },
      });
    });
    const mutate = vi.spyOn(controlApi, "mutate").mockResolvedValue(undefined);

    renderPage("#/administration/purge");

    expect(await screen.findByText("审计清理执行历史")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "立即执行" }));
    expect(
      screen.getByRole("dialog", { name: "立即清理审计日志" }),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "开始执行" }));

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith({
        operation: "purge-schedule",
        parameters: {},
        method: "POST",
        payload: {
          schedule: { type: "Manual" },
          parameters: {
            audit_retention_hour: 720,
            dry_run: true,
            include_event_types: "create_artifact,delete_artifact",
          },
        },
        signal: expect.any(AbortSignal) as unknown,
        idempotencyKey: expect.any(String) as unknown,
      });
    });
  });

  it("loads Job Service queues and preserves queue action contracts", async () => {
    const user = setupUser();
    vi.spyOn(controlApi, "list").mockResolvedValue({
      items: [],
      pagination: { page: 1, page_size: 20, total: 0 },
    });
    vi.spyOn(controlApi, "data").mockImplementation((operation) => {
      if (operation === "jobservice-queues") {
        return Promise.resolve([
          { job_type: "IMAGE_SCAN", count: 3, latency: 18, paused: false },
        ]);
      }
      return Promise.resolve([]);
    });
    const mutate = vi.spyOn(controlApi, "mutate").mockResolvedValue(undefined);

    renderPage("#/administration/jobs");

    expect(await screen.findByText("IMAGE_SCAN")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "暂停队列" }));
    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith({
        operation: "jobservice-queue",
        parameters: { type: "IMAGE_SCAN" },
        method: "PUT",
        payload: { action: "pause" },
        signal: expect.any(AbortSignal) as unknown,
        idempotencyKey: undefined,
      });
    });
  });
});

describe("administration configuration", () => {
  it("tests LDAP and saves only the selected authentication mode fields", async () => {
    const user = setupUser();
    vi.spyOn(controlApi, "data").mockImplementation((operation) => {
      if (operation === "configurations") {
        return Promise.resolve({
          auth_mode: { value: "db_auth", editable: true },
          primary_auth_mode: { value: false, editable: true },
          self_registration: { value: true, editable: false },
          ldap_url: { value: "", editable: true },
          ldap_timeout: { value: 5, editable: true },
          ldap_search_dn: { value: "", editable: true },
          ldap_search_password: { value: "", editable: true },
          ldap_base_dn: { value: "", editable: true },
          ldap_filter: { value: "", editable: true },
          ldap_uid: { value: "uid", editable: true },
          ldap_scope: { value: 2, editable: true },
          ldap_group_base_dn: { value: "", editable: true },
          ldap_group_search_filter: { value: "", editable: true },
          ldap_group_attribute_name: { value: "cn", editable: true },
          ldap_group_admin_dn: { value: "", editable: true },
          ldap_group_membership_attribute: {
            value: "memberOf",
            editable: true,
          },
          ldap_group_search_scope: { value: 2, editable: true },
          ldap_group_attach_parallel: { value: false, editable: true },
          ldap_verify_cert: { value: true, editable: true },
        });
      }
      if (operation === "system-cve-allowlist")
        return Promise.resolve({ expires_at: null, items: [] });
      return Promise.resolve([]);
    });
    const mutate = vi
      .spyOn(controlApi, "mutate")
      .mockResolvedValue({ success: true });

    renderPage("#/administration/configuration?tab=auth");
    const mode = await screen.findByRole("button", { name: "认证模式" });
    await user.click(mode);
    await user.click(screen.getByRole("option", { name: "LDAP" }));
    await replaceText(
      user,
      screen.getByRole("textbox", { name: "LDAP 地址" }),
      "ldaps://ldap.example.com:636",
    );
    await replaceText(
      user,
      screen.getByRole("textbox", { name: "用户 Base DN" }),
      "ou=users,dc=example,dc=com",
    );

    await user.click(screen.getByRole("button", { name: "测试连接" }));
    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith({
        operation: "ldap-ping",
        parameters: {},
        method: "POST",
        payload: {
          ldap_url: "ldaps://ldap.example.com:636",
          ldap_search_dn: "",
          ldap_search_password: "",
          ldap_base_dn: "ou=users,dc=example,dc=com",
          ldap_filter: "",
          ldap_uid: "uid",
          ldap_scope: 2,
          ldap_connection_timeout: 5,
          ldap_verify_cert: true,
        },
        signal: expect.any(AbortSignal) as unknown,
        idempotencyKey: expect.any(String) as unknown,
      });
    });

    await user.click(screen.getByRole("button", { name: "保存认证配置" }));
    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith({
        operation: "configurations",
        parameters: {},
        method: "PUT",
        payload: {
          auth_mode: "ldap_auth",
          primary_auth_mode: false,
          ldap_url: "ldaps://ldap.example.com:636",
          ldap_timeout: 5,
          ldap_search_dn: "",
          ldap_base_dn: "ou=users,dc=example,dc=com",
          ldap_filter: "",
          ldap_uid: "uid",
          ldap_scope: 2,
          ldap_group_base_dn: "",
          ldap_group_search_filter: "",
          ldap_group_attribute_name: "cn",
          ldap_group_admin_dn: "",
          ldap_group_membership_attribute: "memberOf",
          ldap_group_search_scope: 2,
          ldap_group_attach_parallel: false,
          ldap_verify_cert: true,
        },
        signal: expect.any(AbortSignal) as unknown,
        idempotencyKey: undefined,
      });
    });
  });

  it("normalizes and saves the administration system CVE allowlist", async () => {
    const user = setupUser();
    vi.spyOn(controlApi, "data").mockImplementation((operation) => {
      if (operation === "configurations") return Promise.resolve({});
      if (operation === "system-cve-allowlist") {
        return Promise.resolve({
          expires_at: null,
          items: [{ cve_id: "CVE-2026-1842" }],
        });
      }
      return Promise.resolve([]);
    });
    const mutate = vi.spyOn(controlApi, "mutate").mockResolvedValue(undefined);

    renderPage("#/administration/configuration?tab=security");
    const editor = await screen.findByRole("textbox", { name: "CVE 编号" });
    await replaceText(
      user,
      editor,
      "cve-2026-1842\nCVE-2025-52881\nCVE-2026-1842",
    );
    await user.click(screen.getByRole("button", { name: "保存安全配置" }));

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith({
        operation: "system-cve-allowlist",
        parameters: {},
        method: "PUT",
        payload: {
          expires_at: null,
          items: [{ cve_id: "CVE-2026-1842" }, { cve_id: "CVE-2025-52881" }],
        },
        signal: expect.any(AbortSignal) as unknown,
        idempotencyKey: undefined,
      });
    });
  });

  it("saves system settings without writing locked configuration fields", async () => {
    const user = setupUser();
    vi.spyOn(controlApi, "data").mockImplementation((operation) => {
      if (operation === "configurations") {
        return Promise.resolve({
          project_creation_restriction: { value: "adminonly", editable: true },
          token_expiration: { value: 30, editable: true },
          session_timeout: { value: 60, editable: true },
          robot_name_prefix: { value: "robot$", editable: true },
          robot_token_duration: { value: 90, editable: true },
          read_only: { value: false, editable: true },
          notification_enable: { value: true, editable: true },
          scanner_skip_update_pulltime: { value: false, editable: true },
          quota_per_project_enable: { value: true, editable: true },
          storage_per_project: { value: 10 * 1024 ** 3, editable: true },
          audit_log_forward_endpoint: { value: "", editable: true },
          skip_audit_log_database: { value: false, editable: true },
          disabled_audit_log_event_types: {
            value: "delete_artifact",
            editable: true,
          },
          banner_message: { value: "", editable: false },
        });
      }
      if (operation === "system-cve-allowlist")
        return Promise.resolve({ expires_at: null, items: [] });
      return Promise.resolve([
        { event_type: "create_artifact" },
        { event_type: "delete_artifact" },
      ]);
    });
    const mutate = vi.spyOn(controlApi, "mutate").mockResolvedValue(undefined);

    renderPage("#/administration/configuration?tab=system");
    expect(await screen.findByText("Harbor 根证书")).toBeVisible();
    await user.click(screen.getByRole("checkbox", { name: /只读模式/ }));
    await user.click(
      screen.getByRole("checkbox", { name: /删除制品.*delete_artifact/ }),
    );
    await user.click(screen.getByRole("button", { name: "保存系统设置" }));

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith({
        operation: "configurations",
        parameters: {},
        method: "PUT",
        payload: {
          project_creation_restriction: "adminonly",
          robot_name_prefix: "robot$",
          audit_log_forward_endpoint: "",
          token_expiration: 30,
          session_timeout: 60,
          robot_token_duration: 90,
          read_only: true,
          notification_enable: true,
          scanner_skip_update_pulltime: false,
          quota_per_project_enable: true,
          skip_audit_log_database: false,
          storage_per_project: 10 * 1024 ** 3,
          disabled_audit_log_event_types: "",
        },
        signal: expect.any(AbortSignal) as unknown,
        idempotencyKey: undefined,
      });
    });
  });
});

describe("administration dialogs", () => {
  it("persists the disabled state after creating a system robot", async () => {
    const user = setupUser();
    const credential = {
      id: 63,
      name: "robot$acceptance-system",
      secret: "one-time-secret",
    };
    const mutate = vi
      .spyOn(controlApi, "mutate")
      .mockResolvedValueOnce(credential)
      .mockResolvedValueOnce(undefined);

    render(
      <TestProviders>
        <IconSprite />
        <AdministrationDialog
          action={{ kind: "create-robot" }}
          authMode="db_auth"
          permissionMetadata={{
            system: [{ resource: "user", action: "read" }],
          }}
          projects={[]}
          onClose={vi.fn()}
          onCompleted={vi.fn()}
          onNotice={vi.fn()}
        />
      </TestProviders>,
    );

    await replaceText(
      user,
      screen.getByRole("textbox", { name: "账号名称" }),
      "acceptance-system",
    );
    await user.click(screen.getByRole("checkbox", { name: "查看" }));
    await user.click(screen.getByRole("checkbox", { name: /停用账号/ }));
    await user.click(screen.getByRole("button", { name: "创建账号" }));

    await waitFor(() =>
      expect(screen.getByText("one-time-secret")).toBeVisible(),
    );
    const payload = {
      name: "acceptance-system",
      description: "",
      level: "system",
      duration: 90,
      disable: true,
      permissions: [
        {
          kind: "system",
          namespace: "/",
          access: [{ resource: "user", action: "read", effect: "allow" }],
        },
      ],
    };
    expect(mutate).toHaveBeenNthCalledWith(1, {
      operation: "robots",
      parameters: {},
      method: "POST",
      payload: payload,
      signal: expect.any(AbortSignal) as unknown,
      idempotencyKey: expect.any(String) as unknown,
    });
    expect(mutate).toHaveBeenNthCalledWith(2, {
      operation: "robot",
      parameters: { id: 63 },
      method: "PUT",
      payload: {
        name: "robot$acceptance-system",
        description: "",
        level: "system",
        duration: 90,
        disable: true,
        permissions: payload.permissions,
      },
      signal: expect.any(AbortSignal) as unknown,
      idempotencyKey: undefined,
    });
  });

  it("uses Harbor's 128-character global label name boundary", () => {
    const action: AdministrationAction = { kind: "create-label" };

    render(
      <TestProviders>
        <IconSprite />
        <AdministrationDialog
          action={action}
          authMode="db_auth"
          permissionMetadata={{}}
          projects={[]}
          onClose={vi.fn()}
          onCompleted={vi.fn()}
          onNotice={vi.fn()}
        />
      </TestProviders>,
    );

    expect(screen.getByRole("textbox", { name: "标签名称" })).toHaveAttribute(
      "maxlength",
      "128",
    );
  });

  it("updates a quota and verifies the persisted Harbor value", async () => {
    const user = setupUser();
    const quota: ProjectQuota = {
      id: 9,
      ref: { id: 2, name: "library" },
      hard: { storage: 5 * 1024 ** 3 },
    };
    const mutate = vi.spyOn(controlApi, "mutate").mockResolvedValue(undefined);
    vi.spyOn(controlApi, "data").mockResolvedValue({
      ...quota,
      hard: { storage: 10 * 1024 ** 3 },
    });
    const completed = vi.fn();
    const action: AdministrationAction = { kind: "edit-quota", quota };

    render(
      <TestProviders>
        <IconSprite />
        <AdministrationDialog
          action={action}
          authMode="db_auth"
          permissionMetadata={{}}
          projects={[]}
          onClose={vi.fn()}
          onCompleted={completed}
          onNotice={vi.fn()}
        />
      </TestProviders>,
    );

    await replaceText(
      user,
      screen.getByRole("spinbutton", { name: "存储上限（GB）" }),
      "10",
    );
    await user.click(screen.getByRole("button", { name: "保存配额" }));

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith({
        operation: "quota",
        parameters: { id: 9 },
        method: "PUT",
        payload: {
          hard: { storage: 10 * 1024 ** 3 },
        },
        signal: expect.any(AbortSignal) as unknown,
        idempotencyKey: undefined,
      });
    });
    expect(completed).toHaveBeenCalledWith("项目配额已更新");
  });
});
