import { useLocale } from "../../app/locale-context";
import { ControlDialog } from "../../components/control-dialog";
import { FormInput } from "../../components/form-input";
import { Icon } from "../../components/icon";
import uiStyles0 from "../../components/shared-ui.module.css";
import { createClassNames } from "../../lib/css/class-names";
import { repositoryDisplayName, shortDigest } from "./artifact-utils";

import { useControlMutation } from "../../app/use-control-mutation";
import {
  type ArtifactDialogContext,
  affectedQueries,
  formString,
} from "./artifact-detail-dialogs-support";
import styles from "./artifacts.module.css";

export function ArtifactScanDialog({
  project,
  repository,
  artifact,
  onClose,
  onSubmitted,
}: ArtifactDialogContext & {
  onClose: () => void;
  onSubmitted: (scanType: "sbom" | "vulnerability") => void;
}) {
  const mutate = useControlMutation(affectedQueries);
  const { t } = useLocale();
  return (
    <ControlDialog
      title="扫描制品"
      subtitle={`${repositoryDisplayName(project, repository)} · ${shortDigest(artifact.digest)}`}
      submitLabel="提交任务"
      onClose={onClose}
      onSubmit={async (formData) => {
        const scanType =
          formString(formData, "scan_type") === "sbom"
            ? "sbom"
            : "vulnerability";
        await mutate({
          operation: "artifact-scan",
          parameters: { project, repository, reference: artifact.digest },
          method: "POST",
          payload: { scan_type: scanType },
        });
        onSubmitted(scanType);
      }}
    >
      <div className={resolveClasses(styles.scanTypeOptions)}>
        <label className={resolveClasses(`check-row ${styles.scanTypeOption}`)}>
          <FormInput
            name="scan_type"
            type="radio"
            value="vulnerability"
            defaultChecked
          />
          <span>
            <strong>
              <Icon name="shield" />
              {t("漏洞扫描")}
            </strong>
            <small>{t("使用项目扫描器生成漏洞报告与风险等级")}</small>
          </span>
        </label>
        <label className={resolveClasses(`check-row ${styles.scanTypeOption}`)}>
          <FormInput name="scan_type" type="radio" value="sbom" />
          <span>
            <strong>
              <Icon name="database" />
              {t("生成 SBOM")}
            </strong>
            <small>{t("生成软件物料清单，完成后可在 SBOM 标签页查看")}</small>
          </span>
        </label>
      </div>
    </ControlDialog>
  );
}

const resolveClasses = createClassNames({
  "control-dialog": uiStyles0.controlDialog,
  icon: uiStyles0.icon,
  "check-row": uiStyles0.checkRow,
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
