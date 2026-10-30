import { useState } from "react";
import { parseBanner } from "../app/banner-schema";
import { useLocale } from "../app/locale-context";
import { Icon } from "../components/icon";
import { type IconName } from "../components/icons-support";
import uiStyles0 from "../components/shared-ui.module.css";
import {
  readStoredItem,
  writeStoredItem,
} from "../lib/browser-storage/storage";
import { createClassNames } from "../lib/css/class-names";
import uiStyles1 from "./harbor-announcement.module.css";

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
  let value: ReturnType<typeof parseBanner>;
  try {
    value = parseBanner(rawValue);
  } catch {
    // A malformed optional banner must not prevent access to the console.
    return null;
  }
  const message = typeof value.message === "string" ? value.message.trim() : "";
  if (!message) return null;
  const from = parseDate(value.fromDate, false);
  const to = parseDate(value.toDate, true);
  if ((from && now < from) || (to && now > to)) return null;
  const type = value.type;
  return { message, type, closable: value.closable };
}

/** Instance-wide announcement configured in Harbor's system settings. */
type HarborAnnouncementProps = { rawValue?: string };

export function HarborAnnouncement({ rawValue }: HarborAnnouncementProps) {
  const { t } = useLocale();
  const [dismissed, setDismissed] = useState(
    () => readStoredItem("sessionStorage", dismissedStorageKey) ?? "",
  );
  const announcement = parseAnnouncement(rawValue);
  if (!announcement || !rawValue || dismissed === rawValue) return null;
  return (
    <div
      className={resolveClasses(
        `harbor-banner harbor-banner-${announcement.type}`,
      )}
      role={announcement.type === "danger" ? "alert" : "status"}
    >
      <span className={resolveClasses("harbor-banner-icon")} aria-hidden="true">
        <Icon name={announcementIcons[announcement.type]} />
      </span>
      <span>{announcement.message}</span>
      {announcement.closable ? (
        <button
          className={resolveClasses("icon-button")}
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

const resolveClasses = createClassNames({
  icon: uiStyles0.icon,
  "icon-button": uiStyles0.iconButton,
  button: uiStyles0.button,
  "harbor-banner-warning": uiStyles0.harborBannerWarning,
  "harbor-banner-success": uiStyles0.harborBannerSuccess,
  "harbor-banner-info": uiStyles0.harborBannerInfo,
  "harbor-banner-danger": uiStyles0.harborBannerDanger,
  clickable: uiStyles0.clickable,
  "overlay-open": uiStyles0.overlayOpen,
  "log-level-trace": uiStyles0.logLevelTrace,
  "log-level-debug": uiStyles0.logLevelDebug,
  "log-level-log": uiStyles0.logLevelLog,
  "log-level-info": uiStyles0.logLevelInfo,
  "log-level-warn": uiStyles0.logLevelWarn,
  "log-level-error": uiStyles0.logLevelError,
  "log-level-fatal": uiStyles0.logLevelFatal,
  "harbor-banner": uiStyles1.harborBanner,
  "harbor-banner-icon": uiStyles1.harborBannerIcon,
});
