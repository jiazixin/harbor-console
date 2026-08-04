import type { Locale } from "./models";

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

export function formatDate(
  value: string | undefined,
  locale: Locale,
  includeTime = true,
): string {
  if (!value) return locale === "en-US" ? "N/A" : "暂无";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
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
  if (!value) return locale === "en-US" ? "N/A" : "暂无";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
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
  const startTime = new Date(start ?? "").getTime();
  const endTime = new Date(end ?? "").getTime();
  if (
    !Number.isFinite(startTime) ||
    !Number.isFinite(endTime) ||
    endTime < startTime
  ) {
    return locale === "en-US" ? "None" : "暂无";
  }
  const seconds = Math.round((endTime - startTime) / 1000);
  if (locale === "en-US") {
    return seconds < 60
      ? `${String(seconds)} sec`
      : `${String(Math.floor(seconds / 60))} min ${String(seconds % 60)} sec`;
  }
  return seconds < 60
    ? `${String(seconds)} 秒`
    : `${String(Math.floor(seconds / 60))} 分 ${String(seconds % 60)} 秒`;
}

export function instanceHost(value: string): string {
  try {
    return new URL(value).host;
  } catch {
    return value;
  }
}
