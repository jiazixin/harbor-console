import { useState } from "react";

import { useLocale } from "../app/locale-context";
import { Icon, type IconName } from "../components/icons";
import {
  readStoredItem,
  writeStoredItem,
} from "../lib/browser-storage/storage";

const dismissedStorageKey = "harbor-console-dismissed-announcement";

type AnnouncementType = "success" | "info" | "warning" | "danger";

type Announcement = {
  message: string;
  type: AnnouncementType;
  closable: boolean;
};

const announcementIcons: Record<AnnouncementType, IconName> = {
  success: "check",
  info: "info",
  warning: "alert",
  danger: "alert",
};

function parseDate(value: unknown, endOfDay: boolean): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  if (endOfDay) date.setHours(23, 59, 59, 999);
  else date.setHours(0, 0, 0, 0);
  return date;
}

/**
 * Reads Harbor's banner_message setting: a JSON BannerMessage with message,
 * type, closable and an optional fromDate/toDate display window.
 */
export function parseAnnouncement(
  rawValue: string | undefined,
  now = new Date(),
): Announcement | null {
  if (!rawValue?.trim()) return null;
  let value: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(rawValue);
    if (!parsed || typeof parsed !== "object") return null;
    value = parsed as Record<string, unknown>;
  } catch {
    return null;
  }
  const message = typeof value.message === "string" ? value.message.trim() : "";
  if (!message) return null;
  const from = parseDate(value.fromDate, false);
  const to = parseDate(value.toDate, true);
  if ((from && now < from) || (to && now > to)) return null;
  const type = ["success", "info", "warning", "danger"].includes(
    String(value.type),
  )
    ? (value.type as AnnouncementType)
    : "warning";
  return { message, type, closable: value.closable === true };
}

/** Instance-wide announcement configured in Harbor's system settings. */
export function HarborAnnouncement({ rawValue }: { rawValue?: string }) {
  const { t } = useLocale();
  const [dismissed, setDismissed] = useState(
    () => readStoredItem("sessionStorage", dismissedStorageKey) ?? "",
  );
  const announcement = parseAnnouncement(rawValue);
  if (!announcement || !rawValue || dismissed === rawValue) return null;
  return (
    <div
      className={`harbor-banner harbor-banner-${announcement.type}`}
      role={announcement.type === "danger" ? "alert" : "status"}
    >
      <span className="harbor-banner-icon" aria-hidden="true">
        <Icon name={announcementIcons[announcement.type]} />
      </span>
      <span>{announcement.message}</span>
      {announcement.closable ? (
        <button
          className="icon-button"
          type="button"
          title={t("关闭公告")}
          aria-label={t("关闭公告")}
          onClick={() => {
            writeStoredItem("sessionStorage", dismissedStorageKey, rawValue);
            setDismissed(rawValue);
          }}
        >
          <Icon name="x" />
        </button>
      ) : null}
    </div>
  );
}
