import { type SubmitEvent, useMemo, useState } from "react";

import { controlApi } from "../../app/api-client";
import { globalAuditOperationLabel } from "../../app/audit-log";
import { useLocale } from "../../app/locale-context";
import type { HarborConfiguration } from "../../app/models";
import { Icon } from "../../components/icons";
import { ToggleSetting } from "../../components/toggle-setting";
import { UnifiedSelect } from "../../components/unified-select";
import {
  addEditable,
  ConfigurationFormHeader,
  ConfigurationGroup,
  type ConfigurationPayload,
  ConfigurationSaveButton,
  configurationBoolean,
  configurationEditable,
  configurationString,
  ConfigurationTextField,
  ConfigurationToggle,
  configurationValue,
  errorMessage,
  formString,
} from "./configuration-fields";

type BannerConfiguration = {
  message: string;
  type: "danger" | "info" | "success" | "warning";
  closable: boolean;
  fromDate: string;
  toDate: string;
};

function bannerConfiguration(value: unknown): BannerConfiguration {
  try {
    const parsed: unknown = JSON.parse(typeof value === "string" ? value : "");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      throw new Error("Invalid banner configuration");
    const record = parsed as Record<string, unknown>;
    const type =
      typeof record.type === "string" &&
      ["danger", "info", "success", "warning"].includes(record.type)
        ? (record.type as BannerConfiguration["type"])
        : "warning";
    return {
      message: typeof record.message === "string" ? record.message : "",
      type,
      closable: Boolean(record.closable),
      fromDate:
        typeof record.fromDate === "string" ? record.fromDate.slice(0, 10) : "",
      toDate:
        typeof record.toDate === "string" ? record.toDate.slice(0, 10) : "",
    };
  } catch {
    return {
      message: "",
      type: "warning",
      closable: false,
      fromDate: "",
      toDate: "",
    };
  }
}

function storageGigabytes(value: unknown): number {
  const bytes = Number(value);
  if (bytes < 0) return -1;
  return Number((bytes / 1024 ** 3).toFixed(2));
}

function systemToggles(configuration: HarborConfiguration) {
  const toggle = (key: string) => configurationBoolean(configuration, key);
  return {
    read_only: toggle("read_only"),
    notification_enable: toggle("notification_enable"),
    scanner_skip_update_pulltime: toggle("scanner_skip_update_pulltime"),
    quota_per_project_enable: toggle("quota_per_project_enable"),
    skip_audit_log_database: toggle("skip_audit_log_database"),
  };
}

type SystemToggles = ReturnType<typeof systemToggles>;

type SettingsGroupProps = {
  configuration: HarborConfiguration;
  toggles: SystemToggles;
  setToggle: (key: keyof SystemToggles, value: boolean) => void;
};

function AccountAndProjectSettings({
  configuration,
  hasRootCertificate,
}: {
  configuration: HarborConfiguration;
  hasRootCertificate: boolean;
}) {
  const { t } = useLocale();
  const [projectCreationRestriction, setProjectCreationRestriction] = useState(
    configurationString(
      configuration,
      "project_creation_restriction",
      "adminonly",
    ),
  );
  return (
    <ConfigurationGroup
      title="账号与项目"
      description="全局账号期限和项目创建规则"
    >
      <div className="form-grid two-columns">
        <label className="field">
          <span>{t("项目创建权限")}</span>
          <UnifiedSelect
            ariaLabel={t("项目创建权限")}
            name="project_creation_restriction"
            value={projectCreationRestriction}
            disabled={
              !configurationEditable(
                configuration,
                "project_creation_restriction",
              )
            }
            options={[
              { value: "adminonly", label: t("仅系统管理员") },
              { value: "everyone", label: t("所有用户") },
            ]}
            onChange={setProjectCreationRestriction}
          />
        </label>
        <ConfigurationTextField
          configuration={configuration}
          configKey="token_expiration"
          label="令牌有效期（分钟）"
          type="number"
          required
          min={1}
          max={9_999_999_999}
        />
        <ConfigurationTextField
          configuration={configuration}
          configKey="session_timeout"
          label="会话超时（分钟）"
          type="number"
          required
          min={1}
          max={9_999_999_999}
        />
        <ConfigurationTextField
          configuration={configuration}
          configKey="robot_name_prefix"
          label="机器人账号名称前缀"
          required
          placeholder="robot$"
        />
        <ConfigurationTextField
          configuration={configuration}
          configKey="robot_token_duration"
          label="机器人令牌有效期（天）"
          type="number"
          required
          min={1}
          max={9_999_999_999}
        />
      </div>
      {hasRootCertificate ? (
        <div className="system-certificate-row">
          <Icon name="external" />
          <span>
            <strong>{t("Harbor 根证书")}</strong>
            <small>
              {t("用于让 Docker、containerd 等客户端信任当前 Harbor 实例。")}
            </small>
          </span>
          <a
            className="button button-small"
            href="/api/control/system-root-certificate"
            download
          >
            <Icon name="external" />
            <span>{t("下载根证书")}</span>
          </a>
        </div>
      ) : null}
    </ConfigurationGroup>
  );
}

function RuntimePolicySettings({
  configuration,
  toggles,
  setToggle,
}: SettingsGroupProps) {
  const { t } = useLocale();
  return (
    <ConfigurationGroup
      title="运行策略"
      description="写入、通知、扫描和默认配额"
    >
      <div className="settings-grid">
        <ConfigurationToggle
          configuration={configuration}
          configKey="read_only"
          title="只读模式"
          description="阻止制品推送、删除和复制写入"
          checked={toggles.read_only}
          onChange={(value) => setToggle("read_only", value)}
        />
        <ConfigurationToggle
          configuration={configuration}
          configKey="notification_enable"
          title="启用 Webhook 通知"
          description="允许 Harbor 发送事件通知"
          checked={toggles.notification_enable}
          onChange={(value) => setToggle("notification_enable", value)}
        />
        <ConfigurationToggle
          configuration={configuration}
          configKey="scanner_skip_update_pulltime"
          title="扫描不更新拉取时间"
          description="扫描器拉取制品时不修改拉取时间"
          checked={toggles.scanner_skip_update_pulltime}
          onChange={(value) => setToggle("scanner_skip_update_pulltime", value)}
        />
        <ConfigurationToggle
          configuration={configuration}
          configKey="quota_per_project_enable"
          title="启用项目配额"
          description="为新建项目应用默认存储限制"
          checked={toggles.quota_per_project_enable}
          onChange={(value) => setToggle("quota_per_project_enable", value)}
        />
      </div>
      <div className="form-grid two-columns admin-config-fields">
        <label className="field">
          <span>{t("默认项目配额（GiB）")}</span>
          <input
            name="storage_per_project_gb"
            type="number"
            min={-1}
            step={1}
            defaultValue={storageGigabytes(
              configurationValue(configuration, "storage_per_project"),
            )}
            disabled={
              !configurationEditable(configuration, "storage_per_project")
            }
          />
          <small className="field-help">{t("输入 -1 表示不限制。")}</small>
        </label>
      </div>
    </ConfigurationGroup>
  );
}

function AuditLogSettings({
  configuration,
  toggles,
  setToggle,
  auditEvents,
  auditEventsError,
  enabledAuditEvents,
  onEnabledAuditEventsChange,
}: SettingsGroupProps & {
  auditEvents: string[];
  auditEventsError?: string;
  enabledAuditEvents: ReadonlySet<string>;
  onEnabledAuditEventsChange: (eventName: string, enabled: boolean) => void;
}) {
  const { locale, t } = useLocale();
  const [auditEndpoint, setAuditEndpoint] = useState(
    configurationString(configuration, "audit_log_forward_endpoint"),
  );
  return (
    <ConfigurationGroup title="审计日志" description="外部转发与数据库记录范围">
      <div className="form-grid two-columns">
        <label className="field">
          <span>{t("审计日志转发地址")}</span>
          <input
            name="audit_log_forward_endpoint"
            type="url"
            placeholder="https://audit.example.com/events"
            value={auditEndpoint}
            disabled={
              !configurationEditable(
                configuration,
                "audit_log_forward_endpoint",
              )
            }
            onChange={(event) => {
              setAuditEndpoint(event.currentTarget.value);
              if (!event.currentTarget.value.trim())
                setToggle("skip_audit_log_database", false);
            }}
          />
        </label>
        <div>
          <ConfigurationToggle
            configuration={configuration}
            configKey="skip_audit_log_database"
            title="跳过数据库审计日志"
            description="仅使用外部审计转发时启用"
            checked={toggles.skip_audit_log_database}
            disabled={!auditEndpoint.trim()}
            onChange={(value) => setToggle("skip_audit_log_database", value)}
          />
        </div>
      </div>
      {auditEventsError ? (
        <div className="notice notice-warning settings-warning">
          <Icon name="alert" />
          <span>
            {t("审计事件类型载入失败")}：{auditEventsError}
          </span>
        </div>
      ) : auditEvents.length ? (
        <fieldset
          className="audit-event-config"
          disabled={
            !configurationEditable(
              configuration,
              "disabled_audit_log_event_types",
            )
          }
        >
          <legend>{t("写入数据库的事件类型")}</legend>
          <div className="check-grid">
            {auditEvents.map((eventName) => (
              <label className="check-row" key={eventName}>
                <input
                  name="enabled_audit_event"
                  type="checkbox"
                  value={eventName}
                  checked={enabledAuditEvents.has(eventName)}
                  onChange={(event) =>
                    onEnabledAuditEventsChange(
                      eventName,
                      event.currentTarget.checked,
                    )
                  }
                />
                <span>
                  <strong>
                    {globalAuditOperationLabel(eventName, locale, t)}
                  </strong>
                  <small>{eventName}</small>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
    </ConfigurationGroup>
  );
}

function BannerSettings({
  configuration,
  banner,
  onChange,
}: {
  configuration: HarborConfiguration;
  banner: BannerConfiguration;
  onChange: (update: Partial<BannerConfiguration>) => void;
}) {
  const { t } = useLocale();
  const bannerLocked = !configurationEditable(configuration, "banner_message");
  const bannerEnabled = Boolean(banner.message.trim());
  return (
    <ConfigurationGroup
      title="横幅消息"
      description="在控制台顶部向所有用户显示实例公告"
    >
      <div className="form-grid two-columns">
        <label className="field field-span">
          <span>{t("消息内容")}</span>
          <textarea
            name="banner_message_text"
            rows={4}
            maxLength={800}
            value={banner.message}
            disabled={bannerLocked}
            placeholder={t("留空表示不显示横幅")}
            onChange={(event) =>
              onChange({ message: event.currentTarget.value })
            }
          />
        </label>
        <label className="field">
          <span>{t("消息类型")}</span>
          <UnifiedSelect
            ariaLabel={t("消息类型")}
            name="banner_message_type"
            value={banner.type}
            disabled={bannerLocked || !bannerEnabled}
            options={[
              { value: "success", label: t("成功") },
              { value: "info", label: t("信息") },
              { value: "warning", label: t("警告") },
              { value: "danger", label: t("错误") },
            ]}
            onChange={(value) => onChange({ type: value })}
          />
        </label>
        <div>
          <ToggleSetting
            name="banner_closable"
            title={t("允许用户关闭")}
            description={t("显示关闭按钮，用户可隐藏本次公告")}
            checked={banner.closable}
            disabled={bannerLocked || !bannerEnabled}
            onChange={(value) => onChange({ closable: value })}
          />
        </div>
        <label className="field">
          <span>{t("开始日期")}</span>
          <input
            name="banner_from_date"
            type="date"
            value={banner.fromDate}
            disabled={bannerLocked || !bannerEnabled}
            onChange={(event) =>
              onChange({ fromDate: event.currentTarget.value })
            }
          />
        </label>
        <label className="field">
          <span>{t("结束日期")}</span>
          <input
            name="banner_to_date"
            type="date"
            value={banner.toDate}
            disabled={bannerLocked || !bannerEnabled}
            onChange={(event) =>
              onChange({ toDate: event.currentTarget.value })
            }
          />
        </label>
      </div>
    </ConfigurationGroup>
  );
}

/** Builds the configuration update; returns an error message when invalid. */
function systemPayload(
  configuration: HarborConfiguration,
  data: FormData,
  auditEvents: string[],
  enabledAuditEvents: ReadonlySet<string>,
  banner: BannerConfiguration,
): ConfigurationPayload | string {
  const payload: ConfigurationPayload = {};
  for (const key of [
    "project_creation_restriction",
    "robot_name_prefix",
    "audit_log_forward_endpoint",
  ]) {
    addEditable(payload, configuration, key, formString(data, key));
  }
  for (const key of [
    "token_expiration",
    "session_timeout",
    "robot_token_duration",
  ]) {
    addEditable(payload, configuration, key, Number(data.get(key)));
  }
  for (const key of Object.keys(systemToggles(configuration))) {
    addEditable(payload, configuration, key, data.has(key));
  }
  const storageGiB = Number(data.get("storage_per_project_gb"));
  if (!Number.isInteger(storageGiB) || (storageGiB !== -1 && storageGiB <= 0)) {
    return "默认项目配额必须是 -1 或正整数";
  }
  addEditable(
    payload,
    configuration,
    "storage_per_project",
    storageGiB === -1 ? -1 : storageGiB * 1024 ** 3,
  );
  if (auditEvents.length) {
    addEditable(
      payload,
      configuration,
      "disabled_audit_log_event_types",
      auditEvents
        .filter((eventName) => !enabledAuditEvents.has(eventName))
        .join(","),
    );
  }
  let bannerMessage = "";
  if (banner.message.trim()) {
    if (banner.fromDate && banner.toDate && banner.fromDate > banner.toDate) {
      return "横幅消息的结束日期不能早于开始日期";
    }
    bannerMessage = JSON.stringify({
      message: banner.message.trim(),
      type: banner.type,
      closable: banner.closable,
      fromDate: banner.fromDate || null,
      toDate: banner.toDate || null,
    });
  }
  addEditable(payload, configuration, "banner_message", bannerMessage);
  return payload;
}

export function SystemConfiguration({
  configuration,
  auditEvents,
  auditEventsError,
  hasRootCertificate,
  onReload,
  onNotice,
}: {
  configuration: HarborConfiguration;
  auditEvents: string[];
  auditEventsError?: string;
  hasRootCertificate: boolean;
  onReload: () => void;
  onNotice: (message: string, error?: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [toggles, setToggles] = useState(() => systemToggles(configuration));
  const [banner, setBanner] = useState(() =>
    bannerConfiguration(configurationValue(configuration, "banner_message")),
  );
  const disabledAuditEvents = useMemo(
    () =>
      new Set(
        configurationString(configuration, "disabled_audit_log_event_types")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    [configuration],
  );
  const [enabledAuditEvents, setEnabledAuditEvents] = useState<
    ReadonlySet<string>
  >(
    () =>
      new Set(auditEvents.filter((event) => !disabledAuditEvents.has(event))),
  );
  const setToggle = (key: keyof SystemToggles, value: boolean) =>
    setToggles((current) => ({ ...current, [key]: value }));
  const setAuditEventEnabled = (eventName: string, enabled: boolean) =>
    setEnabledAuditEvents((current) => {
      const next = new Set(current);
      if (enabled) next.add(eventName);
      else next.delete(eventName);
      return next;
    });

  async function save(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    const payload = systemPayload(
      configuration,
      new FormData(event.currentTarget),
      auditEvents,
      enabledAuditEvents,
      banner,
    );
    if (typeof payload === "string") {
      onNotice(payload, true);
      return;
    }
    setBusy(true);
    try {
      await controlApi.mutate("configurations", {}, "PUT", payload);
      onNotice("系统设置已保存");
      onReload();
    } catch (error) {
      onNotice(errorMessage(error), true);
      setBusy(false);
    }
  }

  const groupProps = { configuration, toggles, setToggle };
  return (
    <form
      className="settings-form configuration-form"
      onSubmit={(event) => void save(event)}
    >
      <ConfigurationFormHeader
        title="系统设置"
        description="项目创建、会话、机器人账号、审计和横幅消息"
      >
        <ConfigurationSaveButton busy={busy} label="保存系统设置" />
      </ConfigurationFormHeader>
      <AccountAndProjectSettings
        configuration={configuration}
        hasRootCertificate={hasRootCertificate}
      />
      <RuntimePolicySettings {...groupProps} />
      <AuditLogSettings
        {...groupProps}
        auditEvents={auditEvents}
        auditEventsError={auditEventsError}
        enabledAuditEvents={enabledAuditEvents}
        onEnabledAuditEventsChange={setAuditEventEnabled}
      />
      <BannerSettings
        configuration={configuration}
        banner={banner}
        onChange={(update) =>
          setBanner((current) => ({ ...current, ...update }))
        }
      />
    </form>
  );
}
