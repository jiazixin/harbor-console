import { useMemo, useState } from "react";

import { controlApi } from "../../app/api-client";
import { useLocale } from "../../app/locale-context";
import type { Registry, RegistryAdapterInfo } from "../../app/models";
import { ControlDialog } from "../../components/control-dialog";
import { Icon } from "../../components/icons";
import { UnifiedSelect } from "../../components/unified-select";

function formString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

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

export function RegistryDialog({
  registry,
  adapters,
  adapterInfos,
  onClose,
  onSaved,
  onNotice,
}: {
  registry?: Registry;
  adapters: string[];
  adapterInfos: Partial<Record<string, RegistryAdapterInfo>>;
  onClose: () => void;
  onSaved: () => void;
  onNotice: (message: string, error?: boolean) => void;
}) {
  const { t } = useLocale();
  const availableAdapters = adapters.length
    ? adapters
    : ["harbor", "docker-hub", "docker-registry"];
  const [type, setType] = useState(registry?.type ?? availableAdapters[0]);
  const info = adapterInfos[type] ?? {};
  const endpoints = info.endpoint_pattern?.endpoints ?? [];
  const fixedEndpoint =
    info.endpoint_pattern?.endpoint_type === "EndpointPatternTypeFix";
  const listedEndpoint =
    info.endpoint_pattern?.endpoint_type === "EndpointPatternTypeList" &&
    endpoints.length > 0;
  const initialUrl =
    registry?.url ??
    (endpoints.length === 1 ? (endpoints[0]?.value ?? "") : "");
  const [url, setUrl] = useState(initialUrl);
  const [accessKey, setAccessKey] = useState(
    registry?.credential?.access_key ??
      info.credential_pattern?.access_key_data ??
      "",
  );
  const [accessSecret, setAccessSecret] = useState("");
  const [insecure, setInsecure] = useState(Boolean(registry?.insecure));
  const [caCertificate, setCaCertificate] = useState(
    registry?.ca_certificate ?? "",
  );
  const secretIsFile =
    info.credential_pattern?.access_secret_type === "AccessSecretTypeFile";
  const accessKeyFixed =
    info.credential_pattern?.access_key_type === "AccessKeyTypeFix";

  const draft = useMemo<RegistryDraft>(
    () => ({ type, url, accessKey, accessSecret, insecure, caCertificate }),
    [accessKey, accessSecret, caCertificate, insecure, type, url],
  );

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
      await controlApi.mutate("registry-ping", {}, "POST", payload);
      onNotice("当前配置连接正常");
    } catch (error) {
      onNotice(error instanceof Error ? error.message : String(error), true);
    }
  }

  return (
    <ControlDialog
      title={registry ? "编辑远端仓库" : "新建远端仓库"}
      subtitle={registry?.name ?? "连接 Harbor 支持的 Registry Adapter"}
      submitLabel={registry ? "保存连接" : "创建连接"}
      dialogClass="control-dialog-large"
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
        await controlApi.mutate(
          registry ? "registry" : "registries",
          registry ? { id: registry.id } : {},
          registry ? "PUT" : "POST",
          payload,
        );
        onSaved();
      }}
    >
      <div className="form-grid two-columns registry-core-fields">
        <label className="field">
          <span>{t("连接名称")}</span>
          <input
            name="name"
            required
            maxLength={255}
            defaultValue={registry?.name}
          />
        </label>
        <label className="field">
          <span>{t("仓库类型")}</span>
          {registry ? (
            <input value={t(registryTypeLabel(type))} disabled />
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
      <div className="form-grid two-columns registry-adapter-grid">
        {listedEndpoint && !registry ? (
          <label className="field field-span">
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
        <label className="field field-span">
          <span>
            {t(
              fixedEndpoint
                ? "官方仓库地址"
                : listedEndpoint
                  ? "仓库地址"
                  : "仓库地址（手工填写）",
            )}
          </span>
          <input
            name="url"
            type="url"
            required
            readOnly={fixedEndpoint}
            value={url}
            placeholder="https://registry.example.com"
            onChange={(event) => setUrl(event.currentTarget.value)}
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
        <label className="field">
          <span>{t("访问账号 / Access Key")}</span>
          <input
            name="access_key"
            value={accessKey}
            readOnly={accessKeyFixed}
            autoComplete="username"
            onChange={(event) => setAccessKey(event.currentTarget.value)}
          />
          {accessKeyFixed ? (
            <small>{t("该账号值由 Harbor Adapter 固定。")}</small>
          ) : null}
        </label>
        {secretIsFile ? (
          <label className="field field-span">
            <span>{t("JSON 服务账号密钥")}</span>
            <textarea
              className="credential-file-input mono"
              name="access_secret"
              rows={7}
              autoComplete="off"
              value={accessSecret}
              placeholder={t(
                registry ? "留空表示不修改" : "粘贴完整的服务账号 JSON",
              )}
              onChange={(event) => setAccessSecret(event.currentTarget.value)}
            />
            <small>{t("Google GCR 使用 JSON Key 文件内容进行认证。")}</small>
          </label>
        ) : (
          <label className="field">
            <span>{t("访问密码 / Secret")}</span>
            <input
              name="access_secret"
              type="password"
              autoComplete="new-password"
              value={accessSecret}
              placeholder={t(registry ? "留空表示不修改" : "可选")}
              onChange={(event) => setAccessSecret(event.currentTarget.value)}
            />
          </label>
        )}
        <label className="field field-span">
          <span>{t("描述")}</span>
          <textarea
            name="description"
            rows={3}
            maxLength={1024}
            defaultValue={registry?.description}
          />
        </label>
        <label className="field field-span">
          <span>{t("自定义 CA 证书")}</span>
          <textarea
            className="mono"
            name="ca_certificate"
            rows={5}
            value={caCertificate}
            placeholder={
              "-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----"
            }
            onChange={(event) => setCaCertificate(event.currentTarget.value)}
          />
          <small>
            {t("可选。填写 PEM 证书后，Harbor 使用它验证此远端仓库。")}
          </small>
        </label>
      </div>
      <label className="check-row registry-insecure-row">
        <input
          name="insecure"
          type="checkbox"
          checked={insecure}
          onChange={(event) => setInsecure(event.currentTarget.checked)}
        />
        <span>
          <strong>{t("跳过 TLS 证书验证")}</strong>
          <small>
            {t("仅用于可信内网和自签名证书；启用后不会使用上面的 CA 证书。")}
          </small>
        </span>
      </label>
      <div className="registry-dialog-actions">
        <button
          className="button button-small"
          type="button"
          onClick={() => void testDraft()}
        >
          <Icon name="refresh" />
          <span>{t("测试当前配置")}</span>
        </button>
        <span className="field-help">
          {t("测试使用当前表单内容，不会保存连接。")}
        </span>
      </div>
    </ControlDialog>
  );
}

export function DeleteRegistryDialog({
  registry,
  onClose,
  onDeleted,
}: {
  registry: Registry;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { locale, t } = useLocale();
  const name = registry.name ?? "";
  return (
    <ControlDialog
      title="删除远端仓库"
      subtitle={
        locale === "en-US"
          ? `Connection ${name} will be deleted. Replication policies referencing it may need to be updated first.`
          : `连接 ${name} 将被删除，引用它的复制策略可能需要先调整。`
      }
      submitLabel="删除连接"
      destructive
      onClose={onClose}
      onSubmit={async (formData) => {
        if (formString(formData, "confirmation") !== name)
          throw new Error(t("输入内容与资源名称不一致"));
        await controlApi.mutate("registry", { id: registry.id }, "DELETE");
        onDeleted();
      }}
    >
      <div className="notice notice-danger">
        <Icon name="alert" />
        <span>{t("此操作无法撤销")}</span>
      </div>
      <label className="field">
        <span>{t("输入资源名称确认")}</span>
        <input
          name="confirmation"
          required
          autoComplete="off"
          placeholder={name}
        />
      </label>
    </ControlDialog>
  );
}
