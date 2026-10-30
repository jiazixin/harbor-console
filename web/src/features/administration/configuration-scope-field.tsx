import { useState } from "react";
import { useLocale } from "../../app/locale-context";
import type { HarborConfiguration } from "../../app/models";
import uiStyles0 from "../../components/shared-ui.module.css";
import { UnifiedSelect } from "../../components/unified-select";
import { createClassNames } from "../../lib/css/class-names";

import {
  configurationEditable,
  configurationString,
} from "./configuration-fields-support";

type ConfigurationScopeFieldProps = {
  configuration: HarborConfiguration;
  configKey: string;
  label: string;
};

export function ConfigurationScopeField({
  configuration,
  configKey,
  label,
}: ConfigurationScopeFieldProps) {
  const { t } = useLocale();
  const [value, setValue] = useState(
    configurationString(configuration, configKey, "0"),
  );
  return (
    <label className={resolveClasses("field")}>
      <span>{t(label)}</span>
      <UnifiedSelect
        ariaLabel={t(label)}
        name={configKey}
        value={value}
        disabled={!configurationEditable(configuration, configKey)}
        options={[
          { value: "0", label: "Base" },
          { value: "1", label: t("单层") },
          { value: "2", label: t("子树") },
        ]}
        onChange={setValue}
      />
    </label>
  );
}

const resolveClasses = createClassNames({
  "unified-select": uiStyles0.unifiedSelect,
  field: uiStyles0.field,
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
