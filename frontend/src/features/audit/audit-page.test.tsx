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
import type { AuditLog } from "../../app/models";
import { IconSprite } from "../../components/icons";
import {
  auditControlQuery,
  auditPath,
  auditQueryValue,
  AuditPage,
} from "./audit-page";

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
      auditPath(2, 20, {
        username: "ci-bot",
        resource: "platform/gateway",
        operation: "push",
        result: "success",
      }),
    ).toBe(
      "audit?username=ci-bot&resource=platform%2Fgateway&operation=push&result=success&page=2&page_size=20",
    );
    expect(
      auditPath(1, 50, {
        username: "",
        resource: "",
        operation: "",
        result: "",
      }),
    ).toBe("audit");
  });
});

describe("audit page", () => {
  it("renders the legacy filter geometry and shared seven-column audit table", async () => {
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
      <LocaleProvider>
        <IconSprite />
        <AuditPage
          route={parseHashRoute("#/audit")}
          demo
          refreshing={false}
          navigate={navigate}
          onRefresh={vi.fn()}
        />
      </LocaleProvider>,
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
      expect.any(AbortSignal),
    );

    fireEvent.change(screen.getByRole("searchbox", { name: "按用户名筛选" }), {
      target: { value: "release-engineer" },
    });
    fireEvent.click(screen.getByRole("button", { name: "筛选" }));
    expect(navigate).toHaveBeenCalledWith("audit?username=release-engineer");

    fireEvent.click(screen.getByRole("button", { name: "每页条数" }));
    fireEvent.click(screen.getByRole("option", { name: "每页 20 条" }));
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith("audit?page_size=20"),
    );

    fireEvent.click(screen.getByRole("button", { name: "按时间升序排序" }));
    expect(navigate).toHaveBeenCalledWith("audit?sort=op_time");
  });
});
