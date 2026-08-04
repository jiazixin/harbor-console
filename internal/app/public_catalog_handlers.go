package app

import (
	"errors"
	"net/http"
	"net/url"
	"strconv"
	"strings"
)

func (a *app) handlePublicProjects(w http.ResponseWriter, r *http.Request) {
	a.handlePublicCatalog(w, r, "projects")
}

func (a *app) handlePublicRepositories(w http.ResponseWriter, r *http.Request) {
	a.handlePublicCatalog(w, r, "repositories")
}

func (a *app) handlePublicArtifacts(w http.ResponseWriter, r *http.Request) {
	a.handlePublicCatalog(w, r, "artifacts")
}

func (a *app) handlePublicCatalog(w http.ResponseWriter, r *http.Request, resource string) {
	if !sameOrigin(r) {
		writeError(w, http.StatusForbidden, "请求来源无效", "请从当前控制台浏览公开目录")
		return
	}
	if !a.publicLimits.allow(clientIP(r)) {
		writeError(w, http.StatusTooManyRequests, "公开目录请求过于频繁", "请稍后重试")
		return
	}
	var input publicCatalogRequest
	if err := decodeJSON(w, r, &input); err != nil {
		writeError(w, http.StatusBadRequest, "公开目录请求无效", err.Error())
		return
	}
	current, query, path, headers, err := a.buildPublicCatalogRequest(input, resource)
	if err != nil {
		writeError(w, http.StatusBadRequest, "公开目录请求无效", err.Error())
		return
	}
	response, err := a.harborRequest(r.Context(), current, http.MethodGet, path, query, nil, headers)
	if err != nil {
		writeUpstreamError(w, err)
		return
	}
	writeControlResponse(w, response, controlMethod{list: true}, query)
}

func (a *app) buildPublicCatalogRequest(input publicCatalogRequest, resource string) (*session, url.Values, string, http.Header, error) {
	instanceURL, err := validateHarborURL(input.URL)
	if err != nil {
		return nil, nil, "", nil, err
	}
	if len(input.URL) > 2048 {
		return nil, nil, "", nil, errors.New("Harbor 地址长度超过限制")
	}
	page := input.Page
	if page == 0 {
		page = 1
	}
	pageSize := input.PageSize
	if pageSize == 0 {
		pageSize = 20
	}
	if page < 1 || page > 1_000_000 || pageSize < 1 || pageSize > 100 {
		return nil, nil, "", nil, errors.New("分页参数超出允许范围")
	}
	if len(input.Query) > 255 || strings.ContainsAny(input.Query, "\r\n\x00,=") {
		return nil, nil, "", nil, errors.New("搜索内容包含无效字符或长度过长")
	}
	current := &session{InstanceURL: instanceURL, SkipTLSVerify: input.SkipTLSVerify, Client: a.newClient(input.SkipTLSVerify)}
	query := url.Values{"page": {strconv.Itoa(page)}, "page_size": {strconv.Itoa(pageSize)}}
	headers := make(http.Header)
	switch resource {
	case "projects":
		query.Set("sort", "name")
		query.Set("public", "true")
		query.Set("with_detail", "true")
		if term := strings.TrimSpace(input.Query); term != "" {
			query.Set("q", "name=~"+term)
		}
		return current, query, "/api/v2.0/projects", headers, nil
	case "repositories", "artifacts":
		project := strings.TrimSpace(input.Project)
		if err := validateResourceName(project, "项目名称", 255, false); err != nil {
			return nil, nil, "", nil, err
		}
		headers.Set("X-Is-Resource-Name", "true")
		base := "/api/v2.0/projects/" + url.PathEscape(project) + "/repositories"
		if resource == "repositories" {
			query.Set("sort", "name")
			if term := strings.TrimSpace(input.Query); term != "" {
				query.Set("q", "name=~"+term)
			}
			return current, query, base, headers, nil
		}
		repository := strings.TrimSpace(input.Repository)
		repository = strings.TrimPrefix(repository, project+"/")
		if repository == "" || len(repository) > 1024 || strings.ContainsAny(repository, "\r\n\x00") {
			return nil, nil, "", nil, errors.New("仓库名称无效")
		}
		query.Set("sort", "-push_time")
		query.Set("with_tag", "true")
		query.Set("with_label", "true")
		query.Set("with_scan_overview", "true")
		query.Set("with_accessory", "true")
		path := base + "/" + url.PathEscape(url.PathEscape(repository)) + "/artifacts"
		return current, query, path, headers, nil
	default:
		return nil, nil, "", nil, errors.New("未知公开目录资源")
	}
}
