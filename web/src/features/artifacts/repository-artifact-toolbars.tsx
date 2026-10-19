import { type FormEvent } from "react";

import { controlApi } from "../../app/api-client";
import { formatNumber } from "../../app/formatters";
import { useLocale } from "../../app/locale-context";
import type { HarborArtifact, ProjectLabel } from "../../app/models";
import { Icon } from "../../components/icons";
import { UnifiedSelect } from "../../components/unified-select";
import { useResettableState } from "../../components/use-resettable-state";
import { artifactScanState, isStoppableScanStatus } from "./artifact-utils";
import {
  artifactTypes,
  type RepositoryArtifactAction,
  type RepositoryRouteState,
} from "./repository-artifacts-data";

export type ArtifactFilters = Pick<
  RepositoryRouteState,
  "artifactType" | "labelId" | "query" | "scanStatus" | "tagState"
>;

const emptyArtifactFilters: ArtifactFilters = {
  query: "",
  artifactType: "",
  tagState: "",
  labelId: "",
  scanStatus: "",
};

function hasFilters(filters: ArtifactFilters): boolean {
  return Boolean(
    filters.query ||
    filters.artifactType ||
    filters.tagState ||
    filters.labelId ||
    filters.scanStatus,
  );
}

export function ArtifactFilterForm({
  filters,
  labels,
  onApply,
}: {
  filters: ArtifactFilters;
  labels: ProjectLabel[];
  onApply: (filters: ArtifactFilters) => void;
}) {
  const { t } = useLocale();
  const [query, setQuery] = useResettableState(filters.query);
  const [artifactType, setArtifactType] = useResettableState(
    filters.artifactType,
  );
  const [tagState, setTagState] = useResettableState(filters.tagState);
  const [labelId, setLabelId] = useResettableState(filters.labelId);
  const [scanStatus, setScanStatus] = useResettableState(filters.scanStatus);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedQuery = query.trim();
    onApply({
      query: trimmedQuery,
      artifactType,
      // Harbor matches a Tag search only against tagged artifacts.
      tagState: trimmedQuery ? "" : tagState,
      labelId,
      scanStatus,
    });
  }

  return (
    <form className="table-toolbar artifact-filter-toolbar" onSubmit={submit}>
      <label className="toolbar-search">
        <Icon name="search" />
        <input
          name="q"
          type="search"
          value={query}
          placeholder={t("按 Tag 搜索制品")}
          aria-label={t("按 Tag 搜索制品")}
          onChange={(event) => setQuery(event.currentTarget.value)}
        />
      </label>
      <label className="toolbar-field">
        <span>{t("类型")}</span>
        <UnifiedSelect
          ariaLabel={t("类型")}
          className="toolbar-select"
          value={artifactType}
          options={[
            { value: "", label: t("全部") },
            ...artifactTypes.map((value) => ({ value, label: value })),
          ]}
          onChange={setArtifactType}
        />
      </label>
      <label className="toolbar-field">
        <span>Tag</span>
        <UnifiedSelect
          ariaLabel="Tag"
          className="toolbar-select"
          disabled={Boolean(query)}
          value={tagState}
          options={[
            { value: "", label: t("全部") },
            { value: "tagged", label: t("有 Tag") },
            { value: "untagged", label: t("无 Tag") },
          ]}
          onChange={setTagState}
        />
      </label>
      <label className="toolbar-field">
        <span>{t("标签")}</span>
        <UnifiedSelect
          ariaLabel={t("标签")}
          className="toolbar-select"
          value={labelId}
          options={[
            { value: "", label: t("全部") },
            ...labels.map((label) => ({
              value: String(label.id),
              label: t(label.name),
            })),
          ]}
          onChange={setLabelId}
        />
      </label>
      <label className="toolbar-field">
        <span>{t("扫描")}</span>
        <UnifiedSelect
          ariaLabel={t("扫描")}
          className="toolbar-select"
          value={scanStatus}
          options={[
            { value: "", label: t("全部") },
            { value: "success", label: t("成功") },
            { value: "running", label: t("运行中") },
            { value: "error", label: t("失败") },
            { value: "stopped", label: t("已停止") },
            { value: "unscanned", label: t("未扫描") },
          ]}
          onChange={setScanStatus}
        />
      </label>
      <div className="filter-toolbar-actions">
        <button className="button button-small button-primary" type="submit">
          <Icon name="search" />
          <span>{t("筛选")}</span>
        </button>
        {hasFilters(filters) ? (
          <button
            className="button button-small"
            type="button"
            onClick={() => onApply(emptyArtifactFilters)}
          >
            <Icon name="x" />
            <span>{t("清除")}</span>
          </button>
        ) : null}
      </div>
    </form>
  );
}

type ScanType = "sbom" | "vulnerability";

export type ArtifactBatchWorker = (
  artifact: HarborArtifact,
) => Promise<unknown>;

export function ArtifactBatchToolbar({
  project,
  repository,
  selectedArtifacts,
  labels,
  busy,
  onRunBatch,
  onArtifactAction,
}: {
  project: string;
  repository: string;
  selectedArtifacts: HarborArtifact[];
  labels: ProjectLabel[];
  busy: boolean;
  onRunBatch: (title: string, worker: ArtifactBatchWorker) => void;
  onArtifactAction: (action: RepositoryArtifactAction) => void;
}) {
  const { locale, t } = useLocale();
  const batchDisabled = !selectedArtifacts.length || busy;
  const artifactReference = (artifact: HarborArtifact) => ({
    project,
    repository,
    reference: artifact.digest,
  });
  const startScan = (scanType: ScanType) => (artifact: HarborArtifact) =>
    controlApi.mutate("artifact-scan", artifactReference(artifact), "POST", {
      scan_type: scanType,
    });
  const stopScans = async (artifact: HarborArtifact) => {
    const runningTypes = (["vulnerability", "sbom"] as const).filter(
      (scanType) =>
        isStoppableScanStatus(artifactScanState(artifact, scanType).status),
    );
    if (!runningTypes.length) {
      throw new Error("该制品没有可停止的扫描或 SBOM 任务");
    }
    await Promise.all(
      runningTypes.map((scanType) =>
        controlApi.mutate(
          "artifact-scan-stop",
          artifactReference(artifact),
          "POST",
          { scan_type: scanType },
        ),
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
    <div className="artifact-batch-toolbar">
      <span>
        <strong>{formatNumber(selectedArtifacts.length, locale)}</strong>{" "}
        {t("个已选择")}
      </span>
      <div>
        <button
          className="button button-small"
          type="button"
          disabled={batchDisabled}
          onClick={() => onRunBatch("漏洞扫描", startScan("vulnerability"))}
        >
          <Icon name="shield" />
          <span>{t("扫描")}</span>
        </button>
        <button
          className="button button-small"
          type="button"
          disabled={batchDisabled}
          onClick={() => onRunBatch("SBOM 生成", startScan("sbom"))}
        >
          <Icon name="database" />
          <span>{t("生成 SBOM")}</span>
        </button>
        <button
          className="button button-small"
          type="button"
          disabled={batchDisabled}
          onClick={() => onRunBatch("停止扫描任务", stopScans)}
        >
          <Icon name="x" />
          <span>{t("停止任务")}</span>
        </button>
        <button
          className="button button-small"
          type="button"
          disabled={batchDisabled}
          onClick={() =>
            onArtifactAction({
              kind: "attach-label",
              project,
              repository,
              artifacts: selectedArtifacts,
              labels,
            })
          }
        >
          <Icon name="tag" />
          <span>{t("添加标签")}</span>
        </button>
        <button
          className="button button-small"
          type="button"
          disabled={batchDisabled}
          onClick={() =>
            onArtifactAction({
              kind: "remove-label",
              project,
              repository,
              artifacts: selectedArtifacts,
              labels: labelsOnSelection,
            })
          }
        >
          <Icon name="x" />
          <span>{t("移除标签")}</span>
        </button>
        <button
          className="button button-small"
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
          className="button button-small button-danger"
          type="button"
          disabled={batchDisabled}
          onClick={() =>
            onArtifactAction({
              kind: "delete",
              project,
              repository,
              artifacts: selectedArtifacts,
            })
          }
        >
          <Icon name="trash" />
          <span>{t("删除")}</span>
        </button>
      </div>
    </div>
  );
}
