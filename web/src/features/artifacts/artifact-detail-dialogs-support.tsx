import { UserInputError } from "../../app/errors";
import { useLocale } from "../../app/locale-context";
import type { HarborArtifact } from "../../app/models";
import { ControlDialog } from "../../components/control-dialog";
import { FormInput } from "../../components/form-input";
import { Icon } from "../../components/icon";
import uiStyles0 from "../../components/shared-ui.module.css";
import { createClassNames } from "../../lib/css/class-names";
import { artifactKeys } from "./artifact-keys";

import { projectKeys } from "../projects/public";
import { repositoryKeys } from "../repositories/public";

export const affectedQueries = [
  artifactKeys.all,
  repositoryKeys.all,
  projectKeys.all,
];

export type ArtifactDialogContext = {
  project: string;
  repository: string;
  artifact: HarborArtifact;
};

export function formString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function confirmationError(locale: "en-US" | "zh-CN"): Error {
  return new UserInputError(
    locale === "en-US"
      ? "The entered value does not match the resource name"
      : "输入内容与资源名称不一致",
  );
}

type DestructiveConfirmationProps = {
  title: string;
  subtitle: string;
  submitLabel: string;
  confirmation?: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
};

export function DestructiveConfirmation({
  title,
  subtitle,
  submitLabel,
  confirmation,
  onClose,
  onConfirm,
}: DestructiveConfirmationProps) {
  const { locale, t } = useLocale();
  return (
    <ControlDialog
      title={title}
      subtitle={subtitle}
      submitLabel={submitLabel}
      destructive
      onClose={onClose}
      onSubmit={async (formData) => {
        if (
          confirmation &&
          formString(formData, "confirmation") !== confirmation
        ) {
          throw confirmationError(locale);
        }
        await onConfirm();
      }}
    >
      <div className={resolveClasses("notice notice-danger")}>
        <Icon name="alert" />
        <span>{t("此操作无法撤销")}</span>
      </div>
      {confirmation ? (
        <label className={resolveClasses("field")}>
          <span>{t("输入资源名称确认")}</span>
          <FormInput
            name="confirmation"
            required
            autoComplete="off"
            placeholder={confirmation}
          />
        </label>
      ) : null}
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
