import { describe, expect, it } from "vitest";

import { createEnglishTranslator } from "./message-templates";

describe("createEnglishTranslator", () => {
  const translate = createEnglishTranslator([
    ["漏洞扫描", "Vulnerability scanning"],
    ["%s完成，%s 项失败", "%s finished; %s failed"],
    ["项目 %s 已创建", "Project %s created"],
    ["第 %d 页", "Page %d"],
  ]);

  it("translates exact messages and leaves unknown text unchanged", () => {
    expect(translate("漏洞扫描")).toBe("Vulnerability scanning");
    expect(translate("Already English")).toBe("Already English");
  });

  it("fills templates and translates embedded known messages", () => {
    expect(translate("项目 web 已创建")).toBe("Project web created");
    expect(translate("漏洞扫描完成，2 项失败")).toBe(
      "Vulnerability scanning finished; 2 failed",
    );
  });

  it("matches %d only against integers", () => {
    expect(translate("第 3 页")).toBe("Page 3");
    expect(translate("第 三 页")).toBe("第 三 页");
  });
});
