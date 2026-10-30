package app

import (
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
	if !a.publicLimits.allow(clientIP(r)) {
		writeError(w, r, errRateLimited)
		return
	}
	var input publicCatalogRequest
	if err := decodeJSON(w, r, &input); err != nil {
		writeError(w, r, err)
		return
	}
	current, query, path, headers, err := a.buildPublicCatalogRequest(input, resource)
	if err != nil {
		writeError(w, r, err)
		return
	}
	defer current.Client.CloseIdleConnections()
	response, err := a.harborRequest(r.Context(), harborRequestOptions{current: current, method: http.MethodGet, path: path, query: query, body: nil, headers: headers})
	if err != nil {
		writeUpstreamError(w, r, err)
		return
	}
	writeControlResponse(w, r, controlResponse{response: response, config: controlMethod{list: true}, query: query})
}

func (a *app) buildPublicCatalogRequest(input publicCatalogRequest, resource string) (*session, url.Values, string, http.Header, error) {
	instanceURL, err := validateHarborURL(input.URL)
	if err != nil {
		return nil, nil, "", nil, err
	}
	if len(input.URL) > 2048 {
		return nil, nil, "", nil, invalidField("url", "too_long", "exceeds 2048 bytes")
	}
	pageSize := input.Limit
	if pageSize == 0 {
		pageSize = 20
	}
	if pageSize < 1 || pageSize > 100 {
		return nil, nil, "", nil, invalidField("limit", "out_of_range", "must be from 1 to 100")
	}
	if input.Offset < 0 || input.Offset%pageSize != 0 || input.Offset/pageSize >= 1_000_000 {
		return nil, nil, "", nil, invalidField("offset", "invalid_value", "must be a non-negative multiple of limit")
	}
	page := input.Offset/pageSize + 1
	if len(input.Query) > 255 || strings.ContainsAny(input.Query, "\r\n\x00,=") {
		return nil, nil, "", nil, invalidField("query", "invalid_text", "contains invalid characters or is too long")
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
		if err := validateResourceName(resourceNameValidation{value: project, path: "project", maximum: 255, allowSpaces: false}); err != nil {
			return nil, nil, "", nil, err
		}
		if err := validatePathParameter(project, "project"); err != nil {
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
		if err := validatePathParameter(repository, "repository"); err != nil {
			return nil, nil, "", nil, err
		}
		query.Set("sort", "-push_time")
		query.Set("with_tag", "true")
		query.Set("with_label", "true")
		query.Set("with_scan_overview", "true")
		query.Set("with_accessory", "true")
		path := base + "/" + url.PathEscape(url.PathEscape(repository)) + "/artifacts"
		return current, query, path, headers, nil
	default:
		return nil, nil, "", nil, failure(http.StatusNotFound, "not_found", "unknown public catalog resource")
	}
}
