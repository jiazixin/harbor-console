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
import { RegistryDialog } from "./registry-dialogs";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("registry dialogs", () => {
  it("creates a Harbor registry with the production API payload", async () => {
    const mutate = vi.spyOn(controlApi, "mutate").mockResolvedValue(undefined);
    const saved = vi.fn();
    render(
      <LocaleProvider>
        <IconSprite />
        <RegistryDialog
          adapters={["harbor"]}
          adapterInfos={{}}
          onClose={vi.fn()}
          onSaved={saved}
          onNotice={vi.fn()}
        />
      </LocaleProvider>,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "连接名称" }), {
      target: { value: "production" },
    });
    fireEvent.change(
      screen.getByRole("textbox", { name: /仓库地址（手工填写）/ }),
      { target: { value: "https://registry.example.com" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "创建连接" }));

    await waitFor(() => expect(mutate).toHaveBeenCalledOnce());
    expect(mutate).toHaveBeenCalledWith("registries", {}, "POST", {
      name: "production",
      description: "",
      type: "harbor",
      url: "https://registry.example.com",
      insecure: false,
      ca_certificate: "",
      credential: { type: "basic", access_key: "", access_secret: "" },
    });
    expect(saved).toHaveBeenCalledOnce();
  });
});
