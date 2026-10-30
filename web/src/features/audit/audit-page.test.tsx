import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { controlApi } from "../../app/api-client";
import { auditQueryValue } from "../../app/audit-log";
import { parseConsoleRoute } from "../../app/console-route";
import type { AuditLog } from "../../app/models";
import { IconSprite } from "../../components/icon-sprite";
import { TestProviders } from "../../test/test-providers";
import { replaceText, setupUser } from "../../test/user";
import { auditControlQuery, AuditPage, auditPath } from "./audit-page";

const log: AuditLog = {
  id: 48320,
  username: "ci-bot",
  resource: "platform/gateway:v3.18.4",
  resource_type: "artifact",
  operation: "push",
  operation_description: "push artifact manifest and blobs",
  operation_result: true,
  op_time: "2026-07-28T06:42:05Z",
};

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("audit query contract", () => {
  it("uses the stable legacy Harbor filters without hidden date or sort fields", () => {
    expect(
      auditControlQuery({
        username: "release bot",
        resource: "platform/gateway",
        operation: "push",
        result: "failed",
      }),
    ).toBe(
      'username=~"release bot",resource=~platform/gateway,operation=push,op_result=false',
    );
    expect(auditQueryValue('release "bot"')).toBe('"release \\"bot\\""');
    expect(
      auditPath({
        page: 2,
        pageSize: 20,
        filters: {
          username: "ci-bot",
          resource: "platform/gateway",
          operation: "push",
          result: "success",
        },
      }),
    ).toBe(
      "audit?username=ci-bot&resource=platform%2Fgateway&operation=push&result=success&page=2&page_size=20",
    );
    expect(
      auditPath({
        page: 1,
        pageSize: 50,
        filters: {
          username: "",
          resource: "",
          operation: "",
          result: "",
        },
      }),
    ).toBe("audit");
  });
});

describe("audit page", () => {
  it("renders the legacy filter geometry and shared seven-column audit table", async () => {
    const user = setupUser();
    const list = vi.spyOn(controlApi, "list").mockResolvedValue({
      items: [log],
      pagination: { page: 1, page_size: 50, total: 1 },
    });
    vi.spyOn(controlApi, "data").mockResolvedValue([
      { event_type: "push" },
      { event_type: "scan" },
    ]);
    const navigate = vi.fn();

    render(
      <TestProviders>
        <IconSprite />
        <AuditPage
          route={parseConsoleRoute("#/audit")}
          demo
          refreshing={false}
          navigate={navigate}
          onRefresh={vi.fn()}
        />
      </TestProviders>,
    );

    expect(await screen.findByText("#48320")).toBeVisible();
    expect(
      screen.getAllByRole("columnheader").map((header) => header.textContent),
    ).toEqual(["时间", "用户", "事件", "结果", "资源类型", "资源", "记录编号"]);
    expect(
      screen.getByText(
        "推送制品清单与镜像层 [push artifact manifest and blobs]",
      ),
    ).toBeVisible();
    expect(list).toHaveBeenCalledWith(
      "audit-logs",
      { page: 1, page_size: 50, sort: "-op_time", q: "" },
      expect.any(AbortSignal) as unknown,
    );

    await replaceText(
      user,
      screen.getByRole("searchbox", { name: "按用户名筛选" }),
      "release-engineer",
    );
    await user.click(screen.getByRole("button", { name: "筛选" }));
    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith("audit?username=release-engineer");
    });

    await user.click(screen.getByRole("button", { name: "每页条数" }));
    await user.click(screen.getByRole("option", { name: "每页 20 条" }));
    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith("audit?page_size=20");
    });

    await user.click(screen.getByRole("button", { name: "按时间升序排序" }));
    expect(navigate).toHaveBeenCalledWith("audit?sort=op_time");
  });
});
