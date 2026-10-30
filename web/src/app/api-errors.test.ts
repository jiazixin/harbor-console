import { describe, expect, it } from "vitest";
import { describeApiError, readApiErrorBody } from "./api-errors";

describe("API error text", () => {
  it("maps a code to Chinese and English text", () => {
    const body = readApiErrorBody({
      error: { code: "unauthenticated", message: "session expired or missing" },
    });
    expect(describeApiError(body, 401, "zh-CN")).toBe(
      "会话已失效，请重新连接 Harbor",
    );
    expect(describeApiError(body, 401, "en-US")).toBe(
      "Session expired. Reconnect to Harbor",
    );
  });

  it("fills details into the text", () => {
    const body = {
      code: "instance_limit_reached",
      message: "",
      details: { limit: 5 },
    };
    expect(describeApiError(body, 409, "zh-CN")).toBe(
      "实例数量已达上限，每个会话最多连接 5 个实例",
    );
  });

  it("describes field problems with labels and 1-based indexes", () => {
    const field = (path: string, reason: string) => ({
      code: "invalid_argument",
      message: "",
      details: { fields: [{ path, reason }] },
    });
    expect(
      describeApiError(field("project_name", "required"), 400, "zh-CN"),
    ).toBe("项目名称不能为空");
    expect(describeApiError(field("public", "not_boolean"), 400, "zh-CN")).toBe(
      "public 必须是布尔值",
    );
    expect(
      describeApiError(
        field("rules.1.tag_selectors", "invalid_count"),
        400,
        "en-US",
      ),
    ).toBe("Rules[2].tag_selectors has too few or too many entries");
    expect(
      describeApiError(field("url", "url_has_credentials"), 400, "zh-CN"),
    ).toBe("请在独立字段中输入用户名和密码");
  });

  it("keeps Harbor diagnostic messages out of the interface", () => {
    const body = {
      code: "harbor_conflict",
      message: "",
      details: { harbor_status: 409, harbor_message: "project already exists" },
    };
    expect(describeApiError(body, 409, "zh-CN")).toBe(
      "资源已存在或当前状态发生冲突",
    );
  });

  it("explains unconfirmed writes with the confirmation failure", () => {
    const body = {
      code: "harbor_write_unconfirmed",
      message: "",
      details: { reason: "harbor_timeout" },
    };
    expect(describeApiError(body, 504, "zh-CN")).toContain(
      "确认失败原因：Harbor 请求超时，请稍后重试",
    );
  });

  it("falls back to the status for unknown codes and bodies", () => {
    expect(
      describeApiError({ code: "something_new", message: "" }, 418, "zh-CN"),
    ).toBe("请求失败（418）");
    expect(readApiErrorBody("plain text")).toBeUndefined();
  });
});
