import { useState } from "react";
import { controlApi } from "../../app/api-client";
import { UserInputError } from "../../app/errors";
import { useLocale } from "../../app/locale-context";
import type { Registry } from "../../app/models";
import { ControlDialog } from "../../components/control-dialog";
import { FormInput } from "../../components/form-input";
import { Icon } from "../../components/icon";
import {
  default as sharedPrimitiveStyles,
  default as uiStyles0,
} from "../../components/shared-ui.module.css";
import { UnifiedSelect } from "../../components/unified-select";
import { createClassNames } from "../../lib/css/class-names";

import { errorText } from "../../app/errors";
import { useControlMutation } from "../../app/use-control-mutation";
import { useLoadedQuery } from "../../app/use-loaded-query";
import { useResettableState } from "../../lib/state/use-resettable-state";
import { affectedQueries, formString } from "./project-dialogs-support";
import { projectKeys } from "./project-keys";
import styles from "./projects.module.css";

type ConfigurationValue = {
  value?: unknown;
};

type Configurations = Record<string, ConfigurationValue | number | string>;

const proxyRegistryTypes = new Set([
  "docker-hub",
  "harbor",
  "azure-acr",
  "ali-acr",
  "aws-ecr",
  "google-gcr",
  "quay",
  "docker-registry",
  "github-ghcr",
  "jfrog-artifactory",
]);

function configurationNumber(
  configuration: Configurations | undefined,
  key: string,
): number {
  const entry = configuration?.[key];
  const value =
    entry && typeof entry === "object" && "value" in entry
      ? entry.value
      : entry;
  return Number.isFinite(Number(value)) ? Number(value) : -1;
}

function quotaDefault(configuration: Configurations | undefined): {
  value: number;
  unit: "GiB" | "MiB" | "TiB";
} {
  const bytes = configurationNumber(configuration, "storage_per_project");
  if (bytes < 0) return { value: -1, unit: "GiB" };
  const units = [
    [1024 ** 4, "TiB"],
    [1024 ** 3, "GiB"],
    [1024 ** 2, "MiB"],
  ] as const;
  const exact = units.find(
    ([multiplier]) =>
      bytes >= multiplier && Number.isInteger(bytes / multiplier),
  );
  const [multiplier, unit] = exact ?? units[1];
  return {
    value: bytes > 0 ? Math.max(1, Math.round(bytes / multiplier)) : -1,
    unit,
  };
}

function quotaBytes(value: FormDataEntryValue | null, unit: string): number {
  const amount = Number(value);
  if (!Number.isInteger(amount) || (amount !== -1 && amount <= 0)) {
    throw new UserInputError("项目配额必须是 -1 或正整数");
  }
  if (amount === -1) return -1;
  const multiplier = { MiB: 1024 ** 2, GiB: 1024 ** 3, TiB: 1024 ** 4 }[
    unit as "GiB" | "MiB" | "TiB"
  ];
  if (!multiplier) throw new UserInputError("项目配额单位无效");
  const bytes = amount * multiplier;
  if (!Number.isSafeInteger(bytes) || bytes > 1024 * 1024 ** 4) {
    throw new UserInputError("项目配额不能超过 1024 TiB");
  }
  return bytes;
}

function proxyLimit(value: FormDataEntryValue | null, label: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || (parsed !== -1 && parsed <= 0)) {
    throw new UserInputError(`${label}必须是 -1 或正整数`);
  }
  return parsed;
}

async function loadRegistries(signal: AbortSignal): Promise<Registry[]> {
  const first = await controlApi.list<Registry>(
    "registries",
    { page: 1, page_size: 100, sort: "name" },
    signal,
  );
  return first.items.filter((registry) =>
    proxyRegistryTypes.has(registry.type ?? ""),
  );
}

type CreateProjectDialogProps = {
  onClose: () => void;
  onCreated: (name: string) => void;
};

export function CreateProjectDialog({
  onClose,
  onCreated,
}: CreateProjectDialogProps) {
  const mutate = useControlMutation(affectedQueries);
  const { t } = useLocale();
  const setupQuery = useCreateProjectData();
  const registries = (() => setupQuery.data?.registries ?? [])();
  const registryError = setupQuery.data?.registryError ?? "";
  const configuration = setupQuery.data?.configuration;
  const [proxyCache, setProxyCache] = useState(false);
  const [registryId, setRegistryId] = useState("");
  const [proxySpeedUnit, setProxySpeedUnit] = useState<"Kbps" | "Mbps">("Kbps");

  const quota = (() => quotaDefault(configuration))();
  // The unit follows Harbor's default until the configuration changes it.
  const [quotaUnit, setQuotaUnit] = useResettableState(quota.unit);
  const selectedRegistry = registries.find(
    (registry) => String(registry.id ?? "") === registryId,
  );

  return (
    <ControlDialog
      title="新建项目"
      subtitle="名称、项目配额与镜像代理均使用 Harbor 官方项目 API"
      submitLabel="创建项目"
      dialogClass={resolveClasses(
        `control-dialog-large ${styles.createProjectDialog}`,
      )}
      onClose={onClose}
      onSubmit={async (formData) => {
        const name = formString(formData, "project_name").trim();
        const metadata: Record<string, string> = {
          public: String(formData.has("public")),
          auto_scan: String(formData.has("auto_scan")),
          auto_sbom_generation: String(formData.has("auto_sbom")),
          prevent_vul: "false",
          severity: "critical",
        };
        let selectedRegistryId: number | null = null;
        if (proxyCache) {
          selectedRegistryId = Number(formData.get("registry_id"));
          if (
            !Number.isInteger(selectedRegistryId) ||
            selectedRegistryId <= 0
          ) {
            throw new UserInputError("镜像代理项目必须选择远端仓库");
          }
          const speed = proxyLimit(formData.get("proxy_speed"), "上游带宽限制");
          const speedKbps =
            speed === -1
              ? -1
              : speed *
                (formData.get("proxy_speed_unit") === "Mbps" ? 1024 : 1);
          if (!Number.isSafeInteger(speedKbps) || speedKbps > 2147483647) {
            throw new UserInputError("上游带宽限制超出 Harbor 支持范围");
          }
          metadata.proxy_speed_kb = String(speedKbps);
          metadata.max_upstream_conn = String(
            proxyLimit(formData.get("max_upstream_conn"), "上游最大连接数"),
          );
          metadata.proxy_cache_local_on_not_found = String(
            formData.has("proxy_cache_local_on_not_found"),
          );
        }
        await mutate({
          operation: "projects",
          parameters: {},
          method: "POST",
          payload: {
            project_name: name,
            metadata,
            storage_limit: quotaBytes(
              formData.get("storage_limit"),
              formString(formData, "storage_unit"),
            ),
            ...(selectedRegistryId === null
              ? {}
              : { registry_id: selectedRegistryId }),
          },
        });
        onCreated(name);
      }}
    >
      <div
        className={resolveClasses(
          `form-grid two-columns ${styles.createProjectForm}`,
        )}
      >
        <label className={resolveClasses("field field-span")}>
          <span>{t("项目名称")}</span>
          <FormInput
            name="project_name"
            required
            maxLength={255}
            pattern="[a-z0-9]+([._\-][a-z0-9]+)*"
            placeholder={t("例如 platform-services")}
            autoComplete="off"
          />
        </label>
        <label className={resolveClasses("check-row create-project-public")}>
          <FormInput name="public" type="checkbox" />
          <span>
            <strong>{t("公开项目")}</strong>
            <small>{t("允许未登录用户拉取制品")}</small>
          </span>
        </label>
        <label className={resolveClasses("field create-project-quota")}>
          <span>{t("项目配额限制")}</span>
          <div className={resolveClasses(styles.compoundInput)}>
            <FormInput
              key={quota.value}
              name="storage_limit"
              type="number"
              step="1"
              required
              defaultValue={quota.value}
              aria-label={t("项目配额数值")}
            />
            <UnifiedSelect
              name="storage_unit"
              value={quotaUnit}
              ariaLabel={t("项目配额单位")}
              options={[
                { value: "MiB", label: "MiB" },
                { value: "GiB", label: "GiB" },
                { value: "TiB", label: "TiB" },
              ]}
              onChange={setQuotaUnit}
            />
          </div>
          <small className={resolveClasses("field-help")}>
            {t("输入 -1 表示不限制，最大 1024 TiB。")}
          </small>
        </label>
        <label className={resolveClasses("check-row")}>
          <FormInput name="auto_scan" type="checkbox" />
          <span>
            <strong>{t("自动扫描")}</strong>
            <small>{t("默认关闭；推送后执行漏洞扫描")}</small>
          </span>
        </label>
        <label className={resolveClasses("check-row")}>
          <FormInput name="auto_sbom" type="checkbox" />
          <span>
            <strong>{t("自动生成 SBOM")}</strong>
            <small>{t("推送制品后生成软件物料清单")}</small>
          </span>
        </label>
        <div
          className={resolveClasses(
            `field field-span ${styles.createProjectType}`,
          )}
        >
          <label className={resolveClasses("check-row")}>
            <FormInput
              name="proxy_cache"
              type="checkbox"
              checked={proxyCache}
              disabled={!registries.length}
              onChange={(event) => {
                setProxyCache(event.currentTarget.checked);
                if (!event.currentTarget.checked) setRegistryId("");
              }}
            />
            <span>
              <strong>{t("镜像代理项目")}</strong>
              <small>
                {t("缓存远端仓库中的制品；项目创建后不能切换为 Harbor 项目")}
              </small>
            </span>
          </label>
        </div>
        {(() => {
          if (registryError) {
            return (
              <div
                className={resolveClasses("notice notice-warning field-span")}
              >
                <Icon name="alert" />
                <span>
                  {t("远端仓库载入失败，当前只能创建 Harbor 项目：")}
                  {registryError}
                </span>
              </div>
            );
          }
          if (!registries.length) {
            return (
              <div
                className={resolveClasses("notice notice-warning field-span")}
              >
                <Icon name="alert" />
                <span>
                  {t(
                    "没有可用于镜像代理的远端仓库，请先到远端仓库页面添加连接。",
                  )}
                </span>
              </div>
            );
          }
          return null;
        })()}
        {proxyCache ? (
          <section
            className={resolveClasses(
              `${styles.proxyProjectFields} field-span`,
            )}
          >
            <div className={resolveClasses("section-heading compact-heading")}>
              <div>
                <h3>{t("镜像代理设置")}</h3>
              </div>
            </div>
            <div className={resolveClasses("form-grid two-columns")}>
              <label className={resolveClasses("field")}>
                <span>{t("代理远端仓库")}</span>
                <UnifiedSelect
                  ariaLabel={t("代理远端仓库")}
                  name="registry_id"
                  value={registryId}
                  options={[
                    { value: "", label: t("请选择远端仓库") },
                    ...registries.map((registry) => ({
                      value: String(registry.id ?? ""),
                      label: `${registry.name ?? ""} · ${registry.type ?? ""}`,
                      disabled: !registry.id,
                    })),
                  ]}
                  onChange={setRegistryId}
                />
              </label>
              <label className={resolveClasses("field")}>
                <span>{t("远端地址")}</span>
                <FormInput
                  name="proxy_endpoint"
                  readOnly
                  value={selectedRegistry?.url ?? ""}
                  placeholder={t("选择远端仓库后显示")}
                />
              </label>
              <label className={resolveClasses("field")}>
                <span>{t("上游带宽限制")}</span>
                <div className={resolveClasses(styles.compoundInput)}>
                  <FormInput
                    name="proxy_speed"
                    type="number"
                    step="1"
                    defaultValue="-1"
                    required
                  />
                  <UnifiedSelect
                    ariaLabel={t("上游带宽单位")}
                    name="proxy_speed_unit"
                    value={proxySpeedUnit}
                    options={[
                      { value: "Kbps", label: "Kbps" },
                      { value: "Mbps", label: "Mbps" },
                    ]}
                    onChange={setProxySpeedUnit}
                  />
                </div>
                <small className={resolveClasses("field-help")}>
                  {t("输入 -1 表示不限制上游拉取带宽。")}
                </small>
              </label>
              <label className={resolveClasses("field")}>
                <span>{t("上游最大连接数")}</span>
                <FormInput
                  name="max_upstream_conn"
                  type="number"
                  step="1"
                  defaultValue="-1"
                  required
                />
                <small className={resolveClasses("field-help")}>
                  {t("输入 -1 表示不限制连接数。")}
                </small>
              </label>
              <label className={resolveClasses("check-row field-span")}>
                <FormInput
                  name="proxy_cache_local_on_not_found"
                  type="checkbox"
                />
                <span>
                  <strong>{t("上游未找到时使用本地制品")}</strong>
                  <small>
                    {t("远端返回未找到时，允许继续从本项目的本地缓存读取。")}
                  </small>
                </span>
              </label>
            </div>
          </section>
        ) : null}
      </div>
    </ControlDialog>
  );
}

const resolveClasses = createClassNames({
  critical: sharedPrimitiveStyles.critical,
  "control-dialog": uiStyles0.controlDialog,
  icon: uiStyles0.icon,
  "unified-select": uiStyles0.unifiedSelect,
  "control-dialog-large": uiStyles0.controlDialogLarge,
  "form-grid": uiStyles0.formGrid,
  "two-columns": uiStyles0.twoColumns,
  field: uiStyles0.field,
  "field-span": uiStyles0.fieldSpan,
  "check-row": uiStyles0.checkRow,
  "field-help": uiStyles0.fieldHelp,
  notice: uiStyles0.notice,
  "notice-warning": uiStyles0.noticeWarning,
  "section-heading": uiStyles0.sectionHeading,
  "compact-heading": uiStyles0.compactHeading,
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

function useCreateProjectData() {
  return useLoadedQuery(projectKeys.createSetup, async (signal) => {
    const [registryResult, configurationResult] = await Promise.allSettled([
      loadRegistries(signal),
      controlApi.data<Configurations>("configurations", {}, signal),
    ]);
    return {
      registries:
        registryResult.status === "fulfilled" ? registryResult.value : [],
      registryError:
        registryResult.status === "rejected"
          ? errorText(registryResult.reason)
          : "",
      configuration:
        configurationResult.status === "fulfilled"
          ? configurationResult.value
          : undefined,
    };
  });
}
