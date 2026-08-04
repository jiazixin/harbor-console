package app

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
)

func TestDashboardDerivesStatisticsFromVisibleResources(t *testing.T) {
	application, err := newApp()
	if err != nil {
		t.Fatal(err)
	}

	var requestedMu sync.Mutex
	requestedPaths := make([]string, 0, 16)
	client := mockClient(func(request *http.Request) (int, string) {
		requestedMu.Lock()
		requestedPaths = append(requestedPaths, request.URL.Path)
		requestedMu.Unlock()

		switch request.URL.Path {
		case "/api/v2.0/health":
			return http.StatusOK, `{"status":"healthy"}`
		case "/api/v2.0/systeminfo":
			return http.StatusOK, `{}`
		case "/api/v2.0/replication/executions", "/api/v2.0/replication/policies", "/api/v2.0/registries", "/api/v2.0/scanners":
			return http.StatusOK, `[]`
		case "/api/v2.0/projects":
			return http.StatusOK, `[
				{"project_id":1,"name":"public-team","metadata":{"public":"true"}},
				{"project_id":2,"name":"private-team","metadata":{"public":"false"}}
			]`
		case "/api/v2.0/projects/public-team/summary":
			return http.StatusOK, `{"quota":{"used":{"storage":1024}}}`
		case "/api/v2.0/projects/private-team/summary":
			return http.StatusOK, `{"quota":{"used":{"storage":2048}}}`
		case "/api/v2.0/projects/public-team/repositories":
			return http.StatusOK, `[{"artifact_count":2},{"artifact_count":3}]`
		case "/api/v2.0/projects/private-team/repositories":
			return http.StatusOK, `[{"artifact_count":5}]`
		default:
			return http.StatusInternalServerError, `{"error":"unexpected test request"}`
		}
	})
	current := &session{
		InstanceURL: "https://harbor.test",
		Username:    "project-member",
		Password:    "test-only",
		Client:      client,
	}
	if err := application.sessions.create(current); err != nil {
		t.Fatal(err)
	}
	request := httptest.NewRequest(http.MethodGet, "/api/dashboard", nil)
	request.AddCookie(&http.Cookie{Name: sessionCookie, Value: current.ID})
	recorder := httptest.NewRecorder()
	application.routes().ServeHTTP(recorder, request)
	if recorder.Code != http.StatusOK {
		t.Fatalf("dashboard status = %d, body = %s", recorder.Code, recorder.Body.String())
	}

	requestedMu.Lock()
	paths := append([]string(nil), requestedPaths...)
	requestedMu.Unlock()
	for _, path := range paths {
		if path == "/api/v2.0/statistics" {
			t.Fatalf("restricted dashboard requested system statistics: %#v", paths)
		}
	}

	var payload struct {
		Projects   []map[string]any `json:"projects"`
		Statistics map[string]any   `json:"statistics"`
		Warnings   []string         `json:"warnings"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	if len(payload.Warnings) != 0 {
		t.Fatalf("dashboard warnings = %#v", payload.Warnings)
	}
	wantStatistics := map[string]int64{
		"total_project_count":       2,
		"public_project_count":      1,
		"private_project_count":     1,
		"total_repo_count":          3,
		"public_repo_count":         2,
		"private_repo_count":        1,
		"total_artifact_count":      10,
		"total_storage_consumption": 3072,
	}
	for field, want := range wantStatistics {
		if got := numberValue(payload.Statistics[field]); got != want {
			t.Errorf("statistics[%q] = %d, want %d", field, got, want)
		}
	}

	projectsByName := make(map[string]map[string]any, len(payload.Projects))
	for _, project := range payload.Projects {
		projectsByName[stringValue(project["name"])] = project
	}
	for name, want := range map[string]struct {
		repositories int64
		artifacts    int64
		storage      int64
	}{
		"public-team":  {repositories: 2, artifacts: 5, storage: 1024},
		"private-team": {repositories: 1, artifacts: 5, storage: 2048},
	} {
		project, ok := projectsByName[name]
		if !ok {
			t.Errorf("dashboard is missing visible project %q", name)
			continue
		}
		if got := numberValue(project["repo_count"]); got != want.repositories {
			t.Errorf("project %q repo_count = %d, want %d", name, got, want.repositories)
		}
		if got := numberValue(project["artifact_count"]); got != want.artifacts {
			t.Errorf("project %q artifact_count = %d, want %d", name, got, want.artifacts)
		}
		if got := numberValue(project["storage_used"]); got != want.storage {
			t.Errorf("project %q storage_used = %d, want %d", name, got, want.storage)
		}
	}
}

func TestProjectAssetCountsAggregateAllRepositoryPages(t *testing.T) {
	firstPage := make([]map[string]any, projectAssetPageSize)
	for index := range firstPage {
		firstPage[index] = map[string]any{"artifact_count": 1}
	}
	firstPageBody, err := json.Marshal(firstPage)
	if err != nil {
		t.Fatal(err)
	}

	requestedPages := make([]string, 0, 2)
	client := &http.Client{Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
		requestedPages = append(requestedPages, request.URL.Query().Get("page"))
		body := firstPageBody
		if request.URL.Query().Get("page") == "2" {
			body = []byte(`[{"artifact_count":7}]`)
		}
		return &http.Response{
			StatusCode: http.StatusOK,
			Header: http.Header{
				"Content-Type":  {"application/json"},
				"X-Total-Count": {"101"},
			},
			Body:    io.NopCloser(strings.NewReader(string(body))),
			Request: request,
		}, nil
	})}
	application, err := newApp()
	if err != nil {
		t.Fatal(err)
	}
	current := &session{InstanceURL: "https://harbor.test", Username: "restricted-user", Password: "test-only", Client: client}
	headers := http.Header{"X-Is-Resource-Name": {"true"}}
	counts, err := application.projectAssetCounts(t.Context(), current, "visible-project", headers)
	if err != nil {
		t.Fatal(err)
	}
	if got := strings.Join(requestedPages, ","); got != "1,2" {
		t.Fatalf("requested repository pages = %q, want 1,2", got)
	}
	if counts.repositoryCount != 101 {
		t.Errorf("repository count = %d, want 101", counts.repositoryCount)
	}
	if counts.artifactCount != 107 {
		t.Errorf("artifact count = %d, want 107", counts.artifactCount)
	}
}
