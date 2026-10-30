import { useLocale } from "../../app/locale-context";
import { Icon } from "../../components/icon";
import uiStyles0 from "../../components/shared-ui.module.css";
import { createClassNames } from "../../lib/css/class-names";

type ConfigurationSaveButtonProps = {
  busy: boolean;
  label: string;
};

export function ConfigurationSaveButton({
  busy,
  label,
}: ConfigurationSaveButtonProps) {
  const { t } = useLocale();
  return (
    <button
      className={resolveClasses("button button-small button-primary")}
      type="submit"
      disabled={busy}
    >
      {busy ? (
        <span
          className={resolveClasses("spinner button-spinner")}
          aria-hidden="true"
        />
      ) : (
        <Icon name="check" />
      )}
      <span>{t(busy ? "正在保存" : label)}</span>
    </button>
  );
}

const resolveClasses = createClassNames({
  icon: uiStyles0.icon,
  button: uiStyles0.button,
  "button-small": uiStyles0.buttonSmall,
  "button-primary": uiStyles0.buttonPrimary,
  spinner: uiStyles0.spinner,
  "button-spinner": uiStyles0.buttonSpinner,
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
});
