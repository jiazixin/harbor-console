import { useMemo, useState } from "react";

import { controlApi } from "../../app/api-client";
import { useLocale } from "../../app/locale-context";
import type { RepositorySummary, Session } from "../../app/models";
import { loadPreferences } from "../../app/preferences";
import { ControlDialog } from "../../components/control-dialog";
import { Icon } from "../../components/icons";

function formString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function repositoryDisplayName(project: string, repository: string): string {
  const prefix = `${project}/`;
  return repository.startsWith(prefix)
    ? repository.slice(prefix.length)
    : repository;
}

function registryHost(instanceUrl: string): string {
  try {
    return new URL(instanceUrl).host;
  } catch {
    return instanceUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
  }
}

function fullRepositoryName(project: string, repository: string): string {
  return repository.startsWith(`${project}/`)
    ? repository
    : `${project}/${repository}`;
}

export function DeleteRepositoriesDialog({
  project,
  repositories,
  onClose,
  onDeleted,
}: {
  project: string;
  repositories: RepositorySummary[];
  onClose: () => void;
  onDeleted: (failures: number) => void;
}) {
  const { locale, t } = useLocale();
  const confirmation = `DELETE ${String(repositories.length)}`;
  return (
    <ControlDialog
      title="批量删除仓库"
      subtitle={
        locale === "en-US"
          ? `Permanently delete ${String(repositories.length)} repositories and all their artifacts`
          : `将永久删除 ${String(repositories.length)} 个仓库及其中全部制品`
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
          repositories.map((repository) =>
            controlApi.mutate(
              "repository",
              { project, repository: repository.name },
              "DELETE",
            ),
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
          {t("此操作无法撤销。请输入")} <code>{confirmation}</code>{" "}
          {t("确认。")}
        </span>
      </div>
      <div className="batch-resource-preview">
        {repositories.map((repository) => (
          <span key={repository.id ?? repository.name}>
            <Icon name="package" />
            <code>{repositoryDisplayName(project, repository.name)}</code>
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

export function EditRepositoryDialog({
  project,
  repository,
  onClose,
  onSaved,
}: {
  project: string;
  repository: RepositorySummary;
  onClose: () => void;
  onSaved: () => void;
}) {
  return (
    <ControlDialog
      title="编辑仓库"
      subtitle={repository.name}
      submitLabel="保存仓库"
      onClose={onClose}
      onSubmit={async (formData) => {
        await controlApi.mutate(
          "repository",
          { project, repository: repository.name },
          "PUT",
          { description: formString(formData, "description").trim() },
        );
        onSaved();
      }}
    >
      <label className="field">
        <span>仓库描述</span>
        <textarea
          name="description"
          rows={4}
          maxLength={1024}
          defaultValue={repository.description ?? ""}
          placeholder="输入仓库用途或维护信息"
        />
      </label>
    </ControlDialog>
  );
}

export function DeleteRepositoryDialog({
  project,
  repository,
  onClose,
  onDeleted,
}: {
  project: string;
  repository: RepositorySummary;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { locale, t } = useLocale();
  const confirmation = repository.name;
  return (
    <ControlDialog
      title="删除仓库"
      subtitle={
        locale === "en-US"
          ? `Repository ${repository.name} and all of its artifacts will be permanently deleted.`
          : `仓库 ${repository.name} 及其中全部制品将被永久删除。`
      }
      submitLabel="删除仓库"
      destructive
      onClose={onClose}
      onSubmit={async (formData) => {
        if (formString(formData, "confirmation").trim() !== confirmation) {
          throw new Error(
            locale === "en-US"
              ? "Enter the full resource name before confirming"
              : "请输入完整资源名称后再确认",
          );
        }
        await controlApi.mutate(
          "repository",
          { project, repository: repository.name },
          "DELETE",
        );
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
          placeholder={confirmation}
        />
      </label>
    </ControlDialog>
  );
}

export function PushCommandDialog({
  project,
  repository = "",
  session,
  onClose,
  onCopied,
}: {
  project: string;
  repository?: string;
  session: Session;
  onClose: () => void;
  onCopied: (error?: boolean) => void;
}) {
  const { t } = useLocale();
  const [localImage, setLocalImage] = useState("local-image:latest");
  const [repositoryName, setRepositoryName] = useState(() =>
    repositoryDisplayName(project, repository),
  );
  const [tag, setTag] = useState("latest");
  const host = registryHost(session.instance_url);
  const [runtime] = useState(() => loadPreferences().runtime);
  const commands = useMemo(() => {
    const localImageValue = localImage.trim();
    const repositoryValue = repositoryName.trim();
    const tagValue = tag.trim();
    if (!localImageValue || !repositoryValue || !tagValue) return [];
    const target = `${host}/${fullRepositoryName(project, repositoryValue)}:${tagValue}`;
    return [
      `${runtime} login ${host}`,
      `${runtime} tag ${localImageValue} ${target}`,
      `${runtime} push ${target}`,
    ];
  }, [host, localImage, project, repositoryName, tag]);

  async function copyValue(value: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      onCopied();
    } catch {
      onCopied(true);
    }
  }

  return (
    <ControlDialog
      title="推送镜像"
      subtitle={`${project} · ${runtime}`}
      submitLabel="关闭"
      submitIcon="x"
      showCancel={false}
      dialogClass="control-dialog-wide"
      onClose={onClose}
      onSubmit={() => Promise.resolve(onClose())}
    >
      <div className="form-grid push-command-fields">
        <label className="field">
          <span>{t("本地镜像")}</span>
          <input
            name="local_image"
            required
            maxLength={512}
            pattern="[^\s]+"
            value={localImage}
            placeholder="local-image:latest"
            onChange={(event) => setLocalImage(event.currentTarget.value)}
          />
        </label>
        <label className="field">
          <span>{t("目标仓库")}</span>
          <input
            name="repository"
            required
            maxLength={255}
            pattern="[a-z0-9]+([/._-][a-z0-9]+)*"
            value={repositoryName}
            placeholder="service/api"
            onChange={(event) => setRepositoryName(event.currentTarget.value)}
          />
        </label>
        <label className="field">
          <span>{t("目标 Tag")}</span>
          <input
            name="tag"
            required
            maxLength={128}
            pattern="[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}"
            value={tag}
            onChange={(event) => setTag(event.currentTarget.value)}
          />
        </label>
      </div>
      <section className="push-command-preview">
        <header>
          <div>
            <strong>{t("命令序列")}</strong>
            <span>
              {t("使用")} {runtime} {t("登录、标记并推送")}
            </span>
          </div>
          <button
            className="button button-small"
            type="button"
            onClick={() => void copyValue(commands.join("\n"))}
          >
            <Icon name="copy" />
            <span>{t("复制全部")}</span>
          </button>
        </header>
        <div id="push-command-list">
          {commands.map((command, index) => (
            <div className="command-row" key={command}>
              <span className="command-step">{index + 1}</span>
              <code>{command}</code>
              <button
                className="icon-button"
                type="button"
                title={t("复制命令")}
                aria-label={t("复制命令")}
                onClick={() => void copyValue(command)}
              >
                <Icon name="copy" />
              </button>
            </div>
          ))}
        </div>
      </section>
      <div className="warning-banner">
        <Icon name="shield" />
        <span>
          {t("命令只在浏览器中生成，不会向 Harbor 发送本地镜像名称。")}
        </span>
      </div>
    </ControlDialog>
  );
}
