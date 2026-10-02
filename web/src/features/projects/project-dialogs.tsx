import { useEffect, useMemo, useState } from "react";

import { controlApi } from "../../app/api-client";
import { useLocale } from "../../app/locale-context";
import type { ProjectSummary, Registry } from "../../app/models";
import { ControlDialog } from "../../components/control-dialog";
import { Icon } from "../../components/icons";
import { UnifiedSelect } from "../../components/unified-select";

type ConfigurationValue = {
  value?: unknown;
};

type Configurations = Record<string, ConfigurationValue | number | string>;

type ExportResponse = {
  data?: { id?: number };
};

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

function formString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

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
    throw new Error("项目配额必须是 -1 或正整数");
  }
  if (amount === -1) return -1;
  const multiplier = { MiB: 1024 ** 2, GiB: 1024 ** 3, TiB: 1024 ** 4 }[
    unit as "GiB" | "MiB" | "TiB"
  ];
  if (!multiplier) throw new Error("项目配额单位无效");
  const bytes = amount * multiplier;
  if (!Number.isSafeInteger(bytes) || bytes > 1024 * 1024 ** 4) {
    throw new Error("项目配额不能超过 1024 TiB");
  }
  return bytes;
}

function proxyLimit(value: FormDataEntryValue | null, label: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || (parsed !== -1 && parsed <= 0)) {
    throw new Error(`${label}必须是 -1 或正整数`);
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

export function CreateProjectDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (name: string) => void;
}) {
  const { t } = useLocale();
  const [registries, setRegistries] = useState<Registry[]>([]);
  const [registryError, setRegistryError] = useState("");
  const [configuration, setConfiguration] = useState<Configurations>();
  const [proxyCache, setProxyCache] = useState(false);
  const [registryId, setRegistryId] = useState("");
  const [proxySpeedUnit, setProxySpeedUnit] = useState<"Kbps" | "Mbps">("Kbps");
  const [quotaUnit, setQuotaUnit] = useState<"GiB" | "MiB" | "TiB">("GiB");

  useEffect(() => {
    const controller = new AbortController();
    void Promise.allSettled([
      loadRegistries(controller.signal),
      controlApi.data<Configurations>("configurations", {}, controller.signal),
    ]).then(([registryResult, configurationResult]) => {
      if (controller.signal.aborted) return;
      if (registryResult.status === "fulfilled") {
        setRegistries(registryResult.value);
      } else {
        setRegistryError(
          registryResult.reason instanceof Error
            ? registryResult.reason.message
            : String(registryResult.reason),
        );
      }
      if (configurationResult.status === "fulfilled") {
        setConfiguration(configurationResult.value);
      }
    });
    return () => controller.abort();
  }, []);

  const quota = useMemo(() => quotaDefault(configuration), [configuration]);
  useEffect(() => setQuotaUnit(quota.unit), [quota.unit]);
  const selectedRegistry = registries.find(
    (registry) => String(registry.id ?? "") === registryId,
  );

  return (
    <ControlDialog
      title="新建项目"
      subtitle="名称、项目配额与镜像代理均使用 Harbor 官方项目 API"
      submitLabel="创建项目"
      dialogClass="control-dialog-large create-project-dialog"
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
            throw new Error("镜像代理项目必须选择远端仓库");
          }
          const speed = proxyLimit(formData.get("proxy_speed"), "上游带宽限制");
          const speedKbps =
            speed === -1
              ? -1
              : speed *
                (formData.get("proxy_speed_unit") === "Mbps" ? 1024 : 1);
          if (!Number.isSafeInteger(speedKbps) || speedKbps > 2147483647) {
            throw new Error("上游带宽限制超出 Harbor 支持范围");
          }
          metadata.proxy_speed_kb = String(speedKbps);
          metadata.max_upstream_conn = String(
            proxyLimit(formData.get("max_upstream_conn"), "上游最大连接数"),
          );
          metadata.proxy_cache_local_on_not_found = String(
            formData.has("proxy_cache_local_on_not_found"),
          );
        }
        await controlApi.mutate("projects", {}, "POST", {
          project_name: name,
          metadata,
          storage_limit: quotaBytes(
            formData.get("storage_limit"),
            formString(formData, "storage_unit"),
          ),
          ...(selectedRegistryId === null
            ? {}
            : { registry_id: selectedRegistryId }),
        });
        onCreated(name);
      }}
    >
      <div className="form-grid two-columns create-project-form">
        <label className="field field-span">
          <span>{t("项目名称")}</span>
          <input
            name="project_name"
            required
            maxLength={255}
            pattern="[a-z0-9]+([._-][a-z0-9]+)*"
            placeholder={t("例如 platform-services")}
            autoComplete="off"
          />
        </label>
        <label className="check-row create-project-public">
          <input name="public" type="checkbox" />
          <span>
            <strong>{t("公开项目")}</strong>
            <small>{t("允许未登录用户拉取制品")}</small>
          </span>
        </label>
        <label className="field create-project-quota">
          <span>{t("项目配额限制")}</span>
          <div className="compound-input">
            <input
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
          <small className="field-help">
            {t("输入 -1 表示不限制，最大 1024 TiB。")}
          </small>
        </label>
        <label className="check-row">
          <input name="auto_scan" type="checkbox" />
          <span>
            <strong>{t("自动扫描")}</strong>
            <small>{t("默认关闭；推送后执行漏洞扫描")}</small>
          </span>
        </label>
        <label className="check-row">
          <input name="auto_sbom" type="checkbox" />
          <span>
            <strong>{t("自动生成 SBOM")}</strong>
            <small>{t("推送制品后生成软件物料清单")}</small>
          </span>
        </label>
        <div className="field field-span create-project-type">
          <label className="check-row">
            <input
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
        {registryError ? (
          <div className="warning-banner field-span">
            <Icon name="alert" />
            <span>
              {t("远端仓库载入失败，当前只能创建 Harbor 项目：")}
              {registryError}
            </span>
          </div>
        ) : !registries.length ? (
          <div className="warning-banner field-span">
            <Icon name="alert" />
            <span>
              {t("没有可用于镜像代理的远端仓库，请先到远程仓库页面添加连接。")}
            </span>
          </div>
        ) : null}
        {proxyCache ? (
          <section className="proxy-project-fields field-span">
            <div className="section-heading compact-heading">
              <div>
                <h3>{t("镜像代理设置")}</h3>
              </div>
            </div>
            <div className="form-grid two-columns">
              <label className="field">
                <span>{t("远端仓库")}</span>
                <UnifiedSelect
                  ariaLabel={t("远端仓库")}
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
              <label className="field">
                <span>{t("远端地址")}</span>
                <input
                  name="proxy_endpoint"
                  readOnly
                  value={selectedRegistry?.url ?? ""}
                  placeholder={t("选择远端仓库后显示")}
                />
              </label>
              <label className="field">
                <span>{t("上游带宽限制")}</span>
                <div className="compound-input">
                  <input
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
                <small className="field-help">
                  {t("输入 -1 表示不限制上游拉取带宽。")}
                </small>
              </label>
              <label className="field">
                <span>{t("上游最大连接数")}</span>
                <input
                  name="max_upstream_conn"
                  type="number"
                  step="1"
                  defaultValue="-1"
                  required
                />
                <small className="field-help">
                  {t("输入 -1 表示不限制连接数。")}
                </small>
              </label>
              <label className="check-row field-span">
                <input name="proxy_cache_local_on_not_found" type="checkbox" />
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

export function DeleteProjectsDialog({
  projects,
  onClose,
  onDeleted,
}: {
  projects: ProjectSummary[];
  onClose: () => void;
  onDeleted: (failures: number) => void;
}) {
  const { locale, t } = useLocale();
  const confirmation = `DELETE ${String(projects.length)}`;
  return (
    <ControlDialog
      title="批量删除项目"
      subtitle={
        locale === "en-US"
          ? `Harbor will receive one delete request for each of ${String(projects.length)} projects`
          : `将逐项请求 Harbor 删除 ${String(projects.length)} 个项目`
      }
      submitLabel="永久删除"
      destructive
      onClose={onClose}
      onSubmit={async (formData) => {
        if (formString(formData, "confirmation").trim() !== confirmation) {
          throw new Error(
            locale === "en-US"
              ? `Enter ${confirmation} to confirm`
              : `请输入 ${confirmation} 确认`,
          );
        }
        const results = await Promise.allSettled(
          projects.map((project) =>
            controlApi.mutate("project", { project: project.name }, "DELETE"),
          ),
        );
        onDeleted(
          results.filter((result) => result.status === "rejected").length,
        );
      }}
    >
      <div className="destructive-message">
        <Icon name="alert" />
        <span>
          {t("Harbor 会拒绝删除仍含仓库的项目。请输入")}{" "}
          <code>{confirmation}</code> {t("确认。")}
        </span>
      </div>
      <div className="batch-resource-preview">
        {projects.map((project) => (
          <span key={project.project_id ?? project.name}>
            <Icon name="folder" />
            <code>{project.name}</code>
          </span>
        ))}
      </div>
      <label className="field">
        <span>{t("确认文本")}</span>
        <input name="confirmation" required autoComplete="off" />
      </label>
    </ControlDialog>
  );
}

export function DeleteProjectDialog({
  project,
  onClose,
  onDeleted,
}: {
  project: ProjectSummary;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { locale, t } = useLocale();
  return (
    <ControlDialog
      title="删除项目"
      subtitle={
        locale === "en-US"
          ? `Project ${project.name} and its configuration will be permanently deleted. Harbor rejects deletion while repositories remain.`
          : `项目 ${project.name} 及其配置将被永久删除。Harbor 会拒绝删除仍含仓库的项目。`
      }
      submitLabel="删除项目"
      destructive
      onClose={onClose}
      onSubmit={async (formData) => {
        if (formString(formData, "confirmation").trim() !== project.name) {
          throw new Error(t("输入内容与资源名称不一致"));
        }
        await controlApi.mutate("project", { project: project.name }, "DELETE");
        onDeleted();
      }}
    >
      <div className="destructive-message">
        <Icon name="alert" />
        <span>{t("此操作无法撤销")}</span>
      </div>
      <label className="field">
        <span>{t("输入资源名称确认")}</span>
        <input
          name="confirmation"
          required
          autoComplete="off"
          placeholder={project.name}
        />
      </label>
    </ControlDialog>
  );
}

export function ProjectCveExportDialog({
  project,
  onClose,
  onCreated,
}: {
  project: ProjectSummary;
  onClose: () => void;
  onCreated: (id?: number) => void;
}) {
  const { t } = useLocale();
  return (
    <ControlDialog
      title="新建 CVE 导出"
      subtitle="Harbor 当前一次导出一个项目的扫描数据"
      submitLabel="创建导出任务"
      onClose={onClose}
      onSubmit={async (formData) => {
        const labels = formString(formData, "labels")
          .split(/[\s,]+/)
          .filter(Boolean)
          .map(Number);
        if (labels.some((value) => !Number.isInteger(value) || value <= 0)) {
          throw new Error("标签 ID 必须是用逗号分隔的正整数");
        }
        const payload: Record<string, number[] | string> = {
          projects: [Number(project.project_id)],
          labels,
        };
        ["job_name", "repositories", "cveIds", "tags"].forEach((key) => {
          const value = formString(formData, key).trim();
          if (value) payload[key] = value;
        });
        const result = await controlApi.mutate<ExportResponse>(
          "cve-export",
          {},
          "POST",
          payload,
        );
        onCreated(result.data?.id);
      }}
    >
      <div className="form-grid two-columns">
        <label className="field">
          <span>{t("项目")}</span>
          <input value={project.name} readOnly />
        </label>
        <label className="field">
          <span>{t("任务名称")}</span>
          <input
            name="job_name"
            maxLength={255}
            placeholder={t("例如 月度漏洞审计")}
          />
        </label>
        <label className="field">
          <span>{t("仓库匹配")}</span>
          <input
            name="repositories"
            maxLength={2048}
            placeholder={`${project.name}/**`}
          />
        </label>
        <label className="field">
          <span>{t("Tag 匹配")}</span>
          <input name="tags" maxLength={2048} placeholder="release-*" />
        </label>
        <label className="field">
          <span>{t("CVE 编号")}</span>
          <input
            name="cveIds"
            maxLength={2048}
            placeholder={t("多个编号按 Harbor 查询语法填写")}
          />
        </label>
        <label className="field">
          <span>{t("标签 ID")}</span>
          <input name="labels" maxLength={512} placeholder="12,18" />
        </label>
      </div>
    </ControlDialog>
  );
}
