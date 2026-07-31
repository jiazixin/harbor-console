"use strict";

const consolePreferenceKey = "harbor-console-preferences-v1";

function loadConsolePreferences() {
  let stored = {};
  try {
    stored = JSON.parse(localStorage.getItem(consolePreferenceKey) || "{}");
  } catch (_error) {
    stored = {};
  }
  return {
    dateTimezone: stored.dateTimezone === "utc" ? "utc" : "local",
    runtime: ["docker", "podman", "nerdctl"].includes(stored.runtime) ? stored.runtime : "docker",
    repositoryView: stored.repositoryView === "card" ? "card" : "list",
  };
}

const state = {
  session: null,
  dashboard: null,
  cache: new Map(),
  currentView: "overview",
  selectedProject: "",
  selectedRepository: "",
  searchTimer: null,
  renderToken: 0,
  route: null,
	instances: [],
	assetSort: "storage",
	dismissedBanner: "",
	scannerItems: [],
	identity: null,
	systemPermissions: [],
	projectPermissions: new Map(),
	artifactSelection: new Set(),
	artifactSelectionKey: "",
		publicCatalog: null,
		about: null,
		preferences: loadConsolePreferences(),
		operations: [],
		operationSequence: 0,
	};

const loginView = document.querySelector("#login-view");
const publicCatalogView = document.querySelector("#public-catalog-view");
const appView = document.querySelector("#app-view");
const mainContent = document.querySelector("#main-content");
const connectForm = document.querySelector("#connect-form");
const connectError = document.querySelector("#connect-error");
const searchDialog = document.querySelector("#search-dialog");
const searchInput = document.querySelector("#global-search-input");
const searchResults = document.querySelector("#search-results");
const noticePanel = document.querySelector("#notice-panel");
const publicCatalogReloadKey = "harbor-console-public-catalog-reload";
const publicCatalogHistoryKey = "harborPublicCatalog";

const pageScrollLocks = new Set();
let pageScrollSnapshot = null;

function lockPageScroll(source) {
  if (!source || pageScrollLocks.has(source)) return;
  pageScrollLocks.add(source);
  if (pageScrollLocks.size !== 1) return;

  const bodyStyle = document.body.style;
  const scrollbarWidth = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
  const bodyPaddingRight = Number.parseFloat(getComputedStyle(document.body).paddingRight) || 0;
  pageScrollSnapshot = {
    x: window.scrollX,
    y: window.scrollY,
    position: bodyStyle.position,
    top: bodyStyle.top,
    left: bodyStyle.left,
    right: bodyStyle.right,
    width: bodyStyle.width,
    overflow: bodyStyle.overflow,
    paddingRight: bodyStyle.paddingRight,
  };

  document.documentElement.classList.add("overlay-open");
  document.body.classList.add("overlay-open");
  bodyStyle.position = "fixed";
  bodyStyle.top = `${-pageScrollSnapshot.y}px`;
  bodyStyle.left = `${-pageScrollSnapshot.x}px`;
  bodyStyle.right = "0";
  bodyStyle.width = "auto";
  bodyStyle.overflow = "hidden";
  if (scrollbarWidth > 0) bodyStyle.paddingRight = `${bodyPaddingRight + scrollbarWidth}px`;
}

function unlockPageScroll(source) {
  if (!pageScrollLocks.delete(source) || pageScrollLocks.size > 0 || !pageScrollSnapshot) return;

  const snapshot = pageScrollSnapshot;
  const bodyStyle = document.body.style;
  pageScrollSnapshot = null;
  document.documentElement.classList.remove("overlay-open");
  document.body.classList.remove("overlay-open");
  bodyStyle.position = snapshot.position;
  bodyStyle.top = snapshot.top;
  bodyStyle.left = snapshot.left;
  bodyStyle.right = snapshot.right;
  bodyStyle.width = snapshot.width;
  bodyStyle.overflow = snapshot.overflow;
  bodyStyle.paddingRight = snapshot.paddingRight;
  window.scrollTo(snapshot.x, snapshot.y);
}

const viewMeta = {
  overview: { title: "概览", subtitle: "实例健康状况、镜像资产和最近分发活动" },
  projects: { title: "项目", subtitle: "管理 Harbor 中的项目边界与访问策略" },
  repositories: { title: "镜像资产", subtitle: "跨项目浏览全部镜像仓库、制品规模与拉取活动" },
  security: { title: "制品安全", subtitle: "管理扫描器并查看制品扫描结果与漏洞风险分布" },
  replication: { title: "复制管理", subtitle: "检查复制策略和最近执行记录" },
  registries: { title: "镜像仓库", subtitle: "管理 Harbor 连接的远端镜像仓库" },
  preheat: { title: "P2P 分发", subtitle: "管理分布式分发 Provider 与预热实例" },
  audit: { title: "审计日志", subtitle: "追踪用户和自动化账号的资源操作" },
  system: { title: "系统状态", subtitle: "查看 Harbor 配置、组件和存储状态" },
  administration: { title: "系统管理", subtitle: "管理用户、配额与后台维护任务" },
  project: { title: "项目详情", subtitle: "管理项目仓库、成员和安全策略" },
  repository: { title: "仓库详情", subtitle: "管理仓库及其制品" },
  artifact: { title: "制品详情", subtitle: "管理 Tag、扫描结果和拉取命令" },
	about: { title: "关于与 API", subtitle: "版本、许可证与当前实例的 Harbor 官方 Swagger" },
};

function icon(name, className = "") {
  return `<svg class="icon ${className}" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHTML(value).replaceAll("`", "&#096;");
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function currentLocale() {
  return window.HarborI18n?.locale() || "zh-CN";
}

function translateUI(value) {
  return window.HarborI18n?.translate(value) || value;
}

function formatNumber(value) {
  return new Intl.NumberFormat(currentLocale()).format(toNumber(value));
}

function formatBytes(value) {
  let bytes = toNumber(value);
  const units = currentLocale() === "en-US" ? ["bytes", "KB", "MB", "GB", "TB", "PB"] : ["字节", "KB", "MB", "GB", "TB", "PB"];
  if (bytes <= 0) return `0 ${units[0]}`;
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const amount = bytes / 1024 ** index;
  return `${amount >= 10 || index === 0 ? amount.toFixed(0) : amount.toFixed(1)} ${units[index]}`;
}

function formatDate(value, includeTime = true) {
  if (!value) return "暂无";
  return window.HarborDates.format(value, currentLocale(), includeTime, state.preferences.dateTimezone) || escapeHTML(value);
}

function formatAuditDate(value) {
  if (!value) return "暂无";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return escapeHTML(value);
  return new Intl.DateTimeFormat(currentLocale(), {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
		timeZone: state.preferences.dateTimezone === "utc" ? "UTC" : undefined,
  }).format(date);
}

function commandRuntime() {
	return ["docker", "podman", "nerdctl"].includes(state.preferences.runtime) ? state.preferences.runtime : "docker";
}

function repositoryViewMode() {
	return state.preferences.repositoryView === "card" ? "card" : "list";
}

function saveConsolePreferences(next) {
	state.preferences = {
		dateTimezone: next.dateTimezone === "utc" ? "utc" : "local",
		runtime: ["docker", "podman", "nerdctl"].includes(next.runtime) ? next.runtime : "docker",
		repositoryView: next.repositoryView === "card" ? "card" : "list",
	};
	localStorage.setItem(consolePreferenceKey, JSON.stringify(state.preferences));
}

function beginOperation({ kind = "task", title, detail = "", total = 0 }) {
	const operation = {
		id: `${Date.now()}-${++state.operationSequence}`,
		kind,
		title: String(title || "后台任务"),
		detail: String(detail || ""),
		status: "running",
		startedAt: new Date().toISOString(),
		completedAt: "",
		total: Math.max(0, toNumber(total)),
		completed: 0,
		succeeded: 0,
		failed: 0,
		results: [],
	};
	state.operations.unshift(operation);
	state.operations = state.operations.slice(0, 50);
	operationCenterChanged();
	return operation.id;
}

function operationByID(id) {
	return state.operations.find((operation) => operation.id === id);
}

function updateOperation(id, patch = {}) {
	const operation = operationByID(id);
	if (!operation) return null;
	Object.assign(operation, patch);
	operationCenterChanged();
	return operation;
}

function recordOperationResult(id, label, error = "") {
	const operation = operationByID(id);
	if (!operation) return;
	const failed = Boolean(error);
	operation.completed += 1;
	operation.succeeded += failed ? 0 : 1;
	operation.failed += failed ? 1 : 0;
	operation.results.push({ label: String(label || `#${operation.completed}`), status: failed ? "failed" : "success", error: String(error || "") });
	operationCenterChanged();
}

function finishOperation(id, detail = "") {
	const operation = operationByID(id);
	if (!operation) return;
	operation.status = operation.failed > 0 ? (operation.succeeded > 0 ? "partial" : "failed") : "success";
	operation.completedAt = new Date().toISOString();
	if (detail) operation.detail = detail;
	operationCenterChanged();
}

function failOperation(id, error) {
	const operation = operationByID(id);
	if (!operation) return;
	operation.status = "failed";
	operation.completedAt = new Date().toISOString();
	operation.failed = Math.max(1, operation.failed);
	operation.detail = error?.message || String(error || "任务失败");
	if (!operation.results.length) operation.results.push({ label: operation.title, status: "failed", error: operation.detail });
	operationCenterChanged();
}

function resetOperations() {
	state.operations = [];
	state.operationSequence = 0;
	operationCenterChanged();
}

function operationCenterChanged() {
	updateOperationIndicator();
	if (!noticePanel?.hidden && noticePanel.dataset.panel === "operations") renderOperationCenter();
}

function updateOperationIndicator() {
	const button = document.querySelector(".notification-button");
	const dot = button?.querySelector("span");
	if (!button || !dot) return;
	const running = state.operations.filter((operation) => operation.status === "running").length;
	const failed = state.operations.filter((operation) => ["failed", "partial"].includes(operation.status)).length;
	const warnings = asArray(state.dashboard?.warnings).length;
	dot.hidden = running + failed + warnings === 0;
	dot.classList.toggle("has-running", running > 0);
	dot.classList.toggle("has-failure", failed + warnings > 0);
	button.title = translateUI(running ? `${running} 个任务正在执行` : failed ? `${failed} 个任务需要查看` : "操作中心");
	button.setAttribute("aria-label", button.title);
}

function formatDuration(start, end) {
  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime < startTime) return "暂无";
  const seconds = Math.round((endTime - startTime) / 1000);
  if (currentLocale() === "en-US") {
    if (seconds < 60) return `${seconds} sec`;
    return `${Math.floor(seconds / 60)} min ${seconds % 60} sec`;
  }
  if (seconds < 60) return `${seconds} 秒`;
  return `${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒`;
}

function shortDigest(value) {
  const digest = String(value || "");
  return digest.length > 22 ? `${digest.slice(0, 15)}…${digest.slice(-7)}` : digest || translateUI("暂无摘要");
}

function statusInfo(raw) {
  const status = String(raw || "unknown").toLowerCase();
  const mappings = {
    healthy: ["正常", "status-healthy"],
    succeed: ["成功", "status-success"],
    success: ["成功", "status-success"],
    completed: ["已完成", "status-success"],
    running: ["运行中", "status-running"],
    inprogress: ["进行中", "status-running"],
    in_progress: ["进行中", "status-running"],
    pending: ["等待中", "status-running"],
		queued: ["排队中", "status-running"],
	    scheduled: ["已计划", "status-running"],
		idle: ["空闲", "status-stopped"],
		"not scanned": ["未扫描", ""],
		unscanned: ["未扫描", ""],
    paused: ["已暂停", "status-stopped"],
    failed: ["失败", "status-failed"],
    error: ["异常", "status-failed"],
    unhealthy: ["异常", "status-failed"],
    stopped: ["已停止", "status-stopped"],
    canceled: ["已取消", "status-stopped"],
    cancelled: ["已取消", "status-stopped"],
    disabled: ["已停用", "status-stopped"],
    unknown: ["未知", ""],
  };
  const result = mappings[status] || [escapeHTML(raw || "未知"), ""];
  return [translateUI(result[0]), result[1]];
}

function statusBadge(value) {
  const [label, className] = statusInfo(value);
  return `<span class="status-badge ${className}">${label}</span>`;
}

function severityInfo(value) {
  const severity = String(value || "Unknown").toLowerCase();
  const labels = {
    critical: ["严重", "severity-critical"],
    high: ["高危", "severity-high"],
    medium: ["中危", "severity-medium"],
    low: ["低危", "badge-blue"],
    negligible: ["可忽略", ""],
    none: ["无风险", "badge-green"],
    unknown: ["未扫描", ""],
  };
  const result = labels[severity] || [escapeHTML(value || "未扫描"), ""];
  return [translateUI(result[0]), result[1]];
}

function severityBadge(value) {
  const [label, className] = severityInfo(value);
  return `<span class="badge ${className}">${label}</span>`;
}

function triggerLabel(value) {
  const labels = {
    scheduled: "定时触发",
    event_based: "事件触发",
    manual: "手动触发",
  };
  return labels[String(value || "").toLowerCase()] || escapeHTML(value || "未知方式");
}

function authModeLabel(value) {
  const labels = {
    db_auth: "数据库认证",
    ldap_auth: "LDAP 认证",
    oidc_auth: "OIDC 认证",
    uaa_auth: "UAA 认证",
  };
  return labels[value] || escapeHTML(value || "未知");
}

function operationLabel(value) {
  const labels = {
    copy: "复制",
    create: "创建",
    delete: "删除",
    pull: "拉取",
    push: "推送",
    scan: "扫描",
    update: "更新",
  };
  return labels[String(value || "").toLowerCase()] || escapeHTML(value || "未知操作");
}

const auditExactTranslations = {
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

const auditTokenTranslations = {
  add: "添加", all: "全部", artifact: "制品", artifacts: "制品", audit: "审计", blob: "镜像层", blobs: "镜像层",
  collection: "清理", configuration: "配置", configurations: "配置", copy: "复制", create: "创建", created: "创建",
  delete: "删除", deleted: "删除", disable: "停用", disabled: "停用", enable: "启用", enabled: "启用", execute: "执行",
  garbage: "垃圾", get: "查看", global: "全局", group: "用户组", groups: "用户组", immutable: "不可变", label: "标签",
  labels: "标签", list: "列出", log: "日志", logs: "日志", login: "登录", logout: "退出登录", manifest: "清单", member: "成员",
  members: "成员", permission: "权限", permissions: "权限", policy: "策略", policies: "策略", project: "项目", projects: "项目",
  pull: "拉取", pulled: "拉取", push: "推送", pushed: "推送", quota: "配额", quotas: "配额", read: "查看", refresh: "刷新",
  registry: "远端仓库", registries: "远端仓库", remove: "移除", replication: "复制", repository: "镜像仓库", repositories: "镜像仓库",
  reset: "重置", retention: "Tag 保留", robot: "机器人账号", robots: "机器人账号", run: "运行", sbom: "软件物料清单",
  scan: "扫描", scanned: "扫描", scanner: "扫描器", scanners: "扫描器", start: "启动", stop: "停止", stopped: "停止",
  system: "系统", tag: "Tag", tags: "Tag", trigger: "触发", update: "更新", updated: "更新", user: "用户", users: "用户",
  vulnerability: "漏洞", vulnerabilities: "漏洞", webhook: "Webhook", webhooks: "Webhook",
};

function auditBilingualText(value, fallbackTranslation = "") {
  const original = String(value || "").trim();
  if (!original) return "暂无";
  if (/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af\uf900-\ufaff]/.test(original)) return original;
  const translated = translateAuditText(original) || fallbackTranslation;
  return translated ? `${translated} [${original}]` : `未翻译 [${original}]`;
}

function translateAuditText(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "";
  if (auditExactTranslations[normalized]) return auditExactTranslations[normalized];
  const tokens = normalized.split(/[\s_-]+/).filter(Boolean);
  if (!tokens.length || tokens.some((token) => !auditTokenTranslations[token])) return "";
  return tokens.map((token) => auditTokenTranslations[token]).join("");
}

function auditEventLabel(value) {
  return auditBilingualText(value);
}

function auditDescriptionLabel(item) {
  const description = String(item?.operation_description || "").trim();
  if (!description) return "暂无操作说明";
  const fallback = `${translateAuditText(item.operation)}${auditResourceTranslation(item.resource_type)}`;
  return auditBilingualText(description, fallback);
}

function auditResourceTranslation(value) {
  const labels = {
    artifact: "制品", image: "镜像", project: "项目", registry: "远端仓库", replication: "复制任务", repository: "镜像仓库",
    robot: "机器人账号", scanner: "扫描器", tag: "Tag", user: "用户", "user-group": "用户组", webhook: "Webhook",
  };
  return labels[String(value || "").toLowerCase()] || "资源";
}

function resourceTypeLabel(value) {
  const labels = {
    image: "镜像",
    artifact: "制品",
    repository: "仓库",
    project: "项目",
    replication: "复制任务",
    registry: "镜像仓库",
    user: "用户",
  };
  return labels[String(value || "").toLowerCase()] || escapeHTML(value || "其他");
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: options.body ? { "Content-Type": "application/json", ...(options.headers || {}) } : options.headers,
    ...options,
  });
  let payload = null;
  if (response.status !== 204) {
    const contentType = response.headers.get("content-type") || "";
    payload = contentType.includes("application/json") ? await response.json() : await response.text();
  }
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith("/api/connect") && !path.startsWith("/api/public/")) showLogin();
    const message = payload?.details || payload?.error || (typeof payload === "string" ? payload : `请求失败（${response.status}）`);
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return payload;
}

async function bootstrap() {
  applySavedTheme();
  bindStaticEvents();
  const restoredCatalog = restorePublicCatalogReloadState();
  if (restoredCatalog) {
    state.publicCatalog = restoredCatalog;
    if (!readPublicCatalogHistoryState(history.state)) pushPublicCatalogHistory();
    populateConnectFormFromPublicCatalog(restoredCatalog);
    loginView.hidden = true;
    appView.hidden = true;
    publicCatalogView.hidden = false;
    connectError.hidden = true;
    document.title = `${translateUI("公开镜像目录")} · ${translateUI("Harbor 控制台")}`;
    await loadPublicCatalogPage(restoredCatalog.page, { replaceHistory: false });
    return;
  }
  try {
    state.session = await api("/api/session");
    await enterConsole();
  } catch (error) {
    showLogin();
  }
}

function showLogin() {
  state.session = null;
  state.dashboard = null;
  state.instances = [];
	state.cache.clear();
	state.dismissedBanner = "";
	state.identity = null;
	state.systemPermissions = [];
	state.projectPermissions.clear();
	state.artifactSelection.clear();
	state.artifactSelectionKey = "";
	state.projectSelection?.clear();
	state.repositorySelection?.clear();
	resetOperations();
  appView.hidden = true;
  appView.classList.remove("nav-ready");
	publicCatalogView.hidden = true;
  loginView.hidden = false;
  closeSearch();
  closeMobileMenu();
  if (typeof closeControlDialog === "function") closeControlDialog();
  noticePanel.hidden = true;
  document.title = `${translateUI("连接实例")} · ${translateUI("Harbor 控制台")}`;
  window.setTimeout(() => document.querySelector("#instance-url")?.focus(), 30);
}

async function enterConsole() {
  loginView.hidden = true;
	publicCatalogView.hidden = true;
  appView.hidden = false;
  window.setTimeout(() => appView.classList.add("nav-ready"), 220);
  connectError.hidden = true;
  renderSessionChrome();
  renderLoading("正在读取 Harbor 实例", "正在聚合项目、复制任务与系统状态...");
  try {
	const [dashboard, instances, identityResult, permissionResult] = await Promise.all([
	  api("/api/dashboard"),
	  api("/api/instances"),
	  controlData("current-user").then((data) => ({ data })).catch((error) => ({ error })),
	  controlList("current-permissions", { scope: "/", relative: true }).then((data) => ({ data })).catch((error) => ({ error })),
	]);
    state.dashboard = dashboard;
    state.instances = asArray(instances?.items);
	state.identity = identityResult.data || { username: state.session.username, sysadmin_flag: false, load_error: identityResult.error?.message || "" };
	state.systemPermissions = permissionResult.data?.items || [];
	state.projectPermissions.clear();
    state.cache.set("projects", asArray(state.dashboard.projects));
    renderSessionChrome();
	applyPermissionChrome();
    handleRoute();
  } catch (error) {
    renderError("无法载入实例概览", error.message, "refresh-dashboard");
  }
}

function renderSessionChrome() {
  if (!state.session) return;
  const parsed = safeURL(state.session.instance_url);
  const host = parsed?.host || state.session.instance_url;
  document.querySelector("#instance-switcher").innerHTML = `
    <button class="instance-button" type="button" data-action="show-instance">
      <span class="instance-avatar">H</span>
      <span class="instance-meta"><strong>${escapeHTML(host)}</strong><span>${state.session.demo ? "演示实例" : "已连接实例"}</span></span>
      ${icon("chevron")}
    </button>`;
  const topInstanceLabel = document.querySelector("#top-instance-label");
  if (topInstanceLabel) topInstanceLabel.textContent = host;
  const health = asObject(state.dashboard?.health);
  const healthStatus = String(health.status || "healthy").toLowerCase();
  const mini = document.querySelector(".health-mini");
	mini.innerHTML = `<span class="status-dot ${healthStatus === "healthy" ? "" : "status-dot-unhealthy"}"></span><span>${healthStatus === "healthy" ? "连接正常" : "实例有异常"}</span>`;
	const username = String(state.identity?.username || state.session.username || "U");
	const avatar = document.querySelector("#account-avatar");
	const accountName = document.querySelector("#account-name");
	if (avatar) avatar.textContent = username.slice(0, 1).toUpperCase();
	if (accountName) accountName.textContent = username;
	renderHarborBanner(asObject(state.dashboard?.systeminfo).banner_message);
	updateOperationIndicator();
}

function permissionMatches(permission, resource, action) {
	const item = asObject(permission);
	return (item.resource === resource || item.resource === "*") && (item.action === action || item.action === "*");
}

function isSystemAdmin() {
	return state.identity?.sysadmin_flag === true;
}

function hasSystemPermission(resource, action = "read") {
	return isSystemAdmin() || asArray(state.systemPermissions).some((permission) => permissionMatches(permission, resource, action));
}

function hasProjectPermission(resource, action = "read", projectID = state.controlProject?.project_id) {
	if (isSystemAdmin()) return true;
	const permissions = state.projectPermissions.get(String(projectID));
	return asArray(permissions).some((permission) => permissionMatches(permission, resource, action));
}

async function loadProjectPermissions(projectID) {
	const key = String(projectID || "");
	if (!key) return [];
	if (state.projectPermissions.has(key)) return state.projectPermissions.get(key);
	const result = await controlList("current-permissions", { scope: `/project/${key}`, relative: true });
	state.projectPermissions.set(key, result.items);
	return result.items;
}

function applyPermissionChrome() {
	document.querySelectorAll("[data-system-admin]").forEach((element) => { element.hidden = !isSystemAdmin(); });
	document.querySelectorAll("[data-system-resource]").forEach((element) => {
	  element.hidden = !hasSystemPermission(element.dataset.systemResource, element.dataset.systemAction || "read");
	});
	const distributionLinks = document.querySelectorAll('.primary-nav a[data-view="replication"], .primary-nav a[data-view="registries"], .primary-nav a[data-view="preheat"], .primary-nav a[data-view="audit"]');
	const systemLinks = document.querySelectorAll('.primary-nav a[data-view="administration"], .primary-nav a[data-view="system"]');
	const distributionLabel = document.querySelector("#distribution-nav-label");
	const systemLabel = document.querySelector("#system-nav-label");
	if (distributionLabel) distributionLabel.hidden = !Array.from(distributionLinks).some((link) => !link.hidden);
	if (systemLabel) systemLabel.hidden = !Array.from(systemLinks).some((link) => !link.hidden);
}

function viewAllowed(view) {
	if (["overview", "projects", "repositories", "project", "repository", "artifact"].includes(view)) return true;
	const link = document.querySelector(`.primary-nav a[data-view="${CSS.escape(view)}"]`);
	return !link || !link.hidden;
}

function renderHarborBanner(rawValue) {
  const element = document.querySelector("#harbor-banner");
  if (!element) return;
  const raw = String(rawValue || "");
  let banner;
  try {
    banner = JSON.parse(raw);
  } catch {
    banner = null;
  }
  const message = String(banner?.message || "").trim();
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const from = banner?.fromDate ? new Date(banner.fromDate) : null;
  const to = banner?.toDate ? new Date(banner.toDate) : null;
  if (to && !Number.isNaN(to.getTime())) to.setHours(23, 59, 59, 999);
  const outsideWindow = (from && !Number.isNaN(from.getTime()) && today < from) || (to && !Number.isNaN(to.getTime()) && today > to);
  if (!message || outsideWindow || state.dismissedBanner === raw) {
    element.hidden = true;
    element.replaceChildren();
    return;
  }
  const type = ["success", "info", "warning", "danger"].includes(banner.type) ? banner.type : "warning";
  const iconName = type === "success" ? "check" : type === "info" ? "shield" : "alert";
  element.className = `harbor-banner harbor-banner-${type}`;
  element.dataset.value = raw;
  element.innerHTML = `<span class="harbor-banner-icon">${icon(iconName)}</span><span>${escapeHTML(message)}</span>${banner.closable ? `<button class="icon-button" type="button" data-action="dismiss-harbor-banner" title="关闭横幅" aria-label="关闭横幅">${icon("x")}</button>` : ""}`;
  element.hidden = false;
}

function dismissHarborBanner() {
  const element = document.querySelector("#harbor-banner");
  if (!element) return;
  state.dismissedBanner = element.dataset.value || "";
  element.hidden = true;
}

function safeURL(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function routeFromHash() {
  if (typeof parseConsoleRoute === "function") {
    state.route = parseConsoleRoute();
    return state.route.view;
  }
  const candidate = location.hash.replace(/^#\//, "").split("?")[0];
  return viewMeta[candidate] ? candidate : "overview";
}

function handleRoute() {
  if (!state.session || !state.dashboard) return;
  if (typeof closeControlDialog === "function") closeControlDialog();
  state.currentView = routeFromHash();
  document.querySelectorAll(".primary-nav a[data-view]").forEach((link) => {
    const activeView = ["project", "repository", "artifact"].includes(state.currentView) ? "projects" : state.currentView;
    const active = link.dataset.view === activeView;
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "page"); else link.removeAttribute("aria-current");
  });
  closeMobileMenu();
	if (!viewAllowed(state.currentView)) {
	  renderPermissionDenied();
	  document.title = `${translateUI("权限不足")} · ${translateUI("Harbor 控制台")}`;
	  return;
	}
  renderCurrentView();
  document.title = `${translateUI(viewMeta[state.currentView].title)} · ${translateUI("Harbor 控制台")}`;
  mainContent.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: "instant" });
}

async function renderCurrentView(force = false) {
  const token = ++state.renderToken;
  switch (state.currentView) {
    case "overview": renderOverview(); break;
    case "projects": await renderControlProjects(token, force); break;
    case "project": await renderProjectDetail(token, force); break;
    case "repository": await renderRepositoryDetail(token, force); break;
    case "artifact": await renderArtifactDetail(token, force); break;
    case "repositories": await renderRepositories(token, force); break;
    case "security": await renderSecurity(token, force); break;
    case "replication": await renderControlReplication(token, force); break;
    case "registries": await renderControlRegistries(token, force); break;
    case "preheat": await renderPreheatDistribution(token, force); break;
    case "audit": await renderAudit(token, force); break;
    case "system": await renderSystem(token, force); break;
    case "administration": await renderAdministration(token, force); break;
	case "about": await renderAbout(token, force); break;
  }
	applyPermissionControls(mainContent);
  revealActiveResourceTab();
}

function renderPermissionDenied() {
	mainContent.innerHTML = `<div class="error-state permission-state"><div><span class="state-icon">${icon("shield")}</span><h2>${escapeHTML(translateUI("权限不足"))}</h2><p>${escapeHTML(translateUI("当前 Harbor 账号没有访问此页面的权限。"))}</p><a class="button button-small" href="#/overview">${icon("arrow-left")}<span>${escapeHTML(translateUI("返回概览"))}</span></a></div></div>`;
}

const projectActionPermissions = {
	"project-settings": ["configuration", "update"],
	"delete-project": [".", "delete"],
	"add-project-member": ["member", "create"],
	"edit-project-member": ["member", "update"],
	"delete-project-member": ["member", "delete"],
	"create-project-robot": ["robot", "create"],
	"edit-project-robot": ["robot", "update"],
	"reset-robot-secret": ["robot", "update"],
	"delete-project-robot": ["robot", "delete"],
	"create-webhook": ["notification-policy", "create"],
	"edit-webhook": ["notification-policy", "update"],
	"delete-webhook": ["notification-policy", "delete"],
	"create-immutable-rule": ["immutable-tag", "create"],
	"edit-immutable-rule": ["immutable-tag", "update"],
	"delete-immutable-rule": ["immutable-tag", "delete"],
	"create-project-label": ["label", "create"],
	"edit-project-label": ["label", "update"],
	"delete-project-label": ["label", "delete"],
	"create-retention-policy": ["tag-retention", "create"],
	"edit-retention-schedule": ["tag-retention", "update"],
	"add-retention-rule": ["tag-retention", "update"],
	"edit-retention-rule": ["tag-retention", "update"],
	"delete-retention-rule": ["tag-retention", "update"],
	"delete-retention-policy": ["tag-retention", "delete"],
	"run-retention": ["tag-retention", "operate"],
	"stop-retention-execution": ["tag-retention", "operate"],
	"create-preheat-policy": ["preheat-policy", "create"],
	"edit-preheat-policy": ["preheat-policy", "update"],
	"delete-preheat-policy": ["preheat-policy", "delete"],
	"run-preheat-policy": ["preheat-policy", "operate"],
	"stop-preheat-execution": ["preheat-policy", "operate"],
	"edit-repository": ["repository", "update"],
	"delete-repository": ["repository", "delete"],
	"scan-artifact": ["scan", "create"],
	"stop-artifact-scan": ["scan", "create"],
	"batch-scan-artifacts": ["scan", "create"],
	"batch-sbom-artifacts": ["sbom", "create"],
	"batch-stop-artifacts": ["scan", "create"],
	"add-artifact-tag": ["tag", "create"],
	"delete-artifact-tag": ["tag", "delete"],
	"attach-artifact-label": ["artifact-label", "create"],
	"batch-attach-label": ["artifact-label", "create"],
	"remove-artifact-label": ["artifact-label", "delete"],
	"batch-remove-label": ["artifact-label", "delete"],
	"copy-artifact": ["artifact", "create"],
	"copy-selected-artifact": ["artifact", "create"],
	"delete-artifact": ["artifact", "delete"],
	"batch-delete-artifacts": ["artifact", "delete"],
	"delete-accessory-artifact": ["artifact", "delete"],
};

function applyPermissionControls(root = document) {
	root.querySelectorAll('[data-action="create-project"]').forEach((element) => { element.hidden = !hasSystemPermission("project", "create"); });
	Object.entries(projectActionPermissions).forEach(([action, requirement]) => {
	  root.querySelectorAll(`[data-action="${action}"]`).forEach((element) => {
		element.hidden = !hasProjectPermission(requirement[0], requirement[1]);
	  });
	});
}

function revealActiveResourceTab() {
  const tabs = mainContent.querySelector(".resource-tabs");
  const active = tabs?.querySelector(".active");
  if (!tabs || !active || tabs.scrollWidth <= tabs.clientWidth) return;
  const activeLeft = active.offsetLeft;
  const activeRight = activeLeft + active.offsetWidth;
  const visibleLeft = tabs.scrollLeft;
  const visibleRight = visibleLeft + tabs.clientWidth;
  if (activeLeft >= visibleLeft && activeRight <= visibleRight) return;
  tabs.scrollLeft = Math.max(0, activeLeft - (tabs.clientWidth - active.offsetWidth) / 2);
}

function pageHeader(title, subtitle, actions = "", breadcrumb = "") {
  return `
    <header class="page-header">
      <div>${breadcrumb}<h1>${escapeHTML(title)}</h1><p>${escapeHTML(subtitle)}</p></div>
      <div class="page-actions">${actions}</div>
    </header>`;
}

function refreshButton(action = "refresh-view") {
  return `<button class="button button-small" type="button" data-action="${action}">${icon("refresh")}<span>刷新</span></button>`;
}

function demoBanner() {
  return state.session?.demo
    ? `<div class="demo-banner">${icon("alert")}<span><strong>当前为演示模式。</strong> 页面中的资产与状态为内置样例，连接真实实例后会自动替换。</span></div>`
    : "";
}

function warningBanners() {
  const warnings = asArray(state.dashboard?.warnings);
  if (!warnings.length) return "";
  return warnings.map((warning) => `<div class="warning-banner">${icon("alert")}<span><strong>部分数据未载入。</strong> ${escapeHTML(warning)}</span></div>`).join("");
}

function renderOverview() {
  const dashboard = asObject(state.dashboard);
  const stats = asObject(dashboard.statistics);
  const projects = asArray(dashboard.projects);
  const replications = asArray(dashboard.replications);
  const replicationPolicies = asArray(dashboard.replication_policies);
  const system = asObject(dashboard.systeminfo);
  const storage = stats.total_storage_consumption ?? stats.total_storage_consumption_bytes;
  const healthy = String(asObject(dashboard.health).status || "unknown").toLowerCase() === "healthy";
  const risks = state.session.demo ? { critical: 3, high: 12, medium: 28, total: 156 } : { critical: 0, high: 0, medium: 0, total: 0 };
  const hasTagCounts = projects.some((project) => Object.hasOwn(project, "tag_count"));
  const assetMetrics = {
    storage: { key: "storage_used", label: "存储占用", subtitle: "按项目存储占用排序", format: formatBytes },
    repositories: { key: "repo_count", label: "仓库数量", subtitle: "按镜像仓库数量排序", format: formatNumber },
    images: { key: hasTagCounts ? "tag_count" : "artifact_count", label: hasTagCounts ? "Tag 数量" : "制品数量", subtitle: hasTagCounts ? "按镜像 Tag 数量排序" : "按镜像制品数量排序", format: formatNumber },
  };
  const selectedMetric = assetMetrics[state.assetSort] || assetMetrics.storage;
  const metricValue = (project) => {
    if (!Object.hasOwn(project, selectedMetric.key)) return null;
    const value = Number(project[selectedMetric.key]);
    return Number.isFinite(value) && value >= 0 ? value : null;
  };
  const sortedProjects = [...projects].sort((left, right) => (metricValue(right) ?? -1) - (metricValue(left) ?? -1) || String(left.name || "").localeCompare(String(right.name || ""), currentLocale()));
  const availableAssetValues = sortedProjects.map(metricValue).filter((value) => value !== null);
  const maxAssetValue = Math.max(...availableAssetValues, 0);

  mainContent.innerHTML = `
    ${pageHeader("实例概览", `${safeURL(state.session.instance_url)?.host || state.session.instance_url} · ${system.harbor_version || "Harbor v2"}`, refreshButton("refresh-dashboard"))}
    ${demoBanner()}${warningBanners()}
    <section class="overview-stats" aria-label="实例统计">
      ${statCell("项目总数", stats.total_project_count ?? projects.length, `${formatNumber(stats.private_project_count)} 个私有项目`, "folder")}
      ${statCell("镜像仓库", stats.total_repo_count, `${formatNumber(stats.public_repo_count)} 个公开仓库`, "package")}
      ${statCell("存储用量", formatBytes(storage), "当前制品占用空间", "database", true)}
      ${statCell("系统状态", healthy ? "正常" : "异常", healthy ? "所有核心组件可用" : "请检查组件状态", "shield", true)}
    </section>

    <div class="dashboard-grid">
      <section class="panel">
        <div class="panel-head"><div><h2>项目资产分布</h2><p>${escapeHTML(selectedMetric.subtitle)}</p></div><div class="panel-actions"><select id="asset-sort" class="toolbar-select" aria-label="项目资产排序"><option value="storage" ${state.assetSort === "storage" ? "selected" : ""}>存储占用</option><option value="repositories" ${state.assetSort === "repositories" ? "selected" : ""}>仓库数量</option><option value="images" ${state.assetSort === "images" ? "selected" : ""}>${escapeHTML(assetMetrics.images.label)}</option></select><button class="panel-link" data-go="projects">查看全部 ${icon("arrow-right")}</button></div></div>
        <div class="asset-chart">
          ${sortedProjects.slice(0, 6).map((project) => {
            const value = metricValue(project);
            const valueLabel = value === null ? "暂无数据" : selectedMetric.format(value);
            const bar = value === null
              ? `<div class="bar-track bar-track-unavailable" role="img" aria-label="${escapeAttr(`${project.name} ${selectedMetric.label}暂无数据`)}"></div>`
              : `<progress class="bar-track" max="${escapeAttr(maxAssetValue || 1)}" value="${escapeAttr(value)}" aria-label="${escapeAttr(`${project.name} ${selectedMetric.label}`)}">${escapeHTML(valueLabel)}</progress>`;
            return `<div class="asset-row"><span title="${escapeAttr(project.name)}">${escapeHTML(project.name)}</span>${bar}<strong class="${value === null ? "asset-value-unavailable" : ""}">${escapeHTML(valueLabel)}</strong></div>`;
          }).join("") || emptyInline("暂无项目数据")}
        </div>
      </section>
      <section class="panel">
        <div class="panel-head"><div><h2>漏洞风险</h2><p>${state.session.demo ? "最近扫描制品汇总" : "进入制品安全查看扫描结果"}</p></div><button class="panel-link" data-go="security">查看详情 ${icon("arrow-right")}</button></div>
        <div class="risk-layout">
          ${riskRing(risks)}
          <div class="risk-legend">
            ${legendRow("严重", "critical", risks.critical)}
            ${legendRow("高危", "high", risks.high)}
            ${legendRow("中危", "medium", risks.medium)}
            ${legendRow("其他", "", Math.max(0, risks.total - risks.critical - risks.high - risks.medium))}
          </div>
        </div>
      </section>
    </div>

    <section class="section-block">
      <div class="section-heading"><div><h2>最近复制活动</h2><p>实例间镜像同步执行记录</p></div><button class="panel-link" data-go="replication">打开复制管理 ${icon("arrow-right")}</button></div>
      <div class="table-shell"><div class="table-scroll">${replicationTable(replications.slice(0, 6), replicationPolicies)}</div></div>
    </section>`;
  document.querySelector("#asset-sort")?.addEventListener("change", (event) => {
    state.assetSort = event.target.value;
    renderOverview();
  });
}

function statCell(label, value, foot, iconName, rawValue = false) {
  return `<div class="stat-cell"><span class="stat-label"><span>${escapeHTML(label)}</span>${icon(iconName)}</span><strong class="stat-value">${rawValue ? escapeHTML(value) : formatNumber(value)}</strong><span class="stat-foot">${escapeHTML(foot)}</span></div>`;
}

function riskPercent(value, total) {
  return total ? Math.min(100, toNumber(value) / total * 100) : 0;
}

function riskRing(risks) {
  const critical = riskPercent(risks.critical, risks.total);
  const high = riskPercent(risks.high, risks.total);
  const medium = riskPercent(risks.medium, risks.total);
  return `<div class="risk-ring" role="img" aria-label="漏洞风险分布：严重 ${formatNumber(risks.critical)}，高危 ${formatNumber(risks.high)}，中危 ${formatNumber(risks.medium)}">
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <circle class="risk-ring-track" cx="60" cy="60" r="52" pathLength="100"></circle>
      <circle class="risk-ring-segment risk-ring-critical" cx="60" cy="60" r="52" pathLength="100" stroke-dasharray="${critical.toFixed(2)} ${(100 - critical).toFixed(2)}"></circle>
      <circle class="risk-ring-segment risk-ring-high" cx="60" cy="60" r="52" pathLength="100" stroke-dasharray="${high.toFixed(2)} ${(100 - high).toFixed(2)}" stroke-dashoffset="${(-critical).toFixed(2)}"></circle>
      <circle class="risk-ring-segment risk-ring-medium" cx="60" cy="60" r="52" pathLength="100" stroke-dasharray="${medium.toFixed(2)} ${(100 - medium).toFixed(2)}" stroke-dashoffset="${(-(critical + high)).toFixed(2)}"></circle>
    </svg>
    <div class="risk-ring-label"><strong>${formatNumber(risks.total)}</strong><span>漏洞总数</span></div>
  </div>`;
}

function legendRow(label, className, value) {
  return `<div class="legend-row"><i class="${className}"></i><span>${label}</span><strong>${formatNumber(value)}</strong></div>`;
}

function emptyInline(label) {
  return `<div class="muted">${escapeHTML(label)}</div>`;
}

function renderProjects(filter = "") {
  const projects = asArray(state.cache.get("projects") || state.dashboard?.projects);
  const term = filter.trim().toLowerCase();
  const filtered = term ? projects.filter((project) => String(project.name || "").toLowerCase().includes(term)) : projects;
  mainContent.innerHTML = `
    ${pageHeader("项目", viewMeta.projects.subtitle, refreshButton())}
    ${demoBanner()}
    <section class="table-shell">
      <div class="table-toolbar">
        <div class="toolbar-search">${icon("search")}<input id="project-filter" type="search" value="${escapeAttr(filter)}" placeholder="按项目名称筛选" aria-label="按项目名称筛选"></div>
        <div class="toolbar-spacer"></div>
        <button class="button button-small" type="button" data-action="show-create-unavailable">${icon("plus")}<span>新建项目</span></button>
      </div>
      <div class="table-scroll">${projectTable(filtered)}</div>
      ${tableFooter(filtered.length, projects.length)}
    </section>`;
  const input = document.querySelector("#project-filter");
  input?.addEventListener("input", () => renderProjects(input.value));
  if (filter) {
    input?.focus();
    input?.setSelectionRange(filter.length, filter.length);
  }
}

function projectTable(projects) {
  if (!projects.length) return emptyTable("没有匹配的项目", "尝试更换筛选条件，或确认当前账号拥有项目读取权限。", "folder");
  return `<table><thead><tr><th>项目</th><th>可见性</th><th>仓库数</th><th>自动扫描</th><th>漏洞阻止</th><th>最近更新</th><th></th></tr></thead><tbody>
    ${projects.map((project) => {
      const metadata = asObject(project.metadata);
      const isPublic = String(metadata.public) === "true";
      const autoScan = String(metadata.auto_scan) === "true";
      const prevent = String(metadata.prevent_vul) === "true";
      return `<tr data-action="open-project" data-project="${escapeAttr(project.name)}">
        <td><div class="cell-title"><span class="cell-icon">${icon("folder")}</span><span class="cell-stack"><strong>${escapeHTML(project.name)}</strong><small>项目编号 ${escapeHTML(project.project_id ?? "-")}</small></span></div></td>
        <td><span class="badge ${isPublic ? "badge-blue" : ""}">${isPublic ? "公开" : "私有"}</span></td>
        <td class="mono">${formatNumber(project.repo_count)}</td>
        <td>${autoScan ? '<span class="badge badge-green">已启用</span>' : '<span class="badge">未启用</span>'}</td>
        <td>${prevent ? '<span class="badge badge-green">已启用</span>' : '<span class="badge">未启用</span>'}</td>
        <td>${formatDate(project.update_time || project.creation_time)}</td>
        <td>${icon("chevron")}</td>
      </tr>`;
    }).join("")}
  </tbody></table>`;
}

async function renderRepositories(token, force = false) {
  const projects = asArray(state.cache.get("projects") || state.dashboard?.projects);
  const route = state.route || parseConsoleRoute();
  const key = "repository-assets";
  mainContent.innerHTML = repositoryAssetSkeleton();
  try {
    let repositories = state.cache.get(key);
    if (!repositories || force) {
      repositories = await loadRepositoryAssets(projects);
      state.cache.set(key, repositories);
    }
    if (token !== state.renderToken || state.currentView !== "repositories") return;
    renderRepositoryAssetContent(projects, asArray(repositories), route);
  } catch (error) {
    if (token === state.renderToken) renderError("镜像资产载入失败", error.message, "refresh-view");
  }
}

function repositoryAssetSkeleton() {
  return `${pageHeader("镜像资产", viewMeta.repositories.subtitle, refreshButton())}${demoBanner()}<section class="table-shell">${loadingRows(8)}</section>`;
}

async function loadRepositoryAssets(projects) {
  const assets = [];
  const failures = [];
  for (let offset = 0; offset < projects.length; offset += 4) {
    const batch = projects.slice(offset, offset + 4);
    const settled = await Promise.allSettled(batch.map((project) => loadProjectRepositoryAssets(project.name)));
    settled.forEach((result, index) => {
      if (result.status === "fulfilled") assets.push(...result.value);
      else failures.push(`${batch[index].name}: ${result.reason?.message || "读取失败"}`);
    });
  }
  if (!assets.length && failures.length) throw new Error(failures[0]);
  state.repositoryAssetWarnings = failures;
  return assets;
}

async function loadProjectRepositoryAssets(project) {
  const items = [];
  for (let page = 1; page <= 100; page += 1) {
    const result = await controlList("repositories", { project, page, page_size: 100, sort: "name" });
    items.push(...result.items.map((repository) => ({ ...repository, project_name: project })));
    if (items.length >= result.pagination.total || result.items.length < 100) break;
  }
  return items;
}

function renderRepositoryAssetContent(projects, repositories, route) {
  const term = String(route.filter || "").trim().toLowerCase();
  const projectFilter = route.projectFilter || "";
  const filtered = repositories.filter((repository) => {
    if (projectFilter && repository.project_name !== projectFilter) return false;
    return !term || String(repository.name || "").toLowerCase().includes(term) || String(repository.project_name || "").toLowerCase().includes(term);
  });
  filtered.sort(repositoryAssetComparator(route.repositorySort));
  const pageSize = route.repositoryPageSize || repositoryAssetDefaultPageSize;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(route.page || 1, totalPages);
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
	  const warnings = asArray(state.repositoryAssetWarnings);
	  const latestPushTime = window.HarborDates.latest(repositories.map((repository) => repository.update_time));
	  const repositoryContent = repositoryViewMode() === "card"
		? repositoryAssetCards(visible)
		: `<div class="table-scroll">${repositoryAssetTable(visible)}</div>`;
  mainContent.innerHTML = `
    ${pageHeader("镜像资产", viewMeta.repositories.subtitle, refreshButton())}${demoBanner()}
    ${warnings.length ? `<div class="warning-banner">${icon("alert")}<span><strong>${formatNumber(warnings.length)} 个项目读取失败。</strong> 其余项目资产仍可浏览。</span></div>` : ""}
    <section class="overview-stats repository-asset-stats" aria-label="镜像资产统计">
      ${statCell("镜像仓库", repositories.length, `${formatNumber(projects.length)} 个项目`, "package")}
      ${statCell("制品总数", repositories.reduce((sum, item) => sum + toNumber(item.artifact_count), 0), "跨项目统计", "database")}
      ${statCell("累计拉取", repositories.reduce((sum, item) => sum + toNumber(item.pull_count), 0), "Harbor 记录值", "history")}
      ${statCell("最近推送", latestPushTime ? formatDate(latestPushTime, false) : "暂无", "仓库更新时间", "upload", true)}
    </section>
    <section class="table-shell">
      <div class="table-toolbar repository-asset-toolbar">
        ${controlSearchForm("repository-asset-search", route.filter, "搜索项目或仓库")}
        <div class="toolbar-spacer"></div>
        <label class="toolbar-field"><span>项目</span><select id="repository-asset-project" class="toolbar-select"><option value="">全部项目</option>${projects.map((project) => `<option value="${escapeAttr(project.name)}" ${project.name === projectFilter ? "selected" : ""}>${escapeHTML(project.name)}</option>`).join("")}</select></label>
        <label class="toolbar-field"><span>排序</span><select id="repository-asset-sort" class="toolbar-select"><option value="-artifact_count" ${route.repositorySort === "-artifact_count" ? "selected" : ""}>制品最多</option><option value="-pull_count" ${route.repositorySort === "-pull_count" ? "selected" : ""}>拉取最多</option><option value="-update_time" ${route.repositorySort === "-update_time" ? "selected" : ""}>最近推送</option><option value="name" ${route.repositorySort === "name" ? "selected" : ""}>名称</option></select></label>
	        <label class="toolbar-field"><span>每页</span><select id="repository-asset-page-size" class="toolbar-select"><option value="20" ${pageSize === 20 ? "selected" : ""}>20 条</option><option value="50" ${pageSize === 50 ? "selected" : ""}>50 条</option><option value="100" ${pageSize === 100 ? "selected" : ""}>100 条</option></select></label>${repositoryViewToggle()}
	      </div>
	      ${repositoryContent}
      ${controlPagination({ page, page_size: pageSize, total: filtered.length })}
    </section>`;
  bindControlSearch("repository-asset-search", (value) => repositoryAssetRoute(1, value, pageSize, route.repositorySort, projectFilter));
  document.querySelector("#repository-asset-project")?.addEventListener("change", (event) => { location.hash = repositoryAssetRoute(1, route.filter, pageSize, route.repositorySort, event.target.value); });
  document.querySelector("#repository-asset-sort")?.addEventListener("change", (event) => { location.hash = repositoryAssetRoute(1, route.filter, pageSize, event.target.value, projectFilter); });
  document.querySelector("#repository-asset-page-size")?.addEventListener("change", (event) => { location.hash = repositoryAssetRoute(1, route.filter, Number(event.target.value), route.repositorySort, projectFilter); });
}

function projectOptions(projects, selected) {
  if (!projects.length) return '<option value="">暂无项目</option>';
  return projects.map((project) => `<option value="${escapeAttr(project.name)}" ${project.name === selected ? "selected" : ""}>${escapeHTML(project.name)}</option>`).join("");
}

function repositoryAssetComparator(sort) {
  if (sort === "name") return (left, right) => String(left.name || "").localeCompare(String(right.name || ""), currentLocale());
  if (sort === "-pull_count") return (left, right) => toNumber(right.pull_count) - toNumber(left.pull_count) || String(left.name || "").localeCompare(String(right.name || ""), currentLocale());
  if (sort === "-update_time") return (left, right) => window.HarborDates.compareDescending(left.update_time, right.update_time) || String(left.name || "").localeCompare(String(right.name || ""), currentLocale());
  return (left, right) => toNumber(right.artifact_count) - toNumber(left.artifact_count) || String(left.name || "").localeCompare(String(right.name || ""), currentLocale());
}

function repositoryAssetTable(repositories) {
  if (!repositories.length) return emptyTable("没有匹配的镜像资产", "调整项目或搜索条件后重试。", "package");
  return `<table><thead><tr><th>仓库</th><th>项目</th><th>制品数</th><th>拉取次数</th><th>创建时间</th><th>最近推送</th><th></th></tr></thead><tbody>
    ${repositories.map((repo) => `<tr class="clickable-row" data-action="control-open-repository" data-project="${escapeAttr(repo.project_name)}" data-repository="${escapeAttr(repo.name)}">
      <td><div class="cell-title"><span class="cell-icon">${icon("package")}</span><span class="cell-stack"><strong>${escapeHTML(repositoryDisplayName(repo.project_name, repo.name))}</strong><small class="mono">#${escapeHTML(repo.id ?? "-")}</small></span></div></td>
      <td><a href="${projectRoute(repo.project_name)}">${escapeHTML(repo.project_name)}</a></td>
      <td class="mono">${formatNumber(repo.artifact_count)}</td>
      <td class="mono">${formatNumber(repo.pull_count)}</td>
      <td>${formatDate(repo.creation_time)}</td>
      <td>${formatDate(repo.update_time)}</td>
      <td>${icon("chevron")}</td>
    </tr>`).join("")}
  </tbody></table>`;
}

function repositoryAssetCards(repositories) {
	if (!repositories.length) return emptyTable("没有匹配的镜像资产", "调整项目或搜索条件后重试。", "package");
	return `<div class="repository-card-grid repository-asset-card-grid">${repositories.map((repository) => `<article class="repository-card"><header><span class="cell-icon">${icon("package")}</span><div><button type="button" data-action="control-open-repository" data-project="${escapeAttr(repository.project_name)}" data-repository="${escapeAttr(repository.name)}">${escapeHTML(repositoryDisplayName(repository.project_name, repository.name))}</button><a href="${projectRoute(repository.project_name)}">${escapeHTML(repository.project_name)}</a></div><button class="icon-button" type="button" data-action="show-push-command" data-project="${escapeAttr(repository.project_name)}" data-repository="${escapeAttr(repository.name)}" title="推送指引" aria-label="查看推送指引">${icon("upload")}</button></header><p>${escapeHTML(repository.description || "暂无仓库描述")}</p><dl><div><dt>制品</dt><dd>${formatNumber(repository.artifact_count)}</dd></div><div><dt>累计拉取</dt><dd>${formatNumber(repository.pull_count)}</dd></div><div><dt>最近推送</dt><dd>${formatDate(repository.update_time)}</dd></div></dl></article>`).join("")}</div>`;
}

async function renderSecurity(token, force = false) {
  return renderSecurityHub(token, force);
}

function renderSecurityContent(projects, repositories, artifacts) {
  const summary = artifacts.reduce((totals, artifact) => {
    const scan = artifactScan(artifact);
    totals.critical += scan.counts.critical;
    totals.high += scan.counts.high;
    totals.medium += scan.counts.medium;
    totals.total += scan.total;
    if (scan.status === "Success") totals.scanned += 1;
    return totals;
  }, { critical: 0, high: 0, medium: 0, total: 0, scanned: 0 });
  const riskCount = document.querySelector("#risk-count");
  riskCount.textContent = summary.critical;
  riskCount.hidden = summary.critical === 0;
  mainContent.innerHTML = `
    ${pageHeader("制品安全", viewMeta.security.subtitle, refreshButton())}${demoBanner()}
    <section class="overview-stats" aria-label="漏洞统计">
      ${statCell("严重漏洞", summary.critical, "建议立即处理", "alert")}
      ${statCell("高危漏洞", summary.high, "纳入近期修复", "shield")}
      ${statCell("中危漏洞", summary.medium, "持续跟踪", "history")}
      ${statCell("已扫描制品", summary.scanned, `当前共 ${formatNumber(artifacts.length)} 个制品`, "package")}
    </section>
    <section class="table-shell">
      <div class="table-toolbar">
        <select id="security-project" class="toolbar-select" aria-label="选择项目">${projectOptions(projects, state.selectedProject)}</select>
        <select id="security-repository" class="toolbar-select" aria-label="选择仓库">${repositoryOptions(repositories, state.selectedRepository)}</select>
        <div class="toolbar-spacer"></div>
        <span class="muted">漏洞总计 ${formatNumber(summary.total)}</span>
      </div>
      <div class="table-scroll">${artifactTable(artifacts)}</div>
      ${tableFooter(artifacts.length, artifacts.length)}
    </section>`;
  document.querySelector("#security-project")?.addEventListener("change", (event) => {
    state.selectedProject = event.target.value;
    state.selectedRepository = "";
    renderCurrentView();
  });
  document.querySelector("#security-repository")?.addEventListener("change", (event) => {
    state.selectedRepository = event.target.value;
    renderCurrentView();
  });
}

function repositoryOptions(repositories, selected) {
  if (!repositories.length) return '<option value="">暂无仓库</option>';
  return repositories.map((repo) => `<option value="${escapeAttr(repo.name)}" ${repo.name === selected ? "selected" : ""}>${escapeHTML(repo.name)}</option>`).join("");
}

function artifactScan(artifact) {
	return artifactScanState(artifact, "vulnerability");
}

function artifactScanState(artifact, scanType = "vulnerability") {
	const overviewSource = scanType === "sbom" ? artifact.sbom_overview : artifact.scan_overview;
	const entries = Object.entries(asObject(overviewSource));
	const matchingEntry = entries.find(([mediaType]) => scanType === "sbom" ? true : /vulnerability\.report/i.test(mediaType));
	const selectedEntry = matchingEntry || (scanType === "vulnerability" ? entries[0] : null) || ["", {}];
	const overview = asObject(selectedEntry[1]);
	const summary = asObject(overview.summary);
	const countsRaw = asObject(summary.summary);
  const counts = {
    critical: toNumber(countsRaw.Critical ?? countsRaw.critical),
    high: toNumber(countsRaw.High ?? countsRaw.high),
    medium: toNumber(countsRaw.Medium ?? countsRaw.medium),
    low: toNumber(countsRaw.Low ?? countsRaw.low),
  };
	return {
		status: overview.scan_status || (entries.length ? "Pending" : "Not Scanned"),
		severity: overview.severity || "Unknown",
		reportId: overview.report_id || "",
		scanner: overview.scanner || "",
		mediaType: selectedEntry[0],
		counts,
		total: toNumber(summary.total) || Object.values(counts).reduce((sum, item) => sum + item, 0),
	};
}

function artifactPlatformValue(value) {
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  return "";
}

function normalizeArtifactPlatform(value) {
  const platform = asObject(value);
  return {
    os: artifactPlatformValue(platform.os),
    architecture: artifactPlatformValue(platform.architecture),
    variant: artifactPlatformValue(platform.variant),
    osVersion: artifactPlatformValue(platform["os.version"] ?? platform.os_version),
    osFeatures: asArray(platform["os.features"] ?? platform.os_features).map(artifactPlatformValue).filter(Boolean),
  };
}

function artifactPlatformLabel(platform) {
  const parts = [platform.os, platform.architecture, platform.variant].filter(Boolean);
  return parts.join("/") || "未知平台";
}

function artifactPlatformInfo(artifact) {
  const references = asArray(artifact?.references);
  const items = references.map((reference) => {
    const normalized = normalizeArtifactPlatform(asObject(reference).platform);
    return {
      ...normalized,
      digest: artifactPlatformValue(asObject(reference).child_digest),
    };
  });
  if (items.length) return { items, multi: true };

  const fallback = normalizeArtifactPlatform(artifact?.extra_attrs);
  if (!fallback.os && !fallback.architecture && !fallback.variant) return { items: [], multi: false };
  return { items: [{ ...fallback, digest: artifactPlatformValue(artifact?.digest) }], multi: false };
}

function artifactArchitectureSummary(artifact) {
  const info = artifactPlatformInfo(artifact);
  if (!info.items.length) return "暂无";
  if (info.multi) return `多架构 · ${formatNumber(info.items.length)} 个平台`;
  return artifactPlatformLabel(info.items[0]);
}

function artifactArchitectureCell(artifact) {
  const info = artifactPlatformInfo(artifact);
  if (!info.items.length) return '<span class="muted">暂无</span>';
  if (!info.multi) return `<span class="badge architecture-badge">${escapeHTML(artifactPlatformLabel(info.items[0]))}</span>`;
  const labels = info.items.map(artifactPlatformLabel);
  const preview = labels.slice(0, 2).join(" · ");
  const remaining = labels.length > 2 ? ` · 另 ${formatNumber(labels.length - 2)} 个` : "";
  return `<div class="architecture-cell"><span class="badge badge-blue">多架构 · ${formatNumber(labels.length)}</span><small title="${escapeAttr(labels.join(" · "))}">${escapeHTML(preview)}${escapeHTML(remaining)}</small></div>`;
}

function artifactTable(artifacts) {
  if (!artifacts.length) return emptyTable("暂无制品", "仓库中没有可显示的制品，或当前账号没有读取权限。", "package");
  return `<table><thead><tr><th>标签与摘要</th><th>架构</th><th>扫描状态</th><th>最高风险</th><th>严重</th><th>高危</th><th>大小</th><th>推送时间</th><th></th></tr></thead><tbody>
    ${artifacts.map((artifact) => {
      const scan = artifactScan(artifact);
      const tags = asArray(artifact.tags);
      const tag = tags[0]?.name || "无标签";
      return `<tr class="clickable-row" data-action="control-open-artifact" data-project="${escapeAttr(state.selectedProject)}" data-repository="${escapeAttr(state.selectedRepository)}" data-reference="${escapeAttr(artifact.digest)}">
        <td><div class="cell-title"><span class="cell-icon">${icon("package")}</span><span class="cell-stack"><strong>${escapeHTML(tag)}</strong><small class="mono" title="${escapeAttr(artifact.digest)}">${escapeHTML(shortDigest(artifact.digest))}</small></span></div></td>
        <td>${artifactArchitectureCell(artifact)}</td><td>${statusBadge(scan.status)}</td>
        <td>${severityBadge(scan.severity)}</td>
        <td class="mono">${formatNumber(scan.counts.critical)}</td>
        <td class="mono">${formatNumber(scan.counts.high)}</td>
        <td>${formatBytes(artifact.size)}</td>
        <td>${formatDate(artifact.push_time)}</td>
        <td><button class="icon-button" type="button" data-action="copy-digest" data-digest="${escapeAttr(artifact.digest)}" title="复制摘要" aria-label="复制摘要">${icon("copy")}</button></td>
      </tr>`;
    }).join("")}
  </tbody></table>`;
}

async function renderReplication(token, force = false) {
  mainContent.innerHTML = `${pageHeader("复制管理", viewMeta.replication.subtitle, refreshButton())}${demoBanner()}<section class="table-shell">${loadingRows()}</section>`;
  try {
    let policies = state.cache.get("replication-policies");
    let executions = state.cache.get("replications");
    if (!policies || !executions || force) {
      [policies, executions] = await Promise.all([
        api("/api/resources/replication-policies?page_size=50&sort=name"),
        api("/api/resources/replications?page_size=50&sort=-start_time"),
      ]);
      state.cache.set("replication-policies", asArray(policies));
      state.cache.set("replications", asArray(executions));
    }
    if (token !== state.renderToken || state.currentView !== "replication") return;
    renderReplicationContent(asArray(policies), asArray(executions));
  } catch (error) {
    if (token === state.renderToken) renderError("复制数据载入失败", error.message, "refresh-view");
  }
}

function renderReplicationContent(policies, executions) {
  mainContent.innerHTML = `
    ${pageHeader("复制管理", viewMeta.replication.subtitle, refreshButton())}${demoBanner()}
    <div class="split-sections">
      <section>
        <div class="section-heading"><div><h2>复制策略</h2><p>${formatNumber(policies.length)} 条策略</p></div><button class="button button-small" type="button" data-action="show-create-unavailable">${icon("plus")}<span>新建策略</span></button></div>
        <div class="table-shell"><div class="table-scroll">${policyTable(policies)}</div></div>
      </section>
      <section>
        <div class="section-heading"><div><h2>执行概况</h2><p>最近同步结果</p></div></div>
        <div class="overview-stats overview-stats-two-column no-bottom-margin">
          ${statCell("成功执行", executions.filter((item) => String(item.status).toLowerCase() === "succeed").length, "最近执行记录", "check")}
          ${statCell("失败执行", executions.filter((item) => String(item.status).toLowerCase() === "failed").length, "需要检查", "alert")}
        </div>
      </section>
    </div>
    <section class="section-block">
      <div class="section-heading"><div><h2>执行记录</h2><p>按开始时间倒序排列</p></div></div>
      <div class="table-shell"><div class="table-scroll">${replicationTable(executions, policies)}</div>${tableFooter(executions.length, executions.length)}</div>
    </section>`;
}

function policyTable(policies) {
  if (!policies.length) return emptyTable("暂无复制策略", "在 Harbor 中创建策略后会显示在这里。", "refresh");
  return `<table><thead><tr><th>策略</th><th>目标仓库</th><th>触发方式</th><th>状态</th></tr></thead><tbody>
    ${policies.map((policy) => `<tr>
      <td><div class="cell-title"><span class="cell-icon">${icon("refresh")}</span><span class="cell-stack"><strong>${escapeHTML(policy.name)}</strong><small>策略编号 ${escapeHTML(policy.id)}</small></span></div></td>
      <td>${escapeHTML(asObject(policy.dest_registry).name || "未配置")}</td>
      <td>${triggerLabel(asObject(policy.trigger).type)}</td>
      <td>${policy.enabled ? '<span class="badge badge-green">已启用</span>' : '<span class="badge">已停用</span>'}</td>
    </tr>`).join("")}
  </tbody></table>`;
}

function replicationTable(executions, policies = []) {
  if (!executions.length) return emptyTable("暂无复制记录", "策略执行后，同步结果会显示在这里。", "refresh");
  const policyNames = new Map(asArray(policies).map((policy) => [String(policy.id), policy.name]));
  return `<table><thead><tr><th>执行编号</th><th>策略</th><th>触发方式</th><th>状态</th><th>任务统计</th><th>开始时间</th><th>耗时</th></tr></thead><tbody>
    ${executions.map((item) => `<tr>
      <td><span class="mono">#${escapeHTML(item.id)}</span></td>
      <td>${escapeHTML(policyNames.get(String(item.policy_id)) || `策略 #${item.policy_id || "-"}`)}</td>
      <td>${triggerLabel(item.trigger)}</td>
      <td>${statusBadge(item.status)}</td>
      <td><span class="execution-counts"><b class="success-text">${formatNumber(item.succeed)}</b><b class="danger-text">${formatNumber(item.failed)}</b><span>${formatNumber(item.in_progress)}</span></span></td>
      <td>${formatDate(item.start_time)}</td>
      <td>${formatDuration(item.start_time, item.end_time)}</td>
    </tr>`).join("")}
  </tbody></table>`;
}

async function renderRegistries(token, force = false) {
  mainContent.innerHTML = `${pageHeader("镜像仓库", viewMeta.registries.subtitle, refreshButton())}${demoBanner()}<section class="table-shell">${loadingRows(4)}</section>`;
  try {
    let registries = state.cache.get("registries");
    if (!registries || force) {
      registries = asArray(await api("/api/resources/registries?page_size=50&sort=name"));
      state.cache.set("registries", registries);
    }
    if (token !== state.renderToken || state.currentView !== "registries") return;
    mainContent.innerHTML = `
      ${pageHeader("镜像仓库", viewMeta.registries.subtitle, `${refreshButton()}<button class="button button-small" type="button" data-action="show-create-unavailable">${icon("plus")}<span>新建连接</span></button>`)}${demoBanner()}
      ${registries.length ? `<section class="registry-grid">${registries.map(registryCard).join("")}</section>` : `<section class="panel">${emptyTable("暂无远端仓库", "添加远端仓库后，可用于镜像复制与代理缓存。", "database")}</section>`}`;
  } catch (error) {
    if (token === state.renderToken) renderError("镜像仓库载入失败", error.message, "refresh-view");
  }
}

function registryCard(registry) {
  return `<article class="registry-item">
    <div class="registry-top"><span class="registry-icon">${icon("database")}</span>${statusBadge(registry.status || "healthy")}</div>
    <h3>${escapeHTML(registry.name || "未命名仓库")}</h3>
    <span class="registry-url" title="${escapeAttr(registry.url)}">${escapeHTML(registry.url || "未配置地址")}</span>
    <div class="registry-meta"><span>${registryTypeLabel(registry.type)}</span><span>${formatDate(registry.creation_time, false)}</span></div>
  </article>`;
}

function registryTypeLabel(value) {
  const types = { harbor: "Harbor", "docker-hub": "Docker Hub", "docker-registry": "Docker Registry", "aws-ecr": "AWS ECR", "azure-acr": "Azure ACR", "google-gcr": "Google GCR", "ali-acr": "阿里云 ACR", "huawei-SWR": "华为云 SWR", "tencent-tcr": "腾讯云 TCR", "volcengine-cr": "火山引擎 CR", "github-ghcr": "GitHub GHCR", gitlab: "GitLab", quay: "Quay", "jfrog-artifactory": "JFrog Artifactory" };
  return types[value] || escapeHTML(value || "通用仓库");
}

async function renderAudit(token, force = false) {
  mainContent.innerHTML = `${pageHeader("审计日志", viewMeta.audit.subtitle, refreshButton())}${demoBanner()}<section class="table-shell">${loadingRows(7)}</section>`;
  try {
    const route = state.route || parseConsoleRoute();
    const query = auditControlQuery(route);
    const cachedEvents = state.cache.get("audit-log-events");
    const [collection, eventPayload] = await Promise.all([
      controlList("audit-logs", { page: route.page, page_size: route.pageSize, sort: "-op_time", q: query }),
      cachedEvents ? Promise.resolve(cachedEvents) : controlData("audit-log-events").catch(() => []),
    ]);
    if (token !== state.renderToken || state.currentView !== "audit") return;
    const events = asArray(eventPayload);
    state.cache.set("audit-log-events", events);
    renderAuditContent(collection, events, route);
  } catch (error) {
    if (token !== state.renderToken) return;
    const title = error.status === 403 ? "无权访问审计日志" : "审计日志载入失败";
    renderError(title, error.message, "refresh-view");
  }
}

function auditControlQuery(route) {
  const filters = [];
  if (route.username) filters.push(`username=~${auditQueryValue(route.username)}`);
  if (route.resource) filters.push(`resource=~${auditQueryValue(route.resource)}`);
  if (route.operation) filters.push(`operation=${auditQueryValue(route.operation)}`);
  if (route.result) filters.push(`op_result=${route.result === "success"}`);
  return filters.join(",");
}

function auditQueryValue(value) {
  const normalized = String(value || "").trim().slice(0, 200);
  if (/^[A-Za-z0-9_.@:/+\-]+$/.test(normalized)) return normalized;
  return `"${normalized.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

function renderAuditContent(collection, events, route) {
  const logs = asArray(collection.items);
  const activeFilters = Boolean(route.username || route.resource || route.operation || route.result);
  const knownOperations = [...new Set([
    ...events.map((event) => String(event.event_type || "")),
    ...logs.map((item) => String(item.operation || "")),
  ].filter(Boolean))].sort((left, right) => left.localeCompare(right));
  mainContent.innerHTML = `
    ${pageHeader("审计日志", viewMeta.audit.subtitle, refreshButton())}${demoBanner()}
    <section class="table-shell">
      <form id="audit-filter-form" class="table-toolbar audit-filter-form filter-toolbar">
        <div class="filter-toolbar-query">
          <div class="filter-toolbar-controls"><div class="toolbar-search">${icon("search")}<input name="username" type="search" maxlength="200" value="${escapeAttr(route.username)}" placeholder="用户名" aria-label="按用户名筛选"></div><div class="toolbar-search audit-resource-search">${icon("database")}<input name="resource" type="search" maxlength="200" value="${escapeAttr(route.resource)}" placeholder="资源名称" aria-label="按资源名称筛选"></div><label class="toolbar-field"><span>事件</span><select name="operation" class="toolbar-select"><option value="">全部事件</option>${knownOperations.map((operation) => `<option value="${escapeAttr(operation)}" ${operation === route.operation ? "selected" : ""}>${escapeHTML(auditEventLabel(operation))}</option>`).join("")}</select></label><label class="toolbar-field"><span>结果</span><select name="result" class="toolbar-select"><option value="" ${!route.result ? "selected" : ""}>全部结果</option><option value="success" ${route.result === "success" ? "selected" : ""}>成功</option><option value="failed" ${route.result === "failed" ? "selected" : ""}>失败</option></select></label></div>
          <div class="filter-toolbar-actions"><button class="button button-small button-primary" type="submit">${icon("search")}<span>筛选</span></button>${activeFilters ? `<button class="button button-small" type="button" data-action="clear-audit-filters">${icon("x")}<span>清除</span></button>` : ""}</div>
        </div>
        <div class="filter-toolbar-meta"><label class="toolbar-field"><span>每页</span><select id="audit-page-size" class="toolbar-select"><option value="20" ${route.pageSize === 20 ? "selected" : ""}>20 条</option><option value="50" ${route.pageSize === 50 ? "selected" : ""}>50 条</option><option value="100" ${route.pageSize === 100 ? "selected" : ""}>100 条</option></select></label></div>
      </form>
      <div class="table-scroll audit-table-scroll">${auditTable(logs, activeFilters)}</div>${controlPagination(collection.pagination)}
    </section>`;
  document.querySelector("#audit-filter-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    location.hash = auditRoute(1, {
      username: data.get("username"),
      resource: data.get("resource"),
      operation: data.get("operation"),
      result: data.get("result"),
    }, route.pageSize);
  });
  document.querySelector("#audit-page-size")?.addEventListener("change", (event) => { location.hash = auditRoute(1, route, Number(event.target.value)); });
}

function auditTable(logs, activeFilters = false) {
  if (!logs.length) return emptyTable(activeFilters ? "没有匹配的审计记录" : "暂无可见审计记录", activeFilters ? "调整筛选条件后重新查询。" : "当前 Harbor 实例没有返回该账号可见的审计记录。", "history");
  return `<table><thead><tr><th>时间</th><th>用户</th><th>事件</th><th>结果</th><th>资源类型</th><th>资源</th><th>记录编号</th></tr></thead><tbody>
    ${logs.map((item) => { const eventLabel = auditEventLabel(item.operation); const descriptionLabel = auditDescriptionLabel(item); return `<tr>
      <td class="audit-time">${formatAuditDate(item.op_time)}</td><td><strong>${escapeHTML(item.username || "系统")}</strong></td><td><span class="cell-stack"><span><span class="badge badge-blue audit-event-badge" title="${escapeAttr(eventLabel)}">${escapeHTML(eventLabel)}</span></span><small title="${escapeAttr(descriptionLabel)}">${escapeHTML(descriptionLabel)}</small></span></td>
      <td>${auditResultBadge(item.operation_result)}</td>
      <td>${resourceTypeLabel(item.resource_type)}</td><td><span class="mono">${escapeHTML(item.resource || "-")}</span></td><td class="mono">#${escapeHTML(item.id)}</td>
    </tr>`; }).join("")}
  </tbody></table>`;
}

function auditResultBadge(value) {
  if (value === true) return '<span class="badge badge-green">成功</span>';
  if (value === false) return '<span class="badge badge-red">失败</span>';
  return '<span class="badge">未记录</span>';
}

async function renderAbout(token, force = false) {
  mainContent.innerHTML = `${pageHeader("关于与 API", viewMeta.about.subtitle, refreshButton())}<section class="table-shell">${loadingRows(5)}</section>`;
  try {
    if (!state.about || force) state.about = await api("/api/about");
    if (token !== state.renderToken || state.currentView !== "about") return;
    renderAboutContent(state.about);
  } catch (error) {
    if (token === state.renderToken) renderError("产品信息载入失败", error.message, "refresh-view");
  }
}

function renderAboutContent(payload) {
  mainContent.innerHTML = `${pageHeader("关于与 API", viewMeta.about.subtitle, refreshButton())}${aboutProductInformation(payload)}`;
}

function currentHarborSwaggerURL() {
  if (state.session?.demo) return "";
  const instanceURL = safeURL(state.session?.instance_url);
  if (!instanceURL || !["http:", "https:"].includes(instanceURL.protocol)) return "";
  instanceURL.pathname = `${instanceURL.pathname.replace(/\/+$/, "")}/devcenter-api-2.0/`.replace(/\/{2,}/g, "/");
  instanceURL.search = "";
  instanceURL.hash = "";
  return instanceURL.toString();
}

function aboutProductInformation(payload) {
  const consoleInfo = asObject(payload.console);
  const harbor = asObject(payload.harbor);
  const license = asObject(harbor.license);
  const system = asObject(state.dashboard?.systeminfo);
  const swaggerURL = currentHarborSwaggerURL();
  const swaggerAction = swaggerURL
    ? `<a class="button button-small button-primary" href="${escapeAttr(swaggerURL)}" target="_blank" rel="noopener noreferrer">${icon("external")}<span>打开官方 Swagger</span></a>`
    : `<button class="button button-small" type="button" disabled>${icon("external")}<span>打开官方 Swagger</span></button>`;
  const swaggerAddress = swaggerURL
    ? `<code class="about-swagger-url">${escapeHTML(swaggerURL)}</code>`
    : `<span class="about-swagger-unavailable">当前为演示实例，连接真实 Harbor 后可打开其官方 Swagger。</span>`;
  return `<div class="about-layout"><section class="about-product-band"><div class="about-product-mark">H</div><div><span class="eyebrow">Harbor 控制台</span><h2>私有镜像仓库控制端</h2><p>Go 单二进制部署，前端资源全部内嵌，使用 Harbor API v2.0 驱动控制功能。</p></div><span class="badge badge-green">纯内网可用</span></section><div class="about-grid"><section class="panel"><div class="panel-head"><div><h2>版本信息</h2><p>当前控制端与 Harbor 实例</p></div></div><dl class="definition-list">${definitionRow("控制端版本", consoleInfo.version || "开发版")}${definitionRow("当前 Harbor", system.harbor_version || "未知")}${definitionRow("目标兼容版本", harbor.target_version || "v2.15.2")}${definitionRow("API 版本", harbor.api_version || "v2.0")}</dl></section><section class="panel"><div class="panel-head"><div><h2>许可证</h2><p>Harbor 上游项目信息</p></div></div><dl class="definition-list">${definitionRow("许可证名称", license.name || "Apache License 2.0")}${definitionRow("SPDX 标识", license.spdx || "Apache-2.0")}${definitionRow("运行方式", consoleInfo.deployment === "single-binary" ? "Go 单二进制" : consoleInfo.deployment || "未知")}${definitionRow("外部前端依赖", consoleInfo.offline ? "无" : "未知")}</dl></section></div><section class="about-contract"><div><h2>Harbor 官方 Swagger</h2><p>在新标签页中查看当前 Harbor 实例提供的完整 API 文档。</p>${swaggerAddress}</div>${swaggerAction}</section></div>`;
}

async function renderSystem(token, force = false) {
  mainContent.innerHTML = `${pageHeader("系统状态", viewMeta.system.subtitle, refreshButton())}${demoBanner()}<section class="table-shell">${loadingRows()}</section>`;
  try {
    let volumes = state.cache.get("volumes");
    if (!volumes || force) {
      volumes = await api("/api/resources/volumes");
      state.cache.set("volumes", volumes);
    }
    if (token !== state.renderToken || state.currentView !== "system") return;
    renderSystemContent(volumes);
  } catch (error) {
    if (token === state.renderToken) renderSystemContent(null, error.message);
  }
}

function renderSystemContent(volumes, volumeError = "") {
  const system = asObject(state.dashboard?.systeminfo);
  const health = asObject(state.dashboard?.health);
  const components = asArray(health.components);
  const officialVolumes = asArray(asObject(volumes).storage);
  const legacyVolumes = asArray(volumes).flatMap((item) => {
    const storage = asObject(item).storage;
    return Array.isArray(storage) ? storage : Object.keys(asObject(storage)).length ? [storage] : [];
  });
  const volumeItems = officialVolumes.length ? officialVolumes : legacyVolumes;
  const total = volumeItems.reduce((sum, item) => sum + Math.max(0, toNumber(asObject(item).total)), 0);
  const free = volumeItems.reduce((sum, item) => sum + Math.max(0, toNumber(asObject(item).free)), 0);
  const used = Math.max(0, total - free);
  const percent = total ? Math.min(100, used / total * 100) : 0;
  const hasCapacity = total > 0;
  mainContent.innerHTML = `
    ${pageHeader("系统状态", viewMeta.system.subtitle, refreshButton())}${demoBanner()}${warningBanners()}
    <div class="system-grid">
      <section class="panel">
        <div class="panel-head"><div><h2>实例信息</h2><p>Harbor 运行配置</p></div>${statusBadge(health.status)}</div>
        <dl class="definition-list">
          ${definitionRow("Harbor 版本", system.harbor_version || "未知")}
          ${definitionRow("认证方式", authModeLabel(system.auth_mode))}
          ${definitionRow("镜像域名", system.registry_url || safeURL(state.session.instance_url)?.host || "未知")}
          ${definitionRow("项目创建", system.project_creation_restriction === "adminonly" ? "仅管理员" : "所有用户")}
          ${definitionRow("自助注册", system.self_registration ? "已启用" : "未启用")}
          ${definitionRow("只读模式", system.read_only ? "已启用" : "未启用")}
        </dl>
      </section>
      <section class="panel">
        <div class="panel-head"><div><h2>核心组件</h2><p>${formatNumber(components.length)} 个服务</p></div></div>
        <div class="component-list">${components.length ? components.map((item) => `<div class="component-row"><span>${componentLabel(item.name)}</span>${statusBadge(item.status)}</div>`).join("") : emptyInline("当前账号无法读取组件详情")}</div>
      </section>
      <section class="panel">
        <div class="panel-head"><div><h2>存储容量</h2><p>制品存储后端</p></div></div>
        ${volumeError ? `<div class="warning-banner warning-banner-inset">${icon("alert")}<span>${escapeHTML(volumeError)}</span></div>` : hasCapacity ? `<div class="volume-meter"><div class="volume-value"><strong>${formatBytes(used)}</strong><span>总容量 ${formatBytes(total)}</span></div><progress class="volume-track" max="100" value="${escapeAttr(percent.toFixed(1))}" aria-label="存储空间已使用 ${escapeAttr(percent.toFixed(1))}%">${escapeHTML(percent.toFixed(1))}%</progress><p class="muted">已使用 ${percent.toFixed(1)}%，剩余 ${formatBytes(free)}</p></div>` : `<div class="warning-banner warning-banner-inset">${icon("alert")}<span>Harbor 未返回本地存储容量；使用外部对象存储时属于正常情况。</span></div>`}
      </section>
      <section class="panel">
        <div class="panel-head"><div><h2>连接会话</h2><p>控制台本地会话信息</p></div></div>
        <dl class="definition-list">
          ${definitionRow("当前用户", state.session.username)}
          ${definitionRow("实例地址", state.session.instance_url)}
          ${definitionRow("连接类型", state.session.demo ? "演示会话" : "真实实例")}
          ${definitionRow("会话到期", formatDate(state.session.expires_at))}
        </dl>
      </section>
    </div>`;
}

function definitionRow(label, value) {
  return `<div><dt>${escapeHTML(label)}</dt><dd title="${escapeAttr(value)}">${escapeHTML(value)}</dd></div>`;
}

function componentLabel(value) {
  const labels = { core: "核心服务", database: "数据库", jobservice: "任务服务", registry: "镜像注册服务", redis: "Redis 缓存", portal: "门户服务", registryctl: "注册控制器" };
  return labels[String(value || "").toLowerCase()] || escapeHTML(value || "未知组件");
}

function tableFooter(visible, total) {
  return `<div class="table-footer"><span>显示 ${formatNumber(visible)} 条，共 ${formatNumber(total)} 条</span><div class="pager"><button type="button" disabled aria-label="上一页">${icon("arrow-left")}</button><button type="button" disabled aria-label="下一页">${icon("arrow-right")}</button></div></div>`;
}

function emptyTable(title, message, iconName) {
  return `<div class="empty-state"><div><span class="state-icon">${icon(iconName)}</span><h2>${escapeHTML(title)}</h2><p>${escapeHTML(message)}</p></div></div>`;
}

function loadingRows(count = 6) {
  return `<div class="loading-rows" aria-label="正在载入">${Array.from({ length: count }, (_, index) => `<div class="skeleton-line skeleton-line-${index % 3}"></div>`).join("")}</div>`;
}

function renderLoading(title, message) {
  mainContent.innerHTML = `<div class="loading-state"><div><div class="spinner"></div><h2>${escapeHTML(title)}</h2><p>${escapeHTML(message)}</p></div></div>`;
}

function renderError(title, message, action) {
  mainContent.innerHTML = `<div class="error-state"><div><span class="state-icon">${icon("alert")}</span><h2>${escapeHTML(title)}</h2><p>${escapeHTML(message)}</p><button class="button button-small" type="button" data-action="${escapeAttr(action)}">${icon("refresh")}<span>重新尝试</span></button></div></div>`;
}

async function refreshDashboard() {
  renderLoading("正在刷新实例数据", "重新读取 Harbor 项目、任务与系统状态...");
  try {
    state.dashboard = await api("/api/dashboard");
    state.cache.clear();
    state.cache.set("projects", asArray(state.dashboard.projects));
    renderSessionChrome();
    renderCurrentView(true);
    showToast("实例数据已刷新");
  } catch (error) {
    renderError("刷新失败", error.message, "refresh-dashboard");
  }
}

function bindStaticEvents() {
  connectForm.addEventListener("submit", connectInstance);
  document.querySelector("#demo-button").addEventListener("click", enterDemo);
	document.querySelector("#public-catalog-button")?.addEventListener("click", openPublicCatalog);
	document.querySelector("#public-catalog-search")?.addEventListener("submit", submitPublicCatalogSearch);
  window.addEventListener("harbor:before-language-reload", savePublicCatalogReloadState);
  window.addEventListener("hashchange", handleRoute);
  window.addEventListener("popstate", handlePublicCatalogPopState);
  document.addEventListener("click", handleDocumentClick);
  document.addEventListener("input", handleHarborAddressInput);
  document.addEventListener("keydown", handleKeyboard);
  document.querySelector("#global-search-button").addEventListener("click", openSearch);
  searchInput.addEventListener("input", handleSearchInput);
  searchDialog.addEventListener("click", (event) => {
    if (event.target === searchDialog) closeSearch();
  });
}

async function connectInstance(event) {
  event.preventDefault();
  const submit = document.querySelector("#connect-submit");
  const formData = new FormData(connectForm);
  const payload = {
    url: harborURLFromFormData(formData),
    username: String(formData.get("username") || "").trim(),
    password: String(formData.get("password") || ""),
    skip_tls_verify: formData.get("skip_tls_verify") === "on",
  };
  if (!payload.url || !payload.username || !payload.password) {
    showConnectError("请完整填写 Harbor 地址、用户名和密码。");
    return;
  }
  submit.disabled = true;
  submit.innerHTML = `<span>正在验证连接...</span><span class="spinner spinner-small"></span>`;
  connectError.hidden = true;
  try {
    state.session = await api("/api/connect", { method: "POST", body: JSON.stringify(payload) });
    connectForm.reset();
    location.hash = "#/overview";
    await enterConsole();
  } catch (error) {
    showConnectError(error.message);
  } finally {
    submit.disabled = false;
    submit.innerHTML = `<span>连接实例</span>${icon("arrow-right")}`;
  }
}

function harborURLFromFormData(formData) {
  const address = String(formData.get("address") || formData.get("url") || "").trim();
  if (!address) return "";
  if (/^https?:\/\//i.test(address)) return address;
  const protocol = formData.get("protocol") === "http" ? "http" : "https";
  return `${protocol}://${address.replace(/^\/+/, "")}`;
}

function handleHarborAddressInput(event) {
  const input = event.target.closest?.("[data-harbor-address]");
  if (!input) return;
  const match = input.value.trimStart().match(/^(https?):\/\/(.*)$/i);
  if (!match) return;
  const protocol = input.closest(".url-input-group")?.querySelector('[name="protocol"]');
  if (protocol) protocol.value = match[1].toLowerCase();
  input.value = match[2];
}

async function enterDemo() {
  const button = document.querySelector("#demo-button");
  button.disabled = true;
  button.textContent = "正在准备演示...";
  connectError.hidden = true;
  try {
    state.session = await api("/api/demo", { method: "POST", body: "{}" });
    location.hash = "#/overview";
    await enterConsole();
  } catch (error) {
    showConnectError(error.message);
  } finally {
    button.disabled = false;
    button.textContent = "使用演示数据预览";
  }
}

async function openPublicCatalog() {
  const formData = new FormData(connectForm);
  const url = harborURLFromFormData(formData);
  if (!url) {
    showConnectError("请先填写需要浏览的 Harbor 地址。");
    return;
  }
  state.publicCatalog = {
    url,
    skip_tls_verify: formData.has("skip_tls_verify"),
    level: "projects",
    project: "",
    repository: "",
    page: 1,
    page_size: 20,
    query: "",
    depth: 0,
  };
  pushPublicCatalogHistory();
  sessionStorage.removeItem(publicCatalogReloadKey);
  loginView.hidden = true;
  appView.hidden = true;
  publicCatalogView.hidden = false;
  connectError.hidden = true;
  document.title = `${translateUI("公开镜像目录")} · ${translateUI("Harbor 控制台")}`;
  await loadPublicCatalogPage(1, { replaceHistory: false });
}

function closePublicCatalog() {
  const catalogHistory = readPublicCatalogHistoryState(history.state);
  if (catalogHistory?.depth > 0) {
    leavePublicCatalogView();
    history.go(-catalogHistory.depth);
    return;
  }
  removePublicCatalogHistoryState();
  leavePublicCatalogView();
}

function leavePublicCatalogView() {
  sessionStorage.removeItem(publicCatalogReloadKey);
  state.publicCatalog = null;
  publicCatalogView.hidden = true;
  appView.hidden = true;
  loginView.hidden = false;
  document.title = `${translateUI("连接实例")} · ${translateUI("Harbor 控制台")}`;
  window.setTimeout(() => document.querySelector("#instance-address")?.focus(), 20);
}

function normalizePublicCatalogState(value) {
  const saved = asObject(value);
  const parsedURL = safeURL(saved.url);
  const levels = new Set(["projects", "repositories", "artifacts"]);
  if (!parsedURL || !["http:", "https:"].includes(parsedURL.protocol) || !levels.has(saved.level)) return null;

  let project = String(saved.project || "").slice(0, 255);
  let repository = String(saved.repository || "").slice(0, 1024);
  if (saved.level === "projects") {
    project = "";
    repository = "";
  } else if (!project) {
    return null;
  }
  if (saved.level === "repositories") repository = "";
  if (saved.level === "artifacts" && !repository) return null;

  return {
    url: parsedURL.toString().replace(/\/$/, ""),
    skip_tls_verify: Boolean(saved.skip_tls_verify),
    level: saved.level,
    project,
    repository,
    page: Math.max(1, Math.min(1_000_000, Number(saved.page) || 1)),
    page_size: Math.max(1, Math.min(100, Number(saved.page_size) || 20)),
    query: String(saved.query || "").slice(0, 255),
    depth: Math.max(0, Math.min(1_000_000, Number(saved.depth) || 0)),
  };
}

function publicCatalogHistoryState(catalog) {
  return normalizePublicCatalogState(catalog);
}

function readPublicCatalogHistoryState(value) {
  return normalizePublicCatalogState(asObject(value)[publicCatalogHistoryKey]);
}

function writePublicCatalogHistory(method) {
  const catalog = publicCatalogHistoryState(state.publicCatalog);
  if (!catalog) return;
  history[method]({ ...asObject(history.state), [publicCatalogHistoryKey]: catalog }, "", location.href);
}

function pushPublicCatalogHistory() {
  if (!state.publicCatalog) return;
  state.publicCatalog.depth = Math.max(0, Number(state.publicCatalog.depth) || 0) + 1;
  writePublicCatalogHistory("pushState");
}

function replacePublicCatalogHistory() {
  writePublicCatalogHistory("replaceState");
}

function removePublicCatalogHistoryState() {
  const nextState = { ...asObject(history.state) };
  if (!(publicCatalogHistoryKey in nextState)) return;
  delete nextState[publicCatalogHistoryKey];
  history.replaceState(Object.keys(nextState).length ? nextState : null, "", location.href);
}

async function handlePublicCatalogPopState(event) {
  const catalog = readPublicCatalogHistoryState(event.state);
  if (!catalog) {
    if (state.publicCatalog) leavePublicCatalogView();
    return;
  }

  sessionStorage.removeItem(publicCatalogReloadKey);
  state.publicCatalog = catalog;
  populateConnectFormFromPublicCatalog(catalog);
  loginView.hidden = true;
  appView.hidden = true;
  publicCatalogView.hidden = false;
  connectError.hidden = true;
  document.title = `${translateUI("公开镜像目录")} · ${translateUI("Harbor 控制台")}`;
  await loadPublicCatalogPage(catalog.page, { replaceHistory: false });
}

function savePublicCatalogReloadState() {
  if (!state.publicCatalog) {
    sessionStorage.removeItem(publicCatalogReloadKey);
    return;
  }
  const catalog = state.publicCatalog;
  sessionStorage.setItem(publicCatalogReloadKey, JSON.stringify({
    url: catalog.url,
    skip_tls_verify: Boolean(catalog.skip_tls_verify),
    level: catalog.level,
    project: catalog.project,
    repository: catalog.repository,
    page: catalog.page,
    page_size: catalog.page_size,
    query: catalog.query,
    depth: catalog.depth,
  }));
}

function restorePublicCatalogReloadState() {
  const historyCatalog = readPublicCatalogHistoryState(history.state);
  const raw = sessionStorage.getItem(publicCatalogReloadKey);
  sessionStorage.removeItem(publicCatalogReloadKey);
  if (historyCatalog) return historyCatalog;
  if (!raw) return null;
  try {
    const catalog = normalizePublicCatalogState(JSON.parse(raw));
    if (catalog) catalog.depth = 0;
    return catalog;
  } catch {
    return null;
  }
}

function populateConnectFormFromPublicCatalog(catalog) {
  const parsed = safeURL(catalog?.url);
  if (!parsed) return;
  const protocol = connectForm.elements.namedItem("protocol");
  const address = connectForm.elements.namedItem("address");
  const skipTLS = connectForm.elements.namedItem("skip_tls_verify");
  if (protocol) protocol.value = parsed.protocol.replace(":", "");
  if (address) address.value = `${parsed.host}${parsed.pathname === "/" ? "" : parsed.pathname}`;
  if (skipTLS) skipTLS.checked = Boolean(catalog.skip_tls_verify);
}

function submitPublicCatalogSearch(event) {
  event.preventDefault();
  if (!state.publicCatalog) return;
  const data = new FormData(event.currentTarget);
  state.publicCatalog.query = String(data.get("query") || "").trim();
  loadPublicCatalogPage(1);
}

function navigatePublicCatalog(level) {
  if (!state.publicCatalog) return;
  state.publicCatalog.level = level;
  state.publicCatalog.page = 1;
  state.publicCatalog.query = "";
  if (level === "projects") {
    state.publicCatalog.project = "";
    state.publicCatalog.repository = "";
  } else if (level === "repositories") {
    state.publicCatalog.repository = "";
  }
  pushPublicCatalogHistory();
  loadPublicCatalogPage(1, { replaceHistory: false });
}

function openPublicProject(project) {
  if (!state.publicCatalog || !project) return;
  state.publicCatalog.level = "repositories";
  state.publicCatalog.project = project;
  state.publicCatalog.repository = "";
  state.publicCatalog.query = "";
  pushPublicCatalogHistory();
  loadPublicCatalogPage(1, { replaceHistory: false });
}

function openPublicRepository(repository) {
  if (!state.publicCatalog || !repository) return;
  state.publicCatalog.level = "artifacts";
  state.publicCatalog.repository = repository;
  state.publicCatalog.query = "";
  pushPublicCatalogHistory();
  loadPublicCatalogPage(1, { replaceHistory: false });
}

async function loadPublicCatalogPage(page = 1, options = {}) {
  const catalog = state.publicCatalog;
  const output = document.querySelector("#public-catalog-content");
  if (!catalog || !output) return;
  catalog.page = Math.max(1, Number(page) || 1);
  if (options.replaceHistory !== false) replacePublicCatalogHistory();
  renderPublicCatalogChrome();
  output.innerHTML = loadingRows(7);
  const endpoints = { projects: "/api/public/projects", repositories: "/api/public/repositories", artifacts: "/api/public/artifacts" };
  try {
    const result = await api(endpoints[catalog.level], {
      method: "POST",
      body: JSON.stringify({
        url: catalog.url,
        skip_tls_verify: catalog.skip_tls_verify,
        project: catalog.project,
        repository: catalog.repository,
        page: catalog.page,
        page_size: catalog.page_size,
        query: catalog.query,
      }),
    });
    if (catalog !== state.publicCatalog || output !== document.querySelector("#public-catalog-content")) return;
    const items = asArray(result?.items);
    const pagination = asObject(result?.pagination);
    output.innerHTML = `${renderPublicCatalogItems(catalog.level, items)}${publicCatalogPagination({ page: catalog.page, page_size: catalog.page_size, total: toNumber(pagination.total) })}`;
  } catch (error) {
    if (catalog !== state.publicCatalog) return;
    output.innerHTML = `<div class="error-state public-catalog-error"><div><span class="state-icon">${icon("alert")}</span><h2>公开目录载入失败</h2><p>${escapeHTML(error.message)}</p><button class="button button-small" type="button" data-action="public-catalog-page" data-page="${catalog.page}">${icon("refresh")}<span>重新尝试</span></button></div></div>`;
  }
}

function renderPublicCatalogChrome() {
  const catalog = state.publicCatalog;
  if (!catalog) return;
  const parsed = safeURL(catalog.url);
  const host = parsed?.host || catalog.url;
  const titles = { projects: "公开项目", repositories: catalog.project, artifacts: publicRepositoryName(catalog.repository) };
  const descriptions = {
    projects: `${host} · 仅显示 Harbor 标记为公开的项目`,
    repositories: `项目 ${catalog.project} 中可匿名拉取的镜像仓库`,
    artifacts: `${catalog.repository} 中可匿名读取的制品与 Tag`,
  };
  document.querySelector("#public-catalog-title").textContent = titles[catalog.level];
  document.querySelector("#public-catalog-subtitle").textContent = descriptions[catalog.level];
  const searchForm = document.querySelector("#public-catalog-search");
  searchForm.hidden = catalog.level === "artifacts";
  const input = searchForm.elements.namedItem("query");
  input.value = catalog.query;
  input.placeholder = translateUI(catalog.level === "projects" ? "搜索公开项目" : "搜索镜像仓库");
  document.querySelector("#public-catalog-breadcrumb").innerHTML = `<button type="button" data-action="public-catalog-root">公开项目</button>${catalog.project ? `${icon("chevron")}<button type="button" data-action="public-catalog-project">${escapeHTML(catalog.project)}</button>` : ""}${catalog.repository ? `${icon("chevron")}<span>${escapeHTML(publicRepositoryName(catalog.repository))}</span>` : ""}`;
}

function renderPublicCatalogItems(level, items) {
  if (level === "projects") {
    if (!items.length) return emptyTable("没有公开项目", "当前 Harbor 实例没有返回可匿名访问的项目。", "folder");
    return `<div class="table-scroll"><table><thead><tr><th>项目</th><th>所有者</th><th>仓库</th><th>创建时间</th><th></th></tr></thead><tbody>${items.map((project) => `<tr class="clickable-row" data-action="open-public-project" data-project="${escapeAttr(project.name)}"><td><div class="cell-title"><span class="cell-icon">${icon("folder")}</span><span class="cell-stack"><strong>${escapeHTML(project.name)}</strong><small>${escapeHTML(project.registry_id ? "镜像代理项目" : "公开访问")}</small></span></div></td><td>${escapeHTML(project.owner_name || "-")}</td><td>${formatNumber(project.repo_count)}</td><td>${formatDate(project.creation_time)}</td><td><button class="icon-button" type="button" data-action="open-public-project" data-project="${escapeAttr(project.name)}" title="打开公开项目" aria-label="打开公开项目">${icon("chevron")}</button></td></tr>`).join("")}</tbody></table></div>`;
  }
  if (level === "repositories") {
    if (!items.length) return emptyTable("没有公开仓库", "该项目当前没有可匿名读取的镜像仓库。", "package");
    return `<div class="table-scroll"><table><thead><tr><th>公开仓库</th><th>制品</th><th>拉取</th><th>最近推送</th><th></th></tr></thead><tbody>${items.map((repository) => `<tr class="clickable-row" data-action="open-public-repository" data-repository="${escapeAttr(repository.name)}"><td><div class="cell-title"><span class="cell-icon">${icon("package")}</span><span class="cell-stack"><strong>${escapeHTML(publicRepositoryName(repository.name))}</strong><small>${escapeHTML(repository.description || repository.name)}</small></span></div></td><td>${formatNumber(repository.artifact_count)}</td><td>${formatNumber(repository.pull_count)}</td><td>${formatDate(repository.update_time)}</td><td><button class="icon-button" type="button" data-action="open-public-repository" data-repository="${escapeAttr(repository.name)}" title="查看公开制品" aria-label="查看公开制品">${icon("chevron")}</button></td></tr>`).join("")}</tbody></table></div>`;
  }
  if (!items.length) return emptyTable("没有公开制品", "该仓库当前没有可匿名读取的制品。", "package");
  return `<div class="table-scroll"><table><thead><tr><th>Tag / 摘要</th><th>架构</th><th>风险</th><th>大小</th><th>推送时间</th><th>拉取</th></tr></thead><tbody>${items.map((artifact) => { const tags = asArray(artifact.tags); const tag = tags[0]?.name || ""; const command = tag ? publicPullCommand(state.publicCatalog, tag) : ""; return `<tr><td><span class="cell-stack"><strong>${tags.length ? tags.slice(0, 3).map((item) => `<span class="badge">${escapeHTML(item.name)}</span>`).join(" ") : "无 Tag"}</strong><small class="mono" title="${escapeAttr(artifact.digest)}">${escapeHTML(shortDigest(artifact.digest))}</small></span></td><td>${publicArtifactArchitecture(artifact)}</td><td>${severityBadge(publicArtifactSeverity(artifact))}</td><td>${formatBytes(artifact.size)}</td><td>${formatDate(artifact.push_time)}</td><td>${command ? `<button class="button button-small" type="button" data-action="copy-public-pull" data-value="${escapeAttr(command)}">${icon("copy")}<span>复制拉取命令</span></button>` : "-"}</td></tr>`; }).join("")}</tbody></table></div>`;
}

function publicRepositoryName(value) {
  const name = String(value || "");
  const prefix = `${state.publicCatalog?.project || ""}/`;
  return prefix !== "/" && name.startsWith(prefix) ? name.slice(prefix.length) : name;
}

function publicArtifactArchitecture(artifact) {
  const references = asArray(artifact.references);
  const mediaType = String(artifact.manifest_media_type || "");
  if (references.length || mediaType.includes("index") || mediaType.includes("manifest.list")) return `<span class="badge badge-blue">多架构 · ${formatNumber(references.length || 1)}</span>`;
  const extra = asObject(artifact.extra_attrs);
  return `<span class="badge">${escapeHTML([extra.os, extra.architecture].filter(Boolean).join("/") || "未知")}</span>`;
}

function publicArtifactSeverity(artifact) {
  const reports = Object.values(asObject(artifact.scan_overview)).map(asObject);
  const order = ["Critical", "High", "Medium", "Low", "None"];
  for (const severity of order) if (reports.some((report) => String(report.severity).toLowerCase() === severity.toLowerCase())) return severity;
  return "Unknown";
}

function publicPullCommand(catalog, tag) {
  const host = safeURL(catalog?.url)?.host || "";
  return host && catalog?.repository ? `${commandRuntime()} pull ${host}/${catalog.repository}:${tag}` : "";
}

async function copyPublicPullCommand(value) {
  if (!value) return;
  try {
    await navigator.clipboard.writeText(value);
    showToast("拉取命令已复制");
  } catch {
    showToast("浏览器未允许复制，请手动复制拉取命令。", true);
  }
}

function publicCatalogPagination(pagination) {
  const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.page_size));
  if (pagination.total <= pagination.page_size && pagination.page <= 1) return "";
  return `<div class="control-pagination"><span>第 ${formatNumber(pagination.page)} / ${formatNumber(totalPages)} 页，共 ${formatNumber(pagination.total)} 项</span><div class="pagination-buttons"><button class="icon-button" type="button" data-action="public-catalog-page" data-page="${pagination.page - 1}" ${pagination.page <= 1 ? "disabled" : ""} title="上一页" aria-label="上一页">${icon("arrow-left")}</button><button class="icon-button" type="button" data-action="public-catalog-page" data-page="${pagination.page + 1}" ${pagination.page >= totalPages ? "disabled" : ""} title="下一页" aria-label="下一页">${icon("arrow-right")}</button></div></div>`;
}

function showConnectError(message) {
  connectError.textContent = message;
  connectError.hidden = false;
}

async function logout() {
  try {
    await api("/api/session", { method: "DELETE" });
  } catch {
    // Clearing the local UI is still correct when the session already expired.
  }
  history.replaceState(null, "", location.pathname);
  showLogin();
}

function handleDocumentClick(event) {
  const actionTarget = event.target.closest("[data-action]");
  const goTarget = event.target.closest("[data-go]");
  if (goTarget) {
    location.hash = `#/${goTarget.dataset.go}`;
    return;
  }
  if (!actionTarget) {
    if (!event.target.closest("#notice-panel") && !event.target.closest(".notification-button") && !event.target.closest(".instance-button") && !event.target.closest(".account-button")) noticePanel.hidden = true;
    return;
  }
  if (actionTarget.matches("a")) event.preventDefault();
  const action = actionTarget.dataset.action;
  if (typeof handleControlAction === "function" && handleControlAction(actionTarget, action, event)) return;
  const actions = {
    logout,
    "open-menu": openMobileMenu,
    "close-menu": closeMobileMenu,
    "close-search": closeSearch,
    "toggle-theme": toggleTheme,
    "refresh-dashboard": refreshDashboard,
    "refresh-view": () => state.currentView === "projects" ? refreshDashboard() : renderCurrentView(true),
	    "show-notifications": showOperationCenter,
		"show-account": showAccountMenu,
		"edit-account-profile": showAccountProfileDialog,
		"change-account-password": showAccountPasswordDialog,
		"change-account-cli-secret": showAccountCLISecretDialog,
		"show-preferences": showPreferencesDialog,
		"view-operation": () => showOperationDetails(actionTarget.dataset.id),
		"clear-completed-operations": clearCompletedOperations,
	"open-about": () => { noticePanel.hidden = true; location.hash = "#/about"; },
	"close-public-catalog": closePublicCatalog,
	"open-public-project": () => openPublicProject(actionTarget.dataset.project),
	"open-public-repository": () => openPublicRepository(actionTarget.dataset.repository),
	"public-catalog-root": () => navigatePublicCatalog("projects"),
	"public-catalog-project": () => navigatePublicCatalog("repositories"),
	"public-catalog-page": () => loadPublicCatalogPage(toNumber(actionTarget.dataset.page)),
	"copy-public-pull": () => copyPublicPullCommand(actionTarget.dataset.value),
	  "show-instance": showInstanceMenu,
	  "dismiss-harbor-banner": dismissHarborBanner,
    "add-instance": showAddInstanceDialog,
    "add-demo-instance": addDemoInstance,
    "switch-instance": () => switchInstance(actionTarget.dataset.id),
    "remove-instance": () => confirmRemoveInstance(actionTarget.dataset.id),
    "open-project": () => {
      state.selectedProject = actionTarget.dataset.project;
      state.selectedRepository = "";
      location.hash = `#/projects/${encodeURIComponent(state.selectedProject)}/repositories`;
    },
    "open-repository": () => {
      state.selectedProject = actionTarget.dataset.project;
      state.selectedRepository = actionTarget.dataset.repository;
      location.hash = `#/projects/${encodeURIComponent(state.selectedProject)}/repositories/${encodeURIComponent(state.selectedRepository)}/artifacts`;
    },
    "copy-digest": () => copyDigest(actionTarget.dataset.digest),
    "open-search-result": () => openSearchResult(actionTarget),
  };
  actions[action]?.();
}

function handleKeyboard(event) {
  const editing = ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName);
  if (event.key === "/" && !editing && state.session) {
    event.preventDefault();
    openSearch();
  }
  if (event.key === "Escape") {
    closeSearch();
    noticePanel.hidden = true;
    closeMobileMenu();
  }
}

function openMobileMenu() {
  document.querySelector("#sidebar").classList.add("open");
  document.querySelector("#mobile-scrim").hidden = false;
  lockPageScroll("mobile-menu");
}

function closeMobileMenu() {
  document.querySelector("#sidebar").classList.remove("open");
  document.querySelector("#mobile-scrim").hidden = true;
  unlockPageScroll("mobile-menu");
}

function openSearch() {
  if (!state.session) return;
  searchDialog.hidden = false;
  lockPageScroll("search-dialog");
  searchInput.value = "";
  searchResults.innerHTML = '<div class="search-hint">输入至少两个字符开始搜索</div>';
  window.setTimeout(() => searchInput.focus(), 20);
}

function closeSearch() {
  searchDialog.hidden = true;
  unlockPageScroll("search-dialog");
  clearTimeout(state.searchTimer);
}

function handleSearchInput(event) {
  clearTimeout(state.searchTimer);
  const term = event.target.value.trim();
  if (term.length < 2) {
    searchResults.innerHTML = '<div class="search-hint">输入至少两个字符开始搜索</div>';
    return;
  }
  searchResults.innerHTML = `<div class="search-hint"><div class="spinner"></div>正在搜索...</div>`;
  state.searchTimer = setTimeout(async () => {
    try {
      const result = await api(`/api/search?q=${encodeURIComponent(term)}`);
      if (searchInput.value.trim() !== term) return;
      renderSearchResults(result);
    } catch (error) {
      searchResults.innerHTML = `<div class="search-hint">${escapeHTML(error.message)}</div>`;
    }
  }, 260);
}

function renderSearchResults(result) {
  const projects = asArray(result.project || result.projects);
  const repositories = asArray(result.repository || result.repositories);
  if (!projects.length && !repositories.length) {
    searchResults.innerHTML = '<div class="search-hint">没有找到匹配的项目或仓库</div>';
    return;
  }
  searchResults.innerHTML = `
    ${projects.length ? `<span class="search-group-label">项目</span>${projects.map((item) => searchResultRow("folder", item.name, "项目", "project", item.name)).join("")}` : ""}
    ${repositories.length ? `<span class="search-group-label">仓库</span>${repositories.map((item) => searchResultRow("package", item.repository_name || item.name, `${formatNumber(item.artifact_count)} 个制品`, "repository", item.project_name || "", item.repository_name || item.name)).join("")}` : ""}`;
}

function searchResultRow(iconName, name, meta, type, project, repository = "") {
  return `<button class="search-result" type="button" data-action="open-search-result" data-type="${escapeAttr(type)}" data-project="${escapeAttr(project)}" data-repository="${escapeAttr(repository)}">
    <span class="cell-icon">${icon(iconName)}</span><span class="cell-stack"><strong>${escapeHTML(name)}</strong><small>${escapeHTML(meta)}</small></span>${icon("arrow-right")}
  </button>`;
}

function openSearchResult(target) {
  closeSearch();
  state.selectedProject = target.dataset.project;
  state.selectedRepository = target.dataset.repository || "";
  location.hash = target.dataset.type === "repository"
    ? repositoryRoute(state.selectedProject, state.selectedRepository)
    : projectRoute(state.selectedProject);
}

function showOperationCenter() {
	if (!noticePanel.hidden && noticePanel.dataset.panel === "operations") {
		noticePanel.hidden = true;
		delete noticePanel.dataset.panel;
		return;
	}
	noticePanel.dataset.panel = "operations";
	renderOperationCenter();
	noticePanel.hidden = false;
}

function renderOperationCenter() {
	const warnings = asArray(state.dashboard?.warnings);
	const operations = state.operations;
	const running = operations.filter((operation) => operation.status === "running").length;
	const completed = operations.length - running;
	noticePanel.innerHTML = `
		<div class="notice-head operation-center-head"><div><h2>操作中心</h2><span>${running ? `${formatNumber(running)} 个正在执行` : "当前没有运行中的任务"}</span></div><span class="badge">${formatNumber(operations.length)} 个任务</span></div>
		${warnings.length ? `<section class="operation-warning-list"><strong>实例提示</strong>${warnings.map((warning) => noticeItem("部分数据读取失败", warning)).join("")}</section>` : ""}
		<div class="operation-list">${operations.length ? operations.map(operationCenterItem).join("") : `<div class="operation-empty">${icon("check")}<strong>暂无后台操作</strong><span>批量处理和长时间任务会显示在这里。</span></div>`}</div>
		${completed ? `<div class="operation-center-footer"><button type="button" data-action="clear-completed-operations">${icon("trash")}<span>清除已完成</span></button></div>` : ""}`;
}

function operationCenterItem(operation) {
	const labels = {
		running: ["运行中", "status-running", "refresh"],
		success: ["已完成", "status-success", "check"],
		partial: ["部分失败", "status-failed", "alert"],
		failed: ["失败", "status-failed", "alert"],
	};
	const [label, className, iconName] = labels[operation.status] || labels.running;
	const progressMax = operation.total > 0 ? operation.total : 1;
	const progressValue = operation.total > 0 ? Math.min(operation.completed, operation.total) : operation.status === "running" ? null : 1;
	const summary = operation.total > 0
		? `${formatNumber(operation.completed)} / ${formatNumber(operation.total)}${operation.failed ? ` · ${formatNumber(operation.failed)} 失败` : ""}`
		: operation.detail;
	return `<button class="operation-item" type="button" data-action="view-operation" data-id="${escapeAttr(operation.id)}">
		<span class="operation-kind ${className}">${icon(iconName)}</span>
		<span class="operation-item-main"><span><strong>${escapeHTML(operation.title)}</strong><small>${escapeHTML(summary || label)}</small></span><progress class="operation-progress" max="${progressMax}" ${progressValue === null ? "" : `value="${progressValue}"`}>${progressValue ?? 0}</progress><time>${formatDate(operation.completedAt || operation.startedAt)}</time></span>
		<span class="status-badge ${className}">${label}</span>
	</button>`;
}

function showOperationDetails(id) {
	const operation = operationByID(id);
	if (!operation) return;
	noticePanel.hidden = true;
	const results = asArray(operation.results);
	openControlDialog({
		title: operation.title,
		subtitle: operation.detail || `开始于 ${formatDate(operation.startedAt)}`,
		submitLabel: "关闭",
		submitIcon: "x",
		hideCancel: true,
		dialogClass: "control-dialog-wide",
		content: `<dl class="operation-detail-stats"><div><dt>状态</dt><dd>${operationCenterStatusBadge(operation.status)}</dd></div><div><dt>总计</dt><dd>${formatNumber(operation.total || results.length)}</dd></div><div><dt>成功</dt><dd>${formatNumber(operation.succeeded)}</dd></div><div><dt>失败</dt><dd>${formatNumber(operation.failed)}</dd></div></dl>${results.length ? `<div class="batch-result-list operation-result-list">${results.map((result) => `<div class="${result.status === "failed" ? "failed" : ""}"><span>${result.status === "failed" ? icon("alert") : icon("check")}</span><code>${escapeHTML(result.label)}</code><span>${escapeHTML(result.error || "已完成")}</span></div>`).join("")}</div>` : `<div class="operation-detail-empty">任务正在 Harbor 中执行，稍后可在对应模块查看官方执行记录。</div>`}`,
		onSubmit: async () => closeControlDialog(),
	});
}

function operationCenterStatusBadge(status) {
	const values = {
		running: ["运行中", "status-running"],
		success: ["已完成", "status-success"],
		partial: ["部分失败", "status-failed"],
		failed: ["失败", "status-failed"],
	};
	const [label, className] = values[status] || values.running;
	return `<span class="status-badge ${className}">${label}</span>`;
}

function clearCompletedOperations() {
	state.operations = state.operations.filter((operation) => operation.status === "running");
	operationCenterChanged();
}

function accountAuthMode() {
	return String(asObject(state.dashboard?.systeminfo).auth_mode || "");
}

function showAccountMenu() {
	if (!noticePanel.hidden && noticePanel.dataset.panel === "account") {
	  noticePanel.hidden = true;
	  delete noticePanel.dataset.panel;
	  return;
	}
	const identity = asObject(state.identity);
	const username = identity.username || state.session?.username || "-";
	const role = identity.sysadmin_flag ? "系统管理员" : "Harbor 用户";
	const authMode = accountAuthMode();
	const canChangePassword = authMode === "db_auth";
	const canChangeCLISecret = authMode === "oidc_auth" && Boolean(identity.oidc_user_meta);
	noticePanel.innerHTML = `
	  <div class="account-menu-head"><span class="user-avatar">${escapeHTML(String(username).slice(0, 1).toUpperCase())}</span><div><strong>${escapeHTML(username)}</strong><span>${escapeHTML(role)} · ${authModeLabel(authMode)}</span></div></div>
	  <dl class="account-menu-details"><div><dt>姓名</dt><dd>${escapeHTML(identity.realname || "未填写")}</dd></div><div><dt>邮箱</dt><dd>${escapeHTML(identity.email || "未填写")}</dd></div></dl>
	  ${identity.load_error ? `<div class="account-capability-warning">${icon("alert")}<span>${escapeHTML(identity.load_error)}</span></div>` : ""}
	  <div class="account-menu-actions">
		<button type="button" data-action="edit-account-profile">${icon("edit")}<span>编辑个人资料</span>${icon("chevron")}</button>
		<button type="button" data-action="change-account-password" ${canChangePassword ? "" : "disabled"}>${icon("shield")}<span><strong>修改密码</strong><small>${canChangePassword ? "修改当前数据库账号密码" : "仅数据库认证模式可用"}</small></span>${icon("chevron")}</button>
			<button type="button" data-action="change-account-cli-secret" ${canChangeCLISecret ? "" : "disabled"}>${icon("terminal")}<span><strong>CLI Secret</strong><small>${canChangeCLISecret ? "用于 Docker 或 Helm 客户端" : "仅已绑定的 OIDC 账号可用"}</small></span>${icon("chevron")}</button>
			<button type="button" data-action="show-preferences">${icon("settings")}<span><strong>显示与命令偏好</strong><small>时区、CLI 工具和仓库视图</small></span>${icon("chevron")}</button>
			<button type="button" data-action="open-about">${icon("info")}<span><strong>关于与 API</strong><small>版本、许可证和 Harbor 官方 Swagger</small></span>${icon("chevron")}</button>
	  </div>`;
	noticePanel.dataset.panel = "account";
	noticePanel.hidden = false;
}

function showPreferencesDialog() {
	noticePanel.hidden = true;
	const preferences = state.preferences;
	openControlDialog({
		title: "显示与命令偏好",
		subtitle: "仅保存在当前浏览器，不会写入 Harbor",
		submitLabel: "保存偏好",
		content: `<div class="preference-sections">
			<fieldset class="preference-section"><legend>日期与时间</legend><p>影响列表、详情和审计日志中的时间显示。</p><div class="preference-choice-grid"><label class="check-row"><input name="date_timezone" type="radio" value="local" ${preferences.dateTimezone === "local" ? "checked" : ""}><span><strong>浏览器当前时区</strong><small>${escapeHTML(Intl.DateTimeFormat().resolvedOptions().timeZone || "Local")}</small></span></label><label class="check-row"><input name="date_timezone" type="radio" value="utc" ${preferences.dateTimezone === "utc" ? "checked" : ""}><span><strong>UTC</strong><small>按协调世界时显示</small></span></label></div></fieldset>
			<fieldset class="preference-section"><legend>容器 CLI</legend><p>用于生成拉取、Tag 和推送命令。</p><div class="preference-choice-grid three"><label class="check-row"><input name="runtime" type="radio" value="docker" ${preferences.runtime === "docker" ? "checked" : ""}><span><strong>Docker</strong><small>docker</small></span></label><label class="check-row"><input name="runtime" type="radio" value="podman" ${preferences.runtime === "podman" ? "checked" : ""}><span><strong>Podman</strong><small>podman</small></span></label><label class="check-row"><input name="runtime" type="radio" value="nerdctl" ${preferences.runtime === "nerdctl" ? "checked" : ""}><span><strong>nerdctl</strong><small>containerd</small></span></label></div></fieldset>
			<fieldset class="preference-section"><legend>仓库展示</legend><p>作为镜像资产和项目仓库的默认展示方式。</p><div class="preference-choice-grid"><label class="check-row"><input name="repository_view" type="radio" value="list" ${preferences.repositoryView === "list" ? "checked" : ""}><span><strong>列表</strong><small>适合密集比较</small></span></label><label class="check-row"><input name="repository_view" type="radio" value="card" ${preferences.repositoryView === "card" ? "checked" : ""}><span><strong>卡片</strong><small>适合浏览仓库</small></span></label></div></fieldset>
		</div>`,
		onSubmit: async (formData) => {
			saveConsolePreferences({ dateTimezone: formData.get("date_timezone"), runtime: formData.get("runtime"), repositoryView: formData.get("repository_view") });
			closeControlDialog();
			showToast("偏好已保存");
			renderCurrentView(true);
		},
	});
}

function showAccountProfileDialog() {
	noticePanel.hidden = true;
	const identity = asObject(state.identity);
	openControlDialog({
	  title: "编辑个人资料",
	  subtitle: identity.username || state.session?.username || "",
	  submitLabel: "保存资料",
	  content: `<div class="form-grid two-columns"><label class="field"><span>姓名</span><input name="realname" maxlength="255" value="${escapeAttr(identity.realname || "")}" autocomplete="name"></label><label class="field"><span>邮箱</span><input name="email" type="email" maxlength="255" value="${escapeAttr(identity.email || "")}" autocomplete="email"></label><label class="field field-span"><span>备注</span><textarea name="comment" rows="3" maxlength="1024">${escapeHTML(identity.comment || "")}</textarea></label></div>`,
	  onSubmit: async (formData) => {
		const payload = { realname: String(formData.get("realname") || "").trim(), email: String(formData.get("email") || "").trim(), comment: String(formData.get("comment") || "").trim() };
		await controlMutation("user", { id: identity.user_id }, "PUT", payload);
		state.identity = { ...identity, ...payload };
		closeControlDialog();
		renderSessionChrome();
		showToast("个人资料已更新");
	  },
	});
}

function accountSecretPattern() {
	return "(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).{8,128}";
}

function showAccountPasswordDialog() {
	noticePanel.hidden = true;
	const identity = asObject(state.identity);
	if (accountAuthMode() !== "db_auth") {
	  showToast("当前认证模式不支持在 Harbor 中修改密码", true);
	  return;
	}
	openControlDialog({
	  title: "修改密码",
	  subtitle: "成功后控制台会自动续用新凭据",
	  submitLabel: "更新密码",
	  content: `<div class="form-grid"><label class="field"><span>当前密码</span><input name="old_password" type="password" required maxlength="4096" autocomplete="current-password"></label><label class="field"><span>新密码</span><input name="new_password" type="password" required minlength="8" maxlength="128" pattern="${accountSecretPattern()}" autocomplete="new-password"><small class="field-help">8-128 个字符，至少包含大写字母、小写字母和数字。</small></label><label class="field"><span>再次输入新密码</span><input name="confirmation" type="password" required minlength="8" maxlength="128" pattern="${accountSecretPattern()}" autocomplete="new-password"></label></div>`,
	  onSubmit: async (formData, form) => {
		const password = String(formData.get("new_password") || "");
		if (password !== String(formData.get("confirmation") || "")) {
		  throw new Error("两次输入的新密码不一致");
		}
		await controlMutation("current-user-password", { id: identity.user_id }, "PUT", { old_password: String(formData.get("old_password") || ""), new_password: password });
		closeControlDialog();
		showToast("密码已更新，当前连接已续用新凭据");
	  },
	});
}

function generatedCLISecret() {
	const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
	const values = new Uint32Array(24);
	crypto.getRandomValues(values);
	return `Hc1${Array.from(values, (value) => alphabet[value % alphabet.length]).join("")}`;
}

function showAccountCLISecretDialog() {
	noticePanel.hidden = true;
	const identity = asObject(state.identity);
	if (accountAuthMode() !== "oidc_auth" || !identity.oidc_user_meta) {
	  showToast("当前账号没有可管理的 OIDC CLI Secret", true);
	  return;
	}
	const suggested = generatedCLISecret();
	openControlDialog({
	  title: "更新 CLI Secret",
	  subtitle: "更新后旧 Secret 立即失效，当前连接会自动续用新值",
	  submitLabel: "更新 Secret",
	  content: `<div class="form-grid"><label class="field"><span>新 CLI Secret</span><input name="secret" type="password" required minlength="8" maxlength="128" pattern="${accountSecretPattern()}" value="${escapeAttr(suggested)}" autocomplete="new-password"><small class="field-help">可使用预生成值，或输入至少包含大写字母、小写字母和数字的自定义值。</small></label><label class="field"><span>再次输入</span><input name="confirmation" type="password" required minlength="8" maxlength="128" pattern="${accountSecretPattern()}" value="${escapeAttr(suggested)}" autocomplete="new-password"></label></div><div class="warning-banner">${icon("alert")}<span>Docker、Helm 和自动化任务需要同步更新为新的 CLI Secret。</span></div>`,
	  onSubmit: async (formData, form) => {
		const secret = String(formData.get("secret") || "");
		if (secret !== String(formData.get("confirmation") || "")) {
		  throw new Error("两次输入的 CLI Secret 不一致");
		}
		await controlMutation("current-user-cli-secret", { id: identity.user_id }, "PUT", { secret });
		state.identity = { ...identity, oidc_user_meta: { ...asObject(identity.oidc_user_meta), secret } };
		closeControlDialog();
		showToast("CLI Secret 已更新，当前连接已续用新凭据");
	  },
	});
}

async function showInstanceMenu() {
  try {
    const result = await api("/api/instances");
    state.instances = asArray(result?.items);
  } catch (error) {
    showToast(error.message, true);
    return;
  }
  const instances = state.instances;
  noticePanel.innerHTML = `
    <div class="notice-head"><h2>Harbor 实例</h2><span class="badge">${formatNumber(instances.length)} 个实例</span></div>
    <div class="instance-menu-list">${instances.map((instance) => instanceMenuRow(instance)).join("")}</div>
    <div class="instance-menu-footer"><button class="button button-small button-primary button-wide" type="button" data-action="add-instance">${icon("plus")}<span>新增实例</span></button></div>`;
  noticePanel.hidden = false;
	delete noticePanel.dataset.panel;
}

function instanceMenuRow(instance) {
  const host = safeURL(instance.instance_url)?.host || instance.instance_url;
  const kind = instance.demo ? translateUI("演示实例") : "Harbor API v2";
  return `<div class="instance-menu-row ${instance.active ? "active" : ""}"><button type="button" data-action="switch-instance" data-id="${escapeAttr(instance.connection_id)}" ${instance.active ? "disabled" : ""}><span class="instance-avatar">H</span><span class="instance-menu-meta"><strong>${escapeHTML(host)}</strong><small>${escapeHTML(instance.username || "-")} · ${escapeHTML(kind)}</small></span>${instance.active ? '<span class="badge badge-green">当前</span>' : icon("chevron")}</button><button class="icon-button danger-icon" type="button" data-action="remove-instance" data-id="${escapeAttr(instance.connection_id)}" title="移除此实例" aria-label="移除此实例" ${state.instances.length <= 1 ? "disabled" : ""}>${icon("x")}</button></div>`;
}

function showAddInstanceDialog() {
  noticePanel.hidden = true;
  openControlDialog({
    title: "新增 Harbor 实例",
    subtitle: "连接成功后将自动切换到新实例",
    submitLabel: "验证并连接",
    submitIcon: "arrow-right",
    content: `<div class="form-grid"><label class="field"><span>Harbor 地址</span><div class="url-input-group"><select name="protocol" aria-label="连接协议"><option value="https" selected>https://</option><option value="http">http://</option></select><input name="address" type="text" inputmode="url" required maxlength="2048" placeholder="harbor.example.com" autocomplete="url" data-harbor-address></div></label><label class="field"><span>用户名</span><input name="username" required maxlength="256" placeholder="admin" autocomplete="username"></label><label class="field"><span>密码</span><input name="password" type="password" required maxlength="4096" autocomplete="current-password"></label><label class="check-row"><input name="skip_tls_verify" type="checkbox"><span><strong>允许自签名证书</strong><small>仅在可信内网环境中启用</small></span></label>${state.session?.demo ? `<div class="dialog-secondary-action"><span>需要验证多实例流程？</span><button class="button button-small" type="button" data-action="add-demo-instance">${icon("plus")}<span>新增演示实例</span></button></div>` : ""}</div>`,
    onSubmit: async (formData) => {
      const payload = { url: harborURLFromFormData(formData), username: String(formData.get("username") || "").trim(), password: String(formData.get("password") || ""), skip_tls_verify: formData.has("skip_tls_verify") };
      state.session = await api("/api/instances", { method: "POST", body: JSON.stringify(payload) });
      closeControlDialog();
      await activateCurrentInstance("新实例已连接");
    },
  });
}

async function addDemoInstance() {
  const button = document.querySelector('[data-action="add-demo-instance"]');
  setButtonBusy(button, true, "正在创建");
  try {
    state.session = await api("/api/instances/demo", { method: "POST", body: "{}" });
    closeControlDialog();
    await activateCurrentInstance("演示实例已添加");
  } catch (error) {
    const form = document.querySelector("#control-dialog-form");
    if (form) showDialogError(form, error.message);
    setButtonBusy(button, false);
  }
}

async function switchInstance(id) {
  if (!id || id === state.session?.connection_id) return;
  noticePanel.hidden = true;
  renderLoading("正在切换 Harbor 实例", "正在清理旧实例缓存并读取目标实例...");
  try {
    state.session = await api("/api/instances/current", { method: "PUT", body: JSON.stringify({ id }) });
    await activateCurrentInstance("Harbor 实例已切换");
  } catch (error) {
    renderError("实例切换失败", error.message, "refresh-dashboard");
  }
}

function confirmRemoveInstance(id) {
  const instance = state.instances.find((item) => item.connection_id === id);
  if (!instance) return;
  const host = safeURL(instance.instance_url)?.host || instance.instance_url;
  noticePanel.hidden = true;
  openControlDialog({
    title: "移除 Harbor 实例",
    subtitle: host,
    submitLabel: "移除连接",
    submitIcon: "x",
    destructive: true,
    content: `<div class="destructive-message">${icon("alert")}<span>只会清除控制台中的临时连接与凭据，不会修改 Harbor 中的任何资源。</span></div>`,
    onSubmit: async () => {
      state.session = await api(`/api/instances/${encodeURIComponent(id)}`, { method: "DELETE" });
      closeControlDialog();
      await activateCurrentInstance("实例连接已移除");
    },
  });
}

async function activateCurrentInstance(message) {
	resetOperations();
  state.cache.clear();
  state.dashboard = null;
  state.selectedProject = "";
  state.selectedRepository = "";
  state.route = null;
  history.replaceState(null, "", `${location.pathname}#/overview`);
  await enterConsole();
  showToast(message);
}

function noticeItem(title, message) {
  return `<div class="notice-item"><i></i><div><strong>${escapeHTML(title)}</strong><span>${escapeHTML(message)}</span></div></div>`;
}

function applySavedTheme() {
  const saved = localStorage.getItem("harbor-console-theme");
  const theme = saved === "dark" || saved === "light" ? saved : "light";
  document.documentElement.dataset.theme = theme;
  updateThemeIcon(theme);
}

function toggleTheme() {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  localStorage.setItem("harbor-console-theme", next);
  updateThemeIcon(next);
}

function updateThemeIcon(theme) {
  const use = document.querySelector(".theme-icon use");
  if (use) use.setAttribute("href", theme === "dark" ? "#i-sun" : "#i-moon");
  const meta = document.querySelector('meta[name="theme-color"]');
  meta?.setAttribute("content", theme === "dark" ? "#171717" : "#f7f7f8");
}

async function copyDigest(digest) {
  try {
    await navigator.clipboard.writeText(digest);
    showToast("制品摘要已复制");
  } catch {
    showToast("浏览器未允许复制，请手动选择摘要。", true);
  }
}

function showToast(message, isError = false) {
  const toast = document.createElement("div");
  toast.className = `toast ${isError ? "toast-error" : ""}`;
  toast.innerHTML = `${icon(isError ? "alert" : "check")}<span>${escapeHTML(message)}</span>`;
  document.querySelector("#toast-region").append(toast);
  window.setTimeout(() => toast.remove(), 3600);
}
