import { UserInputError } from "../../app/errors";
import { useLocale } from "../../app/locale-context";
import type { ScannerRegistration } from "../../app/models";
import { ControlDialog } from "../../components/control-dialog";
import { FormInput } from "../../components/form-input";
import { Icon } from "../../components/icon";
import uiStyles0 from "../../components/shared-ui.module.css";
import { createClassNames } from "../../lib/css/class-names";

import { useControlMutation } from "../../app/use-control-mutation";
import { affectedQueries, formString } from "./security-dialogs-support";

type DeleteScannerDialogProps = {
  scanner: ScannerRegistration;
  onClose: () => void;
  onDeleted: () => void;
};

export function DeleteScannerDialog({
  scanner,
  onClose,
  onDeleted,
}: DeleteScannerDialogProps) {
  const mutate = useControlMutation(affectedQueries);
  const { locale, t } = useLocale();
  return (
    <ControlDialog
      title="删除扫描器"
      subtitle={
        locale === "en-US"
          ? `Scanner ${scanner.name ?? scanner.uuid} will be unregistered from Harbor.`
          : `扫描器 ${scanner.name ?? scanner.uuid} 将从 Harbor 中注销。`
      }
      submitLabel="删除扫描器"
      destructive
      onClose={onClose}
      onSubmit={async (formData) => {
        if (formString(formData, "confirmation") !== (scanner.name ?? ""))
          throw new UserInputError(t("输入内容与资源名称不一致"));
        await mutate({
          operation: "scanner",
          parameters: { id: scanner.uuid },
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
          placeholder={scanner.name}
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
