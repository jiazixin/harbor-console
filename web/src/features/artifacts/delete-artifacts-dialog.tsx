import { UserInputError } from "../../app/errors";
import { useLocale } from "../../app/locale-context";
import type { HarborArtifact } from "../../app/models";
import { useControlMutation } from "../../app/use-control-mutation";
import { ControlDialog } from "../../components/control-dialog";
import { FormInput } from "../../components/form-input";
import { Icon } from "../../components/icon";
import uiStyles0 from "../../components/shared-ui.module.css";
import { createClassNames } from "../../lib/css/class-names";
import {
  affectedQueries,
  formString,
  settledFailures,
} from "./artifact-dialogs-support";

type DeleteArtifactsDialogProps = {
  project: string;
  repository: string;
  artifacts: HarborArtifact[];
  onClose: () => void;
  onDeleted: (failures: number) => void;
};

export function DeleteArtifactsDialog({
  project,
  repository,
  artifacts,
  onClose,
  onDeleted,
}: DeleteArtifactsDialogProps) {
  const mutate = useControlMutation(affectedQueries);
  const { locale, t } = useLocale();
  const confirmation = `DELETE ${String(artifacts.length)}`;
  return (
    <ControlDialog
      title="批量删除制品"
      subtitle={
        locale === "en-US"
          ? `Permanently delete ${String(artifacts.length)} artifacts and all their tags`
          : `将永久删除 ${String(artifacts.length)} 个制品及其全部 Tag`
      }
      submitLabel="永久删除"
      destructive
      onClose={onClose}
      onSubmit={async (formData) => {
        if (formString(formData, "confirmation").trim() !== confirmation) {
          throw new UserInputError(
            locale === "en-US"
              ? `Enter ${confirmation} to confirm`
              : `请输入 ${confirmation} 确认`,
          );
        }
        const failures = await settledFailures(
          artifacts.map((artifact) =>
            mutate({
              operation: "artifact",
              parameters: { project, repository, reference: artifact.digest },
              method: "DELETE",
            }),
          ),
        );
        onDeleted(failures);
      }}
    >
      <div className={resolveClasses("notice notice-danger")}>
        <Icon name="alert" />
        <span>
          {t("此操作无法撤销。请输入")} <code>{confirmation}</code>{" "}
          {t("确认。")}
        </span>
      </div>
      <label className={resolveClasses("field")}>
        <span>{t("确认文本")}</span>
        <FormInput name="confirmation" required autoComplete="off" />
      </label>
    </ControlDialog>
  );
}

const resolveClasses = createClassNames({
  "control-dialog": uiStyles0.controlDialog,
  icon: uiStyles0.icon,
  notice: uiStyles0.notice,
  "notice-danger": uiStyles0.noticeDanger,
  field: uiStyles0.field,
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
