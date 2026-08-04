package app

import (
	"net/http"
	"net/url"
	"strings"
)

type resourceSpec struct {
	path          string
	requiredQuery []string
	allowedQuery  []string
}

var resourceSpecs = map[string]resourceSpec{
	"projects": {
		path: "/api/v2.0/projects", allowedQuery: []string{"page", "page_size", "sort", "name", "public"},
	},
	"repositories": {
		path: "/api/v2.0/projects/{project}/repositories", requiredQuery: []string{"project"}, allowedQuery: []string{"page", "page_size", "sort", "q"},
	},
	"artifacts": {
		path: "/api/v2.0/projects/{project}/repositories/{repository}/artifacts", requiredQuery: []string{"project", "repository"}, allowedQuery: []string{"page", "page_size", "sort", "q", "with_tag", "with_scan_overview", "with_label", "with_accessory", "with_signature"},
	},
	"replication-policies": {
		path: "/api/v2.0/replication/policies", allowedQuery: []string{"page", "page_size", "sort", "name"},
	},
	"replications": {
		path: "/api/v2.0/replication/executions", allowedQuery: []string{"page", "page_size", "sort", "policy_id", "status", "trigger"},
	},
	"registries": {
		path: "/api/v2.0/registries", allowedQuery: []string{"page", "page_size", "sort", "name"},
	},
	"scanners": {path: "/api/v2.0/scanners"},
	"audit-logs": {
		path: "/api/v2.0/auditlog-exts", allowedQuery: []string{"q", "page", "page_size", "sort"},
	},
	"systeminfo": {path: "/api/v2.0/systeminfo"},
	"volumes":    {path: "/api/v2.0/systeminfo/volumes"},
	"health":     {path: "/api/v2.0/health"},
}

func (a *app) handleResource(w http.ResponseWriter, r *http.Request) {
	current, ok := a.currentSession(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "会话已失效", "请重新连接 Harbor")
		return
	}
	if len(r.URL.RawQuery) > maxQueryBytes {
		writeError(w, http.StatusBadRequest, "查询参数过长", "请缩短筛选条件后重试")
		return
	}
	kind := r.PathValue("kind")
	spec, ok := resourceSpecs[kind]
	if !ok {
		writeError(w, http.StatusNotFound, "未知资源", "该资源不在 Harbor 代理允许列表中")
		return
	}
	if current.Demo {
		payload, ok := demoResource(kind, r.URL.Query())
		if !ok {
			writeError(w, http.StatusNotFound, "没有演示数据", "该资源尚无演示数据")
			return
		}
		writeJSON(w, http.StatusOK, payload)
		return
	}

	path := spec.path
	for _, key := range spec.requiredQuery {
		value := strings.TrimSpace(r.URL.Query().Get(key))
		if value == "" {
			writeError(w, http.StatusBadRequest, "缺少查询参数", key+" 是必填参数")
			return
		}
		if key == "repository" {
			value = strings.TrimPrefix(value, strings.TrimSpace(r.URL.Query().Get("project"))+"/")
			value = url.PathEscape(url.PathEscape(value))
		} else {
			value = url.PathEscape(value)
		}
		path = strings.ReplaceAll(path, "{"+key+"}", value)
	}
	query := url.Values{}
	for _, key := range spec.allowedQuery {
		if values, exists := r.URL.Query()[key]; exists {
			for _, value := range values {
				query.Add(key, value)
			}
		}
	}
	if query.Get("page") == "" && slicesContain(spec.allowedQuery, "page") {
		query.Set("page", "1")
	}
	if query.Get("page_size") == "" && slicesContain(spec.allowedQuery, "page_size") {
		query.Set("page_size", "50")
	}
	var payload any
	if err := a.harborJSON(r.Context(), current, http.MethodGet, path, query, &payload); err != nil {
		writeUpstreamError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, payload)
}

func (a *app) handleSearch(w http.ResponseWriter, r *http.Request) {
	current, ok := a.currentSession(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "会话已失效", "请重新连接 Harbor")
		return
	}
	term := strings.TrimSpace(r.URL.Query().Get("q"))
	if len(term) < 2 {
		writeError(w, http.StatusBadRequest, "搜索词太短", "至少输入两个字符")
		return
	}
	if len(term) > 200 {
		writeError(w, http.StatusBadRequest, "搜索词太长", "搜索词不能超过 200 个字符")
		return
	}
	if current.Demo {
		writeJSON(w, http.StatusOK, demoSearch(term))
		return
	}
	var payload any
	if err := a.harborJSON(r.Context(), current, http.MethodGet, "/api/v2.0/search", url.Values{"q": {term}}, &payload); err != nil {
		writeUpstreamError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, payload)
}
