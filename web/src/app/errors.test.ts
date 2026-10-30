import { afterEach, describe, expect, it } from "vitest";
import { ApiError } from "./api-client";
import { errorText, UserInputError } from "./errors";

afterEach(() => {
  window.localStorage.clear();
});

function failure(status: number, code: string, details = {}): ApiError {
  return new ApiError("failed", { status, code, requestId: "", details });
}

describe("errorText", () => {
  it("prefers the caller table, then the code catalog, then the status", () => {
    expect(
      errorText(failure(409, "harbor_conflict"), { harbor_conflict: "已存在" }),
    ).toBe("已存在");
    expect(errorText(failure(0, "network_unavailable"))).toBe(
      "无法连接控制台服务，请检查网络后重试",
    );
    expect(errorText(failure(0, "timeout"))).toBe("请求超时，请稍后重试");
    expect(errorText(failure(503, "unknown_code"))).not.toBe("");
  });

  it("keeps console-written messages and silences aborts", () => {
    expect(errorText(new UserInputError("请至少选择一个用户"))).toBe(
      "请至少选择一个用户",
    );
    expect(errorText(new Error("secret internal SQL"))).not.toContain("SQL");
    expect(errorText(new DOMException("aborted", "AbortError"))).toBe("");
  });
});
