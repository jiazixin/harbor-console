import { describe, expect, it } from "vitest";

import { parseHarborLogLine } from "./structured-log";

describe("parseHarborLogLine", () => {
  it("normalizes WARNING without leaving prefix text", () => {
    expect(
      parseHarborLogLine(
        "2026-08-01T04:12:30Z [WARNING] storage is almost full",
      ),
    ).toEqual({
      time: "2026-08-01T04:12:30Z",
      level: "WARN",
      content: "storage is almost full",
    });
  });

  it("preserves WARN and unstructured lines", () => {
    expect(
      parseHarborLogLine("2026-08-01 04:12:30+08:00 WARN maintenance delayed"),
    ).toEqual({
      time: "2026-08-01 04:12:30+08:00",
      level: "WARN",
      content: "maintenance delayed",
    });
    expect(parseHarborLogLine("plain log line")).toEqual({
      time: "",
      level: "LOG",
      content: "plain log line",
    });
  });
});
