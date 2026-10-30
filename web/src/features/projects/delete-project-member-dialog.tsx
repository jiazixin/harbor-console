import { useLocale } from "../../app/locale-context";
import type { ProjectMember } from "../../app/models";
import { ControlDialog } from "../../components/control-dialog";
import { Icon } from "../../components/icon";
import uiStyles0 from "../../components/shared-ui.module.css";
import { createClassNames } from "../../lib/css/class-names";

import { useControlMutation } from "../../app/use-control-mutation";
import { affectedQueries } from "./project-member-dialogs-support";

type DeleteProjectMemberDialogProps = {
  project: string;
  member: ProjectMember;
  onClose: () => void;
  onDeleted: () => void;
};

export function DeleteProjectMemberDialog({
  project,
  member,
  onClose,
  onDeleted,
}: DeleteProjectMemberDialogProps) {
  const mutate = useControlMutation(affectedQueries);
  const { locale, t } = useLocale();
  const subtitle =
    locale === "en-US"
      ? `Remove ${member.entity_name} from project ${project}.`
      : `将从项目 ${project} 中移除 ${member.entity_name}。`;
  return (
    <ControlDialog
      title="删除项目成员"
      subtitle={subtitle}
      submitLabel="删除成员"
      destructive
      onClose={onClose}
      onSubmit={async () => {
        await mutate({
          operation: "project-member",
          parameters: { project, member: member.id },
          method: "DELETE",
        });
        onDeleted();
      }}
    >
      <div className={resolveClasses("notice notice-danger")}>
        <Icon name="alert" />
        <span>{t("此操作无法撤销")}</span>
      </div>
    </ControlDialog>
  );
}

const resolveClasses = createClassNames({
  "control-dialog": uiStyles0.controlDialog,
  icon: uiStyles0.icon,
  notice: uiStyles0.notice,
  "notice-danger": uiStyles0.noticeDanger,
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
