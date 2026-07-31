"use strict";

(function initializeHarborDateUtils(root) {
  function timestamp(value) {
    if (!value) return Number.NEGATIVE_INFINITY;
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
  }

  function compareDescending(leftValue, rightValue) {
    const leftTimestamp = timestamp(leftValue);
    const rightTimestamp = timestamp(rightValue);
    if (leftTimestamp === rightTimestamp) return 0;
    return rightTimestamp > leftTimestamp ? 1 : -1;
  }

  function latest(values) {
    let latestValue = null;
    let latestTimestamp = Number.NEGATIVE_INFINITY;
    for (const value of Array.isArray(values) ? values : []) {
      const valueTimestamp = timestamp(value);
      if (valueTimestamp <= latestTimestamp) continue;
      latestValue = value;
      latestTimestamp = valueTimestamp;
    }
    return latestValue;
  }

  function format(value, locale, includeTime = true, timezone = "local") {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: includeTime ? "2-digit" : undefined,
      minute: includeTime ? "2-digit" : undefined,
      hour12: false,
		timeZone: timezone === "utc" ? "UTC" : undefined,
    }).format(parsed);
  }

  root.HarborDates = Object.freeze({ compareDescending, format, latest, timestamp });
})(globalThis);
