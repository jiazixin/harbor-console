import { type SubmitEvent, useState } from "react";

import { controlApi } from "../../app/api-client";
import type { ConsoleRoute } from "../../app/hash-router";
import { useLocale } from "../../app/locale-context";
import type { CveAllowlist, HarborConfiguration } from "../../app/models";
import { ContentTransition } from "../../components/content-transition";
import {
  CveAllowlistEditor,
  useCveAllowlistDraft,
} from "../../components/cve-allowlist-editor";
import { Icon } from "../../components/icons";
import { AuthenticationConfiguration } from "./authentication-configuration";
import {
  ConfigurationFormHeader,
  ConfigurationSaveButton,
  errorMessage,
} from "./configuration-fields";
import { SystemConfiguration } from "./system-configuration";

type ConfigurationTab = "auth" | "security" | "system";

export type ConfigurationData = {
  section: "configuration";
  configuration: HarborConfiguration;
  allowlist?: CveAllowlist;
  allowlistError?: string;
  auditEvents: string[];
  auditEventsError?: string;
};

function SecurityConfiguration({
  allowlist,
  loadError,
  onReload,
  onNotice,
}: {
  allowlist?: CveAllowlist;
  loadError?: string;
  onReload: () => void;
  onNotice: (message: string, error?: boolean) => void;
}) {
  const { t } = useLocale();
  const draft = useCveAllowlistDraft(allowlist);
  const [busy, setBusy] = useState(false);
  if (loadError) {
    return (
      <div className="notice notice-warning">
        <Icon name="alert" />
        <span>
          {t("系统 CVE 白名单载入失败")}：{loadError}
        </span>
      </div>
    );
  }

  async function save(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const payload = draft.toPayload();
      setBusy(true);
      await controlApi.mutate("system-cve-allowlist", {}, "PUT", payload);
      onNotice("安全配置已保存");
      onReload();
    } catch (error) {
      onNotice(errorMessage(error), true);
      setBusy(false);
    }
  }

  return (
    <form
      className="settings-form configuration-form"
      onSubmit={(event) => void save(event)}
    >
      <ConfigurationFormHeader
        title="系统 CVE 白名单"
        description="对应 Harbor 原版配置管理中的安全页面"
      >
        <ConfigurationSaveButton busy={busy} label="保存安全配置" />
      </ConfigurationFormHeader>
      <section className="configuration-group">
        <CveAllowlistEditor {...draft.editorProps} />
      </section>
    </form>
  );
}

function configurationTab(route: ConsoleRoute): ConfigurationTab {
  const tab = route.query.get("tab") as ConfigurationTab | null;
  return tab && ["auth", "security", "system"].includes(tab) ? tab : "auth";
}

export function AdministrationConfigurationSection({
  data,
  route,
  hasRootCertificate,
  navigate,
  onReload,
  onNotice,
}: {
  data: ConfigurationData;
  route: ConsoleRoute;
  hasRootCertificate: boolean;
  navigate: (path: string) => void;
  onReload: () => void;
  onNotice: (message: string, error?: boolean) => void;
}) {
  const { t } = useLocale();
  const selected = configurationTab(route);
  const tabs: { key: ConfigurationTab; label: string }[] = [
    { key: "auth", label: "认证" },
    { key: "security", label: "安全" },
    { key: "system", label: "系统设置" },
  ];
  return (
    <section className="administration-config">
      <nav className="config-subtabs" aria-label={t("配置管理页面")}>
        {tabs.map((tab) => (
          <a
            key={tab.key}
            href={`#/administration/configuration?tab=${tab.key}`}
            className={selected === tab.key ? "active" : undefined}
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
        {selected === "auth" ? (
          <AuthenticationConfiguration
            configuration={data.configuration}
            onReload={onReload}
            onNotice={onNotice}
          />
        ) : selected === "security" ? (
          <SecurityConfiguration
            allowlist={data.allowlist}
            loadError={data.allowlistError}
            onReload={onReload}
            onNotice={onNotice}
          />
        ) : (
          <SystemConfiguration
            configuration={data.configuration}
            auditEvents={data.auditEvents}
            auditEventsError={data.auditEventsError}
            hasRootCertificate={hasRootCertificate}
            onReload={onReload}
            onNotice={onNotice}
          />
        )}
      </ContentTransition>
    </section>
  );
}
