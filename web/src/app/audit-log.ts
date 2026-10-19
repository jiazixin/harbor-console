import type { AuditLog, Locale } from "./models";

type Translate = (source: string) => string;

const exactTranslations: Record<string, string> = {
  create: "创建",
  delete: "删除",
  pull: "拉取",
  push: "推送",
  scan: "扫描",
  update: "更新",
  "create replication policy": "创建复制策略",
  "pull artifact": "拉取制品",
  "pull artifact from remote registry": "从远端仓库拉取制品",
  "push artifact": "推送制品",
  "push artifact manifest": "推送制品清单",
  "push artifact manifest and blobs": "推送制品清单与镜像层",
  "trigger vulnerability scan": "触发漏洞扫描",
};

const tokenTranslations: Record<string, string> = {
  add: "添加",
  all: "全部",
  artifact: "制品",
  artifacts: "制品",
  audit: "审计",
  blob: "镜像层",
  blobs: "镜像层",
  collection: "清理",
  configuration: "配置",
  configurations: "配置",
  copy: "复制",
  create: "创建",
  created: "创建",
  delete: "删除",
  deleted: "删除",
  disable: "停用",
  disabled: "停用",
  enable: "启用",
  enabled: "启用",
  execute: "执行",
  garbage: "垃圾",
  get: "查看",
  global: "全局",
  group: "用户组",
  groups: "用户组",
  immutable: "不可变",
  label: "标签",
  labels: "标签",
  list: "列出",
  log: "日志",
  logs: "日志",
  login: "登录",
  logout: "退出登录",
  manifest: "清单",
  member: "成员",
  members: "成员",
  permission: "权限",
  permissions: "权限",
  policy: "策略",
  policies: "策略",
  project: "项目",
  projects: "项目",
  pull: "拉取",
  pulled: "拉取",
  push: "推送",
  pushed: "推送",
  quota: "配额",
  quotas: "配额",
  read: "查看",
  refresh: "刷新",
  registry: "远端仓库",
  registries: "远端仓库",
  remove: "移除",
  replication: "复制",
  repository: "镜像仓库",
  repositories: "镜像仓库",
  reset: "重置",
  retention: "Tag 保留",
  robot: "机器人账号",
  robots: "机器人账号",
  run: "运行",
  sbom: "软件物料清单",
  scan: "扫描",
  scanned: "扫描",
  scanner: "扫描器",
  scanners: "扫描器",
  start: "启动",
  stop: "停止",
  stopped: "停止",
  system: "系统",
  tag: "Tag",
  tags: "Tag",
  trigger: "触发",
  update: "更新",
  updated: "更新",
  user: "用户",
  users: "用户",
  vulnerability: "漏洞",
  vulnerabilities: "漏洞",
  webhook: "Webhook",
  webhooks: "Webhook",
};

const eastAsianText =
  /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af\uf900-\ufaff]/;

export function formatAuditDate(
  value: string | undefined,
  locale: Locale,
): string {
  if (!value) return locale === "en-US" ? "N/A" : "暂无";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

export function auditResourceTypeLabel(
  value: string | undefined,
  translate: Translate,
): string {
  const label =
    {
      artifact: "制品",
      configuration: "系统配置",
      image: "镜像",
      member: "项目成员",
      project: "项目",
      registry: "远端仓库",
      replication: "复制任务",
      repository: "仓库",
      robot: "机器人账号",
      tag: "Tag",
      user: "用户",
    }[value?.toLowerCase() ?? ""] ?? value;
  return label ? translate(label) : translate("其他");
}

function translateAuditText(value: string | undefined): string {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (!normalized) return "";
  if (exactTranslations[normalized]) return exactTranslations[normalized];
  const tokens = normalized.split(/[\s_-]+/).filter(Boolean);
  if (!tokens.length || tokens.some((token) => !tokenTranslations[token]))
    return "";
  return tokens.map((token) => tokenTranslations[token]).join("");
}

function auditBilingualText(
  value: string | undefined,
  locale: Locale,
  translate: Translate,
  fallbackTranslation = "",
  untranslated = "",
): string {
  const original = value?.trim() ?? "";
  if (!original) return translate("暂无");
  if (locale === "en-US") {
    const translated = translate(original);
    if (!eastAsianText.test(translated)) return translated;
    const fallback = translate(fallbackTranslation);
    return eastAsianText.test(fallback)
      ? untranslated
      : fallback || untranslated;
  }
  if (eastAsianText.test(original)) return original;
  const translated = translateAuditText(original) || fallbackTranslation;
  return translated ? `${translated} [${original}]` : `未翻译 [${original}]`;
}

export function globalAuditOperationLabel(
  value: string | undefined,
  locale: Locale,
  translate: Translate,
): string {
  return auditBilingualText(
    value,
    locale,
    translate,
    "",
    "Untranslated audit event",
  );
}

function auditResourceTranslation(value: string | undefined): string {
  return (
    {
      artifact: "制品",
      image: "镜像",
      project: "项目",
      registry: "远端仓库",
      replication: "复制任务",
      repository: "镜像仓库",
      robot: "机器人账号",
      scanner: "扫描器",
      tag: "Tag",
      user: "用户",
      "user-group": "用户组",
      webhook: "Webhook",
    }[value?.toLowerCase() ?? ""] ?? "资源"
  );
}

export function globalAuditDescriptionLabel(
  log: AuditLog,
  locale: Locale,
  translate: Translate,
): string {
  const description = log.operation_description?.trim() ?? "";
  if (!description) return translate("暂无操作说明");
  const fallback = `${translateAuditText(log.operation)}${auditResourceTranslation(log.resource_type)}`;
  return auditBilingualText(
    description,
    locale,
    translate,
    fallback,
    "Untranslated audit description",
  );
}

export function projectAuditOperationLabel(
  value: string | undefined,
  locale: Locale,
  translate: Translate,
): string {
  if (locale === "en-US") return value?.trim() ?? translate("未知");
  const label =
    {
      pull: "拉取",
      push: "推送",
      scan: "扫描",
    }[value?.toLowerCase() ?? ""] ?? value;
  return label ? translate(label) : translate("未知");
}

export function projectAuditDescriptionLabel(
  log: AuditLog,
  locale: Locale,
): string {
  const value = log.operation_description;
  if (!value?.trim())
    return locale === "en-US" ? "No description" : "暂无操作说明";
  if (locale === "en-US") return value;
  return (
    {
      "push artifact manifest and blobs": "推送制品清单和数据层",
      "push artifact manifest": "推送制品清单",
      "pull artifact": "拉取制品",
      "trigger vulnerability scan": "触发漏洞扫描",
    }[value.trim().toLowerCase()] ?? value
  );
}
