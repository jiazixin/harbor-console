import { type SubmitEvent, useState } from "react";
import type { ConsoleRoute } from "../../app/console-route";
import { errorText } from "../../app/errors";
import { useLocale } from "../../app/locale-context";
import type { CveAllowlist, HarborConfiguration } from "../../app/models";
import { useControlMutation } from "../../app/use-control-mutation";
import { ContentTransition } from "../../components/content-transition";
import {
  CveAllowlistEditor,
  useCveAllowlistDraft,
} from "../../components/cve-allowlist-editor";
import { FormErrorsContext, formErrors } from "../../components/form-errors";
import { Icon } from "../../components/icon";
import uiStyles0 from "../../components/shared-ui.module.css";
import { createClassNames } from "../../lib/css/class-names";
import { administrationKeys } from "./administration-keys";
import styles from "./administration.module.css";
import { AuthenticationConfiguration } from "./authentication-configuration";
import { ConfigurationFormHeader } from "./configuration-form-header";
import { ConfigurationSaveButton } from "./configuration-save-button";
import { SystemConfiguration } from "./system-configuration";

// Queries that a write in this module can change.
const affectedQueries = [administrationKeys.all];

type ConfigurationTab = "auth" | "security" | "system";

export type ConfigurationData = {
  section: "configuration";
  configuration: HarborConfiguration;
  allowlist?: CveAllowlist;
  allowlistError?: string;
  auditEvents: string[];
  auditEventsError?: string;
};

type SecurityConfigurationProps = {
  allowlist?: CveAllowlist;
  loadError?: string;
  onReload: () => void;
  onNotice: (message: string, error?: boolean) => void;
};

function SecurityConfiguration({
  allowlist,
  loadError,
  onReload,
  onNotice,
}: SecurityConfigurationProps) {
  const mutate = useControlMutation(affectedQueries);
  const { t } = useLocale();
  const draft = useCveAllowlistDraft(allowlist);
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  if (loadError) {
    return (
      <div className={resolveClasses("notice notice-warning")}>
        <Icon name="alert" />
        <span>
          {t("系统 CVE 白名单载入失败")}：{loadError}
        </span>
      </div>
    );
  }

  async function save(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    try {
      const payload = draft.toPayload();
      setBusy(true);
      await mutate({
        operation: "system-cve-allowlist",
        parameters: {},
        method: "PUT",
        payload: payload,
      });
      onNotice("安全配置已保存");
      onReload();
    } catch (error) {
      setFieldErrors(formErrors(error));
      onNotice(errorText(error), true);
      setBusy(false);
    }
  }

  return (
    <FormErrorsContext value={fieldErrors}>
      <form
        className={resolveClasses(`settings-form ${styles.configurationForm}`)}
        onSubmit={(event) => void save(event)}
      >
        <ConfigurationFormHeader
          title="系统 CVE 白名单"
          description="对应 Harbor 原版配置管理中的安全页面"
        >
          <ConfigurationSaveButton busy={busy} label="保存安全配置" />
        </ConfigurationFormHeader>
        <section className={resolveClasses(styles.configurationGroup)}>
          <CveAllowlistEditor {...draft.editorProps} />
        </section>
      </form>
    </FormErrorsContext>
  );
}

function configurationTab(route: ConsoleRoute): ConfigurationTab {
  const tab = route.query.get("tab") as ConfigurationTab | null;
  return tab && ["auth", "security", "system"].includes(tab) ? tab : "auth";
}

type AdministrationConfigurationSectionProps = {
  data: ConfigurationData;
  route: ConsoleRoute;
  hasRootCertificate: boolean;
  navigate: (path: string) => void;
  onReload: () => void;
  onNotice: (message: string, error?: boolean) => void;
};

export function AdministrationConfigurationSection({
  data,
  route,
  hasRootCertificate,
  navigate,
  onReload,
  onNotice,
}: AdministrationConfigurationSectionProps) {
  const { t } = useLocale();
  const selected = configurationTab(route);
  const tabs: { key: ConfigurationTab; label: string }[] = [
    { key: "auth", label: "认证" },
    { key: "security", label: "安全" },
    { key: "system", label: "系统设置" },
  ];
  return (
    <section className={resolveClasses(styles.administrationConfig)}>
      <nav
        className={resolveClasses(styles.configSubtabs)}
        aria-label={t("配置管理页面")}
      >
        {tabs.map((tab) => (
          <a
            key={tab.key}
            href={`#/administration/configuration?tab=${tab.key}`}
            className={resolveClasses(
              selected === tab.key ? "active" : undefined,
            )}
            aria-current={selected === tab.key ? "page" : undefined}
            onClick={(event) => {
              event.preventDefault();
              navigate(`administration/configuration?tab=${tab.key}`);
            }}
          >
            {t(tab.label)}
          </a>
        ))}
      </nav>
      <ContentTransition mode={selected}>
        {(() => {
          if (selected === "auth") {
            return (
              <AuthenticationConfiguration
                configuration={data.configuration}
                onReload={onReload}
                onNotice={onNotice}
              />
            );
          }
          if (selected === "security") {
            return (
              <SecurityConfiguration
                allowlist={data.allowlist}
                loadError={data.allowlistError}
                onReload={onReload}
                onNotice={onNotice}
              />
            );
          }
          return (
            <SystemConfiguration
              configuration={data.configuration}
              auditEvents={data.auditEvents}
              auditEventsError={data.auditEventsError}
              hasRootCertificate={hasRootCertificate}
              onReload={onReload}
              onNotice={onNotice}
            />
          );
        })()}
      </ContentTransition>
    </section>
  );
}

const resolveClasses = createClassNames({
  icon: uiStyles0.icon,
  notice: uiStyles0.notice,
  "notice-warning": uiStyles0.noticeWarning,
  "settings-form": uiStyles0.settingsForm,
  active: uiStyles0.active,
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
