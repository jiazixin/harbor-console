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
import type { ProjectSummary } from "../../app/models";
import { IconSprite } from "../../components/icons";
import { SecurityPage } from "./security-page";

const projects: ProjectSummary[] = [
  { project_id: 1, name: "platform" },
  { project_id: 2, name: "commerce" },
];

function renderPage(hash: string, onAction = vi.fn(), navigate = vi.fn()) {
  return render(
    <LocaleProvider>
      <IconSprite />
      <SecurityPage
        route={parseHashRoute(hash)}
        projects={projects}
        totalArtifacts={42}
        demo
        refreshing={false}
        navigate={navigate}
        onRefresh={vi.fn()}
        onAction={onAction}
        onNotice={vi.fn()}
      />
    </LocaleProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("security page", () => {
  it("loads and renders the Harbor security summary", async () => {
    const data = vi.spyOn(controlApi, "data").mockResolvedValue({
      scanned_cnt: 30,
      total_vuls: 18,
      fixable_cnt: 12,
      critical_cnt: 2,
      high_cnt: 4,
      medium_cnt: 8,
      low_cnt: 4,
      dangerous_cves: [{ cve_id: "CVE-2026-1842", severity: "Critical" }],
      dangerous_artifacts: [],
    });

    renderPage("#/security/overview");

    expect(await screen.findByText("CVE-2026-1842")).toBeVisible();
    expect(data).toHaveBeenCalledWith(
      "security-summary",
      { with_dangerous_cve: true, with_dangerous_artifact: true },
      expect.any(AbortSignal),
    );
  });

  it("uses the exact vulnerability query and pagination contract", async () => {
    const list = vi.spyOn(controlApi, "list").mockResolvedValue({
      items: [],
      pagination: { page: 2, page_size: 50, total: 0 },
    });

    renderPage(
      "#/security/vulnerabilities?page=2&page_size=50&project=platform&severity=Critical&cve=CVE-2026-1842",
    );

    await waitFor(() => expect(list).toHaveBeenCalledOnce());
    expect(list).toHaveBeenCalledWith(
      "security-vulnerabilities",
      {
        page: 2,
        page_size: 50,
        q: "cve_id=CVE-2026-1842,severity=Critical,project_id=1",
        tune_count: true,
        with_tag: true,
      },
      expect.any(AbortSignal),
    );

    expect(screen.getByRole("button", { name: "每页条数" })).toHaveTextContent(
      "50 条",
    );
    expect(screen.getByText("第 0-0 项，共 0 项")).toBeVisible();
  });

  it("changes vulnerability page size from the legacy toolbar control", async () => {
    vi.spyOn(controlApi, "list").mockResolvedValue({
      items: [],
      pagination: { page: 1, page_size: 50, total: 0 },
    });
    const navigate = vi.fn();
    renderPage(
      "#/security/vulnerabilities?project=platform&severity=Critical",
      vi.fn(),
      navigate,
    );

    fireEvent.click(await screen.findByRole("button", { name: "每页条数" }));
    fireEvent.click(screen.getByRole("option", { name: "20 条" }));
    expect(navigate).toHaveBeenCalledWith(
      "security/vulnerabilities?project=platform&severity=Critical&page=1&page_size=20",
    );
  });

  it("opens the shared scanner registration dialog action", async () => {
    vi.spyOn(controlApi, "list").mockResolvedValue({
      items: [
        {
          uuid: "scanner-1",
          name: "Trivy",
          url: "http://scanner:8080",
        },
      ],
      pagination: { page: 1, page_size: 50, total: 1 },
    });
    const onAction = vi.fn();
    renderPage("#/security/scanners", onAction);

    fireEvent.click(await screen.findByRole("button", { name: "注册扫描器" }));
    expect(onAction).toHaveBeenCalledWith({
      kind: "create-scanner",
      canDisable: true,
    });
    expect(
      screen.getAllByRole("columnheader").map((header) => header.textContent),
    ).toEqual(["扫描器", "地址", "健康状态", "能力", "最近更新", ""]);
    expect(screen.getByText("scanner-1")).toBeVisible();
  });
});
