import { useLocale } from "../../app/locale-context";
import { ControlDialog } from "../../components/control-dialog";
import { Icon } from "../../components/icon";
import uiStyles0 from "../../components/shared-ui.module.css";
import { createClassNames } from "../../lib/css/class-names";

import { useControlMutation } from "../../app/use-control-mutation";
import {
  type ArtifactDialogContext,
  affectedQueries,
} from "./artifact-detail-dialogs-support";

export function StopArtifactScanDialog({
  project,
  repository,
  artifact,
  scanType,
  onClose,
  onStopped,
}: ArtifactDialogContext & {
  scanType: "sbom" | "vulnerability";
  onClose: () => void;
  onStopped: () => void;
}) {
  const mutate = useControlMutation(affectedQueries);
  const { t } = useLocale();
  return (
    <ControlDialog
      title={scanType === "sbom" ? "停止 SBOM 生成" : "停止漏洞扫描"}
      subtitle="Harbor 将请求扫描器停止当前任务"
      submitLabel="停止任务"
      destructive
      onClose={onClose}
      onSubmit={async () => {
        await mutate({
          operation: "artifact-scan-stop",
          parameters: { project, repository, reference: artifact.digest },
          method: "POST",
          payload: { scan_type: scanType },
        });
        onStopped();
      }}
    >
      <div className={resolveClasses("notice notice-danger")}>
        <Icon name="alert" />
        <span>{t("已经生成的部分结果可能不会保留")}</span>
      </div>
    </ControlDialog>
  );
}

const resolveClasses = createClassNames({
  "control-dialog": uiStyles0.controlDialog,
  icon: uiStyles0.icon,
  notice: uiStyles0.notice,
  "notice-danger": uiStyles0.noticeDanger,
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
