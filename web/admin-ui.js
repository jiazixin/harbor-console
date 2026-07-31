"use strict";

function administrationRoute(section = "users", page = 1, filter = "") {
  return `#/administration/${section}${routeQuery(page, filter)}`;
}

function administrationTabs(selected) {
  const tabs = [
    ["users", "用户", "users"],
    ["groups", "用户组", "users"],
    ["robots", "机器人账号", "terminal"],
    ["labels", "全局标签", "tag"],
    ["quotas", "项目配额", "database"],
	    ["maintenance", "维护任务", "history"],
	    ["purge", "审计清理", "trash"],
	    ["jobs", "任务监控", "terminal"],
	    ["configuration", "系统配置", "settings"],
  ];
  return `<nav class="resource-tabs administration-tabs" aria-label="系统管理页面">${tabs.map(([key, label, iconName]) => `<a href="${administrationRoute(key)}" class="${selected === key ? "active" : ""}" ${selected === key ? 'aria-current="page"' : ""}>${icon(iconName)}<span>${label}</span></a>`).join("")}</nav>`;
}

async function renderAdministration(token) {
  const route = state.route || parseConsoleRoute();
  mainContent.innerHTML = `${pageHeader("系统管理", viewMeta.administration.subtitle, refreshButton())}${demoBanner()}${administrationTabs(route.section)}<section class="table-shell">${loadingRows(6)}</section>`;
  try {
    let collection;
    if (route.section === "users") {
      collection = await controlList("users", { page: route.page, page_size: controlPageSize, sort: "username", q: route.filter ? `username=~${route.filter}` : "" });
    } else if (route.section === "groups") {
      collection = await controlList("user-groups", { page: route.page, page_size: controlPageSize, group_name: route.filter });
    } else if (route.section === "robots") {
      const [robots, permissionMetadata, projects] = await Promise.all([
        controlList("robots", { page: route.page, page_size: controlPageSize, sort: "name", q: ["level=system", route.filter ? `name=~${route.filter}` : ""].filter(Boolean).join(",") }),
        controlData("permissions"),
        loadAllAdminProjects(),
      ]);
      collection = { ...robots, permissionMetadata, projects };
    } else if (route.section === "quotas") {
      collection = await controlList("quotas", { page: route.page, page_size: controlPageSize, sort: "hard.storage" });
    } else if (route.section === "labels") {
      collection = await controlList("labels", { page: route.page, page_size: controlPageSize, sort: "name", scope: "g", name: route.filter });
	} else if (route.section === "maintenance") {
      const [history, gcSchedule, scanSchedule, scanMetrics] = await Promise.all([
        controlList("gc-history", { page: route.page, page_size: 10, sort: "-creation_time" }),
        adminOptionalData("gc-schedule"),
        adminOptionalData("scan-all-schedule"),
        adminOptionalData("scan-all-metrics"),
      ]);
	  collection = { ...history, gcSchedule, scanSchedule, scanMetrics };
		} else if (route.section === "purge") {
		  const [history, schedule, events] = await Promise.all([
			adminOptionalList("purge-history", { page: route.page, page_size: 20, sort: "-creation_time" }),
			adminOptionalData("purge-schedule"),
			adminOptionalData("audit-log-events"),
		  ]);
		  collection = { ...history, purgeSchedule: schedule, auditEvents: asArray(events) };
		} else if (route.section === "jobs") {
		  const [pools, workers, queues, schedules, scheduleStatus] = await Promise.all([
			adminOptionalData("jobservice-pools"),
			adminOptionalData("jobservice-workers", { pool: "all" }),
			adminOptionalData("jobservice-queues"),
			adminOptionalList("jobservice-schedules", { page: route.page, page_size: 20 }),
			adminOptionalData("jobservice-schedule-status", { type: "all" }),
		  ]);
		  collection = { pools: asArray(pools), workers: asArray(workers), queues: asArray(queues), schedules, scheduleStatus };
		} else {
	  const [configurationResult, allowlistResult, auditEventsResult] = await Promise.allSettled([
		controlData("configurations"),
		controlData("system-cve-allowlist"),
		controlData("audit-log-events"),
	  ]);
	  if (configurationResult.status === "rejected") throw configurationResult.reason;
	  collection = {
		configuration: configurationResult.value,
		allowlist: allowlistResult.status === "fulfilled" ? allowlistResult.value : null,
		allowlist_error: allowlistResult.status === "rejected" ? allowlistResult.reason.message : "",
		auditEvents: auditEventsResult.status === "fulfilled" ? asArray(auditEventsResult.value) : [],
		audit_events_error: auditEventsResult.status === "rejected" ? auditEventsResult.reason.message : "",
	  };
    }
    if (token !== state.renderToken || state.currentView !== "administration") return;
    state.adminItems = asArray(collection?.items);
    state.adminCollection = collection;
    mainContent.innerHTML = `${pageHeader("系统管理", viewMeta.administration.subtitle, refreshButton())}${demoBanner()}${administrationTabs(route.section)}${administrationSection(route, collection)}`;
    bindAdministrationSection(route);
  } catch (error) {
    if (token === state.renderToken) renderError("系统管理数据载入失败", error.message, "refresh-view");
  }
}

async function adminOptionalData(operation, params = {}) {
  try {
	    return await controlData(operation, params);
  } catch (error) {
	    return { load_error: error.message };
  }
}

async function adminOptionalList(operation, params = {}) {
	try {
		return await controlList(operation, params);
	} catch (error) {
		return { items: [], pagination: { page: params.page || 1, page_size: params.page_size || 20, total: 0 }, load_error: error.message };
	}
}

function administrationSection(route, collection) {
  if (route.section === "users") return adminUsersSection(route, collection);
  if (route.section === "groups") return adminGroupsSection(route, collection);
  if (route.section === "robots") return adminRobotsSection(route, collection);
  if (route.section === "labels") return adminLabelsSection(route, collection);
  if (route.section === "quotas") return adminQuotasSection(collection);
	  if (route.section === "maintenance") return adminMaintenanceSection(collection);
	  if (route.section === "purge") return adminPurgeSection(collection);
	  if (route.section === "jobs") return adminJobServiceSection(collection);
	return adminConfigurationSection(collection, route);
}

function adminUsersSection(route, collection) {
  const mode = accountAuthMode();
  const action = mode === "db_auth"
    ? `<button class="button button-small button-primary" type="button" data-action="create-admin-user">${icon("plus")}<span>新建本地用户</span></button>`
    : mode === "ldap_auth"
      ? `<button class="button button-small button-primary" type="button" data-action="import-ldap-users">${icon("upload")}<span>导入 LDAP 用户</span></button>`
      : `<span class="toolbar-note">用户由 ${escapeHTML(authModeLabel(mode))} 管理</span>`;
  return `<section class="table-shell"><div class="table-toolbar">${controlSearchForm("admin-user-search", route.filter, "按用户名搜索")}<div class="toolbar-spacer"></div>${action}</div><div class="table-scroll">${adminUsersTable(collection.items, mode)}</div>${controlPagination(collection.pagination)}</section>`;
}

function adminUsersTable(users, authMode = accountAuthMode()) {
  if (!users.length) return emptyTable("暂无用户", "当前条件下没有匹配的 Harbor 用户。", "users");
  return `<table><thead><tr><th>用户</th><th>邮箱</th><th>权限</th><th>创建时间</th><th></th></tr></thead><tbody>${users.map((user) => `<tr><td><div class="cell-title"><span class="user-avatar-small">${escapeHTML(Array.from(user.username || "U")[0]?.toUpperCase() || "U")}</span><span class="cell-stack"><strong>${escapeHTML(user.username)}</strong><small>${escapeHTML(user.realname || user.comment || `用户 #${user.user_id}`)}</small></span></div></td><td>${escapeHTML(user.email || "-")}</td><td>${user.sysadmin_flag ? '<span class="badge badge-orange">系统管理员</span>' : '<span class="badge badge-blue">普通用户</span>'}</td><td>${formatDate(user.creation_time)}</td><td><div class="row-actions"><button class="icon-button" type="button" data-action="toggle-admin-user" data-id="${escapeAttr(user.user_id)}" data-admin="${user.sysadmin_flag ? "true" : "false"}" title="${user.sysadmin_flag ? "撤销管理员" : "设为管理员"}" aria-label="${user.sysadmin_flag ? "撤销管理员" : "设为管理员"}">${icon("shield")}</button>${authMode === "db_auth" ? `<button class="icon-button" type="button" data-action="reset-admin-password" data-id="${escapeAttr(user.user_id)}" data-name="${escapeAttr(user.username)}" title="重置密码" aria-label="重置密码">${icon("refresh")}</button>` : ""}<button class="icon-button" type="button" data-action="edit-admin-user" data-id="${escapeAttr(user.user_id)}" title="编辑用户" aria-label="编辑用户">${icon("edit")}</button><button class="icon-button danger-icon" type="button" data-action="delete-admin-user" data-id="${escapeAttr(user.user_id)}" data-name="${escapeAttr(user.username)}" title="删除用户" aria-label="删除用户">${icon("trash")}</button></div></td></tr>`).join("")}</tbody></table>`;
}

function adminGroupsSection(route, collection) {
  return `<section class="table-shell"><div class="table-toolbar">${controlSearchForm("admin-group-search", route.filter, "按用户组名称搜索")}<div class="toolbar-spacer"></div><button class="button button-small button-primary" type="button" data-action="create-user-group">${icon("plus")}<span>新建用户组</span></button></div><div class="table-scroll">${adminGroupsTable(collection.items)}</div>${controlPagination(collection.pagination)}</section>`;
}

function adminGroupsTable(groups) {
  if (!groups.length) return emptyTable("暂无用户组", "用户组可用于批量授予项目权限。", "users");
  return `<table><thead><tr><th>用户组</th><th>来源</th><th>LDAP DN</th><th>编号</th><th></th></tr></thead><tbody>${groups.map((group) => `<tr><td><div class="cell-title"><span class="cell-icon">${icon("users")}</span><strong>${escapeHTML(group.group_name)}</strong></div></td><td>${adminGroupType(group.group_type)}</td><td class="truncate-cell mono">${escapeHTML(group.ldap_group_dn || "-")}</td><td class="mono">#${escapeHTML(group.id)}</td><td><div class="row-actions"><button class="icon-button" type="button" data-action="edit-user-group" data-id="${escapeAttr(group.id)}" title="编辑用户组" aria-label="编辑用户组">${icon("edit")}</button><button class="icon-button danger-icon" type="button" data-action="delete-user-group" data-id="${escapeAttr(group.id)}" data-name="${escapeAttr(group.group_name)}" title="删除用户组" aria-label="删除用户组">${icon("trash")}</button></div></td></tr>`).join("")}</tbody></table>`;
}

function adminGroupType(value) {
  return ({ 1: "LDAP", 2: "HTTP", 3: "OIDC" })[toNumber(value)] || "未知";
}

async function loadAllAdminProjects() {
  const projects = [];
  for (let page = 1; page <= 100; page += 1) {
    const result = await controlList("projects", { page, page_size: 100, sort: "name" });
    projects.push(...result.items);
    if (projects.length >= result.pagination.total || result.items.length < 100) break;
  }
  return projects;
}

function adminRobotsSection(route, collection) {
  return `<section class="table-shell"><div class="table-toolbar">${controlSearchForm("admin-robot-search", route.filter, "按机器人名称搜索")}<div class="toolbar-spacer"></div><button class="button button-small button-primary" type="button" data-action="create-system-robot">${icon("plus")}<span>新建系统机器人</span></button></div><div class="table-scroll">${adminRobotsTable(collection.items)}</div>${controlPagination(collection.pagination)}</section>`;
}

function adminRobotsTable(robots) {
  if (!robots.length) return emptyTable("暂无系统机器人", "系统机器人可跨项目执行镜像分发和系统管理操作。", "terminal");
  return `<table><thead><tr><th>机器人账号</th><th>权限范围</th><th>状态</th><th>到期时间</th><th>创建时间</th><th></th></tr></thead><tbody>${robots.map((robot) => {
    const permissions = asArray(robot.permissions);
    const systemCount = permissions.filter((permission) => permission.kind === "system").flatMap((permission) => asArray(permission.access)).length;
    const projectPermissions = permissions.filter((permission) => permission.kind === "project");
    const allProjects = projectPermissions.some((permission) => permission.namespace === "*");
    const projectLabel = allProjects ? "全部项目" : projectPermissions.length ? `${formatNumber(projectPermissions.length)} 个项目` : "无项目权限";
    return `<tr><td><div class="cell-title"><span class="cell-icon">${icon("terminal")}</span><span class="cell-stack"><strong>${escapeHTML(robot.name)}</strong><small>${escapeHTML(robot.description || `账号 #${robot.id}`)}</small></span></div></td><td><span class="badge badge-blue">系统 ${formatNumber(systemCount)} 项</span> <span class="badge ${allProjects ? "badge-orange" : ""}">${projectLabel}</span></td><td>${robot.disable ? '<span class="badge badge-red">已停用</span>' : '<span class="badge badge-green">已启用</span>'}</td><td>${robot.expires_at === -1 ? "永不过期" : formatUnixDate(robot.expires_at)}</td><td>${formatDate(robot.creation_time)}</td><td><div class="row-actions"><button class="icon-button" type="button" data-action="reset-robot-secret" data-id="${escapeAttr(robot.id)}" data-name="${escapeAttr(robot.name)}" title="重置密钥" aria-label="重置密钥">${icon("refresh")}</button><button class="icon-button" type="button" data-action="edit-system-robot" data-id="${escapeAttr(robot.id)}" title="编辑系统机器人" aria-label="编辑系统机器人">${icon("edit")}</button><button class="icon-button danger-icon" type="button" data-action="delete-system-robot" data-id="${escapeAttr(robot.id)}" data-name="${escapeAttr(robot.name)}" title="删除系统机器人" aria-label="删除系统机器人">${icon("trash")}</button></div></td></tr>`;
  }).join("")}</tbody></table>`;
}

function adminQuotasSection(collection) {
  return `<section class="table-shell"><div class="table-toolbar"><strong>项目存储配额</strong><div class="toolbar-spacer"></div><span class="toolbar-note">配额由 Harbor Quota API 管理</span></div><div class="table-scroll">${adminQuotasTable(collection.items)}</div>${controlPagination(collection.pagination)}</section>`;
}

function adminLabelsSection(route, collection) {
  return `<section class="table-shell"><div class="table-toolbar">${controlSearchForm("admin-label-search", route.filter, "按标签名称搜索")}<div class="toolbar-spacer"></div><button class="button button-small button-primary" type="button" data-action="create-global-label">${icon("plus")}<span>新建全局标签</span></button></div><div class="table-scroll">${adminLabelsTable(collection.items)}</div>${controlPagination(collection.pagination)}</section>`;
}

function adminLabelsTable(labels) {
  if (!labels.length) return emptyTable("暂无全局标签", "全局标签可绑定到所有项目中的制品。", "tag");
  return `<table><thead><tr><th>标签</th><th>描述</th><th>作用域</th><th>最近更新</th><th></th></tr></thead><tbody>${labels.map((label) => `<tr><td><div class="cell-title">${labelSwatch(label.color)}<strong>${escapeHTML(label.name)}</strong></div></td><td>${escapeHTML(label.description || "-")}</td><td><span class="badge badge-blue">所有项目</span></td><td>${formatDate(label.update_time || label.creation_time)}</td><td><div class="row-actions"><button class="icon-button" type="button" data-action="edit-global-label" data-id="${escapeAttr(label.id)}" title="编辑全局标签" aria-label="编辑全局标签">${icon("edit")}</button><button class="icon-button danger-icon" type="button" data-action="delete-global-label" data-id="${escapeAttr(label.id)}" data-name="${escapeAttr(label.name)}" title="删除全局标签" aria-label="删除全局标签">${icon("trash")}</button></div></td></tr>`).join("")}</tbody></table>`;
}

const globalLabelColorPresets = [
  { value: "#f48120", label: "橙色" },
  { value: "#d97706", label: "琥珀色" },
  { value: "#168352", label: "绿色" },
  { value: "#0f766e", label: "青绿色" },
  { value: "#2878b5", label: "蓝色" },
  { value: "#4f5fbf", label: "靛蓝色" },
  { value: "#7a4ca0", label: "紫色" },
  { value: "#b64276", label: "玫红色" },
  { value: "#c73a3a", label: "红色" },
  { value: "#6b7280", label: "灰色" },
  { value: "#374151", label: "深灰色" },
  { value: "#8a5a44", label: "棕色" },
];

function globalLabelColorField(value) {
  const current = safeLabelColor(value || "#f48120").toLowerCase();
  return `<div class="field global-label-color-field"><span>标签颜色</span><div class="global-label-palette" role="group" aria-label="标签预设颜色">${globalLabelColorPresets.map((preset) => `<button type="button" data-label-color="${preset.value}" class="global-label-color-swatch" title="${preset.label}" aria-label="选择${preset.label} ${preset.value}" aria-pressed="${preset.value === current}"><svg class="global-label-preset-fill" viewBox="0 0 30 30" aria-hidden="true" focusable="false"><rect width="30" height="30" fill="${escapeAttr(preset.value)}"></rect></svg><span class="global-label-preset-check" data-preset-check>${preset.value === current ? icon("check") : ""}</span></button>`).join("")}</div><div class="global-label-custom-color"><input name="color" type="color" value="${escapeAttr(current)}" aria-label="自定义标签颜色"><span>自定义颜色</span><code id="global-label-color-value">${escapeHTML(current.toUpperCase())}</code></div></div>`;
}

function bindGlobalLabelColorPicker(form) {
  const picker = form.elements.namedItem("color");
  const swatches = [...form.querySelectorAll("[data-label-color]")];
  const valueLabel = form.querySelector("#global-label-color-value");
  const update = (value) => {
    const normalized = safeLabelColor(value).toLowerCase();
    picker.value = normalized;
    if (valueLabel) valueLabel.textContent = normalized.toUpperCase();
    swatches.forEach((button) => {
      const selected = button.dataset.labelColor === normalized;
      button.setAttribute("aria-pressed", String(selected));
      const check = button.querySelector("[data-preset-check]");
      if (check) check.innerHTML = selected ? icon("check") : "";
    });
  };
  swatches.forEach((button) => button.addEventListener("click", () => update(button.dataset.labelColor)));
  picker?.addEventListener("input", () => update(picker.value));
  update(picker?.value || "#f48120");
}

function showGlobalLabelDialog(label = null) {
  openControlDialog({
    title: label ? "编辑全局标签" : "新建全局标签",
    subtitle: "适用于当前 Harbor 实例的所有项目",
    submitLabel: label ? "保存标签" : "创建标签",
    content: `<div class="form-grid"><label class="field"><span>标签名称</span><input name="name" required maxlength="255" value="${escapeAttr(label?.name || "")}"></label>${globalLabelColorField(label?.color)}<label class="field"><span>描述</span><textarea name="description" rows="3" maxlength="1024">${escapeHTML(label?.description || "")}</textarea></label></div>`,
    onSubmit: async (formData) => {
      const payload = { name: String(formData.get("name") || "").trim(), description: String(formData.get("description") || "").trim(), color: String(formData.get("color") || "#f48120"), scope: "g", project_id: 0 };
      await controlMutation(label ? "label" : "labels", label ? { id: label.id } : {}, label ? "PUT" : "POST", payload);
      closeControlDialog();
      showToast(label ? "全局标签已更新" : "全局标签已创建");
      renderCurrentView(true);
    },
  });
  const form = document.querySelector("#control-dialog-form");
  if (form) bindGlobalLabelColorPicker(form);
}

function confirmDeleteGlobalLabel(id, name) {
  confirmControlDelete("删除全局标签", `标签 ${name} 将从实例和所有已绑定制品中移除。`, "删除标签", async () => {
    await controlMutation("label", { id }, "DELETE");
    showToast("全局标签已删除");
    renderCurrentView(true);
  });
}

function adminQuotasTable(quotas) {
  if (!quotas.length) return emptyTable("暂无配额", "当前实例未返回项目配额。", "database");
  return `<table><thead><tr><th>项目</th><th>已使用</th><th>配额上限</th><th>使用率</th><th>最近更新</th><th></th></tr></thead><tbody>${quotas.map((quota) => {
    const ref = asObject(quota.ref);
    const used = toNumber(asObject(quota.used).storage);
    const hard = toNumber(asObject(quota.hard).storage);
    const unlimited = hard < 0;
    const percent = !unlimited && hard > 0 ? Math.min(100, used / hard * 100) : 0;
    return `<tr><td><div class="cell-title"><span class="cell-icon">${icon("folder")}</span><span class="cell-stack"><strong>${escapeHTML(ref.name || `项目 #${ref.id || "-"}`)}</strong><small>${escapeHTML(ref.owner_name || "-")}</small></span></div></td><td>${formatBytes(used)}</td><td>${unlimited ? "不限制" : formatBytes(hard)}</td><td><div class="quota-cell"><progress class="quota-track" max="100" value="${escapeAttr(percent.toFixed(1))}" aria-label="${unlimited ? "存储配额无限制" : `存储配额已使用 ${escapeAttr(percent.toFixed(1))}%`}">${escapeHTML(percent.toFixed(1))}%</progress><small>${unlimited ? "无限制" : `${percent.toFixed(1)}%`}</small></div></td><td>${formatDate(quota.update_time || quota.creation_time)}</td><td><button class="icon-button" type="button" data-action="edit-quota" data-id="${escapeAttr(quota.id)}" title="修改配额" aria-label="修改配额">${icon("edit")}</button></td></tr>`;
  }).join("")}</tbody></table>`;
}

function scannerManagementSection(route, collection) {
  return `<section class="table-shell"><div class="table-toolbar">${controlSearchForm("security-scanner-search", route.filter, "按扫描器名称搜索")}<div class="toolbar-spacer"></div><button class="button button-small button-primary" type="button" data-action="create-scanner">${icon("plus")}<span>注册扫描器</span></button></div><div class="table-scroll">${adminScannersTable(collection.items)}</div>${controlPagination(collection.pagination)}</section>`;
}

function adminScannersTable(scanners) {
  if (!scanners.length) return emptyTable("暂无扫描器", "注册兼容 Harbor Scanner Adapter API 的扫描器。", "shield");
  return `<table><thead><tr><th>扫描器</th><th>地址</th><th>健康状态</th><th>能力</th><th>最近更新</th><th></th></tr></thead><tbody>${scanners.map((scanner) => `<tr><td><div class="cell-title"><span class="cell-icon">${icon("shield")}</span><span class="cell-stack"><strong>${escapeHTML(scanner.name)}</strong><small>${escapeHTML([scanner.vendor, scanner.version].filter(Boolean).join(" · ") || scanner.description || scanner.uuid)}</small></span></div></td><td class="truncate-cell mono">${escapeHTML(scanner.url)}</td><td>${scanner.disabled ? '<span class="badge">已停用</span>' : statusBadge(scanner.health)}</td><td>${scanner.is_default ? '<span class="badge badge-orange">默认</span>' : '<span class="badge badge-blue">已注册</span>'}</td><td>${formatDate(scanner.update_time || scanner.create_time)}</td><td><div class="row-actions"><button class="icon-button" type="button" data-action="view-scanner-metadata" data-id="${escapeAttr(scanner.uuid)}" title="查看扫描器元数据" aria-label="查看扫描器元数据">${icon("info")}</button><button class="icon-button" type="button" data-action="ping-scanner" data-id="${escapeAttr(scanner.uuid)}" title="测试连接" aria-label="测试连接">${icon("refresh")}</button>${scanner.is_default ? "" : `<button class="icon-button" type="button" data-action="default-scanner" data-id="${escapeAttr(scanner.uuid)}" title="设为默认" aria-label="设为默认">${icon("check")}</button>`}<button class="icon-button" type="button" data-action="edit-scanner" data-id="${escapeAttr(scanner.uuid)}" title="编辑扫描器" aria-label="编辑扫描器">${icon("edit")}</button><button class="icon-button danger-icon" type="button" data-action="delete-scanner" data-id="${escapeAttr(scanner.uuid)}" data-name="${escapeAttr(scanner.name)}" title="删除扫描器" aria-label="删除扫描器">${icon("trash")}</button></div></td></tr>`).join("")}</tbody></table>`;
}

function adminMaintenanceSection(collection) {
  const gcSchedule = asObject(collection.gcSchedule);
  const scanSchedule = asObject(collection.scanSchedule);
  const scanMetrics = asObject(collection.scanMetrics);
  return `<div class="maintenance-grid">
    ${maintenanceCard("垃圾清理", "删除不再被清单引用的存储对象", gcSchedule, `<button class="button button-small" type="button" data-action="edit-gc-schedule">${icon("settings")}<span>计划</span></button><button class="button button-small button-primary" type="button" data-action="run-gc">${icon("play")}<span>立即执行</span></button>`, gcSchedule.load_error)}
    ${maintenanceCard("全量漏洞扫描", `最近进度 ${formatNumber(scanMetrics.completed)} / ${formatNumber(scanMetrics.total)}`, scanSchedule, `<button class="button button-small" type="button" data-action="edit-scan-schedule">${icon("settings")}<span>计划</span></button><button class="button button-small" type="button" data-action="stop-scan-all">${icon("x")}<span>停止</span></button><button class="button button-small button-primary" type="button" data-action="run-scan-all">${icon("play")}<span>立即扫描</span></button>`, scanSchedule.load_error || scanMetrics.load_error)}
    <section class="table-shell maintenance-history"><div class="table-toolbar"><strong>垃圾清理执行历史</strong><div class="toolbar-spacer"></div></div><div class="table-scroll">${gcHistoryTable(collection.items)}</div>${controlPagination(collection.pagination)}</section>
  </div>`;
}

function maintenanceCard(title, description, value, actions, error) {
  const schedule = asObject(value.schedule);
  const custom = adminScheduleUsesCron(schedule.type);
  return `<section class="maintenance-card"><div class="maintenance-card-head"><span class="cell-icon">${icon("history")}</span><div><h2>${escapeHTML(title)}</h2><p>${escapeHTML(description)}</p></div></div>${error ? `<div class="warning-banner">${icon("alert")}<span>${escapeHTML(error)}</span></div>` : `<dl class="maintenance-facts ${custom ? "" : "maintenance-facts-compact"}"><div><dt>计划类型</dt><dd>${adminScheduleType(schedule.type)}</dd></div><div><dt>下次运行</dt><dd>${formatDate(schedule.next_scheduled_time)}</dd></div>${custom ? `<div><dt>Cron</dt><dd class="mono">${escapeHTML(schedule.cron || "-")}</dd></div>` : ""}</dl>`}<div class="maintenance-actions">${actions}</div></section>`;
}

function adminScheduleType(value) {
  const labels = { Hourly: "每小时", Daily: "每天", Weekly: "每周", Custom: "自定义", Schedule: "定时", Manual: "手动", None: "已关闭" };
  return labels[value] || value || "未配置";
}

function adminScheduleUsesCron(type) {
  return ["Custom", "Schedule"].includes(String(type || ""));
}

function adminPresetScheduleCron(type, hour) {
  const normalizedHour = Math.min(23, Math.max(0, Number.parseInt(hour, 10) || 0));
  if (type === "Hourly") return "0 0 * * * *";
  if (type === "Daily") return `0 0 ${normalizedHour} * * *`;
  if (type === "Weekly") return `0 0 ${normalizedHour} * * 0`;
  return "";
}

function adminScheduleValue(type, current, customCron, defaultHour) {
  const normalizedType = type === "Schedule" ? "Custom" : type;
  const schedule = { type: normalizedType };
  if (adminScheduleUsesCron(normalizedType)) {
    schedule.cron = String(customCron || "").trim();
    return schedule;
  }
  if (["Hourly", "Daily", "Weekly"].includes(normalizedType)) {
    const existingCron = String(current?.cron || "").trim();
    schedule.cron = current?.type === normalizedType && existingCron
      ? existingCron
      : adminPresetScheduleCron(normalizedType, defaultHour);
  }
  return schedule;
}

function bindAdminScheduleForm(form) {
  const type = form?.elements.namedItem("type");
  const cronField = form?.querySelector("[data-schedule-cron-field]");
  const cron = form?.elements.namedItem("cron");
  if (!type || !cronField || !cron) return;
  const sync = () => {
    const custom = adminScheduleUsesCron(type.value);
    cronField.hidden = !custom;
    cron.disabled = !custom;
    cron.required = custom;
  };
  type.addEventListener("change", sync);
  sync();
}

function gcHistoryTable(items) {
  if (!items.length) return emptyTable("暂无清理记录", "执行垃圾清理后会显示在这里。", "history");
  return `<table><thead><tr><th>任务</th><th>方式</th><th>状态</th><th>清理结果</th><th>开始时间</th><th>最近更新</th><th>操作</th></tr></thead><tbody>${items.map((job) => `<tr><td class="mono">#${escapeHTML(job.id)}</td><td>${adminScheduleType(job.job_kind)}</td><td>${statusBadge(job.job_status)}</td><td>${job.dry_run ? '<span class="badge badge-blue">仅演练</span>' : job.deleted ? '<span class="badge badge-green">已清理</span>' : '<span class="badge">未删除</span>'}</td><td>${formatDate(job.creation_time)}</td><td>${formatDate(job.update_time)}</td><td><div class="row-actions"><button class="icon-button" type="button" data-action="view-gc-log" data-id="${escapeAttr(job.id)}" title="查看日志" aria-label="查看垃圾清理任务 ${escapeAttr(job.id)} 日志">${icon("history")}</button>${["running", "pending"].includes(String(job.job_status || "").toLowerCase()) ? `<button class="icon-button danger-icon" type="button" data-action="stop-gc" data-id="${escapeAttr(job.id)}" title="停止任务" aria-label="停止任务">${icon("x")}</button>` : ""}</div></td></tr>`).join("")}</tbody></table>`;
}

function adminPurgeSection(collection) {
	const schedule = asObject(collection.purgeSchedule);
	const scheduleValue = asObject(schedule.schedule);
	const parameters = asObject(schedule.parameters);
	const loadError = collection.load_error || schedule.load_error;
	return `<div class="maintenance-grid purge-admin-layout">
		<section class="maintenance-card"><div class="maintenance-card-head"><span class="cell-icon">${icon("trash")}</span><div><h2>审计日志清理</h2><p>按保留期限和事件类型清理 Harbor 数据库审计记录</p></div></div>${loadError ? `<div class="warning-banner">${icon("alert")}<span>${escapeHTML(loadError)}</span></div>` : `<dl class="maintenance-facts"><div><dt>执行计划</dt><dd>${adminScheduleType(scheduleValue.type)}</dd></div><div><dt>保留期限</dt><dd>${parameters.audit_retention_hour ? `${formatNumber(Math.ceil(toNumber(parameters.audit_retention_hour) / 24))} 天` : "未配置"}</dd></div><div><dt>下次运行</dt><dd>${formatDate(scheduleValue.next_scheduled_time)}</dd></div></dl>`}<div class="maintenance-actions"><button class="button button-small" type="button" data-action="edit-purge-schedule">${icon("settings")}<span>清理计划</span></button><button class="button button-small button-primary" type="button" data-action="run-purge">${icon("play")}<span>立即执行</span></button></div></section>
		<section class="table-shell maintenance-history"><div class="table-toolbar"><strong>审计清理执行历史</strong><div class="toolbar-spacer"></div><span class="muted">${formatNumber(collection.pagination?.total)} 次执行</span></div><div class="table-scroll">${purgeHistoryTable(collection.items)}</div>${controlPagination(collection.pagination)}</section>
	</div>`;
}

function purgeJobParameters(job) {
	if (job.parameters && typeof job.parameters === "object") return asObject(job.parameters);
	try { return asObject(JSON.parse(String(job.job_parameters || "{}"))); } catch { return {}; }
}

function purgeHistoryTable(items) {
	if (!items.length) return emptyTable("暂无审计清理记录", "执行审计日志清理后会显示在这里。", "history");
	return `<table><thead><tr><th>任务</th><th>方式</th><th>保留期限</th><th>模式</th><th>状态</th><th>开始时间</th><th>最近更新</th><th>操作</th></tr></thead><tbody>${items.map((job) => {
		const parameters = purgeJobParameters(job);
		const canStop = ["running", "pending", "inprogress", "in_progress"].includes(String(job.job_status || "").toLowerCase());
		return `<tr><td class="mono">#${escapeHTML(job.id)}</td><td>${adminScheduleType(job.job_kind)}</td><td>${formatNumber(Math.ceil(toNumber(parameters.audit_retention_hour) / 24))} 天</td><td>${parameters.dry_run ? '<span class="badge badge-blue">仅演练</span>' : '<span class="badge badge-orange">正式清理</span>'}</td><td>${statusBadge(job.job_status)}</td><td>${formatDate(job.creation_time)}</td><td>${formatDate(job.update_time)}</td><td><div class="row-actions"><button class="icon-button" type="button" data-action="view-purge-log" data-id="${escapeAttr(job.id)}" title="查看日志" aria-label="查看审计清理日志">${icon("history")}</button>${canStop ? `<button class="icon-button danger-icon" type="button" data-action="stop-purge" data-id="${escapeAttr(job.id)}" title="停止任务" aria-label="停止审计清理任务">${icon("x")}</button>` : ""}</div></td></tr>`;
	}).join("")}</tbody></table>`;
}

function adminJobServiceSection(collection) {
	const pools = asArray(collection.pools);
	const workers = asArray(collection.workers);
	const queues = asArray(collection.queues);
	const schedules = asArray(collection.schedules?.items);
	const activeWorkers = workers.filter((worker) => worker.job_id);
	const queued = queues.reduce((sum, queue) => sum + toNumber(queue.count), 0);
	const pausedQueues = queues.filter((queue) => queue.paused).length;
	return `<div class="jobservice-layout"><section class="overview-stats jobservice-stats" aria-label="Job Service 统计">${statCell("工作池", pools.length, "Job Service 进程池", "terminal")}${statCell("工作器", workers.length, `${activeWorkers.length} 个正在执行`, "users")}${statCell("排队任务", queued, `${pausedQueues} 个队列已暂停`, "history")}${statCell("定时任务", collection.schedules?.pagination?.total || schedules.length, asObject(collection.scheduleStatus).paused ? "调度器已暂停" : "调度器运行中", "settings")}</section><section class="table-shell"><div class="table-toolbar"><strong>工作池</strong><div class="toolbar-spacer"></div></div><div class="table-scroll">${jobPoolTable(pools)}</div></section><section class="table-shell"><div class="table-toolbar"><strong>工作器与运行任务</strong><div class="toolbar-spacer"></div></div><div class="table-scroll">${jobWorkerTable(workers)}</div></section><section class="table-shell"><div class="table-toolbar"><strong>任务队列</strong><div class="toolbar-spacer"></div><button class="button button-small" type="button" data-action="resume-all-job-queues">${icon("play")}<span>恢复全部</span></button><button class="button button-small" type="button" data-action="pause-all-job-queues">${icon("settings")}<span>暂停全部</span></button><button class="button button-small button-danger" type="button" data-action="stop-all-job-queues">${icon("x")}<span>停止全部待处理</span></button></div><div class="table-scroll">${jobQueueTable(queues)}</div></section><section class="table-shell"><div class="table-toolbar"><strong>定时任务</strong><div class="toolbar-spacer"></div><span class="muted">${asObject(collection.scheduleStatus).paused ? "已暂停" : "运行中"}</span></div><div class="table-scroll">${jobScheduleTable(schedules)}</div>${dialogPagination(collection.schedules?.pagination, "control-page")}</section></div>`;
}

function jobPoolTable(pools) {
	if (!pools.length) return emptyTable("暂无工作池", "当前 Harbor 未返回 Job Service 工作池。", "terminal");
	return `<table><thead><tr><th>工作池</th><th>主机</th><th>进程</th><th>并发数</th><th>启动时间</th><th>最近心跳</th></tr></thead><tbody>${pools.map((pool) => `<tr><td class="mono">${escapeHTML(pool.worker_pool_id)}</td><td>${escapeHTML(pool.host || "-")}</td><td class="mono">${escapeHTML(pool.pid ?? "-")}</td><td>${formatNumber(pool.concurrency)}</td><td>${formatDate(pool.start_at)}</td><td>${formatDate(pool.heartbeat_at)}</td></tr>`).join("")}</tbody></table>`;
}

function jobWorkerTable(workers) {
	if (!workers.length) return emptyTable("暂无工作器", "当前工作池没有返回工作器。", "users");
	return `<table><thead><tr><th>工作器</th><th>工作池</th><th>任务类型</th><th>任务 ID</th><th>状态</th><th>开始时间</th><th>最近签入</th><th>操作</th></tr></thead><tbody>${workers.map((worker) => `<tr><td class="mono">${escapeHTML(worker.id)}</td><td class="mono">${escapeHTML(worker.pool_id)}</td><td>${escapeHTML(worker.job_name || "空闲")}</td><td class="mono">${escapeHTML(worker.job_id || "-")}</td><td>${statusBadge(worker.job_id ? worker.check_in || "running" : "idle")}</td><td>${formatDate(worker.start_at)}</td><td>${formatDate(worker.checkin_at)}</td><td>${worker.job_id ? `<div class="row-actions"><button class="icon-button" type="button" data-action="view-jobservice-log" data-job="${escapeAttr(worker.job_id)}" title="查看日志" aria-label="查看运行任务日志">${icon("history")}</button><button class="icon-button danger-icon" type="button" data-action="stop-jobservice-job" data-job="${escapeAttr(worker.job_id)}" title="停止任务" aria-label="停止运行任务">${icon("x")}</button></div>` : "-"}</td></tr>`).join("")}</tbody></table>`;
}

function jobQueueTable(queues) {
	if (!queues.length) return emptyTable("暂无任务队列", "当前 Harbor 未返回 Job Service 队列。", "history");
	return `<table><thead><tr><th>任务类型</th><th>待处理</th><th>延迟</th><th>状态</th><th>操作</th></tr></thead><tbody>${queues.map((queue) => `<tr><td><strong>${escapeHTML(queue.job_type)}</strong></td><td>${formatNumber(queue.count)}</td><td>${formatNumber(queue.latency)} 秒</td><td>${queue.paused ? '<span class="badge badge-orange">已暂停</span>' : '<span class="badge badge-green">运行中</span>'}</td><td><div class="row-actions"><button class="icon-button" type="button" data-action="${queue.paused ? "resume-job-queue" : "pause-job-queue"}" data-type="${escapeAttr(queue.job_type)}" title="${queue.paused ? "恢复队列" : "暂停队列"}" aria-label="${queue.paused ? "恢复队列" : "暂停队列"}">${icon(queue.paused ? "play" : "settings")}</button><button class="icon-button danger-icon" type="button" data-action="stop-job-queue" data-type="${escapeAttr(queue.job_type)}" title="停止待处理任务" aria-label="停止队列中的待处理任务" ${toNumber(queue.count) <= 0 ? "disabled" : ""}>${icon("x")}</button></div></td></tr>`).join("")}</tbody></table>`;
}

function jobScheduleTable(schedules) {
	if (!schedules.length) return emptyTable("暂无定时任务", "当前 Harbor 未注册 Job Service 定时任务。", "settings");
	return `<table><thead><tr><th>计划</th><th>任务类型</th><th>关联资源</th><th>Cron</th><th>最近更新</th></tr></thead><tbody>${schedules.map((schedule) => `<tr><td class="mono">#${escapeHTML(schedule.id)}</td><td>${escapeHTML(schedule.vendor_type)}</td><td class="mono">#${escapeHTML(schedule.vendor_id)}</td><td><code>${escapeHTML(schedule.cron || "-")}</code></td><td>${formatDate(schedule.update_time)}</td></tr>`).join("")}</tbody></table>`;
}

function configurationRoute(tab = "auth") {
  return `#/administration/configuration?tab=${encodeURIComponent(tab)}`;
}

function adminConfigurationSection(collection, route) {
  const selected = ["auth", "security", "system"].includes(route.configTab) ? route.configTab : "auth";
  const config = asObject(collection.configuration);
  const tabs = [["auth", "认证"], ["security", "安全"], ["system", "系统设置"]];
  const body = selected === "auth" ? adminAuthenticationConfiguration(config) : selected === "security" ? adminSecurityConfiguration(collection) : adminSystemConfiguration(config, collection);
  return `<section class="administration-config"><nav class="config-subtabs" aria-label="配置管理页面">${tabs.map(([key, label]) => `<a href="${configurationRoute(key)}" class="${selected === key ? "active" : ""}" ${selected === key ? 'aria-current="page"' : ""}>${escapeHTML(label)}</a>`).join("")}</nav>${body}</section>`;
}

function adminAuthenticationConfiguration(config) {
  const mode = String(adminConfigValue(config, "auth_mode") || "db_auth");
  return `<form id="admin-auth-configuration-form" class="settings-form configuration-form"><div class="section-heading"><div><h2>认证配置</h2><p>Harbor 官方认证模式与身份提供方参数</p></div><div class="configuration-actions"><button id="test-auth-connection" class="button button-small" type="button">${icon("refresh")}<span>测试连接</span></button><button class="button button-small button-primary" type="submit">${icon("check")}<span>保存认证配置</span></button></div></div><section class="configuration-group"><div class="configuration-group-head"><h3>认证模式</h3><p>切换模式后填写对应的身份提供方参数</p></div><div class="form-grid two-columns"><label class="field"><span>认证模式</span><select name="auth_mode" ${adminConfigDisabledAttr(config, "auth_mode")}><option value="db_auth" ${mode === "db_auth" ? "selected" : ""}>数据库</option><option value="ldap_auth" ${mode === "ldap_auth" ? "selected" : ""}>LDAP</option><option value="uaa_auth" ${mode === "uaa_auth" ? "selected" : ""}>UAA</option><option value="oidc_auth" ${mode === "oidc_auth" ? "selected" : ""}>OIDC</option><option value="http_auth" ${mode === "http_auth" ? "selected" : ""}>HTTP 认证代理</option></select></label><div data-auth-common="external">${adminConfigToggle(config, "primary_auth_mode", "设为主认证模式", "优先使用外部身份提供方认证")}</div><div data-auth-common="db">${adminConfigToggle(config, "self_registration", "开放用户注册", "允许用户自行创建本地数据库账号")}</div></div></section><div id="auth-mode-fields">${adminAuthModePanels(config, mode)}</div></form>`;
}

function adminAuthModePanels(config, selectedMode) {
  const panel = (mode, title, content) => `<section class="configuration-group" data-auth-panel="${mode}" ${mode === selectedMode ? "" : "hidden"}><div class="configuration-group-head"><h3>${escapeHTML(title)}</h3><p>${mode === "ldap_auth" ? "用户和用户组目录连接" : mode === "oidc_auth" ? "OpenID Connect 单点登录" : mode === "uaa_auth" ? "Cloud Foundry UAA 认证" : "外部认证代理连接"}</p></div><div class="form-grid two-columns">${content}</div></section>`;
  const requireUAASecret = selectedMode !== "uaa_auth";
  const requireOIDCSecret = selectedMode !== "oidc_auth";
  return [
    panel("ldap_auth", "LDAP 服务", [
      adminConfigText(config, "ldap_url", "LDAP 地址", { required: true, placeholder: "ldaps://ldap.example.com:636" }),
      adminConfigText(config, "ldap_timeout", "连接超时（秒）", { type: "number", required: true, min: 1, value: adminConfigValue(config, "ldap_timeout") || 5 }),
      adminConfigText(config, "ldap_search_dn", "搜索 DN", { placeholder: "cn=harbor,ou=services,dc=example,dc=com" }),
      adminConfigText(config, "ldap_search_password", "搜索密码", { type: "password", placeholder: "留空保持现有密码", value: "" }),
      adminConfigText(config, "ldap_base_dn", "用户 Base DN", { required: true, placeholder: "ou=users,dc=example,dc=com" }),
      adminConfigText(config, "ldap_filter", "用户搜索过滤器"),
      adminConfigText(config, "ldap_uid", "用户标识属性", { required: true, placeholder: "uid" }),
      adminConfigScope(config, "ldap_scope", "用户搜索范围"),
      adminConfigText(config, "ldap_group_base_dn", "用户组 Base DN"),
      adminConfigText(config, "ldap_group_search_filter", "用户组搜索过滤器"),
      adminConfigText(config, "ldap_group_attribute_name", "用户组名称属性", { placeholder: "cn" }),
      adminConfigText(config, "ldap_group_admin_dn", "管理员用户组 DN"),
      adminConfigText(config, "ldap_group_membership_attribute", "用户组成员属性", { placeholder: "memberOf" }),
      adminConfigScope(config, "ldap_group_search_scope", "用户组搜索范围"),
      `<div>${adminConfigToggle(config, "ldap_group_attach_parallel", "并行关联用户组", "使用并行工作线程读取用户组关系")}</div>`,
      `<div>${adminConfigToggle(config, "ldap_verify_cert", "验证 LDAP 证书", "连接 LDAPS 时校验服务端证书")}</div>`,
    ].join("")),
    panel("uaa_auth", "UAA 服务", [adminConfigText(config, "uaa_endpoint", "UAA 地址", { required: true, type: "url" }), adminConfigText(config, "uaa_client_id", "客户端 ID", { required: true }), adminConfigText(config, "uaa_client_secret", "客户端密钥", { type: "password", required: requireUAASecret, placeholder: requireUAASecret ? "首次启用 UAA 时必须填写" : "留空保持现有密钥", value: "" }), `<div>${adminConfigToggle(config, "uaa_verify_cert", "验证 UAA 证书", "校验 UAA 服务端 TLS 证书")}</div>`].join("")),
    panel("http_auth", "HTTP 认证代理", [adminConfigText(config, "http_authproxy_endpoint", "登录地址", { required: true, type: "url" }), adminConfigText(config, "http_authproxy_tokenreview_endpoint", "Token Review 地址", { required: true, type: "url" }), adminConfigText(config, "http_authproxy_admin_groups", "管理员用户组", { placeholder: "多个值用逗号分隔" }), adminConfigText(config, "http_authproxy_admin_usernames", "管理员用户名", { placeholder: "多个值用逗号分隔" }), `<div>${adminConfigToggle(config, "http_authproxy_verify_cert", "验证代理证书", "校验认证代理的 TLS 证书")}</div>`, `<div>${adminConfigToggle(config, "http_authproxy_skip_search", "跳过用户搜索", "添加成员时不预先搜索外部用户")}</div>`, `<label class="field field-span"><span>服务端证书</span><textarea name="http_authproxy_server_certificate" rows="5" ${adminConfigDisabledAttr(config, "http_authproxy_server_certificate")}>${escapeHTML(adminConfigValue(config, "http_authproxy_server_certificate") || "")}</textarea></label>`].join("")),
    panel("oidc_auth", "OIDC 提供方", [adminConfigText(config, "oidc_name", "提供方名称", { required: true }), adminConfigText(config, "oidc_endpoint", "OIDC 地址", { required: true, type: "url" }), adminConfigText(config, "oidc_client_id", "客户端 ID", { required: true }), adminConfigText(config, "oidc_client_secret", "客户端密钥", { type: "password", required: requireOIDCSecret, placeholder: requireOIDCSecret ? "首次启用 OIDC 时必须填写" : "留空保持现有密钥", value: "" }), adminConfigText(config, "oidc_groups_claim", "用户组 Claim", { placeholder: "groups" }), adminConfigText(config, "oidc_admin_group", "管理员用户组"), adminConfigText(config, "oidc_group_filter", "用户组过滤正则"), adminConfigText(config, "oidc_scope", "Scope", { required: true, placeholder: "openid,profile,email,groups" }), adminConfigText(config, "oidc_user_claim", "用户名 Claim", { placeholder: "preferred_username", disabled: !adminConfigValue(config, "oidc_auto_onboard"), dependency: "oidc-auto-onboard" }), adminConfigText(config, "oidc_extra_redirect_parms", "额外重定向参数"), `<div>${adminConfigToggle(config, "oidc_verify_cert", "验证 OIDC 证书", "校验身份提供方的 TLS 证书")}</div>`, `<div>${adminConfigToggle(config, "oidc_auto_onboard", "自动创建用户", "首次登录时自动加入 Harbor")}</div>`, `<div>${adminConfigToggle(config, "oidc_logout", "联动退出 OIDC", "退出 Harbor 时同时结束 OIDC 会话")}</div>`].join("")),
  ].join("");
}

function adminSecurityConfiguration(collection) {
  if (collection.allowlist_error) return `<div class="warning-banner">${icon("alert")}<span>系统 CVE 白名单载入失败：${escapeHTML(collection.allowlist_error)}</span></div>`;
  return `<form id="admin-security-configuration-form" class="settings-form configuration-form"><div class="section-heading"><div><h2>系统 CVE 白名单</h2><p>对应 Harbor 原版配置管理中的安全页面</p></div><button class="button button-small button-primary" type="submit">${icon("check")}<span>保存安全配置</span></button></div><section class="configuration-group">${allowlistEditorContent(asObject(collection.allowlist), "admin-system")}</section></form>`;
}

function adminSystemConfiguration(config, collection) {
  const banner = adminBannerValue(adminConfigValue(config, "banner_message"));
  const disabledEvents = new Set(String(adminConfigValue(config, "disabled_audit_log_event_types") || "").split(",").map((item) => item.trim()).filter(Boolean));
  const auditEvents = asArray(collection.auditEvents).map((item) => String(asObject(item).event_type || item)).filter(Boolean);
  const auditEndpoint = String(adminConfigValue(config, "audit_log_forward_endpoint") || "").trim();
  const bannerEnabled = Boolean(banner.message.trim());
  const bannerLocked = !adminConfigEditable(config, "banner_message");
  const bannerControlAttrs = `${bannerLocked || !bannerEnabled ? "disabled" : ""} ${bannerLocked ? "data-config-locked=\"true\"" : ""} data-banner-control`;
  const hasRootCertificate = Boolean(asObject(state.dashboard?.systeminfo).has_ca_root);
  const rootCertificate = hasRootCertificate ? `<div class="system-certificate-row"><span class="cell-icon">${icon("shield")}</span><span><strong>Harbor 根证书</strong><small>用于让 Docker、containerd 等客户端信任当前 Harbor 实例。</small></span><a class="button button-small" href="${controlURL("system-root-certificate")}" download>${icon("external")}<span>下载根证书</span></a></div>` : "";
  return `<form id="admin-system-configuration-form" class="settings-form configuration-form">
    <div class="section-heading"><div><h2>系统设置</h2><p>项目创建、会话、机器人账号、审计和横幅消息</p></div><button class="button button-small button-primary" type="submit">${icon("check")}<span>保存系统设置</span></button></div>
    <section class="configuration-group">
      <div class="configuration-group-head"><h3>账号与项目</h3><p>全局账号期限和项目创建规则</p></div>
      <div class="form-grid two-columns"><label class="field"><span>项目创建权限</span><select name="project_creation_restriction" ${adminConfigDisabledAttr(config, "project_creation_restriction")}><option value="adminonly" ${adminConfigValue(config, "project_creation_restriction") === "adminonly" ? "selected" : ""}>仅系统管理员</option><option value="everyone" ${adminConfigValue(config, "project_creation_restriction") === "everyone" ? "selected" : ""}>所有用户</option></select></label>${adminConfigText(config, "token_expiration", "令牌有效期（分钟）", { type: "number", required: true, min: 1, max: 9999999999 })}${adminConfigText(config, "session_timeout", "会话超时（分钟）", { type: "number", required: true, min: 1, max: 9999999999 })}${adminConfigText(config, "robot_name_prefix", "机器人账号名称前缀", { required: true, placeholder: "robot$" })}${adminConfigText(config, "robot_token_duration", "机器人令牌有效期（天）", { type: "number", required: true, min: 1, max: 9999999999 })}</div>
      ${rootCertificate}
    </section>
    <section class="configuration-group">
      <div class="configuration-group-head"><h3>运行策略</h3><p>写入、通知、扫描和默认配额</p></div>
      <div class="settings-grid">${adminConfigToggle(config, "read_only", "只读模式", "阻止制品推送、删除和复制写入")}${adminConfigToggle(config, "notification_enable", "启用 Webhook 通知", "允许 Harbor 发送事件通知")}${adminConfigToggle(config, "scanner_skip_update_pulltime", "扫描不更新拉取时间", "扫描器拉取制品时不修改拉取时间")}${adminConfigToggle(config, "quota_per_project_enable", "启用项目配额", "为新建项目应用默认存储限制")}</div>
      <div class="form-grid two-columns admin-config-fields"><label class="field"><span>默认项目配额（GiB）</span><input name="storage_per_project_gb" type="number" min="-1" step="1" value="${escapeAttr(adminStorageGB(adminConfigValue(config, "storage_per_project")))}" ${adminConfigDisabledAttr(config, "storage_per_project")}><small class="field-help">输入 -1 表示不限制。</small></label></div>
    </section>
    <section class="configuration-group">
      <div class="configuration-group-head"><h3>审计日志</h3><p>外部转发与数据库记录范围</p></div>
      <div class="form-grid two-columns">${adminConfigText(config, "audit_log_forward_endpoint", "审计日志转发地址", { type: "url", placeholder: "https://audit.example.com/events" })}<div>${adminConfigToggle(config, "skip_audit_log_database", "跳过数据库审计日志", "仅使用外部审计转发时启用", { disabled: !auditEndpoint, dependency: "audit-forward" })}</div></div>
      ${collection.audit_events_error ? `<div class="warning-banner settings-warning">${icon("alert")}<span>审计事件类型载入失败：${escapeHTML(collection.audit_events_error)}</span></div>` : auditEvents.length ? `<fieldset class="audit-event-config"><legend>写入数据库的事件类型</legend><div class="check-grid">${auditEvents.map((eventName) => `<label class="check-row"><input name="enabled_audit_event" type="checkbox" value="${escapeAttr(eventName)}" ${disabledEvents.has(eventName) ? "" : "checked"} ${adminConfigDisabledAttr(config, "disabled_audit_log_event_types")}><span><strong>${escapeHTML(auditEventLabel(eventName))}</strong><small>${escapeHTML(eventName)}</small></span></label>`).join("")}</div></fieldset>` : ""}
    </section>
    <section class="configuration-group">
      <div class="configuration-group-head"><h3>横幅消息</h3><p>在控制台顶部向所有用户显示实例公告</p></div>
      <div class="form-grid two-columns"><label class="field field-span"><span>消息内容</span><textarea name="banner_message_text" rows="4" maxlength="800" ${adminConfigDisabledAttr(config, "banner_message")} data-banner-message placeholder="留空表示不显示横幅">${escapeHTML(banner.message)}</textarea></label><label class="field"><span>消息类型</span><select name="banner_message_type" ${bannerControlAttrs}><option value="success" ${banner.type === "success" ? "selected" : ""}>成功</option><option value="info" ${banner.type === "info" ? "selected" : ""}>信息</option><option value="warning" ${banner.type === "warning" ? "selected" : ""}>警告</option><option value="danger" ${banner.type === "danger" ? "selected" : ""}>错误</option></select></label><div>${adminConfigToggle({ banner_closable: { value: banner.closable, editable: adminConfigEditable(config, "banner_message") } }, "banner_closable", "允许用户关闭", "显示关闭按钮，用户可隐藏本次公告", { disabled: !bannerEnabled, dependency: "banner-message" })}</div><label class="field"><span>开始日期</span><input name="banner_from_date" type="date" value="${escapeAttr(banner.fromDate)}" ${bannerControlAttrs}></label><label class="field"><span>结束日期</span><input name="banner_to_date" type="date" value="${escapeAttr(banner.toDate)}" ${bannerControlAttrs}></label></div>
    </section>
  </form>`;
}

function adminBannerValue(raw) {
  try {
    const parsed = JSON.parse(String(raw || ""));
    return { message: String(parsed.message || ""), type: ["success", "info", "warning", "danger"].includes(parsed.type) ? parsed.type : "warning", closable: Boolean(parsed.closable), fromDate: String(parsed.fromDate || "").slice(0, 10), toDate: String(parsed.toDate || "").slice(0, 10) };
  } catch {
    return { message: "", type: "warning", closable: false, fromDate: "", toDate: "" };
  }
}

function adminConfigText(config, key, label, options = {}) {
  const value = Object.hasOwn(options, "value") ? options.value : (adminConfigValue(config, key) ?? "");
  const locked = !adminConfigEditable(config, key);
  const attrs = [`name="${escapeAttr(key)}"`, `type="${escapeAttr(options.type || "text")}"`, `value="${escapeAttr(value)}"`];
  if (locked || options.disabled) attrs.push("disabled");
  if (locked) attrs.push('data-config-locked="true"');
  if (options.dependency) attrs.push(`data-config-dependency="${escapeAttr(options.dependency)}"`);
  if (options.required) attrs.push("required");
  if (options.min !== undefined) attrs.push(`min="${escapeAttr(options.min)}"`);
  if (options.max !== undefined) attrs.push(`max="${escapeAttr(options.max)}"`);
  if (options.type === "number") attrs.push('step="1"');
  if (options.pattern) attrs.push(`pattern="${escapeAttr(options.pattern)}"`);
  if (options.placeholder) attrs.push(`placeholder="${escapeAttr(options.placeholder)}"`);
  return `<label class="field"><span>${escapeHTML(label)}</span><input ${attrs.filter(Boolean).join(" ")}></label>`;
}

function adminConfigScope(config, key, label) {
  const value = toNumber(adminConfigValue(config, key));
  return `<label class="field"><span>${escapeHTML(label)}</span><select name="${escapeAttr(key)}" ${adminConfigDisabledAttr(config, key)}><option value="0" ${value === 0 ? "selected" : ""}>Base</option><option value="1" ${value === 1 ? "selected" : ""}>单层</option><option value="2" ${value === 2 ? "selected" : ""}>子树</option></select></label>`;
}

function adminConfigToggle(config, key, title, description, options = {}) {
  const locked = !adminConfigEditable(config, key);
  const attrs = [];
  if (locked || options.disabled) attrs.push("disabled");
  if (locked) attrs.push('data-config-locked="true"');
  if (options.dependency) attrs.push(`data-config-dependency="${escapeAttr(options.dependency)}"`);
  return `<label class="toggle-setting"><span><strong>${escapeHTML(title)}</strong><small>${escapeHTML(description)}</small></span><input name="${escapeAttr(key)}" type="checkbox" ${adminConfigValue(config, key) ? "checked" : ""} ${attrs.join(" ")}><i></i></label>`;
}

function adminConfigNumber(config, key, label, min) {
  return `<label class="field"><span>${escapeHTML(label)}</span><input name="${escapeAttr(key)}" type="number" min="${min}" step="1" value="${escapeAttr(adminConfigValue(config, key) ?? "")}"></label>`;
}

function adminConfigValue(config, key) {
  const value = config[key];
  return value && typeof value === "object" && !Array.isArray(value) && Object.hasOwn(value, "value") ? value.value : value;
}

function adminConfigEditable(config, key) {
  const item = config[key];
  return !(item && typeof item === "object" && !Array.isArray(item) && item.editable === false);
}

function adminConfigDisabledAttr(config, key) {
  return adminConfigEditable(config, key) ? "" : 'disabled data-config-locked="true"';
}

function adminStorageGB(value) {
  const bytes = toNumber(value);
  if (bytes < 0) return -1;
  return Number((bytes / 1024 ** 3).toFixed(2));
}

function bindAdministrationSection(route) {
  if (route.section === "users") bindControlSearch("admin-user-search", (term) => administrationRoute("users", 1, term));
  if (route.section === "groups") bindControlSearch("admin-group-search", (term) => administrationRoute("groups", 1, term));
  if (route.section === "robots") bindControlSearch("admin-robot-search", (term) => administrationRoute("robots", 1, term));
  if (route.section === "labels") bindControlSearch("admin-label-search", (term) => administrationRoute("labels", 1, term));
	const authForm = document.querySelector("#admin-auth-configuration-form");
	if (authForm) {
	  authForm.addEventListener("submit", saveAdminAuthenticationConfiguration);
	  authForm.elements.namedItem("auth_mode")?.addEventListener("change", () => syncAdminAuthMode(authForm));
	  authForm.elements.namedItem("oidc_auto_onboard")?.addEventListener("change", () => syncAdminOIDCUserClaim(authForm, true));
	  document.querySelector("#test-auth-connection")?.addEventListener("click", () => testAdminAuthentication(authForm));
	  syncAdminAuthMode(authForm);
	}
	const securityForm = document.querySelector("#admin-security-configuration-form");
	if (securityForm) {
	  securityForm.addEventListener("submit", saveAdminSecurityConfiguration);
	  bindAllowlistEditor(securityForm);
	}
	const systemForm = document.querySelector("#admin-system-configuration-form");
	if (systemForm) {
	  systemForm.addEventListener("submit", saveAdminSystemConfiguration);
	  bindAdminSystemDependencies(systemForm);
	}
}

function syncAdminAuthMode(form) {
  const mode = String(form.elements.namedItem("auth_mode")?.value || "db_auth");
  form.querySelectorAll("[data-auth-panel]").forEach((panel) => {
    const active = panel.dataset.authPanel === mode;
    panel.hidden = !active;
    panel.querySelectorAll("input,select,textarea").forEach((control) => { control.disabled = !active || control.dataset.configLocked === "true"; });
  });
  form.querySelectorAll("[data-auth-common]").forEach((container) => {
    const active = container.dataset.authCommon === "db" ? mode === "db_auth" : mode !== "db_auth";
    container.hidden = !active;
    container.querySelectorAll("input,select,textarea").forEach((control) => { control.disabled = !active || control.dataset.configLocked === "true"; });
  });
  if (mode !== "db_auth") {
    const selfRegistration = form.elements.namedItem("self_registration");
    if (selfRegistration) selfRegistration.checked = false;
  }
  const testButton = document.querySelector("#test-auth-connection");
  if (testButton) testButton.hidden = !["ldap_auth", "oidc_auth"].includes(mode);
  syncAdminOIDCUserClaim(form, false);
}

function syncAdminOIDCUserClaim(form, clearWhenDisabled) {
  const mode = String(form.elements.namedItem("auth_mode")?.value || "db_auth");
  const autoOnboard = form.elements.namedItem("oidc_auto_onboard");
  const userClaim = form.elements.namedItem("oidc_user_claim");
  if (!autoOnboard || !userClaim) return;
  const enabled = mode === "oidc_auth" && autoOnboard.checked && userClaim.dataset.configLocked !== "true";
  userClaim.disabled = !enabled;
  if (clearWhenDisabled && !enabled) userClaim.value = "";
}

function bindAdminSystemDependencies(form) {
  const auditEndpoint = form.elements.namedItem("audit_log_forward_endpoint");
  const skipDatabase = form.elements.namedItem("skip_audit_log_database");
  const syncAudit = () => {
    if (!skipDatabase) return;
    const enabled = Boolean(String(auditEndpoint?.value || "").trim()) && skipDatabase.dataset.configLocked !== "true";
    skipDatabase.disabled = !enabled;
    if (!enabled) skipDatabase.checked = false;
  };
  auditEndpoint?.addEventListener("input", syncAudit);
  syncAudit();

  const bannerMessage = form.elements.namedItem("banner_message_text");
  const bannerControls = [...form.querySelectorAll("[data-banner-control],[data-config-dependency=\"banner-message\"]")];
  const syncBanner = () => {
    const enabled = Boolean(String(bannerMessage?.value || "").trim());
    bannerControls.forEach((control) => {
      control.disabled = !enabled || control.dataset.configLocked === "true";
    });
  };
  bannerMessage?.addEventListener("input", syncBanner);
  syncBanner();
}

function showSystemRobotDialog(robot = null) {
  const collection = asObject(state.adminCollection);
  const metadata = asObject(collection.permissionMetadata);
  const projects = asArray(collection.projects);
  const permissions = asArray(robot?.permissions);
  const systemAccess = permissions.filter((permission) => permission.kind === "system").flatMap((permission) => asArray(permission.access));
  const allProjectPermission = permissions.find((permission) => permission.kind === "project" && permission.namespace === "*");
  const projectPermissions = new Map(permissions.filter((permission) => permission.kind === "project" && permission.namespace !== "*").map((permission) => [permission.namespace, asArray(permission.access)]));
  const projectMode = allProjectPermission ? "all" : projectPermissions.size ? "selected" : "none";
  const currentName = robot ? String(robot.name || "").replace(/^robot\$/, "") : "";
  const projectEditor = systemProjectPermissionEditor(projects, projectPermissions, asArray(metadata.project));
  openControlDialog({
    title: robot ? "编辑系统机器人" : "新建系统机器人",
    subtitle: "系统权限和项目权限均来自 Harbor 官方权限元数据",
    submitLabel: robot ? "保存账号" : "创建账号",
    content: `<div class="form-grid two-columns"><label class="field"><span>账号名称</span><input name="name" required maxlength="255" value="${escapeAttr(currentName)}" ${robot ? "disabled" : ""} autocomplete="off" placeholder="例如 global-mirror"></label>${robotDurationControl(robot?.duration)}<label class="field field-span"><span>描述</span><input name="description" maxlength="1024" value="${escapeAttr(robot?.description || "")}"></label><label class="check-row field-span"><input name="disable" type="checkbox" ${robot?.disable ? "checked" : ""}><span><strong>停用账号</strong><small>保留权限配置但禁止认证</small></span></label></div>${permissionMatrix(asArray(metadata.system), systemAccess, "system_access", "系统权限")}<section class="robot-project-scope"><div class="section-heading compact-heading"><div><h3>项目权限</h3><p>可不授予、覆盖全部项目，或分别配置指定项目。</p></div><label class="field scope-select"><span>授权范围</span><select name="project_scope"><option value="none" ${projectMode === "none" ? "selected" : ""}>不授予项目权限</option><option value="all" ${projectMode === "all" ? "selected" : ""}>全部项目</option><option value="selected" ${projectMode === "selected" ? "selected" : ""}>指定项目</option></select></label></div><div data-project-scope="all" ${projectMode === "all" ? "" : "hidden"}>${permissionMatrix(asArray(metadata.project), asArray(allProjectPermission?.access), "all_project_access", "全部项目权限", true)}</div><div data-project-scope="selected" ${projectMode === "selected" ? "" : "hidden"}>${projectEditor}</div></section>`,
    onSubmit: async (formData) => {
      const robotPermissions = [];
      const selectedSystemAccess = permissionAccessFromForm(formData, "system_access");
      if (selectedSystemAccess.length) robotPermissions.push({ kind: "system", namespace: "/", access: selectedSystemAccess });
      const scope = String(formData.get("project_scope") || "none");
      if (scope === "all") {
        const access = permissionAccessFromForm(formData, "all_project_access");
        validateRobotAccess(access, "全部项目");
        robotPermissions.push({ kind: "project", namespace: "*", access });
      } else if (scope === "selected") {
        const selectedProjects = new Set(formData.getAll("project_namespace").map(String));
        if (!selectedProjects.size) throw new Error("请选择至少一个项目，或改为不授予项目权限");
        projects.forEach((project, index) => {
          if (!selectedProjects.has(project.name)) return;
          const access = permissionAccessFromForm(formData, `project_access__${index}`);
          validateRobotAccess(access, project.name);
          robotPermissions.push({ kind: "project", namespace: project.name, access });
        });
      }
      if (!robotPermissions.length) throw new Error("请至少授予一项系统权限或项目权限");
      const payload = { name: robot?.name || String(formData.get("name") || "").trim(), description: String(formData.get("description") || "").trim(), level: "system", duration: robotDurationFromForm(formData), disable: formData.has("disable"), permissions: robotPermissions };
      const result = await controlMutation(robot ? "robot" : "robots", robot ? { id: robot.id } : {}, robot ? "PUT" : "POST", payload);
      closeControlDialog();
      if (!robot && result?.data?.secret) showRobotSecret(result.data);
      else {
        showToast("系统机器人已更新");
        renderCurrentView(true);
      }
    },
  });
  document.querySelector("#control-dialog .control-dialog")?.classList.add("control-dialog-wide");
  bindSystemRobotForm();
}

function systemProjectPermissionEditor(projects, projectPermissions, candidates) {
  if (!projects.length) return `<div class="warning-banner">${icon("alert")}<span>当前账号看不到可授权的项目。</span></div>`;
  const activeIndex = projects.findIndex((project) => projectPermissions.has(project.name));
  const rows = projects.map((project, index) => {
    const selected = projectPermissions.has(project.name);
    const active = index === activeIndex;
    return `<article class="system-project-permission ${active ? "active" : ""}" data-project-permission-row="${index}"><label class="system-project-choice"><input type="checkbox" name="project_namespace" value="${escapeAttr(project.name)}" data-project-index="${index}" ${selected ? "checked" : ""}><span><strong>${escapeHTML(project.name)}</strong><small>${formatNumber(project.repo_count)} 个仓库</small></span></label><button class="icon-button" type="button" data-project-permission-open="${index}" ${selected ? "" : "disabled"} title="配置 ${escapeAttr(project.name)} 权限" aria-label="配置 ${escapeAttr(project.name)} 权限">${icon("settings")}</button></article>`;
  }).join("");
  const panels = projects.map((project, index) => `<div data-project-permission-panel="${index}" ${index === activeIndex ? "" : "hidden"}>${permissionMatrix(candidates, projectPermissions.get(project.name) || [], `project_access__${index}`, `${project.name} 的权限`, true)}</div>`).join("");
  return `<div class="system-project-editor"><div class="system-project-list">${rows}</div><div class="system-project-details"><div class="system-project-empty" data-project-permission-empty ${activeIndex >= 0 ? "hidden" : ""}>${icon("folder")}<strong>选择一个项目</strong><span>勾选项目后，在这里配置它的 Harbor 权限。</span></div>${panels}</div></div>`;
}

function bindSystemRobotForm() {
  const form = document.querySelector("#control-dialog-form");
  if (!form) return;
  const applyScope = () => {
    const mode = String(form.elements.project_scope?.value || "none");
    form.querySelectorAll("[data-project-scope]").forEach((section) => { section.hidden = section.dataset.projectScope !== mode; });
  };
  form.elements.project_scope?.addEventListener("change", applyScope);
  const activateProject = (index = "") => {
    const checkbox = index === "" ? null : form.querySelector(`[data-project-index="${CSS.escape(index)}"]`);
    const activeIndex = checkbox?.checked ? index : "";
    form.querySelectorAll("[data-project-permission-panel]").forEach((panel) => { panel.hidden = panel.dataset.projectPermissionPanel !== activeIndex; });
    form.querySelectorAll("[data-project-permission-row]").forEach((row) => { row.classList.toggle("active", row.dataset.projectPermissionRow === activeIndex); });
    const empty = form.querySelector("[data-project-permission-empty]");
    if (empty) empty.hidden = activeIndex !== "";
  };
  form.querySelectorAll("[data-project-index]").forEach((checkbox) => checkbox.addEventListener("change", () => {
    const button = form.querySelector(`[data-project-permission-open="${CSS.escape(checkbox.dataset.projectIndex)}"]`);
    if (button) button.disabled = !checkbox.checked;
    if (checkbox.checked) activateProject(checkbox.dataset.projectIndex);
    else if (form.querySelector(`[data-project-permission-row="${CSS.escape(checkbox.dataset.projectIndex)}"]`)?.classList.contains("active")) {
      const next = form.querySelector("[data-project-index]:checked");
      activateProject(next?.dataset.projectIndex || "");
    }
  }));
  form.querySelectorAll("[data-project-permission-open]").forEach((button) => button.addEventListener("click", () => activateProject(button.dataset.projectPermissionOpen)));
  bindRobotPermissionBehavior(form);
  applyScope();
}

function confirmDeleteSystemRobot(id, name) {
  confirmControlDelete("删除系统机器人", `账号 ${name} 将立即失去全部系统和项目访问权限。`, "删除账号", async () => {
    await controlMutation("robot", { id }, "DELETE");
    showToast("系统机器人已删除");
    renderCurrentView(true);
  });
}

function findAdminItem(items, id, field = "id") {
  return asArray(items).find((item) => String(item[field]) === String(id));
}

function showAdminUserDialog(user = null) {
  if (!user && accountAuthMode() !== "db_auth") {
    showToast("当前认证模式不允许创建本地用户", true);
    return;
  }
  openControlDialog({
    title: user ? "编辑用户" : "新建本地用户",
    subtitle: user ? user.username : "仅数据库认证模式支持创建本地用户",
    submitLabel: user ? "保存用户" : "创建用户",
    content: `<div class="form-grid two-columns">${user ? "" : `<label class="field"><span>用户名</span><input name="username" required maxlength="255" pattern="[A-Za-z0-9_.-]+" autocomplete="off"></label><label class="field"><span>初始密码</span><input name="password" type="password" required minlength="8" maxlength="4096" autocomplete="new-password"></label>`}<label class="field"><span>姓名</span><input name="realname" maxlength="255" value="${escapeAttr(user?.realname || "")}"></label><label class="field"><span>邮箱</span><input name="email" type="email" maxlength="255" value="${escapeAttr(user?.email || "")}"></label><label class="field field-span"><span>备注</span><textarea name="comment" rows="3" maxlength="1024">${escapeHTML(user?.comment || "")}</textarea></label></div>`,
    onSubmit: async (formData) => {
      const profile = { email: String(formData.get("email") || "").trim(), realname: String(formData.get("realname") || "").trim(), comment: String(formData.get("comment") || "").trim() };
      const payload = user ? profile : { ...profile, username: String(formData.get("username") || "").trim(), password: String(formData.get("password") || "") };
      await controlMutation(user ? "user" : "users", user ? { id: user.user_id } : {}, user ? "PUT" : "POST", payload);
      closeControlDialog();
      showToast(user ? "用户资料已更新" : "用户已创建");
      renderCurrentView(true);
    },
  });
}

function showLDAPImportDialog() {
  if (accountAuthMode() !== "ldap_auth") {
    showToast("仅 LDAP 认证模式支持目录导入", true);
    return;
  }
  openControlDialog({
    title: "导入 LDAP 用户",
    subtitle: "从 Harbor 已配置的 LDAP 目录搜索并导入用户",
    submitLabel: "导入已选择用户",
    dialogClass: "control-dialog-large",
    content: `<div class="directory-search"><label class="field"><span>用户标识</span><input id="ldap-user-query" type="search" maxlength="255" autocomplete="off" placeholder="按 LDAP 用户名搜索"></label><button id="ldap-user-search" class="button button-small" type="button">${icon("search")}<span>搜索目录</span></button></div><div id="ldap-user-results" class="directory-results"><div class="dialog-loading"><span class="spinner"></span><span>正在读取 LDAP 用户...</span></div></div>`,
    onSubmit: async (_formData, form) => {
      const selected = [...form.querySelectorAll('[name="ldap_uid_list"]:checked')].map((input) => input.value);
      if (!selected.length) throw new Error("请至少选择一个 LDAP 用户");
      await controlMutation("ldap-users-import", {}, "POST", { ldap_uid_list: selected });
      closeControlDialog();
      showToast(`已提交 ${formatNumber(selected.length)} 个 LDAP 用户导入`);
      renderCurrentView(true);
    },
  });
  const form = document.querySelector("#control-dialog-form");
  const input = form?.querySelector("#ldap-user-query");
  const search = () => loadLDAPDirectoryUsers(String(input?.value || "").trim());
  form?.querySelector("#ldap-user-search")?.addEventListener("click", search);
  input?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    search();
  });
  loadLDAPDirectoryUsers("");
}

async function loadLDAPDirectoryUsers(term) {
  const output = document.querySelector("#ldap-user-results");
  if (!output) return;
  output.innerHTML = `<div class="dialog-loading"><span class="spinner"></span><span>正在搜索 LDAP 目录...</span></div>`;
  try {
    const result = await controlList("ldap-users-search", { username: term });
    if (!document.body.contains(output)) return;
    output.innerHTML = ldapDirectoryUserResults(result.items);
  } catch (error) {
    if (!document.body.contains(output)) return;
    output.innerHTML = `<div class="directory-state directory-state-error">${icon("alert")}<div><strong>LDAP 用户搜索失败</strong><span>${escapeHTML(error.message)}</span></div></div>`;
  }
}

function ldapDirectoryUserResults(users) {
  if (!users.length) return `<div class="directory-state">${icon("users")}<div><strong>没有匹配的 LDAP 用户</strong><span>调整用户名后重新搜索。</span></div></div>`;
  return `<div class="directory-result-head"><span>目录用户</span><span>${formatNumber(users.length)} 个结果</span></div><div class="directory-selection-list">${users.map((user) => `<label class="directory-selection-row"><input name="ldap_uid_list" type="checkbox" value="${escapeAttr(user.username)}"><span class="user-avatar-small">${escapeHTML(Array.from(user.username || "U")[0]?.toUpperCase() || "U")}</span><span class="cell-stack"><strong>${escapeHTML(user.username)}</strong><small>${escapeHTML([user.realname, user.email].filter(Boolean).join(" · ") || "LDAP 用户")}</small></span></label>`).join("")}</div>`;
}

function toggleAdminUser(id, currentlyAdmin) {
  const actionLabel = currentlyAdmin ? "撤销系统管理员" : "授予系统管理员";
  openControlDialog({
    title: actionLabel,
    subtitle: "权限修改将立即生效",
    submitLabel: "确认修改",
    destructive: currentlyAdmin,
    content: `<div class="destructive-message">${icon("alert")}<span>${currentlyAdmin ? "该用户将失去系统级管理权限。" : "该用户将可以管理整个 Harbor 实例。"}</span></div>`,
    onSubmit: async () => {
      await controlMutation("user-sysadmin", { id }, "PUT", { sysadmin_flag: !currentlyAdmin });
      closeControlDialog();
      showToast("用户系统权限已更新");
      renderCurrentView(true);
    },
  });
}

function showAdminPasswordDialog(id, username) {
  openControlDialog({
    title: "重置用户密码",
    subtitle: username,
    submitLabel: "更新密码",
    content: `<div class="form-grid"><label class="field"><span>新密码</span><input name="new_password" type="password" required minlength="8" maxlength="4096" autocomplete="new-password"></label><label class="field"><span>再次输入</span><input name="confirmation" type="password" required minlength="8" maxlength="4096" autocomplete="new-password"></label></div>`,
    onSubmit: async (formData) => {
      const password = String(formData.get("new_password") || "");
      if (password !== String(formData.get("confirmation") || "")) throw new Error("两次输入的密码不一致");
      await controlMutation("user-password", { id }, "PUT", { new_password: password });
      closeControlDialog();
      showToast("用户密码已更新");
    },
  });
}

function confirmDeleteAdminUser(id, name) {
  confirmControlDelete("删除用户", `用户 ${name} 将被 Harbor 标记为已删除，并失去所有访问权限。`, "删除用户", async () => {
    await controlMutation("user", { id }, "DELETE");
    showToast("用户已删除");
    renderCurrentView(true);
  }, name);
}

function showUserGroupDialog(group = null) {
  openControlDialog({
    title: group ? "编辑用户组" : "新建用户组",
    subtitle: "用户组由 Harbor 官方 User Group API 管理",
    submitLabel: group ? "保存用户组" : "创建用户组",
    content: `<div class="form-grid"><label class="field"><span>用户组名称</span><input name="group_name" required maxlength="255" value="${escapeAttr(group?.group_name || "")}"></label><label class="field"><span>用户组来源</span><select name="group_type"><option value="1" ${toNumber(group?.group_type) === 1 ? "selected" : ""}>LDAP</option><option value="2" ${toNumber(group?.group_type) === 2 ? "selected" : ""}>HTTP</option><option value="3" ${!group || toNumber(group.group_type) === 3 ? "selected" : ""}>OIDC</option></select></label><label class="field"><span>LDAP 组 DN</span><input name="ldap_group_dn" maxlength="1024" value="${escapeAttr(group?.ldap_group_dn || "")}" placeholder="LDAP 类型必填"></label></div>`,
    onSubmit: async (formData) => {
      const payload = { group_name: String(formData.get("group_name") || "").trim(), group_type: Number(formData.get("group_type")), ldap_group_dn: String(formData.get("ldap_group_dn") || "").trim() };
      await controlMutation(group ? "user-group" : "user-groups", group ? { id: group.id } : {}, group ? "PUT" : "POST", payload);
      closeControlDialog();
      showToast(group ? "用户组已更新" : "用户组已创建");
      renderCurrentView(true);
    },
  });
}

function confirmDeleteUserGroup(id, name) {
  confirmControlDelete("删除用户组", `用户组 ${name} 将从 Harbor 中删除。`, "删除用户组", async () => {
    await controlMutation("user-group", { id }, "DELETE");
    showToast("用户组已删除");
    renderCurrentView(true);
  });
}

function showQuotaDialog(quota) {
  if (!quota) return;
  const hard = toNumber(asObject(quota.hard).storage);
  const project = asObject(quota.ref).name || `项目 #${asObject(quota.ref).id || "-"}`;
  openControlDialog({
    title: "修改项目配额",
    subtitle: project,
    submitLabel: "保存配额",
    content: `<div class="form-grid"><label class="field"><span>存储上限（GB）</span><input name="storage" type="number" min="-1" step="0.1" required value="${escapeAttr(hard < 0 ? -1 : adminStorageGB(hard))}"></label><p class="field-help">输入 -1 表示不限制；修改不会删除已有制品。</p></div>`,
    onSubmit: async (formData) => {
      const gigabytes = Number(formData.get("storage"));
      const storage = gigabytes < 0 ? -1 : Math.round(gigabytes * 1024 ** 3);
      await controlMutation("quota", { id: quota.id }, "PUT", { hard: { storage } });
      closeControlDialog();
      showToast("项目配额已更新");
      renderCurrentView(true);
    },
  });
}

function showScannerDialog(scanner = null) {
  openControlDialog({
    title: scanner ? "编辑扫描器" : "注册扫描器",
    subtitle: "兼容 Harbor Scanner Adapter API",
    submitLabel: scanner ? "保存扫描器" : "注册扫描器",
    content: `<div class="form-grid two-columns"><label class="field"><span>名称</span><input name="name" required maxlength="255" value="${escapeAttr(scanner?.name || "")}"></label><label class="field"><span>认证方式</span><select name="auth"><option value="" ${!scanner?.auth ? "selected" : ""}>无认证</option><option value="Basic" ${scanner?.auth === "Basic" ? "selected" : ""}>Basic</option><option value="Bearer" ${scanner?.auth === "Bearer" ? "selected" : ""}>Bearer</option><option value="X-ScannerAdapter-API-Key" ${scanner?.auth === "X-ScannerAdapter-API-Key" ? "selected" : ""}>API Key</option></select></label><label class="field field-span"><span>适配器地址</span><input name="url" type="url" required value="${escapeAttr(scanner?.url || "")}" placeholder="http://scanner-adapter:8080"></label><label class="field field-span"><span>访问凭据</span><input name="access_credential" type="password" maxlength="4096" autocomplete="new-password" placeholder="${scanner ? "留空保留原凭据" : "认证方式为无认证时可留空"}"></label><label class="field field-span"><span>描述</span><textarea name="description" rows="3" maxlength="1024">${escapeHTML(scanner?.description || "")}</textarea></label></div><div class="check-grid"><label class="check-row"><input name="disabled" type="checkbox" ${scanner?.disabled ? "checked" : ""}><span><strong>停用扫描器</strong></span></label><label class="check-row"><input name="skip_cert_verify" type="checkbox" ${scanner?.skip_certVerify ? "checked" : ""}><span><strong>跳过 TLS 验证</strong></span></label><label class="check-row"><input name="use_internal_addr" type="checkbox" ${scanner?.use_internal_addr ? "checked" : ""}><span><strong>使用内部仓库地址</strong></span></label></div>`,
    onSubmit: async (formData) => {
      const payload = { name: String(formData.get("name") || "").trim(), description: String(formData.get("description") || "").trim(), url: String(formData.get("url") || "").trim(), auth: String(formData.get("auth") || ""), access_credential: String(formData.get("access_credential") || ""), disabled: formData.has("disabled"), skip_certVerify: formData.has("skip_cert_verify"), use_internal_addr: formData.has("use_internal_addr") };
      await controlMutation(scanner ? "scanner" : "scanners", scanner ? { id: scanner.uuid } : {}, scanner ? "PUT" : "POST", payload);
      closeControlDialog();
      showToast(scanner ? "扫描器已更新" : "扫描器已注册");
      renderCurrentView(true);
    },
  });
}

async function pingScanner(id) {
  const scanner = findAdminItem(state.scannerItems, id, "uuid");
  if (!scanner) return;
  try {
    await controlMutation("scanner-ping", {}, "POST", { name: scanner.name, url: scanner.url, auth: scanner.auth || "", access_credential: "", skip_certVerify: Boolean(scanner.skip_certVerify), use_internal_addr: Boolean(scanner.use_internal_addr) });
    showToast("扫描器连接正常");
  } catch (error) {
    showToast(error.message, true);
  }
}

function scannerMetadataContent(metadata) {
  const scanner = asObject(metadata.scanner);
  const capabilities = asArray(metadata.capabilities);
  const properties = Object.entries(asObject(metadata.properties));
  return `<div class="scanner-metadata-layout"><section class="scanner-metadata-summary"><span class="cell-icon">${icon("shield")}</span><div><h3>${escapeHTML(scanner.name || "未知扫描器")}</h3><p>${escapeHTML([scanner.vendor, scanner.version].filter(Boolean).join(" · ") || "Harbor Scanner Adapter")}</p></div><span class="badge badge-green">官方元数据</span></section><section><div class="directory-result-head"><span>扫描能力</span><span>${formatNumber(capabilities.length)} 项</span></div>${capabilities.length ? `<div class="scanner-capability-list">${capabilities.map((capability) => `<article class="scanner-capability"><header><strong>${escapeHTML(scannerCapabilityLabel(capability.type))}</strong><code>${escapeHTML(capability.type || "unknown")}</code></header><dl><div><dt>输入 MIME 类型</dt><dd>${scannerMIMEList(capability.consumes_mime_types)}</dd></div><div><dt>输出 MIME 类型</dt><dd>${scannerMIMEList(capability.produces_mime_types)}</dd></div></dl></article>`).join("")}</div>` : `<div class="directory-state">${icon("info")}<div><strong>未声明扫描能力</strong><span>扫描器元数据没有返回 capabilities。</span></div></div>`}</section><section><div class="directory-result-head"><span>自定义属性</span><span>${formatNumber(properties.length)} 项</span></div>${properties.length ? `<dl class="scanner-property-list">${properties.map(([key, value]) => `<div><dt class="mono">${escapeHTML(key)}</dt><dd class="mono">${escapeHTML(value)}</dd></div>`).join("")}</dl>` : `<div class="directory-state compact">${icon("info")}<div><strong>没有自定义属性</strong></div></div>`}</section></div>`;
}

function scannerCapabilityLabel(value) {
  return ({ vulnerability: "漏洞扫描", sbom: "SBOM 生成" })[String(value || "").toLowerCase()] || "自定义能力";
}

function scannerMIMEList(values) {
  const items = asArray(values);
  return items.length ? `<span class="scanner-mime-list">${items.map((value) => `<code>${escapeHTML(value)}</code>`).join("")}</span>` : '<span class="muted">未声明</span>';
}

async function showScannerMetadataDialog(id) {
  const scanner = findAdminItem(state.scannerItems, id, "uuid");
  openControlDialog({
    title: "扫描器元数据",
    subtitle: scanner?.name || id,
    submitLabel: "关闭",
    hideCancel: true,
    dialogClass: "control-dialog-large",
    content: `<div id="scanner-metadata-content" class="dialog-loading"><span class="spinner"></span><span>正在读取扫描器元数据...</span></div>`,
    onSubmit: async () => closeControlDialog(),
  });
  const output = document.querySelector("#scanner-metadata-content");
  try {
    const metadata = await controlData("scanner-metadata", { id });
    if (!output || !document.body.contains(output)) return;
    output.outerHTML = scannerMetadataContent(asObject(metadata));
  } catch (error) {
    if (!output || !document.body.contains(output)) return;
    const unsupported = error.status === 404;
    const forbidden = error.status === 403;
    output.outerHTML = `<div class="directory-state directory-state-error">${icon(unsupported ? "info" : "alert")}<div><strong>${unsupported ? "当前扫描器不支持元数据" : forbidden ? "无权读取扫描器元数据" : "扫描器元数据载入失败"}</strong><span>${escapeHTML(unsupported ? "当前 Harbor 版本或扫描器适配器没有提供 metadata 能力。" : error.message)}</span></div></div>`;
  }
}

async function setDefaultScanner(id) {
  try {
    await controlMutation("scanner", { id }, "PATCH", { is_default: true });
    showToast("默认扫描器已更新");
    renderCurrentView(true);
  } catch (error) {
    showToast(error.message, true);
  }
}

function confirmDeleteScanner(id, name) {
  confirmControlDelete("删除扫描器", `扫描器 ${name} 将从 Harbor 中注销。`, "删除扫描器", async () => {
    await controlMutation("scanner", { id }, "DELETE");
    showToast("扫描器已删除");
    renderCurrentView(true);
  }, name);
}

function garbageCollectionParameters(value) {
  const current = asObject(value);
  const parameters = asObject(current.parameters);
  if (Object.keys(parameters).length) return parameters;
  if (typeof current.job_parameters === "string" && current.job_parameters.trim()) {
    try {
      return asObject(JSON.parse(current.job_parameters));
    } catch (_error) {
      return {};
    }
  }
  return asObject(current.job_parameters);
}

function garbageCollectionWorkers(parameters) {
  const workers = Number(parameters.workers);
  return Number.isInteger(workers) && workers >= 1 && workers <= 10 ? workers : 1;
}

function garbageCollectionWorkerOptions(selected) {
  return Array.from({ length: 10 }, (_item, index) => index + 1).map((workers) => `<option value="${workers}" ${workers === selected ? "selected" : ""}>${workers}</option>`).join("");
}

function runGarbageCollection() {
  const parameters = garbageCollectionParameters(state.adminCollection?.gcSchedule);
  const workers = garbageCollectionWorkers(parameters);
  openControlDialog({
    title: "立即执行垃圾清理",
    subtitle: "清理不再被制品清单引用的存储对象",
    submitLabel: "开始清理",
    destructive: true,
	    content: `<div class="destructive-message">${icon("alert")}<span>正式清理会删除不可恢复的存储对象，建议先执行演练。</span></div><div class="form-grid"><label class="check-row"><input name="dry_run" type="checkbox" checked><span><strong>仅演练</strong><small>计算可清理内容但不实际删除</small></span></label><label class="check-row"><input name="delete_untagged" type="checkbox" ${parameters.delete_untagged ? "checked" : ""}><span><strong>允许回收无 Tag 制品</strong><small>同时清理未被任何 Tag 引用的制品</small></span></label><label class="check-row"><input name="delete_tag" type="checkbox" ${parameters.delete_tag ? "checked" : ""}><span><strong>允许移除后端存储中的 Tag 文件</strong><small>垃圾回收时一并清理 Registry 后端残留的 Tag 引用文件</small></span></label><label class="field"><span>并行工作数</span><select name="workers">${garbageCollectionWorkerOptions(workers)}</select><small class="field-help">Harbor 支持 1 到 10 个并行工作任务。</small></label></div>`,
	    onSubmit: async (formData) => {
		  const dryRun = formData.has("dry_run");
		  const operationID = beginOperation({ kind: "garbage-collection", title: dryRun ? "垃圾清理演练" : "垃圾清理", detail: `${Number(formData.get("workers"))} 个并行任务`, total: 1 });
		  try {
			await controlMutation("gc-schedule", {}, "POST", { schedule: { type: "Manual" }, parameters: { dry_run: dryRun, delete_untagged: formData.has("delete_untagged"), delete_tag: formData.has("delete_tag"), workers: Number(formData.get("workers")) } });
			recordOperationResult(operationID, dryRun ? "清理演练" : "正式清理");
			finishOperation(operationID, "Harbor 已接受任务，可在清理服务中查看进度和日志");
		  } catch (error) {
			failOperation(operationID, error);
			throw error;
		  }
	      closeControlDialog();
      showToast("垃圾清理任务已启动");
      renderCurrentView(true);
    },
  });
}

async function stopGarbageCollection(id) {
  try {
    await controlMutation("gc-job", { id }, "PUT");
    showToast("垃圾清理任务已停止");
    renderCurrentView(true);
  } catch (error) {
    showToast(error.message, true);
  }
}

function showGarbageCollectionLog(id) {
  state.gcLogID = String(id || "");
  state.gcLog = "";
  openControlDialog({
    title: "垃圾清理日志",
    subtitle: `任务 #${state.gcLogID}`,
    submitLabel: "关闭",
    hideCancel: true,
    dialogClass: "control-dialog-large",
    content: `<section class="scan-log-panel"><div class="scan-log-toolbar"><span id="gc-log-status">正在读取 Harbor 清理日志...</span><div>${logTimezoneControl()}<button class="icon-button" type="button" data-action="refresh-gc-log" title="刷新日志" aria-label="刷新垃圾清理日志">${icon("refresh")}</button><button class="icon-button" type="button" data-action="copy-gc-log" title="复制日志" aria-label="复制垃圾清理日志">${icon("copy")}</button><button class="icon-button" type="button" data-action="download-gc-log" title="下载日志" aria-label="下载垃圾清理日志">${icon("download")}</button></div></div><div id="gc-log-content" class="structured-log-view" role="table" aria-label="垃圾清理日志">正在加载...</div></section>`,
    onSubmit: async () => closeControlDialog(),
  });
  refreshGarbageCollectionLog();
}

async function refreshGarbageCollectionLog() {
  const output = document.querySelector("#gc-log-content");
  const status = document.querySelector("#gc-log-status");
  if (!output || !state.gcLogID) return;
  output.textContent = "正在加载...";
  if (status) status.textContent = "正在读取 Harbor 清理日志...";
  try {
    const data = await controlData("gc-log", { id: state.gcLogID });
    const text = typeof data === "string" ? data : JSON.stringify(data ?? "", null, 2);
    state.gcLog = text;
    if (!document.body.contains(output)) return;
    setHarborLogContent(output, text, "Harbor 没有返回日志内容。");
    if (status) status.textContent = `已载入 ${formatNumber(text.length)} 个字符`;
  } catch (error) {
    if (!document.body.contains(output)) return;
    output.textContent = error.message;
    if (status) status.textContent = "日志载入失败";
  }
}

function downloadGarbageCollectionLog() {
  const filename = `harbor-gc-${String(state.gcLogID).replace(/[^0-9]/g, "") || "job"}.log`;
  downloadControlLog(state.gcLog, filename, "当前没有可下载的垃圾清理日志", "垃圾清理日志已下载");
}

function auditPurgeEventNames() {
	const values = asArray(state.adminCollection?.auditEvents).map((item) => String(asObject(item).event_type || item || "")).filter(Boolean);
	return values.length ? values : ["create_artifact", "delete_artifact", "pull_artifact", "push_artifact", "scan_artifact"];
}

function auditPurgeFormContent(options = {}) {
	const current = asObject(state.adminCollection?.purgeSchedule);
	const schedule = asObject(current.schedule);
	const parameters = asObject(current.parameters);
	const selected = new Set(String(parameters.include_event_types || "").split(",").filter(Boolean));
	const events = auditPurgeEventNames();
	const days = Math.max(1, Math.ceil(toNumber(parameters.audit_retention_hour || 720) / 24));
	const type = options.manual ? "Manual" : (["Hourly", "Daily", "Weekly", "Custom", "Schedule", "None"].includes(schedule.type) ? schedule.type : "Weekly");
	return `<div class="form-grid two-columns">${options.manual ? "" : `<label class="field"><span>执行频率</span><select name="type"><option value="Hourly" ${type === "Hourly" ? "selected" : ""}>每小时</option><option value="Daily" ${type === "Daily" ? "selected" : ""}>每天</option><option value="Weekly" ${type === "Weekly" ? "selected" : ""}>每周</option><option value="Custom" ${adminScheduleUsesCron(type) ? "selected" : ""}>自定义 Cron</option><option value="None" ${type === "None" ? "selected" : ""}>关闭计划</option></select></label><label class="field" data-schedule-cron-field ${adminScheduleUsesCron(type) ? "" : "hidden"}><span>Cron 表达式</span><input name="cron" maxlength="255" value="${escapeAttr(schedule.cron || "0 0 1 * * 0")}" ${adminScheduleUsesCron(type) ? "required" : "disabled"}></label>`}<label class="field"><span>保留天数</span><input name="retention_days" type="number" min="1" max="3650000" step="1" required value="${escapeAttr(days)}"><small class="field-help">早于该期限的选中事件将被清理。</small></label><label class="check-row"><input name="dry_run" type="checkbox" ${options.manual || parameters.dry_run ? "checked" : ""}><span><strong>仅演练</strong><small>计算匹配记录但不从数据库删除</small></span></label></div><fieldset class="event-selector purge-event-selector"><legend>清理事件类型</legend>${events.map((eventName) => `<label class="check-row"><input type="checkbox" name="event_types" value="${escapeAttr(eventName)}" ${!selected.size || selected.has(eventName) ? "checked" : ""}><span><strong>${escapeHTML(auditEventLabel(eventName))}</strong><small>${escapeHTML(eventName)}</small></span></label>`).join("")}</fieldset>`;
}

function auditPurgePayload(formData, manual) {
	const days = Number(formData.get("retention_days"));
	if (!Number.isInteger(days) || days < 1 || days > 3650000) throw new Error("审计日志保留天数必须是正整数");
	const events = formData.getAll("event_types").map(String);
	if (!events.length) throw new Error("请至少选择一种审计事件类型");
	const type = manual ? "Manual" : String(formData.get("type") || "Weekly");
	const current = asObject(asObject(state.adminCollection?.purgeSchedule).schedule);
	const schedule = manual
		? { type }
		: adminScheduleValue(type, current, formData.get("cron"), 1);
	return { schedule, parameters: { audit_retention_hour: days * 24, dry_run: formData.has("dry_run"), include_event_types: events.join(",") } };
}

function runAuditPurge() {
	openControlDialog({
		title: "立即清理审计日志",
		subtitle: "手动执行 Harbor 审计日志清理任务",
		submitLabel: "开始执行",
		submitIcon: "play",
		dialogClass: "control-dialog-large",
		content: auditPurgeFormContent({ manual: true }),
		onSubmit: async (formData) => {
			await controlMutation("purge-schedule", {}, "POST", auditPurgePayload(formData, true));
			closeControlDialog();
			showToast("审计日志清理任务已启动");
			renderCurrentView(true);
		},
	});
}

function showAuditPurgeScheduleDialog() {
	const current = asObject(state.adminCollection?.purgeSchedule);
	openControlDialog({
		title: "审计日志清理计划",
		subtitle: "设置保留期限、事件范围和执行频率",
		submitLabel: "保存计划",
		dialogClass: "control-dialog-large",
		content: auditPurgeFormContent(),
		onSubmit: async (formData) => {
			await controlMutation("purge-schedule", {}, current.id ? "PUT" : "POST", auditPurgePayload(formData, false));
			closeControlDialog();
			showToast("审计日志清理计划已更新");
			renderCurrentView(true);
		},
	});
	bindAdminScheduleForm(document.querySelector("#control-dialog-form"));
}

function stopAuditPurge(id) {
	confirmControlDelete("停止审计日志清理", `正在执行的审计清理任务 #${id} 将被请求停止。`, "停止任务", async () => {
		await controlMutation("purge-job", { id }, "PUT");
		showToast("已向 Harbor 提交停止请求");
		renderCurrentView(true);
	});
}

function showAuditPurgeLog(id) {
	state.purgeLogID = String(id);
	state.purgeLog = "";
	openControlDialog({
		title: "审计清理日志",
		subtitle: `任务 #${id}`,
		submitLabel: "关闭",
		submitIcon: "x",
		hideCancel: true,
		content: `<section class="scan-log-panel"><div class="scan-log-toolbar"><span id="purge-log-status">正在读取 Harbor 审计清理日志...</span><div>${logTimezoneControl()}<button class="icon-button" type="button" data-action="refresh-purge-log" title="刷新日志" aria-label="刷新审计清理日志">${icon("refresh")}</button><button class="icon-button" type="button" data-action="copy-purge-log" title="复制日志" aria-label="复制审计清理日志">${icon("copy")}</button><button class="icon-button" type="button" data-action="download-purge-log" title="下载日志" aria-label="下载审计清理日志">${icon("download")}</button></div></div><div id="purge-log-content" class="structured-log-view" role="table" aria-label="审计清理日志">正在加载...</div></section>`,
		onSubmit: async () => closeControlDialog(),
	});
	document.querySelector("#control-dialog .control-dialog")?.classList.add("control-dialog-wide");
	refreshAuditPurgeLog();
}

async function refreshAuditPurgeLog() {
	const output = document.querySelector("#purge-log-content");
	const status = document.querySelector("#purge-log-status");
	if (!output || !state.purgeLogID) return;
	output.textContent = "正在加载...";
	try {
		const data = await controlData("purge-log", { id: state.purgeLogID });
		state.purgeLog = typeof data === "string" ? data : JSON.stringify(data ?? "", null, 2);
		setHarborLogContent(output, state.purgeLog, "Harbor 没有返回审计清理日志。");
		if (status) status.textContent = `已载入 ${formatNumber(state.purgeLog.length)} 个字符`;
	} catch (error) {
		output.textContent = error.message;
		if (status) status.textContent = "日志载入失败";
	}
}

function downloadAuditPurgeLog() {
	downloadControlLog(state.purgeLog, `harbor-purge-audit-${state.purgeLogID || "job"}.log`, "当前没有可下载的审计清理日志", "审计清理日志已下载");
}

async function updateJobServiceQueue(type, action) {
	try {
		await controlMutation("jobservice-queue", { type }, "PUT", { action });
		showToast(action === "pause" ? "任务队列已暂停" : "任务队列已恢复");
		renderCurrentView(true);
	} catch (error) {
		showToast(error.message, true);
	}
}

function confirmStopJobServiceQueue(type) {
	const label = type === "all" ? "全部队列" : type;
	confirmControlDelete("停止待处理任务", `${label} 中尚未执行的任务将被停止并从队列清除，运行中的任务不受影响。`, "停止并清除", async () => {
		await controlMutation("jobservice-queue", { type }, "PUT", { action: "stop" });
		showToast("待处理任务已停止并清除");
		renderCurrentView(true);
	});
}

function confirmStopJobServiceJob(jobID) {
	confirmControlDelete("停止运行任务", `Job Service 任务 ${jobID} 将被请求停止。`, "停止任务", async () => {
		await controlMutation("jobservice-job", { job: jobID }, "PUT");
		showToast("运行任务已停止");
		renderCurrentView(true);
	});
}

function showJobServiceLog(jobID) {
	state.jobServiceJobID = String(jobID);
	state.jobServiceLog = "";
	openControlDialog({
		title: "Job Service 任务日志",
		subtitle: jobID,
		submitLabel: "关闭",
		submitIcon: "x",
		hideCancel: true,
		content: `<section class="scan-log-panel"><div class="scan-log-toolbar"><span id="jobservice-log-status">正在读取 Job Service 日志...</span><div>${logTimezoneControl()}<button class="icon-button" type="button" data-action="refresh-jobservice-log" title="刷新日志" aria-label="刷新 Job Service 日志">${icon("refresh")}</button><button class="icon-button" type="button" data-action="copy-jobservice-log" title="复制日志" aria-label="复制 Job Service 日志">${icon("copy")}</button><button class="icon-button" type="button" data-action="download-jobservice-log" title="下载日志" aria-label="下载 Job Service 日志">${icon("download")}</button></div></div><div id="jobservice-log-content" class="structured-log-view" role="table" aria-label="Job Service 任务日志">正在加载...</div></section>`,
		onSubmit: async () => closeControlDialog(),
	});
	document.querySelector("#control-dialog .control-dialog")?.classList.add("control-dialog-wide");
	refreshJobServiceLog();
}

async function refreshJobServiceLog() {
	const output = document.querySelector("#jobservice-log-content");
	const status = document.querySelector("#jobservice-log-status");
	if (!output || !state.jobServiceJobID) return;
	output.textContent = "正在加载...";
	try {
		const data = await controlData("jobservice-job-log", { job: state.jobServiceJobID });
		state.jobServiceLog = typeof data === "string" ? data : JSON.stringify(data ?? "", null, 2);
		setHarborLogContent(output, state.jobServiceLog, "Harbor 没有返回 Job Service 任务日志。");
		if (status) status.textContent = `已载入 ${formatNumber(state.jobServiceLog.length)} 个字符`;
	} catch (error) {
		output.textContent = error.message;
		if (status) status.textContent = "日志载入失败";
	}
}

function downloadJobServiceLog() {
	downloadControlLog(state.jobServiceLog, `harbor-jobservice-${state.jobServiceJobID || "job"}.log`, "当前没有可下载的 Job Service 任务日志", "Job Service 任务日志已下载");
}

async function runScanAll() {
	const operationID = beginOperation({ kind: "scan-all", title: "全量漏洞扫描", detail: "全部可扫描制品", total: 1 });
  try {
    await controlMutation("scan-all-schedule", {}, "POST", { schedule: { type: "Manual" } });
		recordOperationResult(operationID, "全量扫描任务");
		finishOperation(operationID, "Harbor 已接受任务，可在扫描计划中查看状态");
    showToast("全量漏洞扫描已启动");
    renderCurrentView(true);
  } catch (error) {
		failOperation(operationID, error);
    showToast(error.message, true);
  }
}

async function stopScanAll() {
  try {
    await controlMutation("scan-all-stop", {}, "POST");
    showToast("已请求停止全量扫描");
    renderCurrentView(true);
  } catch (error) {
    showToast(error.message, true);
  }
}

function showScheduleDialog(kind) {
  const current = asObject(kind === "gc" ? state.adminCollection?.gcSchedule : state.adminCollection?.scanSchedule);
  const schedule = asObject(current.schedule);
  const type = ["Hourly", "Daily", "Weekly", "Custom", "Schedule", "None"].includes(schedule.type) ? schedule.type : "Daily";
  const gcParameters = kind === "gc" ? garbageCollectionParameters(current) : {};
  const gcWorkers = garbageCollectionWorkers(gcParameters);
  openControlDialog({
    title: kind === "gc" ? "垃圾清理计划" : "全量扫描计划",
    subtitle: "计划使用 Harbor 官方 Schedule 模型",
    submitLabel: "保存计划",
    content: `<div class="form-grid"><label class="field"><span>执行频率</span><select name="type"><option value="Hourly" ${type === "Hourly" ? "selected" : ""}>每小时</option><option value="Daily" ${type === "Daily" ? "selected" : ""}>每天</option><option value="Weekly" ${type === "Weekly" ? "selected" : ""}>每周</option><option value="Custom" ${adminScheduleUsesCron(type) ? "selected" : ""}>自定义 Cron</option><option value="None" ${type === "None" ? "selected" : ""}>关闭计划</option></select></label><label class="field" data-schedule-cron-field ${adminScheduleUsesCron(type) ? "" : "hidden"}><span>Cron 表达式</span><input name="cron" maxlength="255" value="${escapeAttr(schedule.cron || (kind === "gc" ? "0 0 2 * * *" : "0 0 3 * * *"))}" ${adminScheduleUsesCron(type) ? "required" : "disabled"}></label>${kind === "gc" ? `<label class="check-row"><input name="delete_untagged" type="checkbox" ${gcParameters.delete_untagged ? "checked" : ""}><span><strong>允许回收无 Tag 制品</strong><small>同时清理未被任何 Tag 引用的制品</small></span></label><label class="check-row"><input name="delete_tag" type="checkbox" ${gcParameters.delete_tag ? "checked" : ""}><span><strong>允许移除后端存储中的 Tag 文件</strong><small>垃圾回收时一并清理 Registry 后端残留的 Tag 引用文件</small></span></label><label class="field"><span>并行工作数</span><select name="workers">${garbageCollectionWorkerOptions(gcWorkers)}</select><small class="field-help">Harbor 支持 1 到 10 个并行工作任务。</small></label>` : ""}</div>`,
    onSubmit: async (formData) => {
      const selected = String(formData.get("type") || "Daily");
      const payload = { schedule: adminScheduleValue(selected, schedule, formData.get("cron"), kind === "gc" ? 2 : 3) };
      if (kind === "gc") payload.parameters = { delete_untagged: formData.has("delete_untagged"), delete_tag: formData.has("delete_tag"), workers: Number(formData.get("workers")), dry_run: false };
      const operation = kind === "gc" ? "gc-schedule" : "scan-all-schedule";
      await controlMutation(operation, {}, current.id ? "PUT" : "POST", payload);
      closeControlDialog();
      showToast("任务计划已更新");
      renderCurrentView(true);
    },
  });
  bindAdminScheduleForm(document.querySelector("#control-dialog-form"));
}

function addEditableConfiguration(payload, config, key, value, options = {}) {
  if (!adminConfigEditable(config, key)) return;
  if (options.skipEmpty && String(value || "").trim() === "") return;
  payload[key] = value;
}

function configurationValueFromForm(data, key, type) {
  if (type === "bool") return data.has(key);
  if (type === "number") return Number(data.get(key));
  return String(data.get(key) || "").trim();
}

async function saveAdminAuthenticationConfiguration(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const submit = form.querySelector('button[type="submit"]');
  const data = new FormData(form);
  const config = asObject(state.adminCollection?.configuration);
  const mode = String(data.get("auth_mode") || adminConfigValue(config, "auth_mode") || "db_auth");
  const payload = {};
  addEditableConfiguration(payload, config, "auth_mode", mode);
  addEditableConfiguration(payload, config, "primary_auth_mode", mode === "db_auth" ? false : data.has("primary_auth_mode"));
  addEditableConfiguration(payload, config, "self_registration", mode === "db_auth" && data.has("self_registration"));
  const fields = {
    ldap_auth: { ldap_url: "string", ldap_timeout: "number", ldap_search_dn: "string", ldap_search_password: "secret", ldap_base_dn: "string", ldap_filter: "string", ldap_uid: "string", ldap_scope: "number", ldap_group_base_dn: "string", ldap_group_search_filter: "string", ldap_group_attribute_name: "string", ldap_group_admin_dn: "string", ldap_group_membership_attribute: "string", ldap_group_search_scope: "number", ldap_group_attach_parallel: "bool", ldap_verify_cert: "bool" },
    uaa_auth: { uaa_endpoint: "string", uaa_client_id: "string", uaa_client_secret: "secret", uaa_verify_cert: "bool" },
    http_auth: { http_authproxy_endpoint: "string", http_authproxy_tokenreview_endpoint: "string", http_authproxy_admin_groups: "string", http_authproxy_admin_usernames: "string", http_authproxy_verify_cert: "bool", http_authproxy_skip_search: "bool", http_authproxy_server_certificate: "string" },
    oidc_auth: { oidc_name: "string", oidc_endpoint: "string", oidc_client_id: "string", oidc_client_secret: "secret", oidc_groups_claim: "string", oidc_admin_group: "string", oidc_group_filter: "string", oidc_scope: "string", oidc_user_claim: "string", oidc_extra_redirect_parms: "string", oidc_verify_cert: "bool", oidc_auto_onboard: "bool", oidc_logout: "bool" },
  }[mode] || {};
  Object.entries(fields).forEach(([key, type]) => addEditableConfiguration(payload, config, key, configurationValueFromForm(data, key, type), { skipEmpty: type === "secret" }));
  setButtonBusy(submit, true, "正在保存");
  try {
    await controlMutation("configurations", {}, "PUT", payload);
	if (state.dashboard) {
	  const systemInfo = asObject(state.dashboard.systeminfo);
	  systemInfo.auth_mode = mode;
	  state.dashboard.systeminfo = systemInfo;
	}
    showToast("认证配置已保存");
    renderCurrentView(true);
  } catch (error) {
    showToast(error.message, true);
    setButtonBusy(submit, false);
  }
}

async function testAdminAuthentication(form) {
  if (!form.reportValidity()) return;
  const button = document.querySelector("#test-auth-connection");
  const data = new FormData(form);
  const mode = String(form.elements.namedItem("auth_mode")?.value || "");
  setButtonBusy(button, true, "正在测试");
  try {
    if (mode === "ldap_auth") {
      const result = await controlMutation("ldap-ping", {}, "POST", {
        ldap_url: String(data.get("ldap_url") || "").trim(), ldap_search_dn: String(data.get("ldap_search_dn") || "").trim(),
        ldap_search_password: String(data.get("ldap_search_password") || ""), ldap_base_dn: String(data.get("ldap_base_dn") || "").trim(),
        ldap_filter: String(data.get("ldap_filter") || "").trim(), ldap_uid: String(data.get("ldap_uid") || "").trim(),
        ldap_scope: Number(data.get("ldap_scope")), ldap_connection_timeout: Number(data.get("ldap_timeout")), ldap_verify_cert: data.has("ldap_verify_cert"),
      });
      const response = asObject(result?.data);
      if (response.success === false) throw new Error(response.message || "LDAP 服务测试失败");
      showToast(response.message || "LDAP 服务连接成功");
    } else if (mode === "oidc_auth") {
      await controlMutation("oidc-ping", {}, "POST", { url: String(data.get("oidc_endpoint") || "").trim(), verify_cert: data.has("oidc_verify_cert") });
      showToast("OIDC 服务连接成功");
    }
  } catch (error) {
    showToast(error.message, true);
  } finally {
    setButtonBusy(button, false);
  }
}

async function saveAdminSecurityConfiguration(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = form.querySelector('button[type="submit"]');
  const data = new FormData(form);
  setButtonBusy(submit, true, "正在保存");
  try {
    await controlMutation("system-cve-allowlist", {}, "PUT", { expires_at: cveExpirationFromForm(data), items: parseCVEItems(data.get("cves")) });
    showToast("安全配置已保存");
    renderCurrentView(true);
  } catch (error) {
    showToast(error.message, true);
    setButtonBusy(submit, false);
  }
}

async function saveAdminSystemConfiguration(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const submit = form.querySelector('button[type="submit"]');
  const data = new FormData(form);
  const config = asObject(state.adminCollection?.configuration);
  const payload = {};
  for (const key of ["project_creation_restriction", "robot_name_prefix", "audit_log_forward_endpoint"]) addEditableConfiguration(payload, config, key, String(data.get(key) || "").trim());
  for (const key of ["token_expiration", "session_timeout", "robot_token_duration"]) addEditableConfiguration(payload, config, key, Number(data.get(key)));
  for (const key of ["read_only", "notification_enable", "scanner_skip_update_pulltime", "quota_per_project_enable", "skip_audit_log_database"]) addEditableConfiguration(payload, config, key, data.has(key));
  const storageGB = Number(data.get("storage_per_project_gb"));
  if (!Number.isInteger(storageGB) || (storageGB !== -1 && storageGB <= 0)) {
    showToast("默认项目配额必须是 -1 或正整数", true);
    return;
  }
  addEditableConfiguration(payload, config, "storage_per_project", storageGB === -1 ? -1 : storageGB * 1024 ** 3);
  const auditEvents = asArray(state.adminCollection?.auditEvents).map((item) => String(asObject(item).event_type || item)).filter(Boolean);
  if (auditEvents.length) {
    const enabled = new Set(data.getAll("enabled_audit_event").map(String));
    addEditableConfiguration(payload, config, "disabled_audit_log_event_types", auditEvents.filter((eventName) => !enabled.has(eventName)).join(","));
  }
  const bannerText = String(data.get("banner_message_text") || "").trim();
  let bannerMessage = "";
  if (bannerText) {
    const fromDate = String(data.get("banner_from_date") || "");
    const toDate = String(data.get("banner_to_date") || "");
    if (fromDate && toDate && fromDate > toDate) {
      showToast("横幅消息的结束日期不能早于开始日期", true);
      return;
    }
    bannerMessage = JSON.stringify({ message: bannerText, type: String(data.get("banner_message_type") || "warning"), closable: data.has("banner_closable"), fromDate: fromDate || null, toDate: toDate || null });
  }
  addEditableConfiguration(payload, config, "banner_message", bannerMessage);
  setButtonBusy(submit, true, "正在保存");
  try {
    await controlMutation("configurations", {}, "PUT", payload);
    if (state.dashboard) {
	  const systemInfo = asObject(state.dashboard.systeminfo);
	  systemInfo.banner_message = bannerMessage;
	  state.dashboard.systeminfo = systemInfo;
	  state.dismissedBanner = "";
	  if (typeof renderHarborBanner === "function") renderHarborBanner(bannerMessage);
    }
    showToast("系统设置已保存");
    renderCurrentView(true);
  } catch (error) {
    showToast(error.message, true);
    setButtonBusy(submit, false);
  }
}
