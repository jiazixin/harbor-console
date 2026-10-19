import { describe, expect, it } from "vitest";

import { translateServerMessage } from "./server-messages";

describe("server message translation", () => {
  it("keeps Chinese messages unchanged for the Chinese interface", () => {
    expect(translateServerMessage("会话已失效", "zh-CN")).toBe("会话已失效");
  });

  it("translates fixed and templated upstream errors", () => {
    expect(translateServerMessage("会话已失效", "en-US")).toBe(
      "Session expired",
    );
    expect(
      translateServerMessage(
        "请求不符合 Harbor API 要求：addition SBOM isn't supported",
        "en-US",
      ),
    ).toBe(
      "The request does not meet Harbor API requirements: addition SBOM isn't supported",
    );
    expect(
      translateServerMessage("Harbor 返回 502: bad gateway", "en-US"),
    ).toBe("Harbor returned 502: bad gateway");
  });

  it("translates nested validation messages and field labels", () => {
    expect(
      translateServerMessage(
        "第 2 条 Tag 保留规则无效：tag_selectors 必须包含 1 到 32 个选择器",
        "en-US",
      ),
    ).toBe(
      "Tag retention rule 2 is invalid: tag_selectors must contain 1 to 32 selectors",
    );
    expect(translateServerMessage("成员用户名不能为空", "en-US")).toBe(
      "Member username cannot be empty",
    );
    expect(
      translateServerMessage(
        "用户密码必须是 8 到 128 个字符，并至少包含一个大写字母、一个小写字母和一个数字",
        "en-US",
      ),
    ).toBe(
      "The user password must be 8 to 128 characters with at least one uppercase letter, one lowercase letter and one digit",
    );
  });

  it("returns unknown messages unchanged", () => {
    expect(translateServerMessage("unexpected upstream text", "en-US")).toBe(
      "unexpected upstream text",
    );
  });
});
