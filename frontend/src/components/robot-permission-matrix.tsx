import { useMemo } from "react";

import { formatNumber } from "../app/formatters";
import { useLocale } from "../app/locale-context";
import type { HarborPermission, RobotAccess } from "../app/models";
import { Icon } from "./icons";

const resourceLabels: Record<string, string> = {
  repository: "镜像仓库",
  artifact: "制品",
  tag: "Tag",
  scan: "漏洞扫描",
  sbom: "SBOM",
  label: "标签",
  accessory: "附件",
  "artifact-addition": "制品附加信息",
  "artifact-label": "制品标签",
  "preheat-policy": "预热策略",
  "immutable-tag": "不可变 Tag",
  log: "日志",
  "notification-policy": "Webhook 策略",
  quota: "配额",
  robot: "机器人账号",
  member: "项目成员",
  metadata: "元数据",
  project: "项目",
  "audit-log": "审计日志",
  user: "用户",
  "user-group": "用户组",
  registry: "远端仓库",
  replication: "复制策略",
  "replication-policy": "复制策略",
  scanner: "扫描器",
};

const actionLabels: Record<string, string> = {
  pull: "拉取",
  push: "推送",
  create: "创建",
  read: "查看",
  update: "更新",
  delete: "删除",
  list: "列出",
  stop: "停止",
  operate: "操作",
  "scanner-pull": "扫描器拉取",
  "*": "全部操作",
};

export function robotPermissionKey(
  permission: HarborPermission | RobotAccess,
): string {
  return `${permission.resource ?? ""}|${permission.action ?? ""}`;
}

export function robotAccessFromKeys(keys: Set<string>): RobotAccess[] {
  return Array.from(keys)
    .map((key) => {
      const separator = key.indexOf("|");
      return {
        resource: key.slice(0, separator),
        action: key.slice(separator + 1),
        effect: "allow",
      };
    })
    .filter((access) => access.resource && access.action);
}

export function validateRobotAccess(
  access: RobotAccess[],
  translate: (value: string) => string,
  scopeLabel = "",
) {
  if (!access.length) {
    const message = scopeLabel
      ? `${scopeLabel}：${translate("请至少选择一项权限")}`
      : translate("请至少选择一项权限");
    throw new Error(message);
  }
  const hasPush = access.some(
    (item) => item.resource === "repository" && item.action === "push",
  );
  const hasPull = access.some(
    (item) => item.resource === "repository" && item.action === "pull",
  );
  if (hasPush && !hasPull) {
    throw new Error(translate("仓库推送权限必须同时包含仓库拉取权限"));
  }
}

export function RobotPermissionMatrix({
  candidates,
  selected,
  legend,
  compact = false,
  onChange,
}: {
  candidates: HarborPermission[];
  selected: Set<string>;
  legend: string;
  compact?: boolean;
  onChange: (selected: Set<string>) => void;
}) {
  const { locale, t } = useLocale();
  const groups = useMemo(() => {
    const result = new Map<string, string[]>();
    candidates.forEach((permission) => {
      if (!permission.resource || !permission.action) return;
      const actions = result.get(permission.resource) ?? [];
      actions.push(permission.action);
      result.set(permission.resource, actions);
    });
    return Array.from(result.entries());
  }, [candidates]);

  if (!groups.length) {
    return (
      <div className="warning-banner">
        <Icon name="alert" />
        <span>{t("Harbor 未返回可分配的权限元数据。")}</span>
      </div>
    );
  }

  return (
    <fieldset
      className={`permission-matrix${compact ? " permission-matrix-compact" : ""}`}
    >
      <legend>{t(legend)}</legend>
      <div className="permission-matrix-toolbar">
        <span>
          {formatNumber(candidates.length, locale)} {t("项官方权限")}
        </span>
        <button
          className="button button-small"
          type="button"
          onClick={() => {
            const all = candidates.map(robotPermissionKey).filter(Boolean);
            onChange(
              all.every((key) => selected.has(key)) ? new Set() : new Set(all),
            );
          }}
        >
          {t("全选 / 清空")}
        </button>
      </div>
      <div className="permission-resource-list">
        {groups.map(([resource, actions]) => (
          <section className="permission-resource" key={resource}>
            <header>
              <strong>{t(resourceLabels[resource] ?? resource)}</strong>
              <code>{resource}</code>
            </header>
            <div>
              {actions.toSorted().map((action) => {
                const key = `${resource}|${action}`;
                return (
                  <label key={key}>
                    <input
                      type="checkbox"
                      checked={selected.has(key)}
                      onChange={(event) => {
                        const next = new Set(selected);
                        if (event.currentTarget.checked) {
                          next.add(key);
                          if (key === "repository|push") {
                            next.add("repository|pull");
                          }
                        } else {
                          next.delete(key);
                        }
                        onChange(next);
                      }}
                    />
                    <span>{t(actionLabels[action] ?? action)}</span>
                  </label>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </fieldset>
  );
}
