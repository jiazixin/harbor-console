import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ApiError,
  dashboardApi,
  identityApi,
  sessionApi,
} from "./app/api-client";
import { LocaleProvider } from "./app/locale-context";
import { ReactApplication } from "./app/react-application";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  window.history.replaceState(null, "", window.location.pathname);
  vi.restoreAllMocks();
});

describe("React application root", () => {
  it("renders the connection screen when no session is active", async () => {
    vi.spyOn(sessionApi, "current").mockRejectedValue(
      new ApiError("Unauthorized", 401),
    );
    render(
      <LocaleProvider>
        <ReactApplication />
      </LocaleProvider>,
    );

    expect(
      await screen.findByRole("heading", { name: "连接你的 Harbor 实例" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "使用演示数据预览" }),
    ).toBeInTheDocument();
    expect(document.title).toBe("连接实例 · Harbor 控制台");
  });

  it("offers navigation recovery for an unknown route", async () => {
    window.location.hash = "#/missing-page";
    vi.spyOn(sessionApi, "current").mockResolvedValue({
      connection_id: "primary",
      instance_url: "https://harbor.example.com",
      username: "admin",
      demo: false,
      instance_count: 1,
      expires_at: "2026-10-03T00:00:00Z",
    });
    vi.spyOn(dashboardApi, "load").mockResolvedValue({});
    vi.spyOn(identityApi, "current").mockResolvedValue({ username: "admin" });
    vi.spyOn(identityApi, "permissions").mockResolvedValue([]);
    render(
      <LocaleProvider>
        <ReactApplication />
      </LocaleProvider>,
    );

    expect(
      await screen.findByRole("heading", { name: "页面不存在" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "返回概览" }),
    ).toBeInTheDocument();
    expect(document.title).toBe("页面不存在 · Harbor 控制台");
  });
});
