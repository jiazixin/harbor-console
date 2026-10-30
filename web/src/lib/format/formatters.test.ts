import { afterEach, describe, expect, it } from "vitest";
import {
  displayTimeZone,
  loadPreferences,
  savePreferences,
} from "../../app/preferences";
import {
  formatBytes,
  formatDate,
  formatDuration,
  formatItemRange,
  formatNumber,
  formatTimestamp,
  instanceHost,
} from "./formatters";

afterEach(() => {
  window.localStorage.clear();
});

describe("formatters", () => {
  it("formats numbers and byte sizes for both locales", () => {
    expect(formatNumber(12345, "en-US")).toBe("12,345");
    expect(formatBytes(1536, "en-US")).toBe("1.5 KiB");
    expect(formatBytes(undefined, "zh-CN")).toBe("—");
  });

  it("always includes the year and supports timestamps with seconds", () => {
    expect(
      formatDate("2025-06-15T12:30:00Z", {
        locale: "zh-CN",
        timeZone: displayTimeZone(),
      }),
    ).toContain("2025");
    expect(
      formatTimestamp("2025-06-15T12:30:45Z", {
        locale: "en-US",
        timeZone: displayTimeZone(),
      }),
    ).toMatch(/2025.*30.*45/);
  });

  it("uses a dash for invalid and missing values", () => {
    expect(
      formatDate("not-a-date", {
        locale: "en-US",
        timeZone: displayTimeZone(),
      }),
    ).toBe("—");
    expect(
      formatDate(undefined, { locale: "en-US", timeZone: displayTimeZone() }),
    ).toBe("—");
    expect(
      formatDate(undefined, { locale: "zh-CN", timeZone: displayTimeZone() }),
    ).toBe("—");
  });

  it("treats the Harbor zero timestamp as a missing value", () => {
    const zeroTime = "0001-01-01T00:00:00.000Z";
    expect(
      formatDate(zeroTime, { locale: "zh-CN", timeZone: displayTimeZone() }),
    ).toBe("—");
    expect(
      formatTimestamp(zeroTime, {
        locale: "en-US",
        timeZone: displayTimeZone(),
      }),
    ).toBe("—");
    expect(formatDuration(zeroTime, "2026-08-03T08:00:00Z", "en-US")).toBe("—");
  });

  it("formats valid durations and rejects invalid ranges", () => {
    expect(
      formatDuration("2026-08-03T08:00:00Z", "2026-08-03T08:01:18Z", "en-US"),
    ).toBe("1 min 18 sec");
    expect(
      formatDuration("2026-08-03T08:01:00Z", "2026-08-03T08:00:00Z", "zh-CN"),
    ).toBe("—");
  });

  it("summarizes item ranges and shows only the total for empty lists", () => {
    expect(
      formatItemRange({ start: 21, end: 40, total: 42, locale: "zh-CN" }),
    ).toBe("第 21-40 项，共 42 项");
    expect(
      formatItemRange({ start: 1, end: 2, total: 2, locale: "en-US" }),
    ).toBe("Items 1-2 of 2");
    expect(
      formatItemRange({ start: 0, end: 0, total: 0, locale: "zh-CN" }),
    ).toBe("共 0 项");
    expect(
      formatItemRange({ start: 1, end: 0, total: 0, locale: "en-US" }),
    ).toBe("0 items");
  });

  it("extracts the instance host without rejecting non-URL labels", () => {
    expect(instanceHost("https://harbor.example.com:8443/path")).toBe(
      "harbor.example.com:8443",
    );
    expect(instanceHost("local-harbor")).toBe("local-harbor");
  });

  it.each(["en-US", "zh-CN"] as const)(
    "applies the selected UTC or browser timezone to dates and timestamps in %s",
    (locale) => {
      const timestamp = "2025-06-15T12:30:45Z";
      savePreferences({ ...loadPreferences(), dateTimezone: "utc" });
      expect(
        formatDate(timestamp, { locale: locale, timeZone: displayTimeZone() }),
      ).toContain("12:30");
      expect(
        formatTimestamp(timestamp, {
          locale: locale,
          timeZone: displayTimeZone(),
        }),
      ).toContain("12:30:45");

      savePreferences({ ...loadPreferences(), dateTimezone: "local" });
      const options: Intl.DateTimeFormatOptions = {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      };
      expect(
        formatDate(timestamp, { locale: locale, timeZone: displayTimeZone() }),
      ).toBe(
        new Intl.DateTimeFormat(locale, options).format(new Date(timestamp)),
      );
      expect(
        formatTimestamp(timestamp, {
          locale: locale,
          timeZone: displayTimeZone(),
        }),
      ).toBe(
        new Intl.DateTimeFormat(locale, {
          ...options,
          second: "2-digit",
        }).format(new Date(timestamp)),
      );
    },
  );
});
