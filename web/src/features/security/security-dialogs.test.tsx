import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { controlApi } from "../../app/api-client";
import { IconSprite } from "../../components/icon-sprite";
import { TestProviders } from "../../test/test-providers";
import { replaceText, setupUser } from "../../test/user";
import { CveExportDialog } from "./cve-export-dialog";
import { ScannerDialog } from "./scanner-dialog";
import { SystemAllowlistDialog } from "./system-allowlist-dialog";

function renderDialog(node: React.ReactNode) {
  return render(
    <TestProviders>
      <IconSprite />
      {node}
    </TestProviders>,
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("security dialogs", () => {
  it("registers a scanner with the Harbor adapter payload", async () => {
    const user = setupUser();
    const mutate = vi.spyOn(controlApi, "mutate").mockResolvedValue(undefined);
    const saved = vi.fn();
    renderDialog(<ScannerDialog onClose={vi.fn()} onSaved={saved} />);

    expect(screen.getByRole("textbox", { name: "名称" })).toHaveAttribute(
      "maxlength",
      "128",
    );
    expect(screen.getByRole("textbox", { name: "适配器地址" })).toHaveAttribute(
      "maxlength",
      "512",
    );
    expect(screen.getByLabelText("访问凭据")).toHaveAttribute(
      "maxlength",
      "512",
    );

    await replaceText(
      user,
      screen.getByRole("textbox", { name: "名称" }),
      "Trivy",
    );
    await replaceText(
      user,
      screen.getByRole("textbox", { name: "适配器地址" }),
      "http://scanner:8080",
    );
    await user.click(screen.getByRole("button", { name: "注册扫描器" }));

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledOnce();
    });
    expect(mutate).toHaveBeenCalledWith({
      operation: "scanners",
      parameters: {},
      method: "POST",
      payload: {
        name: "Trivy",
        description: "",
        url: "http://scanner:8080",
        auth: "",
        access_credential: "",
        disabled: false,
        skip_certVerify: false,
        use_internal_addr: false,
      },
      signal: expect.any(AbortSignal) as unknown,
      idempotencyKey: expect.any(String) as unknown,
    });
    expect(saved).toHaveBeenCalledOnce();
  });

  it("keeps the first scanner enabled because Harbor makes it default", async () => {
    const user = setupUser();
    const mutate = vi.spyOn(controlApi, "mutate").mockResolvedValue(undefined);
    renderDialog(
      <ScannerDialog canDisable={false} onClose={vi.fn()} onSaved={vi.fn()} />,
    );

    const disabled = screen.getByRole("checkbox", { name: "停用扫描器" });
    expect(disabled).toBeDisabled();
    await replaceText(
      user,
      screen.getByRole("textbox", { name: "名称" }),
      "Trivy",
    );
    await replaceText(
      user,
      screen.getByRole("textbox", { name: "适配器地址" }),
      "http://scanner:8080",
    );
    await user.click(screen.getByRole("button", { name: "注册扫描器" }));

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledOnce();
    });
    expect(mutate.mock.calls[0]?.[0].payload).toMatchObject({
      disabled: false,
    });
  });

  it("does not allow a default scanner to be disabled while editing", async () => {
    const user = setupUser();
    const mutate = vi.spyOn(controlApi, "mutate").mockResolvedValue(undefined);
    renderDialog(
      <ScannerDialog
        scanner={{
          uuid: "scanner-1",
          name: "Trivy",
          url: "http://scanner:8080",
          disabled: true,
          is_default: true,
        }}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    expect(screen.getByRole("checkbox", { name: "停用扫描器" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "保存扫描器" }));

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledOnce();
    });
    expect(mutate.mock.calls[0]?.[0].payload).toMatchObject({
      disabled: false,
    });
  });

  it("normalizes and saves the system CVE allowlist", async () => {
    const user = setupUser();
    const mutate = vi.spyOn(controlApi, "mutate").mockResolvedValue(undefined);
    renderDialog(
      <SystemAllowlistDialog
        allowlist={{ expires_at: null, items: [] }}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    await replaceText(
      user,
      screen.getByRole("textbox", { name: "CVE 编号" }),
      "cve-2026-1842\nCVE-2026-1842\nCVE-2025-52881",
    );
    await user.click(screen.getByRole("button", { name: "保存白名单" }));

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

  it("creates a typed single-project CVE export", async () => {
    const user = setupUser();
    const mutate = vi
      .spyOn(controlApi, "mutate")
      .mockResolvedValue({ id: 501 });
    const created = vi.fn();
    renderDialog(
      <CveExportDialog
        projects={[{ project_id: 1, name: "platform" }]}
        onClose={vi.fn()}
        onCreated={created}
      />,
    );

    await replaceText(
      user,
      screen.getByRole("textbox", { name: "任务名称" }),
      "monthly-audit",
    );
    await replaceText(
      user,
      screen.getByRole("textbox", { name: "标签 ID" }),
      "12,18",
    );
    await user.click(screen.getByRole("button", { name: "创建导出任务" }));

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledOnce();
    });
    expect(mutate).toHaveBeenCalledWith({
      operation: "cve-export",
      parameters: {},
      method: "POST",
      payload: {
        projects: [1],
        labels: [12, 18],
        job_name: "monthly-audit",
      },
      signal: expect.any(AbortSignal) as unknown,
      idempotencyKey: expect.any(String) as unknown,
    });
    expect(created).toHaveBeenCalledWith(501);
  });
});
