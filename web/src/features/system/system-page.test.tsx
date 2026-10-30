import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IconSprite } from "../../components/icon-sprite";
import { TestProviders } from "../../test/test-providers";
import { SystemPage } from "./system-page";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("system page", () => {
  it("loads volume data and renders the four legacy panels", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ storage: [{ total: 1024, free: 256 }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(
      <TestProviders>
        <IconSprite />
        <SystemPage
          session={{
            connection_id: "demo",
            instance_url: "https://harbor.demo.local",
            username: "demo-admin",
            demo: true,
            instance_count: 1,
            expires_at: "2026-08-03T12:00:00Z",
          }}
          dashboard={{
            health: {
              status: "healthy",
              components: [{ name: "core", status: "healthy" }],
            },
            systeminfo: {
              harbor_version: "v2.15.2",
              auth_mode: "oidc_auth",
              registry_url: "harbor.demo.local",
              project_creation_restriction: "adminonly",
            },
          }}
          refreshing={false}
          onRefresh={vi.fn()}
        />
      </TestProviders>,
    );

    expect(await screen.findByText("实例信息")).toBeVisible();
    expect(screen.getByText("核心组件")).toBeVisible();
    expect(screen.getByText("存储容量")).toBeVisible();
    expect(screen.getByText("连接会话")).toBeVisible();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/resources/volumes",
      expect.objectContaining({ credentials: "same-origin" }) as unknown,
    );
  });
});
