import { useLocale } from "../../app/locale-context";
import type { HarborConfiguration } from "../../app/models";
import { ToggleSetting } from "../../components/toggle-setting";

import { configurationEditable } from "./configuration-fields-support";

type ConfigurationToggleProps = {
  configuration: HarborConfiguration;
  configKey: string;
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
};

export function ConfigurationToggle({
  configuration,
  configKey,
  title,
  description,
  checked,
  onChange,
  disabled = false,
}: ConfigurationToggleProps) {
  const { t } = useLocale();
  return (
    <ToggleSetting
      name={configKey}
      title={t(title)}
      description={t(description)}
      checked={checked}
      disabled={disabled || !configurationEditable(configuration, configKey)}
      onChange={onChange}
    />
  );
}
