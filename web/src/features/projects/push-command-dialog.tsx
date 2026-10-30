import { useState } from "react";
import { useLocale } from "../../app/locale-context";
import type { Session } from "../../app/models";
import { loadPreferences } from "../../app/preferences";
import { ControlDialog } from "../../components/control-dialog";
import { FormInput } from "../../components/form-input";
import { Icon } from "../../components/icon";
import uiStyles0 from "../../components/shared-ui.module.css";
import { createClassNames } from "../../lib/css/class-names";
import commandStyles from "./push-command-dialog.module.css";

import styles from "./projects.module.css";
import { repositoryDisplayName } from "./repository-dialogs-support";

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

type PushCommandDialogProps = {
  project: string;
  repository?: string;
  session: Session;
  onClose: () => void;
  onCopied: (error?: boolean) => void;
};

export function PushCommandDialog({
  project,
  repository = "",
  session,
  onClose,
  onCopied,
}: PushCommandDialogProps) {
  const { t } = useLocale();
  const [localImage, setLocalImage] = useState("local-image:latest");
  const [repositoryName, setRepositoryName] = useState(() =>
    repositoryDisplayName(project, repository),
  );
  const [tag, setTag] = useState("latest");
  const host = registryHost(session.instance_url);
  const [runtime] = useState(() => loadPreferences().runtime);
  const commands = (() => {
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
  })();

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
      dialogClass={resolveClasses("control-dialog-wide")}
      onClose={onClose}
      onSubmit={onClose}
    >
      <div className={resolveClasses(`form-grid ${styles.pushCommandFields}`)}>
        <label className={resolveClasses("field")}>
          <span>{t("本地镜像")}</span>
          <FormInput
            name="local_image"
            required
            maxLength={512}
            pattern="[^\s]+"
            value={localImage}
            placeholder="local-image:latest"
            onChange={(event) => {
              setLocalImage(event.currentTarget.value);
            }}
          />
        </label>
        <label className={resolveClasses("field")}>
          <span>{t("目标仓库")}</span>
          <FormInput
            name="repository"
            required
            maxLength={255}
            pattern="[a-z0-9]+([\/._\-][a-z0-9]+)*"
            value={repositoryName}
            placeholder="service/api"
            onChange={(event) => {
              setRepositoryName(event.currentTarget.value);
            }}
          />
        </label>
        <label className={resolveClasses("field")}>
          <span>{t("目标 Tag")}</span>
          <FormInput
            name="tag"
            required
            maxLength={128}
            pattern="[A-Za-z0-9_][A-Za-z0-9_.\-]{0,127}"
            value={tag}
            onChange={(event) => {
              setTag(event.currentTarget.value);
            }}
          />
        </label>
      </div>
      <section className={resolveClasses(styles.pushCommandPreview)}>
        <header>
          <div>
            <strong>{t("命令序列")}</strong>
            <span>
              {t("使用")} {runtime} {t("登录、标记并推送")}
            </span>
          </div>
          <button
            className={resolveClasses("button button-small")}
            type="button"
            onClick={() => void copyValue(commands.join("\n"))}
          >
            <Icon name="copy" />
            <span>{t("复制全部")}</span>
          </button>
        </header>
        <div id="push-command-list" className={commandStyles.commandList}>
          {commands.map((command, index) => (
            <div className={resolveClasses("command-row")} key={command}>
              <span className={resolveClasses(styles.commandStep)}>
                {index + 1}
              </span>
              <code>{command}</code>
              <button
                className={resolveClasses("icon-button")}
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
      <div className={resolveClasses("notice notice-warning")}>
        <Icon name="shield" />
        <span>
          {t("命令只在浏览器中生成，不会向 Harbor 发送本地镜像名称。")}
        </span>
      </div>
    </ControlDialog>
  );
}

const resolveClasses = createClassNames({
  "control-dialog": uiStyles0.controlDialog,
  icon: uiStyles0.icon,
  tag: uiStyles0.tag,
  "control-dialog-wide": uiStyles0.controlDialogWide,
  "form-grid": uiStyles0.formGrid,
  field: uiStyles0.field,
  button: uiStyles0.button,
  "button-small": uiStyles0.buttonSmall,
  "command-row": uiStyles0.commandRow,
  "icon-button": uiStyles0.iconButton,
  notice: uiStyles0.notice,
  "notice-warning": uiStyles0.noticeWarning,
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
