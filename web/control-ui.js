"use strict";

const controlPageSize = 20;
const projectDefaultPageSize = 50;
const projectDefaultSort = "name";
const repositoryAssetDefaultPageSize = 50;
const repositoryAssetDefaultSort = "-artifact_count";
const auditDefaultPageSize = 50;
const replicationDefaultPageSize = 50;
const replicationPolicyDefaultSort = "id";
const replicationExecutionDefaultSort = "-start_time";
const projectRepositoryDefaultPageSize = 50;
const projectRepositoryDefaultSort = "-update_time";
const securityDefaultPageSize = 50;
const artifactIconCache = new Map();
const artifactAdditionTabs = {
  sbom: { addition: "sbom", label: "SBOM", icon: "shield" },
  license: { addition: "license", label: "许可证", icon: "check" },
  files: { addition: "files", label: "文件", icon: "database" },
  build: { addition: "build_history", label: "构建历史", icon: "history" },
  dependencies: { addition: "dependencies", label: "依赖", icon: "package" },
  readme: { addition: "readme.md", label: "README", icon: "terminal" },
  values: { addition: "values.yaml", label: "Values", icon: "settings" },
};

function parseConsoleRoute() {
  const raw = location.hash.replace(/^#\/?/, "");
  const [pathPart, queryPart = ""] = raw.split("?");
  const parts = pathPart.split("/").filter(Boolean).map(safeDecodeURIComponent);
  const query = new URLSearchParams(queryPart);
  const page = Math.max(1, Number.parseInt(query.get("page") || "1", 10) || 1);
  const filter = query.get("q") || "";
  const tab = query.get("tab") || "";
  const pageSize = [20, 50, 100].includes(Number(query.get("page_size"))) ? Number(query.get("page_size")) : projectDefaultPageSize;
  const projectSort = ["project_id", "-project_id", "name", "-update_time", "update_time", "-repo_count"].includes(query.get("sort")) ? query.get("sort") : projectDefaultSort;

	if (parts[0] === "administration") {
	  const section = ["users", "groups", "robots", "labels", "quotas", "maintenance", "purge", "jobs", "configuration"].includes(parts[1]) ? parts[1] : "users";
	  const configTab = ["auth", "security", "system"].includes(query.get("tab")) ? query.get("tab") : "auth";
	  return { view: "administration", section, page, filter, configTab };
	}

  if (parts[0] === "projects" && parts.length === 1) {
    const projectVisibility = ["public", "private"].includes(query.get("visibility")) ? query.get("visibility") : "";
    return { view: "projects", page, filter, pageSize, projectSort, projectVisibility, projectOwner: query.get("owner") || "" };
  }
  if (parts[0] === "projects" && parts.length >= 2) {
    const project = parts[1];
    if (parts[2] === "repositories" && parts.length >= 5 && parts[4] === "artifacts") {
      const repository = parts[3];
      if (parts.length >= 6) return { view: "artifact", project, repository, reference: parts[5], tab: tab || "overview", page, filter };
	  const artifactType = ["IMAGE", "CHART", "CNAB", "WASM"].includes(query.get("type")) ? query.get("type") : "";
	  const tagState = ["tagged", "untagged"].includes(query.get("tags")) ? query.get("tags") : "";
	  const scanStatus = ["success", "running", "error", "stopped", "unscanned"].includes(query.get("scan")) ? query.get("scan") : "";
	  return { view: "repository", project, repository, page, filter, artifactType, tagState, labelID: query.get("label") || "", scanStatus };
    }
    const section = ["members", "robots", "webhooks", "rules", "retention", "audit", "preheat", "settings"].includes(parts[2]) ? parts[2] : "repositories";
    const projectRepositoryPageSize = [20, 50, 100].includes(Number(query.get("page_size"))) ? Number(query.get("page_size")) : projectRepositoryDefaultPageSize;
    const projectRepositorySort = ["name", "-artifact_count", "-pull_count", "-update_time"].includes(query.get("sort")) ? query.get("sort") : projectRepositoryDefaultSort;
    return { view: "project", project, section, page, filter, projectRepositoryPageSize, projectRepositorySort };
  }
  if (parts[0] === "repositories") {
    const repositorySort = ["name", "-artifact_count", "-pull_count", "-update_time"].includes(query.get("sort")) ? query.get("sort") : repositoryAssetDefaultSort;
    const repositoryPageSize = [20, 50, 100].includes(Number(query.get("page_size"))) ? Number(query.get("page_size")) : repositoryAssetDefaultPageSize;
    return { view: "repositories", page, filter, repositorySort, repositoryPageSize, projectFilter: query.get("project") || "" };
  }
  if (parts[0] === "security") {
    const section = ["overview", "scanners", "vulnerabilities", "exports", "allowlist"].includes(parts[1]) ? parts[1] : "overview";
    const securityPageSize = [20, 50, 100].includes(Number(query.get("page_size"))) ? Number(query.get("page_size")) : securityDefaultPageSize;
    return {
      view: "security", section, page, pageSize: securityPageSize, filter,
      cve: query.get("cve") || "", severity: query.get("severity") || "", status: query.get("status") || "",
      repository: query.get("repository") || "", project: query.get("project") || "", package: query.get("package") || "", tag: query.get("tag") || "",
    };
  }
  if (parts[0] === "audit") {
    const auditPageSize = [20, 50, 100].includes(Number(query.get("page_size"))) ? Number(query.get("page_size")) : auditDefaultPageSize;
    return {
      view: "audit",
      page,
      pageSize: auditPageSize,
      username: query.get("username") || "",
      resource: query.get("resource") || "",
      operation: query.get("operation") || "",
      result: ["success", "failed"].includes(query.get("result")) ? query.get("result") : "",
    };
  }
  if (parts[0] === "replication") {
    const replicationPageSize = [20, 50, 100].includes(Number(query.get("page_size"))) ? Number(query.get("page_size")) : replicationDefaultPageSize;
    const replicationTab = ["policies", "executions"].includes(query.get("tab")) ? query.get("tab") : "policies";
    const replicationSorts = replicationTab === "policies" ? ["id", "-id", "name", "-update_time", "update_time"] : ["-start_time", "start_time"];
    return {
      view: "replication",
      tab: replicationTab,
      page,
      pageSize: replicationPageSize,
      replicationSort: replicationSorts.includes(query.get("sort")) ? query.get("sort") : (replicationTab === "policies" ? replicationPolicyDefaultSort : replicationExecutionDefaultSort),
      filter,
      status: query.get("status") || "",
      trigger: query.get("trigger") || "",
      policyID: query.get("policy_id") || "",
    };
  }
  const candidate = parts[0] || "overview";
  return { view: viewMeta[candidate] ? candidate : "overview", page, filter, tab };
}

function safeDecodeURIComponent(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function controlURL(operation, params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") query.set(key, String(value));
  });
  return `/api/control/${operation}${query.size ? `?${query}` : ""}`;
}

async function controlList(operation, params = {}) {
  const result = await api(controlURL(operation, params));
  return {
    items: asArray(result?.items),
    pagination: {
      page: Math.max(1, toNumber(result?.pagination?.page) || 1),
      page_size: Math.max(1, toNumber(result?.pagination?.page_size) || controlPageSize),
      total: Math.max(0, toNumber(result?.pagination?.total)),
    },
  };
}

async function controlData(operation, params = {}) {
  const result = await api(controlURL(operation, params));
  return result?.data;
}

async function controlMutation(operation, params, method, payload) {
  return api(controlURL(operation, params), {
    method,
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
}

function routeQuery(page = 1, filter = "", tab = "") {
  const query = new URLSearchParams();
  if (page > 1) query.set("page", String(page));
  if (filter) query.set("q", filter);
  if (tab) query.set("tab", tab);
  return query.size ? `?${query}` : "";
}

function projectListRoute(page = 1, filter = "", pageSize = projectDefaultPageSize, sort = projectDefaultSort, filters = {}) {
  const query = new URLSearchParams();
  if (page > 1) query.set("page", String(page));
  if (filter) query.set("q", filter);
  if (pageSize !== projectDefaultPageSize) query.set("page_size", String(pageSize));
  if (sort !== projectDefaultSort) query.set("sort", sort);
  if (filters.visibility) query.set("visibility", filters.visibility);
  if (filters.owner) query.set("owner", filters.owner);
  return `#/projects${query.size ? `?${query}` : ""}`;
}

function repositoryAssetRoute(page = 1, filter = "", pageSize = repositoryAssetDefaultPageSize, sort = repositoryAssetDefaultSort, project = "") {
  const query = new URLSearchParams();
  if (page > 1) query.set("page", String(page));
  if (filter) query.set("q", filter);
  if (pageSize !== repositoryAssetDefaultPageSize) query.set("page_size", String(pageSize));
  if (sort !== repositoryAssetDefaultSort) query.set("sort", sort);
  if (project) query.set("project", project);
  return `#/repositories${query.size ? `?${query}` : ""}`;
}

function auditRoute(page = 1, filters = {}, pageSize = filters.pageSize || auditDefaultPageSize) {
  const query = new URLSearchParams();
  if (page > 1) query.set("page", String(page));
  if (pageSize !== auditDefaultPageSize) query.set("page_size", String(pageSize));
  for (const key of ["username", "resource", "operation", "result"]) {
    const value = String(filters[key] || "").trim();
    if (value) query.set(key, value);
  }
  return `#/audit${query.size ? `?${query}` : ""}`;
}

function replicationRoute(tab = "policies", page = 1, filters = {}, pageSize = filters.pageSize || replicationDefaultPageSize) {
  const query = new URLSearchParams();
  const defaultSort = tab === "policies" ? replicationPolicyDefaultSort : replicationExecutionDefaultSort;
  if (tab !== "policies") query.set("tab", tab);
  if (page > 1) query.set("page", String(page));
  if (pageSize !== replicationDefaultPageSize) query.set("page_size", String(pageSize));
  if (filters.replicationSort && filters.replicationSort !== defaultSort) query.set("sort", filters.replicationSort);
  if (filters.filter) query.set("q", filters.filter);
  for (const key of ["status", "trigger", "policyID"]) {
    const value = String(filters[key] || "").trim();
    if (value) query.set(key === "policyID" ? "policy_id" : key, value);
  }
  return `#/replication${query.size ? `?${query}` : ""}`;
}

function securityRoute(section = "overview", page = 1, filters = {}, pageSize = securityDefaultPageSize) {
  const query = new URLSearchParams();
  if (page > 1) query.set("page", String(page));
  if (pageSize !== securityDefaultPageSize) query.set("page_size", String(pageSize));
  const filter = String(filters.filter || "").trim();
  if (filter) query.set("q", filter);
  for (const key of ["cve", "severity", "status", "repository", "project", "package", "tag"]) {
    const value = String(filters[key] || "").trim();
    if (value) query.set(key, value);
  }
  return `#/security/${section}${query.size ? `?${query}` : ""}`;
}

function projectRoute(project, section = "repositories", page = 1, filter = "", options = {}) {
  const query = new URLSearchParams();
  if (page > 1) query.set("page", String(page));
  if (filter) query.set("q", filter);
  if (section === "repositories") {
    if (options.pageSize && options.pageSize !== projectRepositoryDefaultPageSize) query.set("page_size", String(options.pageSize));
    if (options.sort && options.sort !== projectRepositoryDefaultSort) query.set("sort", options.sort);
  }
  return `#/projects/${encodeURIComponent(project)}/${section}${query.size ? `?${query}` : ""}`;
}

function repositoryRoute(project, repository, page = 1, filter = "", filters = {}) {
	const query = new URLSearchParams();
	if (page > 1) query.set("page", String(page));
	if (filter) query.set("q", filter);
	if (filters.artifactType) query.set("type", filters.artifactType);
	if (filters.tagState) query.set("tags", filters.tagState);
	if (filters.labelID) query.set("label", filters.labelID);
	if (filters.scanStatus) query.set("scan", filters.scanStatus);
	return `#/projects/${encodeURIComponent(project)}/repositories/${encodeURIComponent(repository)}/artifacts${query.size ? `?${query}` : ""}`;
}

function repositoryArtifactFilters(route) {
	return { artifactType: route.artifactType, tagState: route.tagState, labelID: route.labelID, scanStatus: route.scanStatus };
}

function artifactRoute(project, repository, reference, tab = "overview", page = 1) {
  return `#/projects/${encodeURIComponent(project)}/repositories/${encodeURIComponent(repository)}/artifacts/${encodeURIComponent(reference)}${routeQuery(page, "", tab === "overview" ? "" : tab)}`;
}

function controlBreadcrumb(items) {
  return `<nav class="breadcrumb" aria-label="面包屑">${items.map((item, index) => {
    if (index === items.length - 1 || !item.href) return `<span>${escapeHTML(item.label)}</span>`;
    return `<a href="${escapeAttr(item.href)}">${escapeHTML(item.label)}</a>${icon("chevron")}`;
  }).join("")}</nav>`;
}

function controlPagination(pagination, action = "control-page") {
  const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.page_size));
  const start = pagination.total ? (pagination.page - 1) * pagination.page_size + 1 : 0;
  const end = Math.min(pagination.total, pagination.page * pagination.page_size);
  return `<div class="control-pagination">
    <span>第 ${formatNumber(start)}-${formatNumber(end)} 项，共 ${formatNumber(pagination.total)} 项</span>
    <div class="pagination-buttons">
      <button class="icon-button" type="button" data-action="${action}" data-page="${pagination.page - 1}" ${pagination.page <= 1 ? "disabled" : ""} title="上一页" aria-label="上一页">${icon("arrow-left")}</button>
      <span>第 ${formatNumber(pagination.page)} / ${formatNumber(totalPages)} 页</span>
      <button class="icon-button" type="button" data-action="${action}" data-page="${pagination.page + 1}" ${pagination.page >= totalPages ? "disabled" : ""} title="下一页" aria-label="下一页">${icon("arrow-right")}</button>
    </div>
  </div>`;
}

function setControlPage(page) {
  const route = state.route || parseConsoleRoute();
  const next = Math.max(1, toNumber(page));
  if (route.view === "projects") location.hash = projectListRoute(next, route.filter, route.pageSize, route.projectSort, { visibility: route.projectVisibility, owner: route.projectOwner });
  if (route.view === "repositories") location.hash = repositoryAssetRoute(next, route.filter, route.repositoryPageSize, route.repositorySort, route.projectFilter);
  if (route.view === "project") location.hash = projectRoute(route.project, route.section, next, route.filter, { pageSize: route.projectRepositoryPageSize, sort: route.projectRepositorySort });
  if (route.view === "repository") location.hash = repositoryRoute(route.project, route.repository, next, route.filter, repositoryArtifactFilters(route));
  if (route.view === "artifact") location.hash = artifactRoute(route.project, route.repository, route.reference, route.tab, next);
  if (route.view === "administration") location.hash = administrationRoute(route.section, next, route.filter);
  if (route.view === "audit") location.hash = auditRoute(next, route, route.pageSize);
  if (route.view === "replication") location.hash = replicationRoute(route.tab, next, route, route.pageSize);
  if (route.view === "security") location.hash = securityRoute(route.section, next, route, route.pageSize);
}

function controlSearchForm(id, value, placeholder) {
  return `<form id="${id}" class="toolbar-search control-search-form">${icon("search")}<input name="q" type="search" value="${escapeAttr(value)}" placeholder="${escapeAttr(placeholder)}" aria-label="${escapeAttr(placeholder)}"><button class="icon-button toolbar-search-submit" type="submit" title="搜索" aria-label="搜索">${icon("search")}</button></form>`;
}

function bindControlSearch(id, makeHash) {
  document.querySelector(`#${id}`)?.addEventListener("submit", (event) => {
    event.preventDefault();
    const term = String(new FormData(event.currentTarget).get("q") || "").trim();
    location.hash = makeHash(term);
  });
}

async function renderControlProjects(token) {
  const route = state.route || parseConsoleRoute();
  mainContent.innerHTML = `${pageHeader("项目", viewMeta.projects.subtitle, refreshButton())}${demoBanner()}<section class="table-shell">${loadingRows(7)}</section>`;
  try {
    const result = await controlList("projects", {
      page: route.page,
      page_size: route.pageSize,
      sort: route.projectSort,
      name: route.filter,
      owner: route.projectOwner,
      public: route.projectVisibility === "public" ? true : route.projectVisibility === "private" ? false : "",
      with_detail: true,
    });
    if (token !== state.renderToken || state.currentView !== "projects") return;
    state.controlProjects = result.items;
		prepareProjectSelection(route);
    mainContent.innerHTML = `
      ${pageHeader("项目", viewMeta.projects.subtitle, `${refreshButton()}<button class="button button-small button-primary" type="button" data-action="create-project">${icon("plus")}<span>新建项目</span></button>`)}
      ${demoBanner()}
      <section class="table-shell">
        <form id="control-project-filter" class="table-toolbar project-filter-toolbar"><div class="toolbar-search">${icon("search")}<input name="name" type="search" maxlength="255" value="${escapeAttr(route.filter)}" placeholder="按项目名称搜索" aria-label="按项目名称搜索"></div><div class="toolbar-search project-owner-search">${icon("users")}<input name="owner" type="search" maxlength="255" value="${escapeAttr(route.projectOwner)}" placeholder="项目所有者" aria-label="按项目所有者筛选"></div><label class="toolbar-field"><span>可见性</span><select name="visibility" class="toolbar-select"><option value="" ${!route.projectVisibility ? "selected" : ""}>全部项目</option><option value="public" ${route.projectVisibility === "public" ? "selected" : ""}>公开</option><option value="private" ${route.projectVisibility === "private" ? "selected" : ""}>私有</option></select></label><button class="button button-small button-primary" type="submit">${icon("search")}<span>筛选</span></button><div class="toolbar-spacer"></div><label class="toolbar-field"><span>排序</span><select id="project-sort" class="toolbar-select"><option value="project_id" ${route.projectSort === "project_id" ? "selected" : ""}>ID</option><option value="-project_id" ${route.projectSort === "-project_id" ? "selected" : ""}>ID（倒序）</option><option value="name" ${route.projectSort === "name" ? "selected" : ""}>名称</option><option value="-update_time" ${route.projectSort === "-update_time" ? "selected" : ""}>最近更新</option><option value="update_time" ${route.projectSort === "update_time" ? "selected" : ""}>最早更新</option><option value="-repo_count" ${route.projectSort === "-repo_count" ? "selected" : ""}>仓库最多</option></select></label><label class="toolbar-field"><span>每页</span><select id="project-page-size" class="toolbar-select"><option value="20" ${route.pageSize === 20 ? "selected" : ""}>20 条</option><option value="50" ${route.pageSize === 50 ? "selected" : ""}>50 条</option><option value="100" ${route.pageSize === 100 ? "selected" : ""}>100 条</option></select></label></form>
		${projectBatchToolbar()}
		<div class="table-scroll">${controlProjectTable(result.items)}</div>
        ${controlPagination(result.pagination)}
      </section>`;
    document.querySelector("#control-project-filter")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      location.hash = projectListRoute(1, String(data.get("name") || "").trim(), route.pageSize, route.projectSort, { visibility: data.get("visibility"), owner: String(data.get("owner") || "").trim() });
    });
    document.querySelector("#project-sort")?.addEventListener("change", (event) => { location.hash = projectListRoute(1, route.filter, route.pageSize, event.target.value, { visibility: route.projectVisibility, owner: route.projectOwner }); });
    document.querySelector("#project-page-size")?.addEventListener("change", (event) => { location.hash = projectListRoute(1, route.filter, Number(event.target.value), route.projectSort, { visibility: route.projectVisibility, owner: route.projectOwner }); });
		updateProjectBatchToolbar();
  } catch (error) {
    if (token === state.renderToken) renderError("项目载入失败", error.message, "refresh-view");
  }
}

function controlProjectTable(projects) {
  if (!projects.length) return emptyTable("没有项目", "当前筛选条件下没有项目。", "folder");
	const selection = state.projectSelection || new Set();
	const allSelected = projects.every((project) => selection.has(String(project.project_id)));
  return `<table class="project-select-table"><thead><tr><th class="selection-cell"><input type="checkbox" data-action="select-all-projects" ${allSelected ? "checked" : ""} aria-label="选择当前页全部项目"></th><th>项目</th><th>可见性</th><th>仓库数</th><th>自动扫描</th><th>漏洞阻止</th><th>最近更新</th><th></th></tr></thead><tbody>
    ${projects.map((project) => {
      const metadata = asObject(project.metadata);
      const isPublic = String(metadata.public) === "true";
		  const selected = selection.has(String(project.project_id));
      return `<tr class="clickable-row ${selected ? "selected-row" : ""}" data-action="control-open-project" data-project="${escapeAttr(project.name)}">
			<td class="selection-cell"><input type="checkbox" data-action="select-project" data-id="${escapeAttr(project.project_id)}" ${selected ? "checked" : ""} aria-label="选择 ${escapeAttr(project.name)}"></td>
        <td><div class="cell-title"><span class="cell-icon">${icon("folder")}</span><span class="cell-stack"><strong>${escapeHTML(project.name)}</strong><small>${escapeHTML(project.owner_name || "-")} · #${escapeHTML(project.project_id ?? "-")}</small></span></div></td>
        <td><span class="badge ${isPublic ? "badge-blue" : ""}">${isPublic ? "公开" : "私有"}</span></td>
        <td class="mono">${formatNumber(project.repo_count)}</td>
        <td>${String(metadata.auto_scan) === "true" ? '<span class="badge badge-green">已启用</span>' : '<span class="badge">未启用</span>'}</td>
        <td>${String(metadata.prevent_vul) === "true" ? `<span class="badge badge-green">${severityInfo(metadata.severity)[0]}及以上</span>` : '<span class="badge">未启用</span>'}</td>
        <td>${formatDate(project.update_time || project.creation_time)}</td><td>${icon("chevron")}</td>
      </tr>`;
    }).join("")}
  </tbody></table>`;
}

function prepareProjectSelection(route) {
	const key = [route.page, route.pageSize, route.projectSort, route.filter, route.projectVisibility, route.projectOwner].join("|");
	if (state.projectSelectionKey !== key) {
		state.projectSelectionKey = key;
		state.projectSelection = new Set();
	}
}

function selectedProjectItems() {
	const selection = state.projectSelection || new Set();
	return asArray(state.controlProjects).filter((project) => selection.has(String(project.project_id)));
}

function projectBatchToolbar() {
	return `<div class="artifact-batch-toolbar project-batch-toolbar"><span><strong id="project-selection-count">0</strong> 个已选择</span><div><button class="button button-small" type="button" data-action="export-selected-project-cve" disabled>${icon("download")}<span>导出 CVE</span></button><button class="button button-small button-danger" type="button" data-action="batch-delete-projects" disabled>${icon("trash")}<span>删除项目</span></button></div></div>`;
}

function toggleProjectSelection(target) {
	if (!state.projectSelection) state.projectSelection = new Set();
	if (target.checked) state.projectSelection.add(String(target.dataset.id));
	else state.projectSelection.delete(String(target.dataset.id));
	target.closest("tr")?.classList.toggle("selected-row", target.checked);
	updateProjectBatchToolbar();
}

function toggleAllProjectSelection(target) {
	if (!state.projectSelection) state.projectSelection = new Set();
	asArray(state.controlProjects).forEach((project) => {
		if (target.checked) state.projectSelection.add(String(project.project_id));
		else state.projectSelection.delete(String(project.project_id));
	});
	document.querySelectorAll('[data-action="select-project"]').forEach((checkbox) => {
		checkbox.checked = target.checked;
		checkbox.closest("tr")?.classList.toggle("selected-row", target.checked);
	});
	updateProjectBatchToolbar();
}

function updateProjectBatchToolbar() {
	const selected = selectedProjectItems();
	const count = selected.length;
	const output = document.querySelector("#project-selection-count");
	if (output) output.textContent = formatNumber(count);
	document.querySelector('[data-action="export-selected-project-cve"]')?.toggleAttribute("disabled", count !== 1);
	document.querySelector('[data-action="batch-delete-projects"]')?.toggleAttribute("disabled", count === 0);
	const visible = asArray(state.controlProjects);
	const selectAll = document.querySelector('[data-action="select-all-projects"]');
	if (selectAll) {
		const selectedVisible = visible.filter((project) => state.projectSelection?.has(String(project.project_id))).length;
		selectAll.checked = visible.length > 0 && selectedVisible === visible.length;
		selectAll.indeterminate = selectedVisible > 0 && selectedVisible < visible.length;
	}
}

async function renderProjectDetail(token) {
  const route = state.route || parseConsoleRoute();
  const projectName = route.project;
  mainContent.innerHTML = `${pageHeader(projectName, "正在读取项目详情", refreshButton(), controlBreadcrumb([{ label: "项目", href: "#/projects" }, { label: projectName }]))}${demoBanner()}<section class="table-shell">${loadingRows()}</section>`;
  try {
    const [project, summary] = await Promise.all([
      controlData("project", { project: projectName }),
      controlData("project-summary", { project: projectName }).catch(() => ({})),
    ]);
	await loadProjectPermissions(project.project_id);
    let collection = { items: [], pagination: { page: route.page, page_size: controlPageSize, total: 0 } };
	if (!projectSectionAllowed(route.section, project.project_id)) {
	  collection.permissionDenied = true;
	} else if (route.section === "repositories") {
      collection = await controlList("repositories", { project: projectName, page: route.page, page_size: route.projectRepositoryPageSize, sort: route.projectRepositorySort, q: route.filter ? `name=~${route.filter}` : "" });
    } else if (route.section === "members") {
      collection = await controlList("project-members", { project: projectName, page: route.page, page_size: controlPageSize, entityname: route.filter });
    } else if (route.section === "robots") {
      const [robots, permissionMetadata] = await Promise.all([
        controlList("robots", { page: route.page, page_size: controlPageSize, sort: "name", q: `level=project,project_id=${project.project_id}` }),
        controlData("permissions"),
      ]);
      collection = { ...robots, permissionMetadata };
    } else if (route.section === "webhooks") {
      const [webhooks, events] = await Promise.all([
        controlList("webhooks", { project: projectName, page: route.page, page_size: controlPageSize, sort: "name" }),
        controlData("webhook-events", { project: projectName }).catch(() => ({})),
      ]);
      collection = { ...webhooks, events };
    } else if (route.section === "rules") {
      const [rules, labels, retentionMetadata] = await Promise.all([
        controlList("immutable-rules", { project: projectName, page: 1, page_size: 100, sort: "priority" }),
        controlList("labels", { scope: "p", project_id: project.project_id, page: 1, page_size: 100, sort: "name" }),
		controlData("retention-metadatas").catch((error) => ({ load_error: error.message })),
      ]);
	  collection = { ...rules, labels: labels.items, retentionMetadata };
    } else if (route.section === "retention") {
      const retentionID = toNumber(asObject(project.metadata).retention_id);
	  const metadataResult = controlData("retention-metadatas").then((metadata) => ({ metadata })).catch((error) => ({ metadata_error: error.message }));
      if (retentionID > 0) {
        const [policy, executions, metadata] = await Promise.all([
          controlData("retention", { id: retentionID }),
          controlList("retention-executions", { id: retentionID, page: route.page, page_size: controlPageSize }),
		  metadataResult,
        ]);
		collection = { ...executions, policy, ...metadata };
      } else {
		collection = { items: [], pagination: { page: 1, page_size: controlPageSize, total: 0 }, policy: null, ...(await metadataResult) };
      }
	} else if (route.section === "audit") {
	  const params = { project: projectName, page: route.page, page_size: controlPageSize, sort: "-op_time", q: route.filter ? `resource=~${auditQueryValue(route.filter)}` : "" };
	  try {
		collection = { ...(await controlList("project-audit-logs", params)), legacy: false };
	  } catch (error) {
		if (error.status !== 404) collection = { items: [], pagination: { page: 1, page_size: controlPageSize, total: 0 }, audit_error: error };
		else {
			try { collection = { ...(await controlList("legacy-project-audit-logs", params)), legacy: true }; }
			catch (legacyError) { collection = { items: [], pagination: { page: 1, page_size: controlPageSize, total: 0 }, audit_error: legacyError, legacy: true }; }
		}
	  }
    } else if (route.section === "preheat") {
      const [policiesResult, providersResult] = await Promise.allSettled([
        controlList("preheat-policies", { project: projectName, page: route.page, page_size: controlPageSize, sort: "-update_time", q: route.filter ? `name=~${route.filter}` : "" }),
        controlData("project-preheat-providers", { project: projectName }),
      ]);
      collection = {
        items: policiesResult.status === "fulfilled" ? policiesResult.value.items : [],
        pagination: policiesResult.status === "fulfilled" ? policiesResult.value.pagination : { page: 1, page_size: controlPageSize, total: 0 },
        providers: providersResult.status === "fulfilled" ? asArray(providersResult.value) : [],
        policies_error: policiesResult.status === "rejected" ? policiesResult.reason.message : "",
        providers_error: providersResult.status === "rejected" ? providersResult.reason.message : "",
      };
	} else if (route.section === "settings") {
	  const [scannerResult, candidatesResult, proxyRegistryResult, proxyRegistriesResult] = await Promise.allSettled([
		controlData("project-scanner", { project: projectName }),
		controlList("project-scanner-candidates", { project: projectName, page: 1, page_size: 100, sort: "name" }),
		toNumber(project.registry_id) > 0 ? controlData("registry", { id: project.registry_id }) : Promise.resolve(null),
		toNumber(project.registry_id) > 0 && isSystemAdmin() ? controlList("registries", { page: 1, page_size: 100, sort: "name" }) : Promise.resolve({ items: [] }),
	  ]);
	  collection = {
		scanner: scannerResult.status === "fulfilled" ? scannerResult.value : null,
		scanner_error: scannerResult.status === "rejected" ? scannerResult.reason.message : "",
		candidates: candidatesResult.status === "fulfilled" ? candidatesResult.value.items : [],
		candidates_error: candidatesResult.status === "rejected" ? candidatesResult.reason.message : "",
		proxyRegistry: proxyRegistryResult.status === "fulfilled" ? proxyRegistryResult.value : null,
		proxy_registry_error: proxyRegistryResult.status === "rejected" ? proxyRegistryResult.reason.message : "",
		proxyRegistries: proxyRegistriesResult.status === "fulfilled" ? proxyRegistriesResult.value.items : [],
	  };
    }
    if (token !== state.renderToken || state.currentView !== "project") return;
    state.controlProject = project;
    state.controlProjectItems = collection.items;
    state.controlProjectCollection = collection;
		if (route.section === "repositories") prepareRepositorySelection(route);
    const metadata = asObject(project.metadata);
    mainContent.innerHTML = `
      ${pageHeader(project.name || projectName, `${String(metadata.public) === "true" ? "公开" : "私有"}项目 · 所有者 ${project.owner_name || state.session.username}`, `${refreshButton()}<button class="button button-small" type="button" data-action="project-settings">${icon("settings")}<span>项目设置</span></button>`, controlBreadcrumb([{ label: "项目", href: "#/projects" }, { label: project.name || projectName }]))}
      ${demoBanner()}
      <section class="overview-stats project-stats" aria-label="项目统计">
        ${statCell("仓库", summary?.repo_count ?? project.repo_count, "项目中的镜像仓库", "package")}
        ${statCell("制品", summary?.artifact_count, "全部仓库制品", "database")}
        ${statCell("成员", toNumber(summary?.project_admin_count) + toNumber(summary?.maintainer_count) + toNumber(summary?.developer_count) + toNumber(summary?.guest_count), "拥有项目权限", "users")}
        ${statCell("扫描策略", String(metadata.auto_scan) === "true" ? "自动" : "手动", `阻断级别：${String(metadata.prevent_vul) === "true" ? severityInfo(metadata.severity)[0] : "关闭"}`, "shield", true)}
      </section>
      ${projectTabs(projectName, route.section)}
      ${renderProjectSection(project, route, collection)}
    `;
    bindProjectSection(project, route);
  } catch (error) {
    if (token === state.renderToken) renderError("项目详情载入失败", error.message, "refresh-view");
  }
}

function projectTabs(project, selected) {
  const tabs = [
    ["repositories", "仓库", "package", "repository", "list"],
    ["members", "成员", "users", "member", "list"],
    ["robots", "机器人账号", "terminal", "robot", "list"],
    ["webhooks", "Webhook", "refresh", "notification-policy", "list"],
    ["rules", "项目规则", "shield", "immutable-tag", "list"],
    ["retention", "Tag 保留", "history", "tag-retention", "read"],
	["audit", "审计", "history", "audit-log", "list"],
    ["preheat", "P2P 预热", "play", "preheat-policy", "read"],
    ["settings", "项目设置", "settings", "configuration", "read"],
  ].filter((tab) => hasProjectPermission(tab[3], tab[4], state.controlProject?.project_id));
  return `<nav class="resource-tabs" aria-label="项目页面">${tabs.map(([key, label, iconName]) => `<a href="${projectRoute(project, key)}" class="${selected === key ? "active" : ""}" ${selected === key ? 'aria-current="page"' : ""}>${icon(iconName)}<span>${label}</span></a>`).join("")}</nav>`;
}

function projectSectionAllowed(section, projectID) {
	const requirements = {
	  repositories: ["repository", "list"],
	  members: ["member", "list"],
	  robots: ["robot", "list"],
	  webhooks: ["notification-policy", "list"],
	  rules: ["immutable-tag", "list"],
	  retention: ["tag-retention", "read"],
	  audit: ["audit-log", "list"],
	  preheat: ["preheat-policy", "read"],
	  settings: ["configuration", "read"],
	};
	const required = requirements[section] || requirements.repositories;
	return hasProjectPermission(required[0], required[1], projectID);
}

function renderProjectSection(project, route, collection) {
	if (collection.permissionDenied) {
	  return `<section class="table-shell"><div class="empty-table permission-table"><span class="cell-icon">${icon("shield")}</span><strong>没有访问此项目页面的权限</strong><span>当前账号缺少 Harbor 要求的项目资源权限。</span></div></section>`;
	}
  if (route.section === "members") {
    return `<section class="table-shell"><div class="table-toolbar">${controlSearchForm("member-search", route.filter, "按成员名称搜索")}<div class="toolbar-spacer"></div><button class="button button-small button-primary" type="button" data-action="add-project-member">${icon("plus")}<span>添加成员</span></button></div><div class="table-scroll">${memberTable(collection.items)}</div>${controlPagination(collection.pagination)}</section>`;
  }
  if (route.section === "robots") return `<section class="table-shell"><div class="table-toolbar"><strong>项目机器人账号</strong><div class="toolbar-spacer"></div><button class="button button-small button-primary" type="button" data-action="create-project-robot">${icon("plus")}<span>新建机器人账号</span></button></div><div class="table-scroll">${robotTable(collection.items)}</div>${controlPagination(collection.pagination)}</section>`;
  if (route.section === "webhooks") return `<section class="table-shell"><div class="table-toolbar"><strong>Webhook 策略</strong><div class="toolbar-spacer"></div><button class="button button-small button-primary" type="button" data-action="create-webhook">${icon("plus")}<span>新建 Webhook</span></button></div><div class="table-scroll">${webhookTable(collection.items)}</div>${controlPagination(collection.pagination)}</section>`;
  if (route.section === "rules") return projectRulesSection(collection.items, collection.labels || [], collection.retentionMetadata);
  if (route.section === "retention") return projectRetentionSection(project, collection);
	if (route.section === "audit") return projectAuditSection(project, collection);
  if (route.section === "preheat") return projectPreheatSection(project, route, collection);
  if (route.section === "settings") return projectSettings(project, collection);
	const repositoryContent = repositoryViewMode() === "card"
		? controlRepositoryCards(collection.items, project.name)
		: `<div class="table-scroll">${controlRepositoryTable(collection.items, project.name)}</div>`;
  return `<section class="table-shell"><div class="table-toolbar">${controlSearchForm("project-repository-search", route.filter, "按仓库名称搜索")}<button class="button button-small button-primary" type="button" data-action="show-push-command">${icon("upload")}<span>推送镜像</span></button><div class="toolbar-spacer"></div><label class="toolbar-field"><span>排序</span><select id="project-repository-sort" class="toolbar-select"><option value="-update_time" ${route.projectRepositorySort === "-update_time" ? "selected" : ""}>最近推送</option><option value="-artifact_count" ${route.projectRepositorySort === "-artifact_count" ? "selected" : ""}>制品最多</option><option value="-pull_count" ${route.projectRepositorySort === "-pull_count" ? "selected" : ""}>拉取最多</option><option value="name" ${route.projectRepositorySort === "name" ? "selected" : ""}>名称</option></select></label><label class="toolbar-field"><span>每页</span><select id="project-repository-page-size" class="toolbar-select"><option value="20" ${route.projectRepositoryPageSize === 20 ? "selected" : ""}>20 条</option><option value="50" ${route.projectRepositoryPageSize === 50 ? "selected" : ""}>50 条</option><option value="100" ${route.projectRepositoryPageSize === 100 ? "selected" : ""}>100 条</option></select></label>${repositoryViewToggle()}</div>${repositoryBatchToolbar()}${repositoryContent}${controlPagination(collection.pagination)}</section>`;
}

function bindProjectSection(project, route) {
  if (route.section === "members") bindControlSearch("member-search", (term) => projectRoute(project.name, "members", 1, term));
  if (route.section === "repositories") {
    bindControlSearch("project-repository-search", (term) => projectRoute(project.name, "repositories", 1, term, { pageSize: route.projectRepositoryPageSize, sort: route.projectRepositorySort }));
    document.querySelector("#project-repository-sort")?.addEventListener("change", (event) => { location.hash = projectRoute(project.name, "repositories", 1, route.filter, { pageSize: route.projectRepositoryPageSize, sort: event.target.value }); });
		document.querySelector("#project-repository-page-size")?.addEventListener("change", (event) => { location.hash = projectRoute(project.name, "repositories", 1, route.filter, { pageSize: Number(event.target.value), sort: route.projectRepositorySort }); });
		updateRepositoryBatchToolbar();
  }
  if (route.section === "preheat") bindControlSearch("preheat-policy-search", (term) => projectRoute(project.name, "preheat", 1, term));
	if (route.section === "audit") bindControlSearch("project-audit-search", (term) => projectRoute(project.name, "audit", 1, term));
  const settingsForm = document.querySelector("#project-settings-form");
  settingsForm?.addEventListener("submit", saveProjectSettings);
  if (settingsForm) bindProjectAllowlistEditor(settingsForm);
}

function projectAuditSection(project, collection) {
	if (collection.audit_error) {
		const error = collection.audit_error;
		const message = error.status === 403 ? "当前账号没有查看此项目审计记录的权限。" : error.status === 404 ? "当前 Harbor 实例不支持项目级审计接口。" : error.message;
		return `<section class="table-shell"><div class="empty-table permission-table"><span class="cell-icon">${icon(error.status === 403 ? "shield" : "alert")}</span><strong>${error.status === 403 ? "没有访问项目审计的权限" : "项目审计载入失败"}</strong><span>${escapeHTML(message)}</span><button class="button button-small" type="button" data-action="refresh-view">${icon("refresh")}<span>重试</span></button></div></section>`;
	}
	const logs = asArray(collection.items);
	const empty = logs.length ? auditTable(logs, Boolean(state.route?.filter)) : emptyTable("暂无项目审计记录", "当前筛选条件下没有返回项目级审计事件。", "history");
	return `<section class="table-shell"><div class="table-toolbar">${controlSearchForm("project-audit-search", state.route?.filter || "", "按资源或用户筛选")}<div class="toolbar-spacer"></div>${collection.legacy ? '<span class="badge badge-orange">旧版审计</span>' : '<span class="badge badge-green">扩展审计</span>'}</div><div class="table-scroll audit-table-scroll">${empty}</div>${controlPagination(collection.pagination)}</section>`;
}

function controlRepositoryTable(repositories, project) {
  if (!repositories.length) return emptyTable("暂无仓库", "镜像首次推送后会出现在这里。", "package");
	const selection = state.repositorySelection || new Set();
	const allSelected = repositories.every((repository) => selection.has(String(repository.id)));
  return `<table class="repository-select-table"><thead><tr><th class="selection-cell"><input type="checkbox" data-action="select-all-repositories" ${allSelected ? "checked" : ""} aria-label="选择当前页全部仓库"></th><th>仓库</th><th>制品</th><th>拉取次数</th><th>描述</th><th>最近推送</th><th></th></tr></thead><tbody>
	    ${repositories.map((repository) => {
		  const selected = selection.has(String(repository.id));
		  return `<tr class="clickable-row ${selected ? "selected-row" : ""}" data-action="control-open-repository" data-project="${escapeAttr(project)}" data-repository="${escapeAttr(repository.name)}">
		  <td class="selection-cell"><input type="checkbox" data-action="select-repository" data-id="${escapeAttr(repository.id)}" ${selected ? "checked" : ""} aria-label="选择 ${escapeAttr(repositoryDisplayName(project, repository.name))}"></td>
      <td><div class="cell-title"><span class="cell-icon">${icon("package")}</span><span class="cell-stack"><strong>${escapeHTML(repositoryDisplayName(project, repository.name))}</strong><small class="mono">#${escapeHTML(repository.id ?? "-")}</small></span></div></td>
	      <td class="mono">${formatNumber(repository.artifact_count)}</td><td class="mono">${formatNumber(repository.pull_count)}</td><td class="truncate-cell">${escapeHTML(repository.description || "-")}</td><td>${formatDate(repository.update_time)}</td><td><div class="row-actions"><button class="icon-button" type="button" data-action="show-push-command" data-repository="${escapeAttr(repository.name)}" title="推送指引" aria-label="查看推送指引">${icon("upload")}</button>${icon("chevron")}</div></td>
	    </tr>`;
		}).join("")}
  </tbody></table>`;
}

function repositoryViewToggle() {
	const mode = repositoryViewMode();
	return `<div class="view-mode-toggle" role="group" aria-label="仓库展示方式"><button type="button" data-action="set-repository-view" data-view="list" class="${mode === "list" ? "active" : ""}" title="列表视图" aria-label="列表视图" aria-pressed="${mode === "list"}">${icon("list")}</button><button type="button" data-action="set-repository-view" data-view="card" class="${mode === "card" ? "active" : ""}" title="卡片视图" aria-label="卡片视图" aria-pressed="${mode === "card"}">${icon("grid")}</button></div>`;
}

function controlRepositoryCards(repositories, project) {
	if (!repositories.length) return emptyTable("暂无仓库", "镜像首次推送后会出现在这里。", "package");
	const selection = state.repositorySelection || new Set();
	return `<div class="repository-card-grid">${repositories.map((repository) => {
		const selected = selection.has(String(repository.id));
		return `<article class="repository-card ${selected ? "selected" : ""}"><header><label class="repository-card-select"><input type="checkbox" data-action="select-repository" data-id="${escapeAttr(repository.id)}" ${selected ? "checked" : ""} aria-label="选择 ${escapeAttr(repositoryDisplayName(project, repository.name))}"></label><span class="cell-icon">${icon("package")}</span><div><button type="button" data-action="control-open-repository" data-project="${escapeAttr(project)}" data-repository="${escapeAttr(repository.name)}">${escapeHTML(repositoryDisplayName(project, repository.name))}</button><span class="mono">#${escapeHTML(repository.id ?? "-")}</span></div><button class="icon-button" type="button" data-action="show-push-command" data-repository="${escapeAttr(repository.name)}" title="推送指引" aria-label="查看推送指引">${icon("upload")}</button></header><p>${escapeHTML(repository.description || "暂无仓库描述")}</p><dl><div><dt>制品</dt><dd>${formatNumber(repository.artifact_count)}</dd></div><div><dt>累计拉取</dt><dd>${formatNumber(repository.pull_count)}</dd></div><div><dt>最近推送</dt><dd>${formatDate(repository.update_time)}</dd></div></dl></article>`;
	}).join("")}</div>`;
}

function prepareRepositorySelection(route) {
	const key = [route.project, route.page, route.projectRepositoryPageSize, route.projectRepositorySort, route.filter].join("|");
	if (state.repositorySelectionKey !== key) {
		state.repositorySelectionKey = key;
		state.repositorySelection = new Set();
	}
}

function selectedRepositoryItems() {
	const selection = state.repositorySelection || new Set();
	return asArray(state.controlProjectItems).filter((repository) => selection.has(String(repository.id)));
}

function repositoryBatchToolbar() {
	return `<div class="artifact-batch-toolbar repository-batch-toolbar"><span><strong id="repository-selection-count">0</strong> 个已选择</span><div><button class="button button-small button-danger" type="button" data-action="batch-delete-repositories" disabled>${icon("trash")}<span>删除仓库</span></button></div></div>`;
}

function toggleRepositorySelection(target) {
	if (!state.repositorySelection) state.repositorySelection = new Set();
	if (target.checked) state.repositorySelection.add(String(target.dataset.id));
	else state.repositorySelection.delete(String(target.dataset.id));
	target.closest("tr, .repository-card")?.classList.toggle(target.closest("tr") ? "selected-row" : "selected", target.checked);
	updateRepositoryBatchToolbar();
}

function toggleAllRepositorySelection(target) {
	if (!state.repositorySelection) state.repositorySelection = new Set();
	asArray(state.controlProjectItems).forEach((repository) => {
		if (target.checked) state.repositorySelection.add(String(repository.id));
		else state.repositorySelection.delete(String(repository.id));
	});
	document.querySelectorAll('[data-action="select-repository"]').forEach((checkbox) => {
		checkbox.checked = target.checked;
		checkbox.closest("tr, .repository-card")?.classList.toggle(checkbox.closest("tr") ? "selected-row" : "selected", target.checked);
	});
	updateRepositoryBatchToolbar();
}

function updateRepositoryBatchToolbar() {
	const count = selectedRepositoryItems().length;
	const output = document.querySelector("#repository-selection-count");
	if (output) output.textContent = formatNumber(count);
	document.querySelector('[data-action="batch-delete-repositories"]')?.toggleAttribute("disabled", count === 0);
	const visible = asArray(state.controlProjectItems);
	const selectAll = document.querySelector('[data-action="select-all-repositories"]');
	if (selectAll) {
		const selectedVisible = visible.filter((repository) => state.repositorySelection?.has(String(repository.id))).length;
		selectAll.checked = visible.length > 0 && selectedVisible === visible.length;
		selectAll.indeterminate = selectedVisible > 0 && selectedVisible < visible.length;
	}
}

function setRepositoryView(mode) {
	saveConsolePreferences({ ...state.preferences, repositoryView: mode === "card" ? "card" : "list" });
	renderCurrentView(true);
}

async function runTrackedBatch({ kind, title, detail, items, label, worker, concurrency = 4 }) {
	const operationID = beginOperation({ kind, title, detail, total: items.length });
	let cursor = 0;
	const failures = [];
	const runners = Array.from({ length: Math.min(Math.max(1, concurrency), items.length) }, async () => {
		while (cursor < items.length) {
			const index = cursor;
			cursor += 1;
			const item = items[index];
			const itemLabel = label(item);
			try {
				await worker(item);
				recordOperationResult(operationID, itemLabel);
			} catch (error) {
				const message = error?.message || "未知错误";
				failures.push({ item, label: itemLabel, message });
				recordOperationResult(operationID, itemLabel, message);
			}
		}
	});
	await Promise.all(runners);
	finishOperation(operationID, failures.length ? `成功 ${items.length - failures.length} 项，失败 ${failures.length} 项` : `已完成 ${items.length} 项`);
	return { operationID, failures, succeeded: items.length - failures.length };
}

function showBatchDeleteProjectsDialog() {
	const items = selectedProjectItems();
	if (!items.length) return;
	const confirmation = `DELETE ${items.length}`;
	openControlDialog({
		title: "批量删除项目",
		subtitle: `将逐项请求 Harbor 删除 ${items.length} 个项目`,
		submitLabel: "永久删除",
		destructive: true,
		content: `<div class="destructive-message">${icon("alert")}<span>Harbor 会拒绝删除仍含仓库的项目。请输入 <code>${escapeHTML(confirmation)}</code> 确认。</span></div><div class="batch-resource-preview">${items.map((project) => `<span>${icon("folder")}<code>${escapeHTML(project.name)}</code></span>`).join("")}</div><label class="field"><span>确认文本</span><input name="confirmation" required autocomplete="off"></label>`,
		onSubmit: async (formData) => {
			if (String(formData.get("confirmation") || "").trim() !== confirmation) throw new Error(`请输入 ${confirmation} 确认`);
			closeControlDialog();
			const result = await runTrackedBatch({
				kind: "project-delete",
				title: "批量删除项目",
				detail: `${items.length} 个项目`,
				items,
				label: (project) => project.name,
				worker: async (project) => {
					await controlMutation("project", { project: project.name }, "DELETE");
					state.projectSelection?.delete(String(project.project_id));
				},
			});
			showToast(result.failures.length ? `项目删除完成，${result.failures.length} 项失败` : `${items.length} 个项目已删除`, result.failures.length > 0);
			if (state.currentView === "projects") renderCurrentView(true);
		},
	});
}

function showBatchDeleteRepositoriesDialog() {
	const items = selectedRepositoryItems();
	if (!items.length) return;
	const project = state.route.project;
	const confirmation = `DELETE ${items.length}`;
	openControlDialog({
		title: "批量删除仓库",
		subtitle: `将永久删除 ${items.length} 个仓库及其中全部制品`,
		submitLabel: "永久删除",
		destructive: true,
		content: `<div class="destructive-message">${icon("alert")}<span>此操作无法撤销。请输入 <code>${escapeHTML(confirmation)}</code> 确认。</span></div><div class="batch-resource-preview">${items.map((repository) => `<span>${icon("package")}<code>${escapeHTML(repositoryDisplayName(project, repository.name))}</code></span>`).join("")}</div><label class="field"><span>确认文本</span><input name="confirmation" required autocomplete="off"></label>`,
		onSubmit: async (formData) => {
			if (String(formData.get("confirmation") || "").trim() !== confirmation) throw new Error(`请输入 ${confirmation} 确认`);
			closeControlDialog();
			const result = await runTrackedBatch({
				kind: "repository-delete",
				title: "批量删除仓库",
				detail: `项目 ${project}`,
				items,
				label: (repository) => repositoryDisplayName(project, repository.name),
				worker: async (repository) => {
					await controlMutation("repository", { project, repository: repository.name }, "DELETE");
					state.repositorySelection?.delete(String(repository.id));
				},
			});
			showToast(result.failures.length ? `仓库删除完成，${result.failures.length} 项失败` : `${items.length} 个仓库已删除`, result.failures.length > 0);
			if (state.currentView === "project" && state.route.project === project && state.route.section === "repositories") renderCurrentView(true);
		},
	});
}

function pushCommandList(project, repository, localImage, tag) {
	const host = safeURL(state.session.instance_url)?.host || String(state.session.instance_url).replace(/^https?:\/\//, "").replace(/\/$/, "");
	const runtime = commandRuntime();
	const target = `${host}/${fullRepositoryName(project, repository)}:${tag}`;
	return [`${runtime} login ${host}`, `${runtime} tag ${localImage} ${target}`, `${runtime} push ${target}`];
}

function showPushCommandDialog(repository = "", project = state.route.project) {
	const repositoryName = repositoryDisplayName(project, repository || "");
	openControlDialog({
		title: "推送镜像",
		subtitle: `${project} · ${commandRuntime()}`,
		submitLabel: "关闭",
		submitIcon: "x",
		hideCancel: true,
		dialogClass: "control-dialog-wide",
		content: `<div class="form-grid push-command-fields"><label class="field"><span>本地镜像</span><input name="local_image" required maxlength="512" pattern="[^\\s]+" value="local-image:latest" placeholder="local-image:latest"></label><label class="field"><span>目标仓库</span><input name="repository" required maxlength="255" pattern="[a-z0-9]+([/._-][a-z0-9]+)*" value="${escapeAttr(repositoryName)}" placeholder="service/api"></label><label class="field"><span>目标 Tag</span><input name="tag" required maxlength="128" pattern="[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}" value="latest"></label></div><section class="push-command-preview"><header><div><strong>命令序列</strong><span>使用 ${escapeHTML(commandRuntime())} 登录、标记并推送</span></div><button class="button button-small" type="button" data-action="copy-push-commands">${icon("copy")}<span>复制全部</span></button></header><div id="push-command-list"></div></section><div class="warning-banner">${icon("shield")}<span>命令只在浏览器中生成，不会向 Harbor 发送本地镜像名称。</span></div>`,
		onSubmit: async () => closeControlDialog(),
	});
	const form = document.querySelector("#control-dialog-form");
	const refresh = () => {
		const data = new FormData(form);
		const repositoryValue = String(data.get("repository") || "").trim();
		const localImage = String(data.get("local_image") || "").trim();
		const tag = String(data.get("tag") || "").trim();
		state.pushCommands = repositoryValue && localImage && tag ? pushCommandList(project, repositoryValue, localImage, tag) : [];
		const output = document.querySelector("#push-command-list");
		if (output) output.innerHTML = state.pushCommands.map((command, index) => `<div class="command-row"><span class="command-step">${index + 1}</span><code>${escapeHTML(command)}</code><button class="icon-button" type="button" data-action="copy-value" data-value="${escapeAttr(command)}" title="复制命令" aria-label="复制命令">${icon("copy")}</button></div>`).join("");
	};
	form?.querySelectorAll('[name="local_image"], [name="repository"], [name="tag"]').forEach((input) => input.addEventListener("input", refresh));
	refresh();
}

function repositoryDisplayName(project, repository) {
  return String(repository || "").replace(new RegExp(`^${escapeRegExp(project)}/`), "");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function memberTable(members) {
  if (!members.length) return emptyTable("暂无成员", "当前项目中没有匹配的成员。", "users");
  return `<table><thead><tr><th>成员</th><th>类型</th><th>角色</th><th>成员编号</th><th></th></tr></thead><tbody>${members.map((member) => `<tr>
    <td><div class="cell-title"><span class="cell-icon">${icon("users")}</span><span class="cell-stack"><strong>${escapeHTML(member.entity_name)}</strong><small>实体编号 ${escapeHTML(member.entity_id ?? "-")}</small></span></div></td>
    <td>${member.entity_type === "g" ? "用户组" : "用户"}</td><td>${roleBadge(member.role_id, member.role_name)}</td><td class="mono">#${escapeHTML(member.id)}</td>
    <td><div class="row-actions"><button class="icon-button" type="button" data-action="edit-project-member" data-member-id="${escapeAttr(member.id)}" title="修改角色" aria-label="修改角色">${icon("edit")}</button><button class="icon-button danger-icon" type="button" data-action="delete-project-member" data-member-id="${escapeAttr(member.id)}" data-member-name="${escapeAttr(member.entity_name)}" title="删除成员" aria-label="删除成员">${icon("trash")}</button></div></td>
  </tr>`).join("")}</tbody></table>`;
}

function roleBadge(roleID, fallback) {
  const labels = { 1: "项目管理员", 2: "开发者", 3: "访客", 4: "维护者" };
  return `<span class="badge ${toNumber(roleID) === 1 ? "badge-orange" : "badge-blue"}">${labels[toNumber(roleID)] || escapeHTML(fallback || "未知")}</span>`;
}

function robotTable(robots) {
  if (!robots.length) return emptyTable("暂无机器人账号", "创建项目机器人账号后可用于 CI/CD 拉取和推送。", "terminal");
  return `<table><thead><tr><th>机器人账号</th><th>权限</th><th>状态</th><th>到期时间</th><th>创建时间</th><th></th></tr></thead><tbody>${robots.map((robot) => `<tr><td><div class="cell-title"><span class="cell-icon">${icon("terminal")}</span><span class="cell-stack"><strong>${escapeHTML(robot.name)}</strong><small>${escapeHTML(robot.description || `账号 #${robot.id}`)}</small></span></div></td><td>${robotPermissionBadge(robot)}</td><td>${robot.disable ? '<span class="badge badge-red">已停用</span>' : '<span class="badge badge-green">已启用</span>'}</td><td>${robot.expires_at === -1 ? "永不过期" : formatUnixDate(robot.expires_at)}</td><td>${formatDate(robot.creation_time)}</td><td><div class="row-actions"><button class="icon-button" type="button" data-action="reset-robot-secret" data-id="${escapeAttr(robot.id)}" title="重置密钥" aria-label="重置密钥">${icon("refresh")}</button><button class="icon-button" type="button" data-action="edit-project-robot" data-id="${escapeAttr(robot.id)}" title="编辑机器人账号" aria-label="编辑机器人账号">${icon("edit")}</button><button class="icon-button danger-icon" type="button" data-action="delete-project-robot" data-id="${escapeAttr(robot.id)}" data-name="${escapeAttr(robot.name)}" title="删除机器人账号" aria-label="删除机器人账号">${icon("trash")}</button></div></td></tr>`).join("")}</tbody></table>`;
}

function robotPermissionBadge(robot) {
  const access = asArray(robot.permissions).flatMap((permission) => asArray(permission.access));
  const actions = access.map((item) => item.action);
  const writable = actions.includes("push") || actions.includes("create");
  return `<span class="badge ${writable ? "badge-orange" : "badge-blue"}">${formatNumber(access.length)} 项${writable ? " · 含写入" : " · 只读"}</span>`;
}

function formatUnixDate(value) {
  const seconds = toNumber(value);
  if (!seconds || seconds < 0) return "暂无";
  return formatDate(new Date(seconds * 1000).toISOString(), false);
}

function webhookTable(webhooks) {
  if (!webhooks.length) return emptyTable("暂无 Webhook", "创建 Webhook 后可将 Harbor 事件发送到外部系统。", "refresh");
  return `<table><thead><tr><th>Webhook</th><th>目标地址</th><th>事件</th><th>状态</th><th>最近更新</th><th></th></tr></thead><tbody>${webhooks.map((webhook) => {
    const target = asObject(asArray(webhook.targets)[0]);
    return `<tr><td><div class="cell-title"><span class="cell-icon">${icon("refresh")}</span><span class="cell-stack"><strong>${escapeHTML(webhook.name)}</strong><small>${escapeHTML(webhook.description || `策略 #${webhook.id}`)}</small></span></div></td><td class="truncate-cell mono">${escapeHTML(target.address || "-")}</td><td><span class="badge badge-blue">${formatNumber(asArray(webhook.event_types).length)} 种事件</span></td><td>${webhook.enabled ? '<span class="badge badge-green">已启用</span>' : '<span class="badge">已停用</span>'}</td><td>${formatDate(webhook.update_time || webhook.creation_time)}</td><td><div class="row-actions"><button class="icon-button" type="button" data-action="view-webhook-history" data-id="${escapeAttr(webhook.id)}" data-name="${escapeAttr(webhook.name)}" title="执行历史" aria-label="查看 Webhook 执行历史">${icon("history")}</button><button class="icon-button" type="button" data-action="edit-webhook" data-id="${escapeAttr(webhook.id)}" title="编辑 Webhook" aria-label="编辑 Webhook">${icon("edit")}</button><button class="icon-button danger-icon" type="button" data-action="delete-webhook" data-id="${escapeAttr(webhook.id)}" data-name="${escapeAttr(webhook.name)}" title="删除 Webhook" aria-label="删除 Webhook">${icon("trash")}</button></div></td></tr>`;
  }).join("")}</tbody></table>`;
}

function projectRulesSection(rules, labels, retentionMetadata) {
  const metadataAvailable = !asObject(retentionMetadata).load_error && Object.keys(asObject(retentionMetadata)).length > 0;
  const help = metadataAvailable ? "" : `<p class="section-notice warning-notice">${escapeHTML(asObject(retentionMetadata).load_error || "当前 Harbor 实例未提供 selector metadata，不可变规则编辑已禁用。")}</p>`;
  return `<div class="rules-layout"><section><div class="section-heading"><div><h2>不可变 Tag 规则</h2><p>${formatNumber(rules.length)} 条规则</p></div><button class="button button-small button-primary" type="button" data-action="create-immutable-rule" ${metadataAvailable ? "" : "disabled"}>${icon("plus")}<span>新建规则</span></button></div>${help}<div class="table-shell"><div class="table-scroll">${immutableRuleTable(rules)}</div></div></section><section><div class="section-heading"><div><h2>项目标签</h2><p>${formatNumber(labels.length)} 个标签</p></div><button class="button button-small button-primary" type="button" data-action="create-project-label">${icon("plus")}<span>新建标签</span></button></div><div class="table-shell"><div class="table-scroll">${projectLabelTable(labels)}</div></div></section></div>`;
}

function projectRetentionSection(project, collection) {
  const policy = collection.policy ? asObject(collection.policy) : null;
	const metadataAvailable = Object.keys(asObject(collection.metadata)).length > 0;
	const editorDisabled = metadataAvailable ? "" : "disabled";
	const editorHelp = metadataAvailable ? "" : `<p class="section-notice warning-notice">${escapeHTML(collection.metadata_error || "当前 Harbor 实例未提供 Retention metadata，规则仍可查看但已禁用危险编辑。")}</p>`;
  if (!policy?.id) {
    return `<section class="table-shell retention-empty"><div class="table-toolbar"><strong>Tag 保留策略</strong><div class="toolbar-spacer"></div><button class="button button-small button-primary" type="button" data-action="create-retention-policy" ${editorDisabled}>${icon("plus")}<span>创建策略</span></button></div>${editorHelp}${emptyTable("尚未配置 Tag 保留", "创建策略后，Harbor 会按规则自动清理不再需要的 Tag。", "history")}</section>`;
  }
  const rules = asArray(policy.rules);
  const trigger = asObject(policy.trigger);
  const settings = asObject(trigger.settings);
  const executions = asArray(collection.items);
  return `<div class="retention-layout">
    <section class="retention-summary">
      <div class="retention-summary-head"><div><span class="eyebrow">策略 #${escapeHTML(policy.id)}</span><h2>Tag 保留策略</h2><p>规则按${policy.algorithm === "and" ? "全部匹配" : "任意匹配"}方式执行</p></div><div class="page-actions"><button class="button button-small" type="button" data-action="run-retention" data-dry-run="true">${icon("play")}<span>仅演练</span></button><button class="button button-small button-primary" type="button" data-action="run-retention" data-dry-run="false">${icon("play")}<span>正式执行</span></button><button class="icon-button" type="button" data-action="edit-retention-schedule" title="编辑执行计划" aria-label="编辑执行计划">${icon("settings")}</button><button class="icon-button danger-icon" type="button" data-action="delete-retention-policy" title="删除 Tag 保留策略" aria-label="删除 Tag 保留策略">${icon("trash")}</button></div></div>
      <dl class="retention-facts"><div><dt>规则数量</dt><dd>${formatNumber(rules.length)} 条</dd></div><div><dt>执行计划</dt><dd>${settings.cron ? "定时执行" : "仅手动"}</dd></div><div><dt>Cron</dt><dd class="mono">${escapeHTML(settings.cron || "未配置")}</dd></div><div><dt>最近更新</dt><dd>${formatDate(policy.update_time || policy.creation_time)}</dd></div></dl>
    </section>
    <section class="table-shell"><div class="table-toolbar"><strong>保留规则</strong><div class="toolbar-spacer"></div><button class="button button-small button-primary" type="button" data-action="add-retention-rule" ${editorDisabled}>${icon("plus")}<span>添加规则</span></button></div>${editorHelp}<div class="table-scroll">${retentionRuleTable(rules, metadataAvailable)}</div></section>
    <section class="table-shell"><div class="table-toolbar"><strong>执行历史</strong><div class="toolbar-spacer"></div><span class="muted">${formatNumber(collection.pagination?.total || executions.length)} 次执行</span></div><div class="table-scroll">${retentionExecutionTable(executions, policy.id)}</div>${controlPagination(collection.pagination)}</section>
  </div>`;
}

function retentionRuleTable(rules, editable = true) {
  if (!rules.length) return emptyTable("暂无保留规则", "策略至少需要一条启用或停用的保留规则。", "history");
  return `<table><thead><tr><th>保留条件</th><th>仓库范围</th><th>Tag 范围</th><th>状态</th><th></th></tr></thead><tbody>${rules.map((rule, index) => {
    const repository = asArray(asObject(rule.scope_selectors).repository)[0] || {};
    const tag = asArray(rule.tag_selectors)[0] || {};
    return `<tr><td><div class="cell-stack"><strong>${escapeHTML(retentionTemplateLabel(rule.template))}</strong><small>${escapeHTML(retentionRuleParameter(rule))}</small></div></td><td><code>${escapeHTML(repository.pattern || "**")}</code></td><td><code>${escapeHTML(tag.pattern || "**")}</code></td><td>${rule.disabled ? '<span class="badge">已停用</span>' : '<span class="badge badge-green">已启用</span>'}</td><td><div class="row-actions"><button class="icon-button" type="button" data-action="edit-retention-rule" data-index="${index}" title="编辑保留规则" aria-label="编辑保留规则" ${editable ? "" : "disabled"}>${icon("edit")}</button><button class="icon-button danger-icon" type="button" data-action="delete-retention-rule" data-index="${index}" title="删除保留规则" aria-label="删除保留规则" ${editable ? "" : "disabled"}>${icon("trash")}</button></div></td></tr>`;
  }).join("")}</tbody></table>`;
}

function retentionTemplateLabel(template) {
  const labels = { latestPushedK: "最近推送", latestPulledN: "最近拉取", nDaysSinceLastPush: "推送时间范围", nDaysSinceLastPull: "拉取时间范围", always: "永久保留" };
  return labels[template] || template || "保留规则";
}

function retentionRuleParameter(rule) {
  if (rule.template === "always") return "所有匹配制品";
  const value = toNumber(asObject(rule.params)[rule.template]);
  if (rule.template === "latestPushedK" || rule.template === "latestPulledN") return `保留 ${formatNumber(value)} 个制品`;
  return `保留最近 ${formatNumber(value)} 天的制品`;
}

function retentionExecutionTable(executions, policyID) {
  if (!executions.length) return emptyTable("暂无执行记录", "执行演练或正式清理后会显示在这里。", "history");
  return `<table><thead><tr><th>执行编号</th><th>模式</th><th>状态</th><th>开始时间</th><th>结束时间</th><th></th></tr></thead><tbody>${executions.map((execution) => {
    const canStop = ["running", "pending", "inprogress", "in_progress"].includes(String(execution.status || "").toLowerCase());
    return `<tr><td class="mono">#${escapeHTML(execution.id)}</td><td>${execution.dry_run ? '<span class="badge badge-blue">仅演练</span>' : '<span class="badge badge-orange">正式执行</span>'}</td><td>${statusBadge(execution.status)}</td><td>${formatDate(execution.start_time)}</td><td>${formatDate(execution.end_time)}</td><td><div class="row-actions"><button class="icon-button" type="button" data-action="view-retention-execution" data-policy-id="${escapeAttr(policyID)}" data-id="${escapeAttr(execution.id)}" title="查看任务" aria-label="查看 Tag 保留任务">${icon("history")}</button>${canStop ? `<button class="icon-button danger-icon" type="button" data-action="stop-retention-execution" data-policy-id="${escapeAttr(policyID)}" data-id="${escapeAttr(execution.id)}" title="停止执行" aria-label="停止执行">${icon("x")}</button>` : ""}</div></td></tr>`;
  }).join("")}</tbody></table>`;
}

function immutableRuleTable(rules) {
  if (!rules.length) return emptyTable("暂无不可变规则", "创建规则后，匹配的 Tag 将禁止覆盖或删除。", "shield");
  return `<table><thead><tr><th>仓库范围</th><th>Tag 范围</th><th>状态</th><th></th></tr></thead><tbody>${rules.map((rule) => {
    const repo = asArray(asObject(rule.scope_selectors).repository)[0] || {};
    const tag = asArray(rule.tag_selectors)[0] || {};
    return `<tr><td><code>${escapeHTML(repo.pattern || "**")}</code></td><td><code>${escapeHTML(tag.pattern || "**")}</code></td><td>${rule.disabled ? '<span class="badge">已停用</span>' : '<span class="badge badge-green">已启用</span>'}</td><td><div class="row-actions"><button class="icon-button" type="button" data-action="edit-immutable-rule" data-id="${escapeAttr(rule.id)}" title="编辑规则" aria-label="编辑规则">${icon("edit")}</button><button class="icon-button danger-icon" type="button" data-action="delete-immutable-rule" data-id="${escapeAttr(rule.id)}" title="删除规则" aria-label="删除规则">${icon("trash")}</button></div></td></tr>`;
  }).join("")}</tbody></table>`;
}

function projectLabelTable(labels) {
  if (!labels.length) return emptyTable("暂无项目标签", "标签可用于标记和筛选制品。", "tag");
  return `<table><thead><tr><th>标签</th><th>描述</th><th>最近更新</th><th></th></tr></thead><tbody>${labels.map((label) => `<tr><td><div class="cell-title">${labelSwatch(label.color)}<strong>${escapeHTML(label.name)}</strong></div></td><td>${escapeHTML(label.description || "-")}</td><td>${formatDate(label.update_time || label.creation_time)}</td><td><div class="row-actions"><button class="icon-button" type="button" data-action="edit-project-label" data-id="${escapeAttr(label.id)}" title="编辑标签" aria-label="编辑标签">${icon("edit")}</button><button class="icon-button danger-icon" type="button" data-action="delete-project-label" data-id="${escapeAttr(label.id)}" data-name="${escapeAttr(label.name)}" title="删除标签" aria-label="删除标签">${icon("trash")}</button></div></td></tr>`).join("")}</tbody></table>`;
}

function safeLabelColor(value) {
  return /^#[0-9a-f]{6}$/i.test(String(value || "")) ? value : "#7b7b82";
}

function labelSwatch(color, extraClass = "") {
  const safeClass = /^[a-z0-9 _-]*$/i.test(extraClass) ? extraClass.trim() : "";
  return `<svg class="label-swatch${safeClass ? ` ${safeClass}` : ""}" viewBox="0 0 12 12" aria-hidden="true" focusable="false"><rect width="12" height="12" rx="3" fill="${escapeAttr(safeLabelColor(color))}"></rect></svg>`;
}

function projectSettings(project, collection = {}) {
  const metadata = asObject(project.metadata);
  const allowlist = asObject(project.cve_allowlist);
  const reuseSystemAllowlist = String(metadata.reuse_sys_cve_allowlist ?? "true") === "true";
  const limit = toNumber(project.storage_limit);
  const limitGB = limit > 0 ? (limit / 1024 ** 3).toFixed(1) : "";
  const currentScanner = asObject(collection.scanner);
  const candidates = asArray(collection.candidates);
  const scannerOptions = candidates.length
    ? candidates.map((scanner) => `<option value="${escapeAttr(scanner.uuid)}" ${scanner.uuid === currentScanner.uuid ? "selected" : ""}>${escapeHTML(scanner.name || scanner.adapter || scanner.uuid)}${scanner.is_default ? "（系统默认）" : ""}</option>`).join("")
    : currentScanner.uuid ? `<option value="${escapeAttr(currentScanner.uuid)}" selected>${escapeHTML(currentScanner.name || currentScanner.adapter || currentScanner.uuid)}</option>` : "";
	const scannerError = collection.scanner_error || collection.candidates_error;
	const proxyRegistry = asObject(collection.proxyRegistry);
	const proxyRegistries = asArray(collection.proxyRegistries);
	const isProxyCache = toNumber(project.registry_id) > 0;
	const proxySpeed = toNumber(metadata.proxy_speed_kb) || -1;
	const maxUpstreamConnections = toNumber(metadata.max_upstream_conn) || -1;
	return `<section class="settings-layout">
	  <form id="project-settings-form" class="settings-form">
		<div class="section-heading"><div><h2>访问与安全</h2><p>项目级策略</p></div><button class="button button-small button-primary" type="submit">${icon("check")}<span>保存设置</span></button></div>
		<section class="project-mode-summary"><div><span class="cell-icon">${icon(isProxyCache ? "refresh" : "folder")}</span><div><strong>${isProxyCache ? "镜像代理项目" : "普通项目"}</strong><small>${isProxyCache ? `${proxyRegistry.name || `远端仓库 #${project.registry_id}`} · ${proxyRegistry.url || "地址未返回"}` : "项目创建后不能切换为镜像代理模式"}</small></div></div><span class="badge ${isProxyCache ? "badge-orange" : ""}">${isProxyCache ? "Proxy Cache" : "Standard"}</span></section>
		${collection.proxy_registry_error ? `<div class="warning-banner settings-warning">${icon("alert")}<span>镜像代理仓库信息载入失败：${escapeHTML(collection.proxy_registry_error)}</span></div>` : ""}
		<div class="settings-grid">
		  ${toggleField("project-public", "项目公开", "允许未登录用户拉取制品", String(metadata.public) === "true")}
		  ${toggleField("project-auto-scan", "推送后自动扫描", "新制品入库后自动触发漏洞扫描", String(metadata.auto_scan) === "true")}
		  ${toggleField("project-auto-sbom", "自动生成 SBOM", "新制品入库后生成软件物料清单", String(metadata.auto_sbom_generation) === "true")}
		  ${toggleField("project-content-trust", "Notary 内容信任", "要求 Notary 签名验证", String(metadata.enable_content_trust) === "true")}
		  ${toggleField("project-content-trust-cosign", "Cosign 内容信任", "要求 Cosign 签名验证", String(metadata.enable_content_trust_cosign) === "true")}
		  ${toggleField("project-prevent-vul", "阻止高风险制品拉取", "按下方风险级别阻止拉取", String(metadata.prevent_vul) === "true")}
		  ${toggleField("project-reuse-allowlist", "继承系统 CVE 白名单", "关闭后使用此项目的独立白名单", reuseSystemAllowlist)}
		  ${isProxyCache ? toggleField("project-proxy-local-fallback", "上游未找到时使用本地制品", "远端返回未找到时允许读取本地缓存", String(metadata.proxy_cache_local_on_not_found) === "true") : ""}
		</div>
		<div class="form-grid two-columns">
		  <label class="field"><span>漏洞阻止级别</span><select id="project-severity">${severityOptions(metadata.severity)}</select></label>
		  <label class="field"><span>存储配额（GiB）</span><input id="project-storage-limit" type="number" min="-1" step="1" value="${escapeAttr(limit > 0 ? Math.max(1, Math.round(limit / 1024 ** 3)) : -1)}"><small class="field-help">输入 -1 表示不限制；精确配额也可在项目配额页修改。</small></label>
		  ${isProxyCache && isSystemAdmin() ? `<label class="field"><span>远端仓库</span><select id="project-proxy-registry">${proxyRegistries.map((registry) => `<option value="${escapeAttr(registry.id)}" ${Number(registry.id) === Number(project.registry_id) ? "selected" : ""}>${escapeHTML(registry.name || `仓库 #${registry.id}`)}</option>`).join("")}</select></label>` : ""}${isProxyCache ? `<label class="field"><span>上游带宽限制（Kbps）</span><input id="project-proxy-speed" type="number" min="-1" step="1" value="${escapeAttr(proxySpeed)}"><small class="field-help">输入 -1 表示不限制。</small></label><label class="field"><span>上游最大连接数</span><input id="project-max-upstream-connections" type="number" min="-1" step="1" value="${escapeAttr(maxUpstreamConnections)}"><small class="field-help">输入 -1 表示不限制。</small></label>` : ""}
		  <label class="field field-span"><span>项目漏洞扫描器</span><select id="project-scanner" ${scannerOptions ? "" : "disabled"}>${scannerOptions || '<option value="">暂无可用扫描器</option>'}</select><small class="field-help">项目扫描任务将使用此扫描器；未单独配置时 Harbor 返回系统默认扫描器。</small></label>
      </div>
      <section class="project-allowlist-settings">
        <div class="section-heading compact-heading"><div><h3>项目 CVE 白名单</h3><p>${reuseSystemAllowlist ? "当前继承系统白名单，独立配置不会参与风险判断" : "只对当前项目生效"}</p></div><a class="button button-small" href="${securityRoute("allowlist")}">${icon("arrow-right")}<span>查看系统白名单</span></a></div>
        <fieldset id="project-allowlist-fields" ${reuseSystemAllowlist ? "disabled" : ""}>${allowlistEditorContent(allowlist, "project")}</fieldset>
      </section>
      ${scannerError ? `<div class="warning-banner settings-warning">${icon("alert")}<span>扫描器配置载入失败：${escapeHTML(scannerError)}</span></div>` : ""}
    </form>
    <section class="danger-zone"><div><h2>删除项目</h2><p>${escapeHTML(project.name)}</p></div><button class="button button-small button-danger" type="button" data-action="delete-project">${icon("trash")}<span>删除项目</span></button></section>
  </section>`;
}

function toggleField(id, title, description, checked) {
  return `<label class="toggle-setting" for="${id}"><span><strong>${escapeHTML(title)}</strong><small>${escapeHTML(description)}</small></span><input id="${id}" type="checkbox" ${checked ? "checked" : ""}><i></i></label>`;
}

function severityOptions(selected) {
  const options = [["none", "无"], ["low", "低危"], ["medium", "中危"], ["high", "高危"], ["critical", "严重"]];
  return options.map(([value, label]) => `<option value="${value}" ${value === selected ? "selected" : ""}>${label}</option>`).join("");
}

async function saveProjectSettings(event) {
  event.preventDefault();
  const route = state.route;
  const submit = event.currentTarget.querySelector('button[type="submit"]');
  setButtonBusy(submit, true, "正在保存");
  try {
    const limitText = document.querySelector("#project-storage-limit").value;
    const reuseSystemAllowlist = document.querySelector("#project-reuse-allowlist").checked;
    const payload = {
		metadata: {
			...asObject(state.controlProject?.metadata),
        public: String(document.querySelector("#project-public").checked),
        auto_scan: String(document.querySelector("#project-auto-scan").checked),
        auto_sbom_generation: String(document.querySelector("#project-auto-sbom").checked),
        prevent_vul: String(document.querySelector("#project-prevent-vul").checked),
        severity: document.querySelector("#project-severity").value,
			reuse_sys_cve_allowlist: String(reuseSystemAllowlist),
			enable_content_trust: String(document.querySelector("#project-content-trust").checked),
			enable_content_trust_cosign: String(document.querySelector("#project-content-trust-cosign").checked),
		  },
		};
		if (toNumber(state.controlProject?.registry_id) > 0) {
			payload.metadata.proxy_cache_local_on_not_found = String(document.querySelector("#project-proxy-local-fallback")?.checked);
			payload.metadata.proxy_speed_kb = String(proxyLimitValue(document.querySelector("#project-proxy-speed")?.value, "上游带宽限制"));
			payload.metadata.max_upstream_conn = String(proxyLimitValue(document.querySelector("#project-max-upstream-connections")?.value, "上游最大连接数"));
			const registry = document.querySelector("#project-proxy-registry");
			if (registry && isSystemAdmin()) payload.registry_id = Number(registry.value);
		}
		if (limitText !== "") {
		  const limit = Number(limitText);
		  if (!Number.isInteger(limit) || (limit !== -1 && limit <= 0)) throw new Error("存储配额必须是 -1 或正整数");
		  payload.storage_limit = limit === -1 ? -1 : limit * 1024 ** 3;
    }
    if (!reuseSystemAllowlist) {
      const formData = new FormData(event.currentTarget);
      payload.cve_allowlist = { expires_at: cveExpirationFromForm(formData), items: parseCVEItems(formData.get("cves")) };
    }
    await controlMutation("project", { project: route.project }, "PUT", payload);
    const scannerSelect = document.querySelector("#project-scanner");
    const selectedScanner = scannerSelect && !scannerSelect.disabled ? scannerSelect.value : "";
    const currentScanner = String(state.controlProjectCollection?.scanner?.uuid || "");
    if (selectedScanner && selectedScanner !== currentScanner) {
      await controlMutation("project-scanner", { project: route.project }, "PUT", { uuid: selectedScanner });
    }
    showToast("项目设置已保存");
    renderCurrentView(true);
  } catch (error) {
    showToast(error.message, true);
  } finally {
    setButtonBusy(submit, false);
  }
}

function bindProjectAllowlistEditor(form) {
  bindAllowlistEditor(form);
  const reuse = form.querySelector("#project-reuse-allowlist");
  const fields = form.querySelector("#project-allowlist-fields");
  const description = form.querySelector(".project-allowlist-settings .section-heading p");
  const sync = () => {
    if (fields) fields.disabled = Boolean(reuse?.checked);
    if (description) description.textContent = reuse?.checked ? "当前继承系统白名单，独立配置不会参与风险判断" : "只对当前项目生效";
  };
  reuse?.addEventListener("change", sync);
  sync();
}

async function renderRepositoryDetail(token) {
  const route = state.route || parseConsoleRoute();
  const breadcrumb = controlBreadcrumb([{ label: "项目", href: "#/projects" }, { label: route.project, href: projectRoute(route.project) }, { label: repositoryDisplayName(route.project, route.repository) }]);
  mainContent.innerHTML = `${pageHeader(repositoryDisplayName(route.project, route.repository), "正在读取仓库制品", refreshButton(), breadcrumb)}${demoBanner()}<section class="table-shell">${loadingRows(7)}</section>`;
  try {
	const [repository, project] = await Promise.all([
      controlData("repository", { project: route.project, repository: route.repository }),
	  controlData("project", { project: route.project }),
    ]);
	await loadProjectPermissions(project.project_id);
	const [artifacts, projectLabels, globalLabels] = await Promise.all([
	  loadRepositoryArtifacts(route),
	  controlList("labels", { scope: "p", project_id: project.project_id, page: 1, page_size: 100, sort: "name" }).catch(() => ({ items: [] })),
	  controlList("labels", { scope: "g", page: 1, page_size: 100, sort: "name" }).catch(() => ({ items: [] })),
	]);
	await loadArtifactIcons(artifacts.items);
    if (token !== state.renderToken || state.currentView !== "repository") return;
	prepareArtifactSelection(route);
	state.controlProject = project;
    state.controlRepository = repository;
    state.controlArtifacts = artifacts.items;
	state.controlArtifactFilterLabels = [...projectLabels.items, ...globalLabels.items];
    mainContent.innerHTML = `
      ${pageHeader(repositoryDisplayName(route.project, repository.name || route.repository), repository.description || `${formatNumber(repository.artifact_count)} 个制品 · ${formatNumber(repository.pull_count)} 次拉取`, `${refreshButton()}<button class="button button-small" type="button" data-action="show-push-command" data-repository="${escapeAttr(repository.name || route.repository)}">${icon("upload")}<span>推送指引</span></button><button class="button button-small" type="button" data-action="edit-repository">${icon("edit")}<span>编辑仓库</span></button><button class="button button-small button-danger" type="button" data-action="delete-repository">${icon("trash")}<span>删除</span></button>`, breadcrumb)}
      ${demoBanner()}
      <section class="overview-stats project-stats" aria-label="仓库统计">
        ${statCell("制品", repository.artifact_count ?? artifacts.pagination.total, "当前仓库", "package")}
        ${statCell("拉取次数", repository.pull_count, "累计拉取", "history")}
        ${statCell("最近推送", formatDate(repository.update_time), "仓库更新时间", "refresh", true)}
        ${statCell("仓库编号", `#${repository.id ?? "-"}`, route.project, "database", true)}
      </section>
      <section class="table-shell">
		${artifactFilterToolbar(route, state.controlArtifactFilterLabels)}
		${artifactBatchToolbar()}
        <div class="table-scroll">${controlArtifactTable(artifacts.items, route.project, repository.name || route.repository)}</div>
        ${controlPagination(artifacts.pagination)}
      </section>`;
    bindControlSearch("artifact-search", (term) => repositoryRoute(route.project, route.repository, 1, term, { ...repositoryArtifactFilters(route), tagState: term ? "" : route.tagState }));
	bindArtifactFilters(route);
	updateArtifactBatchToolbar();
  } catch (error) {
    if (token === state.renderToken) renderError("仓库详情载入失败", error.message, "refresh-view");
  }
}

function artifactListQuery(route) {
	const filters = [];
	if (route.filter) filters.push(`tags=~${route.filter}`);
	else if (route.tagState === "tagged") filters.push("tags=*");
	else if (route.tagState === "untagged") filters.push("tags=nil");
	if (route.artifactType) filters.push(`type=${route.artifactType}`);
	if (/^[1-9][0-9]*$/.test(route.labelID || "")) filters.push(`labels=(${route.labelID})`);
	return filters.join(",");
}

function artifactListParams(route, page, pageSize) {
	return { project: route.project, repository: route.repository, page, page_size: pageSize, sort: "-push_time", q: artifactListQuery(route), with_tag: true, with_label: true, with_scan_overview: true, with_sbom_overview: true, with_immutable_status: true, with_accessory: true };
}

function artifactMatchesScanStatus(artifactItem, filter) {
	if (!filter) return true;
	const entries = Object.keys(asObject(artifactItem.scan_overview));
	if (filter === "unscanned") return entries.length === 0;
	const status = String(artifactScan(artifactItem).status || "").toLowerCase();
	if (filter === "error") return ["error", "failed"].includes(status);
	return status === filter;
}

async function loadRepositoryArtifacts(route) {
	if (!route.scanStatus) return controlList("artifacts", artifactListParams(route, route.page, controlPageSize));
	const all = [];
	for (let page = 1; page <= 200; page += 1) {
	  const result = await controlList("artifacts", artifactListParams(route, page, 100));
	  all.push(...result.items);
	  if (page * 100 >= result.pagination.total || result.items.length < 100) break;
	  if (page === 200) throw new Error("扫描状态筛选最多处理 20000 个制品，请先使用类型、Tag 或标签缩小范围");
	}
	const filtered = all.filter((artifactItem) => artifactMatchesScanStatus(artifactItem, route.scanStatus));
	const start = (route.page - 1) * controlPageSize;
	return { items: filtered.slice(start, start + controlPageSize), pagination: { page: route.page, page_size: controlPageSize, total: filtered.length } };
}

function artifactFilterToolbar(route, labels) {
	return `<div class="table-toolbar artifact-filter-toolbar">${controlSearchForm("artifact-search", route.filter, "按 Tag 搜索制品")}<label class="toolbar-field"><span>类型</span><select id="artifact-type-filter" class="toolbar-select"><option value="">全部</option>${["IMAGE", "CHART", "CNAB", "WASM"].map((type) => `<option value="${type}" ${route.artifactType === type ? "selected" : ""}>${type}</option>`).join("")}</select></label><label class="toolbar-field"><span>Tag</span><select id="artifact-tag-filter" class="toolbar-select" ${route.filter ? "disabled" : ""}><option value="">全部</option><option value="tagged" ${route.tagState === "tagged" ? "selected" : ""}>有 Tag</option><option value="untagged" ${route.tagState === "untagged" ? "selected" : ""}>无 Tag</option></select></label><label class="toolbar-field"><span>标签</span><select id="artifact-label-filter" class="toolbar-select"><option value="">全部</option>${labels.map((label) => `<option value="${escapeAttr(label.id)}" ${String(route.labelID) === String(label.id) ? "selected" : ""}>${escapeHTML(label.name)}</option>`).join("")}</select></label><label class="toolbar-field"><span>扫描</span><select id="artifact-scan-filter" class="toolbar-select"><option value="">全部</option><option value="success" ${route.scanStatus === "success" ? "selected" : ""}>成功</option><option value="running" ${route.scanStatus === "running" ? "selected" : ""}>运行中</option><option value="error" ${route.scanStatus === "error" ? "selected" : ""}>失败</option><option value="stopped" ${route.scanStatus === "stopped" ? "selected" : ""}>已停止</option><option value="unscanned" ${route.scanStatus === "unscanned" ? "selected" : ""}>未扫描</option></select></label></div>`;
}

function bindArtifactFilters(route) {
	const bindings = [
	  ["#artifact-type-filter", "artifactType"],
	  ["#artifact-tag-filter", "tagState"],
	  ["#artifact-label-filter", "labelID"],
	  ["#artifact-scan-filter", "scanStatus"],
	];
	bindings.forEach(([selector, key]) => document.querySelector(selector)?.addEventListener("change", (event) => {
	  location.hash = repositoryRoute(route.project, route.repository, 1, route.filter, { ...repositoryArtifactFilters(route), [key]: event.target.value });
	}));
}

function prepareArtifactSelection(route) {
	const key = [
	  route.project,
	  route.repository,
	  route.page,
	  route.filter || "",
	  route.artifactType || "",
	  route.tagState || "",
	  route.labelID || "",
	  route.scanStatus || "",
	].join("|");
	if (state.artifactSelectionKey !== key) {
	  state.artifactSelectionKey = key;
	  state.artifactSelection = new Set();
	}
}

function artifactBatchToolbar() {
	return `<div class="artifact-batch-toolbar"><span><strong id="artifact-selection-count">0</strong> 个已选择</span><div><button class="button button-small" type="button" data-action="batch-scan-artifacts" disabled>${icon("shield")}<span>扫描</span></button><button class="button button-small" type="button" data-action="batch-sbom-artifacts" disabled>${icon("database")}<span>生成 SBOM</span></button><button class="button button-small" type="button" data-action="batch-stop-artifacts" disabled>${icon("x")}<span>停止任务</span></button><button class="button button-small" type="button" data-action="batch-attach-label" disabled>${icon("tag")}<span>添加标签</span></button><button class="button button-small" type="button" data-action="batch-remove-label" disabled>${icon("x")}<span>移除标签</span></button><button class="button button-small" type="button" data-action="copy-selected-artifact" disabled>${icon("copy")}<span>复制制品</span></button><button class="button button-small button-danger" type="button" data-action="batch-delete-artifacts" disabled>${icon("trash")}<span>删除</span></button></div></div>`;
}

function controlArtifactTable(artifacts, project, repository) {
  if (!artifacts.length) return emptyTable("暂无制品", "向该仓库推送镜像后会显示在这里。", "package");
	const selection = state.artifactSelection || new Set();
	const allSelected = artifacts.every((artifactItem) => selection.has(artifactItem.digest));
  return `<table class="artifact-select-table"><thead><tr><th class="selection-cell"><input type="checkbox" data-action="select-all-artifacts" ${allSelected ? "checked" : ""} aria-label="选择当前页全部制品"></th><th>Tag / 摘要</th><th>架构</th><th>签名</th><th>注释</th><th>扫描状态</th><th>最高风险</th><th>大小</th><th>拉取时间</th><th>推送时间</th><th></th></tr></thead><tbody>${artifacts.map((artifactItem) => {
    const scan = artifactScan(artifactItem);
    const tags = asArray(artifactItem.tags);
    const labels = asArray(artifactItem.labels);
    const title = tags[0]?.name || shortDigest(artifactItem.digest);
	const selected = selection.has(artifactItem.digest);
    return `<tr class="clickable-row ${selected ? "selected-row" : ""}" data-action="control-open-artifact" data-project="${escapeAttr(project)}" data-repository="${escapeAttr(repository)}" data-reference="${escapeAttr(artifactItem.digest)}">
	  <td class="selection-cell"><input type="checkbox" data-action="select-artifact" data-digest="${escapeAttr(artifactItem.digest)}" ${selected ? "checked" : ""} aria-label="选择 ${escapeAttr(title)}"></td>
      <td><div class="cell-title">${artifactIconMarkup(artifactItem)}<span class="cell-stack"><strong>${escapeHTML(title)}</strong><small class="mono" title="${escapeAttr(artifactItem.digest)}">${escapeHTML(shortDigest(artifactItem.digest))}${tags.length > 1 ? ` · ${tags.length} 个 Tag` : ""}</small>${labels.length ? `<span class="artifact-row-labels">${labels.slice(0, 2).map(artifactLabelChip).join("")}${labels.length > 2 ? `<span class="badge">+${labels.length - 2}</span>` : ""}</span>` : ""}</span></div></td>
      <td>${artifactArchitectureCell(artifactItem)}</td><td>${artifactSignatureBadge(artifactItem)}</td><td>${artifactAnnotationSummary(artifactItem, project, repository)}</td><td>${statusBadge(scan.status)}</td><td>${severityBadge(scan.severity)}</td><td>${formatBytes(artifactItem.size)}</td><td>${formatDate(artifactItem.pull_time)}</td><td>${formatDate(artifactItem.push_time)}</td><td>${icon("chevron")}</td>
    </tr>`;
  }).join("")}</tbody></table>`;
}

async function renderArtifactDetail(token) {
  const route = state.route || parseConsoleRoute();
  const breadcrumb = controlBreadcrumb([{ label: "项目", href: "#/projects" }, { label: route.project, href: projectRoute(route.project) }, { label: repositoryDisplayName(route.project, route.repository), href: repositoryRoute(route.project, route.repository) }, { label: shortDigest(route.reference) }]);
  mainContent.innerHTML = `${pageHeader("制品详情", shortDigest(route.reference), refreshButton(), breadcrumb)}${demoBanner()}<section class="table-shell">${loadingRows()}</section>`;
  try {
    const artifactItem = await controlData("artifact", { project: route.project, repository: route.repository, reference: route.reference, with_tag: true, with_label: true, with_scan_overview: true, with_sbom_overview: true, with_accessory: true, with_immutable_status: true });
	await loadArtifactIcons([artifactItem]);
    let secondary = null;
    if (route.tab === "tags") secondary = await controlList("artifact-tags", { project: route.project, repository: route.repository, reference: route.reference, page: route.page, page_size: controlPageSize, sort: "-push_time", with_immutable_status: true });
    if (route.tab === "labels") secondary = await loadArtifactLabels(route, artifactItem);
    if (route.tab === "vulnerabilities") secondary = await controlData("artifact-vulnerabilities", { project: route.project, repository: route.repository, reference: route.reference }).catch((error) => ({ load_error: error.message }));
    if (route.tab === "accessories") secondary = await controlList("artifact-accessories", { project: route.project, repository: route.repository, reference: route.reference, page: route.page, page_size: controlPageSize, sort: "-creation_time" }).catch((error) => ({ items: [], pagination: { page: 1, page_size: controlPageSize, total: 0 }, load_error: error.message }));
    if (artifactAdditionTabs[route.tab]) {
      secondary = await controlData("artifact-addition", { project: route.project, repository: route.repository, reference: route.reference, addition: artifactAdditionTabs[route.tab].addition }).catch((error) => ({ load_error: error.message }));
    }
    if (token !== state.renderToken || state.currentView !== "artifact") return;
    state.controlArtifact = artifactItem;
    state.controlArtifactSecondary = secondary;
    const tags = asArray(artifactItem.tags);
    const title = tags[0]?.name || shortDigest(artifactItem.digest);
    const scan = artifactScan(artifactItem);
    const scanActions = artifactScanActionButtons(artifactItem);
    mainContent.innerHTML = `
      ${pageHeader(title, `${repositoryDisplayName(route.project, route.repository)} · ${formatBytes(artifactItem.size)} · ${artifactArchitectureSummary(artifactItem)}`, `${refreshButton()}${scanActions}<button class="button button-small" type="button" data-action="copy-artifact">${icon("copy")}<span>复制制品</span></button><button class="button button-small button-primary" type="button" data-action="add-artifact-tag">${icon("tag")}<span>添加 Tag</span></button><button class="button button-small button-danger" type="button" data-action="delete-artifact">${icon("trash")}<span>删除制品</span></button>`, breadcrumb)}
      ${demoBanner()}
      <section class="artifact-identity">
        <div><span class="eyebrow">制品摘要</span><strong class="mono digest-full">${escapeHTML(artifactItem.digest)}</strong>${asArray(artifactItem.labels).length ? `<span class="artifact-identity-labels">${asArray(artifactItem.labels).map(artifactLabelChip).join("")}</span>` : ""}</div>
        <button class="button button-small" type="button" data-action="copy-value" data-value="${escapeAttr(artifactItem.digest)}">${icon("copy")}<span>复制摘要</span></button>
      </section>
      <section class="overview-stats project-stats" aria-label="制品统计">
        ${statCell("扫描状态", statusInfo(scan.status)[0], `最高风险：${severityInfo(scan.severity)[0]}`, "shield", true)}
        ${statCell("严重漏洞", scan.counts.critical, "需要立即处理", "alert")}
        ${statCell("Tag", tags.length, "当前制品引用", "tag")}
        ${statCell("推送时间", formatDate(artifactItem.push_time), "最近入库", "history", true)}
      </section>
      ${artifactTabs(route)}
      ${renderArtifactSection(artifactItem, route, secondary)}
    `;
  } catch (error) {
    if (token === state.renderToken) renderError("制品详情载入失败", error.message, "refresh-view");
  }
}

function artifactScanActionButtons(artifactItem) {
  const vulnerability = artifactScanState(artifactItem, "vulnerability");
  const sbom = artifactScanState(artifactItem, "sbom");
  const running = [["vulnerability", vulnerability], ["sbom", sbom]].find(([, scan]) => artifactScanCanStop(scan.status));
  const stop = running ? `<button class="button button-small button-danger" type="button" data-action="stop-artifact-scan" data-scan-type="${running[0]}">${icon("x")}<span>停止${running[0] === "sbom" ? " SBOM" : "扫描"}</span></button>` : "";
  const log = vulnerability.reportId ? `<button class="button button-small" type="button" data-action="view-artifact-scan-log" data-report="${escapeAttr(vulnerability.reportId)}">${icon("terminal")}<span>扫描日志</span></button>` : "";
  return `${log}${stop}<button class="button button-small" type="button" data-action="scan-artifact">${icon("shield")}<span>扫描 / SBOM</span></button>`;
}

function artifactScanCanStop(status) {
  return ["running", "pending", "queued", "scheduled", "in_progress", "inprogress"].includes(String(status || "").toLowerCase());
}

function artifactTabs(route) {
  const tabs = [
    ["overview", "概览", "package"], ["tags", "Tag", "tag"], ["labels", "标签", "tag"], ["vulnerabilities", "漏洞", "shield"],
    ...Object.entries(artifactAdditionTabs).map(([key, meta]) => [key, meta.label, meta.icon]),
    ["accessories", "关联制品", "database"],
  ];
  return `<nav class="resource-tabs artifact-tabs" aria-label="制品页面">${tabs.map(([key, label, iconName]) => `<a href="${artifactRoute(route.project, route.repository, route.reference, key)}" class="${route.tab === key ? "active" : ""}" ${route.tab === key ? 'aria-current="page"' : ""}>${icon(iconName)}<span>${label}</span></a>`).join("")}</nav>`;
}

function renderArtifactSection(artifactItem, route, secondary) {
  if (route.tab === "tags") return `<section class="table-shell"><div class="table-toolbar"><strong>Tag 列表</strong><div class="toolbar-spacer"></div><button class="button button-small button-primary" type="button" data-action="add-artifact-tag">${icon("plus")}<span>添加 Tag</span></button></div><div class="table-scroll">${artifactTagTable(secondary?.items || [], artifactItem)}</div>${controlPagination(secondary?.pagination || { page: 1, page_size: controlPageSize, total: 0 })}</section>`;
  if (route.tab === "labels") return artifactLabelsSection(artifactItem, secondary);
  if (route.tab === "vulnerabilities") return vulnerabilitySection(secondary);
  if (route.tab === "accessories") return artifactAccessoriesSection(secondary);
  if (artifactAdditionTabs[route.tab]) return artifactAdditionSection(route.tab, secondary);
  return artifactOverview(artifactItem, route);
}

async function loadArtifactLabels(route, artifactItem) {
  const attached = asArray(artifactItem.labels);
  const [projectResult, globalResult] = await Promise.allSettled([
    controlData("project", { project: route.project }).then((project) => controlList("labels", { scope: "p", project_id: project.project_id, page: 1, page_size: 100, sort: "name" })),
    controlList("labels", { scope: "g", page: 1, page_size: 100, sort: "name" }),
  ]);
  const available = [];
  if (projectResult.status === "fulfilled") available.push(...projectResult.value.items);
  if (globalResult.status === "fulfilled") available.push(...globalResult.value.items);
  const errors = [projectResult, globalResult].filter((result) => result.status === "rejected").map((result) => result.reason.message);
  return { attached, available, load_error: errors.join("；") };
}

function artifactLabelChip(label) {
  return `<span class="artifact-label-chip">${labelSwatch(label.color, "artifact-label-swatch")}${escapeHTML(label.name || `标签 #${label.id}`)}</span>`;
}

function artifactLabelsSection(artifactItem, collection = {}) {
  const attached = asArray(collection.attached || artifactItem.labels);
  const available = asArray(collection.available);
  return `<section class="table-shell artifact-label-panel">
    <div class="table-toolbar"><div><strong>制品标签</strong><span class="toolbar-caption">${formatNumber(attached.length)} 个已绑定</span></div><div class="toolbar-spacer"></div><button class="button button-small button-primary" type="button" data-action="attach-artifact-label" ${available.length <= attached.length ? "disabled" : ""}>${icon("plus")}<span>绑定标签</span></button></div>
    ${collection.load_error ? `<div class="warning-banner artifact-inline-warning">${icon("alert")}<span>部分标签载入失败：${escapeHTML(collection.load_error)}</span></div>` : ""}
    ${attached.length ? `<div class="artifact-label-list">${attached.map((label) => `<div class="artifact-label-row">${labelSwatch(label.color)}<span class="cell-stack"><strong>${escapeHTML(label.name)}</strong><small>${escapeHTML(label.scope === "g" ? "全局标签" : "项目标签")}${label.description ? ` · ${escapeHTML(label.description)}` : ""}</small></span><button class="icon-button danger-icon" type="button" data-action="remove-artifact-label" data-id="${escapeAttr(label.id)}" data-name="${escapeAttr(label.name)}" title="移除标签" aria-label="移除标签">${icon("x")}</button></div>`).join("")}</div>` : emptyTable("尚未绑定标签", "绑定项目或全局标签后，可快速识别和筛选制品。", "tag")}
  </section>`;
}

function artifactAccessoriesSection(collection = {}) {
  if (collection.load_error) return `<section class="panel">${emptyTable("关联制品不可用", collection.load_error, "alert")}</section>`;
  const items = asArray(collection.items);
  if (!items.length) return `<section class="panel">${emptyTable("没有关联制品", "签名、SBOM 和其他 OCI Referrer 会显示在这里。", "database")}</section>`;
  return `<section class="table-shell"><div class="table-toolbar"><strong>OCI 关联制品</strong><div class="toolbar-spacer"></div><span class="muted">${formatNumber(collection.pagination?.total || items.length)} 项</span></div><div class="table-scroll"><table><thead><tr><th>类型</th><th>摘要</th><th>大小</th><th>创建时间</th><th></th></tr></thead><tbody>${items.map((item) => `<tr><td><div class="cell-title"><span class="cell-icon">${icon(accessoryIcon(item.type))}</span><span class="cell-stack"><strong>${escapeHTML(accessoryTypeLabel(item.type))}</strong><small>${escapeHTML(item.type || "OCI Referrer")}</small></span></div></td><td><code title="${escapeAttr(item.digest)}">${escapeHTML(shortDigest(item.digest))}</code></td><td>${formatBytes(item.size)}</td><td>${formatDate(item.creation_time)}</td><td><div class="row-actions"><button class="icon-button" type="button" data-action="open-accessory-artifact" data-digest="${escapeAttr(item.digest)}" title="打开关联制品" aria-label="打开关联制品">${icon("external")}</button><button class="icon-button" type="button" data-action="copy-value" data-value="${escapeAttr(item.digest)}" title="复制摘要" aria-label="复制摘要">${icon("copy")}</button><button class="icon-button danger-icon" type="button" data-action="delete-accessory-artifact" data-digest="${escapeAttr(item.digest)}" data-type="${escapeAttr(item.type)}" title="删除关联制品" aria-label="删除关联制品">${icon("trash")}</button></div></td></tr>`).join("")}</tbody></table></div>${controlPagination(collection.pagination || { page: 1, page_size: controlPageSize, total: items.length })}</section>`;
}

function accessoryTypeLabel(value) {
  const type = String(value || "").toLowerCase();
  if (type.includes("cosign") || type.includes("notation")) return "制品签名";
  if (type.includes("sbom")) return "软件物料清单";
  if (type.includes("attestation")) return "证明材料";
  return "关联制品";
}

function accessoryIcon(value) {
  return /cosign|notation|attestation/i.test(String(value || "")) ? "shield" : "database";
}

function artifactSignatureState(artifactItem) {
  if (!Array.isArray(artifactItem?.accessories)) return "unknown";
  return asArray(artifactItem.accessories).some((accessory) => /cosign|notation/i.test(String(accessory?.type || accessory?.artifact_type || accessory?.media_type || ""))) ? "signed" : "unsigned";
}

function artifactSignatureBadge(artifactItem) {
  const stateName = artifactSignatureState(artifactItem);
  const labels = { signed: "已签名", unsigned: "未签名", unknown: "未知" };
  const classes = { signed: "badge-green", unsigned: "badge-orange", unknown: "" };
  return `<span class="badge ${classes[stateName]}">${escapeHTML(labels[stateName])}</span>`;
}

function artifactAnnotationSummary(artifactItem, project, repository) {
  const entries = Object.entries(asObject(artifactItem.annotations));
  if (!entries.length) return '<span class="muted">-</span>';
  const [key, value] = entries[0];
  const href = artifactRoute(project, repository, artifactItem.digest);
  return `<div class="artifact-annotation-summary"><code title="${escapeAttr(`${key}: ${value}`)}">${escapeHTML(`${key}: ${value}`)}</code><a href="${escapeAttr(href)}">${entries.length > 1 ? `+${entries.length - 1} 查看全部` : "查看全部"}</a></div>`;
}

function artifactAnnotationsSection(artifactItem) {
  const entries = Object.entries(asObject(artifactItem.annotations));
  if (!entries.length) return "";
  return `<section class="panel artifact-annotations-panel"><div class="panel-head"><div><h2>注释</h2><p>${formatNumber(entries.length)} 项 OCI annotations</p></div></div><dl class="definition-list artifact-annotations-list">${entries.map(([key, value]) => `<div><dt><code>${escapeHTML(key)}</code></dt><dd><code>${escapeHTML(String(value))}</code><button class="icon-button" type="button" data-action="copy-value" data-value="${escapeAttr(String(value))}" title="复制" aria-label="复制">${icon("copy")}</button></dd></div>`).join("")}</dl></section>`;
}

function artifactIconDataURL(iconPayload) {
  const contentType = String(iconPayload?.["content-type"] || "").toLowerCase();
  const content = String(iconPayload?.content || "").trim();
  if (!["image/png", "image/jpeg", "image/gif", "image/webp"].includes(contentType) || !/^[A-Za-z0-9+/]+={0,2}$/.test(content) || content.length % 4 !== 0) return "";
  try {
    if (!atob(content).length) return "";
  } catch {
    return "";
  }
  return `data:${contentType};base64,${content}`;
}

function artifactIconCacheKey(digest) {
  return `${state.session?.connection_id || "current"}:${digest}`;
}

async function loadArtifactIcon(digest) {
  if (!digest) return "";
  const key = artifactIconCacheKey(digest);
  if (artifactIconCache.has(key)) return artifactIconCache.get(key);
  const request = controlData("artifact-icon", { digest }).then(artifactIconDataURL).catch(() => "");
  artifactIconCache.set(key, request);
  const dataURL = await request;
  artifactIconCache.set(key, dataURL);
  return dataURL;
}

async function loadArtifactIcons(artifacts) {
  const digests = [...new Set(asArray(artifacts).map((artifactItem) => String(artifactItem?.icon || "")).filter(Boolean))];
  const workers = Array.from({ length: Math.min(4, digests.length) }, async () => {
    while (digests.length) await loadArtifactIcon(digests.pop());
  });
  await Promise.all(workers);
}

function artifactIconMarkup(artifactItem) {
  const iconDigest = String(artifactItem?.icon || "");
  const dataURL = iconDigest ? artifactIconCache.get(artifactIconCacheKey(iconDigest)) : "";
  if (typeof dataURL === "string" && dataURL) return `<span class="artifact-icon"><img src="${escapeAttr(dataURL)}" alt="${escapeAttr(artifactItem.type || "Artifact")}" loading="lazy"></span>`;
  return `<span class="cell-icon">${icon("package")}</span>`;
}

window.clearArtifactIconCache = () => artifactIconCache.clear();

function normalizeArtifactAddition(raw) {
  if (typeof raw !== "string") return raw;
  const text = raw.trim();
  if ((text.startsWith("{") && text.endsWith("}")) || (text.startsWith("[") && text.endsWith("]"))) {
    try { return JSON.parse(text); } catch { return raw; }
  }
  return raw;
}

function artifactAdditionSection(tab, raw) {
  const meta = artifactAdditionTabs[tab];
  if (raw?.load_error) return `<section class="panel">${emptyTable(`${meta.label} 不可用`, raw.load_error, "alert")}</section>`;
  const data = normalizeArtifactAddition(raw);
  if (data === undefined || data === null || data === "" || (Array.isArray(data) && !data.length)) return `<section class="panel">${emptyTable(`没有${meta.label}`, "当前制品未提供这项附加信息。", meta.icon)}</section>`;
  return `<section class="table-shell artifact-addition-panel"><div class="table-toolbar"><div><strong>${escapeHTML(meta.label)}</strong><span class="toolbar-caption">Harbor 官方制品附加信息</span></div><div class="toolbar-spacer"></div><button class="button button-small" type="button" data-action="copy-artifact-addition">${icon("copy")}<span>复制</span></button><button class="button button-small" type="button" data-action="download-artifact-addition">${icon("database")}<span>下载</span></button></div>${renderArtifactAdditionContent(tab, data)}</section>`;
}

function renderArtifactAdditionContent(tab, data) {
  if (tab === "sbom") {
    const packages = asArray(asObject(data).packages);
    if (packages.length) return `<div class="addition-summary"><span class="badge badge-blue">${escapeHTML(asObject(data).spdxVersion || "SBOM")}</span><strong>${formatNumber(packages.length)} 个软件包</strong></div><div class="table-scroll"><table><thead><tr><th>软件包</th><th>版本</th><th>许可证</th><th>供应商</th></tr></thead><tbody>${packages.map((item) => `<tr><td><strong>${escapeHTML(item.name || item.package_name || "-")}</strong></td><td class="mono">${escapeHTML(item.versionInfo || item.version || "-")}</td><td>${escapeHTML(item.licenseConcluded || item.license || "未知")}</td><td>${escapeHTML(item.supplier || item.vendor || "-")}</td></tr>`).join("")}</tbody></table></div>`;
  }
  if (tab === "license") {
    const licenses = asArray(asObject(data).licenses || data);
    if (licenses.length) return `<div class="table-scroll"><table><thead><tr><th>许可证</th><th>标识</th><th>命中组件</th></tr></thead><tbody>${licenses.map((item) => `<tr><td><strong>${escapeHTML(item.name || item.license || item.id || "未知")}</strong></td><td class="mono">${escapeHTML(item.id || item.spdx_id || "-")}</td><td>${formatNumber(item.count || item.package_count || 0)}</td></tr>`).join("")}</tbody></table></div>`;
  }
  if (tab === "files") {
    const files = asArray(asObject(data).files || data);
    if (files.length) return `<div class="artifact-file-list">${files.map((item) => `<code>${escapeHTML(typeof item === "string" ? item : item.path || item.name || JSON.stringify(item))}</code>`).join("")}</div>`;
  }
  if (tab === "build") {
    const history = asArray(asObject(data).history || data);
    if (history.length) return `<div class="table-scroll"><table><thead><tr><th>创建时间</th><th>构建指令</th><th>文件层</th></tr></thead><tbody>${history.map((item) => `<tr><td>${formatDate(item.created)}</td><td><code class="addition-command">${escapeHTML(item.created_by || item.command || "-")}</code></td><td>${item.empty_layer ? '<span class="badge">仅元数据</span>' : '<span class="badge badge-blue">包含文件</span>'}</td></tr>`).join("")}</tbody></table></div>`;
  }
  if (tab === "dependencies") {
    const dependencies = asArray(asObject(data).dependencies || data);
    if (dependencies.length) return `<div class="table-scroll"><table><thead><tr><th>依赖</th><th>版本</th><th>来源</th></tr></thead><tbody>${dependencies.map((item) => `<tr><td><strong>${escapeHTML(item.name || item.package || "-")}</strong></td><td class="mono">${escapeHTML(item.version || "-")}</td><td class="truncate-cell">${escapeHTML(item.repository || item.source || "-")}</td></tr>`).join("")}</tbody></table></div>`;
  }
  const text = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  return `<pre class="artifact-addition-code"><code>${escapeHTML(text)}</code></pre>`;
}

function artifactOverview(artifactItem, route) {
  const tags = asArray(artifactItem.tags);
  const instanceHost = safeURL(state.session.instance_url)?.host || String(state.session.instance_url).replace(/^https?:\/\//, "").replace(/\/$/, "");
  const pulls = tags.length ? tags.map((tag) => ({ tag: tag.name, command: artifactPullCommand({ instanceHost, project: route.project, repository: route.repository, artifact: artifactItem, tag: tag.name, runtime: commandRuntime() }) })) : [{ tag: "按摘要拉取", command: artifactPullCommand({ instanceHost, project: route.project, repository: route.repository, artifact: artifactItem, digest: artifactItem.digest, runtime: commandRuntime() }) }];
  return `<div class="detail-columns">
    <section class="panel command-panel"><div class="panel-head"><div><h2>拉取命令</h2><p>当前使用 ${escapeHTML(commandRuntime())}</p></div>${icon("terminal")}</div>${pulls.map((item) => `<div class="command-row"><span class="badge">${escapeHTML(item.tag)}</span><code>${escapeHTML(item.command)}</code><button class="icon-button" type="button" data-action="copy-value" data-value="${escapeAttr(item.command)}" title="复制拉取命令" aria-label="复制拉取命令">${icon("copy")}</button></div>`).join("")}</section>
    <section class="panel"><div class="panel-head"><div><h2>制品信息</h2><p>${escapeHTML(artifactItem.type || artifactItem.artifact_type || "镜像")}</p></div></div><dl class="definition-list">
      ${definitionRow("媒体类型", artifactItem.manifest_media_type || artifactItem.media_type || "-")}
      ${definitionRow("制品大小", formatBytes(artifactItem.size))}
      ${definitionRow("最近拉取", formatDate(artifactItem.pull_time))}
      ${definitionRow("架构", artifactArchitectureSummary(artifactItem))}
      ${definitionRow("签名", artifactSignatureState(artifactItem) === "signed" ? "已签名" : artifactSignatureState(artifactItem) === "unsigned" ? "未签名" : "未知")}
    </dl></section>
  </div>${artifactAnnotationsSection(artifactItem)}${artifactPlatformSection(artifactItem)}`;
}

function artifactPlatformSection(artifactItem) {
  const info = artifactPlatformInfo(artifactItem);
  if (!info.multi || !info.items.length) return "";
  return `<section class="panel artifact-platform-panel">
    <div class="panel-head"><div><h2>平台与架构</h2><p>Harbor 返回的 OCI 镜像索引，共 ${formatNumber(info.items.length)} 个子清单</p></div><span class="badge badge-blue">多架构</span></div>
    <div class="artifact-platform-list">${info.items.map((platform) => {
      const details = [];
      if (platform.osVersion) details.push(`系统版本 ${platform.osVersion}`);
      if (platform.osFeatures.length) details.push(`特性 ${platform.osFeatures.join("、")}`);
      const digest = platform.digest;
      return `<div class="artifact-platform-row">
        <div class="platform-identity"><span class="cell-icon">${icon("package")}</span><span class="cell-stack"><strong class="mono">${escapeHTML(artifactPlatformLabel(platform))}</strong><small>${escapeHTML(details.join(" · ") || "OCI 子清单")}</small></span></div>
        <code title="${escapeAttr(digest)}">${escapeHTML(digest ? shortDigest(digest) : "暂无摘要")}</code>
		${digest ? `<div class="row-actions"><button class="icon-button" type="button" data-action="open-artifact-child" data-digest="${escapeAttr(digest)}" title="打开子清单" aria-label="打开子清单">${icon("external")}</button><button class="icon-button" type="button" data-action="copy-value" data-value="${escapeAttr(digest)}" title="复制子清单摘要" aria-label="复制子清单摘要">${icon("copy")}</button></div>` : '<span class="platform-action-placeholder"></span>'}
      </div>`;
    }).join("")}</div>
  </section>`;
}

function artifactPullCommand({ instanceHost, project, repository, artifact, tag = "", digest = "", runtime = "docker" }) {
  const host = String(instanceHost || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
  const fullName = fullRepositoryName(project, repository);
  const type = String(artifact?.type || artifact?.artifact_type || "UNKNOWN").toUpperCase();
  if (type === "CHART") {
    if (tag) return `helm pull oci://${host}/${fullName} --version ${tag}`;
    return "Helm OCI artifacts require a version tag; pull by digest is unavailable.";
  }
  const selectedRuntime = ["docker", "podman", "nerdctl"].includes(runtime) ? runtime : "docker";
  const reference = tag || digest;
  return `${selectedRuntime} pull ${host}/${fullName}${tag ? ":" : "@"}${reference}`;
}

function fullRepositoryName(project, repository) {
  const value = String(repository || "").replace(/^\/+/, "");
  return value.startsWith(`${project}/`) ? value : `${project}/${value}`;
}

function artifactTagTable(tags, artifactItem) {
  if (!tags.length) return emptyTable("没有 Tag", "该制品当前只能通过摘要引用。", "tag");
  return `<table><thead><tr><th>Tag</th><th>不可变</th><th>推送时间</th><th>最近拉取</th><th>拉取命令</th><th></th></tr></thead><tbody>${tags.map((tag) => {
	const instanceHost = safeURL(state.session.instance_url)?.host || String(state.session.instance_url).replace(/^https?:\/\//, "").replace(/\/$/, "");
    const command = artifactPullCommand({ instanceHost, project: state.route.project, repository: state.route.repository, artifact: artifactItem, tag: tag.name, runtime: commandRuntime() });
    return `<tr><td><div class="cell-title"><span class="cell-icon">${icon("tag")}</span><strong>${escapeHTML(tag.name)}</strong></div></td><td>${tag.immutable ? '<span class="badge badge-orange">不可变</span>' : '<span class="badge">可变</span>'}</td><td>${formatDate(tag.push_time)}</td><td>${formatDate(tag.pull_time)}</td><td><button class="button button-small" type="button" data-action="copy-value" data-value="${escapeAttr(command)}">${icon("copy")}<span>复制</span></button></td><td><button class="icon-button danger-icon" type="button" data-action="delete-artifact-tag" data-tag="${escapeAttr(tag.name)}" ${tag.immutable ? "disabled" : ""} title="删除 Tag" aria-label="删除 Tag">${icon("trash")}</button></td></tr>`;
  }).join("")}</tbody></table>`;
}

function vulnerabilitySection(report) {
  if (report?.load_error) return `<section class="panel">${emptyTable("漏洞报告不可用", report.load_error, "alert")}</section>`;
  const normalized = normalizeVulnerabilityReport(report);
  if (!normalized.items.length) return `<section class="panel">${emptyTable("没有漏洞记录", "扫描报告未包含漏洞。", "shield")}</section>`;
  return `<section class="table-shell"><div class="table-toolbar"><strong>漏洞明细</strong><div class="toolbar-spacer"></div><span class="muted">${formatNumber(normalized.items.length)} 条 · ${escapeHTML(normalized.scanner)}</span></div><div class="table-scroll"><table><thead><tr><th>漏洞编号</th><th>风险</th><th>软件包</th><th>当前版本</th><th>修复版本</th><th>说明</th></tr></thead><tbody>${normalized.items.map((item) => `<tr><td><strong class="mono">${escapeHTML(item.id || item.cve_id || "-")}</strong></td><td>${severityBadge(item.severity)}</td><td>${escapeHTML(item.package || item.package_name || "-")}</td><td class="mono">${escapeHTML(item.version || item.package_version || "-")}</td><td class="mono">${escapeHTML(item.fix_version || item.fixed_version || "暂无")}</td><td class="vulnerability-description">${escapeHTML(item.description || "-")}</td></tr>`).join("")}</tbody></table></div></section>`;
}

function normalizeVulnerabilityReport(raw) {
  let report = asObject(raw);
  if (!Array.isArray(report.vulnerabilities)) {
    const nested = Object.values(report).find((value) => Array.isArray(value?.vulnerabilities));
    if (nested) report = nested;
  }
  return { items: asArray(report.vulnerabilities), scanner: asObject(report.scanner).name || report.scanner?.name || "Harbor 扫描器" };
}

async function renderSecurityHub(token, force = false) {
  const route = state.route || parseConsoleRoute();
  mainContent.innerHTML = `${pageHeader("安全中心", "正在读取 Harbor Security Hub", refreshButton())}${demoBanner()}<section class="table-shell">${loadingRows(7)}</section>`;

  try {
    if (route.section === "scanners") {
      const scanners = await controlList("scanners", {
        page: route.page,
        page_size: route.pageSize,
        sort: "name",
        q: route.filter ? `name=~${route.filter}` : "",
      });
      if (token !== state.renderToken || state.currentView !== "security") return;
      state.scannerItems = scanners.items;
      renderSecurityShell(route, scannerManagementSection(route, scanners));
      bindControlSearch("security-scanner-search", (term) => securityRoute("scanners", 1, { filter: term }, route.pageSize));
      return;
    }
    if (route.section === "allowlist") {
      const allowlist = await controlData("system-cve-allowlist");
      if (token !== state.renderToken || state.currentView !== "security") return;
      state.securityAllowlist = asObject(allowlist);
      renderSecurityAllowlistPage(route, state.securityAllowlist);
      return;
    }
    if (route.section === "overview") {
      const [summaryResult, projectsResult] = await Promise.allSettled([
        controlData("security-summary", { with_dangerous_cve: true, with_dangerous_artifact: true }),
        loadSecurityProjects(force),
      ]);
      if (token !== state.renderToken || state.currentView !== "security") return;
      if (summaryResult.status === "rejected") {
        renderSecurityShell(route, securityModuleError("安全汇总载入失败", summaryResult.reason));
        return;
      }
      const projects = projectsResult.status === "fulfilled" ? projectsResult.value : asArray(state.dashboard?.projects);
      const projectsError = projectsResult.status === "rejected" ? projectsResult.reason : null;
      state.securityProjects = projects;
      renderSecurityOverviewPage(route, asObject(summaryResult.value), projects, projectsError);
      return;
    }
    const projectsResult = await Promise.allSettled([loadSecurityProjects(force)]);
    const projects = projectsResult[0].status === "fulfilled" ? projectsResult[0].value : asArray(state.dashboard?.projects);
    const projectsError = projectsResult[0].status === "rejected" ? projectsResult[0].reason : null;
    if (token !== state.renderToken || state.currentView !== "security") return;
    state.securityProjects = projects;
    if (route.section === "vulnerabilities") {
      const result = await controlList("security-vulnerabilities", {
        page: route.page,
        page_size: route.pageSize,
        q: securityVulnerabilityQuery(route, projects),
        tune_count: true,
        with_tag: true,
      });
      if (token !== state.renderToken || state.currentView !== "security") return;
      renderSecurityVulnerabilityPage(route, result, projects, projectsError);
      return;
    }
    if (route.section === "exports") {
      const raw = await controlData("cve-export-executions");
      if (token !== state.renderToken || state.currentView !== "security") return;
      const executions = asArray(asObject(raw).items || raw);
      state.securityExports = executions;
      renderSecurityExportPage(route, executions, projects, projectsError);
      return;
    }
  } catch (error) {
    if (token !== state.renderToken || state.currentView !== "security") return;
    renderSecurityShell(route, securityModuleError("安全模块载入失败", error));
  }
}

async function loadSecurityProjects(force = false) {
  if (!force && state.cache.has("security-projects")) return asArray(state.cache.get("security-projects"));
  const first = await controlList("projects", { page: 1, page_size: 100, sort: "name", with_detail: true });
  const projects = [...first.items];
  const pages = Math.ceil(first.pagination.total / first.pagination.page_size);
  for (let page = 2; page <= pages; page += 1) {
    const result = await controlList("projects", { page, page_size: 100, sort: "name", with_detail: true });
    projects.push(...result.items);
  }
  state.cache.set("security-projects", projects);
  return projects;
}

function securityTabs(selected) {
  const tabs = [
    ["overview", "风险概览", "shield"],
    ["scanners", "扫描器", "shield"],
    ["vulnerabilities", "漏洞明细", "alert"],
    ["exports", "CVE 导出", "database"],
    ["allowlist", "系统白名单", "check"],
  ];
  return `<nav class="resource-tabs security-tabs" aria-label="安全中心页面">${tabs.map(([key, label, iconName]) => `<a href="${securityRoute(key)}" class="${selected === key ? "active" : ""}" ${selected === key ? 'aria-current="page"' : ""}>${icon(iconName)}<span>${label}</span></a>`).join("")}</nav>`;
}

function renderSecurityShell(route, content, actions = refreshButton()) {
  mainContent.innerHTML = `${pageHeader("安全中心", "集中管理扫描器、漏洞风险、扫描数据导出与 CVE 白名单", actions)}${demoBanner()}${securityTabs(route.section)}${content}`;
}

function securityModuleError(title, error) {
  const status = Number(error?.status || 0);
  const reason = status === 403 ? "当前账号没有读取此安全模块的权限。" : status === 404 ? "当前 Harbor 版本未启用或不支持此安全模块。" : error?.message || "Harbor 安全模块暂时不可用。";
  return `<section class="security-module-state"><span class="state-icon">${icon("alert")}</span><div><h2>${escapeHTML(title)}</h2><p>${escapeHTML(reason)}</p></div><button class="button button-small" type="button" data-action="refresh-view">${icon("refresh")}<span>重新尝试</span></button></section>`;
}

function renderSecurityOverviewPage(route, summary, projects, projectsError) {
  const scanned = toNumber(summary.scanned_cnt);
  const totalArtifacts = toNumber(summary.total_artifact);
  const totalVulnerabilities = toNumber(summary.total_vuls);
  const dangerousCVEs = asArray(summary.dangerous_cves);
  const dangerousArtifacts = [...asArray(summary.dangerous_artifacts)].sort((left, right) => securityArtifactRisk(right) - securityArtifactRisk(left));
  const scanCoverage = totalArtifacts ? Math.min(100, scanned / totalArtifacts * 100) : 0;
  const warning = projectsError ? `<div class="warning-banner">${icon("alert")}<span>项目名称映射载入失败，部分制品跳转可能不可用：${escapeHTML(projectsError.message)}</span></div>` : "";
  renderSecurityShell(route, `${warning}
    <section class="overview-stats security-stats" aria-label="安全统计">
      ${statCell("漏洞总数", totalVulnerabilities, `${formatNumber(summary.fixable_cnt)} 个已有修复版本`, "shield")}
      ${statCell("严重漏洞", summary.critical_cnt, `${formatNumber(summary.high_cnt)} 个高危漏洞`, "alert")}
      ${statCell("已扫描制品", scanned, `覆盖 ${scanCoverage.toFixed(1)}% 的制品`, "check")}
      ${statCell("未覆盖制品", Math.max(0, totalArtifacts - scanned), `共 ${formatNumber(totalArtifacts)} 个制品`, "database")}
    </section>
    <section class="security-risk-band" aria-label="风险分布">
      <div><span>严重</span><strong>${formatNumber(summary.critical_cnt)}</strong><progress class="security-risk-progress security-risk-critical" max="100" value="${escapeAttr(securityRiskWidth(summary.critical_cnt, totalVulnerabilities))}" aria-label="严重漏洞占比">${escapeHTML(securityRiskWidth(summary.critical_cnt, totalVulnerabilities))}%</progress></div>
      <div><span>高危</span><strong>${formatNumber(summary.high_cnt)}</strong><progress class="security-risk-progress" max="100" value="${escapeAttr(securityRiskWidth(summary.high_cnt, totalVulnerabilities))}" aria-label="高危漏洞占比">${escapeHTML(securityRiskWidth(summary.high_cnt, totalVulnerabilities))}%</progress></div>
      <div><span>中危</span><strong>${formatNumber(summary.medium_cnt)}</strong><progress class="security-risk-progress" max="100" value="${escapeAttr(securityRiskWidth(summary.medium_cnt, totalVulnerabilities))}" aria-label="中危漏洞占比">${escapeHTML(securityRiskWidth(summary.medium_cnt, totalVulnerabilities))}%</progress></div>
      <div><span>低危</span><strong>${formatNumber(summary.low_cnt)}</strong><progress class="security-risk-progress" max="100" value="${escapeAttr(securityRiskWidth(summary.low_cnt, totalVulnerabilities))}" aria-label="低危漏洞占比">${escapeHTML(securityRiskWidth(summary.low_cnt, totalVulnerabilities))}%</progress></div>
    </section>
    <div class="security-overview-grid">
      <section class="table-shell"><div class="table-toolbar"><div><strong>高风险 CVE</strong><span class="toolbar-caption">按 Harbor 风险汇总</span></div><div class="toolbar-spacer"></div><a class="button button-small" href="${securityRoute("vulnerabilities")}">${icon("arrow-right")}<span>全部漏洞</span></a></div><div class="table-scroll">${dangerousCVETable(dangerousCVEs)}</div></section>
      <section class="table-shell"><div class="table-toolbar"><div><strong>危险制品</strong><span class="toolbar-caption">按严重、高危与中危数量排序</span></div></div><div class="table-scroll">${dangerousArtifactTable(dangerousArtifacts, projects)}</div></section>
    </div>`);
}

function securityRiskWidth(value, total) {
  return total ? Math.max(toNumber(value) ? 3 : 0, Math.min(100, toNumber(value) / total * 100)).toFixed(1) : 0;
}

function securityArtifactRisk(item) {
  return toNumber(item.critical_cnt) * 1000000 + toNumber(item.high_cnt) * 1000 + toNumber(item.medium_cnt);
}

function dangerousCVETable(items) {
  if (!items.length) return emptyTable("没有高风险 CVE", "当前汇总没有返回危险漏洞。", "shield");
  return `<table><thead><tr><th>CVE</th><th>风险</th><th>CVSS</th><th>软件包</th><th>说明</th><th></th></tr></thead><tbody>${items.map((item) => `<tr><td><strong class="mono">${escapeHTML(item.cve_id || "-")}</strong></td><td>${severityBadge(item.severity)}</td><td class="mono">${escapeHTML(item.cvss_score_v3 ?? "-")}</td><td><span class="cell-stack"><strong>${escapeHTML(item.package || "-")}</strong><small>${escapeHTML(item.version || "-")}</small></span></td><td class="vulnerability-description">${escapeHTML(item.desc || "-")}</td><td><a class="icon-button" href="${securityRoute("vulnerabilities", 1, { cve: item.cve_id })}" title="查看此 CVE" aria-label="查看 ${escapeAttr(item.cve_id)}">${icon("chevron")}</a></td></tr>`).join("")}</tbody></table>`;
}

function dangerousArtifactTable(items, projects) {
  if (!items.length) return emptyTable("没有危险制品", "当前汇总没有返回高风险制品。", "package");
  return `<table><thead><tr><th>制品</th><th>严重</th><th>高危</th><th>中危</th><th></th></tr></thead><tbody>${items.map((item) => {
    const target = securityArtifactTarget(item, projects);
    return `<tr><td><span class="cell-stack"><strong>${escapeHTML(item.repository_name || "-")}</strong><small class="mono" title="${escapeAttr(item.digest)}">${escapeHTML(shortDigest(item.digest))}</small></span></td><td class="danger-text">${formatNumber(item.critical_cnt)}</td><td>${formatNumber(item.high_cnt)}</td><td>${formatNumber(item.medium_cnt)}</td><td>${target ? `<a class="icon-button" href="${target}" title="打开制品漏洞" aria-label="打开制品漏洞">${icon("chevron")}</a>` : "-"}</td></tr>`;
  }).join("")}</tbody></table>`;
}

function securityArtifactTarget(item, projects) {
  const repository = String(item.repository_name || "");
  const project = asArray(projects).find((candidate) => Number(candidate.project_id) === Number(item.project_id))?.name || repository.split("/")[0];
  if (!project || !repository || !item.digest) return "";
  return artifactRoute(project, repository, item.digest, "vulnerabilities");
}

function securityVulnerabilityQuery(route, projects) {
  const clauses = [];
  const add = (key, value) => { if (String(value || "").trim()) clauses.push(`${key}=${String(value).trim()}`); };
  add("cve_id", route.cve.toUpperCase());
  add("severity", route.severity);
  add("status", route.status);
  add("repository_name", route.repository);
  add("package", route.package);
  add("tag", route.tag);
  const project = asArray(projects).find((item) => String(item.name) === String(route.project));
  if (project?.project_id) add("project_id", project.project_id);
  return clauses.join(",");
}

function renderSecurityVulnerabilityPage(route, result, projects, projectsError) {
  const active = [route.cve, route.severity, route.status, route.repository, route.project, route.package, route.tag].some(Boolean);
  const actions = `${refreshButton()}<a class="button button-small button-primary" href="${securityRoute("exports")}">${icon("database")}<span>导出扫描数据</span></a>`;
  renderSecurityShell(route, `${projectsError ? `<div class="warning-banner">${icon("alert")}<span>项目列表载入失败：${escapeHTML(projectsError.message)}</span></div>` : ""}
    <section class="table-shell security-vulnerability-shell">
      <form id="security-filter-form" class="table-toolbar security-filter-form">
        <label class="toolbar-search">${icon("search")}<input name="cve" value="${escapeAttr(route.cve)}" placeholder="CVE 编号" aria-label="CVE 编号"></label>
        <label class="toolbar-search">${icon("package")}<input name="repository" value="${escapeAttr(route.repository)}" placeholder="完整仓库名称" aria-label="完整仓库名称"></label>
        <label class="toolbar-field"><span>项目</span><select name="project" class="toolbar-select"><option value="">全部项目</option>${asArray(projects).map((item) => `<option value="${escapeAttr(item.name)}" ${item.name === route.project ? "selected" : ""}>${escapeHTML(item.name)}</option>`).join("")}</select></label>
        <label class="toolbar-field"><span>风险</span><select name="severity" class="toolbar-select"><option value="">全部风险</option>${[["Critical", "严重"], ["High", "高危"], ["Medium", "中危"], ["Low", "低危"], ["Unknown", "未知"]].map(([value, label]) => `<option value="${value}" ${route.severity === value ? "selected" : ""}>${label}</option>`).join("")}</select></label>
        <label class="toolbar-field"><span>修复状态</span><select name="status" class="toolbar-select"><option value="">全部状态</option><option value="fixed" ${route.status === "fixed" ? "selected" : ""}>已有修复</option><option value="will_not_fix" ${route.status === "will_not_fix" ? "selected" : ""}>不会修复</option></select></label>
        <label class="toolbar-search compact-search">${icon("database")}<input name="package" value="${escapeAttr(route.package)}" placeholder="软件包" aria-label="软件包"></label>
        <label class="toolbar-search compact-search">${icon("tag")}<input name="tag" value="${escapeAttr(route.tag)}" placeholder="Tag" aria-label="Tag"></label>
        <button class="button button-small button-primary" type="submit">${icon("search")}<span>筛选</span></button>
        ${active ? `<button class="button button-small" type="button" data-action="clear-security-filters">${icon("x")}<span>清除</span></button>` : ""}
        <label class="toolbar-field security-page-size"><span>每页</span><select id="security-page-size" class="toolbar-select"><option value="20" ${route.pageSize === 20 ? "selected" : ""}>20 条</option><option value="50" ${route.pageSize === 50 ? "selected" : ""}>50 条</option><option value="100" ${route.pageSize === 100 ? "selected" : ""}>100 条</option></select></label>
      </form>
      <div class="table-scroll">${securityVulnerabilityTable(result.items, projects)}</div>
      ${controlPagination(result.pagination)}
    </section>`, actions);
  bindSecurityFilters(route);
}

function bindSecurityFilters(route) {
  document.querySelector("#security-filter-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    location.hash = securityRoute("vulnerabilities", 1, values, route.pageSize);
  });
  document.querySelector("#security-page-size")?.addEventListener("change", (event) => {
    location.hash = securityRoute("vulnerabilities", 1, route, Number(event.target.value));
  });
}

function securityVulnerabilityTable(items, projects) {
  if (!items.length) return emptyTable("没有匹配的漏洞", "更换筛选条件，或确认制品已经完成漏洞扫描。", "shield");
  return `<table><thead><tr><th>CVE</th><th>风险</th><th>CVSS</th><th>制品</th><th>Tag</th><th>软件包</th><th>当前版本</th><th>修复版本</th><th>状态</th><th></th></tr></thead><tbody>${items.map((item) => {
    const target = securityArtifactTarget(item, projects);
    return `<tr><td><span class="cell-stack"><strong class="mono">${escapeHTML(item.cve_id || "-")}</strong><small class="security-vulnerability-desc" title="${escapeAttr(item.desc)}">${escapeHTML(item.desc || "暂无说明")}</small></span></td><td>${severityBadge(item.severity)}</td><td class="mono">${escapeHTML(item.cvss_v3_score ?? "-")}</td><td><span class="cell-stack"><strong>${escapeHTML(item.repository_name || "-")}</strong><small class="mono" title="${escapeAttr(item.digest)}">${escapeHTML(shortDigest(item.digest))}</small></span></td><td><span class="tag-stack">${asArray(item.tags).slice(0, 3).map((tag) => `<span class="badge">${escapeHTML(tag)}</span>`).join("") || "-"}</span></td><td>${escapeHTML(item.package || "-")}</td><td class="mono">${escapeHTML(item.version || "-")}</td><td class="mono">${escapeHTML(item.fixed_version || "暂无")}</td><td>${vulnerabilityStatusBadge(item.status)}</td><td>${target ? `<a class="icon-button" href="${target}" title="打开制品" aria-label="打开制品">${icon("chevron")}</a>` : "-"}</td></tr>`;
  }).join("")}</tbody></table>`;
}

function vulnerabilityStatusBadge(value) {
  const status = String(value || "").toLowerCase();
  const labels = { fixed: ["已有修复", "badge-green"], will_not_fix: ["不会修复", "badge-orange"], "won't fix": ["不会修复", "badge-orange"], not_fixed: ["暂无修复", ""] };
  const [label, className] = labels[status] || [value || "未知", ""];
  return `<span class="badge ${className}">${escapeHTML(label)}</span>`;
}

function renderSecurityExportPage(route, executions, projects, projectsError) {
  renderSecurityShell(route, `${projectsError ? `<div class="warning-banner">${icon("alert")}<span>项目列表载入失败，暂时无法新建导出：${escapeHTML(projectsError.message)}</span></div>` : ""}
    <section class="security-export-intro"><div><span class="eyebrow">官方扫描数据导出</span><h2>生成可离线分析的 CVE 清单</h2><p>导出任务由 Harbor JobService 执行，完成后可直接下载 CSV 文件。</p></div><button class="button button-small button-primary" type="button" data-action="create-cve-export" ${projects.length ? "" : "disabled"}>${icon("plus")}<span>新建导出</span></button></section>
    <section class="table-shell"><div class="table-toolbar"><strong>导出执行记录</strong><div class="toolbar-spacer"></div><span class="muted">${formatNumber(executions.length)} 次执行</span></div><div class="table-scroll">${securityExportTable(executions)}</div></section>`);
}

function securityExportTable(executions) {
  if (!executions.length) return emptyTable("暂无导出记录", "创建导出任务后，执行状态和下载入口会显示在这里。", "database");
  return `<table><thead><tr><th>执行</th><th>发起人</th><th>触发方式</th><th>状态</th><th>开始时间</th><th>结束时间</th><th>耗时</th><th></th></tr></thead><tbody>${executions.map((execution) => {
    const status = String(execution.status || "").toLowerCase();
    const success = ["success", "succeed", "completed"].includes(status);
    const failed = ["error", "failed"].includes(status);
    return `<tr><td class="mono">#${escapeHTML(execution.id)}</td><td>${escapeHTML(execution.user_name || `用户 #${execution.user_id || "-"}`)}</td><td>${triggerLabel(execution.trigger)}</td><td>${statusBadge(execution.status)}</td><td>${formatDate(execution.start_time)}</td><td>${formatDate(execution.end_time)}</td><td>${formatDuration(execution.start_time, execution.end_time)}</td><td><div class="row-actions">${failed ? `<button class="icon-button" type="button" data-action="view-cve-export" data-id="${escapeAttr(execution.id)}" title="查看失败详情" aria-label="查看失败详情">${icon("alert")}</button>` : ""}${success && execution.file_present !== false ? `<button class="button button-small" type="button" data-action="download-cve-export" data-id="${escapeAttr(execution.id)}">${icon("database")}<span>下载 CSV</span></button>` : ""}</div></td></tr>`;
  }).join("")}</tbody></table>`;
}

function showCVEExportDialog(preselectedProject = "", availableProjects = null) {
  const projects = asArray(availableProjects || state.securityProjects || state.controlProjects);
  openControlDialog({
    title: "新建 CVE 导出",
    subtitle: "Harbor 当前一次导出一个项目的扫描数据",
    submitLabel: "创建导出任务",
    content: `<div class="form-grid two-columns"><label class="field"><span>项目</span><select name="project" required>${projects.map((project) => `<option value="${escapeAttr(project.project_id)}" ${project.name === preselectedProject ? "selected" : ""}>${escapeHTML(project.name)}</option>`).join("")}</select></label><label class="field"><span>任务名称</span><input name="job_name" maxlength="255" placeholder="例如 月度漏洞审计"></label><label class="field"><span>仓库匹配</span><input name="repositories" maxlength="2048" placeholder="例如 platform/**"></label><label class="field"><span>Tag 匹配</span><input name="tags" maxlength="2048" placeholder="例如 release-*"></label><label class="field"><span>CVE 编号</span><input name="cveIds" maxlength="2048" placeholder="多个编号按 Harbor 查询语法填写"></label><label class="field"><span>标签 ID</span><input name="labels" maxlength="512" placeholder="例如 12,18"></label></div>`,
    onSubmit: async (formData) => {
      const labels = String(formData.get("labels") || "").split(/[\s,]+/).filter(Boolean).map(Number);
      if (labels.some((value) => !Number.isInteger(value) || value <= 0)) throw new Error("标签 ID 必须是用逗号分隔的正整数");
      const payload = { projects: [Number(formData.get("project"))], labels };
      for (const key of ["job_name", "repositories", "cveIds", "tags"]) {
        const value = String(formData.get(key) || "").trim();
        if (value) payload[key] = value;
      }
		  const project = projects.find((item) => Number(item.project_id) === payload.projects[0]);
		  const operationID = beginOperation({ kind: "cve-export", title: "CVE 导出", detail: project?.name || `项目 #${payload.projects[0]}`, total: 1 });
		  let result;
		  try {
			result = await controlMutation("cve-export", {}, "POST", payload);
			recordOperationResult(operationID, project?.name || `项目 #${payload.projects[0]}`);
			finishOperation(operationID, `Harbor 导出任务 #${result?.data?.id || "-"} 已创建`);
		  } catch (error) {
			failOperation(operationID, error);
			throw error;
		  }
      closeControlDialog();
      showToast(`CVE 导出任务 #${result?.data?.id || "-"} 已创建`);
      renderCurrentView(true);
    },
  });
}

async function showCVEExportDetail(id) {
  try {
    const execution = asObject(await controlData("cve-export-execution", { id }));
    openControlDialog({
      title: `导出执行 #${id}`,
      subtitle: "Harbor JobService 返回的执行详情",
      submitLabel: "关闭",
      hideCancel: true,
      content: `<dl class="definition-list export-detail-list">${definitionRow("状态", statusInfo(execution.status)[0])}${definitionRow("发起人", execution.user_name || `用户 #${execution.user_id || "-"}`)}${definitionRow("开始时间", formatDate(execution.start_time))}${definitionRow("结束时间", formatDate(execution.end_time))}${definitionRow("状态详情", execution.status_text || "暂无附加信息")}</dl>`,
      onSubmit: async () => closeControlDialog(),
    });
  } catch (error) {
    showToast(error.message, true);
  }
}

function downloadCVEExport(id) {
  const anchor = document.createElement("a");
  anchor.href = controlURL("cve-export-download", { id, format: "CSV" });
  anchor.download = "";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  showToast(`正在下载导出任务 #${id}`);
}

function renderSecurityAllowlistPage(route, allowlist) {
  const items = asArray(allowlist.items);
  const permanent = allowlist.expires_at === null || allowlist.expires_at === undefined || !toNumber(allowlist.expires_at);
  renderSecurityShell(route, `<section class="allowlist-summary"><div class="allowlist-summary-head"><div><span class="eyebrow">系统级 CVE Allowlist</span><h2>${formatNumber(items.length)} 个例外漏洞</h2><p>${permanent ? "永久生效" : `有效期至 ${formatCVEExpiration(allowlist.expires_at)}`} · 最近更新 ${formatDate(allowlist.update_time)}</p></div><button class="button button-small button-primary" type="button" data-action="edit-system-allowlist">${icon("edit")}<span>编辑白名单</span></button></div><div class="allowlist-items">${items.length ? items.map((item) => `<span class="allowlist-chip">${icon("check")}<code>${escapeHTML(item.cve_id)}</code></span>`).join("") : `<div class="allowlist-empty">${icon("shield")}<span>系统白名单为空，所有漏洞均按扫描结果处理。</span></div>`}</div></section>
    <section class="security-guidance"><div>${icon("alert")}</div><div><h2>白名单只忽略指定 CVE</h2><p>项目可以继承此系统白名单，也可以在项目设置中使用独立白名单。到期后 Harbor 会自动恢复这些 CVE 的风险判定。</p></div></section>`);
}

function formatCVEExpiration(value) {
  const date = new Date(toNumber(value) * 1000);
  if (Number.isNaN(date.getTime())) return "无效日期";
  return new Intl.DateTimeFormat(currentLocale(), { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function cveExpirationInputValue(value) {
  const date = new Date(toNumber(value) * 1000);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function parseCVEItems(value) {
  const values = String(value || "").split(/[\s,;]+/).map((item) => item.trim().toUpperCase()).filter(Boolean);
  const unique = [...new Set(values)];
  const invalid = unique.find((item) => !/^CVE-\d{4}-\d{4,}$/.test(item));
  if (invalid) throw new Error(`CVE 编号 ${invalid} 格式无效，应类似 CVE-2026-1842`);
  if (unique.length > 1000) throw new Error("CVE 白名单最多包含 1000 项");
  return unique.map((cve_id) => ({ cve_id }));
}

function cveExpirationFromForm(formData) {
  if (formData.has("permanent")) return null;
  const raw = String(formData.get("expires_at") || "");
  if (!raw) throw new Error("非永久白名单必须选择到期日期");
  const value = new Date(`${raw}T23:59:59`).getTime();
  if (!Number.isFinite(value)) throw new Error("白名单到期日期无效");
  return Math.floor(value / 1000);
}

function allowlistEditorContent(allowlist, prefix = "system") {
  const permanent = allowlist.expires_at === null || allowlist.expires_at === undefined || !toNumber(allowlist.expires_at);
  const today = new Date();
  const localToday = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  return `<div class="form-grid"><label class="check-row"><input name="permanent" type="checkbox" ${permanent ? "checked" : ""} data-allowlist-permanent><span><strong>永久生效</strong><small>取消后必须设置明确的到期日期</small></span></label><label class="field"><span>到期日期</span><input name="expires_at" type="date" min="${localToday}" value="${escapeAttr(permanent ? "" : cveExpirationInputValue(allowlist.expires_at))}" data-allowlist-expiration ${permanent ? "disabled" : ""}></label><label class="field"><span>CVE 编号</span><textarea name="cves" rows="10" maxlength="33000" placeholder="每行一个，例如 CVE-2026-1842">${asArray(allowlist.items).map((item) => escapeHTML(item.cve_id)).join("\n")}</textarea><small class="field-help">支持换行、空格、逗号或分号分隔；保存时自动转为大写、去重并校验格式。</small></label><div class="allowlist-editor-count" data-allowlist-count>${formatNumber(asArray(allowlist.items).length)} 个 CVE</div></div>`;
}

function bindAllowlistEditor(form) {
  const permanent = form.querySelector("[data-allowlist-permanent]");
  const expiration = form.querySelector("[data-allowlist-expiration]");
  const textarea = form.querySelector('[name="cves"]');
  const count = form.querySelector("[data-allowlist-count]");
  const syncExpiration = () => { if (expiration) expiration.disabled = Boolean(permanent?.checked); };
  const syncCount = () => {
    if (!count) return;
    const values = String(textarea?.value || "").split(/[\s,;]+/).filter(Boolean);
    count.textContent = `${formatNumber(new Set(values.map((item) => item.toUpperCase())).size)} 个 CVE`;
  };
  permanent?.addEventListener("change", syncExpiration);
  textarea?.addEventListener("input", syncCount);
  syncExpiration();
  syncCount();
}

function showSystemCVEAllowlistDialog() {
  openControlDialog({
    title: "编辑系统 CVE 白名单",
    subtitle: "对使用系统白名单的全部项目生效",
    submitLabel: "保存白名单",
    content: allowlistEditorContent(asObject(state.securityAllowlist)),
    onSubmit: async (formData) => {
      const payload = { expires_at: cveExpirationFromForm(formData), items: parseCVEItems(formData.get("cves")) };
      await controlMutation("system-cve-allowlist", {}, "PUT", payload);
      closeControlDialog();
      showToast("系统 CVE 白名单已保存");
      renderCurrentView(true);
    },
  });
  const form = document.querySelector("#control-dialog-form");
  if (form) bindAllowlistEditor(form);
}

async function renderControlReplication(token) {
  const route = state.route || parseConsoleRoute();
  mainContent.innerHTML = `${pageHeader("复制管理", viewMeta.replication.subtitle, refreshButton())}${demoBanner()}<section class="table-shell">${loadingRows()}</section>`;
  try {
    const policyQuery = route.tab === "policies"
      ? { page: route.page, page_size: route.pageSize, sort: route.replicationSort, name: route.filter }
      : { page: 1, page_size: 100, sort: replicationPolicyDefaultSort };
    const executionQuery = route.tab === "executions"
      ? { page: route.page, page_size: route.pageSize, sort: route.replicationSort, status: route.status, trigger: route.trigger, policy_id: route.policyID }
      : { page: 1, page_size: 1, sort: "-start_time" };
    const [policies, executions, registries, localInfoResult, labelsResult] = await Promise.all([
      controlList("replication-policies", policyQuery),
      controlList("replication-executions", executionQuery),
      controlList("registries", { page: 1, page_size: 100, sort: "name" }),
      controlData("registry-info", { id: 0 }).then((data) => ({ data })).catch((error) => ({ error: error.message })),
      controlList("labels", { page: 1, page_size: 100, sort: "name", scope: "g" }).then((data) => ({ data })).catch((error) => ({ error: error.message })),
    ]);
    if (token !== state.renderToken || state.currentView !== "replication") return;
    state.controlPolicies = policies.items;
    state.controlExecutions = executions.items;
    state.controlRegistries = registries.items;
    state.controlRegistryInfos = new Map();
    if (localInfoResult.data) state.controlRegistryInfos.set("0", asObject(localInfoResult.data));
    state.controlGlobalLabels = labelsResult.data?.items || [];
    state.controlReplicationCapabilityError = [localInfoResult.error, labelsResult.error].filter(Boolean).join("；");
    mainContent.innerHTML = `${pageHeader("复制管理", viewMeta.replication.subtitle, `${refreshButton()}<button class="button button-small button-primary" type="button" data-action="create-replication-policy">${icon("plus")}<span>新建策略</span></button>`)}${demoBanner()}
      ${state.controlReplicationCapabilityError ? `<div class="warning-banner">${icon("alert")}<span>复制能力元数据部分载入失败：${escapeHTML(state.controlReplicationCapabilityError)}。创建策略时将再次读取。</span></div>` : ""}
      <nav class="resource-tabs replication-list-tabs" aria-label="复制管理页面"><a href="${replicationRoute("policies")}" class="${route.tab === "policies" ? "active" : ""}" ${route.tab === "policies" ? 'aria-current="page"' : ""}>${icon("refresh")}<span>复制策略</span></a><a href="${replicationRoute("executions")}" class="${route.tab === "executions" ? "active" : ""}" ${route.tab === "executions" ? 'aria-current="page"' : ""}>${icon("history")}<span>执行记录</span></a></nav>
      ${route.tab === "policies" ? replicationPoliciesSection(policies, route) : replicationExecutionsSection(executions, policies.items, route)}`;
    bindReplicationListControls(route);
  } catch (error) {
    if (token === state.renderToken) renderError("复制数据载入失败", error.message, "refresh-view");
  }
}

function replicationPoliciesSection(policies, route) {
  return `<section class="replication-policies-section"><div class="section-heading replication-policy-heading"><div><h2>复制策略 <span class="section-count">${formatNumber(policies.pagination.total)} 条</span></h2></div></div><div class="table-shell"><form id="replication-policy-filter" class="table-toolbar"><div class="toolbar-search">${icon("search")}<input name="q" type="search" maxlength="255" value="${escapeAttr(route.filter)}" placeholder="按策略名称搜索" aria-label="按策略名称搜索"></div><button class="button button-small button-primary" type="submit">${icon("search")}<span>筛选</span></button><div class="toolbar-spacer"></div><label class="toolbar-field"><span>排序</span><select id="replication-sort" class="toolbar-select"><option value="id" ${route.replicationSort === "id" ? "selected" : ""}>${translateUI("策略编号")}</option><option value="-id" ${route.replicationSort === "-id" ? "selected" : ""}>${translateUI("策略编号（倒序）")}</option><option value="name" ${route.replicationSort === "name" ? "selected" : ""}>${translateUI("名称")}</option><option value="-update_time" ${route.replicationSort === "-update_time" ? "selected" : ""}>${translateUI("最近更新")}</option><option value="update_time" ${route.replicationSort === "update_time" ? "selected" : ""}>${translateUI("最早更新")}</option></select></label><label class="toolbar-field"><span>每页</span><select id="replication-page-size" class="toolbar-select"><option value="20" ${route.pageSize === 20 ? "selected" : ""}>20 条</option><option value="50" ${route.pageSize === 50 ? "selected" : ""}>50 条</option><option value="100" ${route.pageSize === 100 ? "selected" : ""}>100 条</option></select></label></form><div class="table-scroll">${controlPolicyTable(policies.items)}</div>${controlPagination(policies.pagination)}</div></section>`;
}

function replicationExecutionsSection(executions, policies, route) {
  const statuses = ["InProgress", "Succeed", "Failed", "Stopped"];
  const triggers = ["manual", "scheduled", "event_based"];
  return `<section class="table-shell"><form id="replication-execution-filter" class="table-toolbar filter-toolbar"><div class="filter-toolbar-query"><div class="filter-toolbar-controls"><label class="toolbar-field"><span>策略</span><select name="policy_id" class="toolbar-select"><option value="">全部策略</option>${policies.map((policy) => `<option value="${escapeAttr(policy.id)}" ${String(route.policyID) === String(policy.id) ? "selected" : ""}>${escapeHTML(policy.name)}</option>`).join("")}</select></label><label class="toolbar-field"><span>状态</span><select name="status" class="toolbar-select"><option value="">全部状态</option>${statuses.map((status) => `<option value="${status}" ${route.status === status ? "selected" : ""}>${statusInfo(status)[0]}</option>`).join("")}</select></label><label class="toolbar-field"><span>触发方式</span><select name="trigger" class="toolbar-select"><option value="">全部方式</option>${triggers.map((trigger) => `<option value="${trigger}" ${route.trigger === trigger ? "selected" : ""}>${triggerLabel(trigger)}</option>`).join("")}</select></label><div class="filter-toolbar-actions"><button class="button button-small button-primary" type="submit">${icon("search")}<span>筛选</span></button></div></div></div><div class="filter-toolbar-meta"><label class="toolbar-field"><span>排序</span><select id="replication-sort" class="toolbar-select"><option value="-start_time" ${route.replicationSort === "-start_time" ? "selected" : ""}>最近开始</option><option value="start_time" ${route.replicationSort === "start_time" ? "selected" : ""}>最早开始</option></select></label><label class="toolbar-field"><span>每页</span><select id="replication-page-size" class="toolbar-select"><option value="20" ${route.pageSize === 20 ? "selected" : ""}>20 条</option><option value="50" ${route.pageSize === 50 ? "selected" : ""}>50 条</option><option value="100" ${route.pageSize === 100 ? "selected" : ""}>100 条</option></select></label></div></form><div class="table-scroll">${controlExecutionTable(executions.items, policies)}</div>${controlPagination(executions.pagination)}</section>`;
}

function bindReplicationListControls(route) {
  document.querySelector("#replication-policy-filter")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    location.hash = replicationRoute("policies", 1, { filter: String(data.get("q") || "").trim(), replicationSort: route.replicationSort }, route.pageSize);
  });
  document.querySelector("#replication-execution-filter")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    location.hash = replicationRoute("executions", 1, { status: data.get("status"), trigger: data.get("trigger"), policyID: data.get("policy_id"), replicationSort: route.replicationSort }, route.pageSize);
  });
  document.querySelector("#replication-sort")?.addEventListener("change", (event) => { location.hash = replicationRoute(route.tab, 1, { ...route, replicationSort: event.target.value }, route.pageSize); });
  document.querySelector("#replication-page-size")?.addEventListener("change", (event) => { location.hash = replicationRoute(route.tab, 1, route, Number(event.target.value)); });
}

function controlPolicyTable(policies) {
  if (!policies.length) return emptyTable("暂无复制策略", "创建策略后可以在实例间同步制品。", "refresh");
  return `<table><thead><tr><th>策略</th><th>方向</th><th>远端仓库</th><th>触发方式</th><th>状态</th><th></th></tr></thead><tbody>${policies.map((policy) => {
    const source = asObject(policy.src_registry);
    const destination = asObject(policy.dest_registry);
    const isPush = toNumber(destination.id) > 0;
    const direction = isPush ? "推送" : "拉取";
    const remote = isPush ? destination : source;
    return `<tr><td><div class="cell-title"><span class="cell-icon">${icon("refresh")}</span><span class="cell-stack"><strong>${escapeHTML(policy.name)}</strong><small>${escapeHTML(policy.description || `策略 #${policy.id}`)}</small></span></div></td><td><span class="badge badge-blue">${direction}</span></td><td>${escapeHTML(remote.name || `#${remote.id || "-"}`)}</td><td>${triggerLabel(asObject(policy.trigger).type)}</td><td>${policy.enabled ? '<span class="badge badge-green">已启用</span>' : '<span class="badge">已停用</span>'}</td><td><div class="row-actions"><button class="icon-button" type="button" data-action="run-replication-policy" data-id="${escapeAttr(policy.id)}" title="立即执行" aria-label="立即执行">${icon("play")}</button><button class="icon-button" type="button" data-action="edit-replication-policy" data-id="${escapeAttr(policy.id)}" title="编辑策略" aria-label="编辑策略">${icon("edit")}</button><button class="icon-button danger-icon" type="button" data-action="delete-replication-policy" data-id="${escapeAttr(policy.id)}" data-name="${escapeAttr(policy.name)}" title="删除策略" aria-label="删除策略">${icon("trash")}</button></div></td></tr>`;
  }).join("")}</tbody></table>`;
}

function controlExecutionTable(executions, policies) {
  if (!executions.length) return emptyTable("暂无复制记录", "运行复制策略后，执行结果会显示在这里。", "refresh");
  const policyNames = new Map(asArray(policies).map((policy) => [String(policy.id), policy.name]));
  return `<table><thead><tr><th>执行编号</th><th>策略</th><th>触发方式</th><th>状态</th><th>任务统计</th><th>开始时间</th><th>耗时</th><th></th></tr></thead><tbody>${executions.map((execution) => `<tr><td class="mono">#${escapeHTML(execution.id)}</td><td>${escapeHTML(policyNames.get(String(execution.policy_id)) || `策略 #${execution.policy_id || "-"}`)}</td><td>${triggerLabel(execution.trigger)}</td><td>${statusBadge(execution.status)}</td><td><span class="execution-counts"><b class="success-text">${formatNumber(execution.succeed)}</b><b class="danger-text">${formatNumber(execution.failed)}</b><span>${formatNumber(execution.in_progress)}</span></span></td><td>${formatDate(execution.start_time)}</td><td>${formatDuration(execution.start_time, execution.end_time)}</td><td><button class="button button-small" type="button" data-action="view-replication-execution" data-id="${escapeAttr(execution.id)}">${icon("history")}<span>查看任务</span></button></td></tr>`).join("")}</tbody></table>`;
}

async function renderControlRegistries(token) {
  mainContent.innerHTML = `${pageHeader("远端仓库", viewMeta.registries.subtitle, refreshButton())}${demoBanner()}<section class="table-shell">${loadingRows()}</section>`;
  try {
    const [registries, adapters, adapterInfos] = await Promise.all([
      controlList("registries", { page: 1, page_size: 100, sort: "name" }),
      controlData("registry-adapters").catch(() => []),
      controlData("registry-adapter-infos").catch(() => ({})),
    ]);
    if (token !== state.renderToken || state.currentView !== "registries") return;
    state.controlRegistries = registries.items;
    state.controlRegistryAdapters = asArray(adapters);
    state.controlRegistryAdapterInfos = asObject(adapterInfos);
    mainContent.innerHTML = `${pageHeader("远端仓库", viewMeta.registries.subtitle, `${refreshButton()}<button class="button button-small button-primary" type="button" data-action="create-registry">${icon("plus")}<span>新建连接</span></button>`)}${demoBanner()}
      ${registries.items.length ? `<section class="registry-grid control-registry-grid">${registries.items.map(controlRegistryCard).join("")}</section>` : `<section class="panel">${emptyTable("暂无远端仓库", "添加连接后可用于复制和代理缓存。", "database")}</section>`}`;
  } catch (error) {
    if (token === state.renderToken) renderError("远端仓库载入失败", error.message, "refresh-view");
  }
}

function controlRegistryCard(registry) {
  return `<article class="registry-item"><div class="registry-top"><span class="registry-icon">${icon("database")}</span>${statusBadge(registry.status || "unknown")}</div><h3>${escapeHTML(registry.name)}</h3><span class="registry-url" title="${escapeAttr(registry.url)}">${escapeHTML(registry.url)}</span><div class="registry-meta"><span>${registryTypeLabel(registry.type)}</span><span>#${escapeHTML(registry.id)}</span></div><div class="registry-actions"><button class="button button-small" type="button" data-action="ping-registry" data-id="${escapeAttr(registry.id)}">${icon("refresh")}<span>测试连接</span></button><div class="row-actions"><button class="icon-button" type="button" data-action="edit-registry" data-id="${escapeAttr(registry.id)}" title="编辑" aria-label="编辑">${icon("edit")}</button><button class="icon-button danger-icon" type="button" data-action="delete-registry" data-id="${escapeAttr(registry.id)}" data-name="${escapeAttr(registry.name)}" title="删除" aria-label="删除">${icon("trash")}</button></div></div></article>`;
}

async function renderPreheatDistribution(token) {
  mainContent.innerHTML = `${pageHeader("P2P 分发", viewMeta.preheat.subtitle, refreshButton())}${demoBanner()}<section class="table-shell">${loadingRows()}</section>`;
  const [providersResult, instancesResult] = await Promise.allSettled([
    controlData("preheat-providers"),
    controlList("preheat-instances", { page: 1, page_size: 100, sort: "name" }),
  ]);
  if (token !== state.renderToken || state.currentView !== "preheat") return;
  const providers = providersResult.status === "fulfilled" ? asArray(providersResult.value) : [];
  const instances = instancesResult.status === "fulfilled" ? instancesResult.value : { items: [], pagination: { page: 1, page_size: 100, total: 0 } };
  state.controlPreheatProviders = providers;
  state.controlPreheatInstances = instances.items;
  const errors = [providersResult, instancesResult].filter((result) => result.status === "rejected").map((result) => result.reason.message);
  if (errors.length === 2) {
    renderError("P2P 分发不可用", `${errors.join("；")}。当前 Harbor 版本可能未启用分布式分发模块，或当前账号没有系统级预热实例权限。`, "refresh-view");
    return;
  }
  mainContent.innerHTML = `${pageHeader("P2P 分发", viewMeta.preheat.subtitle, `${refreshButton()}<button class="button button-small button-primary" type="button" data-action="create-preheat-instance" ${providers.length ? "" : "disabled"}>${icon("plus")}<span>新建实例</span></button>`)}${demoBanner()}
    ${errors.length ? `<div class="warning-banner preheat-warning">${icon("alert")}<span>${escapeHTML(errors.join("；"))}</span></div>` : ""}
    <section class="preheat-provider-band"><div><span class="eyebrow">官方 Provider</span><h2>${formatNumber(providers.length)} 种驱动可用</h2></div><div class="preheat-provider-list">${providers.length ? providers.map(preheatProviderBadge).join("") : '<span class="muted">当前实例未返回 Provider 元数据</span>'}</div></section>
    <section class="table-shell"><div class="table-toolbar"><strong>P2P Provider 实例</strong><div class="toolbar-spacer"></div><span class="muted">${formatNumber(instances.pagination.total)} 个实例</span></div><div class="table-scroll">${preheatInstanceTable(instances.items)}</div></section>`;
}

function preheatProviderBadge(provider) {
  return `<span class="preheat-provider-badge"><span class="cell-icon">${icon("play")}</span><span><strong>${escapeHTML(provider.name || provider.id)}</strong><small>${escapeHTML([provider.id, provider.version].filter(Boolean).join(" · "))}</small></span></span>`;
}

function preheatInstanceTable(instances) {
  if (!instances.length) return emptyTable("暂无 P2P 实例", "注册 Dragonfly、Kraken 等 Provider 实例后，项目即可创建预热策略。", "play");
  return `<table><thead><tr><th>实例</th><th>Provider</th><th>地址</th><th>认证</th><th>状态</th><th>默认</th><th></th></tr></thead><tbody>${instances.map((instance) => `<tr><td><div class="cell-title"><span class="cell-icon">${icon("play")}</span><span class="cell-stack"><strong>${escapeHTML(instance.name)}</strong><small>${escapeHTML(instance.description || `实例 #${instance.id}`)}</small></span></div></td><td><span class="badge badge-blue">${escapeHTML(instance.vendor || "-")}</span></td><td class="truncate-cell mono" title="${escapeAttr(instance.endpoint)}">${escapeHTML(instance.endpoint || "-")}</td><td>${preheatAuthModeLabel(instance.auth_mode)}</td><td>${instance.enabled === false ? '<span class="badge">已停用</span>' : statusBadge(instance.status)}</td><td>${instance.default ? '<span class="badge badge-orange">默认</span>' : "-"}</td><td><div class="row-actions"><button class="icon-button" type="button" data-action="ping-preheat-instance" data-id="${escapeAttr(instance.id)}" title="测试连接" aria-label="测试连接">${icon("refresh")}</button><button class="icon-button" type="button" data-action="edit-preheat-instance" data-name="${escapeAttr(instance.name)}" title="编辑实例" aria-label="编辑实例">${icon("edit")}</button><button class="icon-button danger-icon" type="button" data-action="delete-preheat-instance" data-name="${escapeAttr(instance.name)}" title="删除实例" aria-label="删除实例">${icon("trash")}</button></div></td></tr>`).join("")}</tbody></table>`;
}

function preheatAuthModeLabel(value) {
  const mode = String(value || "NONE").toUpperCase();
  return `<span class="badge ${mode === "NONE" ? "" : "badge-blue"}">${mode === "BASIC" ? "用户名密码" : mode === "OAUTH" ? "OAuth Token" : "无认证"}</span>`;
}

function projectPreheatSection(project, route, collection) {
  const errors = [collection.policies_error, collection.providers_error].filter(Boolean);
  const providers = asArray(collection.providers);
  return `<div class="preheat-project-layout">
    ${errors.length ? `<div class="warning-banner preheat-warning">${icon("alert")}<span>${escapeHTML(errors.join("；"))}</span></div>` : ""}
    ${!providers.length ? `<section class="preheat-missing-provider"><div><h2>没有可用的 P2P Provider 实例</h2><p>系统管理员需要先注册并启用分布式分发实例。</p></div><a class="button button-small" href="#/preheat">${icon("arrow-right")}<span>前往 P2P 分发</span></a></section>` : ""}
    <section class="table-shell"><div class="table-toolbar">${controlSearchForm("preheat-policy-search", route.filter, "按策略名称搜索")}<div class="toolbar-spacer"></div><button class="button button-small button-primary" type="button" data-action="create-preheat-policy" ${providers.length ? "" : "disabled"}>${icon("plus")}<span>新建预热策略</span></button></div><div class="table-scroll">${preheatPolicyTable(collection.items, providers)}</div>${controlPagination(collection.pagination)}</section>
  </div>`;
}

function preheatPolicyTable(policies, providers) {
  if (!policies.length) return emptyTable("暂无预热策略", "创建策略后可按仓库、Tag 和标签将镜像预热到 P2P 节点。", "play");
  const providerNames = new Map(providers.map((provider) => [String(provider.id), provider.provider || `Provider #${provider.id}`]));
  return `<table><thead><tr><th>策略</th><th>Provider</th><th>筛选范围</th><th>触发方式</th><th>状态</th><th>最近更新</th><th></th></tr></thead><tbody>${policies.map((policy) => {
    const trigger = parsePreheatJSON(policy.trigger, {});
    const filters = asArray(parsePreheatJSON(policy.filters, []));
    return `<tr><td><div class="cell-title"><span class="cell-icon">${icon("play")}</span><span class="cell-stack"><strong>${escapeHTML(policy.name)}</strong><small>${escapeHTML(policy.description || `策略 #${policy.id}`)}</small></span></div></td><td><span class="badge badge-blue">${escapeHTML(providerNames.get(String(policy.provider_id)) || `#${policy.provider_id}`)}</span></td><td>${preheatFilterSummary(filters)}</td><td><span class="cell-stack"><strong>${preheatTriggerLabel(trigger.type)}</strong><small class="mono">${escapeHTML(asObject(trigger.trigger_setting).cron || "-")}</small></span></td><td>${policy.enabled ? '<span class="badge badge-green">已启用</span>' : '<span class="badge">已停用</span>'}</td><td>${formatDate(policy.update_time || policy.creation_time)}</td><td><div class="row-actions"><button class="icon-button" type="button" data-action="run-preheat-policy" data-name="${escapeAttr(policy.name)}" title="立即预热" aria-label="立即预热" ${policy.enabled ? "" : "disabled"}>${icon("play")}</button><button class="icon-button" type="button" data-action="view-preheat-executions" data-name="${escapeAttr(policy.name)}" title="执行记录" aria-label="执行记录">${icon("history")}</button><button class="icon-button" type="button" data-action="edit-preheat-policy" data-name="${escapeAttr(policy.name)}" title="编辑策略" aria-label="编辑策略">${icon("edit")}</button><button class="icon-button danger-icon" type="button" data-action="delete-preheat-policy" data-name="${escapeAttr(policy.name)}" title="删除策略" aria-label="删除策略">${icon("trash")}</button></div></td></tr>`;
  }).join("")}</tbody></table>`;
}

function parsePreheatJSON(value, fallback) {
  if (value && typeof value === "object") return value;
  try { return JSON.parse(String(value || "")); } catch { return fallback; }
}

function preheatFilterSummary(filters) {
  const labels = { repository: "仓库", tag: "Tag", label: "标签", signature: "签名", vulnerability: "漏洞" };
  return `<span class="preheat-filter-list">${filters.length ? filters.slice(0, 3).map((filter) => `<span class="badge"><b>${labels[filter.type] || escapeHTML(filter.type)}</b> ${escapeHTML(String(filter.value ?? ""))}</span>`).join("") : '<span class="badge">无筛选</span>'}</span>`;
}

function preheatTriggerLabel(value) {
  const labels = { manual: "手动", scheduled: "定时", event_based: "事件触发", "scheduled(paused)": "定时已暂停", Manual: "手动", Scheduled: "定时", Event: "事件触发" };
  return labels[value] || escapeHTML(value || "手动");
}

function handleControlAction(target, action, event) {
  const handlers = {
    "control-page": () => setControlPage(target.dataset.page),
    "clear-audit-filters": () => { location.hash = auditRoute(); },
    "clear-security-filters": () => { location.hash = securityRoute("vulnerabilities"); },
		"create-cve-export": showCVEExportDialog,
		"export-selected-project-cve": () => {
			const project = selectedProjectItems()[0];
			if (project) showCVEExportDialog(project.name, [project]);
		},
		"view-cve-export": () => showCVEExportDetail(target.dataset.id),
    "download-cve-export": () => downloadCVEExport(target.dataset.id),
    "edit-system-allowlist": showSystemCVEAllowlistDialog,
    "control-open-project": () => { location.hash = projectRoute(target.dataset.project); },
    "control-open-repository": () => { location.hash = repositoryRoute(target.dataset.project, target.dataset.repository); },
	    "control-open-artifact": () => { location.hash = artifactRoute(target.dataset.project, target.dataset.repository, target.dataset.reference); },
		"select-project": () => toggleProjectSelection(target),
		"select-all-projects": () => toggleAllProjectSelection(target),
		"batch-delete-projects": showBatchDeleteProjectsDialog,
		"select-repository": () => toggleRepositorySelection(target),
		"select-all-repositories": () => toggleAllRepositorySelection(target),
		"batch-delete-repositories": showBatchDeleteRepositoriesDialog,
		"set-repository-view": () => setRepositoryView(target.dataset.view),
		"show-push-command": () => showPushCommandDialog(target.dataset.repository || "", target.dataset.project || state.route.project),
		"copy-push-commands": () => copyControlValue(asArray(state.pushCommands).join("\n")),
	"select-artifact": () => toggleArtifactSelection(target),
	"select-all-artifacts": () => toggleAllArtifactSelection(target),
	"batch-scan-artifacts": () => runArtifactScanBatch("vulnerability"),
	"batch-sbom-artifacts": () => runArtifactScanBatch("sbom"),
	"batch-stop-artifacts": runArtifactStopBatch,
	"batch-attach-label": showBatchAttachLabelDialog,
	"batch-remove-label": showBatchRemoveLabelDialog,
	"batch-delete-artifacts": showBatchDeleteArtifactsDialog,
	"copy-selected-artifact": () => showArtifactCopyDialog(selectedArtifactItems()[0]),
	"copy-artifact": () => showArtifactCopyDialog(state.controlArtifact),
	"open-artifact-child": () => { location.hash = artifactRoute(state.route.project, state.route.repository, target.dataset.digest); },
	"open-accessory-artifact": () => { location.hash = artifactRoute(state.route.project, state.route.repository, target.dataset.digest); },
	"delete-accessory-artifact": () => confirmDeleteAccessoryArtifact(target.dataset.digest, target.dataset.type),
    "create-project": showCreateProjectDialog,
    "project-settings": () => { location.hash = projectRoute(state.route.project, "settings"); },
    "delete-project": confirmDeleteProject,
    "add-project-member": showAddMemberDialog,
    "edit-project-member": () => showEditMemberDialog(target.dataset.memberId),
    "delete-project-member": () => confirmDeleteMember(target.dataset.memberId, target.dataset.memberName),
    "create-project-robot": () => showRobotDialog(),
    "edit-project-robot": () => showRobotDialog(findControlItem(state.controlProjectItems, target.dataset.id)),
    "reset-robot-secret": () => resetRobotSecret(target.dataset.id, target.dataset.name),
    "delete-project-robot": () => confirmDeleteRobot(target.dataset.id, target.dataset.name),
	    "create-webhook": () => showWebhookDialog(),
	    "view-webhook-history": () => showWebhookHistoryDialog(target.dataset.id, target.dataset.name),
	    "webhook-history-page": () => loadWebhookExecutions(toNumber(target.dataset.page)),
	    "view-webhook-execution": () => showWebhookExecutionTasks(target.dataset.id, 1),
	    "webhook-task-page": () => showWebhookExecutionTasks(state.webhookExecutionID, toNumber(target.dataset.page)),
	    "back-webhook-history": () => loadWebhookExecutions(state.webhookHistoryPage || 1),
	    "view-webhook-task-log": () => viewWebhookTaskLog(target.dataset.taskId, target),
	    "refresh-webhook-task-log": refreshWebhookTaskLog,
	    "copy-webhook-task-log": () => copyControlValue(state.webhookTaskLog),
	    "download-webhook-task-log": downloadWebhookTaskLog,
	    "hide-webhook-task-log": () => { const view = document.querySelector("#webhook-log-view"); if (view) view.hidden = true; },
    "edit-webhook": () => showWebhookDialog(findControlItem(state.controlProjectItems, target.dataset.id)),
    "delete-webhook": () => confirmDeleteWebhook(target.dataset.id, target.dataset.name),
    "create-immutable-rule": () => showImmutableRuleDialog(),
    "edit-immutable-rule": () => showImmutableRuleDialog(findControlItem(state.controlProjectItems, target.dataset.id)),
    "delete-immutable-rule": () => confirmDeleteImmutableRule(target.dataset.id),
    "create-project-label": () => showProjectLabelDialog(),
    "edit-project-label": () => showProjectLabelDialog(findControlItem(state.controlProjectCollection?.labels, target.dataset.id)),
    "delete-project-label": () => confirmDeleteProjectLabel(target.dataset.id, target.dataset.name),
    "create-retention-policy": showCreateRetentionPolicyDialog,
    "edit-retention-schedule": showRetentionScheduleDialog,
    "add-retention-rule": () => showRetentionRuleDialog(),
    "edit-retention-rule": () => showRetentionRuleDialog(toNumber(target.dataset.index)),
    "delete-retention-rule": () => confirmDeleteRetentionRule(toNumber(target.dataset.index)),
    "delete-retention-policy": confirmDeleteRetentionPolicy,
	    "run-retention": () => confirmRunRetention(target.dataset.dryRun === "true"),
	    "view-retention-execution": () => showRetentionExecutionDialog(target.dataset.policyId, target.dataset.id, 1),
	    "retention-task-page": () => showRetentionExecutionDialog(state.retentionPolicyID, state.retentionExecutionID, toNumber(target.dataset.page)),
	    "view-retention-task-log": () => viewRetentionTaskLog(target.dataset.taskId, target),
	    "refresh-retention-task-log": refreshRetentionTaskLog,
	    "copy-retention-task-log": () => copyControlValue(state.retentionTaskLog),
	    "download-retention-task-log": downloadRetentionTaskLog,
	    "hide-retention-task-log": () => { const view = document.querySelector("#retention-log-view"); if (view) view.hidden = true; },
    "stop-retention-execution": () => stopRetentionExecution(target.dataset.policyId, target.dataset.id),
    "edit-repository": showEditRepositoryDialog,
    "delete-repository": confirmDeleteRepository,
    "scan-artifact": showArtifactScanDialog,
    "stop-artifact-scan": () => confirmStopArtifactScan(target.dataset.scanType),
    "view-artifact-scan-log": () => showArtifactScanLogDialog(target.dataset.report),
    "refresh-artifact-scan-log": refreshArtifactScanLog,
    "copy-artifact-scan-log": () => copyControlValue(state.artifactScanLog),
    "download-artifact-scan-log": downloadArtifactScanLog,
    "set-log-timezone": () => setLogTimezoneMode(target.dataset.timezone),
    "add-artifact-tag": showAddTagDialog,
    "delete-artifact-tag": () => confirmDeleteTag(target.dataset.tag),
    "attach-artifact-label": showAttachArtifactLabelDialog,
    "remove-artifact-label": () => confirmRemoveArtifactLabel(target.dataset.id, target.dataset.name),
    "copy-artifact-addition": copyCurrentArtifactAddition,
    "download-artifact-addition": downloadCurrentArtifactAddition,
    "delete-artifact": confirmDeleteArtifact,
    "copy-value": () => copyControlValue(target.dataset.value),
    "create-replication-policy": () => showPolicyDialog(),
    "edit-replication-policy": () => showPolicyDialog(findControlItem(state.controlPolicies, target.dataset.id)),
    "delete-replication-policy": () => confirmDeletePolicy(target.dataset.id, target.dataset.name),
    "run-replication-policy": () => runReplicationPolicy(target.dataset.id),
    "view-replication-execution": () => showReplicationExecutionDialog(target.dataset.id),
    "view-replication-task-log": () => viewReplicationTaskLog(target.dataset.executionId, target.dataset.taskId, target),
    "refresh-replication-task-log": refreshReplicationTaskLog,
    "copy-replication-task-log": () => copyControlValue(state.replicationTaskLog),
    "download-replication-task-log": downloadReplicationTaskLog,
    "hide-replication-log": () => { const view = document.querySelector("#replication-log-view"); if (view) view.hidden = true; },
    "stop-replication-execution": () => stopReplicationExecution(target.dataset.id),
    "create-registry": () => showRegistryDialog(),
    "edit-registry": () => showRegistryDialog(findControlItem(state.controlRegistries, target.dataset.id)),
    "delete-registry": () => confirmDeleteRegistry(target.dataset.id, target.dataset.name),
    "ping-registry": () => pingRegistry(target.dataset.id),
    "create-preheat-instance": () => showPreheatInstanceDialog(),
    "edit-preheat-instance": () => showPreheatInstanceDialog(asArray(state.controlPreheatInstances).find((item) => item.name === target.dataset.name)),
    "delete-preheat-instance": () => confirmDeletePreheatInstance(target.dataset.name),
    "ping-preheat-instance": () => pingPreheatInstance(target.dataset.id),
    "create-preheat-policy": () => showPreheatPolicyDialog(),
    "edit-preheat-policy": () => showPreheatPolicyDialog(asArray(state.controlProjectItems).find((item) => item.name === target.dataset.name)),
    "delete-preheat-policy": () => confirmDeletePreheatPolicy(target.dataset.name),
    "run-preheat-policy": () => confirmRunPreheatPolicy(target.dataset.name),
    "view-preheat-executions": () => showPreheatExecutionsDialog(target.dataset.name),
    "view-preheat-execution": () => showPreheatExecutionDialog(target.dataset.policy, target.dataset.id),
    "stop-preheat-execution": () => confirmStopPreheatExecution(target.dataset.policy, target.dataset.id),
    "view-preheat-task-log": () => viewPreheatTaskLog(target.dataset.policy, target.dataset.executionId, target.dataset.taskId, target),
    "refresh-preheat-task-log": refreshPreheatTaskLog,
    "copy-preheat-task-log": () => copyControlValue(state.preheatTaskLog),
    "download-preheat-task-log": downloadPreheatTaskLog,
    "hide-preheat-log": () => { const view = document.querySelector("#preheat-log-view"); if (view) view.hidden = true; },
    "create-admin-user": showAdminUserDialog,
	"import-ldap-users": showLDAPImportDialog,
    "edit-admin-user": () => showAdminUserDialog(findAdminItem(state.adminItems, target.dataset.id, "user_id")),
    "toggle-admin-user": () => toggleAdminUser(target.dataset.id, target.dataset.admin === "true"),
    "reset-admin-password": () => showAdminPasswordDialog(target.dataset.id, target.dataset.name),
    "delete-admin-user": () => confirmDeleteAdminUser(target.dataset.id, target.dataset.name),
    "create-user-group": showUserGroupDialog,
    "edit-user-group": () => showUserGroupDialog(findAdminItem(state.adminItems, target.dataset.id)),
    "delete-user-group": () => confirmDeleteUserGroup(target.dataset.id, target.dataset.name),
    "create-system-robot": () => showSystemRobotDialog(),
    "edit-system-robot": () => showSystemRobotDialog(findAdminItem(state.adminItems, target.dataset.id)),
    "delete-system-robot": () => confirmDeleteSystemRobot(target.dataset.id, target.dataset.name),
    "create-global-label": () => showGlobalLabelDialog(),
    "edit-global-label": () => showGlobalLabelDialog(findAdminItem(state.adminItems, target.dataset.id)),
    "delete-global-label": () => confirmDeleteGlobalLabel(target.dataset.id, target.dataset.name),
    "edit-quota": () => showQuotaDialog(findAdminItem(state.adminItems, target.dataset.id)),
    "create-scanner": showScannerDialog,
	"view-scanner-metadata": () => showScannerMetadataDialog(target.dataset.id),
    "edit-scanner": () => showScannerDialog(findAdminItem(state.scannerItems, target.dataset.id, "uuid")),
    "ping-scanner": () => pingScanner(target.dataset.id),
    "default-scanner": () => setDefaultScanner(target.dataset.id),
    "delete-scanner": () => confirmDeleteScanner(target.dataset.id, target.dataset.name),
    "run-gc": runGarbageCollection,
    "stop-gc": () => stopGarbageCollection(target.dataset.id),
    "view-gc-log": () => showGarbageCollectionLog(target.dataset.id),
    "refresh-gc-log": refreshGarbageCollectionLog,
    "copy-gc-log": () => copyControlValue(state.gcLog),
    "download-gc-log": downloadGarbageCollectionLog,
	    "edit-gc-schedule": () => showScheduleDialog("gc"),
	    "run-purge": runAuditPurge,
	    "edit-purge-schedule": showAuditPurgeScheduleDialog,
	    "stop-purge": () => stopAuditPurge(target.dataset.id),
	    "view-purge-log": () => showAuditPurgeLog(target.dataset.id),
	    "refresh-purge-log": refreshAuditPurgeLog,
	    "copy-purge-log": () => copyControlValue(state.purgeLog),
	    "download-purge-log": downloadAuditPurgeLog,
	    "pause-job-queue": () => updateJobServiceQueue(target.dataset.type, "pause"),
	    "resume-job-queue": () => updateJobServiceQueue(target.dataset.type, "resume"),
	    "stop-job-queue": () => confirmStopJobServiceQueue(target.dataset.type),
	    "pause-all-job-queues": () => updateJobServiceQueue("all", "pause"),
	    "resume-all-job-queues": () => updateJobServiceQueue("all", "resume"),
	    "stop-all-job-queues": () => confirmStopJobServiceQueue("all"),
	    "stop-jobservice-job": () => confirmStopJobServiceJob(target.dataset.job),
	    "view-jobservice-log": () => showJobServiceLog(target.dataset.job),
	    "refresh-jobservice-log": refreshJobServiceLog,
	    "copy-jobservice-log": () => copyControlValue(state.jobServiceLog),
	    "download-jobservice-log": downloadJobServiceLog,
    "run-scan-all": runScanAll,
    "stop-scan-all": stopScanAll,
    "edit-scan-schedule": () => showScheduleDialog("scan"),
    "close-control-dialog": closeControlDialog,
    "show-create-unavailable": () => {
      if (state.currentView === "projects") showCreateProjectDialog();
      else if (state.currentView === "replication") showPolicyDialog();
      else if (state.currentView === "registries") showRegistryDialog();
    },
	};
	if (!handlers[action]) return false;
	if (!["select-artifact", "select-all-artifacts", "select-project", "select-all-projects", "select-repository", "select-all-repositories"].includes(action)) event?.preventDefault();
	event?.stopPropagation();
  handlers[action]();
  return true;
}

function findControlItem(items, id) {
  return asArray(items).find((item) => String(item.id) === String(id));
}

function selectedArtifactItems() {
	const selection = state.artifactSelection || new Set();
	return asArray(state.controlArtifacts).filter((artifactItem) => selection.has(artifactItem.digest));
}

function toggleArtifactSelection(target) {
	if (!state.artifactSelection) state.artifactSelection = new Set();
	if (target.checked) state.artifactSelection.add(target.dataset.digest);
	else state.artifactSelection.delete(target.dataset.digest);
	target.closest("tr")?.classList.toggle("selected-row", target.checked);
	updateArtifactBatchToolbar();
}

function toggleAllArtifactSelection(target) {
	if (!state.artifactSelection) state.artifactSelection = new Set();
	asArray(state.controlArtifacts).forEach((artifactItem) => {
	  if (target.checked) state.artifactSelection.add(artifactItem.digest);
	  else state.artifactSelection.delete(artifactItem.digest);
	});
	document.querySelectorAll('[data-action="select-artifact"]').forEach((checkbox) => {
	  checkbox.checked = target.checked;
	  checkbox.closest("tr")?.classList.toggle("selected-row", target.checked);
	});
	updateArtifactBatchToolbar();
}

function updateArtifactBatchToolbar() {
	const count = selectedArtifactItems().length;
	const output = document.querySelector("#artifact-selection-count");
	if (output) output.textContent = formatNumber(count);
	document.querySelectorAll(".artifact-batch-toolbar button").forEach((button) => {
	  button.disabled = count === 0 || (button.dataset.action === "copy-selected-artifact" && count !== 1);
	});
	const all = asArray(state.controlArtifacts);
	const selectAll = document.querySelector('[data-action="select-all-artifacts"]');
	if (selectAll) {
	  const selectedVisible = all.filter((artifactItem) => state.artifactSelection?.has(artifactItem.digest)).length;
	  selectAll.checked = all.length > 0 && selectedVisible === all.length;
	  selectAll.indeterminate = selectedVisible > 0 && selectedVisible < all.length;
	}
	applyPermissionControls(mainContent);
}

function setArtifactBatchBusy(busy) {
	document.querySelectorAll(".artifact-batch-toolbar button, .artifact-select-table input").forEach((control) => { control.disabled = busy; });
}

async function runArtifactBatch(title, worker) {
		const items = selectedArtifactItems();
		if (!items.length) return;
		const route = { ...state.route };
		setArtifactBatchBusy(true);
		const result = await runTrackedBatch({
		  kind: "artifact-batch",
		  title,
		  detail: `${route.project}/${repositoryDisplayName(route.project, route.repository)}`,
		  items,
		  label: (artifactItem) => asArray(artifactItem.tags)[0]?.name || shortDigest(artifactItem.digest),
		  worker: async (artifactItem) => {
			await worker(artifactItem);
			state.artifactSelection.delete(artifactItem.digest);
		  },
		});
		const stillHere = state.currentView === "repository" && state.route.project === route.project && state.route.repository === route.repository;
		if (stillHere) await renderCurrentView(true);
		const failures = result.failures.map((failure) => ({ artifact: failure.item, message: failure.message }));
		if (failures.length && stillHere) showArtifactBatchResults(title, result.succeeded, failures);
		else showToast(failures.length ? `${title}完成，${failures.length} 项失败` : `${title}已提交，共 ${formatNumber(items.length)} 个制品`, failures.length > 0);
}

function showArtifactBatchResults(title, succeeded, failures) {
	openControlDialog({
	  title: `${title}部分失败`,
	  subtitle: `成功 ${succeeded} 项，失败 ${failures.length} 项`,
	  submitLabel: "关闭",
	  hideCancel: true,
	  content: `<div class="batch-result-list">${failures.map(({ artifact, message }) => `<div><code>${escapeHTML(asArray(artifact.tags)[0]?.name || shortDigest(artifact.digest))}</code><span>${escapeHTML(message)}</span></div>`).join("")}</div>`,
	  onSubmit: async () => closeControlDialog(),
	});
}

function runArtifactScanBatch(scanType) {
	const label = scanType === "sbom" ? "SBOM 生成" : "漏洞扫描";
	return runArtifactBatch(label, (artifactItem) => controlMutation("artifact-scan", { project: state.route.project, repository: state.route.repository, reference: artifactItem.digest }, "POST", { scan_type: scanType }));
}

function runArtifactStopBatch() {
	return runArtifactBatch("停止扫描任务", async (artifactItem) => {
	  const types = ["vulnerability", "sbom"].filter((scanType) => artifactScanCanStop(artifactScanState(artifactItem, scanType).status));
	  if (!types.length) throw new Error("该制品没有可停止的扫描或 SBOM 任务");
	  await Promise.all(types.map((scanType) => controlMutation("artifact-scan-stop", { project: state.route.project, repository: state.route.repository, reference: artifactItem.digest }, "POST", { scan_type: scanType })));
	});
}

function showBatchAttachLabelDialog() {
	const items = selectedArtifactItems();
	if (!items.length) return;
	const labels = asArray(state.controlArtifactFilterLabels);
	if (!labels.length) {
	  showToast("当前项目没有可用标签", true);
	  return;
	}
	openControlDialog({
	  title: "批量添加标签",
	  subtitle: `将标签添加到 ${items.length} 个制品`,
	  submitLabel: "添加标签",
	  content: `<label class="field"><span>标签</span><select name="label_id" required>${labels.map((label) => `<option value="${escapeAttr(label.id)}">${escapeHTML(label.name)}（${label.scope === "g" ? "全局" : "项目"}）</option>`).join("")}</select></label>`,
	  onSubmit: async (formData) => {
		const id = Number(formData.get("label_id"));
		closeControlDialog();
		await runArtifactBatch("添加标签", async (artifactItem) => {
		  if (asArray(artifactItem.labels).some((label) => Number(label.id) === id)) return;
		  await controlMutation("artifact-labels", { project: state.route.project, repository: state.route.repository, reference: artifactItem.digest }, "POST", { id });
		});
	  },
	});
}

function showBatchRemoveLabelDialog() {
	const items = selectedArtifactItems();
	const labels = [];
	const seen = new Set();
	items.flatMap((artifactItem) => asArray(artifactItem.labels)).forEach((label) => {
	  if (!seen.has(String(label.id))) { seen.add(String(label.id)); labels.push(label); }
	});
	if (!labels.length) {
	  showToast("所选制品没有可移除的标签", true);
	  return;
	}
	openControlDialog({
	  title: "批量移除标签",
	  subtitle: `从 ${items.length} 个制品中移除指定标签`,
	  submitLabel: "移除标签",
	  destructive: true,
	  content: `<label class="field"><span>标签</span><select name="label_id" required>${labels.map((label) => `<option value="${escapeAttr(label.id)}">${escapeHTML(label.name)}</option>`).join("")}</select></label>`,
	  onSubmit: async (formData) => {
		const id = Number(formData.get("label_id"));
		closeControlDialog();
		await runArtifactBatch("移除标签", async (artifactItem) => {
		  if (!asArray(artifactItem.labels).some((label) => Number(label.id) === id)) return;
		  await controlMutation("artifact-label", { project: state.route.project, repository: state.route.repository, reference: artifactItem.digest, label: id }, "DELETE");
		});
	  },
	});
}

function showBatchDeleteArtifactsDialog() {
	const items = selectedArtifactItems();
	if (!items.length) return;
	const confirmation = `DELETE ${items.length}`;
	openControlDialog({
	  title: "批量删除制品",
	  subtitle: `将永久删除 ${items.length} 个制品及其全部 Tag`,
	  submitLabel: "永久删除",
	  destructive: true,
	  content: `<div class="destructive-message">${icon("alert")}<span>此操作无法撤销。请输入 <code>${escapeHTML(confirmation)}</code> 确认。</span></div><label class="field"><span>确认文本</span><input name="confirmation" required autocomplete="off"></label>`,
	  onSubmit: async (formData) => {
		if (String(formData.get("confirmation") || "").trim() !== confirmation) throw new Error(`请输入 ${confirmation} 确认`);
		closeControlDialog();
		await runArtifactBatch("删除制品", (artifactItem) => controlMutation("artifact", { project: state.route.project, repository: state.route.repository, reference: artifactItem.digest }, "DELETE"));
	  },
	});
}

function showArtifactCopyDialog(artifactItem) {
	if (!artifactItem) return;
	const route = state.route || parseConsoleRoute();
	const source = `${fullRepositoryName(route.project, route.repository)}@${artifactItem.digest}`;
	openControlDialog({
	  title: "复制制品",
	  subtitle: asArray(artifactItem.tags)[0]?.name || shortDigest(artifactItem.digest),
	  submitLabel: "开始复制",
	  content: `<div class="form-grid two-columns"><label class="field"><span>目标项目</span><input name="project" required maxlength="255" pattern="[a-z0-9]+([._-][a-z0-9]+)*" value="${escapeAttr(route.project)}"></label><label class="field"><span>目标仓库</span><input name="repository" required maxlength="255" pattern="[a-z0-9]+([/._-][a-z0-9]+)*" value="${escapeAttr(repositoryDisplayName(route.project, route.repository))}"></label><label class="field field-span"><span>复制源</span><input value="${escapeAttr(source)}" readonly class="mono"></label></div>`,
	  onSubmit: async (formData) => {
		const project = String(formData.get("project") || "").trim();
		const repository = String(formData.get("repository") || "").trim();
		await controlMutation("artifact-copy", { project, repository, from: source }, "POST");
		closeControlDialog();
		state.artifactSelection?.clear();
		showToast("制品复制已完成");
		location.hash = repositoryRoute(project, repository);
	  },
	});
}

function confirmDeleteAccessoryArtifact(digest, type) {
	confirmControlDelete("删除关联制品", `${accessoryTypeLabel(type)} ${shortDigest(digest)} 将从当前仓库永久删除。`, "删除关联制品", async () => {
	  await controlMutation("artifact", { project: state.route.project, repository: state.route.repository, reference: digest }, "DELETE");
	  showToast("关联制品已删除");
	  renderCurrentView(true);
	}, digest);
}

async function copyControlValue(value) {
  try {
    await navigator.clipboard.writeText(value || "");
    showToast("已复制到剪贴板");
  } catch {
    showToast("浏览器未允许复制，请手动选择内容。", true);
  }
}

function logTimezoneMode() {
  return state.logTimezoneMode === "utc" ? "utc" : "local";
}

function logTimezoneControl() {
  const mode = logTimezoneMode();
  return `<div class="log-timezone-control" role="group" aria-label="日志时区"><button type="button" data-action="set-log-timezone" data-timezone="local" class="${mode === "local" ? "active" : ""}" aria-pressed="${mode === "local"}">本地</button><button type="button" data-action="set-log-timezone" data-timezone="utc" class="${mode === "utc" ? "active" : ""}" aria-pressed="${mode === "utc"}">UTC</button></div>`;
}

function parseHarborLogLine(value) {
  const line = String(value ?? "");
  const match = line.match(/^(\d{4}-\d{2}-\d{2}[T ][0-9:.+-]+Z?)\s+\[?(TRACE|DEBUG|INFO|WARN|WARNING|ERROR|FATAL)\]?\s*(.*)$/i);
  if (!match) return { time: "", level: "LOG", content: line };
  return { time: match[1], level: match[2].toUpperCase() === "WARNING" ? "WARN" : match[2].toUpperCase(), content: match[3] };
}

function displayLogTime(value) {
  if (!value || logTimezoneMode() === "utc") return value || "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(currentLocale(), { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(date).replaceAll("/", "-");
}

function renderHarborLog(value, emptyMessage = "没有日志内容。") {
  const text = String(value ?? "").replace(/\r\n?/g, "\n");
  const lines = text.split("\n");
  if (lines.at(-1) === "") lines.pop();
  if (!lines.length) return `<div class="structured-log-empty">${escapeHTML(emptyMessage)}</div>`;
  return '<div class="structured-log-header"><span>时间</span><span>等级</span><span>日志内容</span></div>' + lines.map((line) => {
    const parsed = parseHarborLogLine(line);
    const level = ["TRACE", "DEBUG", "INFO", "WARN", "ERROR", "FATAL"].includes(parsed.level) ? parsed.level : "LOG";
    return `<div class="structured-log-row log-level-${level.toLowerCase()}"><time>${escapeHTML(displayLogTime(parsed.time))}</time><span class="structured-log-level">${escapeHTML(level)}</span><span class="structured-log-message">${escapeHTML(parsed.content || " ")}</span></div>`;
  }).join("");
}

function setHarborLogContent(output, value, emptyMessage) {
  if (output) output.innerHTML = renderHarborLog(value, emptyMessage);
}

function refreshVisibleLogRendering() {
  setHarborLogContent(document.querySelector("#artifact-scan-log"), state.artifactScanLog, "扫描器没有返回日志内容。");
  setHarborLogContent(document.querySelector("#gc-log-content"), state.gcLog, "Harbor 没有返回日志内容。");
  setHarborLogContent(document.querySelector("#replication-log-content"), state.replicationTaskLog, "Harbor 没有返回复制任务日志。");
	  setHarborLogContent(document.querySelector("#preheat-log-content"), state.preheatTaskLog, "Harbor 没有返回预热任务日志。");
	  setHarborLogContent(document.querySelector("#webhook-log-content"), state.webhookTaskLog, "Harbor 没有返回 Webhook 任务日志。");
	  setHarborLogContent(document.querySelector("#retention-log-content"), state.retentionTaskLog, "Harbor 没有返回 Tag 保留任务日志。");
	  setHarborLogContent(document.querySelector("#purge-log-content"), state.purgeLog, "Harbor 没有返回审计清理日志。");
	  setHarborLogContent(document.querySelector("#jobservice-log-content"), state.jobServiceLog, "Harbor 没有返回 Job Service 任务日志。");
  document.querySelectorAll(".log-timezone-control button").forEach((button) => {
    const active = button.dataset.timezone === logTimezoneMode();
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function setLogTimezoneMode(mode) {
  state.logTimezoneMode = mode === "utc" ? "utc" : "local";
  refreshVisibleLogRendering();
}

function downloadControlLog(value, filename, emptyMessage, successMessage) {
  const text = String(value || "");
  if (!text) {
    showToast(emptyMessage, true);
    return;
  }
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  showToast(successMessage);
}

let controlDialogCleanup = null;

function openControlDialog({ title, subtitle = "", content, submitLabel = "保存", submitIcon = "", destructive = false, hideCancel = false, dialogClass = "", onSubmit }) {
  closeControlDialog();
  const backdrop = document.createElement("div");
  backdrop.id = "control-dialog";
  backdrop.className = "dialog-backdrop control-dialog-backdrop";
  const safeDialogClass = /^[a-z0-9 _-]*$/i.test(dialogClass) ? dialogClass.trim() : "";
  backdrop.innerHTML = `<section class="control-dialog${safeDialogClass ? ` ${safeDialogClass}` : ""}" role="dialog" aria-modal="true" aria-labelledby="control-dialog-title"><form id="control-dialog-form"><header><div><h2 id="control-dialog-title">${escapeHTML(title)}</h2>${subtitle ? `<p>${escapeHTML(subtitle)}</p>` : ""}</div><button class="icon-button" type="button" data-action="close-control-dialog" aria-label="关闭">${icon("x")}</button></header><div class="control-dialog-body">${content}</div><footer>${hideCancel ? "" : '<button class="button button-small" type="button" data-action="close-control-dialog">取消</button>'}<button class="button button-small ${destructive ? "button-danger" : "button-primary"}" type="submit">${icon(submitIcon || (destructive ? "trash" : "check"))}<span>${escapeHTML(submitLabel)}</span></button></footer></form></section>`;
  document.body.append(backdrop);
  lockPageScroll("control-dialog");
  const form = backdrop.querySelector("form");
  const submit = form.querySelector('button[type="submit"]');
  const listener = async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    setButtonBusy(submit, true, "正在提交");
    try {
      await onSubmit(new FormData(form), form);
    } catch (error) {
      showDialogError(form, error.message);
      setButtonBusy(submit, false);
    }
  };
  form.addEventListener("submit", listener);
  backdrop.addEventListener("mousedown", (event) => {
    if (event.target === backdrop) closeControlDialog();
  });
  controlDialogCleanup = () => form.removeEventListener("submit", listener);
  window.setTimeout(() => form.querySelector("input,select,textarea")?.focus(), 20);
}

function closeControlDialog() {
  controlDialogCleanup?.();
  controlDialogCleanup = null;
  document.querySelector("#control-dialog")?.remove();
  unlockPageScroll("control-dialog");
}

function showDialogError(form, message) {
  let error = form.querySelector(".control-dialog-error");
  if (!error) {
    error = document.createElement("div");
    error.className = "control-dialog-error";
    form.querySelector(".control-dialog-body").prepend(error);
  }
  error.textContent = message;
}

function setButtonBusy(button, busy, label = "正在处理") {
  if (!button) return;
  if (busy) {
    button.dataset.original = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `<span class="spinner button-spinner"></span><span>${escapeHTML(label)}</span>`;
  } else {
    button.disabled = false;
    if (button.dataset.original) button.innerHTML = button.dataset.original;
  }
}

const proxyCacheRegistryTypes = new Set(["docker-hub", "harbor", "azure-acr", "ali-acr", "aws-ecr", "google-gcr", "quay", "docker-registry", "github-ghcr", "jfrog-artifactory"]);

async function loadProxyCacheRegistries() {
  const registries = [];
  for (let page = 1; page <= 100; page += 1) {
    const result = await controlList("registries", { page, page_size: 100, sort: "name" });
    registries.push(...result.items.filter((registry) => proxyCacheRegistryTypes.has(String(registry.type || ""))));
    if ((page * 100) >= result.pagination.total || result.items.length < 100) break;
  }
  return registries;
}

function projectQuotaDefault(configuration) {
  const bytes = toNumber(adminConfigValue(asObject(configuration), "storage_per_project"));
  if (bytes < 0) return { value: -1, unit: "GiB" };
  const units = [[1024 ** 4, "TiB"], [1024 ** 3, "GiB"], [1024 ** 2, "MiB"]];
  const exact = units.find(([multiplier]) => bytes >= multiplier && Number.isInteger(bytes / multiplier));
  const [multiplier, unit] = exact || units[1];
  return { value: bytes > 0 ? Math.max(1, Math.round(bytes / multiplier)) : -1, unit };
}

function projectQuotaBytes(value, unit) {
  const amount = Number(value);
  if (!Number.isInteger(amount) || (amount !== -1 && amount <= 0)) throw new Error("项目配额必须是 -1 或正整数");
  if (amount === -1) return -1;
  const multiplier = { MiB: 1024 ** 2, GiB: 1024 ** 3, TiB: 1024 ** 4 }[unit];
  const bytes = amount * multiplier;
  if (!Number.isSafeInteger(bytes) || bytes > 1024 * 1024 ** 4) throw new Error("项目配额不能超过 1024 TiB");
  return bytes;
}

function proxyLimitValue(value, label) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || (parsed !== -1 && parsed <= 0)) throw new Error(`${label}必须是 -1 或正整数`);
  return parsed;
}

async function showCreateProjectDialog() {
  const [registriesResult, configurationResult] = await Promise.allSettled([
    loadProxyCacheRegistries(),
    controlData("configurations"),
  ]);
  const registries = registriesResult.status === "fulfilled" ? registriesResult.value : [];
  const quota = projectQuotaDefault(configurationResult.status === "fulfilled" ? configurationResult.value : {});
  const registryOptions = registries.map((registry) => `<option value="${escapeAttr(registry.id)}" data-url="${escapeAttr(registry.url || "")}">${escapeHTML(registry.name)} · ${escapeHTML(registryTypeLabel(registry.type))}</option>`).join("");
  openControlDialog({
    title: "新建项目",
    subtitle: "名称、项目配额与镜像代理均使用 Harbor 官方项目 API",
    submitLabel: "创建项目",
    dialogClass: "control-dialog-large create-project-dialog",
	    content: `<div class="form-grid two-columns create-project-form"><label class="field field-span"><span>项目名称</span><input name="project_name" required maxlength="255" pattern="[a-z0-9]+([._-][a-z0-9]+)*" placeholder="例如 platform-services" autocomplete="off"></label><label class="check-row create-project-public"><input name="public" type="checkbox"><span><strong>公开项目</strong><small>允许未登录用户拉取制品</small></span></label><label class="field create-project-quota"><span>项目配额限制</span><div class="compound-input"><input name="storage_limit" type="number" step="1" required value="${escapeAttr(quota.value)}" aria-label="项目配额数值"><select name="storage_unit" aria-label="项目配额单位"><option value="MiB" ${quota.unit === "MiB" ? "selected" : ""}>MiB</option><option value="GiB" ${quota.unit === "GiB" ? "selected" : ""}>GiB</option><option value="TiB" ${quota.unit === "TiB" ? "selected" : ""}>TiB</option></select></div><small class="field-help">输入 -1 表示不限制，最大 1024 TiB。</small></label><label class="check-row"><input name="auto_scan" type="checkbox"><span><strong>自动扫描</strong><small>默认关闭；推送后执行漏洞扫描</small></span></label><label class="check-row"><input name="auto_sbom" type="checkbox"><span><strong>自动生成 SBOM</strong><small>推送制品后生成软件物料清单</small></span></label><div class="field field-span create-project-type"><label class="check-row"><input name="proxy_cache" type="checkbox" ${registries.length ? "" : "disabled"}><span><strong>镜像代理项目</strong><small>缓存远端仓库中的制品；项目创建后不能切换为普通项目</small></span></label></div>${registriesResult.status === "rejected" ? `<div class="warning-banner field-span">${icon("alert")}<span>远端仓库载入失败，当前只能创建普通项目：${escapeHTML(registriesResult.reason.message)}</span></div>` : !registries.length ? `<div class="warning-banner field-span">${icon("alert")}<span>没有可用于镜像代理的远端仓库，请先到镜像仓库页面添加连接。</span></div>` : ""}<section class="proxy-project-fields field-span" data-proxy-project-fields hidden><div class="section-heading compact-heading"><div><h3>镜像代理设置</h3></div></div><div class="form-grid two-columns"><label class="field"><span>远端仓库</span><select name="registry_id" data-proxy-control required disabled><option value="">请选择远端仓库</option>${registryOptions}</select></label><label class="field"><span>远端地址</span><input name="proxy_endpoint" readonly value="" placeholder="选择远端仓库后显示"></label><label class="field"><span>上游带宽限制</span><div class="compound-input"><input name="proxy_speed" type="number" step="1" value="-1" required data-proxy-control disabled><select name="proxy_speed_unit" data-proxy-control disabled><option value="Kbps">Kbps</option><option value="Mbps">Mbps</option></select></div><small class="field-help">输入 -1 表示不限制上游拉取带宽。</small></label><label class="field"><span>上游最大连接数</span><input name="max_upstream_conn" type="number" step="1" value="-1" required data-proxy-control disabled><small class="field-help">输入 -1 表示不限制连接数。</small></label><label class="check-row field-span"><input name="proxy_cache_local_on_not_found" type="checkbox" data-proxy-control disabled><span><strong>上游未找到时使用本地制品</strong><small>远端返回未找到时，允许继续从本项目的本地缓存读取。</small></span></label></div></section></div>`,
    onSubmit: async (formData) => {
      const name = String(formData.get("project_name") || "").trim();
      const proxyCache = formData.has("proxy_cache");
      const metadata = { public: String(formData.has("public")), auto_scan: String(formData.has("auto_scan")), auto_sbom_generation: String(formData.has("auto_sbom")), prevent_vul: "false", severity: "critical" };
      let registryID = null;
      if (proxyCache) {
        registryID = Number(formData.get("registry_id"));
        if (!Number.isInteger(registryID) || registryID <= 0) throw new Error("镜像代理项目必须选择远端仓库");
        const speed = proxyLimitValue(formData.get("proxy_speed"), "上游带宽限制");
        const speedKbps = speed === -1 ? -1 : speed * (formData.get("proxy_speed_unit") === "Mbps" ? 1024 : 1);
        if (!Number.isSafeInteger(speedKbps) || speedKbps > 2147483647) throw new Error("上游带宽限制超出 Harbor 支持范围");
        metadata.proxy_speed_kb = String(speedKbps);
        metadata.max_upstream_conn = String(proxyLimitValue(formData.get("max_upstream_conn"), "上游最大连接数"));
        metadata.proxy_cache_local_on_not_found = String(formData.has("proxy_cache_local_on_not_found"));
      }
      await controlMutation("projects", {}, "POST", { project_name: name, metadata, storage_limit: projectQuotaBytes(formData.get("storage_limit"), String(formData.get("storage_unit"))), registry_id: registryID });
      closeControlDialog();
      showToast(`项目 ${name} 已创建`);
      location.hash = projectRoute(name);
    },
  });
  const form = document.querySelector("#control-dialog-form");
  const proxyToggle = form?.elements.namedItem("proxy_cache");
  const proxyFields = form?.querySelector("[data-proxy-project-fields]");
  const registrySelect = form?.elements.namedItem("registry_id");
  const endpoint = form?.elements.namedItem("proxy_endpoint");
  const syncProxyFields = () => {
    const enabled = Boolean(proxyToggle?.checked);
    if (proxyFields) proxyFields.hidden = !enabled;
    form?.querySelectorAll("[data-proxy-control]").forEach((control) => { control.disabled = !enabled; });
    if (!enabled && registrySelect) registrySelect.value = "";
    if (endpoint) endpoint.value = enabled ? (registrySelect?.selectedOptions[0]?.dataset.url || "") : "";
  };
  proxyToggle?.addEventListener("change", syncProxyFields);
  registrySelect?.addEventListener("change", syncProxyFields);
  syncProxyFields();
}

function showAddMemberDialog() {
  state.memberGroupCandidates = [];
	state.memberUserCandidates = [];
	state.memberDirectoryRequest = 0;
  openControlDialog({
    title: "添加项目成员",
    subtitle: state.route.project,
    submitLabel: "添加成员",
    dialogClass: "control-dialog-large",
    content: `<div class="member-type-switch" role="group" aria-label="成员类型"><label><input name="member_type" type="radio" value="user" checked><span>${icon("users")}<b>Harbor 用户</b><small>从目录搜索并选择用户账号</small></span></label><label><input name="member_type" type="radio" value="group"><span>${icon("users")}<b>用户组</b><small>从身份目录选择用户组</small></span></label></div><div class="member-directory-panel" data-member-panel="user"><div class="directory-search"><label class="field"><span>Harbor 用户名</span><input id="member-user-query" type="search" maxlength="255" autocomplete="off" placeholder="搜索用户"></label><button id="member-user-search" class="button button-small" type="button">${icon("search")}<span>搜索目录</span></button></div><div id="member-user-results" class="directory-results"><div class="directory-state compact">${icon("search")}<div><strong>搜索可用用户</strong><span>结果来自 Harbor 官方目录接口。</span></div></div></div></div><div class="member-directory-panel" data-member-panel="group" hidden><div class="directory-search"><label class="field"><span>用户组名称</span><input id="member-group-query" type="search" maxlength="255" autocomplete="off" placeholder="搜索用户组"></label><button id="member-group-search" class="button button-small" type="button">${icon("search")}<span>搜索目录</span></button></div><div id="member-group-results" class="directory-results"><div class="directory-state compact">${icon("search")}<div><strong>搜索可用用户组</strong><span>结果来自 Harbor 官方目录接口。</span></div></div></div></div><label class="field member-role-field"><span>项目角色</span><select name="role_id">${roleOptions(2)}</select></label>`,
    onSubmit: async (formData, form) => {
      const roleID = Number(formData.get("role_id"));
      const memberType = String(formData.get("member_type") || "user");
      let payload;
      if (memberType === "group") {
        const selected = form.querySelector('[name="member_group_index"]:checked');
        const group = state.memberGroupCandidates?.[Number(selected?.value)];
        if (!group) throw new Error("请选择一个用户组");
        payload = { role_id: roleID, member_group: { group_name: String(group.group_name || ""), group_type: Number(group.group_type || 1), ldap_group_dn: String(group.ldap_group_dn || "") } };
      } else {
		const selected = form.querySelector('[name="member_user_index"]:checked');
		const user = state.memberUserCandidates?.[Number(selected?.value)];
		if (!user) throw new Error("请选择一个 Harbor 用户");
		payload = { role_id: roleID, member_user: { username: String(user.username || "").trim() } };
      }
      await controlMutation("project-members", { project: state.route.project }, "POST", payload);
      closeControlDialog();
      showToast("项目成员已添加");
      renderCurrentView(true);
    },
  });
  const form = document.querySelector("#control-dialog-form");
  const syncType = () => {
    const type = String(new FormData(form).get("member_type") || "user");
    form.querySelectorAll("[data-member-panel]").forEach((panel) => { panel.hidden = panel.dataset.memberPanel !== type; });
  };
  form?.querySelectorAll('[name="member_type"]').forEach((input) => input.addEventListener("change", syncType));
	const userInput = form?.querySelector("#member-user-query");
  const groupInput = form?.querySelector("#member-group-query");
	let userTimer;
	let groupTimer;
	const scheduleSearch = (input, search, timerName) => {
		clearTimeout(timerName === "user" ? userTimer : groupTimer);
		const term = String(input?.value || "").trim();
		if (term.length < 1) return;
		const timer = window.setTimeout(() => search(term), 320);
		if (timerName === "user") userTimer = timer;
		else groupTimer = timer;
	};
	const searchUsers = () => loadProjectMemberUsers(String(userInput?.value || "").trim());
	const searchGroups = () => loadProjectMemberGroups(String(groupInput?.value || "").trim());
	form?.querySelector("#member-user-search")?.addEventListener("click", searchUsers);
  form?.querySelector("#member-group-search")?.addEventListener("click", searchGroups);
	userInput?.addEventListener("input", () => scheduleSearch(userInput, loadProjectMemberUsers, "user"));
	groupInput?.addEventListener("input", () => scheduleSearch(groupInput, loadProjectMemberGroups, "group"));
  groupInput?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    searchGroups();
  });
  syncType();
}

function projectMemberAlreadyExists(name) {
	return asArray(state.controlProjectItems).some((member) => String(member.entity_name || "").toLowerCase() === String(name || "").toLowerCase());
}

async function loadProjectMemberUsers(term) {
	const output = document.querySelector("#member-user-results");
	if (!output || !term) return;
	const requestID = ++state.memberDirectoryRequest;
	output.innerHTML = `<div class="dialog-loading"><span class="spinner"></span><span>正在搜索用户...</span></div>`;
	try {
		const result = await controlList("users-search", { username: term, page: 1, page_size: 20 });
		if (requestID !== state.memberDirectoryRequest || !document.body.contains(output)) return;
		state.memberUserCandidates = result.items.filter((user) => !projectMemberAlreadyExists(user.username));
		output.innerHTML = projectMemberUserResults(state.memberUserCandidates);
	} catch (error) {
		if (requestID !== state.memberDirectoryRequest || !document.body.contains(output)) return;
		output.innerHTML = `<div class="directory-state directory-state-error">${icon("alert")}<div><strong>用户搜索失败</strong><span>${escapeHTML(error.message)}</span></div></div>`;
	}
}

async function loadProjectMemberGroups(term) {
  const output = document.querySelector("#member-group-results");
  if (!output) return;
  output.innerHTML = `<div class="dialog-loading"><span class="spinner"></span><span>正在搜索用户组...</span></div>`;
	const requestID = ++state.memberDirectoryRequest;
	try {
    const result = accountAuthMode() === "ldap_auth"
		? await controlList("ldap-groups-search", { groupname: term })
		: await controlList("user-groups-search", { groupname: term, page: 1, page_size: 20 });
	if (requestID !== state.memberDirectoryRequest || !document.body.contains(output)) return;
	state.memberGroupCandidates = result.items.filter((group) => !projectMemberAlreadyExists(group.group_name || group.ldap_group_dn));
    output.innerHTML = projectMemberGroupResults(state.memberGroupCandidates);
  } catch (error) {
	if (requestID !== state.memberDirectoryRequest || !document.body.contains(output)) return;
    output.innerHTML = `<div class="directory-state directory-state-error">${icon("alert")}<div><strong>用户组搜索失败</strong><span>${escapeHTML(error.message)}</span></div></div>`;
  }
}

function projectMemberUserResults(users) {
	if (!users.length) return `<div class="directory-state">${icon("users")}<div><strong>没有可添加的用户</strong><span>调整名称，或该用户已经是项目成员。</span></div></div>`;
	return `<div class="directory-result-head"><span>可用用户</span><span>${formatNumber(users.length)} 个结果</span></div><div class="directory-selection-list">${users.map((user, index) => `<label class="directory-selection-row"><input name="member_user_index" type="radio" value="${index}"><span class="cell-icon">${icon("user")}</span><span class="cell-stack"><strong>${escapeHTML(user.username || "-")}</strong><small>${escapeHTML(user.realname || user.email || "-")}</small></span></label>`).join("")}</div>`;
}

function projectMemberGroupResults(groups) {
  if (!groups.length) return `<div class="directory-state">${icon("users")}<div><strong>没有匹配的用户组</strong><span>调整名称后重新搜索。</span></div></div>`;
  return `<div class="directory-result-head"><span>可用用户组</span><span>${formatNumber(groups.length)} 个结果</span></div><div class="directory-selection-list">${groups.map((group, index) => `<label class="directory-selection-row"><input name="member_group_index" type="radio" value="${index}"><span class="cell-icon">${icon("users")}</span><span class="cell-stack"><strong>${escapeHTML(group.group_name || group.ldap_group_dn || "-")}</strong><small class="mono">${escapeHTML(group.ldap_group_dn || adminGroupType(group.group_type))}</small></span></label>`).join("")}</div>`;
}

function showEditMemberDialog(memberID) {
  const member = findControlItem(state.controlProjectItems, memberID);
  if (!member) return;
  openControlDialog({
    title: "修改成员角色",
    subtitle: member.entity_name,
    submitLabel: "保存角色",
    content: `<label class="field"><span>项目角色</span><select name="role_id">${roleOptions(member.role_id)}</select></label>`,
    onSubmit: async (formData) => {
      await controlMutation("project-member", { project: state.route.project, member: member.id }, "PUT", { role_id: Number(formData.get("role_id")) });
      closeControlDialog();
      showToast("成员角色已更新");
      renderCurrentView(true);
    },
  });
}

function roleOptions(selected) {
  return [[1, "项目管理员"], [4, "维护者"], [2, "开发者"], [3, "访客"]].map(([value, label]) => `<option value="${value}" ${toNumber(selected) === value ? "selected" : ""}>${label}</option>`).join("");
}

function confirmDeleteMember(memberID, name) {
  confirmControlDelete("删除项目成员", `将从项目 ${state.route.project} 中移除 ${name}。`, "删除成员", async () => {
    await controlMutation("project-member", { project: state.route.project, member: memberID }, "DELETE");
    showToast("项目成员已删除");
    renderCurrentView(true);
  });
}

function showRobotDialog(robot = null) {
  const currentName = robot ? String(robot.name || "").split("+").slice(1).join("+") : "";
  const metadata = asObject(state.controlProjectCollection?.permissionMetadata);
  const candidates = asArray(metadata.project);
  const currentPermission = asArray(robot?.permissions).find((permission) => permission.kind === "project" && permission.namespace === state.route.project);
  const selectedAccess = robot ? asArray(currentPermission?.access) : candidates.filter((permission) => ["repository|pull", "repository|read", "artifact|read", "artifact|list", "tag|list"].includes(`${permission.resource}|${permission.action}`));
  openControlDialog({
    title: robot ? "编辑机器人账号" : "新建机器人账号",
    subtitle: state.route.project,
    submitLabel: robot ? "保存账号" : "创建账号",
    content: `<div class="form-grid two-columns"><label class="field"><span>账号名称</span><input name="name" required maxlength="255" value="${escapeAttr(currentName)}" ${robot ? "disabled" : ""} autocomplete="off" placeholder="例如 ci-release"></label>${robotDurationControl(robot?.duration)}<label class="field field-span"><span>描述</span><input name="description" maxlength="1024" value="${escapeAttr(robot?.description || "")}"></label><label class="check-row field-span"><input name="disable" type="checkbox" ${robot?.disable ? "checked" : ""}><span><strong>停用账号</strong><small>保留配置但禁止认证</small></span></label></div>${permissionMatrix(candidates, selectedAccess, "project_access", "项目权限")}`,
    onSubmit: async (formData) => {
      const access = permissionAccessFromForm(formData, "project_access");
      validateRobotAccess(access);
      const payload = {
        name: robot?.name || String(formData.get("name") || "").trim(),
        description: String(formData.get("description") || "").trim(),
        level: "project",
        duration: robotDurationFromForm(formData),
        disable: formData.has("disable"),
        permissions: [{ kind: "project", namespace: state.route.project, access }],
      };
      const result = await controlMutation(robot ? "robot" : "robots", robot ? { id: robot.id } : {}, robot ? "PUT" : "POST", payload);
      closeControlDialog();
      if (!robot && result?.data?.secret) showRobotSecret(result.data);
      else {
        showToast("机器人账号已更新");
        renderCurrentView(true);
      }
    },
  });
  document.querySelector("#control-dialog .control-dialog")?.classList.add("control-dialog-wide");
  bindRobotPermissionBehavior(document.querySelector("#control-dialog-form"));
}

function permissionMatrix(candidates, selected, fieldName, title, compact = false) {
  const selectedKeys = new Set(asArray(selected).map((item) => `${item.resource}|${item.action}`));
  const grouped = new Map();
  asArray(candidates).forEach((permission) => {
    if (!permission?.resource || !permission?.action) return;
    if (!grouped.has(permission.resource)) grouped.set(permission.resource, []);
    grouped.get(permission.resource).push(permission.action);
  });
  if (!grouped.size) return `<div class="warning-banner">${icon("alert")}<span>Harbor 未返回可分配的权限元数据。</span></div>`;
  return `<fieldset class="permission-matrix ${compact ? "permission-matrix-compact" : ""}"><legend>${escapeHTML(title)}</legend><div class="permission-matrix-toolbar"><span>${formatNumber(asArray(candidates).length)} 项官方权限</span><button class="button button-small" type="button" data-permission-select-all="${escapeAttr(fieldName)}">全选 / 清空</button></div><div class="permission-resource-list">${[...grouped.entries()].map(([resource, actions]) => `<section class="permission-resource"><header><strong>${escapeHTML(robotResourceLabel(resource))}</strong><code>${escapeHTML(resource)}</code></header><div>${actions.sort().map((action) => { const value = `${resource}|${action}`; return `<label><input type="checkbox" name="${escapeAttr(fieldName)}" value="${escapeAttr(value)}" ${selectedKeys.has(value) ? "checked" : ""}><span>${escapeHTML(robotActionLabel(action))}</span></label>`; }).join("")}</div></section>`).join("")}</div></fieldset>`;
}

function robotDurationControl(duration = 90) {
  const forever = toNumber(duration) === -1;
  const days = forever ? 90 : Math.max(1, toNumber(duration) || 90);
  return `<div class="robot-duration-control"><label class="field"><span>有效期（天）</span><input name="duration" type="number" min="1" required value="${escapeAttr(days)}" ${forever ? "disabled" : ""}></label><label class="robot-duration-forever"><input name="duration_forever" type="checkbox" ${forever ? "checked" : ""}><span>永不过期</span></label><small class="field-help">勾选后自动向 Harbor 提交 -1；0 不是有效值。</small></div>`;
}

function robotDurationFromForm(formData) {
  return formData.has("duration_forever") ? -1 : Number(formData.get("duration"));
}

function permissionAccessFromForm(formData, fieldName) {
  return formData.getAll(fieldName).map(String).map((value) => {
    const separator = value.indexOf("|");
    return { resource: value.slice(0, separator), action: value.slice(separator + 1), effect: "allow" };
  }).filter((access) => access.resource && access.action);
}

function validateRobotAccess(access, scopeLabel = "") {
  const prefix = scopeLabel ? `${scopeLabel}：` : "";
  if (!access.length) throw new Error(`${prefix}请至少选择一项权限`);
  const hasRepositoryPush = access.some((item) => item.resource === "repository" && item.action === "push");
  const hasRepositoryPull = access.some((item) => item.resource === "repository" && item.action === "pull");
  if (hasRepositoryPush && !hasRepositoryPull) throw new Error(`${prefix}仓库推送权限必须同时包含仓库拉取权限`);
}

function bindRobotPermissionBehavior(form) {
  if (!form) return;
  const forever = form.elements.duration_forever;
  const duration = form.elements.duration;
  const applyDurationMode = () => {
    if (!forever || !duration) return;
    duration.disabled = forever.checked;
    duration.required = !forever.checked;
    if (!forever.checked && Number(duration.value) < 1) duration.value = "90";
  };
  forever?.addEventListener("change", () => {
    applyDurationMode();
    if (!forever.checked) duration?.focus();
  });
  applyDurationMode();
  form.querySelectorAll("[data-permission-select-all]").forEach((button) => button.addEventListener("click", () => {
    const fieldName = button.dataset.permissionSelectAll;
    const boxes = [...form.querySelectorAll(`input[name="${CSS.escape(fieldName)}"]`)];
    const next = !boxes.every((box) => box.checked);
    boxes.forEach((box) => { box.checked = next; });
  }));
  form.addEventListener("change", (event) => {
    const box = event.target.closest('input[type="checkbox"][name*="access"]');
    if (!box?.checked || box.value !== "repository|push") return;
    const pull = [...form.querySelectorAll(`input[name="${CSS.escape(box.name)}"]`)].find((candidate) => candidate.value === "repository|pull");
    if (pull) pull.checked = true;
  });
}

function robotResourceLabel(value) {
  const labels = { repository: "镜像仓库", artifact: "制品", tag: "Tag", scan: "漏洞扫描", sbom: "SBOM", label: "标签", accessory: "附件", "artifact-addition": "制品附加信息", "artifact-label": "制品标签", "preheat-policy": "预热策略", "immutable-tag": "不可变 Tag", log: "日志", "notification-policy": "Webhook 策略", quota: "配额", robot: "机器人账号", member: "项目成员", metadata: "元数据", project: "项目", "audit-log": "审计日志", "replication-policy": "复制策略", replication: "复制执行", "replication-adapter": "复制适配器", registry: "远端仓库", scanner: "扫描器", "scan-all": "全量扫描", "system-volumes": "系统存储", "garbage-collection": "垃圾清理", "purge-audit": "审计清理", "jobservice-monitor": "任务监控", "tag-retention": "Tag 保留", "preheat-instance": "预热实例", "export-cve": "漏洞导出", "security-hub": "安全中心", catalog: "镜像目录", user: "用户", "user-group": "用户组", "ldap-user": "LDAP 用户" };
  return labels[value] || value;
}

function robotActionLabel(value) {
  const labels = { pull: "拉取", push: "推送", create: "创建", read: "查看", update: "更新", delete: "删除", list: "列出", stop: "停止", operate: "操作", "scanner-pull": "扫描器拉取", "*": "全部操作" };
  return labels[value] || value;
}

function showRobotSecret(created) {
  const username = String(created.name || "");
  const secret = String(created.secret || "");
  openControlDialog({
    title: "机器人凭据",
    subtitle: "密钥关闭后无法再次查看",
    submitLabel: "完成",
    content: `<div class="credential-result"><div><span>用户名</span><code>${escapeHTML(username)}</code><button class="icon-button" type="button" data-action="copy-value" data-value="${escapeAttr(username)}" aria-label="复制用户名" title="复制用户名">${icon("copy")}</button></div><div><span>密钥</span><code>${escapeHTML(secret)}</code><button class="icon-button" type="button" data-action="copy-value" data-value="${escapeAttr(secret)}" aria-label="复制密钥" title="复制密钥">${icon("copy")}</button></div></div>`,
    onSubmit: async () => {
      closeControlDialog();
      showToast("机器人账号已创建");
      renderCurrentView(true);
    },
  });
}

function resetRobotSecret(id, name = "") {
  openControlDialog({
    title: "重置机器人密钥",
    subtitle: "旧密钥将立即失效",
    submitLabel: "重置密钥",
    destructive: true,
    content: `<div class="destructive-message">${icon("alert")}<span>使用旧密钥的流水线需要同步更新</span></div>`,
    onSubmit: async () => {
      const result = await controlMutation("robot", { id }, "PATCH", { secret: "" });
      closeControlDialog();
      showRobotSecret({ name: name || findControlItem(state.controlProjectItems, id)?.name || findControlItem(state.adminItems, id)?.name, secret: result?.data?.secret });
    },
  });
}

function confirmDeleteRobot(id, name) {
  confirmControlDelete("删除机器人账号", `账号 ${name} 将立即失去项目访问权限。`, "删除账号", async () => {
    await controlMutation("robot", { id }, "DELETE");
    showToast("机器人账号已删除");
    renderCurrentView(true);
  });
}

function showWebhookDialog(webhook = null) {
  const target = asObject(asArray(webhook?.targets)[0]);
  const availableEvents = asArray(state.controlProjectCollection?.events?.event_type);
  const events = availableEvents.length ? availableEvents : ["PUSH_ARTIFACT", "PULL_ARTIFACT", "DELETE_ARTIFACT", "SCANNING_COMPLETED", "SCANNING_FAILED"];
  const selectedEvents = asArray(webhook?.event_types);
  openControlDialog({
    title: webhook ? "编辑 Webhook" : "新建 Webhook",
    subtitle: state.route.project,
    submitLabel: webhook ? "保存 Webhook" : "创建 Webhook",
    content: `<div class="form-grid two-columns"><label class="field"><span>名称</span><input name="name" required maxlength="255" value="${escapeAttr(webhook?.name || "")}"></label><label class="field"><span>负载格式</span><select name="payload_format"><option value="Default" ${target.payload_format !== "CloudEvents" ? "selected" : ""}>Default</option><option value="CloudEvents" ${target.payload_format === "CloudEvents" ? "selected" : ""}>CloudEvents</option></select></label><label class="field field-span"><span>目标地址</span><input name="address" type="url" required value="${escapeAttr(target.address || "")}" placeholder="https://hooks.example.com/harbor"></label><label class="field field-span"><span>Authorization 请求头</span><input name="auth_header" value="${escapeAttr(target.auth_header || "")}" autocomplete="off" placeholder="可选"></label><label class="field field-span"><span>描述</span><input name="description" maxlength="1024" value="${escapeAttr(webhook?.description || "")}"></label></div><fieldset class="event-selector"><legend>事件类型</legend>${events.map((eventName) => `<label class="check-row"><input type="checkbox" name="event_types" value="${escapeAttr(eventName)}" ${selectedEvents.includes(eventName) || (!webhook && ["PUSH_ARTIFACT", "SCANNING_COMPLETED"].includes(eventName)) ? "checked" : ""}><span><strong>${escapeHTML(webhookEventLabel(eventName))}</strong><small>${escapeHTML(eventName)}</small></span></label>`).join("")}</fieldset><div class="check-grid"><label class="check-row"><input name="enabled" type="checkbox" ${webhook?.enabled !== false ? "checked" : ""}><span><strong>启用 Webhook</strong></span></label><label class="check-row"><input name="skip_cert_verify" type="checkbox" ${target.skip_cert_verify ? "checked" : ""}><span><strong>跳过 TLS 验证</strong></span></label></div>`,
    onSubmit: async (formData) => {
      const eventTypes = formData.getAll("event_types").map(String);
      if (!eventTypes.length) throw new Error("请至少选择一种事件类型");
      const payload = { name: String(formData.get("name") || "").trim(), description: String(formData.get("description") || "").trim(), enabled: formData.has("enabled"), event_types: eventTypes, targets: [{ type: "http", address: String(formData.get("address") || "").trim(), auth_header: String(formData.get("auth_header") || ""), skip_cert_verify: formData.has("skip_cert_verify"), payload_format: String(formData.get("payload_format") || "Default") }] };
      await controlMutation(webhook ? "webhook" : "webhooks", webhook ? { project: state.route.project, id: webhook.id } : { project: state.route.project }, webhook ? "PUT" : "POST", payload);
      closeControlDialog();
      showToast(webhook ? "Webhook 已更新" : "Webhook 已创建");
      renderCurrentView(true);
    },
  });
}

function webhookEventLabel(value) {
  const labels = { PUSH_ARTIFACT: "推送制品", PULL_ARTIFACT: "拉取制品", DELETE_ARTIFACT: "删除制品", SCANNING_COMPLETED: "扫描完成", SCANNING_FAILED: "扫描失败", QUOTA_EXCEED: "配额超限", TAG_RETENTION: "Tag 保留执行" };
  return labels[value] || value;
}

function confirmDeleteWebhook(id, name) {
  confirmControlDelete("删除 Webhook", `Webhook ${name} 将停止发送事件。`, "删除 Webhook", async () => {
    await controlMutation("webhook", { project: state.route.project, id }, "DELETE");
    showToast("Webhook 已删除");
    renderCurrentView(true);
  });
}

function dialogPagination(pagination, action) {
	const page = Math.max(1, toNumber(pagination?.page) || 1);
	const pageSize = Math.max(1, toNumber(pagination?.page_size) || 20);
	const total = Math.max(0, toNumber(pagination?.total));
	const pages = Math.max(1, Math.ceil(total / pageSize));
	return `<div class="dialog-pagination"><span>第 ${formatNumber(page)} / ${formatNumber(pages)} 页，共 ${formatNumber(total)} 项</span><div><button class="button button-small" type="button" data-action="${escapeAttr(action)}" data-page="${page - 1}" ${page <= 1 ? "disabled" : ""}>${icon("chevron-left")}<span>上一页</span></button><button class="button button-small" type="button" data-action="${escapeAttr(action)}" data-page="${page + 1}" ${page >= pages ? "disabled" : ""}><span>下一页</span>${icon("chevron")}</button></div></div>`;
}

function webhookExecutionEvent(execution) {
	const attrs = asObject(execution.extra_attrs);
	return attrs.event_type || attrs.EventType || execution.vendor_type || "Webhook";
}

async function showWebhookHistoryDialog(policyID, policyName) {
	state.webhookPolicyID = String(policyID);
	state.webhookPolicyName = String(policyName || `#${policyID}`);
	state.webhookHistoryStatus = "";
	state.webhookHistoryPage = 1;
	state.webhookExecutionItems = [];
	openControlDialog({
		title: "Webhook 执行历史",
		subtitle: state.webhookPolicyName,
		submitLabel: "关闭",
		submitIcon: "x",
		hideCancel: true,
		content: `<div class="dialog-loading"><span class="spinner"></span><span>正在载入 Webhook 执行记录...</span></div>`,
		onSubmit: async () => closeControlDialog(),
	});
	document.querySelector("#control-dialog .control-dialog")?.classList.add("control-dialog-wide");
	await loadWebhookExecutions(1);
}

async function loadWebhookExecutions(page = 1) {
	const body = document.querySelector("#control-dialog .control-dialog-body");
	if (!body || !state.webhookPolicyID) return;
	state.webhookHistoryPage = Math.max(1, toNumber(page) || 1);
	body.innerHTML = `<div class="dialog-loading"><span class="spinner"></span><span>正在载入 Webhook 执行记录...</span></div>`;
	try {
		const params = { project: state.route.project, id: state.webhookPolicyID, page: state.webhookHistoryPage, page_size: 20, sort: "-start_time" };
		if (state.webhookHistoryStatus) params.q = `status=${state.webhookHistoryStatus}`;
		const executions = await controlList("webhook-executions", params);
		state.webhookExecutionItems = executions.items;
		body.innerHTML = `<section class="dialog-table-section"><div class="table-toolbar"><strong>执行记录</strong><div class="toolbar-spacer"></div><label class="compact-field"><span>状态</span><select id="webhook-history-status"><option value="">全部状态</option>${["Success", "Error", "Running", "Pending", "Stopped"].map((status) => `<option value="${status}" ${state.webhookHistoryStatus === status ? "selected" : ""}>${statusInfo(status)[0]}</option>`).join("")}</select></label></div><div class="table-scroll">${webhookExecutionTable(executions.items)}</div>${dialogPagination(executions.pagination, "webhook-history-page")}</section>`;
		document.querySelector("#webhook-history-status")?.addEventListener("change", (event) => {
			state.webhookHistoryStatus = event.currentTarget.value;
			loadWebhookExecutions(1);
		});
	} catch (error) {
		body.innerHTML = emptyTable("Webhook 执行历史载入失败", error.message, "alert");
	}
}

function webhookExecutionTable(executions) {
	if (!executions.length) return emptyTable("暂无执行记录", "当前筛选条件下没有 Webhook 执行记录。", "history");
	return `<table><thead><tr><th>执行</th><th>事件</th><th>触发方式</th><th>任务</th><th>状态</th><th>开始时间</th><th>耗时</th><th></th></tr></thead><tbody>${executions.map((execution) => {
		const metrics = asObject(execution.metrics);
		return `<tr><td class="mono">#${escapeHTML(execution.id)}</td><td><span class="badge badge-blue">${escapeHTML(webhookExecutionEvent(execution))}</span></td><td>${triggerLabel(execution.trigger)}</td><td>${formatNumber(metrics.task_count)}</td><td>${statusBadge(execution.status)}</td><td>${formatDate(execution.start_time)}</td><td>${formatDuration(execution.start_time, execution.end_time)}</td><td><button class="icon-button" type="button" data-action="view-webhook-execution" data-id="${escapeAttr(execution.id)}" title="查看任务" aria-label="查看 Webhook 执行任务">${icon("external")}</button></td></tr>`;
	}).join("")}</tbody></table>`;
}

async function showWebhookExecutionTasks(executionID, page = 1) {
	const body = document.querySelector("#control-dialog .control-dialog-body");
	if (!body) return;
	state.webhookExecutionID = String(executionID);
	state.webhookTaskPage = Math.max(1, toNumber(page) || 1);
	state.webhookTaskLog = "";
	body.innerHTML = `<div class="dialog-loading"><span class="spinner"></span><span>正在载入 Webhook 任务...</span></div>`;
	try {
		const tasks = await controlList("webhook-tasks", { project: state.route.project, id: state.webhookPolicyID, execution: state.webhookExecutionID, page: state.webhookTaskPage, page_size: 20, sort: "-start_time" });
		const execution = asArray(state.webhookExecutionItems).find((item) => String(item.id) === state.webhookExecutionID) || {};
		body.innerHTML = webhookExecutionDetail(execution, tasks);
	} catch (error) {
		body.innerHTML = emptyTable("Webhook 任务载入失败", error.message, "alert");
	}
}

function webhookExecutionDetail(execution, tasks) {
	const metrics = asObject(execution.metrics);
	return `<section class="execution-summary"><div class="execution-summary-head"><div><button class="button button-small" type="button" data-action="back-webhook-history">${icon("chevron-left")}<span>执行历史</span></button>${statusBadge(execution.status)}<span>${escapeHTML(webhookExecutionEvent(execution))}</span><span>${formatDate(execution.start_time)}</span></div></div><dl class="execution-stats"><div><dt>总任务</dt><dd>${formatNumber(metrics.task_count ?? tasks.pagination.total)}</dd></div><div><dt>成功</dt><dd class="success-text">${formatNumber(metrics.success_task_count)}</dd></div><div><dt>失败</dt><dd class="danger-text">${formatNumber(metrics.error_task_count)}</dd></div><div><dt>进行中</dt><dd>${formatNumber(metrics.running_task_count)}</dd></div><div><dt>已停止</dt><dd>${formatNumber(metrics.stopped_task_count)}</dd></div><div><dt>耗时</dt><dd>${formatDuration(execution.start_time, execution.end_time)}</dd></div></dl></section><section class="replication-task-section"><div class="section-heading compact-heading"><div><h3>Webhook 任务</h3><p>共 ${formatNumber(tasks.pagination.total)} 项</p></div></div><div class="table-scroll replication-task-table">${webhookTaskTable(tasks.items)}</div>${dialogPagination(tasks.pagination, "webhook-task-page")}</section><section id="webhook-log-view" class="replication-log-view" hidden><header><div><h3>任务日志</h3><p id="webhook-log-title"></p></div><div class="log-view-actions"><span id="webhook-log-status"></span>${logTimezoneControl()}<button class="icon-button" type="button" data-action="refresh-webhook-task-log" title="刷新日志" aria-label="刷新 Webhook 任务日志">${icon("refresh")}</button><button class="icon-button" type="button" data-action="copy-webhook-task-log" title="复制日志" aria-label="复制 Webhook 任务日志">${icon("copy")}</button><button class="icon-button" type="button" data-action="download-webhook-task-log" title="下载日志" aria-label="下载 Webhook 任务日志">${icon("download")}</button><button class="icon-button" type="button" data-action="hide-webhook-task-log" title="关闭日志" aria-label="关闭 Webhook 任务日志">${icon("x")}</button></div></header><div id="webhook-log-content" class="structured-log-view" role="table" aria-label="Webhook 任务日志"></div></section>`;
}

function webhookTaskTable(tasks) {
	if (!tasks.length) return emptyTable("暂无 Webhook 任务", "该执行记录还没有返回任务明细。", "history");
	return `<table><thead><tr><th>任务</th><th>事件</th><th>资源</th><th>目标</th><th>尝试次数</th><th>状态</th><th>开始时间</th><th>日志</th></tr></thead><tbody>${tasks.map((task) => {
		const attrs = asObject(task.extra_attrs);
		return `<tr><td class="mono">#${escapeHTML(task.id)}</td><td>${escapeHTML(attrs.event_type || "-")}</td><td class="truncate-cell mono">${escapeHTML(attrs.resource || "-")}</td><td class="truncate-cell mono">${escapeHTML(attrs.destination || "-")}</td><td>${formatNumber(task.run_count)}</td><td>${statusBadge(task.status)}</td><td>${formatDate(task.start_time)}</td><td><button class="icon-button" type="button" data-action="view-webhook-task-log" data-task-id="${escapeAttr(task.id)}" title="查看日志" aria-label="查看 Webhook 任务日志">${icon("history")}</button></td></tr>`;
	}).join("")}</tbody></table>`;
}

async function viewWebhookTaskLog(taskID, button) {
	state.webhookTaskID = String(taskID);
	const view = document.querySelector("#webhook-log-view");
	if (!view) return;
	view.hidden = false;
	view.querySelector("#webhook-log-title").textContent = `执行 #${state.webhookExecutionID} · 任务 #${taskID}`;
	view.scrollIntoView({ behavior: "smooth", block: "nearest" });
	setButtonBusy(button, true, "");
	try { await refreshWebhookTaskLog(); } finally { setButtonBusy(button, false); }
}

async function refreshWebhookTaskLog() {
	const output = document.querySelector("#webhook-log-content");
	const status = document.querySelector("#webhook-log-status");
	if (!output || !state.webhookTaskID) return;
	output.textContent = "正在加载...";
	if (status) status.textContent = "正在读取";
	try {
		const data = await controlData("webhook-task-log", { project: state.route.project, id: state.webhookPolicyID, execution: state.webhookExecutionID, task: state.webhookTaskID });
		state.webhookTaskLog = typeof data === "string" ? data : JSON.stringify(data ?? "", null, 2);
		setHarborLogContent(output, state.webhookTaskLog, "Harbor 没有返回 Webhook 任务日志。");
		if (status) status.textContent = `${formatNumber(state.webhookTaskLog.length)} 字符`;
	} catch (error) {
		output.textContent = error.message;
		if (status) status.textContent = "载入失败";
	}
}

function downloadWebhookTaskLog() {
	downloadControlLog(state.webhookTaskLog, `harbor-webhook-${state.webhookExecutionID || "execution"}-${state.webhookTaskID || "task"}.log`, "当前没有可下载的 Webhook 任务日志", "Webhook 任务日志已下载");
}

function showImmutableRuleDialog(rule = null) {
  const repositorySelector = asArray(asObject(rule?.scope_selectors).repository)[0] || {};
  const tagSelector = asArray(rule?.tag_selectors)[0] || {};
	const metadata = asObject(state.controlProjectCollection?.retentionMetadata);
	if (!Object.keys(metadata).length || metadata.load_error) {
		showToast(metadata.load_error || "Harbor 未提供 selector metadata，无法安全编辑规则。", true);
		return;
	}
	const selectorOptions = (items, selected, fallback) => (items.length ? items : fallback).map((value) => `<option value="${escapeAttr(value)}" ${value === selected ? "selected" : ""}>${escapeHTML(value)}</option>`).join("");
	const repositoryDecorations = asArray(asObject(asArray(metadata.scope_selectors)[0]).decorations);
	const tagDecorations = asArray(asObject(asArray(metadata.tag_selectors)[0]).decorations);
  openControlDialog({
    title: rule ? "编辑不可变 Tag 规则" : "新建不可变 Tag 规则",
    subtitle: state.route.project,
    submitLabel: rule ? "保存规则" : "创建规则",
    content: `<div class="form-grid"><label class="field"><span>仓库条件</span><select name="repository_decoration">${selectorOptions(repositoryDecorations, repositorySelector.decoration || "repoMatches", ["repoMatches", "repoExcludes"])}</select></label><label class="field"><span>仓库匹配</span><input name="repository_pattern" required value="${escapeAttr(repositorySelector.pattern || "**")}" placeholder="例如 release/**"></label><label class="field"><span>Tag 条件</span><select name="tag_decoration">${selectorOptions(tagDecorations, tagSelector.decoration || "matches", ["matches", "excludes"])}</select></label><label class="field"><span>Tag 匹配</span><input name="tag_pattern" required value="${escapeAttr(tagSelector.pattern || "release-*")}" placeholder="例如 v*"></label><label class="check-row"><input name="disabled" type="checkbox" ${rule?.disabled ? "checked" : ""}><span><strong>暂时停用规则</strong><small>保留规则但不限制 Tag</small></span></label></div>`,
    onSubmit: async (formData) => {
	  const payload = rule ? JSON.parse(JSON.stringify(rule)) : { action: "immutable", template: "immutable_template", params: {} };
	  const repository = { ...asObject(asArray(asObject(payload.scope_selectors).repository)[0]) };
	  const tag = { ...asObject(asArray(payload.tag_selectors)[0]) };
	  payload.disabled = formData.has("disabled");
	  repository.kind = "doublestar";
	  repository.decoration = String(formData.get("repository_decoration") || "repoMatches");
	  repository.pattern = String(formData.get("repository_pattern") || "").trim();
	  tag.kind = "doublestar";
	  tag.decoration = String(formData.get("tag_decoration") || "matches");
	  tag.pattern = String(formData.get("tag_pattern") || "").trim();
	  payload.tag_selectors = [tag];
	  payload.scope_selectors = { ...asObject(payload.scope_selectors), repository: [repository] };
      await controlMutation(rule ? "immutable-rule" : "immutable-rules", rule ? { project: state.route.project, id: rule.id } : { project: state.route.project }, rule ? "PUT" : "POST", payload);
      closeControlDialog();
      showToast(rule ? "不可变规则已更新" : "不可变规则已创建");
      renderCurrentView(true);
    },
  });
}

function confirmDeleteImmutableRule(id) {
  confirmControlDelete("删除不可变 Tag 规则", "匹配该规则的 Tag 将恢复为可修改状态。", "删除规则", async () => {
    await controlMutation("immutable-rule", { project: state.route.project, id }, "DELETE");
    showToast("不可变规则已删除");
    renderCurrentView(true);
  });
}

function retentionPolicyPayload(policy, rules = asArray(policy.rules), algorithm = policy.algorithm, cron = asObject(asObject(policy.trigger).settings).cron || "") {
  return {
    algorithm: algorithm === "and" ? "and" : "or",
    rules: rules.map((rule, index) => ({ ...rule, priority: index + 1 })),
    trigger: { kind: "Schedule", settings: { cron: String(cron || "").trim() } },
    scope: { level: "project", ref: Number(state.controlProject.project_id) },
  };
}

function retentionEditorMetadata() {
  return asObject(state.controlProjectCollection?.metadata);
}

function retentionTemplateOptions(selected = "latestPushedK", metadata = retentionEditorMetadata()) {
  const fallback = [
    ["latestPushedK", "保留最近推送的制品"],
    ["latestPulledN", "保留最近拉取的制品"],
    ["nDaysSinceLastPush", "保留最近推送天数内的制品"],
    ["nDaysSinceLastPull", "保留最近拉取天数内的制品"],
    ["always", "永久保留全部匹配制品"],
  ];
  const templates = asArray(metadata.templates).map((template) => [String(template.rule_template || ""), String(template.display_text || template.rule_template || "")]).filter(([value]) => value);
  return (templates.length ? templates : fallback).map(([value, label]) => `<option value="${escapeAttr(value)}" ${value === selected ? "selected" : ""}>${escapeHTML(label)}</option>`).join("");
}

function retentionRuleAmount(rule) {
  if (!rule || rule.template === "always") return 10;
  return Math.max(1, toNumber(asObject(rule.params)[rule.template]) || 10);
}

function retentionRuleFromForm(formData, existing = null) {
  const template = String(formData.get("template") || "latestPushedK");
  const amount = Math.max(1, Number(formData.get("amount")) || 1);
  const rule = existing ? JSON.parse(JSON.stringify(existing)) : {};
  const repository = { ...asObject(asArray(asObject(rule.scope_selectors).repository)[0]) };
  const tag = { ...asObject(asArray(rule.tag_selectors)[0]) };
  rule.priority = toNumber(existing?.priority) || 1;
  rule.disabled = formData.has("disabled");
  rule.action = "retain";
  rule.template = template;
  rule.params = { ...asObject(rule.params) };
  if (template === "always") delete rule.params[template];
  else rule.params[template] = amount;
  repository.kind = "doublestar";
  repository.decoration = String(formData.get("repository_decoration") || "repoMatches");
  repository.pattern = String(formData.get("repository_pattern") || "").trim();
  tag.kind = "doublestar";
  tag.decoration = String(formData.get("tag_decoration") || "matches");
  tag.pattern = String(formData.get("tag_pattern") || "").trim();
  tag.extras = { ...asObject(tag.extras) };
  if (formData.has("untagged")) tag.extras.untagged = true;
  else delete tag.extras.untagged;
  if (!Object.keys(tag.extras).length) delete tag.extras;
  rule.tag_selectors = [tag];
  rule.scope_selectors = { ...asObject(rule.scope_selectors), repository: [repository] };
  return rule;
}

function retentionRuleFields(rule = null, includeSchedule = false, metadata = retentionEditorMetadata()) {
  const repository = asArray(asObject(rule?.scope_selectors).repository)[0] || {};
  const tag = asArray(rule?.tag_selectors)[0] || {};
  const repositoryDecorations = asArray(asObject(asArray(metadata.scope_selectors)[0]).decorations);
  const tagDecorations = asArray(asObject(asArray(metadata.tag_selectors)[0]).decorations);
  const selectOptions = (items, selected, fallback) => (items.length ? items : fallback).map((value) => `<option value="${escapeAttr(value)}" ${value === selected ? "selected" : ""}>${escapeHTML(value)}</option>`).join("");
  return `<div class="form-grid two-columns">
    <label class="field field-span"><span>保留条件</span><select name="template">${retentionTemplateOptions(rule?.template, metadata)}</select></label>
    <label class="field"><span>数量或天数</span><input name="amount" type="number" min="1" max="1000000" step="1" required value="${escapeAttr(retentionRuleAmount(rule))}"></label>
    <label class="field"><span>仓库条件</span><select name="repository_decoration">${selectOptions(repositoryDecorations, repository.decoration || "repoMatches", ["repoMatches", "repoExcludes"])}</select></label>
    <label class="field"><span>仓库匹配</span><input name="repository_pattern" required maxlength="1024" value="${escapeAttr(repository.pattern || "**")}" placeholder="例如 release/**"></label>
    <label class="field"><span>Tag 条件</span><select name="tag_decoration">${selectOptions(tagDecorations, tag.decoration || "matches", ["matches", "excludes"])}</select></label>
    <label class="field"><span>Tag 匹配</span><input name="tag_pattern" required maxlength="1024" value="${escapeAttr(tag.pattern || "**")}" placeholder="例如 v*"></label>
    ${includeSchedule ? '<label class="field field-span"><span>执行计划 Cron</span><input name="cron" maxlength="255" value="0 0 2 * * *" placeholder="留空表示仅手动执行"><small class="field-help">Harbor 使用含秒字段的 Cron 表达式。</small></label>' : ""}
  </div><label class="check-row"><input name="untagged" type="checkbox" ${asObject(tag.extras).untagged ? "checked" : ""}><span><strong>包含无 Tag 制品</strong><small>将未标记制品纳入该规则</small></span></label><label class="check-row"><input name="disabled" type="checkbox" ${rule?.disabled ? "checked" : ""}><span><strong>暂时停用规则</strong><small>保留规则配置，但执行时跳过</small></span></label>`;
}

function showCreateRetentionPolicyDialog() {
  openControlDialog({
    title: "创建 Tag 保留策略",
    subtitle: state.route.project,
    submitLabel: "创建策略",
    content: retentionRuleFields(null, true),
    onSubmit: async (formData) => {
      const firstRule = retentionRuleFromForm(formData);
      const payload = retentionPolicyPayload({ rules: [firstRule], algorithm: "or", trigger: { settings: {} } }, [firstRule], "or", formData.get("cron"));
      await controlMutation("retentions", {}, "POST", payload);
      closeControlDialog();
      showToast("Tag 保留策略已创建");
      renderCurrentView(true);
    },
  });
}

function showRetentionScheduleDialog() {
  const policy = asObject(state.controlProjectCollection?.policy);
  if (!policy.id) return;
  const cron = asObject(asObject(policy.trigger).settings).cron || "";
  openControlDialog({
    title: "编辑保留策略计划",
    subtitle: `策略 #${policy.id}`,
    submitLabel: "保存计划",
    content: `<div class="form-grid"><label class="field"><span>规则组合方式</span><select name="algorithm"><option value="or" ${policy.algorithm !== "and" ? "selected" : ""}>匹配任意规则</option><option value="and" ${policy.algorithm === "and" ? "selected" : ""}>同时匹配全部规则</option></select></label><label class="field"><span>执行计划 Cron</span><input name="cron" maxlength="255" value="${escapeAttr(cron)}" placeholder="留空表示仅手动执行"><small class="field-help">Harbor 使用含秒字段的 Cron 表达式。</small></label></div>`,
    onSubmit: async (formData) => {
      const payload = retentionPolicyPayload(policy, asArray(policy.rules), String(formData.get("algorithm")), formData.get("cron"));
      await controlMutation("retention", { id: policy.id }, "PUT", payload);
      closeControlDialog();
      showToast("Tag 保留执行计划已更新");
      renderCurrentView(true);
    },
  });
}

function showRetentionRuleDialog(index = null) {
  const policy = asObject(state.controlProjectCollection?.policy);
  if (!policy.id) return;
  const rules = asArray(policy.rules);
  const editing = Number.isInteger(index) && index >= 0 && index < rules.length;
  const rule = editing ? rules[index] : null;
  openControlDialog({
    title: editing ? "编辑 Tag 保留规则" : "添加 Tag 保留规则",
    subtitle: `策略 #${policy.id}`,
    submitLabel: editing ? "保存规则" : "添加规则",
    content: retentionRuleFields(rule),
    onSubmit: async (formData) => {
      const nextRules = rules.map((item) => ({ ...item }));
      const nextRule = retentionRuleFromForm(formData, rule);
      if (editing) nextRules[index] = nextRule;
      else nextRules.push(nextRule);
      await controlMutation("retention", { id: policy.id }, "PUT", retentionPolicyPayload(policy, nextRules));
      closeControlDialog();
      showToast(editing ? "Tag 保留规则已更新" : "Tag 保留规则已添加");
      renderCurrentView(true);
    },
  });
}

function confirmDeleteRetentionRule(index) {
  const policy = asObject(state.controlProjectCollection?.policy);
  const rules = asArray(policy.rules);
  if (!policy.id || index < 0 || index >= rules.length) return;
  if (rules.length === 1) {
    showToast("策略必须保留至少一条规则；如不再使用，请删除整个策略。", true);
    return;
  }
  confirmControlDelete("删除 Tag 保留规则", `将删除“${retentionTemplateLabel(rules[index].template)}”规则。`, "删除规则", async () => {
    const nextRules = rules.filter((_, ruleIndex) => ruleIndex !== index);
    await controlMutation("retention", { id: policy.id }, "PUT", retentionPolicyPayload(policy, nextRules));
    showToast("Tag 保留规则已删除");
    renderCurrentView(true);
  });
}

function confirmDeleteRetentionPolicy() {
  const policy = asObject(state.controlProjectCollection?.policy);
  if (!policy.id) return;
  confirmControlDelete("删除 Tag 保留策略", "该项目将不再自动清理旧 Tag，已有制品不会在此操作中删除。", "删除策略", async () => {
    await controlMutation("retention", { id: policy.id }, "DELETE");
    showToast("Tag 保留策略已删除");
    renderCurrentView(true);
  });
}

function confirmRunRetention(dryRun) {
  const policy = asObject(state.controlProjectCollection?.policy);
  if (!policy.id) return;
  openControlDialog({
    title: dryRun ? "执行 Tag 保留演练" : "正式执行 Tag 保留",
    subtitle: dryRun ? "只计算匹配结果，不会删除任何 Tag" : "匹配规则的旧 Tag 可能被永久删除",
    submitLabel: dryRun ? "开始演练" : "确认执行",
    submitIcon: "play",
    destructive: !dryRun,
    content: `<div class="${dryRun ? "info-banner" : "destructive-message"}">${icon(dryRun ? "shield" : "alert")}<span>${dryRun ? "建议先查看演练结果，再执行正式清理。" : "正式执行后无法通过控制台恢复已删除的 Tag。"}</span></div>`,
    onSubmit: async () => {
      await controlMutation("retention-executions", { id: policy.id }, "POST", { dry_run: dryRun });
      closeControlDialog();
      showToast(dryRun ? "Tag 保留演练已启动" : "Tag 保留任务已启动");
      renderCurrentView(true);
    },
  });
}

function stopRetentionExecution(policyID, executionID) {
  openControlDialog({
    title: "停止 Tag 保留执行",
    subtitle: `执行 #${executionID}`,
    submitLabel: "停止执行",
    submitIcon: "x",
    destructive: true,
    content: `<div class="destructive-message">${icon("alert")}<span>正在处理的单个任务可能已完成，停止操作不会恢复已经删除的 Tag。</span></div>`,
    onSubmit: async () => {
      await controlMutation("retention-execution", { id: policyID, eid: executionID }, "PATCH", { action: "stop" });
      closeControlDialog();
      showToast("Tag 保留执行已停止");
      renderCurrentView(true);
    },
  });
}

async function showRetentionExecutionDialog(policyID, executionID, page = 1) {
	state.retentionPolicyID = String(policyID);
	state.retentionExecutionID = String(executionID);
	state.retentionTaskPage = Math.max(1, toNumber(page) || 1);
	state.retentionTaskLog = "";
	const existing = document.querySelector("#control-dialog");
	if (!existing) {
		openControlDialog({
			title: `Tag 保留执行 #${executionID}`,
			subtitle: state.route.project,
			submitLabel: "关闭",
			submitIcon: "x",
			hideCancel: true,
			content: `<div class="dialog-loading"><span class="spinner"></span><span>正在载入 Tag 保留任务...</span></div>`,
			onSubmit: async () => closeControlDialog(),
		});
		document.querySelector("#control-dialog .control-dialog")?.classList.add("control-dialog-wide");
	}
	const body = document.querySelector("#control-dialog .control-dialog-body");
	if (!body) return;
	body.innerHTML = `<div class="dialog-loading"><span class="spinner"></span><span>正在载入 Tag 保留任务...</span></div>`;
	try {
		const tasks = await controlList("retention-tasks", { id: policyID, eid: executionID, page: state.retentionTaskPage, page_size: 20 });
		const execution = asArray(state.controlProjectCollection?.items).find((item) => String(item.id) === String(executionID)) || { id: executionID };
		body.innerHTML = retentionExecutionDetail(execution, tasks);
	} catch (error) {
		body.innerHTML = emptyTable("Tag 保留任务载入失败", error.message, "alert");
	}
}

function retentionExecutionDetail(execution, tasks) {
	const total = tasks.items.reduce((sum, task) => sum + toNumber(task.total), 0);
	const retained = tasks.items.reduce((sum, task) => sum + toNumber(task.retained), 0);
	const failed = tasks.items.filter((task) => ["failed", "error"].includes(String(task.status || "").toLowerCase())).length;
	const running = tasks.items.filter((task) => ["running", "inprogress", "in_progress"].includes(String(task.status || "").toLowerCase())).length;
	return `<section class="execution-summary"><div class="execution-summary-head"><div>${statusBadge(execution.status)}<span>${execution.dry_run ? "仅演练" : "正式执行"}</span><span>${formatDate(execution.start_time)}</span></div></div><dl class="execution-stats"><div><dt>仓库任务</dt><dd>${formatNumber(tasks.pagination.total)}</dd></div><div><dt>匹配 Tag</dt><dd>${formatNumber(total)}</dd></div><div><dt>保留 Tag</dt><dd class="success-text">${formatNumber(retained)}</dd></div><div><dt>清理 Tag</dt><dd>${formatNumber(Math.max(0, total - retained))}</dd></div><div><dt>失败</dt><dd class="danger-text">${formatNumber(failed)}</dd></div><div><dt>进行中</dt><dd>${formatNumber(running)}</dd></div></dl></section><section class="replication-task-section"><div class="section-heading compact-heading"><div><h3>仓库处理结果</h3><p>共 ${formatNumber(tasks.pagination.total)} 项</p></div></div><div class="table-scroll replication-task-table">${retentionTaskTable(tasks.items)}</div>${dialogPagination(tasks.pagination, "retention-task-page")}</section><section id="retention-log-view" class="replication-log-view" hidden><header><div><h3>任务日志</h3><p id="retention-log-title"></p></div><div class="log-view-actions"><span id="retention-log-status"></span>${logTimezoneControl()}<button class="icon-button" type="button" data-action="refresh-retention-task-log" title="刷新日志" aria-label="刷新 Tag 保留任务日志">${icon("refresh")}</button><button class="icon-button" type="button" data-action="copy-retention-task-log" title="复制日志" aria-label="复制 Tag 保留任务日志">${icon("copy")}</button><button class="icon-button" type="button" data-action="download-retention-task-log" title="下载日志" aria-label="下载 Tag 保留任务日志">${icon("download")}</button><button class="icon-button" type="button" data-action="hide-retention-task-log" title="关闭日志" aria-label="关闭 Tag 保留任务日志">${icon("x")}</button></div></header><div id="retention-log-content" class="structured-log-view" role="table" aria-label="Tag 保留任务日志"></div></section>`;
}

function retentionTaskTable(tasks) {
	if (!tasks.length) return emptyTable("暂无仓库任务", "该执行记录还没有返回仓库处理结果。", "history");
	return `<table><thead><tr><th>仓库</th><th>匹配 Tag</th><th>保留</th><th>清理</th><th>状态码</th><th>状态</th><th>耗时</th><th>日志</th></tr></thead><tbody>${tasks.map((task) => `<tr><td><div class="cell-title"><span class="cell-icon">${icon("package")}</span><strong>${escapeHTML(task.repository || "-")}</strong></div></td><td>${formatNumber(task.total)}</td><td class="success-text">${formatNumber(task.retained)}</td><td>${formatNumber(Math.max(0, toNumber(task.total) - toNumber(task.retained)))}</td><td class="mono">${escapeHTML(task.status_code ?? "-")}</td><td>${statusBadge(task.status)}</td><td>${formatDuration(task.start_time, task.end_time)}</td><td><button class="icon-button" type="button" data-action="view-retention-task-log" data-task-id="${escapeAttr(task.id)}" title="查看日志" aria-label="查看 Tag 保留任务日志">${icon("history")}</button></td></tr>`).join("")}</tbody></table>`;
}

async function viewRetentionTaskLog(taskID, button) {
	state.retentionTaskID = String(taskID);
	const view = document.querySelector("#retention-log-view");
	if (!view) return;
	view.hidden = false;
	view.querySelector("#retention-log-title").textContent = `执行 #${state.retentionExecutionID} · 任务 #${taskID}`;
	view.scrollIntoView({ behavior: "smooth", block: "nearest" });
	setButtonBusy(button, true, "");
	try { await refreshRetentionTaskLog(); } finally { setButtonBusy(button, false); }
}

async function refreshRetentionTaskLog() {
	const output = document.querySelector("#retention-log-content");
	const status = document.querySelector("#retention-log-status");
	if (!output || !state.retentionTaskID) return;
	output.textContent = "正在加载...";
	if (status) status.textContent = "正在读取";
	try {
		const data = await controlData("retention-task-log", { id: state.retentionPolicyID, eid: state.retentionExecutionID, tid: state.retentionTaskID });
		state.retentionTaskLog = typeof data === "string" ? data : JSON.stringify(data ?? "", null, 2);
		setHarborLogContent(output, state.retentionTaskLog, "Harbor 没有返回 Tag 保留任务日志。");
		if (status) status.textContent = `${formatNumber(state.retentionTaskLog.length)} 字符`;
	} catch (error) {
		output.textContent = error.message;
		if (status) status.textContent = "载入失败";
	}
}

function downloadRetentionTaskLog() {
	downloadControlLog(state.retentionTaskLog, `harbor-retention-${state.retentionExecutionID || "execution"}-${state.retentionTaskID || "task"}.log`, "当前没有可下载的 Tag 保留任务日志", "Tag 保留任务日志已下载");
}

function showProjectLabelDialog(label = null) {
  openControlDialog({
    title: label ? "编辑项目标签" : "新建项目标签",
    subtitle: state.route.project,
    submitLabel: label ? "保存标签" : "创建标签",
    content: `<div class="form-grid"><label class="field"><span>标签名称</span><input name="name" required maxlength="255" value="${escapeAttr(label?.name || "")}"></label><label class="field"><span>标签颜色</span><input name="color" type="color" value="${escapeAttr(safeLabelColor(label?.color || "#f48120"))}"></label><label class="field"><span>描述</span><textarea name="description" rows="3" maxlength="1024">${escapeHTML(label?.description || "")}</textarea></label></div>`,
    onSubmit: async (formData) => {
      const payload = { name: String(formData.get("name") || "").trim(), description: String(formData.get("description") || "").trim(), color: String(formData.get("color") || "#f48120"), scope: "p", project_id: state.controlProject.project_id };
      await controlMutation(label ? "label" : "labels", label ? { id: label.id } : {}, label ? "PUT" : "POST", payload);
      closeControlDialog();
      showToast(label ? "项目标签已更新" : "项目标签已创建");
      renderCurrentView(true);
    },
  });
}

function confirmDeleteProjectLabel(id, name) {
  confirmControlDelete("删除项目标签", `标签 ${name} 将从项目中删除。`, "删除标签", async () => {
    await controlMutation("label", { id }, "DELETE");
    showToast("项目标签已删除");
    renderCurrentView(true);
  });
}

async function confirmDeleteProject() {
  const project = state.controlProject;
	try {
		const result = asObject(await controlData("project-deletable", { project: project.name }));
		if (result.deletable !== true) {
			showToast(result.message || "Harbor 当前不允许删除此项目。", true);
			return;
		}
	} catch (error) {
		showToast(`无法确认项目是否可删除：${error.message}`, true);
		return;
	}
  confirmControlDelete("删除项目", `项目 ${project.name} 及其配置将被永久删除。Harbor 会拒绝删除仍含仓库的项目。`, "删除项目", async () => {
    await controlMutation("project", { project: project.name }, "DELETE");
    showToast(`项目 ${project.name} 已删除`);
    location.hash = "#/projects";
  }, project.name);
}

function showEditRepositoryDialog() {
  const repository = state.controlRepository;
  openControlDialog({
    title: "编辑仓库",
    subtitle: repository.name,
    submitLabel: "保存仓库",
    content: `<label class="field"><span>仓库描述</span><textarea name="description" rows="4" maxlength="1024" placeholder="输入仓库用途或维护信息">${escapeHTML(repository.description || "")}</textarea></label>`,
    onSubmit: async (formData) => {
      await controlMutation("repository", { project: state.route.project, repository: state.route.repository }, "PUT", { description: String(formData.get("description") || "").trim() });
      closeControlDialog();
      showToast("仓库描述已保存");
      renderCurrentView(true);
    },
  });
}

function confirmDeleteRepository() {
  const repository = state.controlRepository;
  confirmControlDelete("删除仓库", `仓库 ${repository.name} 及其中全部制品将被永久删除。`, "删除仓库", async () => {
    await controlMutation("repository", { project: state.route.project, repository: state.route.repository }, "DELETE");
    showToast("仓库已删除");
    location.hash = projectRoute(state.route.project);
  }, repository.name);
}

function showArtifactScanDialog() {
  const artifactItem = state.controlArtifact;
  openControlDialog({
    title: "扫描制品",
    subtitle: `${repositoryDisplayName(state.route.project, state.route.repository)} · ${shortDigest(artifactItem.digest)}`,
    submitLabel: "提交任务",
    content: `<div class="scan-type-options"><label class="check-row scan-type-option"><input name="scan_type" type="radio" value="vulnerability" checked><span><strong>${icon("shield")}漏洞扫描</strong><small>使用项目扫描器生成漏洞报告与风险等级</small></span></label><label class="check-row scan-type-option"><input name="scan_type" type="radio" value="sbom"><span><strong>${icon("database")}生成 SBOM</strong><small>生成软件物料清单，完成后可在 SBOM 标签页查看</small></span></label></div>`,
    onSubmit: async (formData) => {
      await scanCurrentArtifact(String(formData.get("scan_type") || "vulnerability"));
      closeControlDialog();
    },
  });
}

async function scanCurrentArtifact(scanType = "vulnerability") {
  const route = state.route;
  try {
    await controlMutation("artifact-scan", { project: route.project, repository: route.repository, reference: route.reference }, "POST", { scan_type: scanType });
    showToast(scanType === "sbom" ? "SBOM 生成任务已提交" : "漏洞扫描任务已提交");
    window.setTimeout(() => renderCurrentView(true), 500);
  } catch (error) {
    throw error;
  }
}

function confirmStopArtifactScan(scanType = "vulnerability") {
  openControlDialog({
    title: scanType === "sbom" ? "停止 SBOM 生成" : "停止漏洞扫描",
    subtitle: "Harbor 将请求扫描器停止当前任务",
    submitLabel: "停止任务",
    destructive: true,
    content: `<div class="destructive-message">${icon("alert")}<span>已经生成的部分结果可能不会保留</span></div>`,
    onSubmit: async () => {
      const route = state.route;
      await controlMutation("artifact-scan-stop", { project: route.project, repository: route.repository, reference: route.reference }, "POST", { scan_type: scanType });
      closeControlDialog();
      showToast(scanType === "sbom" ? "SBOM 生成已停止" : "漏洞扫描已停止");
      renderCurrentView(true);
    },
  });
}

function showArtifactScanLogDialog(reportID = "") {
  const report = reportID || artifactScan(state.controlArtifact).reportId;
  if (!report) {
    showToast("当前扫描没有可读取的报告 ID", true);
    return;
  }
  state.artifactScanReportID = report;
  state.artifactScanLog = "";
  openControlDialog({
    title: "制品扫描日志",
    subtitle: `报告 ${report}`,
    submitLabel: "关闭",
    hideCancel: true,
    content: `<section class="scan-log-panel"><div class="scan-log-toolbar"><span id="scan-log-status">正在读取 Harbor 扫描日志...</span><div>${logTimezoneControl()}<button class="icon-button" type="button" data-action="refresh-artifact-scan-log" title="刷新日志" aria-label="刷新日志">${icon("refresh")}</button><button class="icon-button" type="button" data-action="copy-artifact-scan-log" title="复制日志" aria-label="复制日志">${icon("copy")}</button><button class="icon-button" type="button" data-action="download-artifact-scan-log" title="下载日志" aria-label="下载日志">${icon("download")}</button></div></div><div id="artifact-scan-log" class="structured-log-view" role="table" aria-label="制品扫描日志">正在加载...</div></section>`,
    onSubmit: async () => closeControlDialog(),
  });
  refreshArtifactScanLog();
}

async function refreshArtifactScanLog() {
  const output = document.querySelector("#artifact-scan-log");
  const status = document.querySelector("#scan-log-status");
  if (!output || !state.artifactScanReportID) return;
  output.textContent = "正在加载...";
  if (status) status.textContent = "正在读取 Harbor 扫描日志...";
  try {
    const route = state.route;
    const data = await controlData("artifact-scan-log", { project: route.project, repository: route.repository, reference: route.reference, report: state.artifactScanReportID });
    const text = typeof data === "string" ? data : JSON.stringify(data ?? "", null, 2);
    state.artifactScanLog = text;
    if (!document.body.contains(output)) return;
    setHarborLogContent(output, text, "扫描器没有返回日志内容。");
    if (status) status.textContent = `已载入 ${formatNumber(text.length)} 个字符`;
  } catch (error) {
    if (!document.body.contains(output)) return;
    output.textContent = error.message;
    if (status) status.textContent = "日志载入失败";
  }
}

function downloadArtifactScanLog() {
  const filename = `${String(state.route.project).replace(/[^A-Za-z0-9_.-]/g, "-")}-${shortDigest(state.route.reference).replace(/[^A-Za-z0-9_.-]/g, "-")}-scan.log`;
  downloadControlLog(state.artifactScanLog, filename, "当前没有可下载的扫描日志", "扫描日志已下载");
}

function showAddTagDialog() {
  const artifactItem = state.controlArtifact;
  openControlDialog({
    title: "添加 Tag",
    subtitle: shortDigest(artifactItem.digest),
    submitLabel: "创建 Tag",
    content: `<label class="field"><span>Tag 名称</span><input name="name" required maxlength="128" pattern="[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}" autocomplete="off" placeholder="例如 v1.4.0"></label>`,
    onSubmit: async (formData) => {
      const name = String(formData.get("name") || "").trim();
      await controlMutation("artifact-tags", { project: state.route.project, repository: state.route.repository, reference: artifactItem.digest }, "POST", { name });
      closeControlDialog();
      showToast(`Tag ${name} 已创建`);
      location.hash = artifactRoute(state.route.project, state.route.repository, artifactItem.digest, "tags");
      renderCurrentView(true);
    },
  });
}

function confirmDeleteTag(tag) {
  confirmControlDelete("删除 Tag", `Tag ${tag} 将从当前制品移除，制品摘要本身不会被删除。`, "删除 Tag", async () => {
    await controlMutation("artifact-tag", { project: state.route.project, repository: state.route.repository, reference: state.controlArtifact.digest, tag }, "DELETE");
    showToast(`Tag ${tag} 已删除`);
    renderCurrentView(true);
  });
}

function showAttachArtifactLabelDialog() {
  const attachedIDs = new Set(asArray(state.controlArtifact?.labels).map((label) => String(label.id)));
  const available = asArray(state.controlArtifactSecondary?.available).filter((label) => !attachedIDs.has(String(label.id)));
  if (!available.length) {
    showToast("没有可绑定的项目或全局标签", true);
    return;
  }
  openControlDialog({
    title: "绑定制品标签",
    subtitle: shortDigest(state.controlArtifact.digest),
    submitLabel: "绑定标签",
    content: `<label class="field"><span>选择标签</span><select name="label_id" required>${available.map((label) => `<option value="${escapeAttr(label.id)}">${escapeHTML(label.name)}（${label.scope === "g" ? "全局" : "项目"}）</option>`).join("")}</select></label><div class="artifact-label-options">${available.map((label) => `<div>${labelSwatch(label.color)}<span class="cell-stack"><strong>${escapeHTML(label.name)}</strong><small>${escapeHTML(label.description || (label.scope === "g" ? "全局标签" : "项目标签"))}</small></span></div>`).join("")}</div>`,
    onSubmit: async (formData) => {
      const id = Number(formData.get("label_id"));
      const label = available.find((item) => Number(item.id) === id);
      await controlMutation("artifact-labels", { project: state.route.project, repository: state.route.repository, reference: state.controlArtifact.digest }, "POST", { id });
      closeControlDialog();
      showToast(`标签 ${label?.name || `#${id}`} 已绑定`);
      renderCurrentView(true);
    },
  });
}

function confirmRemoveArtifactLabel(id, name) {
  confirmControlDelete("移除制品标签", `标签 ${name} 将从当前制品移除，标签定义本身不会删除。`, "移除标签", async () => {
    await controlMutation("artifact-label", { project: state.route.project, repository: state.route.repository, reference: state.controlArtifact.digest, label: id }, "DELETE");
    showToast(`标签 ${name} 已移除`);
    renderCurrentView(true);
  });
}

function currentArtifactAdditionText() {
  const value = normalizeArtifactAddition(state.controlArtifactSecondary);
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

function copyCurrentArtifactAddition() {
  copyControlValue(currentArtifactAdditionText());
}

function downloadCurrentArtifactAddition() {
  const tab = state.route.tab;
  const meta = artifactAdditionTabs[tab];
  if (!meta) return;
  const textValue = currentArtifactAdditionText();
  const extension = meta.addition.includes(".") ? meta.addition.split(".").pop() : "json";
  const blob = new Blob([textValue], { type: extension === "json" ? "application/json;charset=utf-8" : "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${String(state.route.project).replace(/[^A-Za-z0-9_.-]/g, "-")}-${String(state.route.repository).replace(/[^A-Za-z0-9_.-]/g, "-")}-${meta.addition}`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  showToast(`${meta.label} 已下载`);
}

function confirmDeleteArtifact() {
  const artifactItem = state.controlArtifact;
  confirmControlDelete("删除制品", `制品 ${shortDigest(artifactItem.digest)} 及其全部 Tag 将被永久删除。`, "删除制品", async () => {
    await controlMutation("artifact", { project: state.route.project, repository: state.route.repository, reference: artifactItem.digest }, "DELETE");
    showToast("制品已删除");
    location.hash = repositoryRoute(state.route.project, state.route.repository);
  }, artifactItem.digest);
}

function confirmControlDelete(title, message, submitLabel, action, confirmation = "") {
  const confirmField = confirmation ? `<label class="field"><span>输入资源名称确认</span><input name="confirmation" required autocomplete="off" data-expected="${escapeAttr(confirmation)}" placeholder="${escapeAttr(confirmation)}"></label>` : "";
  openControlDialog({
    title,
    subtitle: message,
    submitLabel,
    destructive: true,
    content: `<div class="destructive-message">${icon("alert")}<span>此操作无法撤销</span></div>${confirmField}`,
    onSubmit: async (formData, form) => {
      if (confirmation && String(formData.get("confirmation") || "") !== confirmation) {
        showDialogError(form, "输入内容与资源名称不一致");
        throw new Error("请输入完整资源名称后再确认");
      }
      await action();
      closeControlDialog();
    },
  });
}

function replicationPolicyDirection(policy) {
  return toNumber(asObject(policy?.dest_registry).id) > 0 ? "push" : "pull";
}

function replicationDefaultInfo(direction = "push") {
  return {
    type: direction === "push" ? "harbor" : "registry",
    supported_resource_filters: [
      { type: "name", style: "input", values: [] },
      { type: "tag", style: "input", values: [] },
      { type: "resource", style: "radio", values: ["image"] },
    ],
    supported_triggers: direction === "push" ? ["manual", "scheduled", "event_based"] : ["manual", "scheduled"],
    supported_copy_by_chunk: false,
  };
}

async function ensureRegistryInfo(id) {
  if (!(state.controlRegistryInfos instanceof Map)) state.controlRegistryInfos = new Map();
  const key = String(id);
  if (state.controlRegistryInfos.has(key)) return state.controlRegistryInfos.get(key);
  const info = asObject(await controlData("registry-info", { id }));
  state.controlRegistryInfos.set(key, info);
  return info;
}

function replicationFilterMap(filters) {
  return new Map(asArray(filters).map((filter) => [String(filter.type || ""), filter]));
}

function replicationFilterTypeLabel(type) {
  return { name: "仓库名称", tag: "Tag", label: "全局标签", resource: "资源类型" }[type] || type;
}

function replicationFilterHelp(type) {
  const help = {
    name: "支持 * 匹配单层路径、** 匹配多层路径，例如 platform/**。",
    tag: "可匹配或排除 Tag，例如 release-*；留空表示全部 Tag。",
    label: "选择一个或多个全局标签；匹配时需同时满足所选标签。",
    resource: "远端适配器声明的可复制资源类型；留空表示全部类型。",
  };
  return help[type] || "由当前 Registry Adapter 声明的官方筛选器。";
}

function replicationDecorationSelect(name, selected = "matches") {
  return `<select name="${name}" aria-label="筛选方式"><option value="matches" ${selected !== "excludes" ? "selected" : ""}>匹配</option><option value="excludes" ${selected === "excludes" ? "selected" : ""}>排除</option></select>`;
}

function replicationLabelChoices(style, currentFilter) {
  const selected = new Set(asArray(currentFilter?.value).map(String));
  const allowedNames = asArray(style.values).map(String).filter(Boolean);
  const globalLabels = asArray(state.controlGlobalLabels);
  const candidates = new Map();
  globalLabels.forEach((label) => candidates.set(String(label.name), label));
  allowedNames.forEach((name) => {
    if (!candidates.has(name)) candidates.set(name, { name, color: "#7b7b82" });
  });
  selected.forEach((name) => {
    if (!candidates.has(name)) candidates.set(name, { name, color: "#7b7b82" });
  });
  if (!candidates.size) return `<div class="replication-label-empty">当前实例没有可用于复制筛选的全局标签</div>`;
  return `<div class="replication-label-grid">${[...candidates.values()].map((label) => `<label><input type="checkbox" name="filter_label" value="${escapeAttr(label.name)}" ${selected.has(String(label.name)) ? "checked" : ""}>${labelSwatch(label.color)}<span>${escapeHTML(label.name)}</span></label>`).join("")}</div>`;
}

function replicationFilterFields(info, filters = []) {
  const existing = replicationFilterMap(filters);
  const styles = asArray(info?.supported_resource_filters).filter((style) => ["name", "tag", "label", "resource"].includes(String(style.type)));
  if (!styles.length) return `<div class="replication-filter-empty">当前适配器未声明资源筛选器，将复制其支持的全部资源。</div>`;
  return styles.map((style) => {
    const type = String(style.type);
    const filter = asObject(existing.get(type));
    const value = type === "label" ? "" : String(filter.value || "");
    let control = "";
    if (type === "label") {
      control = `${replicationDecorationSelect("filter_label_decoration", filter.decoration)}${replicationLabelChoices(style, filter)}`;
    } else if (type === "resource") {
      const values = asArray(style.values).map(String).filter(Boolean);
      if (value && !values.includes(value)) values.push(value);
      control = `<select name="filter_resource"><option value="">全部资源</option>${values.map((item) => `<option value="${escapeAttr(item)}" ${item === value ? "selected" : ""}>${escapeHTML(resourceTypeLabel(item))}</option>`).join("")}</select>`;
    } else if (type === "tag") {
      control = `${replicationDecorationSelect("filter_tag_decoration", filter.decoration)}<input name="filter_tag" value="${escapeAttr(value)}" maxlength="1024" placeholder="例如 release-*" autocomplete="off">`;
    } else {
      control = `<input name="filter_name" value="${escapeAttr(value)}" maxlength="1024" placeholder="例如 platform/**" autocomplete="off">`;
    }
    return `<div class="replication-filter-row" data-filter-type="${escapeAttr(type)}"><div><strong>${escapeHTML(replicationFilterTypeLabel(type))}</strong><small>${escapeHTML(replicationFilterHelp(type))}</small></div><div class="replication-filter-control">${control}</div></div>`;
  }).join("");
}

function replicationTriggerOptions(info, selected) {
  const supported = asArray(info?.supported_triggers).map(String).filter((value) => ["manual", "scheduled", "event_based"].includes(value));
  const values = supported.length ? supported : ["manual"];
  if (selected && !values.includes(selected)) values.push(selected);
  const labels = { manual: "手动触发", scheduled: "定时触发", event_based: "事件触发" };
  return values.map((value) => `<option value="${escapeAttr(value)}" ${value === selected ? "selected" : ""}>${escapeHTML(labels[value] || value)}${supported.includes(value) ? "" : "（现有策略）"}</option>`).join("");
}

function replicationCapabilitySummary(info) {
  const filters = asArray(info?.supported_resource_filters).map((item) => replicationFilterTypeLabel(String(item.type))).filter(Boolean);
  const triggers = asArray(info?.supported_triggers).map((value) => ({ manual: "手动", scheduled: "定时", event_based: "事件" })[value] || value);
  return `${info?.type || "Registry Adapter"} · ${filters.length ? filters.join("、") : "无筛选器"} · ${triggers.length ? triggers.join("、") : "无触发器"}`;
}

function replicationPolicyFormContent(policy, direction, registryID, capabilityInfo, remoteInfo, capabilityError = "") {
  const trigger = asObject(policy?.trigger);
  const triggerType = String(trigger.type || asArray(capabilityInfo?.supported_triggers)[0] || "manual");
  const triggerSettings = asObject(trigger.trigger_settings);
  const speed = toNumber(policy?.speed) || -1;
  const speedInMbps = speed >= 1024 && speed % 1024 === 0;
  const speedValue = speedInMbps ? speed / 1024 : speed;
  const replaceCount = policy?.dest_namespace_replace_count ?? 1;
  const deletion = policy?.replicate_deletion ?? policy?.deletion ?? false;
  const chunkSupported = Boolean(remoteInfo?.supported_copy_by_chunk);
  return `<div class="replication-policy-form">
    ${capabilityError ? `<div class="warning-banner replication-capability-warning">${icon("alert")}<span>${escapeHTML(capabilityError)}</span></div>` : ""}
    <section class="policy-form-section"><header><span>01</span><div><h3>基础信息</h3><p>用于识别和启停这条复制策略</p></div></header><div class="form-grid two-columns"><label class="field"><span>策略名称</span><input name="name" required maxlength="255" value="${escapeAttr(policy?.name || "")}" autocomplete="off"></label><label class="field"><span>状态</span><select name="enabled"><option value="true" ${policy?.enabled !== false ? "selected" : ""}>启用</option><option value="false" ${policy?.enabled === false ? "selected" : ""}>停用</option></select></label><label class="field field-span"><span>描述</span><textarea name="description" rows="2" maxlength="1024">${escapeHTML(policy?.description || "")}</textarea></label></div></section>
    <section class="policy-form-section"><header><span>02</span><div><h3>复制范围</h3><p id="replication-capability-summary">${escapeHTML(replicationCapabilitySummary(capabilityInfo))}</p></div></header><div class="form-grid two-columns"><label class="field"><span>复制方向</span><select name="direction"><option value="push" ${direction === "push" ? "selected" : ""}>推送到远端</option><option value="pull" ${direction === "pull" ? "selected" : ""}>从远端拉取</option></select></label><label class="field"><span id="replication-registry-label">${direction === "push" ? "目标远端仓库" : "来源远端仓库"}</span><select name="registry_id" required>${asArray(state.controlRegistries).map((item) => `<option value="${escapeAttr(item.id)}" ${String(item.id) === String(registryID) ? "selected" : ""}>${escapeHTML(item.name)} · ${escapeHTML(registryTypeLabel(item.type))}</option>`).join("")}</select></label></div><div id="replication-filter-fields" class="replication-filter-fields">${replicationFilterFields(capabilityInfo, policy?.filters)}</div></section>
    <section class="policy-form-section"><header><span>03</span><div><h3>目标路径</h3><p>控制复制后的命名空间与仓库路径层级</p></div></header><div class="form-grid two-columns"><label class="field"><span>目标命名空间</span><input name="dest_namespace" maxlength="255" pattern="[a-z0-9]+(?:[/._-][a-z0-9]+)*" value="${escapeAttr(policy?.dest_namespace || "")}" placeholder="留空保持原路径" autocomplete="off"><small>仅支持小写字母、数字及 / . _ - 分隔。</small></label><label class="field"><span>替换路径层级</span><select name="dest_namespace_replace_count"><option value="-1" ${Number(replaceCount) === -1 ? "selected" : ""}>替换全部路径</option><option value="0" ${Number(replaceCount) === 0 ? "selected" : ""}>不替换，仅添加前缀</option><option value="1" ${Number(replaceCount) === 1 ? "selected" : ""}>替换 1 层</option><option value="2" ${Number(replaceCount) === 2 ? "selected" : ""}>替换 2 层</option><option value="3" ${Number(replaceCount) === 3 ? "selected" : ""}>替换 3 层</option></select><small>未填写目标命名空间时不生效。</small></label></div></section>
    <section class="policy-form-section"><header><span>04</span><div><h3>触发方式</h3><p>触发能力由复制来源的 Registry Adapter 决定</p></div></header><div class="form-grid two-columns"><label class="field"><span>触发方式</span><select name="trigger">${replicationTriggerOptions(capabilityInfo, triggerType)}</select></label><label class="field" data-policy-field="cron"><span>Cron 表达式</span><input name="cron" maxlength="255" value="${escapeAttr(triggerSettings.cron || "0 0 2 * * *")}" placeholder="0 0 2 * * *" autocomplete="off"><small>Harbor 使用六段 Cron，第一段秒固定为 0。</small></label></div><div class="check-grid policy-trigger-options"><label class="check-row" data-policy-field="deletion"><input name="replicate_deletion" type="checkbox" ${deletion ? "checked" : ""}><span><strong>同步删除操作</strong><small>仅推送方向的事件触发支持</small></span></label><label class="check-row" data-policy-field="single-active"><input name="single_active_replication" type="checkbox" ${policy?.single_active_replication ? "checked" : ""}><span><strong>单活执行</strong><small>上次执行结束前跳过重复运行</small></span></label></div></section>
    <section class="policy-form-section"><header><span>05</span><div><h3>传输选项</h3><p>限制单任务带宽并控制目标覆盖行为</p></div></header><div class="form-grid two-columns"><label class="field"><span>单任务带宽</span><div class="policy-speed-input"><input name="speed" type="number" required min="-1" max="2147483647" step="1" value="${escapeAttr(speedValue)}"><select name="speed_unit"><option value="Kbps" ${!speedInMbps ? "selected" : ""}>Kbps</option><option value="Mbps" ${speedInMbps ? "selected" : ""}>Mbps</option></select></div><small>-1 表示不限速；限制值作用于每个复制任务。</small></label><div class="policy-transfer-flags"><label class="check-row"><input name="override" type="checkbox" ${policy ? (policy.override ? "checked" : "") : "checked"}><span><strong>覆盖已有制品</strong><small>目标存在同名资源时覆盖</small></span></label><label class="check-row"><input name="copy_by_chunk" type="checkbox" data-supported="${chunkSupported}" ${policy?.copy_by_chunk && chunkSupported ? "checked" : ""} ${chunkSupported ? "" : "disabled"}><span><strong>分块复制</strong><small id="replication-chunk-help">${chunkSupported ? "当前远端适配器支持分块复制" : "当前远端适配器不支持分块复制"}</small></span></label></div></div></section>
  </div>`;
}

function replicationFiltersFromForm(form) {
  const filters = [];
  const name = String(form.elements.namedItem("filter_name")?.value || "").trim();
  const tag = String(form.elements.namedItem("filter_tag")?.value || "").trim();
  const resource = String(form.elements.namedItem("filter_resource")?.value || "").trim();
  const labels = [...form.querySelectorAll('input[name="filter_label"]:checked')].map((input) => input.value);
  if (name) filters.push({ type: "name", value: name });
  if (tag) filters.push({ type: "tag", value: tag, decoration: String(form.elements.namedItem("filter_tag_decoration")?.value || "matches") });
  if (labels.length) filters.push({ type: "label", value: labels, decoration: String(form.elements.namedItem("filter_label_decoration")?.value || "matches") });
  if (resource) filters.push({ type: "resource", value: resource });
  return filters;
}

function applyReplicationPolicyVisibility(form) {
  const direction = String(form.elements.namedItem("direction")?.value || "push");
  const trigger = String(form.elements.namedItem("trigger")?.value || "manual");
  const cronField = form.querySelector('[data-policy-field="cron"]');
  const cron = form.elements.namedItem("cron");
  const deletionField = form.querySelector('[data-policy-field="deletion"]');
  const singleField = form.querySelector('[data-policy-field="single-active"]');
  const namespace = form.elements.namedItem("dest_namespace");
  const flatten = form.elements.namedItem("dest_namespace_replace_count");
  if (cronField) cronField.hidden = trigger !== "scheduled";
  if (cron) cron.required = trigger === "scheduled";
  if (deletionField) deletionField.hidden = !(direction === "push" && trigger === "event_based");
  if (singleField) singleField.hidden = trigger === "event_based";
  if (flatten) flatten.disabled = !String(namespace?.value || "").trim();
  const registryLabel = form.querySelector("#replication-registry-label");
  if (registryLabel) registryLabel.textContent = direction === "push" ? "目标远端仓库" : "来源远端仓库";
}

function bindReplicationPolicyBehavior(form, initialCapabilityInfo) {
  let capabilityInfo = initialCapabilityInfo;
  let requestVersion = 0;
  const refreshCapabilities = async () => {
    const version = ++requestVersion;
    const direction = String(form.elements.namedItem("direction").value);
    const registryID = Number(form.elements.namedItem("registry_id").value);
    const currentFilters = replicationFiltersFromForm(form);
    const results = await Promise.allSettled([
      ensureRegistryInfo(direction === "push" ? 0 : registryID),
      ensureRegistryInfo(registryID),
    ]);
    if (version !== requestVersion || !document.body.contains(form)) return;
    if (results[0].status === "fulfilled") capabilityInfo = results[0].value;
    else showDialogError(form, `复制能力读取失败：${results[0].reason.message}`);
    const remoteInfo = results[1].status === "fulfilled" ? results[1].value : replicationDefaultInfo(direction);
    form.querySelector("#replication-filter-fields").innerHTML = replicationFilterFields(capabilityInfo, currentFilters);
    const triggerSelect = form.elements.namedItem("trigger");
    const currentTrigger = String(triggerSelect.value || "manual");
    triggerSelect.innerHTML = replicationTriggerOptions(capabilityInfo, asArray(capabilityInfo?.supported_triggers).includes(currentTrigger) ? currentTrigger : String(asArray(capabilityInfo?.supported_triggers)[0] || "manual"));
    const summary = form.querySelector("#replication-capability-summary");
    if (summary) summary.textContent = replicationCapabilitySummary(capabilityInfo);
    const chunk = form.elements.namedItem("copy_by_chunk");
    const chunkSupported = Boolean(remoteInfo?.supported_copy_by_chunk);
    chunk.dataset.supported = String(chunkSupported);
    chunk.disabled = !chunkSupported;
    if (!chunkSupported) chunk.checked = false;
    const chunkHelp = form.querySelector("#replication-chunk-help");
    if (chunkHelp) chunkHelp.textContent = chunkSupported ? "当前远端适配器支持分块复制" : "当前远端适配器不支持分块复制";
    applyReplicationPolicyVisibility(form);
  };
  form.elements.namedItem("direction")?.addEventListener("change", refreshCapabilities);
  form.elements.namedItem("registry_id")?.addEventListener("change", refreshCapabilities);
  form.elements.namedItem("trigger")?.addEventListener("change", () => applyReplicationPolicyVisibility(form));
  form.elements.namedItem("dest_namespace")?.addEventListener("input", () => applyReplicationPolicyVisibility(form));
  applyReplicationPolicyVisibility(form);
}

async function showPolicyDialog(policy = null) {
  const registries = asArray(state.controlRegistries);
  if (!registries.length) {
    showToast("请先创建一个远端仓库连接", true);
    return;
  }
  const source = asObject(policy?.src_registry);
  const destination = asObject(policy?.dest_registry);
  const direction = policy ? replicationPolicyDirection(policy) : "push";
  const registryID = direction === "push" ? (destination.id || registries[0].id) : (source.id || registries[0].id);
  const capabilityID = direction === "push" ? 0 : registryID;
  const results = await Promise.allSettled([ensureRegistryInfo(capabilityID), ensureRegistryInfo(registryID)]);
  const capabilityInfo = results[0].status === "fulfilled" ? results[0].value : replicationDefaultInfo(direction);
  const remoteInfo = results[1].status === "fulfilled" ? results[1].value : replicationDefaultInfo(direction);
  const capabilityError = results.filter((result) => result.status === "rejected").map((result) => result.reason.message).join("；");
  openControlDialog({
    title: policy ? "编辑复制策略" : "新建复制策略",
    subtitle: policy ? policy.name : "Harbor v2.15 官方复制策略",
    submitLabel: policy ? "保存策略" : "创建策略",
    content: replicationPolicyFormContent(policy, direction, registryID, capabilityInfo, remoteInfo, capabilityError),
    onSubmit: async (formData, form) => {
      const selectedDirection = String(formData.get("direction"));
      const registry = { id: Number(formData.get("registry_id")) };
      const triggerType = String(formData.get("trigger"));
      const speedInput = Number(formData.get("speed"));
      const speed = String(formData.get("speed_unit")) === "Mbps" && speedInput > 0 ? speedInput * 1024 : speedInput;
      const chunk = form.elements.namedItem("copy_by_chunk");
      const payload = {
        name: String(formData.get("name") || "").trim(), description: String(formData.get("description") || "").trim(),
        src_registry: selectedDirection === "pull" ? registry : null, dest_registry: selectedDirection === "push" ? registry : null,
        dest_namespace: String(formData.get("dest_namespace") || "").trim(),
        dest_namespace_replace_count: Number(form.elements.namedItem("dest_namespace_replace_count")?.value || 0),
        trigger: { type: triggerType, trigger_settings: triggerType === "scheduled" ? { cron: String(formData.get("cron") || "").trim() } : {} },
        filters: replicationFiltersFromForm(form),
        enabled: String(formData.get("enabled")) === "true",
        override: formData.has("override"),
        replicate_deletion: selectedDirection === "push" && triggerType === "event_based" && formData.has("replicate_deletion"),
        speed,
        single_active_replication: triggerType !== "event_based" && formData.has("single_active_replication"),
      };
      if (chunk?.dataset.supported === "true") payload.copy_by_chunk = chunk.checked;
      await controlMutation(policy ? "replication-policy" : "replication-policies", policy ? { id: policy.id } : {}, policy ? "PUT" : "POST", payload);
      closeControlDialog();
      showToast(policy ? "复制策略已更新" : "复制策略已创建");
      renderCurrentView(true);
    },
  });
  document.querySelector("#control-dialog .control-dialog")?.classList.add("control-dialog-wide");
  const form = document.querySelector("#control-dialog-form");
  if (form) bindReplicationPolicyBehavior(form, capabilityInfo);
}

async function runReplicationPolicy(id) {
	const policy = findControlItem(state.controlPolicies, id);
	const operationID = beginOperation({ kind: "replication", title: "启动复制任务", detail: policy?.name || `策略 #${id}`, total: 1 });
  try {
    await controlMutation("replication-executions", {}, "POST", { policy_id: Number(id) });
		recordOperationResult(operationID, policy?.name || `策略 #${id}`);
		finishOperation(operationID, "Harbor 已接受任务，可在复制执行记录中查看进度");
    showToast("复制任务已启动");
    renderCurrentView(true);
  } catch (error) {
		failOperation(operationID, error);
    showToast(error.message, true);
  }
}

async function showReplicationExecutionDialog(id) {
  state.replicationTaskLog = "";
  state.replicationLogExecutionID = "";
  state.replicationLogTaskID = "";
  openControlDialog({
    title: `复制执行 #${id}`,
    subtitle: "正在读取执行详情和任务列表",
    submitLabel: "关闭",
    submitIcon: "x",
    hideCancel: true,
    content: `<div class="dialog-loading"><span class="spinner"></span><span>正在载入复制任务...</span></div>`,
    onSubmit: async () => closeControlDialog(),
  });
  const dialog = document.querySelector("#control-dialog");
  if (dialog) {
    dialog.dataset.executionId = String(id);
    dialog.querySelector(".control-dialog")?.classList.add("control-dialog-wide");
  }
  try {
    const [execution, tasks] = await Promise.all([
      controlData("replication-execution", { id }),
      controlList("replication-tasks", { id, page: 1, page_size: 100, sort: "-start_time" }),
    ]);
    const activeDialog = document.querySelector(`#control-dialog[data-execution-id="${CSS.escape(String(id))}"]`);
    if (!activeDialog) return;
    const body = activeDialog.querySelector(".control-dialog-body");
    body.innerHTML = replicationExecutionDetail(execution, tasks);
    const subtitle = activeDialog.querySelector("header p");
    if (subtitle) subtitle.textContent = `${statusInfo(execution.status)[0]} · ${formatNumber(tasks.pagination.total)} 个任务`;
  } catch (error) {
    const form = document.querySelector(`#control-dialog[data-execution-id="${CSS.escape(String(id))}"] form`);
    if (form) showDialogError(form, error.message);
  }
}

function replicationExecutionDetail(execution, tasks) {
  const canStop = String(execution.status || "").toLowerCase() === "inprogress";
  return `<section class="execution-summary"><div class="execution-summary-head"><div>${statusBadge(execution.status)}<span>${triggerLabel(execution.trigger)}</span><span>${formatDate(execution.start_time)}</span></div>${canStop ? `<button class="button button-small button-danger" type="button" data-action="stop-replication-execution" data-id="${escapeAttr(execution.id)}">${icon("x")}<span>停止执行</span></button>` : ""}</div><dl class="execution-stats"><div><dt>总任务</dt><dd>${formatNumber(execution.total ?? tasks.pagination.total)}</dd></div><div><dt>成功</dt><dd class="success-text">${formatNumber(execution.succeed)}</dd></div><div><dt>失败</dt><dd class="danger-text">${formatNumber(execution.failed)}</dd></div><div><dt>进行中</dt><dd>${formatNumber(execution.in_progress)}</dd></div><div><dt>已停止</dt><dd>${formatNumber(execution.stopped)}</dd></div><div><dt>耗时</dt><dd>${formatDuration(execution.start_time, execution.end_time)}</dd></div></dl></section><section class="replication-task-section"><div class="section-heading compact-heading"><div><h3>复制任务</h3><p>第 1-${formatNumber(tasks.items.length)} 项，共 ${formatNumber(tasks.pagination.total)} 项</p></div></div><div class="table-scroll replication-task-table">${replicationTaskTable(tasks.items, execution.id)}</div></section><section id="replication-log-view" class="replication-log-view" hidden><header><div><h3>任务日志</h3><p id="replication-log-title"></p></div><div class="log-view-actions"><span id="replication-log-status"></span>${logTimezoneControl()}<button class="icon-button" type="button" data-action="refresh-replication-task-log" title="刷新日志" aria-label="刷新复制任务日志">${icon("refresh")}</button><button class="icon-button" type="button" data-action="copy-replication-task-log" title="复制日志" aria-label="复制当前任务日志">${icon("copy")}</button><button class="icon-button" type="button" data-action="download-replication-task-log" title="下载日志" aria-label="下载复制任务日志">${icon("download")}</button><button class="icon-button" type="button" data-action="hide-replication-log" title="关闭日志" aria-label="关闭日志">${icon("x")}</button></div></header><div id="replication-log-content" class="structured-log-view" role="table" aria-label="复制任务日志"></div></section>`;
}

function replicationTaskTable(tasks, executionID) {
  if (!tasks.length) return emptyTable("暂无复制任务", "该执行记录还没有返回任务明细。", "history");
  return `<table><thead><tr><th>任务</th><th>资源类型</th><th>源</th><th>目标</th><th>操作</th><th>状态</th><th>开始时间</th><th>结束时间</th><th>日志</th></tr></thead><tbody>${tasks.map((task) => `<tr><td class="mono">#${escapeHTML(task.id)}</td><td>${resourceTypeLabel(task.resource_type)}</td><td class="replication-resource mono" title="${escapeAttr(task.src_resource)}">${escapeHTML(task.src_resource || "-")}</td><td class="replication-resource mono" title="${escapeAttr(task.dst_resource)}">${escapeHTML(task.dst_resource || "-")}</td><td>${operationLabel(task.operation)}</td><td>${statusBadge(task.status)}</td><td>${formatDate(task.start_time)}</td><td>${formatDate(task.end_time)}</td><td>${String(task.status || "").toLowerCase() === "initialized" ? "-" : `<button class="icon-button" type="button" data-action="view-replication-task-log" data-execution-id="${escapeAttr(executionID)}" data-task-id="${escapeAttr(task.id)}" title="查看日志" aria-label="查看任务 ${escapeAttr(task.id)} 日志">${icon("history")}</button>`}</td></tr>`).join("")}</tbody></table>`;
}

async function viewReplicationTaskLog(executionID, taskID, button) {
  state.replicationLogExecutionID = String(executionID);
  state.replicationLogTaskID = String(taskID);
  state.replicationTaskLog = "";
  const view = document.querySelector("#replication-log-view");
  if (!view) return;
  view.hidden = false;
  view.querySelector("#replication-log-title").textContent = `执行 #${executionID} · 任务 #${taskID}`;
  view.scrollIntoView({ behavior: "smooth", block: "nearest" });
  setButtonBusy(button, true, "");
  try {
    await refreshReplicationTaskLog();
  } finally {
    setButtonBusy(button, false);
  }
}

async function refreshReplicationTaskLog() {
  const output = document.querySelector("#replication-log-content");
  const status = document.querySelector("#replication-log-status");
  if (!output || !state.replicationLogExecutionID || !state.replicationLogTaskID) return;
  output.textContent = "正在加载...";
  if (status) status.textContent = "正在读取";
  try {
    const data = await controlData("replication-task-log", { id: state.replicationLogExecutionID, task: state.replicationLogTaskID });
    const text = typeof data === "string" ? data : JSON.stringify(data ?? "", null, 2);
    state.replicationTaskLog = text;
    if (!document.body.contains(output)) return;
    setHarborLogContent(output, text, "Harbor 没有返回复制任务日志。");
    if (status) status.textContent = `${formatNumber(text.length)} 字符`;
  } catch (error) {
    if (!document.body.contains(output)) return;
    output.textContent = error.message;
    if (status) status.textContent = "载入失败";
  }
}

function downloadReplicationTaskLog() {
  const execution = String(state.replicationLogExecutionID || "").replace(/[^0-9]/g, "") || "execution";
  const task = String(state.replicationLogTaskID || "").replace(/[^0-9]/g, "") || "task";
  downloadControlLog(state.replicationTaskLog, `harbor-replication-${execution}-${task}.log`, "当前没有可下载的复制任务日志", "复制任务日志已下载");
}

function stopReplicationExecution(id) {
  openControlDialog({
    title: "停止复制执行",
    subtitle: `执行 #${id}`,
    submitLabel: "停止执行",
    submitIcon: "x",
    destructive: true,
    content: `<div class="destructive-message">${icon("alert")}<span>已完成的任务不会回滚，正在传输的任务将由 Harbor 请求停止。</span></div>`,
    onSubmit: async () => {
      await controlMutation("replication-execution", { id }, "PUT");
      closeControlDialog();
      showToast("已向 Harbor 提交停止请求");
      renderCurrentView(true);
    },
  });
}

function confirmDeletePolicy(id, name) {
  confirmControlDelete("删除复制策略", `策略 ${name} 将被永久删除。`, "删除策略", async () => {
    await controlMutation("replication-policy", { id }, "DELETE");
    showToast("复制策略已删除");
    renderCurrentView(true);
  });
}

function showRegistryDialog(registry = null) {
  const adapters = state.controlRegistryAdapters?.length ? state.controlRegistryAdapters : ["harbor", "docker-hub", "docker-registry"];
  openControlDialog({
    title: registry ? "编辑远端仓库" : "新建远端仓库",
    subtitle: registry ? registry.name : "连接 Harbor 支持的 Registry Adapter",
    submitLabel: registry ? "保存连接" : "创建连接",
    content: `<div class="form-grid two-columns registry-core-fields"><label class="field"><span>连接名称</span><input name="name" required maxlength="255" value="${escapeAttr(registry?.name || "")}"></label><label class="field"><span>仓库类型</span><select name="type" ${registry ? "disabled" : ""}>${adapters.map((type) => `<option value="${escapeAttr(type)}" ${type === registry?.type ? "selected" : ""}>${escapeHTML(registryTypeLabel(type))}</option>`).join("")}</select></label></div><div id="registry-adapter-fields">${registryAdapterFields(registry?.type || adapters[0], registry)}</div><div class="registry-dialog-actions"><button id="test-registry-draft" class="button button-small" type="button">${icon("refresh")}<span>测试当前配置</span></button><span class="field-help">测试使用当前表单内容，不会保存连接。</span></div>`,
    onSubmit: async (formData) => {
      const accessSecret = String(formData.get("access_secret") || "");
      const registryType = registry?.type || String(formData.get("type") || "harbor");
      let payload;
      if (registry) {
        payload = { name: String(formData.get("name") || "").trim(), description: String(formData.get("description") || "").trim(), url: String(formData.get("url") || "").trim(), credential_type: "basic", access_key: String(formData.get("access_key") || "").trim(), insecure: formData.has("insecure"), ca_certificate: String(formData.get("ca_certificate") || "").trim() };
        if (accessSecret) payload.access_secret = accessSecret;
      } else {
        payload = { name: String(formData.get("name") || "").trim(), description: String(formData.get("description") || "").trim(), type: registryType, url: String(formData.get("url") || "").trim(), insecure: formData.has("insecure"), ca_certificate: String(formData.get("ca_certificate") || "").trim(), credential: { type: "basic", access_key: String(formData.get("access_key") || "").trim(), access_secret: accessSecret } };
      }
      await controlMutation(registry ? "registry" : "registries", registry ? { id: registry.id } : {}, registry ? "PUT" : "POST", payload);
      closeControlDialog();
      showToast(registry ? "远端仓库已更新" : "远端仓库已创建");
      renderCurrentView(true);
    },
  });
  document.querySelector("#control-dialog .control-dialog")?.classList.add("control-dialog-large");
  bindRegistryAdapterForm(registry, adapters[0]);
}

function registryAdapterFields(type, registry = null) {
  const info = asObject(asObject(state.controlRegistryAdapterInfos)[type]);
  const endpointPattern = asObject(info.endpoint_pattern);
  const credentialPattern = asObject(info.credential_pattern);
  const endpoints = asArray(endpointPattern.endpoints);
  const endpointType = String(endpointPattern.endpoint_type || "");
  const currentURL = String(registry?.url || (endpoints.length === 1 ? endpoints[0].value : ""));
  const credential = asObject(registry?.credential);
  const fixedEndpoint = endpointType === "EndpointPatternTypeFix";
  const listedEndpoint = endpointType === "EndpointPatternTypeList" && endpoints.length > 0;
  const endpointChoice = endpoints.some((endpoint) => endpoint.value === currentURL) ? currentURL : "";
  const accessKeyFixed = credentialPattern.access_key_type === "AccessKeyTypeFix";
  const accessKey = accessKeyFixed ? credentialPattern.access_key_data : credential.access_key;
  const secretIsFile = credentialPattern.access_secret_type === "AccessSecretTypeFile";
  const hasTemplatedEndpoint = endpoints.some((endpoint) => String(endpoint.value || "").includes("instanceName"));
  const endpointControl = fixedEndpoint
    ? `<label class="field field-span"><span>官方仓库地址</span><input class="registry-fixed-endpoint" name="url" type="url" required readonly value="${escapeAttr(currentURL)}"><small>该地址由 Harbor Adapter 固定，不支持修改。</small></label>`
    : `${listedEndpoint ? `<label class="field field-span"><span>区域或官方端点</span><select name="endpoint_choice"><option value="">请选择端点</option>${endpoints.map((endpoint) => `<option value="${escapeAttr(endpoint.value)}" ${endpointChoice === endpoint.value ? "selected" : ""}>${escapeHTML(endpoint.key || endpoint.value)}</option>`).join("")}</select><small>${hasTemplatedEndpoint ? "选择后会自动填入地址；企业版模板中的 instanceName 可在下方替换。" : "选择后会自动填入 Harbor 官方 Adapter 提供的端点。"}</small></label>` : ""}<label class="field field-span"><span>${listedEndpoint ? "仓库地址" : "仓库地址（手工填写）"}</span><input name="url" type="url" required value="${escapeAttr(currentURL)}" placeholder="https://registry.example.com"><small>${listedEndpoint ? "Harbor 允许在选择官方端点后继续调整最终地址。" : "请输入该 Registry Adapter 可访问的完整 HTTP 或 HTTPS 地址。"}</small></label>`;
  const secretControl = secretIsFile
    ? `<label class="field field-span"><span>JSON 服务账号密钥</span><textarea class="credential-file-input mono" name="access_secret" rows="7" autocomplete="off" placeholder="${registry ? "留空表示不修改" : "粘贴完整的服务账号 JSON"}"></textarea><small>Google GCR 使用 JSON Key 文件内容进行认证。</small></label>`
    : `<label class="field"><span>访问密码 / Secret</span><input name="access_secret" type="password" autocomplete="new-password" placeholder="${registry ? "留空表示不修改" : "可选"}"></label>`;
  return `<div class="form-grid two-columns registry-adapter-grid">${endpointControl}<label class="field"><span>访问账号 / Access Key</span><input name="access_key" value="${escapeAttr(accessKey || "")}" ${accessKeyFixed ? "readonly" : ""} autocomplete="username">${accessKeyFixed ? "<small>该账号值由 Harbor Adapter 固定。</small>" : ""}</label>${secretControl}<label class="field field-span"><span>描述</span><textarea name="description" rows="3" maxlength="1024">${escapeHTML(registry?.description || "")}</textarea></label><label class="field field-span"><span>自定义 CA 证书</span><textarea class="mono" name="ca_certificate" rows="5" placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----">${escapeHTML(registry?.ca_certificate || "")}</textarea><small>可选。填写 PEM 证书后，Harbor 使用它验证此远端仓库。</small></label></div><label class="check-row registry-insecure-row"><input name="insecure" type="checkbox" ${registry?.insecure ? "checked" : ""}><span><strong>跳过 TLS 证书验证</strong><small>仅用于可信内网和自签名证书；启用后不会使用上面的 CA 证书。</small></span></label>`;
}

function bindRegistryAdapterForm(registry, fallbackType) {
  const form = document.querySelector("#control-dialog-form");
  if (!form) return;
  const typeSelect = form.elements.type;
  typeSelect?.addEventListener("change", () => {
    const fields = form.querySelector("#registry-adapter-fields");
    if (fields) fields.innerHTML = registryAdapterFields(String(typeSelect.value || fallbackType), null);
    bindRegistryEndpointChoice(form);
  });
  bindRegistryEndpointChoice(form);
  form.querySelector("#test-registry-draft")?.addEventListener("click", () => testRegistryDraft(form, registry));
}

function bindRegistryEndpointChoice(form) {
  form.elements.endpoint_choice?.addEventListener("change", (event) => {
    if (event.currentTarget.value && form.elements.url) form.elements.url.value = event.currentTarget.value;
  });
}

async function testRegistryDraft(form, registry) {
  const button = form.querySelector("#test-registry-draft");
  const urlInput = form.elements.url;
  if (!urlInput?.reportValidity()) return;
  const formData = new FormData(form);
  const accessSecret = String(formData.get("access_secret") || "");
  const payload = {
    type: registry?.type || String(formData.get("type") || "harbor"),
    url: String(formData.get("url") || "").trim(),
    credential_type: "basic",
    access_key: String(formData.get("access_key") || "").trim(),
    insecure: formData.has("insecure"),
    ca_certificate: String(formData.get("ca_certificate") || "").trim(),
  };
  if (registry?.id) payload.id = Number(registry.id);
  if (accessSecret) payload.access_secret = accessSecret;
  setButtonBusy(button, true, "正在测试");
  try {
    await controlMutation("registry-ping", {}, "POST", payload);
    showToast("当前配置连接正常");
  } catch (error) {
    showDialogError(form, error.message);
  } finally {
    setButtonBusy(button, false);
  }
}

async function pingRegistry(id) {
  try {
    await controlMutation("registry-ping", {}, "POST", { id: Number(id) });
    showToast("远端仓库连接正常");
  } catch (error) {
    showToast(error.message, true);
  }
}

function confirmDeleteRegistry(id, name) {
  confirmControlDelete("删除远端仓库", `连接 ${name} 将被删除，引用它的复制策略可能需要先调整。`, "删除连接", async () => {
    await controlMutation("registry", { id }, "DELETE");
    showToast("远端仓库连接已删除");
    renderCurrentView(true);
  });
}

function showPreheatInstanceDialog(instance = null) {
  const providers = asArray(state.controlPreheatProviders);
  if (!providers.length) {
    showToast("当前 Harbor 实例没有返回可用的 P2P Provider", true);
    return;
  }
  const authMode = String(instance?.auth_mode || "NONE").toUpperCase();
  openControlDialog({
    title: instance ? "编辑 P2P 实例" : "新建 P2P 实例",
    subtitle: instance ? instance.name : "Harbor 分布式分发 Provider",
    submitLabel: instance ? "保存实例" : "创建实例",
    content: `<div class="form-grid two-columns"><label class="field"><span>Provider</span><select name="vendor" required>${providers.map((provider) => `<option value="${escapeAttr(provider.id)}" ${provider.id === instance?.vendor ? "selected" : ""}>${escapeHTML(provider.name || provider.id)}</option>`).join("")}</select></label><label class="field"><span>实例名称</span><input name="name" required maxlength="255" pattern="[A-Za-z0-9]+([._-][A-Za-z0-9]+)*" value="${escapeAttr(instance?.name || "")}" autocomplete="off"></label><label class="field field-span"><span>服务地址</span><input name="endpoint" type="url" required value="${escapeAttr(instance?.endpoint || "")}" placeholder="https://dragonfly.example.com"></label><label class="field field-span"><span>描述</span><textarea name="description" rows="3" maxlength="1024">${escapeHTML(instance?.description || "")}</textarea></label><label class="field"><span>认证模式</span><select name="auth_mode"><option value="NONE" ${authMode === "NONE" ? "selected" : ""}>无认证</option><option value="BASIC" ${authMode === "BASIC" ? "selected" : ""}>用户名密码</option><option value="OAUTH" ${authMode === "OAUTH" ? "selected" : ""}>OAuth Token</option></select></label><span></span><label class="field preheat-auth-field" data-auth-mode="BASIC"><span>用户名</span><input name="auth_username" autocomplete="username" placeholder="${instance ? "留空保持原凭据" : "用户名"}"></label><label class="field preheat-auth-field" data-auth-mode="BASIC"><span>密码</span><input name="auth_password" type="password" autocomplete="new-password" placeholder="${instance ? "留空保持原凭据" : "密码"}"></label><label class="field field-span preheat-auth-field" data-auth-mode="OAUTH"><span>OAuth Token</span><input name="auth_token" type="password" autocomplete="new-password" placeholder="${instance ? "留空保持原 Token" : "访问 Token"}"></label></div><div class="check-grid"><label class="check-row"><input name="enabled" type="checkbox" ${instance?.enabled !== false ? "checked" : ""}><span><strong>启用实例</strong><small>允许项目预热策略使用该实例</small></span></label><label class="check-row"><input name="insecure" type="checkbox" ${instance?.insecure ? "checked" : ""}><span><strong>跳过 TLS 验证</strong><small>仅用于可信内网或自签名证书</small></span></label></div><div class="registry-dialog-actions"><span>保存前可使用当前表单配置检查 Provider 健康状态。</span><button id="test-preheat-draft" class="button button-small" type="button">${icon("refresh")}<span>测试连接</span></button></div>`,
    onSubmit: async (formData) => {
      const payload = preheatInstancePayload(formData, instance);
      await controlMutation(instance ? "preheat-instance" : "preheat-instances", instance ? { name: instance.name } : {}, instance ? "PUT" : "POST", payload);
      closeControlDialog();
      showToast(instance ? "P2P 实例已更新" : "P2P 实例已创建");
      renderCurrentView(true);
    },
  });
  bindPreheatInstanceForm(instance);
}

function bindPreheatInstanceForm(instance) {
  const form = document.querySelector("#control-dialog-form");
  if (!form) return;
  const applyMode = () => {
    const mode = String(form.elements.auth_mode.value || "NONE");
    form.querySelectorAll(".preheat-auth-field").forEach((field) => { field.hidden = field.dataset.authMode !== mode; });
    const requireCredentials = !instance;
    if (form.elements.auth_username) form.elements.auth_username.required = requireCredentials && mode === "BASIC";
    if (form.elements.auth_password) form.elements.auth_password.required = requireCredentials && mode === "BASIC";
    if (form.elements.auth_token) form.elements.auth_token.required = requireCredentials && mode === "OAUTH";
  };
  form.elements.auth_mode.addEventListener("change", applyMode);
  form.querySelector("#test-preheat-draft")?.addEventListener("click", () => testPreheatDraft(form, instance));
  applyMode();
}

function preheatInstancePayload(formData, instance = null) {
  const authMode = String(formData.get("auth_mode") || "NONE");
  const payload = {
    name: String(formData.get("name") || "").trim(),
    description: String(formData.get("description") || "").trim(),
    vendor: String(formData.get("vendor") || "").trim(),
    endpoint: String(formData.get("endpoint") || "").trim(),
    auth_mode: authMode,
    enabled: formData.has("enabled"),
    insecure: formData.has("insecure"),
  };
  if (instance?.id) payload.id = Number(instance.id);
  if (authMode === "BASIC") {
    const username = String(formData.get("auth_username") || "").trim();
    const password = String(formData.get("auth_password") || "");
    payload.auth_info = username || password ? { username, password } : {};
  } else if (authMode === "OAUTH") {
    const token = String(formData.get("auth_token") || "");
    payload.auth_info = token ? { token } : {};
  }
  return payload;
}

async function testPreheatDraft(form, instance) {
  if (!form.reportValidity()) return;
  const button = form.querySelector("#test-preheat-draft");
  setButtonBusy(button, true, "正在测试");
  try {
    await controlMutation("preheat-instance-ping", {}, "POST", preheatInstancePayload(new FormData(form), instance));
    showToast("P2P Provider 连接正常");
  } catch (error) {
    showDialogError(form, error.message);
  } finally {
    setButtonBusy(button, false);
  }
}

async function pingPreheatInstance(id) {
  try {
    await controlMutation("preheat-instance-ping", {}, "POST", { id: Number(id) });
    showToast("P2P Provider 连接正常");
  } catch (error) {
    showToast(error.message, true);
  }
}

function confirmDeletePreheatInstance(name) {
  confirmControlDelete("删除 P2P 实例", `实例 ${name} 将被删除，引用它的预热策略必须先调整。`, "删除实例", async () => {
    await controlMutation("preheat-instance", { name }, "DELETE");
    showToast("P2P 实例已删除");
    renderCurrentView(true);
  }, name);
}

function preheatFilterValue(policy, type, fallback = "") {
  const filters = asArray(parsePreheatJSON(policy?.filters, []));
  const value = filters.find((filter) => filter.type === type)?.value;
  const text = String(value ?? fallback);
  return /^\{.*\}$/.test(text) ? text.slice(1, -1) : text;
}

function preheatPatternValue(value) {
  const text = String(value || "").trim();
  return text.includes(",") && !/^\{.*\}$/.test(text) ? `{${text}}` : text;
}

function showPreheatPolicyDialog(policy = null) {
  const providers = asArray(state.controlProjectCollection?.providers);
  if (!providers.length) {
    showToast("请先注册并启用 P2P Provider 实例", true);
    return;
  }
  const trigger = parsePreheatJSON(policy?.trigger, { type: "manual", trigger_setting: { cron: "" } });
  const extra = parsePreheatJSON(policy?.extra_attrs, {});
  const selectedProvider = String(policy?.provider_id || providers.find((provider) => provider.default)?.id || providers[0].id);
  openControlDialog({
    title: policy ? "编辑预热策略" : "新建预热策略",
    subtitle: state.route.project,
    submitLabel: policy ? "保存策略" : "创建策略",
    content: `<div class="form-grid two-columns"><label class="field"><span>Provider 实例</span><select name="provider_id" required>${providers.map((provider) => `<option value="${escapeAttr(provider.id)}" data-provider="${escapeAttr(provider.provider)}" ${String(provider.id) === selectedProvider ? "selected" : ""}>${escapeHTML(provider.provider)}${provider.default ? "（默认）" : ""}</option>`).join("")}</select></label><label class="field"><span>策略名称</span><input name="name" required maxlength="255" pattern="[A-Za-z0-9]+([._-][A-Za-z0-9]+)*" value="${escapeAttr(policy?.name || "")}"></label><label class="field field-span"><span>描述</span><input name="description" maxlength="1024" value="${escapeAttr(policy?.description || "")}"></label><label class="field"><span>仓库筛选</span><input name="repository" required value="${escapeAttr(preheatFilterValue(policy, "repository", "**"))}" placeholder="**"></label><label class="field"><span>Tag 筛选</span><input name="tag" required value="${escapeAttr(preheatFilterValue(policy, "tag", "**"))}" placeholder="**"></label><label class="field field-span"><span>标签筛选</span><input name="label" value="${escapeAttr(preheatFilterValue(policy, "label"))}" placeholder="可选；多个标签用逗号分隔"></label><label class="field"><span>触发方式</span><select name="trigger"><option value="manual" ${trigger.type === "manual" ? "selected" : ""}>手动</option><option value="scheduled" ${trigger.type === "scheduled" ? "selected" : ""}>定时</option><option value="event_based" ${trigger.type === "event_based" ? "selected" : ""}>制品推送事件</option></select></label><label class="field preheat-cron-field"><span>Cron 表达式</span><input name="cron" value="${escapeAttr(asObject(trigger.trigger_setting).cron || "0 0 2 * * *")}" placeholder="0 0 2 * * *"><small class="field-help">Harbor 使用含秒字段的 Cron 表达式。</small></label><label class="field preheat-dragonfly-field"><span>Dragonfly 分发范围</span><select name="scope"><option value="single_seed_peer" ${extra.scope === "single_seed_peer" || !extra.scope ? "selected" : ""}>单个 Seed Peer</option><option value="all_seed_peers" ${extra.scope === "all_seed_peers" ? "selected" : ""}>全部 Seed Peer</option><option value="all_peers" ${extra.scope === "all_peers" ? "selected" : ""}>全部 Peer</option></select></label><label class="field preheat-dragonfly-field"><span>Dragonfly 集群 ID</span><input name="cluster_ids" value="${escapeAttr(asArray(extra.cluster_ids).join(","))}" placeholder="1,2,3"></label></div><label class="check-row"><input name="enabled" type="checkbox" ${policy?.enabled !== false ? "checked" : ""}><span><strong>启用预热策略</strong><small>停用后保留配置但不再触发新任务</small></span></label>`,
    onSubmit: async (formData) => {
      const payload = preheatPolicyPayload(formData, policy);
      await controlMutation(policy ? "preheat-policy" : "preheat-policies", policy ? { project: state.route.project, name: policy.name } : { project: state.route.project }, policy ? "PUT" : "POST", payload);
      closeControlDialog();
      showToast(policy ? "预热策略已更新" : "预热策略已创建");
      renderCurrentView(true);
    },
  });
  bindPreheatPolicyForm();
}

function bindPreheatPolicyForm() {
  const form = document.querySelector("#control-dialog-form");
  if (!form) return;
  const apply = () => {
    const scheduled = form.elements.trigger.value === "scheduled";
    const cronField = form.querySelector(".preheat-cron-field");
    if (cronField) cronField.hidden = !scheduled;
    form.elements.cron.required = scheduled;
    const option = form.elements.provider_id.selectedOptions[0];
    const dragonfly = String(option?.dataset.provider || "").startsWith("dragonfly");
    form.querySelectorAll(".preheat-dragonfly-field").forEach((field) => { field.hidden = !dragonfly; });
  };
  form.elements.trigger.addEventListener("change", apply);
  form.elements.provider_id.addEventListener("change", apply);
  apply();
}

function preheatPolicyPayload(formData, policy = null) {
  const filters = [
    { type: "repository", value: preheatPatternValue(formData.get("repository")) },
    { type: "tag", value: preheatPatternValue(formData.get("tag")) },
  ];
  const label = preheatPatternValue(formData.get("label"));
  if (label) filters.push({ type: "label", value: label });
  const triggerType = String(formData.get("trigger") || "manual");
  const providerID = Number(formData.get("provider_id"));
  const provider = asArray(state.controlProjectCollection?.providers).find((item) => Number(item.id) === providerID);
  const extra = {};
  if (String(provider?.provider || "").startsWith("dragonfly")) {
    const scope = String(formData.get("scope") || "").trim();
    const clusterIDs = String(formData.get("cluster_ids") || "").split(",").map((item) => Number(item.trim())).filter((item) => Number.isInteger(item) && item > 0);
    if (scope) extra.scope = scope;
    if (clusterIDs.length) extra.cluster_ids = clusterIDs;
  }
  const payload = {
    name: String(formData.get("name") || "").trim(),
    description: String(formData.get("description") || "").trim(),
    project_id: Number(state.controlProject.project_id),
    provider_id: providerID,
    filters: JSON.stringify(filters),
    trigger: JSON.stringify({ type: triggerType, trigger_setting: { cron: triggerType === "scheduled" ? String(formData.get("cron") || "").trim() : "" } }),
    enabled: formData.has("enabled"),
  };
  if (Object.keys(extra).length) payload.extra_attrs = JSON.stringify(extra);
  if (policy?.id) payload.id = Number(policy.id);
  return payload;
}

function confirmDeletePreheatPolicy(name) {
  confirmControlDelete("删除预热策略", `策略 ${name} 及其执行记录入口将被删除。`, "删除策略", async () => {
    await controlMutation("preheat-policy", { project: state.route.project, name }, "DELETE");
    showToast("预热策略已删除");
    renderCurrentView(true);
  });
}

function confirmRunPreheatPolicy(name) {
  const policy = asArray(state.controlProjectItems).find((item) => item.name === name);
  if (!policy) return;
  openControlDialog({
    title: "立即执行 P2P 预热",
    subtitle: name,
    submitLabel: "开始预热",
    submitIcon: "play",
    content: `<div class="info-banner">${icon("play")}<span>Harbor 将按当前仓库、Tag 与标签筛选条件创建预热任务。</span></div>`,
    onSubmit: async () => {
      await controlMutation("preheat-policy", { project: state.route.project, name }, "POST", runnablePreheatPolicy(policy));
      closeControlDialog();
      showToast("P2P 预热执行已启动");
      renderCurrentView(true);
    },
  });
}

function runnablePreheatPolicy(policy) {
  const payload = {
    name: String(policy.name || ""),
    description: String(policy.description || ""),
    project_id: Number(policy.project_id || state.controlProject?.project_id),
    provider_id: Number(policy.provider_id),
    filters: typeof policy.filters === "string" ? policy.filters : JSON.stringify(asArray(policy.filters)),
    trigger: typeof policy.trigger === "string" ? policy.trigger : JSON.stringify(asObject(policy.trigger)),
    enabled: policy.enabled !== false,
  };
  if (Number(policy.id) > 0) payload.id = Number(policy.id);
  if (typeof policy.extra_attrs === "string" && policy.extra_attrs.trim()) payload.extra_attrs = policy.extra_attrs;
  else if (policy.extra_attrs && typeof policy.extra_attrs === "object") payload.extra_attrs = JSON.stringify(policy.extra_attrs);
  return payload;
}

async function showPreheatExecutionsDialog(policyName) {
  openControlDialog({ title: `预热策略 ${policyName}`, subtitle: "正在读取执行记录", submitLabel: "关闭", submitIcon: "x", hideCancel: true, content: `<div class="dialog-loading"><span class="spinner"></span><span>正在载入预热执行...</span></div>`, onSubmit: async () => closeControlDialog() });
  const dialog = document.querySelector("#control-dialog");
  if (dialog) {
    dialog.dataset.preheatPolicy = policyName;
    dialog.querySelector(".control-dialog")?.classList.add("control-dialog-wide");
  }
  try {
    const executions = await controlList("preheat-executions", { project: state.route.project, name: policyName, page: 1, page_size: 100, sort: "-start_time" });
    const active = document.querySelector(`#control-dialog[data-preheat-policy="${CSS.escape(policyName)}"]`);
    if (!active) return;
    active.querySelector(".control-dialog-body").innerHTML = `<section class="replication-task-section"><div class="section-heading compact-heading"><div><h3>预热执行记录</h3><p>共 ${formatNumber(executions.pagination.total)} 次执行</p></div></div><div class="table-scroll">${preheatExecutionTable(executions.items, policyName)}</div></section>`;
    const subtitle = active.querySelector("header p");
    if (subtitle) subtitle.textContent = `${formatNumber(executions.pagination.total)} 次执行`;
  } catch (error) {
    const form = document.querySelector("#control-dialog-form");
    if (form) showDialogError(form, error.message);
  }
}

function preheatExecutionTable(executions, policyName) {
  if (!executions.length) return emptyTable("暂无预热执行", "手动执行或触发策略后会显示在这里。", "history");
  return `<table><thead><tr><th>执行</th><th>触发方式</th><th>状态</th><th>任务</th><th>成功</th><th>失败</th><th>开始时间</th><th>耗时</th><th></th></tr></thead><tbody>${executions.map((execution) => { const metrics = asObject(execution.metrics); return `<tr><td class="mono">#${escapeHTML(execution.id)}</td><td>${preheatTriggerLabel(execution.trigger)}</td><td>${statusBadge(execution.status)}</td><td>${formatNumber(metrics.task_count)}</td><td class="success-text">${formatNumber(metrics.success_task_count)}</td><td class="danger-text">${formatNumber(metrics.error_task_count)}</td><td>${formatDate(execution.start_time)}</td><td>${formatDuration(execution.start_time, execution.end_time)}</td><td><button class="button button-small" type="button" data-action="view-preheat-execution" data-policy="${escapeAttr(policyName)}" data-id="${escapeAttr(execution.id)}">${icon("history")}<span>查看任务</span></button></td></tr>`; }).join("")}</tbody></table>`;
}

async function showPreheatExecutionDialog(policyName, executionID) {
  state.preheatTaskLog = "";
  state.preheatLogPolicyName = String(policyName || "");
  state.preheatLogExecutionID = String(executionID || "");
  state.preheatLogTaskID = "";
  openControlDialog({ title: `预热执行 #${executionID}`, subtitle: policyName, submitLabel: "关闭", submitIcon: "x", hideCancel: true, content: `<div class="dialog-loading"><span class="spinner"></span><span>正在载入预热任务...</span></div>`, onSubmit: async () => closeControlDialog() });
  const dialog = document.querySelector("#control-dialog");
  if (dialog) {
    dialog.dataset.preheatExecution = String(executionID);
    dialog.querySelector(".control-dialog")?.classList.add("control-dialog-wide");
  }
  try {
    const [execution, tasks] = await Promise.all([
      controlData("preheat-execution", { project: state.route.project, name: policyName, id: executionID }),
      controlList("preheat-tasks", { project: state.route.project, name: policyName, id: executionID, page: 1, page_size: 100, sort: "-creation_time" }),
    ]);
    const active = document.querySelector(`#control-dialog[data-preheat-execution="${CSS.escape(String(executionID))}"]`);
    if (!active) return;
    active.querySelector(".control-dialog-body").innerHTML = preheatExecutionDetail(execution, tasks, policyName);
    const subtitle = active.querySelector("header p");
    if (subtitle) subtitle.textContent = `${statusInfo(execution.status)[0]} · ${formatNumber(tasks.pagination.total)} 个任务`;
  } catch (error) {
    const form = document.querySelector("#control-dialog-form");
    if (form) showDialogError(form, error.message);
  }
}

function preheatExecutionDetail(execution, tasks, policyName) {
  const metrics = asObject(execution.metrics);
  const canStop = ["pending", "running", "scheduled"].includes(String(execution.status || "").toLowerCase());
  return `<section class="execution-summary"><div class="execution-summary-head"><div>${statusBadge(execution.status)}<span>${preheatTriggerLabel(execution.trigger)}</span><span>${formatDate(execution.start_time)}</span></div>${canStop ? `<button class="button button-small button-danger" type="button" data-action="stop-preheat-execution" data-policy="${escapeAttr(policyName)}" data-id="${escapeAttr(execution.id)}">${icon("x")}<span>停止执行</span></button>` : ""}</div><dl class="execution-stats"><div><dt>总任务</dt><dd>${formatNumber(metrics.task_count ?? tasks.pagination.total)}</dd></div><div><dt>成功</dt><dd class="success-text">${formatNumber(metrics.success_task_count)}</dd></div><div><dt>失败</dt><dd class="danger-text">${formatNumber(metrics.error_task_count)}</dd></div><div><dt>进行中</dt><dd>${formatNumber(metrics.running_task_count)}</dd></div><div><dt>已停止</dt><dd>${formatNumber(metrics.stopped_task_count)}</dd></div><div><dt>耗时</dt><dd>${formatDuration(execution.start_time, execution.end_time)}</dd></div></dl></section><section class="replication-task-section"><div class="section-heading compact-heading"><div><h3>预热任务</h3><p>共 ${formatNumber(tasks.pagination.total)} 项</p></div></div><div class="table-scroll replication-task-table">${preheatTaskTable(tasks.items, policyName, execution.id)}</div></section><section id="preheat-log-view" class="replication-log-view" hidden><header><div><h3>任务日志</h3><p id="preheat-log-title"></p></div><div class="log-view-actions"><span id="preheat-log-status"></span>${logTimezoneControl()}<button class="icon-button" type="button" data-action="refresh-preheat-task-log" title="刷新日志" aria-label="刷新预热任务日志">${icon("refresh")}</button><button class="icon-button" type="button" data-action="copy-preheat-task-log" title="复制日志" aria-label="复制预热任务日志">${icon("copy")}</button><button class="icon-button" type="button" data-action="download-preheat-task-log" title="下载日志" aria-label="下载预热任务日志">${icon("download")}</button><button class="icon-button" type="button" data-action="hide-preheat-log" title="关闭日志" aria-label="关闭日志">${icon("x")}</button></div></header><div id="preheat-log-content" class="structured-log-view" role="table" aria-label="预热任务日志"></div></section>`;
}

function preheatTaskTable(tasks, policyName, executionID) {
  if (!tasks.length) return emptyTable("暂无预热任务", "该执行记录还没有返回任务明细。", "history");
  return `<table><thead><tr><th>任务</th><th>制品</th><th>摘要</th><th>类型</th><th>状态</th><th>重试</th><th>开始时间</th><th>结束时间</th><th>日志</th></tr></thead><tbody>${tasks.map((task) => { const extra = asObject(task.extra_attrs); return `<tr><td class="mono">#${escapeHTML(task.id)}</td><td class="replication-resource" title="${escapeAttr(extra.artifact)}">${escapeHTML(extra.artifact || "-")}</td><td><code title="${escapeAttr(extra.digest)}">${escapeHTML(shortDigest(extra.digest))}</code></td><td>${resourceTypeLabel(extra.kind)}</td><td>${statusBadge(task.status)}</td><td>${formatNumber(task.run_count)}</td><td>${formatDate(task.start_time)}</td><td>${formatDate(task.end_time)}</td><td><button class="icon-button" type="button" data-action="view-preheat-task-log" data-policy="${escapeAttr(policyName)}" data-execution-id="${escapeAttr(executionID)}" data-task-id="${escapeAttr(task.id)}" title="查看日志" aria-label="查看任务日志">${icon("history")}</button></td></tr>`; }).join("")}</tbody></table>`;
}

async function viewPreheatTaskLog(policyName, executionID, taskID, button) {
  state.preheatLogPolicyName = String(policyName || "");
  state.preheatLogExecutionID = String(executionID || "");
  state.preheatLogTaskID = String(taskID || "");
  state.preheatTaskLog = "";
  const view = document.querySelector("#preheat-log-view");
  if (!view) return;
  view.hidden = false;
  view.querySelector("#preheat-log-title").textContent = `执行 #${executionID} · 任务 #${taskID}`;
  view.scrollIntoView({ behavior: "smooth", block: "nearest" });
  setButtonBusy(button, true, "");
  try {
    await refreshPreheatTaskLog();
  } finally {
    setButtonBusy(button, false);
  }
}

async function refreshPreheatTaskLog() {
  const output = document.querySelector("#preheat-log-content");
  const status = document.querySelector("#preheat-log-status");
  if (!output || !state.preheatLogPolicyName || !state.preheatLogExecutionID || !state.preheatLogTaskID) return;
  output.textContent = "正在加载...";
  if (status) status.textContent = "正在读取";
  try {
    const data = await controlData("preheat-task-log", { project: state.route.project, name: state.preheatLogPolicyName, id: state.preheatLogExecutionID, task: state.preheatLogTaskID });
    const text = typeof data === "string" ? data : JSON.stringify(data ?? "", null, 2);
    state.preheatTaskLog = text;
    if (!document.body.contains(output)) return;
    setHarborLogContent(output, text, "Harbor 没有返回预热任务日志。");
    if (status) status.textContent = `${formatNumber(text.length)} 字符`;
  } catch (error) {
    if (!document.body.contains(output)) return;
    output.textContent = error.message;
    if (status) status.textContent = "载入失败";
  }
}

function downloadPreheatTaskLog() {
  const execution = String(state.preheatLogExecutionID || "").replace(/[^0-9]/g, "") || "execution";
  const task = String(state.preheatLogTaskID || "").replace(/[^0-9]/g, "") || "task";
  downloadControlLog(state.preheatTaskLog, `harbor-preheat-${execution}-${task}.log`, "当前没有可下载的预热任务日志", "预热任务日志已下载");
}

function confirmStopPreheatExecution(policyName, executionID) {
  openControlDialog({
    title: "停止 P2P 预热执行",
    subtitle: `执行 #${executionID}`,
    submitLabel: "停止执行",
    submitIcon: "x",
    destructive: true,
    content: `<div class="destructive-message">${icon("alert")}<span>已经完成的预热任务不会回滚，运行中的任务将由 Harbor 请求停止。</span></div>`,
    onSubmit: async () => {
      await controlMutation("preheat-execution", { project: state.route.project, name: policyName, id: executionID }, "PATCH", { status: "Stopped" });
      closeControlDialog();
      showToast("P2P 预热执行已停止");
      renderCurrentView(true);
    },
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && document.querySelector("#control-dialog")) closeControlDialog();
});

bootstrap();
