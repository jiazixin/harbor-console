import { useState } from "react";
import { useLocale } from "../../app/locale-context";
import type { Registry, RegistryAdapterInfo } from "../../app/models";
import { ControlDialog } from "../../components/control-dialog";
import { FormInput } from "../../components/form-input";
import { FormTextarea } from "../../components/form-textarea";
import { Icon } from "../../components/icon";
import uiStyles0 from "../../components/shared-ui.module.css";
import { UnifiedSelect } from "../../components/unified-select";
import { createClassNames } from "../../lib/css/class-names";

import { errorText } from "../../app/errors";
import { useControlMutation } from "../../app/use-control-mutation";
import styles from "./registries.module.css";
import { affectedQueries, formString } from "./registry-dialogs-support";

function registryTypeLabel(value: string): string {
  return (
    {
      harbor: "Harbor",
      "docker-hub": "Docker Hub",
      "docker-registry": "Docker Registry",
      "aws-ecr": "AWS ECR",
      "azure-acr": "Azure ACR",
      "google-gcr": "Google GCR",
      "ali-acr": "阿里云 ACR",
      "huawei-SWR": "华为云 SWR",
      "tencent-tcr": "腾讯云 TCR",
      "volcengine-cr": "火山引擎 CR",
      "github-ghcr": "GitHub GHCR",
      gitlab: "GitLab",
      quay: "Quay",
      "jfrog-artifactory": "JFrog Artifactory",
    }[value] ?? value
  );
}

type RegistryDraft = {
  type: string;
  url: string;
  accessKey: string;
  accessSecret: string;
  insecure: boolean;
  caCertificate: string;
};

type RegistryDialogProps = {
  registry?: Registry;
  adapters: string[];
  adapterInfos: Partial<Record<string, RegistryAdapterInfo>>;
  onClose: () => void;
  onSaved: () => void;
  onNotice: (message: string, error?: boolean) => void;
};

export function RegistryDialog({
  registry,
  adapters,
  adapterInfos,
  onClose,
  onSaved,
  onNotice,
}: RegistryDialogProps) {
  const mutate = useControlMutation(affectedQueries);
  const { t } = useLocale();
  const availableAdapters = adapters.length
    ? adapters
    : ["harbor", "docker-hub", "docker-registry"];
  const [type, setType] = useState(
    registry?.type ?? availableAdapters[0] ?? "harbor",
  );
  const adapterInfo = adapterInfos[type] ?? {};
  const endpoints = adapterInfo.endpoint_pattern?.endpoints ?? [];
  const fixedEndpoint =
    adapterInfo.endpoint_pattern?.endpoint_type === "EndpointPatternTypeFix";
  const listedEndpoint =
    adapterInfo.endpoint_pattern?.endpoint_type === "EndpointPatternTypeList" &&
    endpoints.length > 0;
  const initialUrl =
    registry?.url ??
    (endpoints.length === 1 ? (endpoints[0]?.value ?? "") : "");
  const [url, setUrl] = useState(initialUrl);
  const [accessKey, setAccessKey] = useState(
    registry?.credential?.access_key ??
      adapterInfo.credential_pattern?.access_key_data ??
      "",
  );
  const [accessSecret, setAccessSecret] = useState("");
  const [insecure, setInsecure] = useState(Boolean(registry?.insecure));
  const [caCertificate, setCaCertificate] = useState(
    registry?.ca_certificate ?? "",
  );
  const secretIsFile =
    adapterInfo.credential_pattern?.access_secret_type ===
    "AccessSecretTypeFile";
  const accessKeyFixed =
    adapterInfo.credential_pattern?.access_key_type === "AccessKeyTypeFix";

  const draft = ((): RegistryDraft =>
    (() => ({
      type,
      url,
      accessKey,
      accessSecret,
      insecure,
      caCertificate,
    }))())();

  async function testDraft() {
    try {
      const payload: Record<string, unknown> = {
        type: draft.type,
        url: draft.url.trim(),
        credential_type: "basic",
        access_key: draft.accessKey.trim(),
        insecure: draft.insecure,
        ca_certificate: draft.caCertificate.trim(),
      };
      if (registry?.id) payload.id = registry.id;
      if (draft.accessSecret) payload.access_secret = draft.accessSecret;
      await mutate({
        operation: "registry-ping",
        parameters: {},
        method: "POST",
        payload: payload,
      });
      onNotice("当前配置连接正常");
    } catch (error) {
      onNotice(errorText(error), true);
    }
  }

  return (
    <ControlDialog
      title={registry ? "编辑远端仓库" : "新建远端仓库"}
      subtitle={registry?.name ?? "连接 Harbor 支持的 Registry Adapter"}
      submitLabel={registry ? "保存连接" : "创建连接"}
      dialogClass={resolveClasses("control-dialog-large")}
      onClose={onClose}
      onSubmit={async (formData) => {
        const secret = formString(formData, "access_secret");
        const payload: Record<string, unknown> = registry
          ? {
              name: formString(formData, "name"),
              description: formString(formData, "description"),
              url: draft.url.trim(),
              credential_type: "basic",
              access_key: draft.accessKey.trim(),
              insecure: draft.insecure,
              ca_certificate: draft.caCertificate.trim(),
            }
          : {
              name: formString(formData, "name"),
              description: formString(formData, "description"),
              type: draft.type,
              url: draft.url.trim(),
              insecure: draft.insecure,
              ca_certificate: draft.caCertificate.trim(),
              credential: {
                type: "basic",
                access_key: draft.accessKey.trim(),
                access_secret: secret,
              },
            };
        if (registry && secret) payload.access_secret = secret;
        await mutate({
          operation: registry ? "registry" : "registries",
          parameters: registry ? { id: registry.id } : {},
          method: registry ? "PUT" : "POST",
          payload: payload,
        });
        onSaved();
      }}
    >
      <div
        className={resolveClasses("form-grid two-columns registry-core-fields")}
      >
        <label className={resolveClasses("field")}>
          <span>{t("连接名称")}</span>
          <FormInput
            name="name"
            required
            maxLength={255}
            defaultValue={registry?.name}
          />
        </label>
        <label className={resolveClasses("field")}>
          <span>{t("仓库类型")}</span>
          {registry ? (
            <FormInput value={t(registryTypeLabel(type))} disabled />
          ) : (
            <UnifiedSelect
              name="type"
              ariaLabel={t("仓库类型")}
              value={type}
              options={availableAdapters.map((adapter) => ({
                value: adapter,
                label: t(registryTypeLabel(adapter)),
              }))}
              onChange={(next) => {
                setType(next);
                const nextEndpoints =
                  adapterInfos[next]?.endpoint_pattern?.endpoints ?? [];
                setUrl(
                  nextEndpoints.length === 1
                    ? (nextEndpoints[0]?.value ?? "")
                    : "",
                );
                setAccessKey(
                  adapterInfos[next]?.credential_pattern?.access_key_data ?? "",
                );
                setAccessSecret("");
              }}
            />
          )}
        </label>
      </div>
      <div
        className={resolveClasses(
          `form-grid two-columns ${styles.registryAdapterGrid}`,
        )}
      >
        {listedEndpoint && !registry ? (
          <label className={resolveClasses("field field-span")}>
            <span>{t("区域或官方端点")}</span>
            <UnifiedSelect
              ariaLabel={t("区域或官方端点")}
              value={
                endpoints.some((endpoint) => endpoint.value === url) ? url : ""
              }
              options={[
                { value: "", label: t("请选择端点") },
                ...endpoints.map((endpoint) => ({
                  value: endpoint.value ?? "",
                  label: endpoint.key ?? endpoint.value ?? "-",
                })),
              ]}
              onChange={(next) => {
                if (next) setUrl(next);
              }}
            />
            <small>
              {t("选择后会自动填入 Harbor 官方 Adapter 提供的端点。")}
            </small>
          </label>
        ) : null}
        <label className={resolveClasses("field field-span")}>
          <span>
            {t(
              (() => {
                if (fixedEndpoint) {
                  return "官方仓库地址";
                }
                if (listedEndpoint) {
                  return "仓库地址";
                }
                return "仓库地址（手工填写）";
              })(),
            )}
          </span>
          <FormInput
            name="url"
            type="url"
            required
            readOnly={fixedEndpoint}
            value={url}
            placeholder="https://registry.example.com"
            onChange={(event) => {
              setUrl(event.currentTarget.value);
            }}
          />
          {fixedEndpoint ? (
            <small>{t("该地址由 Harbor Adapter 固定，不支持修改。")}</small>
          ) : (
            <small>
              {t(
                listedEndpoint
                  ? "Harbor 允许在选择官方端点后继续调整最终地址。"
                  : "请输入该 Registry Adapter 可访问的完整 HTTP 或 HTTPS 地址。",
              )}
            </small>
          )}
        </label>
        <label className={resolveClasses("field")}>
          <span>{t("访问账号 / Access Key")}</span>
          <FormInput
            name="access_key"
            value={accessKey}
            readOnly={accessKeyFixed}
            autoComplete="username"
            onChange={(event) => {
              setAccessKey(event.currentTarget.value);
            }}
          />
          {accessKeyFixed ? (
            <small>{t("该账号值由 Harbor Adapter 固定。")}</small>
          ) : null}
        </label>
        {secretIsFile ? (
          <label className={resolveClasses("field field-span")}>
            <span>{t("JSON 服务账号密钥")}</span>
            <FormTextarea
              className={resolveClasses(`${styles.credentialFileInput} mono`)}
              name="access_secret"
              rows={7}
              autoComplete="off"
              value={accessSecret}
              placeholder={t(
                registry ? "留空表示不修改" : "粘贴完整的服务账号 JSON",
              )}
              onChange={(event) => {
                setAccessSecret(event.currentTarget.value);
              }}
            />
            <small>{t("Google GCR 使用 JSON Key 文件内容进行认证。")}</small>
          </label>
        ) : (
          <label className={resolveClasses("field")}>
            <span>{t("访问密码 / Secret")}</span>
            <FormInput
              name="access_secret"
              type="password"
              autoComplete="new-password"
              value={accessSecret}
              placeholder={t(registry ? "留空表示不修改" : "可选")}
              onChange={(event) => {
                setAccessSecret(event.currentTarget.value);
              }}
            />
          </label>
        )}
        <label className={resolveClasses("field field-span")}>
          <span>{t("描述")}</span>
          <FormTextarea
            name="description"
            rows={3}
            maxLength={1024}
            defaultValue={registry?.description}
          />
        </label>
        <label className={resolveClasses("field field-span")}>
          <span>{t("自定义 CA 证书")}</span>
          <FormTextarea
            className={resolveClasses("mono")}
            name="ca_certificate"
            rows={5}
            value={caCertificate}
            placeholder={
              "-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----"
            }
            onChange={(event) => {
              setCaCertificate(event.currentTarget.value);
            }}
          />
          <small>
            {t("可选。填写 PEM 证书后，Harbor 使用它验证此远端仓库。")}
          </small>
        </label>
      </div>
      <label
        className={resolveClasses(`check-row ${styles.registryInsecureRow}`)}
      >
        <FormInput
          name="insecure"
          type="checkbox"
          checked={insecure}
          onChange={(event) => {
            setInsecure(event.currentTarget.checked);
          }}
        />
        <span>
          <strong>{t("跳过 TLS 证书验证")}</strong>
          <small>
            {t("仅用于可信内网和自签名证书；启用后不会使用上面的 CA 证书。")}
          </small>
        </span>
      </label>
      <div className={resolveClasses("registry-dialog-actions")}>
        <button
          className={resolveClasses("button button-small")}
          type="button"
          onClick={() => void testDraft()}
        >
          <Icon name="refresh" />
          <span>{t("测试当前配置")}</span>
        </button>
        <span className={resolveClasses("field-help")}>
          {t("测试使用当前表单内容，不会保存连接。")}
        </span>
      </div>
    </ControlDialog>
  );
}

const resolveClasses = createClassNames({
  "control-dialog": uiStyles0.controlDialog,
  icon: uiStyles0.icon,
  "unified-select": uiStyles0.unifiedSelect,
  "control-dialog-large": uiStyles0.controlDialogLarge,
  "form-grid": uiStyles0.formGrid,
  "two-columns": uiStyles0.twoColumns,
  field: uiStyles0.field,
  "field-span": uiStyles0.fieldSpan,
  mono: uiStyles0.mono,
  "check-row": uiStyles0.checkRow,
  "registry-dialog-actions": uiStyles0.registryDialogActions,
  button: uiStyles0.button,
  "button-small": uiStyles0.buttonSmall,
  "field-help": uiStyles0.fieldHelp,
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
