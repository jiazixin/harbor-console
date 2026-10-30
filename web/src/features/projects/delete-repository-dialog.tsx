import { UserInputError } from "../../app/errors";
import { useLocale } from "../../app/locale-context";
import type { RepositorySummary } from "../../app/models";
import { ControlDialog } from "../../components/control-dialog";
import { FormInput } from "../../components/form-input";
import { Icon } from "../../components/icon";
import uiStyles0 from "../../components/shared-ui.module.css";
import { createClassNames } from "../../lib/css/class-names";

import { useControlMutation } from "../../app/use-control-mutation";
import { affectedQueries, formString } from "./repository-dialogs-support";

type DeleteRepositoryDialogProps = {
  project: string;
  repository: RepositorySummary;
  onClose: () => void;
  onDeleted: () => void;
};

export function DeleteRepositoryDialog({
  project,
  repository,
  onClose,
  onDeleted,
}: DeleteRepositoryDialogProps) {
  const mutate = useControlMutation(affectedQueries);
  const { locale, t } = useLocale();
  const confirmation = repository.name;
  return (
    <ControlDialog
      title="删除仓库"
      subtitle={
        locale === "en-US"
          ? `Repository ${repository.name} and all of its artifacts will be permanently deleted.`
          : `仓库 ${repository.name} 及其中全部制品将被永久删除。`
      }
      submitLabel="删除仓库"
      destructive
      onClose={onClose}
      onSubmit={async (formData) => {
        if (formString(formData, "confirmation").trim() !== confirmation) {
          throw new UserInputError(
            locale === "en-US"
              ? "Enter the full resource name before confirming"
              : "请输入完整资源名称后再确认",
          );
        }
        await mutate({
          operation: "repository",
          parameters: { project, repository: repository.name },
          method: "DELETE",
        });
        onDeleted();
      }}
    >
      <div className={resolveClasses("notice notice-danger")}>
        <Icon name="alert" />
        <span>{t("此操作无法撤销")}</span>
      </div>
      <label className={resolveClasses("field")}>
        <span>{t("输入资源名称确认")}</span>
        <FormInput
          name="confirmation"
          required
          autoComplete="off"
          placeholder={confirmation}
        />
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
