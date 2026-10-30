import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { controlApi } from "../../app/api-client";
import type { ProjectSummary } from "../../app/models";
import { IconSprite } from "../../components/icon-sprite";
import { TestProviders } from "../../test/test-providers";
import { replaceText, setupUser } from "../../test/user";
import { ProjectSettingsSection } from "./project-settings-section";

const project: ProjectSummary = {
  project_id: 1,
  name: "platform",
  owner_name: "demo-admin",
  metadata: {
    public: "false",
    auto_scan: "true",
    auto_sbom_generation: "false",
    prevent_vul: "true",
    severity: "high",
    reuse_sys_cve_allowlist: "true",
    enable_content_trust: "false",
    enable_content_trust_cosign: "true",
    future_policy: "preserved",
  },
  cve_allowlist: {
    project_id: 1,
    expires_at: null,
    items: [{ cve_id: "CVE-2026-1842" }],
  },
};

function renderSettings(onSaved = vi.fn(), onNotice = vi.fn()) {
  render(
    <TestProviders>
      <IconSprite />
      <ProjectSettingsSection
        project={project}
        settings={{
          scanner: {
            uuid: "00000000-0000-4000-8000-000000000001",
            name: "Trivy",
            is_default: true,
          },
          candidates: [
            {
              uuid: "00000000-0000-4000-8000-000000000001",
              name: "Trivy",
              is_default: true,
            },
            {
              uuid: "00000000-0000-4000-8000-000000000002",
              name: "Clair",
            },
          ],
          quota: {
            id: 1,
            ref: { id: 1, name: "platform" },
            hard: { storage: 20 * 1024 ** 3 },
          },
        }}
        onSaved={onSaved}
        onNotice={onNotice}
        onDelete={vi.fn()}
      />
    </TestProviders>,
  );
  return { onSaved, onNotice };
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("ProjectSettingsSection", () => {
  it("updates project metadata, quota, scanner, and an independent CVE allowlist with exact Harbor payloads", async () => {
    const user = setupUser();
    const mutation = vi
      .spyOn(controlApi, "mutate")
      .mockResolvedValue(undefined);
    vi.spyOn(controlApi, "data").mockResolvedValue({
      id: 1,
      hard: { storage: 21 * 1024 ** 3 },
    });
    const { onSaved } = renderSettings();

    expect(
      screen.getByRole("button", { name: "项目漏洞扫描器" }),
    ).toHaveTextContent("Trivy（系统默认）");

    await user.click(
      screen.getByRole("checkbox", { name: /继承系统 CVE 白名单/ }),
    );
    await replaceText(
      user,
      screen.getByRole("textbox", { name: /CVE 编号/ }),
      "cve-2026-1842, CVE-2026-9999",
    );
    await replaceText(
      user,
      screen.getByRole("spinbutton", { name: /存储配额（GiB）/ }),
      "21",
    );
    await user.click(screen.getByRole("button", { name: "项目漏洞扫描器" }));
    await user.click(screen.getByRole("option", { name: "Clair" }));
    await user.click(screen.getByRole("button", { name: "保存设置" }));

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled();
    });
    expect(mutation).toHaveBeenNthCalledWith(1, {
      operation: "project",
      parameters: { project: "platform" },
      method: "PUT",
      payload: {
        metadata: {
          public: "false",
          auto_scan: "true",
          auto_sbom_generation: "false",
          prevent_vul: "true",
          severity: "high",
          reuse_sys_cve_allowlist: "false",
          enable_content_trust: "false",
          enable_content_trust_cosign: "true",
          future_policy: "preserved",
        },
        cve_allowlist: {
          expires_at: null,
          items: [{ cve_id: "CVE-2026-1842" }, { cve_id: "CVE-2026-9999" }],
        },
      },
      signal: expect.any(AbortSignal) as unknown,
      idempotencyKey: undefined,
    });
    expect(mutation).toHaveBeenNthCalledWith(2, {
      operation: "quota",
      parameters: { id: 1 },
      method: "PUT",
      payload: {
        hard: { storage: 21 * 1024 ** 3 },
      },
      signal: expect.any(AbortSignal) as unknown,
      idempotencyKey: undefined,
    });
    expect(mutation).toHaveBeenNthCalledWith(3, {
      operation: "project-scanner",
      parameters: { project: "platform" },
      method: "PUT",
      payload: { uuid: "00000000-0000-4000-8000-000000000002" },
      signal: expect.any(AbortSignal) as unknown,
      idempotencyKey: undefined,
    });
    const projectPayload = mutation.mock.calls[0]?.[0].payload as Record<
      string,
      unknown
    >;
    expect(projectPayload).not.toHaveProperty("storage_limit");
    expect(projectPayload).not.toHaveProperty("registry_id");
    expect(projectPayload).not.toHaveProperty("project_name");
  });

  it("keeps an inherited allowlist out of the update payload", async () => {
    const user = setupUser();
    const mutation = vi
      .spyOn(controlApi, "mutate")
      .mockResolvedValue(undefined);
    const { onSaved } = renderSettings();

    await user.click(screen.getByRole("button", { name: "保存设置" }));

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled();
    });
    expect(mutation).toHaveBeenCalledTimes(1);
    expect(mutation.mock.calls[0]?.[0].payload).not.toHaveProperty(
      "cve_allowlist",
    );
  });
});
