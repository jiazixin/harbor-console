import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { controlApi } from "../../app/api-client";
import { LocaleProvider } from "../../app/locale-context";
import { IconSprite } from "../../components/icons";
import {
  CveExportDialog,
  ScannerDialog,
  SystemAllowlistDialog,
} from "./security-dialogs";

function renderDialog(node: React.ReactNode) {
  return render(
    <LocaleProvider>
      <IconSprite />
      {node}
    </LocaleProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("security dialogs", () => {
  it("registers a scanner with the Harbor adapter payload", async () => {
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

    fireEvent.change(screen.getByRole("textbox", { name: "名称" }), {
      target: { value: "Trivy" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "适配器地址" }), {
      target: { value: "http://scanner:8080" },
    });
    fireEvent.click(screen.getByRole("button", { name: "注册扫描器" }));

    await waitFor(() => expect(mutate).toHaveBeenCalledOnce());
    expect(mutate).toHaveBeenCalledWith("scanners", {}, "POST", {
      name: "Trivy",
      description: "",
      url: "http://scanner:8080",
      auth: "",
      access_credential: "",
      disabled: false,
      skip_certVerify: false,
      use_internal_addr: false,
    });
    expect(saved).toHaveBeenCalledOnce();
  });

  it("keeps the first scanner enabled because Harbor makes it default", async () => {
    const mutate = vi.spyOn(controlApi, "mutate").mockResolvedValue(undefined);
    renderDialog(
      <ScannerDialog canDisable={false} onClose={vi.fn()} onSaved={vi.fn()} />,
    );

    const disabled = screen.getByRole("checkbox", { name: "停用扫描器" });
    expect(disabled).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox", { name: "名称" }), {
      target: { value: "Trivy" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "适配器地址" }), {
      target: { value: "http://scanner:8080" },
    });
    fireEvent.click(screen.getByRole("button", { name: "注册扫描器" }));

    await waitFor(() => expect(mutate).toHaveBeenCalledOnce());
    expect(mutate.mock.calls[0]?.[3]).toMatchObject({ disabled: false });
  });

  it("does not allow a default scanner to be disabled while editing", async () => {
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
    fireEvent.click(screen.getByRole("button", { name: "保存扫描器" }));

    await waitFor(() => expect(mutate).toHaveBeenCalledOnce());
    expect(mutate.mock.calls[0]?.[3]).toMatchObject({ disabled: false });
  });

  it("normalizes and saves the system CVE allowlist", async () => {
    const mutate = vi.spyOn(controlApi, "mutate").mockResolvedValue(undefined);
    renderDialog(
      <SystemAllowlistDialog
        allowlist={{ expires_at: null, items: [] }}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "CVE 编号" }), {
      target: { value: "cve-2026-1842\nCVE-2026-1842\nCVE-2025-52881" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存白名单" }));

    await waitFor(() =>
      expect(mutate).toHaveBeenCalledWith("system-cve-allowlist", {}, "PUT", {
        expires_at: null,
        items: [{ cve_id: "CVE-2026-1842" }, { cve_id: "CVE-2025-52881" }],
      }),
    );
  });

  it("creates a typed single-project CVE export", async () => {
    const mutate = vi
      .spyOn(controlApi, "mutate")
      .mockResolvedValue({ data: { id: 501 } });
    const created = vi.fn();
    renderDialog(
      <CveExportDialog
        projects={[{ project_id: 1, name: "platform" }]}
        onClose={vi.fn()}
        onCreated={created}
      />,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "任务名称" }), {
      target: { value: "monthly-audit" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "标签 ID" }), {
      target: { value: "12,18" },
    });
    fireEvent.click(screen.getByRole("button", { name: "创建导出任务" }));

    await waitFor(() => expect(mutate).toHaveBeenCalledOnce());
    expect(mutate).toHaveBeenCalledWith("cve-export", {}, "POST", {
      projects: [1],
      labels: [12, 18],
      job_name: "monthly-audit",
    });
    expect(created).toHaveBeenCalledWith(501);
  });
});
