import { useState } from "react";

import { controlApi } from "../../app/api-client";
import { useLocale } from "../../app/locale-context";
import {
  createRobotAccount,
  type RobotMutationPayload,
  robotUpdatePayload,
} from "../../app/robot-operations";
import type {
  ControlDataResponse,
  HarborPermission,
  ProjectRobot,
  RobotCredential,
} from "../../app/models";
import { ControlDialog } from "../../components/control-dialog";
import { Icon } from "../../components/icons";
import {
  RobotPermissionMatrix,
  robotAccessFromKeys,
  robotPermissionKey,
  validateRobotAccess,
} from "../../components/robot-permission-matrix";

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

export function ProjectRobotDialog({
  project,
  robot,
  permissionCandidates,
  onClose,
  onCreated,
  onUpdated,
}: {
  project: string;
  robot?: ProjectRobot;
  permissionCandidates: HarborPermission[];
  onClose: () => void;
  onCreated: (credential: RobotCredential) => void;
  onUpdated: () => void;
}) {
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
      dialogClass="control-dialog-wide"
      onClose={onClose}
      onSubmit={async () => {
        const trimmedName = name.trim();
        if (!robot && trimmedName.length > availableNameLength) {
          throw new Error(
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
          await controlApi.mutate(
            "robot",
            { id: robot.id },
            "PUT",
            robotUpdatePayload(payload),
          );
          onUpdated();
          return;
        }
        const credential = await createRobotAccount(payload, {
          missingId: t("Harbor 未返回机器人编号，无法停用新账号"),
          missingSecret: t("Harbor 未返回机器人密钥"),
        });
        onCreated(credential);
      }}
    >
      <div className="form-grid two-columns">
        <label className="field">
          <span>{t("账号名称")}</span>
          <input
            name="name"
            aria-label={t("账号名称")}
            required
            maxLength={Math.max(1, availableNameLength)}
            value={name}
            disabled={Boolean(robot) || nameUnavailable}
            autoComplete="off"
            placeholder={t("例如 ci-release")}
            onChange={(event) => setName(event.currentTarget.value)}
          />
          {!robot ? (
            <small className="field-help">
              {nameUnavailable
                ? t("项目名称过长，Harbor 无法创建项目机器人账号。")
                : t(
                    "Harbor 会把项目名称加入机器人账号；当前最多可输入 {count} 个字符。",
                  ).replace("{count}", String(availableNameLength))}
            </small>
          ) : null}
        </label>
        <div className="robot-duration-control">
          <label className="field">
            <span>{t("有效期（天）")}</span>
            <input
              name="duration"
              type="number"
              min={1}
              required={!forever}
              disabled={forever}
              value={duration}
              onChange={(event) =>
                setDuration(Math.max(1, Number(event.currentTarget.value) || 1))
              }
            />
          </label>
          <label className="robot-duration-forever">
            <input
              name="duration_forever"
              type="checkbox"
              checked={forever}
              onChange={(event) => setForever(event.currentTarget.checked)}
            />
            <span>{t("永不过期")}</span>
          </label>
          <small className="field-help">
            {t("勾选后自动向 Harbor 提交 -1；0 不是有效值。")}
          </small>
        </div>
        <label className="field field-span">
          <span>{t("描述")}</span>
          <input
            name="description"
            maxLength={1024}
            value={description}
            onChange={(event) => setDescription(event.currentTarget.value)}
          />
        </label>
        <label className="check-row field-span">
          <input
            name="disable"
            type="checkbox"
            checked={disabled}
            onChange={(event) => setDisabled(event.currentTarget.checked)}
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

export function ResetRobotSecretDialog({
  robot,
  onClose,
  onReset,
}: {
  robot: ProjectRobot;
  onClose: () => void;
  onReset: (credential: RobotCredential) => void;
}) {
  const { t } = useLocale();
  return (
    <ControlDialog
      title="重置机器人密钥"
      subtitle="旧密钥将立即失效"
      submitLabel="重置密钥"
      destructive
      onClose={onClose}
      onSubmit={async () => {
        const response = await controlApi.mutate<
          ControlDataResponse<Pick<RobotCredential, "secret">>
        >("robot", { id: robot.id }, "PATCH", { secret: "" });
        const secret = response.data?.secret;
        if (!secret) throw new Error(t("Harbor 未返回机器人密钥"));
        onReset({ name: robot.name, secret });
      }}
    >
      <div className="notice notice-danger">
        <Icon name="alert" />
        <span>{t("使用旧密钥的流水线需要同步更新")}</span>
      </div>
    </ControlDialog>
  );
}

export function DeleteProjectRobotDialog({
  project,
  robot,
  onClose,
  onDeleted,
}: {
  project: string;
  robot: ProjectRobot;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { locale, t } = useLocale();
  const subtitle =
    locale === "en-US"
      ? `Account ${robot.name} will immediately lose access to project ${project}.`
      : `账号 ${robot.name} 将立即失去项目访问权限。`;
  return (
    <ControlDialog
      title="删除机器人账号"
      subtitle={subtitle}
      submitLabel="删除账号"
      destructive
      onClose={onClose}
      onSubmit={async () => {
        await controlApi.mutate("robot", { id: robot.id }, "DELETE");
        onDeleted();
      }}
    >
      <div className="notice notice-danger">
        <Icon name="alert" />
        <span>{t("此操作无法撤销")}</span>
      </div>
    </ControlDialog>
  );
}
