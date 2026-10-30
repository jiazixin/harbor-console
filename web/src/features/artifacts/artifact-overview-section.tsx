import type { ReactNode } from "react";
import { useLocale } from "../../app/locale-context";
import type { HarborArtifact } from "../../app/models";
import { displayTimeZone, loadPreferences } from "../../app/preferences";
import { Icon } from "../../components/icon";
import uiStyles0 from "../../components/shared-ui.module.css";
import { createClassNames } from "../../lib/css/class-names";
import {
  formatBytes,
  formatDate,
  formatNumber,
  instanceHost,
} from "../../lib/format/formatters";
import {
  artifactArchitectureSummary,
  artifactPlatformLabel,
  artifactPlatforms,
  artifactPullCommand,
  artifactSignatureState,
  shortDigest,
} from "./artifact-utils";

import styles from "./artifacts.module.css";

type DefinitionRowProps = { label: string; value: ReactNode };

function DefinitionRow({ label, value }: DefinitionRowProps) {
  const { t } = useLocale();
  return (
    <div>
      <dt>{t(label)}</dt>
      <dd>{value}</dd>
    </div>
  );
}

type ArtifactOverviewSectionProps = {
  artifact: HarborArtifact;
  project: string;
  repository: string;
  instanceUrl: string;
  onCopy: (value: string) => void;
  onOpenChild: (digest: string) => void;
};

export function ArtifactOverviewSection({
  artifact,
  project,
  repository,
  instanceUrl,
  onCopy,
  onOpenChild,
}: ArtifactOverviewSectionProps) {
  const { locale, t } = useLocale();
  const runtime = loadPreferences().runtime;
  const tags = artifact.tags ?? [];
  const pulls = tags.length
    ? tags.map((tag) => ({
        label: tag.name,
        command: artifactPullCommand({
          instanceHost: instanceHost(instanceUrl),
          project,
          repository,
          artifact,
          tag: tag.name,
          runtime,
        }),
      }))
    : [
        {
          label: t("按摘要拉取"),
          command: artifactPullCommand({
            instanceHost: instanceHost(instanceUrl),
            project,
            repository,
            artifact,
            digest: artifact.digest,
            runtime,
          }),
        },
      ];
  const signature = artifactSignatureState(artifact);
  const signatureLabel = (() => {
    if (signature === "signed") {
      return "已签名";
    }
    if (signature === "unsigned") {
      return "未签名";
    }
    return "未知";
  })();
  const annotations = Object.entries(artifact.annotations ?? {});
  const platforms = artifactPlatforms(artifact);

  return (
    <>
      <div className={resolveClasses(styles.detailColumns)}>
        <section className={resolveClasses(`panel ${styles.commandPanel}`)}>
          <div className={resolveClasses("panel-head")}>
            <div>
              <h2>{t("拉取命令")}</h2>
              <p>
                {t("当前使用")} {runtime}
              </p>
            </div>
            <Icon name="terminal" />
          </div>
          {pulls.map((item) => (
            <div className={resolveClasses("command-row")} key={item.command}>
              <span className={resolveClasses("badge")} title={item.label}>
                {item.label}
              </span>
              <code>{item.command}</code>
              <button
                className={resolveClasses("icon-button")}
                type="button"
                title={t("复制拉取命令")}
                aria-label={t("复制拉取命令")}
                onClick={() => {
                  onCopy(item.command);
                }}
              >
                <Icon name="copy" />
              </button>
            </div>
          ))}
        </section>
        <section className={resolveClasses("panel")}>
          <div className={resolveClasses("panel-head")}>
            <div>
              <h2>{t("制品信息")}</h2>
              <p>{artifact.type ?? t("镜像")}</p>
            </div>
          </div>
          <dl className={resolveClasses("definition-list")}>
            <DefinitionRow
              label="媒体类型"
              value={artifact.manifest_media_type ?? artifact.media_type ?? "-"}
            />
            <DefinitionRow
              label="制品大小"
              value={formatBytes(artifact.size, locale)}
            />
            <DefinitionRow
              label="最近拉取"
              value={formatDate(artifact.pull_time, {
                locale: locale,
                timeZone: displayTimeZone(),
              })}
            />
            <DefinitionRow
              label="架构"
              value={artifactArchitectureSummary(artifact, locale)}
            />
            <DefinitionRow label="签名" value={t(signatureLabel)} />
          </dl>
        </section>
      </div>
      {annotations.length ? (
        <section
          className={resolveClasses(`panel ${styles.artifactAnnotationsPanel}`)}
        >
          <div className={resolveClasses("panel-head")}>
            <div>
              <h2>{t("注释")}</h2>
              <p>
                {formatNumber(annotations.length, locale)}{" "}
                {t("项 OCI annotations")}
              </p>
            </div>
          </div>
          <dl
            className={resolveClasses(
              `definition-list ${styles.artifactAnnotationsList}`,
            )}
          >
            {annotations.map(([key, value]) => (
              <div key={key}>
                <dt>
                  <code>{key}</code>
                </dt>
                <dd>
                  <code>{value}</code>
                  <button
                    className={resolveClasses("icon-button")}
                    type="button"
                    title={t("复制")}
                    aria-label={t("复制")}
                    onClick={() => {
                      onCopy(value);
                    }}
                  >
                    <Icon name="copy" />
                  </button>
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
      {platforms.length > 1 ? (
        <section
          className={resolveClasses(`panel ${styles.artifactPlatformPanel}`)}
        >
          <div className={resolveClasses("panel-head")}>
            <div>
              <h2>{t("平台与架构")}</h2>
              <p>
                {locale === "en-US"
                  ? `OCI image index returned by Harbor with ${formatNumber(platforms.length, locale)} child manifests`
                  : `Harbor 返回的 OCI 镜像索引，共 ${formatNumber(platforms.length, locale)} 个子清单`}
              </p>
            </div>
            <span className={resolveClasses("badge badge-blue")}>
              {t("多架构")}
            </span>
          </div>
          <div className={resolveClasses(styles.artifactPlatformList)}>
            {platforms.map((platform) => {
              const details: string[] = [];
              if (platform.osVersion)
                details.push(`${t("系统版本")} ${platform.osVersion}`);
              if (platform.osFeatures.length)
                details.push(
                  `${t("特性")} ${platform.osFeatures.join(locale === "en-US" ? ", " : "、")}`,
                );
              return (
                <div
                  className={resolveClasses(styles.artifactPlatformRow)}
                  key={platform.digest || artifactPlatformLabel(platform)}
                >
                  <div className={resolveClasses(styles.platformIdentity)}>
                    <span className={resolveClasses("cell-stack")}>
                      <strong className={resolveClasses("mono")}>
                        {artifactPlatformLabel(platform)}
                      </strong>
                      <small>{details.join(" · ") || t("OCI 子清单")}</small>
                    </span>
                  </div>
                  <code title={platform.digest}>
                    {platform.digest
                      ? shortDigest(platform.digest)
                      : t("暂无摘要")}
                  </code>
                  {platform.digest ? (
                    <div className={resolveClasses("row-actions")}>
                      <button
                        className={resolveClasses("icon-button")}
                        type="button"
                        title={t("打开子清单")}
                        aria-label={t("打开子清单")}
                        onClick={() => {
                          onOpenChild(platform.digest);
                        }}
                      >
                        <Icon name="external" />
                      </button>
                      <button
                        className={resolveClasses("icon-button")}
                        type="button"
                        title={t("复制子清单摘要")}
                        aria-label={t("复制子清单摘要")}
                        onClick={() => {
                          onCopy(platform.digest);
                        }}
                      >
                        <Icon name="copy" />
                      </button>
                    </div>
                  ) : (
                    <span
                      className={resolveClasses(
                        styles.platformActionPlaceholder,
                      )}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
    </>
  );
}

const resolveClasses = createClassNames({
  icon: uiStyles0.icon,
  panel: uiStyles0.panel,
  "panel-head": uiStyles0.panelHead,
  "command-row": uiStyles0.commandRow,
  badge: uiStyles0.badge,
  "icon-button": uiStyles0.iconButton,
  button: uiStyles0.button,
  "definition-list": uiStyles0.definitionList,
  "badge-blue": uiStyles0.badgeBlue,
  "cell-stack": uiStyles0.cellStack,
  mono: uiStyles0.mono,
  "row-actions": uiStyles0.rowActions,
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
