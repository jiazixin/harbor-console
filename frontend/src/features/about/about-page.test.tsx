import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "../../app/locale-context";
import { IconSprite } from "../../components/icons";
import { AboutPage, harborSwaggerURL } from "./about-page";

const session = {
  connection_id: "live",
  instance_url: "https://harbor.example.com/base/",
  username: "admin",
  demo: false,
  instance_count: 1,
  expires_at: "2026-08-03T12:00:00Z",
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("about page", () => {
  it("builds the official Swagger URL from the current Harbor instance", () => {
    expect(harborSwaggerURL(session)).toBe(
      "https://harbor.example.com/base/devcenter-api-2.0/",
    );
    expect(harborSwaggerURL({ ...session, demo: true })).toBe("");
  });

  it("renders version and license data from /api/about", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            console: {
              version: "v1.0.0",
              commit: "abc123",
              build_date: "2026-08-03",
              deployment: "single-binary",
              offline: true,
            },
            harbor: {
              target_version: "v2.15.2",
              api_version: "v2.0",
              license: { name: "Apache License 2.0", spdx: "Apache-2.0" },
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ),
    );
    render(
      <LocaleProvider>
        <IconSprite />
        <AboutPage
          session={session}
          harborVersion="v2.15.2"
          refreshing={false}
          onRefresh={vi.fn()}
        />
      </LocaleProvider>,
    );

    expect(await screen.findByText("私有镜像仓库控制端")).toBeVisible();
    expect(screen.getByText("v1.0.0")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "打开官方 Swagger" }),
    ).toHaveAttribute(
      "href",
      "https://harbor.example.com/base/devcenter-api-2.0/",
    );
  });
});
