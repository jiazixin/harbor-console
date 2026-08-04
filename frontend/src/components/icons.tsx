import type { SVGProps } from "react";

export type IconName =
  | "alert"
  | "arrow-left"
  | "arrow-right"
  | "bell"
  | "bug"
  | "calendar"
  | "check"
  | "chevron"
  | "chevron-left"
  | "copy"
  | "database"
  | "download"
  | "edit"
  | "external"
  | "folder"
  | "grid"
  | "history"
  | "home"
  | "info"
  | "list"
  | "log-out"
  | "menu"
  | "moon"
  | "package"
  | "pause"
  | "play"
  | "plus"
  | "refresh"
  | "search"
  | "scan"
  | "settings"
  | "shield"
  | "sun"
  | "tag"
  | "terminal"
  | "trash"
  | "upload"
  | "users"
  | "x";

export function Icon({
  name,
  className = "",
  ...props
}: SVGProps<SVGSVGElement> & { name: IconName }) {
  return (
    <svg className={`icon ${className}`.trim()} aria-hidden="true" {...props}>
      <use href={`#i-${name}`} />
    </svg>
  );
}

export function IconSprite() {
  return (
    <svg className="icon-defs" aria-hidden="true">
      <defs>
        <symbol id="i-home" viewBox="0 0 24 24">
          <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
          <path d="M9 22V12h6v10" />
        </symbol>
        <symbol id="i-folder" viewBox="0 0 24 24">
          <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
        </symbol>
        <symbol id="i-package" viewBox="0 0 24 24">
          <path d="m7.5 4.27 9 5.15" />
          <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
          <path d="m3.3 7 8.7 5 8.7-5" />
          <path d="M12 22V12" />
        </symbol>
        <symbol id="i-tag" viewBox="0 0 24 24">
          <path d="M20.6 13.6 11 4H4v7l9.6 9.6a2 2 0 0 0 2.8 0l4.2-4.2a2 2 0 0 0 0-2.8Z" />
          <circle cx="7.5" cy="7.5" r="1" />
        </symbol>
        <symbol id="i-shield" viewBox="0 0 24 24">
          <path d="M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V5l8-3 8 3Z" />
          <path d="m9 12 2 2 4-4" />
        </symbol>
        <symbol id="i-scan" viewBox="0 0 24 24">
          <path d="M3 7V5a2 2 0 0 1 2-2h2" />
          <path d="M17 3h2a2 2 0 0 1 2 2v2" />
          <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
          <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
          <circle cx="12" cy="12" r="3" />
        </symbol>
        <symbol id="i-bug" viewBox="0 0 24 24">
          <path d="m9 5 1.5 2M15 5l-1.5 2M12 8V4" />
          <path d="M12 8a4 4 0 0 0-4 4v3a4 4 0 0 0 8 0v-3a4 4 0 0 0-4-4Z" />
          <path d="M4 11h4M16 11h4M4 16h4M16 16h4" />
        </symbol>
        <symbol id="i-calendar" viewBox="0 0 24 24">
          <path d="M8 2v4M16 2v4M3 10h18" />
          <rect x="3" y="4" width="18" height="18" rx="2" />
        </symbol>
        <symbol id="i-refresh" viewBox="0 0 24 24">
          <path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 4v5h5" />
          <path d="M4 13a8.1 8.1 0 0 0 15.5 2M20 20v-5h-5" />
        </symbol>
        <symbol id="i-database" viewBox="0 0 24 24">
          <ellipse cx="12" cy="5" rx="9" ry="3" />
          <path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5" />
          <path d="M3 12c0 1.7 4 3 9 3s9-1.3 9-3" />
        </symbol>
        <symbol id="i-history" viewBox="0 0 24 24">
          <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
          <path d="M3 3v5h5" />
          <path d="M12 7v5l4 2" />
        </symbol>
        <symbol id="i-settings" viewBox="0 0 24 24">
          <path d="M12.2 2h-.4a2 2 0 0 0-2 2v.2a2 2 0 0 1-1 1.7l-.4.2a2 2 0 0 1-2 0l-.1-.1a2 2 0 0 0-2.7.7l-.2.4a2 2 0 0 0 .7 2.7l.1.1a2 2 0 0 1 1 1.7v.5a2 2 0 0 1-1 1.7l-.1.1a2 2 0 0 0-.7 2.7l.2.4a2 2 0 0 0 2.7.7l.1-.1a2 2 0 0 1 2 0l.4.2a2 2 0 0 1 1 1.7v.2a2 2 0 0 0 2 2h.4a2 2 0 0 0 2-2v-.2a2 2 0 0 1 1-1.7l.4-.2a2 2 0 0 1 2 0l.1.1a2 2 0 0 0 2.7-.7l.2-.4a2 2 0 0 0-.7-2.7l-.1-.1a2 2 0 0 1-1-1.7v-.5a2 2 0 0 1 1-1.7l.1-.1a2 2 0 0 0 .7-2.7l-.2-.4a2 2 0 0 0-2.7-.7l-.1.1a2 2 0 0 0-2 0l-.4.2a2 2 0 0 1-1-1.7V4a2 2 0 0 0-2-2Z" />
          <circle cx="12" cy="12" r="3" />
        </symbol>
        <symbol id="i-search" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </symbol>
        <symbol id="i-bell" viewBox="0 0 24 24">
          <path d="M10.3 21a2 2 0 0 0 3.4 0" />
          <path d="M4 17h16c-1.5-1.7-2-3.5-2-7a6 6 0 0 0-12 0c0 3.5-.5 5.3-2 7" />
        </symbol>
        <symbol id="i-chevron" viewBox="0 0 24 24">
          <path d="m9 18 6-6-6-6" />
        </symbol>
        <symbol id="i-chevron-left" viewBox="0 0 24 24">
          <path d="m15 18-6-6 6-6" />
        </symbol>
        <symbol id="i-arrow-left" viewBox="0 0 24 24">
          <path d="m15 18-6-6 6-6" />
        </symbol>
        <symbol id="i-arrow-right" viewBox="0 0 24 24">
          <path d="m9 18 6-6-6-6" />
        </symbol>
        <symbol id="i-external" viewBox="0 0 24 24">
          <path d="M15 3h6v6" />
          <path d="M10 14 21 3" />
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        </symbol>
        <symbol id="i-log-out" viewBox="0 0 24 24">
          <path d="M10 17l5-5-5-5" />
          <path d="M15 12H3" />
          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
        </symbol>
        <symbol id="i-sun" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </symbol>
        <symbol id="i-moon" viewBox="0 0 24 24">
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </symbol>
        <symbol id="i-menu" viewBox="0 0 24 24">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </symbol>
        <symbol id="i-x" viewBox="0 0 24 24">
          <path d="M18 6 6 18M6 6l12 12" />
        </symbol>
        <symbol id="i-plus" viewBox="0 0 24 24">
          <path d="M12 5v14M5 12h14" />
        </symbol>
        <symbol id="i-check" viewBox="0 0 24 24">
          <path d="m20 6-11 11-5-5" />
        </symbol>
        <symbol id="i-alert" viewBox="0 0 24 24">
          <path d="M10.3 2.9 1.8 17a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 2.9a2 2 0 0 0-3.4 0Z" />
          <path d="M12 9v4M12 17h.01" />
        </symbol>
        <symbol id="i-copy" viewBox="0 0 24 24">
          <rect width="14" height="14" x="8" y="8" rx="2" />
          <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
        </symbol>
        <symbol id="i-download" viewBox="0 0 24 24">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <path d="m7 10 5 5 5-5M12 15V3" />
        </symbol>
        <symbol id="i-edit" viewBox="0 0 24 24">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
        </symbol>
        <symbol id="i-upload" viewBox="0 0 24 24">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <path d="m17 8-5-5-5 5M12 3v12" />
        </symbol>
        <symbol id="i-list" viewBox="0 0 24 24">
          <path d="M8 6h13M8 12h13M8 18h13" />
          <path d="M3 6h.01M3 12h.01M3 18h.01" />
        </symbol>
        <symbol id="i-grid" viewBox="0 0 24 24">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
        </symbol>
        <symbol id="i-trash" viewBox="0 0 24 24">
          <path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v5M14 11v5" />
        </symbol>
        <symbol id="i-play" viewBox="0 0 24 24">
          <path d="m6 3 14 9-14 9Z" />
        </symbol>
        <symbol id="i-pause" viewBox="0 0 24 24">
          <path d="M8 5v14M16 5v14" />
        </symbol>
        <symbol id="i-users" viewBox="0 0 24 24">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />
        </symbol>
        <symbol id="i-terminal" viewBox="0 0 24 24">
          <path d="m4 17 6-5-6-5M12 19h8" />
        </symbol>
        <symbol id="i-info" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4M12 8h.01" />
        </symbol>
      </defs>
    </svg>
  );
}
