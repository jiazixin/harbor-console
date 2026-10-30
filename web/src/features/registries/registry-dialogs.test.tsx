import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { controlApi } from "../../app/api-client";
import { IconSprite } from "../../components/icon-sprite";
import { TestProviders } from "../../test/test-providers";
import { replaceText, setupUser } from "../../test/user";
import { RegistryDialog } from "./registry-dialog";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("registry dialogs", () => {
  it("creates a Harbor registry with the production API payload", async () => {
    const user = setupUser();
    const mutate = vi.spyOn(controlApi, "mutate").mockResolvedValue(undefined);
    const saved = vi.fn();
    render(
      <TestProviders>
        <IconSprite />
        <RegistryDialog
          adapters={["harbor"]}
          adapterInfos={{}}
          onClose={vi.fn()}
          onSaved={saved}
          onNotice={vi.fn()}
        />
      </TestProviders>,
    );

    await replaceText(
      user,
      screen.getByRole("textbox", { name: "连接名称" }),
      "production",
    );
    await replaceText(
      user,
      screen.getByRole("textbox", { name: /仓库地址（手工填写）/ }),
      "https://registry.example.com",
    );
    await user.click(screen.getByRole("button", { name: "创建连接" }));

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledOnce();
    });
    expect(mutate).toHaveBeenCalledWith({
      operation: "registries",
      parameters: {},
      method: "POST",
      payload: {
        name: "production",
        description: "",
        type: "harbor",
        url: "https://registry.example.com",
        insecure: false,
        ca_certificate: "",
        credential: { type: "basic", access_key: "", access_secret: "" },
      },
      signal: expect.any(AbortSignal) as unknown,
      idempotencyKey: expect.any(String) as unknown,
    });
    expect(saved).toHaveBeenCalledOnce();
  });
});
