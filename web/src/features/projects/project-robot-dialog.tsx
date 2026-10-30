import { useState } from "react";
import { UserInputError } from "../../app/errors";
import { useLocale } from "../../app/locale-context";
import type {
  HarborPermission,
  ProjectRobot,
  RobotCredential,
} from "../../app/models";
import {
  createRobotAccount,
  robotUpdatePayload,
  type RobotMutationPayload,
} from "../../app/robot-operations";
import { useControlMutation } from "../../app/use-control-mutation";
import { ControlDialog } from "../../components/control-dialog";
import { FormInput } from "../../components/form-input";
import {
  RobotPermissionMatrix,
  robotAccessFromKeys,
  robotPermissionKey,
  validateRobotAccess,
} from "../../components/robot-permission-matrix";
import uiStyles0 from "../../components/shared-ui.module.css";
import { createClassNames } from "../../lib/css/class-names";
import { affectedQueries } from "./project-robot-dialogs-support";

const defaultPermissionKeys = new Set([
  "repository|pull",
  "repository|read",
  "artifact|read",
  "artifact|list",
  "tag|list",
]);

const harborRobotNameLimit = 255;

function initialPermissionKeys(
  robot: ProjectRobot | undefined,
  candidates: HarborPermission[],
): Set<string> {
  if (robot) {
    return new Set(
      (robot.permissions ?? [])
        .filter(
          (permission) =>
            permission.kind === "project" && permission.namespace !== undefined,
        )
        .flatMap((permission) => permission.access ?? [])
        .map(robotPermissionKey),
    );
  }
  return new Set(
    candidates
      .map(robotPermissionKey)
      .filter((key) => defaultPermissionKeys.has(key)),
  );
}

function robotDisplayName(name: string): string {
  return name.split("+").slice(1).join("+") || name.replace(/^robot\$/, "");
}

type ProjectRobotDialogProps = {
  project: string;
  robot?: ProjectRobot;
  permissionCandidates: HarborPermission[];
  onClose: () => void;
  onCreated: (credential: RobotCredential) => void;
  onUpdated: () => void;
};

export function ProjectRobotDialog({
  project,
  robot,
  permissionCandidates,
  onClose,
  onCreated,
  onUpdated,
}: ProjectRobotDialogProps) {
  const mutate = useControlMutation(affectedQueries);
  const { t } = useLocale();
  const [name, setName] = useState(() =>
    robot ? robotDisplayName(robot.name) : "",
  );
  const [description, setDescription] = useState(robot?.description ?? "");
  const [duration, setDuration] = useState(() =>
    robot?.duration === -1 ? 90 : Math.max(1, robot?.duration ?? 90),
  );
  const [forever, setForever] = useState(robot?.duration === -1);
  const [disabled, setDisabled] = useState(robot?.disable === true);
  const [selected, setSelected] = useState(() =>
    initialPermissionKeys(robot, permissionCandidates),
  );
  const availableNameLength = Math.max(
    0,
    harborRobotNameLimit - project.length - 2,
  );
  const nameUnavailable = !robot && availableNameLength < 1;

  return (
    <ControlDialog
      title={robot ? "编辑机器人账号" : "新建机器人账号"}
      subtitle={project}
      submitLabel={robot ? "保存账号" : "创建账号"}
      submitDisabled={nameUnavailable}
      dialogClass={resolveClasses("control-dialog-wide")}
      onClose={onClose}
      onSubmit={async () => {
        const trimmedName = name.trim();
        if (!robot && trimmedName.length > availableNameLength) {
          throw new UserInputError(
            t("当前项目下机器人账号名称最多可输入 {count} 个字符").replace(
              "{count}",
              String(availableNameLength),
            ),
          );
        }
        const access = robotAccessFromKeys(selected);
        validateRobotAccess(access, t);
        const payload: RobotMutationPayload = {
          name: robot?.name ?? trimmedName,
          description: description.trim(),
          level: "project",
          duration: forever ? -1 : duration,
          disable: disabled,
          permissions: [{ kind: "project", namespace: project, access }],
        };
        if (robot) {
          await mutate({
            operation: "robot",
            parameters: { id: robot.id },
            method: "PUT",
            payload: robotUpdatePayload(payload),
          });
          onUpdated();
          return;
        }
        const credential = await createRobotAccount(
          payload,
          {
            missingId: t("Harbor 未返回机器人编号，无法停用新账号"),
            missingSecret: t("Harbor 未返回机器人密钥"),
          },
          mutate,
        );
        onCreated(credential);
      }}
    >
      <div className={resolveClasses("form-grid two-columns")}>
        <label className={resolveClasses("field")}>
          <span>{t("账号名称")}</span>
          <FormInput
            name="name"
            aria-label={t("账号名称")}
            required
            maxLength={Math.max(1, availableNameLength)}
            value={name}
            disabled={Boolean(robot) || nameUnavailable}
            autoComplete="off"
            placeholder={t("例如 ci-release")}
            onChange={(event) => {
              setName(event.currentTarget.value);
            }}
          />
          {!robot ? (
            <small className={resolveClasses("field-help")}>
              {nameUnavailable
                ? t("项目名称过长，Harbor 无法创建项目机器人账号。")
                : t(
                    "Harbor 会把项目名称加入机器人账号；当前最多可输入 {count} 个字符。",
                  ).replace("{count}", String(availableNameLength))}
            </small>
          ) : null}
        </label>
        <div className={resolveClasses("robot-duration-control")}>
          <label className={resolveClasses("field")}>
            <span>{t("有效期（天）")}</span>
            <FormInput
              name="duration"
              type="number"
              min={1}
              required={!forever}
              disabled={forever}
              value={duration}
              onChange={(event) => {
                setDuration(
                  Math.max(1, Number(event.currentTarget.value) || 1),
                );
              }}
            />
          </label>
          <label className={resolveClasses("robot-duration-forever")}>
            <FormInput
              name="duration_forever"
              type="checkbox"
              checked={forever}
              onChange={(event) => {
                setForever(event.currentTarget.checked);
              }}
            />
            <span>{t("永不过期")}</span>
          </label>
          <small className={resolveClasses("field-help")}>
            {t("勾选后自动向 Harbor 提交 -1；0 不是有效值。")}
          </small>
        </div>
        <label className={resolveClasses("field field-span")}>
          <span>{t("描述")}</span>
          <FormInput
            name="description"
            maxLength={1024}
            value={description}
            onChange={(event) => {
              setDescription(event.currentTarget.value);
            }}
          />
        </label>
        <label className={resolveClasses("check-row field-span")}>
          <FormInput
            name="disable"
            type="checkbox"
            checked={disabled}
            onChange={(event) => {
              setDisabled(event.currentTarget.checked);
            }}
          />
          <span>
            <strong>{t("停用账号")}</strong>
            <small>{t("保留配置但禁止认证")}</small>
          </span>
        </label>
      </div>
      <RobotPermissionMatrix
        candidates={permissionCandidates}
        selected={selected}
        legend="项目权限"
        onChange={setSelected}
      />
    </ControlDialog>
  );
}

const resolveClasses = createClassNames({
  "control-dialog": uiStyles0.controlDialog,
  tag: uiStyles0.tag,
  "control-dialog-wide": uiStyles0.controlDialogWide,
  "form-grid": uiStyles0.formGrid,
  "two-columns": uiStyles0.twoColumns,
  field: uiStyles0.field,
  "field-help": uiStyles0.fieldHelp,
  "robot-duration-control": uiStyles0.robotDurationControl,
  "robot-duration-forever": uiStyles0.robotDurationForever,
  "field-span": uiStyles0.fieldSpan,
  "check-row": uiStyles0.checkRow,
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
