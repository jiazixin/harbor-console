import type { HarborArtifact } from "../../app/models";

export type ArtifactBatchWorker = (
  artifact: HarborArtifact,
) => Promise<unknown>;
