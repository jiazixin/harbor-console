import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "../../app/locale-context";
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
      <LocaleProvider>
        <LoginPage onAuthenticated={authenticated} onNotice={vi.fn()} />
      </LocaleProvider>,
    );

    fireEvent.change(screen.getByPlaceholderText("harbor.example.com"), {
      target: { value: "http://harbor.example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("admin"), {
      target: { value: "admin" },
    });
    fireEvent.change(screen.getByPlaceholderText("输入密码"), {
      target: { value: "secret" },
    });
    const form = screen
      .getByRole("button", { name: "连接实例" })
      .closest("form");
    expect(form).not.toBeNull();
    if (form) fireEvent.submit(form);

    await waitFor(() => expect(authenticated).toHaveBeenCalledOnce());
    const [, init] = fetchMock.mock.calls[0];
    expect(typeof init?.body).toBe("string");
    const body = typeof init?.body === "string" ? init.body : "{}";
    expect(JSON.parse(body)).toEqual({
      url: "http://harbor.example.com",
      username: "admin",
      password: "secret",
      skip_tls_verify: false,
    });
  });

  it("switches visible copy without reloading the page", () => {
    render(
      <LocaleProvider>
        <LoginPage onAuthenticated={() => undefined} onNotice={vi.fn()} />
      </LocaleProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Switch to English" }));
    expect(
      screen.getByRole("heading", { name: "Connect your Harbor instance" }),
    ).toBeInTheDocument();
  });

  it("requires an address before entering the anonymous public catalog", () => {
    render(
      <LocaleProvider>
        <LoginPage onAuthenticated={() => undefined} onNotice={vi.fn()} />
      </LocaleProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /浏览公开镜像目录/ }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "请先填写需要浏览的 Harbor 地址。",
    );
  });

  it("opens the React public catalog and calls only anonymous APIs", async () => {
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
      <LocaleProvider>
        <LoginPage onAuthenticated={() => undefined} onNotice={vi.fn()} />
      </LocaleProvider>,
    );
    fireEvent.change(screen.getByPlaceholderText("harbor.example.com"), {
      target: { value: "harbor.example.com" },
    });

    fireEvent.click(screen.getByRole("button", { name: /浏览公开镜像目录/ }));

    expect(
      await screen.findByRole("heading", { name: "公开项目" }),
    ).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(fetchMock.mock.calls[0][0]).toBe("/api/public/projects");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "POST" });
    expect(screen.queryByPlaceholderText("admin")).not.toBeInTheDocument();
  });
});
