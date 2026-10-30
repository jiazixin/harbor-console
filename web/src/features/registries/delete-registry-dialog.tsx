import { UserInputError } from "../../app/errors";
import { useLocale } from "../../app/locale-context";
import type { Registry } from "../../app/models";
import { ControlDialog } from "../../components/control-dialog";
import { FormInput } from "../../components/form-input";
import { Icon } from "../../components/icon";
import uiStyles0 from "../../components/shared-ui.module.css";
import { createClassNames } from "../../lib/css/class-names";

import { useControlMutation } from "../../app/use-control-mutation";
import { affectedQueries, formString } from "./registry-dialogs-support";

type DeleteRegistryDialogProps = {
  registry: Registry;
  onClose: () => void;
  onDeleted: () => void;
};

export function DeleteRegistryDialog({
  registry,
  onClose,
  onDeleted,
}: DeleteRegistryDialogProps) {
  const mutate = useControlMutation(affectedQueries);
  const { locale, t } = useLocale();
  const name = registry.name ?? "";
  return (
    <ControlDialog
      title="删除远端仓库"
      subtitle={
        locale === "en-US"
          ? `Connection ${name} will be deleted. Replication policies referencing it may need to be updated first.`
          : `连接 ${name} 将被删除，引用它的复制策略可能需要先调整。`
      }
      submitLabel="删除连接"
      destructive
      onClose={onClose}
      onSubmit={async (formData) => {
        if (formString(formData, "confirmation") !== name)
          throw new UserInputError(t("输入内容与资源名称不一致"));
        await mutate({
          operation: "registry",
          parameters: { id: registry.id },
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
          placeholder={name}
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
