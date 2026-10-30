import { useLocale } from "../app/locale-context";
import { createClassNames } from "../lib/css/class-names";
import { useResettableState } from "../lib/state/use-resettable-state";
import { FormInput } from "./form-input";
import { Icon } from "./icon";
import {
  default as sharedPrimitiveStyles,
  default as uiStyles0,
} from "./shared-ui.module.css";
import uiStyles1 from "./toolbar-search-form.module.css";

type ToolbarSearchFormProps = {
  ariaLabel?: string;
  className?: string;
  maxLength?: number;
  name?: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
};

export function ToolbarSearchForm({
  ariaLabel,
  className = "",
  maxLength = 255,
  name,
  placeholder,
  value,
  onChange,
  onSubmit,
}: ToolbarSearchFormProps) {
  const { t } = useLocale();
  const [draft, setDraft] = useResettableState(value);
  const translatedPlaceholder = t(placeholder);

  return (
    <form
      className={resolveClasses(
        `toolbar-search control-search-form ${className}`.trim(),
      )}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(draft.trim());
      }}
    >
      <Icon name="search" />
      <FormInput
        name={name}
        type="search"
        maxLength={maxLength}
        value={value}
        placeholder={translatedPlaceholder}
        aria-label={ariaLabel ? t(ariaLabel) : translatedPlaceholder}
        onChange={(event) => {
          setDraft(event.currentTarget.value);
          onChange(event.currentTarget.value);
        }}
      />
      <button
        className={resolveClasses("icon-button toolbar-search-submit")}
        type="submit"
        title={t("搜索")}
        aria-label={t("搜索")}
      >
        <Icon name="search" />
      </button>
    </form>
  );
}

const resolveClasses = createClassNames({
  "control-search-form": sharedPrimitiveStyles.controlSearchForm,
  icon: uiStyles0.icon,
  "toolbar-search": uiStyles0.toolbarSearch,
  "icon-button": uiStyles0.iconButton,
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
  "toolbar-search-submit": uiStyles1.toolbarSearchSubmit,
});
