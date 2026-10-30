import { useState } from "react";
import { useLocale } from "../../app/locale-context";
import type { ProjectMember } from "../../app/models";
import { ControlDialog } from "../../components/control-dialog";
import uiStyles0 from "../../components/shared-ui.module.css";
import { UnifiedSelect } from "../../components/unified-select";
import { createClassNames } from "../../lib/css/class-names";

import { useControlMutation } from "../../app/use-control-mutation";
import {
  affectedQueries,
  formString,
  projectRoles,
} from "./project-member-dialogs-support";

type EditProjectMemberDialogProps = {
  project: string;
  member: ProjectMember;
  onClose: () => void;
  onUpdated: () => void;
};

export function EditProjectMemberDialog({
  project,
  member,
  onClose,
  onUpdated,
}: EditProjectMemberDialogProps) {
  const mutate = useControlMutation(affectedQueries);
  const { t } = useLocale();
  const [roleId, setRoleId] = useState(String(member.role_id ?? 2));
  return (
    <ControlDialog
      title="修改成员角色"
      subtitle={member.entity_name}
      submitLabel="保存角色"
      onClose={onClose}
      onSubmit={async (formData) => {
        await mutate({
          operation: "project-member",
          parameters: { project, member: member.id },
          method: "PUT",
          payload: {
            role_id: Number(formString(formData, "role_id")),
          },
        });
        onUpdated();
      }}
    >
      <label className={resolveClasses("field")}>
        <span>{t("项目角色")}</span>
        <UnifiedSelect
          name="role_id"
          ariaLabel={t("项目角色")}
          value={roleId}
          options={projectRoles.map((role) => ({
            value: role.value,
            label: t(role.label),
          }))}
          onChange={setRoleId}
        />
      </label>
    </ControlDialog>
  );
}

const resolveClasses = createClassNames({
  "control-dialog": uiStyles0.controlDialog,
  "unified-select": uiStyles0.unifiedSelect,
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
