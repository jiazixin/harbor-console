package app

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
)

func (a *app) handleDashboard(w http.ResponseWriter, r *http.Request) {
	current, ok := a.currentSession(r)
	if !ok {
		writeError(w, r, errSessionRequired)
		return
	}
	if current.Demo {
		writeJSON(w, http.StatusOK, current.DemoData.dashboard())
		return
	}
	ctx := r.Context()

	type target struct {
		key   string
		path  string
		query url.Values
	}
	targets := []target{
		{key: "health", path: "/api/v2.0/health"},
		{key: "systeminfo", path: "/api/v2.0/systeminfo"},
		{key: "replications", path: "/api/v2.0/replication/executions", query: url.Values{"page": {"1"}, "page_size": {"6"}, "sort": {"-start_time"}}},
		{key: "replication_policies", path: "/api/v2.0/replication/policies", query: url.Values{"page": {"1"}, "page_size": {"100"}, "sort": {"name"}}},
		{key: "registries", path: "/api/v2.0/registries", query: url.Values{"page": {"1"}, "page_size": {"20"}}},
		{key: "scanners", path: "/api/v2.0/scanners"},
	}

	result := map[string]any{"mode": "live", "instance": sessionInfo(current)}
	warnings := make([]dashboardWarning, 0)
	var mu sync.Mutex
	var wg sync.WaitGroup
	for _, item := range targets {
		wg.Go(func() {
			var payload any
			err := a.harborGetJSON(ctx, harborJSONRequest{current: current, path: item.path, query: item.query, out: &payload})
			mu.Lock()
			defer mu.Unlock()
			if err != nil {
				warnings = append(warnings, newDashboardWarning(item.key, upstreamFailure(err)))
				return
			}
			result[item.key] = payload
		})
	}
	wg.Go(func() {
		projects, err := a.listAllProjects(ctx, current)
		mu.Lock()
		defer mu.Unlock()
		if err != nil {
			warnings = append(warnings, newDashboardWarning("projects", upstreamFailure(err)))
			return
		}
		result["projects"] = projects
	})
	wg.Wait()
	if projects, ok := result["projects"].([]any); ok {
		if a.enrichProjectAssets(ctx, current, projects) {
			warnings = append(warnings, newDashboardWarning("projects", failure(http.StatusServiceUnavailable, "asset_details_incomplete", "some project asset details could not be read; sorting may be incomplete")))
		}
		result["statistics"] = visibleProjectStatistics(projects)
	} else {
		result["statistics"] = visibleProjectStatistics(nil)
	}
	result["warnings"] = warnings
	writeJSON(w, http.StatusOK, result)
}

func (a *app) listAllProjects(ctx context.Context, current *session) ([]any, error) {
	projects := make([]any, 0)
	responseBytes := 0
	for page := 1; page <= maxCollectionPages; page++ {
		query := url.Values{
			"page":      {strconv.Itoa(page)},
			"page_size": {strconv.Itoa(dashboardProjectPageSize)},
			"sort":      {"-creation_time"},
		}
		response, err := a.harborRequest(ctx, harborRequestOptions{current: current, method: http.MethodGet, path: "/api/v2.0/projects", query: query, body: nil, headers: nil})
		if err != nil {
			return nil, err
		}
		var pageItems []any
		if err := json.Unmarshal(response.Body, &pageItems); err != nil {
			return nil, fmt.Errorf("decode Harbor projects: %w", err)
		}
		responseBytes += len(response.Body)
		if len(pageItems) > dashboardProjectPageSize || responseBytes > maxCollectionBytes {
			return nil, failure(http.StatusServiceUnavailable, "collection_too_large", "Harbor project collection exceeds its bounded budget")
		}
		projects = append(projects, pageItems...)
		total, totalErr := strconv.Atoi(response.Header.Get("X-Total-Count"))
		if len(pageItems) == 0 || (totalErr == nil && total >= 0 && len(projects) >= total) || (totalErr != nil && len(pageItems) < dashboardProjectPageSize) {
			return projects, nil
		}
	}
	return nil, failure(http.StatusServiceUnavailable, "collection_too_large", "Harbor projects exceed the pagination limit")
}

func (a *app) enrichProjectAssets(ctx context.Context, current *session, projects []any) bool {
	var wg sync.WaitGroup
	var mu sync.Mutex
	semaphore := make(chan struct{}, maxConcurrentProjectAssets)
	hadError := false
projectLoop:
	for _, rawProject := range projects {
		if ctx.Err() != nil {
			break
		}
		project, ok := rawProject.(map[string]any)
		if !ok {
			continue
		}
		name, _ := project["name"].(string)
		if strings.TrimSpace(name) == "" {
			continue
		}
		select {
		case semaphore <- struct{}{}:
		case <-ctx.Done():
			break projectLoop
		}
		wg.Go(func() {
			defer func() { <-semaphore }()
			headers := http.Header{"X-Is-Resource-Name": {"true"}}
			encodedName := url.PathEscape(name)
			summaryResponse, summaryErr := a.harborRequest(ctx, harborRequestOptions{current: current, method: http.MethodGet, path: "/api/v2.0/projects/" + encodedName + "/summary", query: nil, body: nil, headers: headers})
			if summaryErr == nil {
				var summary map[string]any
				if err := json.Unmarshal(summaryResponse.Body, &summary); err == nil {
					quota, _ := summary["quota"].(map[string]any)
					used, _ := quota["used"].(map[string]any)
					project["storage_used"] = numberValue(used["storage"])
				} else {
					summaryErr = err
				}
			}
			assetCounts, repositoriesErr := a.projectAssetCounts(ctx, current, encodedName, headers)
			if repositoriesErr == nil {
				project["repo_count"] = assetCounts.repositoryCount
				project["artifact_count"] = assetCounts.artifactCount
			}
			if summaryErr != nil || repositoriesErr != nil {
				mu.Lock()
				hadError = true
				mu.Unlock()
			}
		})
	}
	wg.Wait()
	return hadError || ctx.Err() != nil
}

type projectAssetCountsResult struct {
	repositoryCount int64
	artifactCount   int64
}

func (a *app) projectAssetCounts(ctx context.Context, current *session, encodedProjectName string, headers http.Header) (projectAssetCountsResult, error) {
	counts := projectAssetCountsResult{}
	path := "/api/v2.0/projects/" + encodedProjectName + "/repositories"
	for page := 1; page <= maxCollectionPages; page++ {
		query := url.Values{"page": {strconv.Itoa(page)}, "page_size": {strconv.Itoa(projectAssetPageSize)}}
		response, err := a.harborRequest(ctx, harborRequestOptions{current: current, method: http.MethodGet, path: path, query: query, body: nil, headers: headers})
		if err != nil {
			return counts, err
		}
		var repositories []map[string]any
		if err := json.Unmarshal(response.Body, &repositories); err != nil {
			return counts, fmt.Errorf("decode Harbor repositories: %w", err)
		}
		if len(repositories) > projectAssetPageSize {
			return counts, errInvalidHarborJSON
		}
		counts.repositoryCount += int64(len(repositories))
		for _, repository := range repositories {
			counts.artifactCount += numberValue(repository["artifact_count"])
		}
		total, totalErr := strconv.Atoi(response.Header.Get("X-Total-Count"))
		if len(repositories) == 0 || (totalErr == nil && total >= 0 && page*projectAssetPageSize >= total) || (totalErr != nil && len(repositories) < projectAssetPageSize) {
			return counts, nil
		}
	}
	return counts, failure(http.StatusServiceUnavailable, "collection_too_large", "Harbor repositories exceed the pagination limit")
}

// visibleProjectStatistics intentionally derives totals from the project and
// repository resources already authorized for the active Harbor account. The
// system-wide /statistics endpoint is not safe to expose to restricted users.
func visibleProjectStatistics(projects []any) map[string]any {
	statistics := map[string]any{
		"total_project_count":       0,
		"public_project_count":      0,
		"private_project_count":     0,
		"total_repo_count":          int64(0),
		"public_repo_count":         int64(0),
		"private_repo_count":        int64(0),
		"total_artifact_count":      int64(0),
		"total_storage_consumption": int64(0),
	}
	statistics["total_project_count"] = len(projects)
	for _, rawProject := range projects {
		project, ok := rawProject.(map[string]any)
		if !ok {
			continue
		}
		metadata, _ := project["metadata"].(map[string]any)
		isPublic := stringValue(metadata["public"]) == "true"
		repositories := numberValue(project["repo_count"])
		artifacts := numberValue(project["artifact_count"])
		storage := numberValue(project["storage_used"])
		statistics["total_repo_count"] = numberValue(statistics["total_repo_count"]) + repositories
		statistics["total_artifact_count"] = numberValue(statistics["total_artifact_count"]) + artifacts
		statistics["total_storage_consumption"] = numberValue(statistics["total_storage_consumption"]) + storage
		if isPublic {
			statistics["public_project_count"] = numberValue(statistics["public_project_count"]) + 1
			statistics["public_repo_count"] = numberValue(statistics["public_repo_count"]) + repositories
		} else {
			statistics["private_project_count"] = numberValue(statistics["private_project_count"]) + 1
			statistics["private_repo_count"] = numberValue(statistics["private_repo_count"]) + repositories
		}
	}
	return statistics
}

// dashboardWarning reports a dashboard section that could not be loaded, with
// the same code and details as an error response.
type dashboardWarning struct {
	Source  string         `json:"source"`
	Code    string         `json:"code"`
	Message string         `json:"message"`
	Details map[string]any `json:"details,omitzero"`
}

func newDashboardWarning(source string, cause *apiFailure) dashboardWarning {
	return dashboardWarning{Source: source, Code: cause.code, Message: cause.message, Details: cause.details}
}
