import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, sessionApi } from "./app/api-client";
import { LocaleProvider } from "./app/locale-context";
import { ReactApplication } from "./app/react-application";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
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
});
