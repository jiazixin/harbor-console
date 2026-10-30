import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { first } from "../../test/first";
import { TestProviders } from "../../test/test-providers";
import { replaceText, setupUser } from "../../test/user";
import { LoginPage } from "./login-page";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.history.replaceState(null, "", window.location.href);
});

describe("LoginPage", () => {
  it("normalizes a pasted Harbor URL and submits the typed connection contract", async () => {
    const user = setupUser();
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          connection_id: "connection",
          instance_url: "http://harbor.example.com",
          username: "admin",
          demo: false,
          instance_count: 1,
          expires_at: "2026-08-04T00:00:00Z",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const authenticated = vi.fn();
    render(
      <TestProviders>
        <LoginPage onAuthenticated={authenticated} onNotice={vi.fn()} />
      </TestProviders>,
    );

    await replaceText(
      user,
      screen.getByPlaceholderText("harbor.example.com"),
      "http://harbor.example.com",
    );
    await replaceText(user, screen.getByPlaceholderText("admin"), "admin");
    await replaceText(user, screen.getByPlaceholderText("输入密码"), "secret");
    await user.click(screen.getByRole("button", { name: "连接实例" }));

    await waitFor(() => {
      expect(authenticated).toHaveBeenCalledOnce();
    });
    const [, init] = first(fetchMock.mock.calls);
    expect(typeof init?.body).toBe("string");
    const body = typeof init?.body === "string" ? init.body : "{}";
    expect(JSON.parse(body)).toEqual({
      url: "http://harbor.example.com",
      username: "admin",
      password: "secret",
      skip_tls_verify: false,
    });
  });

  it("switches visible copy without reloading the page", async () => {
    const user = setupUser();
    render(
      <TestProviders>
        <LoginPage onAuthenticated={() => undefined} onNotice={vi.fn()} />
      </TestProviders>,
    );
    await user.click(screen.getByRole("button", { name: "Switch to English" }));
    expect(
      screen.getByRole("heading", { name: "Connect your Harbor instance" }),
    ).toBeInTheDocument();
  });

  it("requires an address before entering the anonymous public catalog", async () => {
    const user = setupUser();
    render(
      <TestProviders>
        <LoginPage onAuthenticated={() => undefined} onNotice={vi.fn()} />
      </TestProviders>,
    );

    await user.click(screen.getByRole("button", { name: /浏览公开镜像目录/ }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "请先填写需要浏览的 Harbor 地址。",
    );
  });

  it("opens the React public catalog and calls only anonymous APIs", async () => {
    const user = setupUser();
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [{ project_id: 1, name: "library" }],
          pagination: { page: 1, page_size: 20, total: 1 },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(
      <TestProviders>
        <LoginPage onAuthenticated={() => undefined} onNotice={vi.fn()} />
      </TestProviders>,
    );
    await replaceText(
      user,
      screen.getByPlaceholderText("harbor.example.com"),
      "harbor.example.com",
    );

    await user.click(screen.getByRole("button", { name: /浏览公开镜像目录/ }));

    expect(
      await screen.findByRole("heading", { name: "公开项目" }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledOnce();
    });
    expect(first(fetchMock.mock.calls)[0]).toBe("/api/public/projects");
    expect(first(fetchMock.mock.calls)[1]).toMatchObject({ method: "POST" });
    expect(screen.queryByPlaceholderText("admin")).not.toBeInTheDocument();
  });
  it("rejects credentials in public catalog URLs before history or network access", async () => {
    const user = setupUser();
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);
    render(
      <TestProviders>
        <LoginPage onAuthenticated={vi.fn()} onNotice={vi.fn()} />
      </TestProviders>,
    );
    await replaceText(
      user,
      screen.getByPlaceholderText("harbor.example.com"),
      "https://user:private-password@harbor.example.com",
    );
    await user.click(screen.getByRole("button", { name: /浏览公开镜像目录/ }));
    expect(screen.getByRole("alert")).toBeVisible();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(JSON.stringify(window.history.state)).not.toContain(
      "private-password",
    );
    expect(window.location.href).not.toContain("private-password");
  });
});
