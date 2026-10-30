import { useLocale } from "../app/locale-context";
import { createClassNames } from "../lib/css/class-names";
import uiStyles1 from "./error-view.module.css";
import { Icon } from "./icon";
import uiStyles0 from "./shared-ui.module.css";

// The Go server reports every Harbor 403 with this message (see
// friendlyUpstreamError); the English form is its translation.
const permissionDeniedMessages = [
  "当前 Harbor 账号没有访问该资源的权限",
  "This Harbor account cannot access the resource",
];

function isPermissionDenied(message: string): boolean {
  return permissionDeniedMessages.some((text) => message.includes(text));
}

/**
 * Failure state for a page, section or dialog. Permission errors get their own
 * explanation and no retry button, because retrying cannot succeed.
 */
type ErrorViewProps = {
  message: string;
  retry?: () => void;
  retryLabel?: string;
  title?: string;
};

export function ErrorView({
  message,
  retry,
  retryLabel = "重试",
  title = "内容载入失败",
}: ErrorViewProps) {
  const { t } = useLocale();
  const permissionDenied = isPermissionDenied(message);
  return (
    <div className={resolveClasses("error-state")} role="alert">
      <div>
        <span className={resolveClasses("state-icon")}>
          <Icon name={permissionDenied ? "shield" : "alert"} />
        </span>
        <h2>{t(permissionDenied ? "没有访问权限" : title)}</h2>
        <p>
          {permissionDenied
            ? t(
                "当前 Harbor 账号没有访问此内容所需的权限。如需访问，请联系 Harbor 系统管理员。",
              )
            : t(message)}
        </p>
        {retry && !permissionDenied ? (
          <button
            className={resolveClasses("button button-small")}
            type="button"
            onClick={retry}
          >
            <Icon name="refresh" />
            <span>{t(retryLabel)}</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}

const resolveClasses = createClassNames({
  icon: uiStyles0.icon,
  "state-icon": uiStyles0.stateIcon,
  button: uiStyles0.button,
  "button-small": uiStyles0.buttonSmall,
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
  "error-state": uiStyles1.errorState,
});
