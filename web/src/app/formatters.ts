import type { Locale } from "./models";
import { loadPreferences } from "./preferences";

function finiteNumber(value: number | undefined): number {
  return Number.isFinite(value) ? Number(value) : 0;
}

export function formatNumber(
  value: number | undefined,
  locale: Locale,
): string {
  return new Intl.NumberFormat(locale).format(finiteNumber(value));
}

export function formatBytes(value: number | undefined, locale: Locale): string {
  const bytes = finiteNumber(value);
  const units =
    locale === "en-US"
      ? ["bytes", "KB", "MB", "GB", "TB", "PB"]
      : ["字节", "KB", "MB", "GB", "TB", "PB"];
  if (bytes <= 0) return `0 ${units[0]}`;
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const amount = bytes / 1024 ** index;
  return `${amount >= 10 || index === 0 ? amount.toFixed(0) : amount.toFixed(1)} ${units[index]}`;
}

// Harbor serializes "never happened" timestamps, such as the pull time of an
// artifact that was never pulled, as Go's zero time (0001-01-01T00:00:00Z).
const harborZeroTimeLimit = Date.UTC(1971, 0, 1);

function parseHarborTime(value: string | undefined): Date | null | "invalid" {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "invalid";
  return date.getTime() < harborZeroTimeLimit ? null : date;
}

function missingTimeLabel(locale: Locale): string {
  return locale === "en-US" ? "N/A" : "暂无";
}

export function formatDate(
  value: string | undefined,
  locale: Locale,
  includeTime = true,
): string {
  const date = parseHarborTime(value);
  if (date === null) return missingTimeLabel(locale);
  if (date === "invalid") return value ?? "";
  return new Intl.DateTimeFormat(locale, {
    timeZone: loadPreferences().dateTimezone === "utc" ? "UTC" : undefined,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(includeTime
      ? { hour: "2-digit", minute: "2-digit", hour12: false }
      : {}),
  }).format(date);
}

export function formatTimestamp(
  value: string | undefined,
  locale: Locale,
): string {
  const date = parseHarborTime(value);
  if (date === null) return missingTimeLabel(locale);
  if (date === "invalid") return value ?? "";
  return new Intl.DateTimeFormat(locale, {
    timeZone: loadPreferences().dateTimezone === "utc" ? "UTC" : undefined,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

export function formatDuration(
  start: string | undefined,
  end: string | undefined,
  locale: Locale,
): string {
  const startDate = parseHarborTime(start);
  const endDate = parseHarborTime(end);
  if (
    !(startDate instanceof Date) ||
    !(endDate instanceof Date) ||
    endDate < startDate
  ) {
    return locale === "en-US" ? "None" : "暂无";
  }
  const startTime = startDate.getTime();
  const endTime = endDate.getTime();
  const seconds = Math.round((endTime - startTime) / 1000);
  const unit =
    locale === "en-US"
      ? { minute: " min ", second: " sec" }
      : { minute: " 分 ", second: " 秒" };
  return seconds < 60
    ? `${String(seconds)}${unit.second}`
    : `${String(Math.floor(seconds / 60))}${unit.minute}${String(seconds % 60)}${unit.second}`;
}

/** A total with its unit, such as "12 个" or "12 repositories". */
export function formatCount(
  total: number,
  locale: Locale,
  chineseUnit: string,
  englishUnit: string,
): string {
  return locale === "en-US"
    ? `${formatNumber(total, locale)} ${englishUnit}`
    : `${formatNumber(total, locale)} ${chineseUnit}`;
}

/** Pagination summary such as "第 1-20 项，共 42 项"; empty lists show only the total. */
export function formatItemRange(
  start: number,
  end: number,
  total: number,
  locale: Locale,
): string {
  if (total <= 0 || end < start) {
    return locale === "en-US" ? "0 items" : "共 0 项";
  }
  const range = `${formatNumber(start, locale)}-${formatNumber(end, locale)}`;
  return locale === "en-US"
    ? `Items ${range} of ${formatNumber(total, locale)}`
    : `第 ${range} 项，共 ${formatNumber(total, locale)} 项`;
}

export function instanceHost(value: string): string {
  try {
    return new URL(value).host;
  } catch {
    return value;
  }
}
