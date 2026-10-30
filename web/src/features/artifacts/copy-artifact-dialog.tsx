import { useLocale } from "../../app/locale-context";
import type { HarborArtifact } from "../../app/models";
import { useControlMutation } from "../../app/use-control-mutation";
import { ControlDialog } from "../../components/control-dialog";
import { FormInput } from "../../components/form-input";
import uiStyles0 from "../../components/shared-ui.module.css";
import { createClassNames } from "../../lib/css/class-names";
import { affectedQueries, formString } from "./artifact-dialogs-support";
import { repositoryDisplayName, shortDigest } from "./artifact-utils";

function fullRepositoryName(project: string, repository: string): string {
  return repository.startsWith(`${project}/`)
    ? repository
    : `${project}/${repository}`;
}

type CopyArtifactDialogProps = {
  project: string;
  repository: string;
  artifact: HarborArtifact;
  onClose: () => void;
  onCopied: (project: string, repository: string) => void;
};

export function CopyArtifactDialog({
  project,
  repository,
  artifact,
  onClose,
  onCopied,
}: CopyArtifactDialogProps) {
  const mutate = useControlMutation(affectedQueries);
  const { t } = useLocale();
  const source = `${fullRepositoryName(project, repository)}@${artifact.digest}`;
  return (
    <ControlDialog
      title="复制制品"
      subtitle={artifact.tags?.[0]?.name ?? shortDigest(artifact.digest)}
      submitLabel="开始复制"
      onClose={onClose}
      onSubmit={async (formData) => {
        const targetProject = formString(formData, "project").trim();
        const targetRepository = formString(formData, "repository").trim();
        await mutate({
          operation: "artifact-copy",
          parameters: {
            project: targetProject,
            repository: targetRepository,
            from: source,
          },
          method: "POST",
        });
        onCopied(targetProject, targetRepository);
      }}
    >
      <div className={resolveClasses("form-grid two-columns")}>
        <label className={resolveClasses("field")}>
          <span>{t("目标项目")}</span>
          <FormInput
            name="project"
            required
            maxLength={255}
            pattern="[a-z0-9]+([._\-][a-z0-9]+)*"
            defaultValue={project}
          />
        </label>
        <label className={resolveClasses("field")}>
          <span>{t("目标仓库")}</span>
          <FormInput
            name="repository"
            required
            maxLength={255}
            pattern="[a-z0-9]+([\/._\-][a-z0-9]+)*"
            defaultValue={repositoryDisplayName(project, repository)}
          />
        </label>
        <label className={resolveClasses("field field-span")}>
          <span>{t("复制源")}</span>
          <FormInput
            className={resolveClasses("mono")}
            value={source}
            readOnly
          />
        </label>
      </div>
    </ControlDialog>
  );
}

const resolveClasses = createClassNames({
  "control-dialog": uiStyles0.controlDialog,
  "form-grid": uiStyles0.formGrid,
  "two-columns": uiStyles0.twoColumns,
  field: uiStyles0.field,
  "field-span": uiStyles0.fieldSpan,
  mono: uiStyles0.mono,
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
