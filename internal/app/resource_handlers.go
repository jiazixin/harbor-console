package app

import (
	"encoding/json"
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
		writeError(w, r, errSessionRequired)
		return
	}
	if len(r.URL.RawQuery) > maxQueryBytes {
		writeError(w, r, errQueryTooLong)
		return
	}
	kind := r.PathValue("kind")
	spec, ok := resourceSpecs[kind]
	if !ok {
		writeError(w, r, failure(http.StatusNotFound, "not_found", "resource is not in the Harbor proxy allowlist"))
		return
	}
	input := r.URL.Query()
	pathSpec := controlSpec{path: spec.path}
	for _, key := range spec.requiredQuery {
		pathSpec.params = append(pathSpec.params, controlParam{name: key, placeholder: key, doubleEncode: key == "repository"})
	}
	path, headers, err := buildControlPath(pathSpec, input)
	if err != nil {
		writeError(w, r, err)
		return
	}
	if input.Get("page_size") == "" && slicesContain(spec.allowedQuery, "page_size") {
		input.Set("page_size", "50")
	}
	query, err := buildControlQuery(spec.allowedQuery, input, true)
	if err != nil {
		writeError(w, r, err)
		return
	}
	if current.Demo {
		payload, ok := demoResource(kind, input)
		if !ok {
			writeError(w, r, errDemoDataMissing)
			return
		}
		writeJSON(w, http.StatusOK, payload)
		return
	}
	response, err := a.harborRequest(r.Context(), harborRequestOptions{current: current, method: http.MethodGet, path: path, query: query, body: nil, headers: headers})
	if err != nil {
		writeUpstreamError(w, r, err)
		return
	}
	var payload any
	if len(response.Body) > 0 {
		if err := json.Unmarshal(response.Body, &payload); err != nil {
			writeError(w, r, errInvalidHarborJSON)
			return
		}
	}
	writeJSON(w, http.StatusOK, payload)
}

func (a *app) handleSearch(w http.ResponseWriter, r *http.Request) {
	current, ok := a.currentSession(r)
	if !ok {
		writeError(w, r, errSessionRequired)
		return
	}
	term := strings.TrimSpace(r.URL.Query().Get("q"))
	if len(term) < 2 {
		writeError(w, r, invalidField("q", "search_term_too_short", "must contain at least two characters"))
		return
	}
	if len(term) > 200 {
		writeError(w, r, invalidField("q", "too_long", "must not exceed 200 characters"))
		return
	}
	if current.Demo {
		writeJSON(w, http.StatusOK, demoSearch(term))
		return
	}
	var payload any
	if err := a.harborGetJSON(r.Context(), harborJSONRequest{current: current, path: "/api/v2.0/search", query: url.Values{"q": {term}}, out: &payload}); err != nil {
		writeUpstreamError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, payload)
}
