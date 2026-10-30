import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuditLog } from "../../app/models";
import { IconSprite } from "../../components/icon-sprite";
import { TestProviders } from "../../test/test-providers";
import { replaceText, setupUser } from "../../test/user";
import { ProjectAuditSection } from "./project-audit-section";

const logs: AuditLog[] = [
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

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("ProjectAuditSection", () => {
  it("preserves the shared legacy audit columns, search, and result state", async () => {
    const user = setupUser();
    const onSearch = vi.fn();
    render(
      <TestProviders>
        <IconSprite />
        <ProjectAuditSection
          logs={logs}
          pagination={{ page: 1, page_size: 50, total: 1 }}
          initialQuery=""
          onSearch={onSearch}
          onPageChange={vi.fn()}
          onRetry={vi.fn()}
        />
      </TestProviders>,
    );

    expect(screen.getByText("#48320")).toBeInTheDocument();
    expect(screen.getByText("ci-bot")).toBeInTheDocument();
    expect(screen.getByText("platform/gateway:v3.18.4")).toBeInTheDocument();
    expect(screen.getByText("推送制品清单和数据层")).toBeInTheDocument();
    expect(screen.getByText("成功")).toBeInTheDocument();

    await replaceText(
      user,
      screen.getByRole("searchbox", { name: "按资源或用户筛选" }),
      " gateway ",
    );
    await user.click(screen.getByRole("button", { name: "搜索" }));
    expect(onSearch).toHaveBeenCalledWith("gateway");
    expect(
      screen.getAllByRole("columnheader").map((header) => header.textContent),
    ).toEqual(["时间", "用户", "事件", "结果", "资源类型", "资源", "记录编号"]);
  });
});
