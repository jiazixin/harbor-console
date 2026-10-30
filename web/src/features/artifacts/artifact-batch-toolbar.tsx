import { UserInputError } from "../../app/errors";
import { useLocale } from "../../app/locale-context";
import type { HarborArtifact, ProjectLabel } from "../../app/models";
import { Icon } from "../../components/icon";
import uiStyles0 from "../../components/shared-ui.module.css";
import { createClassNames } from "../../lib/css/class-names";
import { formatNumber } from "../../lib/format/formatters";
import { artifactScanState, isStoppableScanStatus } from "./artifact-utils";
import { type RepositoryArtifactAction } from "./repository-artifacts-data";

import { useControlMutation } from "../../app/use-control-mutation";
import { projectKeys } from "../projects/public";
import { repositoryKeys } from "../repositories/public";
import { artifactKeys } from "./artifact-keys";
import { type ArtifactBatchWorker } from "./repository-artifact-toolbars-support";

// Queries that a write in this module can change.
const affectedQueries = [artifactKeys.all, repositoryKeys.all, projectKeys.all];

type ScanType = "sbom" | "vulnerability";

type ArtifactBatchToolbarProps = {
  project: string;
  repository: string;
  selectedArtifacts: HarborArtifact[];
  labels: ProjectLabel[];
  busy: boolean;
  onRunBatch: (title: string, worker: ArtifactBatchWorker) => void;
  onArtifactAction: (action: RepositoryArtifactAction) => void;
};

export function ArtifactBatchToolbar({
  project,
  repository,
  selectedArtifacts,
  labels,
  busy,
  onRunBatch,
  onArtifactAction,
}: ArtifactBatchToolbarProps) {
  const mutate = useControlMutation(affectedQueries);
  const { locale, t } = useLocale();
  const batchDisabled = !selectedArtifacts.length || busy;
  const artifactReference = (artifact: HarborArtifact) => ({
    project,
    repository,
    reference: artifact.digest,
  });
  const startScan = (scanType: ScanType) => (artifact: HarborArtifact) =>
    mutate({
      operation: "artifact-scan",
      parameters: artifactReference(artifact),
      method: "POST",
      payload: {
        scan_type: scanType,
      },
    });
  const stopScans = async (artifact: HarborArtifact) => {
    const runningTypes = (["vulnerability", "sbom"] as const).filter(
      (scanType) =>
        isStoppableScanStatus(artifactScanState(artifact, scanType).status),
    );
    if (!runningTypes.length) {
      throw new UserInputError("该制品没有可停止的扫描或 SBOM 任务");
    }
    await Promise.all(
      runningTypes.map((scanType) =>
        mutate({
          operation: "artifact-scan-stop",
          parameters: artifactReference(artifact),
          method: "POST",
          payload: {
            scan_type: scanType,
          },
        }),
      ),
    );
  };
  const labelsOnSelection = Array.from(
    new Map(
      selectedArtifacts
        .flatMap((artifact) => artifact.labels ?? [])
        .map((label) => [label.id, label]),
    ).values(),
  );

  return (
    <div className={resolveClasses("artifact-batch-toolbar")}>
      <span>
        <strong>{formatNumber(selectedArtifacts.length, locale)}</strong>{" "}
        {t("个已选择")}
      </span>
      <div>
        <button
          className={resolveClasses("button button-small")}
          type="button"
          disabled={batchDisabled}
          onClick={() => {
            onRunBatch("漏洞扫描", startScan("vulnerability"));
          }}
        >
          <Icon name="shield" />
          <span>{t("扫描")}</span>
        </button>
        <button
          className={resolveClasses("button button-small")}
          type="button"
          disabled={batchDisabled}
          onClick={() => {
            onRunBatch("SBOM 生成", startScan("sbom"));
          }}
        >
          <Icon name="database" />
          <span>{t("生成 SBOM")}</span>
        </button>
        <button
          className={resolveClasses("button button-small")}
          type="button"
          disabled={batchDisabled}
          onClick={() => {
            onRunBatch("停止扫描任务", stopScans);
          }}
        >
          <Icon name="x" />
          <span>{t("停止任务")}</span>
        </button>
        <button
          className={resolveClasses("button button-small")}
          type="button"
          disabled={batchDisabled}
          onClick={() => {
            onArtifactAction({
              kind: "attach-label",
              project,
              repository,
              artifacts: selectedArtifacts,
              labels,
            });
          }}
        >
          <Icon name="tag" />
          <span>{t("添加标签")}</span>
        </button>
        <button
          className={resolveClasses("button button-small")}
          type="button"
          disabled={batchDisabled}
          onClick={() => {
            onArtifactAction({
              kind: "remove-label",
              project,
              repository,
              artifacts: selectedArtifacts,
              labels: labelsOnSelection,
            });
          }}
        >
          <Icon name="x" />
          <span>{t("移除标签")}</span>
        </button>
        <button
          className={resolveClasses("button button-small")}
          type="button"
          disabled={selectedArtifacts.length !== 1 || busy}
          onClick={() => {
            const artifact = selectedArtifacts.at(0);
            if (artifact) {
              onArtifactAction({ kind: "copy", project, repository, artifact });
            }
          }}
        >
          <Icon name="copy" />
          <span>{t("复制制品")}</span>
        </button>
        <button
          className={resolveClasses("button button-small button-danger")}
          type="button"
          disabled={batchDisabled}
          onClick={() => {
            onArtifactAction({
              kind: "delete",
              project,
              repository,
              artifacts: selectedArtifacts,
            });
          }}
        >
          <Icon name="trash" />
          <span>{t("删除")}</span>
        </button>
      </div>
    </div>
  );
}

const resolveClasses = createClassNames({
  icon: uiStyles0.icon,
  "artifact-batch-toolbar": uiStyles0.artifactBatchToolbar,
  button: uiStyles0.button,
  "button-small": uiStyles0.buttonSmall,
  tag: uiStyles0.tag,
  "button-danger": uiStyles0.buttonDanger,
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
