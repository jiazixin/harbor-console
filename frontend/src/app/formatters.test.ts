import { describe, expect, it } from "vitest";

import {
  formatBytes,
  formatDate,
  formatDuration,
  formatNumber,
  formatTimestamp,
  instanceHost,
} from "./formatters";

describe("formatters", () => {
  it("formats numbers and byte sizes for both locales", () => {
    expect(formatNumber(12345, "en-US")).toBe("12,345");
    expect(formatBytes(1536, "en-US")).toBe("1.5 KB");
    expect(formatBytes(undefined, "zh-CN")).toBe("0 字节");
  });

  it("always includes the year and supports timestamps with seconds", () => {
    expect(formatDate("2025-06-15T12:30:00Z", "zh-CN")).toContain("2025");
    expect(formatTimestamp("2025-06-15T12:30:45Z", "en-US")).toMatch(
      /2025.*30.*45/,
    );
  });

  it("preserves invalid source values and localizes missing values", () => {
    expect(formatDate("not-a-date", "en-US")).toBe("not-a-date");
    expect(formatDate(undefined, "en-US")).toBe("N/A");
    expect(formatDate(undefined, "zh-CN")).toBe("暂无");
  });

  it("formats valid durations and rejects invalid ranges", () => {
    expect(
      formatDuration("2026-08-03T08:00:00Z", "2026-08-03T08:01:18Z", "en-US"),
    ).toBe("1 min 18 sec");
    expect(
      formatDuration("2026-08-03T08:01:00Z", "2026-08-03T08:00:00Z", "zh-CN"),
    ).toBe("暂无");
  });

  it("extracts the instance host without rejecting non-URL labels", () => {
    expect(instanceHost("https://harbor.example.com:8443/path")).toBe(
      "harbor.example.com:8443",
    );
    expect(instanceHost("local-harbor")).toBe("local-harbor");
  });
});
