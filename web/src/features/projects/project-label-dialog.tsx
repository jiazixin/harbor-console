import { useState } from "react";
import { useLocale } from "../../app/locale-context";
import type { ProjectLabel } from "../../app/models";
import { useControlMutation } from "../../app/use-control-mutation";
import { ControlDialog } from "../../components/control-dialog";
import { FormInput } from "../../components/form-input";
import { FormTextarea } from "../../components/form-textarea";
import uiStyles0 from "../../components/shared-ui.module.css";
import { createClassNames } from "../../lib/css/class-names";
import { affectedQueries } from "./project-rule-dialogs-support";

function safeLabelColor(value: string | undefined): string {
  return /^#[0-9a-f]{6}$/i.test(value ?? "") ? String(value) : "#f48120";
}

type ProjectLabelDialogProps = {
  project: string;
  projectId: number;
  label?: ProjectLabel;
  onClose: () => void;
  onSaved: () => void;
};

export function ProjectLabelDialog({
  project,
  projectId,
  label,
  onClose,
  onSaved,
}: ProjectLabelDialogProps) {
  const mutate = useControlMutation(affectedQueries);
  const { t } = useLocale();
  const [name, setName] = useState(label?.name ?? "");
  const [description, setDescription] = useState(label?.description ?? "");
  const [color, setColor] = useState(safeLabelColor(label?.color));
  return (
    <ControlDialog
      title={label ? "编辑项目标签" : "新建项目标签"}
      subtitle={project}
      submitLabel={label ? "保存标签" : "创建标签"}
      onClose={onClose}
      onSubmit={async () => {
        const payload = {
          name: name.trim(),
          description: description.trim(),
          color,
          scope: "p",
          project_id: projectId,
        };
        await mutate({
          operation: label ? "label" : "labels",
          parameters: label ? { id: label.id } : {},
          method: label ? "PUT" : "POST",
          payload: payload,
        });
        onSaved();
      }}
    >
      <div className={resolveClasses("form-grid")}>
        <label className={resolveClasses("field")}>
          <span>{t("标签名称")}</span>
          <FormInput
            name="name"
            required
            maxLength={128}
            value={name}
            onChange={(event) => {
              setName(event.currentTarget.value);
            }}
          />
        </label>
        <label className={resolveClasses("field")}>
          <span>{t("标签颜色")}</span>
          <FormInput
            name="color"
            type="color"
            value={color}
            onChange={(event) => {
              setColor(event.currentTarget.value);
            }}
          />
        </label>
        <label className={resolveClasses("field")}>
          <span>{t("描述")}</span>
          <FormTextarea
            name="description"
            rows={3}
            maxLength={1024}
            value={description}
            onChange={(event) => {
              setDescription(event.currentTarget.value);
            }}
          />
        </label>
      </div>
    </ControlDialog>
  );
}

const resolveClasses = createClassNames({
  "control-dialog": uiStyles0.controlDialog,
  "form-grid": uiStyles0.formGrid,
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
