import { controlApi } from "../../app/api-client";
import { useLocale } from "../../app/locale-context";
import type { ScannerMetadata, ScannerRegistration } from "../../app/models";
import { ControlDialog } from "../../components/control-dialog";
import { Icon } from "../../components/icon";
import uiStyles0 from "../../components/shared-ui.module.css";
import { createClassNames } from "../../lib/css/class-names";
import { formatNumber } from "../../lib/format/formatters";

import { useLoadedQuery } from "../../app/use-loaded-query";
import { securityKeys } from "./security-keys";
import styles from "./security.module.css";

type ScannerMetadataContentProps = { metadata: ScannerMetadata };

function ScannerMetadataContent({ metadata }: ScannerMetadataContentProps) {
  const { locale, t } = useLocale();
  const scanner = metadata.scanner ?? {};
  const capabilities = metadata.capabilities ?? [];
  const properties = Object.entries(metadata.properties ?? {});
  const scannerDetails = [scanner.vendor, scanner.version]
    .filter((value): value is string => Boolean(value))
    .join(" · ");
  return (
    <div className={resolveClasses(styles.scannerMetadataLayout)}>
      <section className={resolveClasses(styles.scannerMetadataSummary)}>
        <div>
          <h3>{scanner.name ?? t("未知扫描器")}</h3>
          <p>{scannerDetails ? scannerDetails : "Harbor Scanner Adapter"}</p>
        </div>
        <span className={resolveClasses("badge badge-green")}>
          {t("官方元数据")}
        </span>
      </section>
      <section>
        <div className={resolveClasses("directory-result-head")}>
          <span>{t("扫描能力")}</span>
          <span>
            {locale === "en-US"
              ? `${formatNumber(capabilities.length, locale)} items`
              : `${formatNumber(capabilities.length, locale)} 项`}
          </span>
        </div>
        {capabilities.length ? (
          <div className={resolveClasses(styles.scannerCapabilityList)}>
            {capabilities.map((capability, index) => (
              <article
                key={`${capability.type ?? "unknown"}-${String(index)}`}
                className={resolveClasses(styles.scannerCapability)}
              >
                <header>
                  <strong>
                    {t(
                      (() => {
                        if (capability.type === "vulnerability") {
                          return "漏洞扫描";
                        }
                        if (capability.type === "sbom") {
                          return "SBOM 生成";
                        }
                        return "自定义能力";
                      })(),
                    )}
                  </strong>
                  <code>{capability.type ?? "unknown"}</code>
                </header>
                <dl>
                  <div>
                    <dt>{t("输入 MIME 类型")}</dt>
                    <dd>
                      {capability.consumes_mime_types?.length ? (
                        <span
                          className={resolveClasses(styles.scannerMimeList)}
                        >
                          {capability.consumes_mime_types.map((value) => (
                            <code key={value}>{value}</code>
                          ))}
                        </span>
                      ) : (
                        <span className={resolveClasses("muted")}>
                          {t("未声明")}
                        </span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>{t("输出 MIME 类型")}</dt>
                    <dd>
                      {capability.produces_mime_types?.length ? (
                        <span
                          className={resolveClasses(styles.scannerMimeList)}
                        >
                          {capability.produces_mime_types.map((value) => (
                            <code key={value}>{value}</code>
                          ))}
                        </span>
                      ) : (
                        <span className={resolveClasses("muted")}>
                          {t("未声明")}
                        </span>
                      )}
                    </dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        ) : (
          <div className={resolveClasses("directory-state")}>
            <Icon name="info" />
            <div>
              <strong>{t("未声明扫描能力")}</strong>
              <span>{t("扫描器元数据没有返回 capabilities。")}</span>
            </div>
          </div>
        )}
      </section>
      <section>
        <div className={resolveClasses("directory-result-head")}>
          <span>{t("自定义属性")}</span>
          <span>
            {locale === "en-US"
              ? `${formatNumber(properties.length, locale)} items`
              : `${formatNumber(properties.length, locale)} 项`}
          </span>
        </div>
        {properties.length ? (
          <dl className={resolveClasses(styles.scannerPropertyList)}>
            {properties.map(([key, value]) => (
              <div key={key}>
                <dt className={resolveClasses("mono")}>{key}</dt>
                <dd className={resolveClasses("mono")}>{value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <div className={resolveClasses("directory-state compact")}>
            <Icon name="info" />
            <div>
              <strong>{t("没有自定义属性")}</strong>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

type ScannerMetadataDialogProps = {
  scanner: ScannerRegistration;
  onClose: () => void;
};

export function ScannerMetadataDialog({
  scanner,
  onClose,
}: ScannerMetadataDialogProps) {
  const { t } = useLocale();
  const metadataQuery = useScannerMetadataData({ scanner });
  const metadata = metadataQuery.data;
  const error = metadataQuery.error;
  return (
    <ControlDialog
      title="扫描器元数据"
      subtitle={scanner.name ?? scanner.uuid}
      submitLabel="关闭"
      showCancel={false}
      dialogClass={resolveClasses("control-dialog-large")}
      initialFocusSelector={null}
      onClose={onClose}
      onSubmit={() => {
        onClose();
        return Promise.resolve();
      }}
    >
      {!metadata && !error ? (
        <div className={resolveClasses("dialog-loading")}>
          <span className={resolveClasses("spinner")} />
          <span>{t("正在读取扫描器元数据...")}</span>
        </div>
      ) : null}
      {error ? (
        <div
          className={resolveClasses("directory-state directory-state-error")}
        >
          <Icon name="alert" />
          <div>
            <strong>{t("扫描器元数据载入失败")}</strong>
            <span>{error}</span>
          </div>
        </div>
      ) : null}
      {metadata ? <ScannerMetadataContent metadata={metadata} /> : null}
    </ControlDialog>
  );
}

const resolveClasses = createClassNames({
  "control-dialog": uiStyles0.controlDialog,
  icon: uiStyles0.icon,
  badge: uiStyles0.badge,
  "badge-green": uiStyles0.badgeGreen,
  "directory-result-head": uiStyles0.directoryResultHead,
  muted: uiStyles0.muted,
  "directory-state": uiStyles0.directoryState,
  mono: uiStyles0.mono,
  compact: uiStyles0.compact,
  "control-dialog-large": uiStyles0.controlDialogLarge,
  "dialog-loading": uiStyles0.dialogLoading,
  spinner: uiStyles0.spinner,
  "directory-state-error": uiStyles0.directoryStateError,
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

function useScannerMetadataData({ scanner }: { scanner: ScannerRegistration }) {
  return useLoadedQuery(securityKeys.scannerMetadata(scanner.uuid), (signal) =>
    controlApi
      .data<ScannerMetadata>("scanner-metadata", { id: scanner.uuid }, signal)
      .then((value) => value ?? {}),
  );
}
