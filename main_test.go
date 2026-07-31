package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (fn roundTripFunc) RoundTrip(request *http.Request) (*http.Response, error) {
	return fn(request)
}

func mockClient(handler func(*http.Request) (int, string)) *http.Client {
	return &http.Client{Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
		status, body := handler(request)
		return &http.Response{
			StatusCode: status,
			Header:     http.Header{"Content-Type": {"application/json"}},
			Body:       io.NopCloser(strings.NewReader(body)),
			Request:    request,
		}, nil
	})}
}

func TestValidateHarborURL(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		want    string
		wantErr bool
	}{
		{name: "https", input: " https://harbor.example.com/ ", want: "https://harbor.example.com"},
		{name: "path prefix", input: "https://example.com/harbor/", want: "https://example.com/harbor"},
		{name: "missing scheme", input: "harbor.example.com", wantErr: true},
		{name: "credentials", input: "https://admin:secret@example.com", wantErr: true},
		{name: "unsupported scheme", input: "file:///tmp/harbor", wantErr: true},
		{name: "query", input: "https://example.com?token=x", wantErr: true},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got, err := validateHarborURL(test.input)
			if (err != nil) != test.wantErr {
				t.Fatalf("validateHarborURL() error = %v, wantErr %v", err, test.wantErr)
			}
			if got != test.want {
				t.Fatalf("validateHarborURL() = %q, want %q", got, test.want)
			}
		})
	}
}

func TestDashboardRequiresSession(t *testing.T) {
	application, err := newApp()
	if err != nil {
		t.Fatal(err)
	}
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/dashboard", nil)
	application.routes().ServeHTTP(recorder, request)
	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusUnauthorized)
	}
}

func TestHealthEndpoint(t *testing.T) {
	application, err := newApp()
	if err != nil {
		t.Fatal(err)
	}
	recorder := httptest.NewRecorder()
	application.routes().ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/health", nil))
	if recorder.Code != http.StatusOK || !strings.Contains(recorder.Body.String(), `"status":"ok"`) {
		t.Fatalf("health response = %d %s", recorder.Code, recorder.Body.String())
	}
	if recorder.Header().Get("Cache-Control") != "no-store" {
		t.Fatalf("health cache control = %q", recorder.Header().Get("Cache-Control"))
	}
}

func TestEmbeddedFrontendIsOfflineAndCSPCompatible(t *testing.T) {
	paths := []string{"web/index.html", "web/i18n.js", "web/date-utils.js", "web/app.js", "web/control-ui.js", "web/admin-ui.js"}
	contents := make(map[string]string, len(paths))
	for _, path := range paths {
		content, err := embeddedWeb.ReadFile(path)
		if err != nil {
			t.Fatalf("read embedded frontend %s: %v", path, err)
		}
		contents[path] = string(content)
		if strings.Contains(contents[path], "style=") {
			t.Fatalf("%s contains an inline style that the production CSP will block", path)
		}
	}

	index := contents["web/index.html"]
	for _, remoteReference := range []string{`src="http://`, `src="https://`, `href="http://`, `href="https://`, `//cdn.`} {
		if strings.Contains(index, remoteReference) {
			t.Fatalf("index contains remote frontend dependency %q", remoteReference)
		}
	}
	for _, localReference := range []string{`href="/styles.css"`, `src="/i18n.js"`, `src="/date-utils.js"`, `src="/app.js"`, `src="/control-ui.js"`, `src="/admin-ui.js"`} {
		if !strings.Contains(index, localReference) {
			t.Fatalf("index is missing embedded resource %q", localReference)
		}
	}
	if !strings.Contains(contents["web/app.js"], `<progress class="bar-track"`) {
		t.Fatal("project asset distribution must use a CSP-compatible value/max progress bar")
	}

	application, err := newApp()
	if err != nil {
		t.Fatal(err)
	}
	recorder := httptest.NewRecorder()
	application.routes().ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/", nil))
	csp := recorder.Header().Get("Content-Security-Policy")
	if !strings.Contains(csp, "style-src 'self'") || strings.Contains(csp, "'unsafe-inline'") {
		t.Fatalf("unexpected frontend CSP: %q", csp)
	}
}

func TestSameOriginChecksSchemeAndHost(t *testing.T) {
	request := httptest.NewRequest(http.MethodPost, "http://console.test/api/demo", nil)
	request.Header.Set("Origin", "http://console.test")
	if !sameOrigin(request) {
		t.Fatal("matching HTTP origin should be allowed")
	}
	request.Header.Set("Origin", "https://console.test")
	if sameOrigin(request) {
		t.Fatal("mismatched origin scheme should be rejected")
	}
	request.Header.Set("Origin", "http://attacker.test")
	if sameOrigin(request) {
		t.Fatal("mismatched origin host should be rejected")
	}
}

func TestRateLimiter(t *testing.T) {
	limiter := newRateLimiter(2, time.Minute)
	if !limiter.allow("client") || !limiter.allow("client") {
		t.Fatal("initial requests should be allowed")
	}
	if limiter.allow("client") {
		t.Fatal("request over the limit should be rejected")
	}
}

func TestHarborClientRejectsUnsafeRedirects(t *testing.T) {
	client := newHarborClient(false)
	original, err := http.NewRequest(http.MethodGet, "https://harbor.test/api/v2.0/projects", nil)
	if err != nil {
		t.Fatal(err)
	}
	tests := []string{
		"http://harbor.test/api/v2.0/projects",
		"https://other.test/api/v2.0/projects",
	}
	for _, target := range tests {
		redirect, err := http.NewRequest(http.MethodGet, target, nil)
		if err != nil {
			t.Fatal(err)
		}
		if err := client.CheckRedirect(redirect, []*http.Request{original}); err == nil {
			t.Fatalf("unsafe redirect to %s should be rejected", target)
		}
	}
}

func TestDemoCreatesUsableSession(t *testing.T) {
	application, err := newApp()
	if err != nil {
		t.Fatal(err)
	}
	handler := application.routes()
	login := httptest.NewRecorder()
	handler.ServeHTTP(login, httptest.NewRequest(http.MethodPost, "/api/demo", strings.NewReader("{}")))
	if login.Code != http.StatusOK {
		t.Fatalf("demo status = %d, body = %s", login.Code, login.Body.String())
	}
	cookies := login.Result().Cookies()
	if len(cookies) != 1 || cookies[0].Name != sessionCookie || !cookies[0].HttpOnly {
		t.Fatalf("unexpected cookies: %#v", cookies)
	}
	dashboardRequest := httptest.NewRequest(http.MethodGet, "/api/dashboard", nil)
	dashboardRequest.AddCookie(cookies[0])
	dashboard := httptest.NewRecorder()
	handler.ServeHTTP(dashboard, dashboardRequest)
	if dashboard.Code != http.StatusOK {
		t.Fatalf("dashboard status = %d, body = %s", dashboard.Code, dashboard.Body.String())
	}
	var payload map[string]any
	if err := json.Unmarshal(dashboard.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	if payload["mode"] != "demo" {
		t.Fatalf("mode = %#v, want demo", payload["mode"])
	}
}

func TestDemoArtifactsIncludeOfficialMultiArchitectureFields(t *testing.T) {
	artifacts := demoArtifacts("platform", "platform/gateway")
	if len(artifacts) == 0 {
		t.Fatal("demo artifacts are empty")
	}
	artifact, ok := artifacts[0].(map[string]any)
	if !ok {
		t.Fatalf("first artifact type = %T", artifacts[0])
	}
	if artifact["manifest_media_type"] != "application/vnd.oci.image.index.v1+json" {
		t.Fatalf("manifest media type = %#v", artifact["manifest_media_type"])
	}
	references, ok := artifact["references"].([]any)
	if !ok || len(references) < 2 {
		t.Fatalf("references = %#v", artifact["references"])
	}
	for index, value := range references {
		reference, ok := value.(map[string]any)
		if !ok || stringValue(reference["child_digest"]) == "" {
			t.Fatalf("reference %d = %#v", index, value)
		}
		platform, ok := reference["platform"].(map[string]any)
		if !ok || stringValue(platform["os"]) == "" || stringValue(platform["architecture"]) == "" {
			t.Fatalf("reference %d platform = %#v", index, reference["platform"])
		}
	}
}

func TestDemoInstancesAreIsolatedAndSwitchable(t *testing.T) {
	application, err := newApp()
	if err != nil {
		t.Fatal(err)
	}
	handler := application.routes()
	login := httptest.NewRecorder()
	handler.ServeHTTP(login, httptest.NewRequest(http.MethodPost, "/api/demo", strings.NewReader("{}")))
	cookie := login.Result().Cookies()[0]
	request := func(method, target, body string) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequest(method, target, strings.NewReader(body))
		req.AddCookie(cookie)
		recorder := httptest.NewRecorder()
		handler.ServeHTTP(recorder, req)
		return recorder
	}

	instances := request(http.MethodGet, "/api/instances", "")
	if instances.Code != http.StatusOK {
		t.Fatalf("instances status = %d, body = %s", instances.Code, instances.Body.String())
	}
	var listed struct {
		ActiveID string           `json:"active_id"`
		Items    []map[string]any `json:"items"`
	}
	if err := json.Unmarshal(instances.Body.Bytes(), &listed); err != nil {
		t.Fatal(err)
	}
	if listed.ActiveID == "" || len(listed.Items) != 1 {
		t.Fatalf("unexpected initial instances: %#v", listed)
	}
	firstID := listed.ActiveID

	createdProject := request(http.MethodPost, "/api/control/projects", `{"project_name":"first-only","metadata":{"public":"false"}}`)
	if createdProject.Code != http.StatusCreated {
		t.Fatalf("project create status = %d, body = %s", createdProject.Code, createdProject.Body.String())
	}
	second := request(http.MethodPost, "/api/instances/demo", `{}`)
	if second.Code != http.StatusCreated {
		t.Fatalf("second demo status = %d, body = %s", second.Code, second.Body.String())
	}
	var secondInfo map[string]any
	if err := json.Unmarshal(second.Body.Bytes(), &secondInfo); err != nil {
		t.Fatal(err)
	}
	secondID := stringValue(secondInfo["connection_id"])
	if secondID == "" || secondID == firstID {
		t.Fatalf("invalid second instance: %s", second.Body.String())
	}

	secondProjects := request(http.MethodGet, "/api/control/projects?page=1&page_size=50&name=first-only", "")
	if secondProjects.Code != http.StatusOK || strings.Contains(secondProjects.Body.String(), `"name":"first-only"`) {
		t.Fatalf("demo instance state leaked: %d %s", secondProjects.Code, secondProjects.Body.String())
	}
	switched := request(http.MethodPut, "/api/instances/current", `{"id":"`+firstID+`"}`)
	if switched.Code != http.StatusOK || !strings.Contains(switched.Body.String(), `"connection_id":"`+firstID+`"`) {
		t.Fatalf("switch status = %d, body = %s", switched.Code, switched.Body.String())
	}
	firstProjects := request(http.MethodGet, "/api/control/projects?page=1&page_size=50&name=first-only", "")
	if firstProjects.Code != http.StatusOK || !strings.Contains(firstProjects.Body.String(), `"name":"first-only"`) {
		t.Fatalf("first instance state was not restored: %d %s", firstProjects.Code, firstProjects.Body.String())
	}
	deleted := request(http.MethodDelete, "/api/instances/"+secondID, "")
	if deleted.Code != http.StatusOK {
		t.Fatalf("delete second status = %d, body = %s", deleted.Code, deleted.Body.String())
	}
	last := request(http.MethodDelete, "/api/instances/"+firstID, "")
	if last.Code != http.StatusConflict {
		t.Fatalf("delete last status = %d, want 409; body = %s", last.Code, last.Body.String())
	}
}

func TestConnectUsesBasicAuth(t *testing.T) {
	application, err := newApp()
	if err != nil {
		t.Fatal(err)
	}
	application.newClient = func(bool) *http.Client {
		return mockClient(func(r *http.Request) (int, string) {
			username, password, ok := r.BasicAuth()
			if !ok || username != "admin" || password != "correct-horse" {
				return http.StatusUnauthorized, `{}`
			}
			if r.URL.Path != "/api/v2.0/projects" || r.URL.Query().Get("page_size") != "1" {
				t.Errorf("unexpected request: %s?%s", r.URL.Path, r.URL.RawQuery)
			}
			return http.StatusOK, `[]`
		})
	}
	body := `{"url":"https://harbor.test","username":"admin","password":"correct-horse"}`
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/connect", strings.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	application.routes().ServeHTTP(recorder, request)
	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
	if len(recorder.Result().Cookies()) != 1 {
		t.Fatal("expected session cookie")
	}
}

func TestResourceAllowsOnlyKnownQueryParameters(t *testing.T) {
	var received string
	client := mockClient(func(r *http.Request) (int, string) {
		received = r.URL.RawQuery
		return http.StatusOK, `[]`
	})

	application, err := newApp()
	if err != nil {
		t.Fatal(err)
	}
	current := &session{InstanceURL: "https://harbor.test", Username: "admin", Password: "password", Client: client}
	if err := application.sessions.create(current); err != nil {
		t.Fatal(err)
	}
	request := httptest.NewRequest(http.MethodGet, "/api/resources/projects?page=2&page_size=25&evil=ignored", nil)
	request.AddCookie(&http.Cookie{Name: sessionCookie, Value: current.ID})
	recorder := httptest.NewRecorder()
	application.routes().ServeHTTP(recorder, request)
	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
	if strings.Contains(received, "evil") || !strings.Contains(received, "page=2") || !strings.Contains(received, "page_size=25") {
		t.Fatalf("unexpected upstream query: %q", received)
	}
}

func TestProjectAssetEnrichmentUsesOfficialProjectAPIs(t *testing.T) {
	application, err := newApp()
	if err != nil {
		t.Fatal(err)
	}
	client := mockClient(func(request *http.Request) (int, string) {
		if request.Header.Get("X-Is-Resource-Name") != "true" {
			t.Fatal("project resource name header was not forwarded")
		}
		switch request.URL.Path {
		case "/api/v2.0/projects/platform/summary":
			return http.StatusOK, `{"quota":{"used":{"storage":5368709120}}}`
		case "/api/v2.0/projects/platform/repositories":
			if request.URL.Query().Get("page_size") != "100" {
				t.Fatalf("repository page_size = %q", request.URL.Query().Get("page_size"))
			}
			return http.StatusOK, `[{"artifact_count":12},{"artifact_count":8}]`
		default:
			t.Fatalf("unexpected asset request: %s", request.URL.Path)
			return http.StatusNotFound, `{}`
		}
	})
	projects := []any{map[string]any{"project_id": 1, "name": "platform", "repo_count": 2}}
	current := &session{InstanceURL: "https://harbor.test", Username: "admin", Password: "password", Client: client}
	if application.enrichProjectAssets(context.Background(), current, projects) {
		t.Fatal("asset enrichment unexpectedly reported an error")
	}
	project := projects[0].(map[string]any)
	if numberValue(project["storage_used"]) != 5368709120 || numberValue(project["artifact_count"]) != 20 {
		t.Fatalf("unexpected enriched project: %#v", project)
	}
}

func TestListAllProjectsFollowsOfficialPaginationHeaders(t *testing.T) {
	application, err := newApp()
	if err != nil {
		t.Fatal(err)
	}
	requestedPages := make([]string, 0, 2)
	client := &http.Client{Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
		if request.URL.Path != "/api/v2.0/projects" || request.URL.Query().Get("page_size") != "100" {
			t.Fatalf("unexpected project request: %s?%s", request.URL.Path, request.URL.RawQuery)
		}
		page := request.URL.Query().Get("page")
		requestedPages = append(requestedPages, page)
		body := `[{"project_id":1,"name":"first","repo_count":2}]`
		if page == "2" {
			body = `[{"project_id":101,"name":"last","repo_count":9}]`
		}
		return &http.Response{
			StatusCode: http.StatusOK,
			Header:     http.Header{"Content-Type": {"application/json"}, "X-Total-Count": {"2"}},
			Body:       io.NopCloser(strings.NewReader(body)),
			Request:    request,
		}, nil
	})}
	current := &session{InstanceURL: "https://harbor.test", Username: "admin", Password: "password", Client: client}
	projects, err := application.listAllProjects(context.Background(), current)
	if err != nil {
		t.Fatal(err)
	}
	if got := strings.Join(requestedPages, ","); got != "1,2" {
		t.Fatalf("requested project pages = %q, want 1,2", got)
	}
	if len(projects) != 2 || stringValue(projects[1].(map[string]any)["name"]) != "last" {
		t.Fatalf("unexpected projects: %#v", projects)
	}
}

func TestProjectAssetEnrichmentFollowsOfficialRepositoryPagination(t *testing.T) {
	application, err := newApp()
	if err != nil {
		t.Fatal(err)
	}
	requestedPages := make([]string, 0, 2)
	client := &http.Client{Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
		response := &http.Response{
			StatusCode: http.StatusOK,
			Header:     http.Header{"Content-Type": {"application/json"}},
			Request:    request,
		}
		switch request.URL.Path {
		case "/api/v2.0/projects/platform/summary":
			response.Body = io.NopCloser(strings.NewReader(`{"quota":{"used":{"storage":1024}}}`))
		case "/api/v2.0/projects/platform/repositories":
			page := request.URL.Query().Get("page")
			requestedPages = append(requestedPages, page)
			response.Header.Set("X-Total-Count", "101")
			if page == "1" {
				response.Body = io.NopCloser(strings.NewReader(`[{"artifact_count":4}]`))
			} else {
				response.Body = io.NopCloser(strings.NewReader(`[{"artifact_count":7}]`))
			}
		default:
			t.Fatalf("unexpected asset request: %s", request.URL.Path)
		}
		return response, nil
	})}
	projects := []any{map[string]any{"project_id": 1, "name": "platform", "repo_count": 101}}
	current := &session{InstanceURL: "https://harbor.test", Username: "admin", Password: "password", Client: client}
	if application.enrichProjectAssets(context.Background(), current, projects) {
		t.Fatal("asset enrichment unexpectedly reported an error")
	}
	if got := strings.Join(requestedPages, ","); got != "1,2" {
		t.Fatalf("requested repository pages = %q, want 1,2", got)
	}
	if got := numberValue(projects[0].(map[string]any)["artifact_count"]); got != 11 {
		t.Fatalf("artifact count = %d, want 11", got)
	}
}

func TestProjectAssetEnrichmentReadsAllRepositoryPages(t *testing.T) {
	application, err := newApp()
	if err != nil {
		t.Fatal(err)
	}
	requestedPages := make([]string, 0, 11)
	client := &http.Client{Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
		response := &http.Response{StatusCode: http.StatusOK, Header: http.Header{"Content-Type": {"application/json"}}, Request: request}
		if strings.HasSuffix(request.URL.Path, "/summary") {
			response.Body = io.NopCloser(strings.NewReader(`{"quota":{"used":{"storage":1024}}}`))
			return response, nil
		}
		requestedPages = append(requestedPages, request.URL.Query().Get("page"))
		response.Header.Set("X-Total-Count", "1001")
		response.Body = io.NopCloser(strings.NewReader(`[{"artifact_count":1}]`))
		return response, nil
	})}
	projects := []any{map[string]any{"project_id": 1, "name": "platform", "repo_count": 1001}}
	current := &session{InstanceURL: "https://harbor.test", Username: "admin", Password: "password", Client: client}
	if application.enrichProjectAssets(context.Background(), current, projects) {
		t.Fatal("asset enrichment unexpectedly reported an error")
	}
	if len(requestedPages) != 11 || requestedPages[0] != "1" || requestedPages[10] != "11" {
		t.Fatalf("requested repository pages = %#v, want pages 1 through 11", requestedPages)
	}
	if got := numberValue(projects[0].(map[string]any)["artifact_count"]); got != 11 {
		t.Fatalf("artifact count = %d, want 11", got)
	}
}

func TestConnectRejectsBadCredentials(t *testing.T) {
	application, err := newApp()
	if err != nil {
		t.Fatal(err)
	}
	application.newClient = func(bool) *http.Client {
		return mockClient(func(r *http.Request) (int, string) {
			return http.StatusUnauthorized, `{"errors":[{"message":"unauthorized"}]}`
		})
	}
	body := `{"url":"https://harbor.test","username":"admin","password":"wrong"}`
	recorder := httptest.NewRecorder()
	application.routes().ServeHTTP(recorder, httptest.NewRequest(http.MethodPost, "/api/connect", strings.NewReader(body)))
	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want %d; body = %s", recorder.Code, http.StatusUnauthorized, recorder.Body.String())
	}
}

func TestControlProjectsUsesOfficialPaginationHeaders(t *testing.T) {
	application, err := newApp()
	if err != nil {
		t.Fatal(err)
	}
	client := &http.Client{Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
		if request.Method != http.MethodGet || request.URL.Path != "/api/v2.0/projects" {
			t.Fatalf("unexpected upstream request: %s %s", request.Method, request.URL.Path)
		}
		if request.URL.Query().Get("page") != "2" || request.URL.Query().Get("page_size") != "20" {
			t.Fatalf("unexpected pagination query: %s", request.URL.RawQuery)
		}
		return &http.Response{
			StatusCode: http.StatusOK,
			Header: http.Header{
				"Content-Type":  {"application/json"},
				"X-Total-Count": {"47"},
			},
			Body:    io.NopCloser(strings.NewReader(`[{"project_id":1,"name":"platform"}]`)),
			Request: request,
		}, nil
	})}
	current := createTestSession(t, application, client, false)
	request := httptest.NewRequest(http.MethodGet, "/api/control/projects?page=2&page_size=20", nil)
	request.AddCookie(&http.Cookie{Name: sessionCookie, Value: current.ID})
	recorder := httptest.NewRecorder()
	application.routes().ServeHTTP(recorder, request)
	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
	var payload struct {
		Items      []map[string]any `json:"items"`
		Pagination struct {
			Page     int `json:"page"`
			PageSize int `json:"page_size"`
			Total    int `json:"total"`
		} `json:"pagination"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	if len(payload.Items) != 1 || payload.Pagination.Page != 2 || payload.Pagination.PageSize != 20 || payload.Pagination.Total != 47 {
		t.Fatalf("unexpected envelope: %#v", payload)
	}
}

func TestControlListParityFiltersUseOfficialAPIs(t *testing.T) {
	tests := []struct {
		name       string
		consoleURL string
		wantPath   string
		wantQuery  url.Values
	}{
		{
			name:       "project visibility owner sort and pagination",
			consoleURL: "/api/control/projects?page=3&page_size=50&sort=-repo_count&name=platform&owner=admin&public=true&with_detail=true",
			wantPath:   "/api/v2.0/projects",
			wantQuery:  url.Values{"page": {"3"}, "page_size": {"50"}, "sort": {"-repo_count"}, "name": {"platform"}, "owner": {"admin"}, "public": {"true"}, "with_detail": {"true"}},
		},
		{
			name:       "repository filter sort and pagination",
			consoleURL: "/api/control/repositories?project=platform&page=2&page_size=20&sort=-pull_count&q=name%3D~api",
			wantPath:   "/api/v2.0/projects/platform/repositories",
			wantQuery:  url.Values{"page": {"2"}, "page_size": {"20"}, "sort": {"-pull_count"}, "q": {"name=~api"}},
		},
		{
			name:       "replication policy name and pagination",
			consoleURL: "/api/control/replication-policies?page=2&page_size=50&sort=name&name=release",
			wantPath:   "/api/v2.0/replication/policies",
			wantQuery:  url.Values{"page": {"2"}, "page_size": {"50"}, "sort": {"name"}, "name": {"release"}},
		},
		{
			name:       "replication execution filters and pagination",
			consoleURL: "/api/control/replication-executions?page=4&page_size=20&sort=-start_time&policy_id=7&status=Failed&trigger=manual",
			wantPath:   "/api/v2.0/replication/executions",
			wantQuery:  url.Values{"page": {"4"}, "page_size": {"20"}, "sort": {"-start_time"}, "policy_id": {"7"}, "status": {"Failed"}, "trigger": {"manual"}},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			application, err := newApp()
			if err != nil {
				t.Fatal(err)
			}
			client := &http.Client{Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
				if request.Method != http.MethodGet || request.URL.Path != test.wantPath {
					t.Fatalf("upstream request = %s %s, want GET %s", request.Method, request.URL.Path, test.wantPath)
				}
				if request.URL.Query().Encode() != test.wantQuery.Encode() {
					t.Fatalf("upstream query = %q, want %q", request.URL.Query().Encode(), test.wantQuery.Encode())
				}
				return &http.Response{StatusCode: http.StatusOK, Header: http.Header{"Content-Type": {"application/json"}, "X-Total-Count": {"0"}}, Body: io.NopCloser(strings.NewReader(`[]`)), Request: request}, nil
			})}
			current := createTestSession(t, application, client, false)
			request := httptest.NewRequest(http.MethodGet, test.consoleURL, nil)
			request.AddCookie(&http.Cookie{Name: sessionCookie, Value: current.ID})
			recorder := httptest.NewRecorder()
			application.routes().ServeHTTP(recorder, request)
			if recorder.Code != http.StatusOK {
				t.Fatalf("status = %d, body = %s", recorder.Code, recorder.Body.String())
			}
		})
	}
}

func TestControlProjectCreateWithQuotaAndProxyUsesOfficialAPI(t *testing.T) {
	application, err := newApp()
	if err != nil {
		t.Fatal(err)
	}
	body := `{"project_name":"mirror","storage_limit":53687091200,"registry_id":7,"metadata":{"public":"false","auto_scan":"false","auto_sbom_generation":"false","prevent_vul":"false","severity":"critical","proxy_speed_kb":"-1","max_upstream_conn":"20","proxy_cache_local_on_not_found":"true"}}`
	client := mockClient(func(request *http.Request) (int, string) {
		if request.Method != http.MethodPost || request.URL.Path != "/api/v2.0/projects" {
			t.Fatalf("unexpected upstream request: %s %s", request.Method, request.URL.Path)
		}
		got, readErr := io.ReadAll(request.Body)
		if readErr != nil {
			t.Fatal(readErr)
		}
		if string(got) != body {
			t.Fatalf("upstream body = %s, want %s", got, body)
		}
		return http.StatusCreated, `{}`
	})
	current := createTestSession(t, application, client, false)
	request := httptest.NewRequest(http.MethodPost, "/api/control/projects", strings.NewReader(body))
	request.Host = "console.test"
	request.Header.Set("Origin", "http://console.test")
	request.AddCookie(&http.Cookie{Name: sessionCookie, Value: current.ID})
	recorder := httptest.NewRecorder()
	application.routes().ServeHTTP(recorder, request)
	if recorder.Code != http.StatusCreated {
		t.Fatalf("status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
}

func TestControlAuditLogsUsesOfficialExtendedEndpoint(t *testing.T) {
	application, err := newApp()
	if err != nil {
		t.Fatal(err)
	}
	client := &http.Client{Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
		if request.Method != http.MethodGet || request.URL.Path != "/api/v2.0/auditlog-exts" {
			t.Fatalf("unexpected upstream request: %s %s", request.Method, request.URL.Path)
		}
		query := request.URL.Query()
		if query.Get("page") != "2" || query.Get("page_size") != "50" || query.Get("sort") != "-op_time" {
			t.Fatalf("unexpected pagination query: %s", request.URL.RawQuery)
		}
		if query.Get("q") != "username=~release,op_result=true" {
			t.Fatalf("unexpected audit filter: %q", query.Get("q"))
		}
		return &http.Response{
			StatusCode: http.StatusOK,
			Header: http.Header{
				"Content-Type":  {"application/json"},
				"X-Total-Count": {"73"},
			},
			Body:    io.NopCloser(strings.NewReader(`[{"id":481,"username":"release","resource":"platform/api:v2","resource_type":"artifact","operation":"push","operation_description":"push artifact","operation_result":true,"op_time":"2026-07-29T03:12:01Z"}]`)),
			Request: request,
		}, nil
	})}
	current := createTestSession(t, application, client, false)
	request := httptest.NewRequest(http.MethodGet, "/api/control/audit-logs?page=2&page_size=50&sort=-op_time&q=username%3D~release%2Cop_result%3Dtrue", nil)
	request.AddCookie(&http.Cookie{Name: sessionCookie, Value: current.ID})
	recorder := httptest.NewRecorder()
	application.routes().ServeHTTP(recorder, request)
	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
	var payload struct {
		Items      []map[string]any `json:"items"`
		Pagination struct {
			Page     int `json:"page"`
			PageSize int `json:"page_size"`
			Total    int `json:"total"`
		} `json:"pagination"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	if len(payload.Items) != 1 || payload.Pagination.Page != 2 || payload.Pagination.PageSize != 50 || payload.Pagination.Total != 73 {
		t.Fatalf("unexpected audit envelope: %#v", payload)
	}
	if payload.Items[0]["operation_description"] != "push artifact" || payload.Items[0]["operation_result"] != true {
		t.Fatalf("extended audit fields were lost: %#v", payload.Items[0])
	}
}

func TestAuditResourcesNeverUseDeprecatedEndpoint(t *testing.T) {
	application, err := newApp()
	if err != nil {
		t.Fatal(err)
	}
	client := mockClient(func(request *http.Request) (int, string) {
		if request.URL.Path == "/api/v2.0/audit-logs" {
			t.Fatal("deprecated audit endpoint must not be used")
		}
		if request.URL.Path != "/api/v2.0/auditlog-exts" {
			t.Fatalf("path = %q, want extended audit endpoint", request.URL.Path)
		}
		if request.URL.Query().Get("q") != "resource=~platform" {
			t.Fatalf("q = %q, want resource filter", request.URL.Query().Get("q"))
		}
		return http.StatusOK, `[{"id":1,"operation_result":true}]`
	})
	current := createTestSession(t, application, client, false)
	request := httptest.NewRequest(http.MethodGet, "/api/resources/audit-logs?page=1&page_size=50&q=resource%3D~platform&username=ignored", nil)
	request.AddCookie(&http.Cookie{Name: sessionCookie, Value: current.ID})
	recorder := httptest.NewRecorder()
	application.routes().ServeHTTP(recorder, request)
	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
}

func TestDemoAuditLogsSupportOfficialFiltersAndPagination(t *testing.T) {
	application, err := newApp()
	if err != nil {
		t.Fatal(err)
	}
	current := createTestSession(t, application, nil, true)
	request := httptest.NewRequest(http.MethodGet, "/api/control/audit-logs?page=1&page_size=20&sort=-op_time&q=username%3D~ci-bot%2Cop_result%3Dfalse", nil)
	request.AddCookie(&http.Cookie{Name: sessionCookie, Value: current.ID})
	recorder := httptest.NewRecorder()
	application.routes().ServeHTTP(recorder, request)
	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
	var payload struct {
		Items      []map[string]any `json:"items"`
		Pagination struct {
			Total int `json:"total"`
		} `json:"pagination"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	if payload.Pagination.Total != 1 || len(payload.Items) != 1 {
		t.Fatalf("unexpected filtered audit result: %#v", payload)
	}
	if payload.Items[0]["username"] != "ci-bot" || payload.Items[0]["operation_result"] != false {
		t.Fatalf("unexpected audit item: %#v", payload.Items[0])
	}
}

func TestControlRepositoryUsesOfficialDoubleEncoding(t *testing.T) {
	application, err := newApp()
	if err != nil {
		t.Fatal(err)
	}
	client := mockClient(func(request *http.Request) (int, string) {
		if request.Method != http.MethodGet {
			t.Fatalf("method = %s, want GET", request.Method)
		}
		want := "/api/v2.0/projects/platform/repositories/team%252Fgateway"
		if request.URL.EscapedPath() != want {
			t.Fatalf("escaped path = %q, want %q", request.URL.EscapedPath(), want)
		}
		if request.Header.Get("X-Is-Resource-Name") != "true" {
			t.Fatal("project name header was not forwarded")
		}
		return http.StatusOK, `{"name":"platform/team/gateway"}`
	})
	current := createTestSession(t, application, client, false)
	request := httptest.NewRequest(http.MethodGet, "/api/control/repository?project=platform&repository=platform%2Fteam%2Fgateway", nil)
	request.AddCookie(&http.Cookie{Name: sessionCookie, Value: current.ID})
	recorder := httptest.NewRecorder()
	application.routes().ServeHTTP(recorder, request)
	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
}

func TestControlCreateTagForwardsOfficialMethodPathAndBody(t *testing.T) {
	application, err := newApp()
	if err != nil {
		t.Fatal(err)
	}
	client := mockClient(func(request *http.Request) (int, string) {
		if request.Method != http.MethodPost {
			t.Fatalf("method = %s, want POST", request.Method)
		}
		want := "/api/v2.0/projects/platform/repositories/gateway/artifacts/sha256:abc/tags"
		if request.URL.Path != want {
			t.Fatalf("path = %q, want %q", request.URL.Path, want)
		}
		body, err := io.ReadAll(request.Body)
		if err != nil {
			t.Fatal(err)
		}
		if string(body) != `{"name":"v1.2.3"}` {
			t.Fatalf("body = %s", body)
		}
		return http.StatusCreated, ``
	})
	current := createTestSession(t, application, client, false)
	request := httptest.NewRequest(http.MethodPost, "/api/control/artifact-tags?project=platform&repository=platform%2Fgateway&reference=sha256%3Aabc", strings.NewReader(`{"name":"v1.2.3"}`))
	request.Header.Set("Origin", "http://example.com")
	request.Host = "example.com"
	request.AddCookie(&http.Cookie{Name: sessionCookie, Value: current.ID})
	recorder := httptest.NewRecorder()
	application.routes().ServeHTTP(recorder, request)
	if recorder.Code != http.StatusCreated {
		t.Fatalf("status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
}

func TestControlArtifactMetadataOperationsUseOfficialAPI(t *testing.T) {
	tests := []struct {
		name       string
		method     string
		consoleURL string
		wantPath   string
		body       string
		upstream   string
		status     int
	}{
		{name: "add artifact label", method: http.MethodPost, consoleURL: "/api/control/artifact-labels?project=platform&repository=platform%2Fgateway&reference=sha256%3Aabc", wantPath: "/api/v2.0/projects/platform/repositories/gateway/artifacts/sha256:abc/labels", body: `{"id":41}`, upstream: `{}`, status: http.StatusOK},
		{name: "remove artifact label", method: http.MethodDelete, consoleURL: "/api/control/artifact-label?project=platform&repository=platform%2Fgateway&reference=sha256%3Aabc&label=41", wantPath: "/api/v2.0/projects/platform/repositories/gateway/artifacts/sha256:abc/labels/41", upstream: `{}`, status: http.StatusOK},
		{name: "list artifact accessories", method: http.MethodGet, consoleURL: "/api/control/artifact-accessories?project=platform&repository=platform%2Fgateway&reference=sha256%3Aabc&page=2&page_size=50&sort=-creation_time", wantPath: "/api/v2.0/projects/platform/repositories/gateway/artifacts/sha256:abc/accessories", upstream: `[]`, status: http.StatusOK},
		{name: "get artifact SBOM", method: http.MethodGet, consoleURL: "/api/control/artifact-addition?project=platform&repository=platform%2Fgateway&reference=sha256%3Aabc&addition=sbom", wantPath: "/api/v2.0/projects/platform/repositories/gateway/artifacts/sha256:abc/additions/sbom", upstream: `{"spdxVersion":"SPDX-2.3"}`, status: http.StatusOK},
		{name: "get Helm values", method: http.MethodGet, consoleURL: "/api/control/artifact-addition?project=platform&repository=platform%2Fchart&reference=1.0.0&addition=values.yaml", wantPath: "/api/v2.0/projects/platform/repositories/chart/artifacts/1.0.0/additions/values.yaml", upstream: `"replicaCount: 3\\n"`, status: http.StatusOK},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			application, err := newApp()
			if err != nil {
				t.Fatal(err)
			}
			client := mockClient(func(request *http.Request) (int, string) {
				if request.Method != test.method || request.URL.Path != test.wantPath {
					t.Fatalf("upstream request = %s %s, want %s %s", request.Method, request.URL.Path, test.method, test.wantPath)
				}
				if request.Header.Get("X-Is-Resource-Name") != "true" {
					t.Fatal("project resource name header was not forwarded")
				}
				if test.body != "" {
					got, readErr := io.ReadAll(request.Body)
					if readErr != nil {
						t.Fatal(readErr)
					}
					if string(got) != test.body {
						t.Fatalf("upstream body = %s, want %s", got, test.body)
					}
				}
				return test.status, test.upstream
			})
			current := createTestSession(t, application, client, false)
			request := httptest.NewRequest(test.method, test.consoleURL, strings.NewReader(test.body))
			request.AddCookie(&http.Cookie{Name: sessionCookie, Value: current.ID})
			if test.method != http.MethodGet {
				request.Host = "console.test"
				request.Header.Set("Origin", "http://console.test")
			}
			recorder := httptest.NewRecorder()
			application.routes().ServeHTTP(recorder, request)
			if recorder.Code != test.status {
				t.Fatalf("status = %d, want %d; body = %s", recorder.Code, test.status, recorder.Body.String())
			}
		})
	}
}

func TestControlArtifactMetadataRejectsUnsafeParameters(t *testing.T) {
	application, err := newApp()
	if err != nil {
		t.Fatal(err)
	}
	client := mockClient(func(request *http.Request) (int, string) {
		t.Fatalf("invalid request reached Harbor: %s", request.URL.Path)
		return http.StatusInternalServerError, `{}`
	})
	current := createTestSession(t, application, client, false)
	tests := []struct {
		name   string
		method string
		url    string
		body   string
	}{
		{name: "unknown addition", method: http.MethodGet, url: "/api/control/artifact-addition?project=p&repository=r&reference=x&addition=../../manifest"},
		{name: "zero label", method: http.MethodPost, url: "/api/control/artifact-labels?project=p&repository=r&reference=x", body: `{"id":0}`},
		{name: "unknown label field", method: http.MethodPost, url: "/api/control/artifact-labels?project=p&repository=r&reference=x", body: `{"id":1,"name":"injected"}`},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			request := httptest.NewRequest(test.method, test.url, strings.NewReader(test.body))
			request.AddCookie(&http.Cookie{Name: sessionCookie, Value: current.ID})
			if test.method != http.MethodGet {
				request.Host = "console.test"
				request.Header.Set("Origin", "http://console.test")
			}
			recorder := httptest.NewRecorder()
			application.routes().ServeHTTP(recorder, request)
			if recorder.Code != http.StatusBadRequest {
				t.Fatalf("status = %d, want 400; body = %s", recorder.Code, recorder.Body.String())
			}
		})
	}
}

func TestControlArtifactCopyUsesOfficialAPI(t *testing.T) {
	application, err := newApp()
	if err != nil {
		t.Fatal(err)
	}
	const source = "platform/gateway@sha256:41bf0e3b54f9a760a6c1f0b170507173bf6d95f2e8db4dd79f858f31f36c28a4"
	client := mockClient(func(request *http.Request) (int, string) {
		if request.Method != http.MethodPost || request.URL.Path != "/api/v2.0/projects/release/repositories/backend%2Fgateway/artifacts" {
			t.Fatalf("upstream request = %s %s", request.Method, request.URL.Path)
		}
		if got := request.URL.Query().Get("from"); got != source {
			t.Fatalf("copy source = %q, want %q", got, source)
		}
		if request.Body != nil {
			body, readErr := io.ReadAll(request.Body)
			if readErr != nil {
				t.Fatal(readErr)
			}
			if len(body) != 0 {
				t.Fatalf("copy body = %q, want empty", body)
			}
		}
		return http.StatusCreated, `{}`
	})
	current := createTestSession(t, application, client, false)
	request := httptest.NewRequest(http.MethodPost, "/api/control/artifact-copy?project=release&repository=release%2Fbackend%2Fgateway&from="+url.QueryEscape(source), nil)
	request.Host = "console.test"
	request.Header.Set("Origin", "http://console.test")
	request.AddCookie(&http.Cookie{Name: sessionCookie, Value: current.ID})
	recorder := httptest.NewRecorder()
	application.routes().ServeHTTP(recorder, request)
	if recorder.Code != http.StatusCreated {
		t.Fatalf("status = %d, want 201; body = %s", recorder.Code, recorder.Body.String())
	}
}

func TestControlArtifactCopyRejectsInvalidSource(t *testing.T) {
	invalid := []string{"", "gateway", "../platform/gateway:latest", "platform/gateway latest", "https://harbor.test/platform/gateway:latest", "platform/gateway@md5:1234"}
	for _, source := range invalid {
		t.Run(source, func(t *testing.T) {
			application, err := newApp()
			if err != nil {
				t.Fatal(err)
			}
			current := createTestSession(t, application, mockClient(func(*http.Request) (int, string) {
				t.Fatal("invalid artifact copy reached Harbor")
				return http.StatusInternalServerError, `{}`
			}), false)
			request := httptest.NewRequest(http.MethodPost, "/api/control/artifact-copy?project=release&repository=backend&from="+url.QueryEscape(source), nil)
			request.Host = "console.test"
			request.Header.Set("Origin", "http://console.test")
			request.AddCookie(&http.Cookie{Name: sessionCookie, Value: current.ID})
			recorder := httptest.NewRecorder()
			application.routes().ServeHTTP(recorder, request)
			if recorder.Code != http.StatusBadRequest {
				t.Fatalf("status = %d, want 400; body = %s", recorder.Code, recorder.Body.String())
			}
		})
	}
}

func TestDemoArtifactLabelLifecycle(t *testing.T) {
	application, err := newApp()
	if err != nil {
		t.Fatal(err)
	}
	current := createTestSession(t, application, nil, true)
	request := func(method, target, body string) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequest(method, target, strings.NewReader(body))
		req.AddCookie(&http.Cookie{Name: sessionCookie, Value: current.ID})
		if method != http.MethodGet {
			req.Host = "console.test"
			req.Header.Set("Origin", "http://console.test")
		}
		recorder := httptest.NewRecorder()
		application.routes().ServeHTTP(recorder, req)
		return recorder
	}
	artifactURL := "/api/control/artifact?project=platform&repository=platform%2Fgateway&reference=sha256%3A41bf0e3b54f9a760a6c1f0b170507173bf6d95f2e8db4dd79f858f31f36c28a4&with_label=true"
	removeURL := "/api/control/artifact-label?project=platform&repository=platform%2Fgateway&reference=sha256%3A41bf0e3b54f9a760a6c1f0b170507173bf6d95f2e8db4dd79f858f31f36c28a4&label=41"
	if removed := request(http.MethodDelete, removeURL, ""); removed.Code != http.StatusOK {
		t.Fatalf("remove status = %d, body = %s", removed.Code, removed.Body.String())
	}
	afterRemove := request(http.MethodGet, artifactURL, "")
	if strings.Contains(afterRemove.Body.String(), `"id":41`) {
		t.Fatalf("removed label still present: %s", afterRemove.Body.String())
	}
	addURL := "/api/control/artifact-labels?project=platform&repository=platform%2Fgateway&reference=sha256%3A41bf0e3b54f9a760a6c1f0b170507173bf6d95f2e8db4dd79f858f31f36c28a4"
	if added := request(http.MethodPost, addURL, `{"id":41}`); added.Code != http.StatusOK {
		t.Fatalf("add status = %d, body = %s", added.Code, added.Body.String())
	}
	afterAdd := request(http.MethodGet, artifactURL, "")
	if !strings.Contains(afterAdd.Body.String(), `"id":41`) {
		t.Fatalf("added label missing: %s", afterAdd.Body.String())
	}
}

func TestControlGovernanceOperationsUseOfficialAPI(t *testing.T) {
	tests := []struct {
		name       string
		method     string
		consoleURL string
		wantPath   string
		body       string
		upstream   string
		status     int
	}{
		{name: "list robots", method: http.MethodGet, consoleURL: "/api/control/robots?page=1&page_size=20&q=level%3Dproject", wantPath: "/api/v2.0/robots", upstream: `[]`, status: http.StatusOK},
		{name: "create robot", method: http.MethodPost, consoleURL: "/api/control/robots", wantPath: "/api/v2.0/robots", body: `{"name":"ci","level":"project","duration":90,"permissions":[{"kind":"project","namespace":"platform","access":[{"resource":"repository","action":"pull"}]}]}`, upstream: `{"id":42,"name":"robot$platform+ci","secret":"secret"}`, status: http.StatusCreated},
		{name: "update robot", method: http.MethodPut, consoleURL: "/api/control/robot?id=42", wantPath: "/api/v2.0/robots/42", body: `{"name":"robot$platform+ci","level":"project","duration":90,"permissions":[{"kind":"project","namespace":"platform","access":[{"resource":"repository","action":"pull"}]}]}`, upstream: `{}`, status: http.StatusOK},
		{name: "refresh robot secret", method: http.MethodPatch, consoleURL: "/api/control/robot?id=42", wantPath: "/api/v2.0/robots/42", body: `{"secret":""}`, upstream: `{"secret":"new-secret"}`, status: http.StatusOK},
		{name: "delete robot", method: http.MethodDelete, consoleURL: "/api/control/robot?id=42", wantPath: "/api/v2.0/robots/42", upstream: `{}`, status: http.StatusOK},
		{name: "get robot permissions", method: http.MethodGet, consoleURL: "/api/control/permissions", wantPath: "/api/v2.0/permissions", upstream: `{"system":[],"project":[]}`, status: http.StatusOK},
		{name: "list audit event types", method: http.MethodGet, consoleURL: "/api/control/audit-log-events", wantPath: "/api/v2.0/auditlog-exts/events", upstream: `[{"event_type":"push"}]`, status: http.StatusOK},
		{name: "get replication execution", method: http.MethodGet, consoleURL: "/api/control/replication-execution?id=904", wantPath: "/api/v2.0/replication/executions/904", upstream: `{"id":904,"status":"Succeed"}`, status: http.StatusOK},
		{name: "stop replication execution", method: http.MethodPut, consoleURL: "/api/control/replication-execution?id=904", wantPath: "/api/v2.0/replication/executions/904", upstream: `{}`, status: http.StatusOK},
		{name: "list replication tasks", method: http.MethodGet, consoleURL: "/api/control/replication-tasks?id=904&page=1&page_size=20&sort=-start_time", wantPath: "/api/v2.0/replication/executions/904/tasks", upstream: `[]`, status: http.StatusOK},
		{name: "get replication task log", method: http.MethodGet, consoleURL: "/api/control/replication-task-log?id=904&task=1904", wantPath: "/api/v2.0/replication/executions/904/tasks/1904/log", upstream: "copy completed", status: http.StatusOK},
		{name: "list registry adapter metadata", method: http.MethodGet, consoleURL: "/api/control/registry-adapter-infos", wantPath: "/api/v2.0/replication/adapterinfos", upstream: `{"docker-hub":{"endpoint_pattern":{"endpoint_type":"EndpointPatternTypeFix"}}}`, status: http.StatusOK},
		{name: "get local registry replication capabilities", method: http.MethodGet, consoleURL: "/api/control/registry-info?id=0", wantPath: "/api/v2.0/registries/0/info", upstream: `{"type":"harbor","supported_resource_filters":[{"type":"name","style":"input"}],"supported_triggers":["manual","scheduled","event_based"],"supported_copy_by_chunk":true}`, status: http.StatusOK},
		{name: "list labels", method: http.MethodGet, consoleURL: "/api/control/labels?page=1&page_size=20&scope=p&project_id=1", wantPath: "/api/v2.0/labels", upstream: `[]`, status: http.StatusOK},
		{name: "create label", method: http.MethodPost, consoleURL: "/api/control/labels", wantPath: "/api/v2.0/labels", body: `{"name":"release","color":"#f48120","scope":"p","project_id":1}`, upstream: `{}`, status: http.StatusCreated},
		{name: "update label", method: http.MethodPut, consoleURL: "/api/control/label?id=7", wantPath: "/api/v2.0/labels/7", body: `{"name":"stable","color":"#16a34a","scope":"p","project_id":1}`, upstream: `{}`, status: http.StatusOK},
		{name: "delete label", method: http.MethodDelete, consoleURL: "/api/control/label?id=7", wantPath: "/api/v2.0/labels/7", upstream: `{}`, status: http.StatusOK},
		{name: "list immutable rules", method: http.MethodGet, consoleURL: "/api/control/immutable-rules?project=platform&page=1&page_size=20", wantPath: "/api/v2.0/projects/platform/immutabletagrules", upstream: `[]`, status: http.StatusOK},
		{name: "create immutable rule", method: http.MethodPost, consoleURL: "/api/control/immutable-rules?project=platform", wantPath: "/api/v2.0/projects/platform/immutabletagrules", body: `{"tag_selectors":[{"pattern":"v*"}],"scope_selectors":{"repository":[{"pattern":"**"}]}}`, upstream: `{}`, status: http.StatusCreated},
		{name: "update immutable rule", method: http.MethodPut, consoleURL: "/api/control/immutable-rule?project=platform&id=9", wantPath: "/api/v2.0/projects/platform/immutabletagrules/9", body: `{"tag_selectors":[{"pattern":"release-*"}],"scope_selectors":{"repository":[{"pattern":"services/**"}]}}`, upstream: `{}`, status: http.StatusOK},
		{name: "delete immutable rule", method: http.MethodDelete, consoleURL: "/api/control/immutable-rule?project=platform&id=9", wantPath: "/api/v2.0/projects/platform/immutabletagrules/9", upstream: `{}`, status: http.StatusOK},
		{name: "list webhooks", method: http.MethodGet, consoleURL: "/api/control/webhooks?project=platform&page=1&page_size=20", wantPath: "/api/v2.0/projects/platform/webhook/policies", upstream: `[]`, status: http.StatusOK},
		{name: "create webhook", method: http.MethodPost, consoleURL: "/api/control/webhooks?project=platform", wantPath: "/api/v2.0/projects/platform/webhook/policies", body: `{"name":"release","targets":[{"type":"http","address":"https://hooks.example.com/harbor"}],"event_types":["PUSH_ARTIFACT"]}`, upstream: `{}`, status: http.StatusCreated},
		{name: "get webhook", method: http.MethodGet, consoleURL: "/api/control/webhook?project=platform&id=8", wantPath: "/api/v2.0/projects/platform/webhook/policies/8", upstream: `{}`, status: http.StatusOK},
		{name: "update webhook", method: http.MethodPut, consoleURL: "/api/control/webhook?project=platform&id=8", wantPath: "/api/v2.0/projects/platform/webhook/policies/8", body: `{"name":"release","targets":[{"type":"http","address":"https://hooks.example.com/harbor"}],"event_types":["DELETE_ARTIFACT"]}`, upstream: `{}`, status: http.StatusOK},
		{name: "delete webhook", method: http.MethodDelete, consoleURL: "/api/control/webhook?project=platform&id=8", wantPath: "/api/v2.0/projects/platform/webhook/policies/8", upstream: `{}`, status: http.StatusOK},
		{name: "list webhook event types", method: http.MethodGet, consoleURL: "/api/control/webhook-events?project=platform", wantPath: "/api/v2.0/projects/platform/webhook/events", upstream: `{"event_type":["PUSH_ARTIFACT"]}`, status: http.StatusOK},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			application, err := newApp()
			if err != nil {
				t.Fatal(err)
			}
			client := mockClient(func(request *http.Request) (int, string) {
				if request.Method != test.method || request.URL.Path != test.wantPath {
					t.Fatalf("upstream request = %s %s, want %s %s", request.Method, request.URL.Path, test.method, test.wantPath)
				}
				if strings.Contains(test.wantPath, "/projects/platform/") && request.Header.Get("X-Is-Resource-Name") != "true" {
					t.Fatal("project resource name header was not forwarded")
				}
				if test.body != "" {
					got, readErr := io.ReadAll(request.Body)
					if readErr != nil {
						t.Fatal(readErr)
					}
					if string(got) != test.body {
						t.Fatalf("upstream body = %s, want %s", got, test.body)
					}
				}
				return test.status, test.upstream
			})
			current := createTestSession(t, application, client, false)
			request := httptest.NewRequest(test.method, test.consoleURL, strings.NewReader(test.body))
			request.AddCookie(&http.Cookie{Name: sessionCookie, Value: current.ID})
			if test.method != http.MethodGet {
				request.Host = "console.test"
				request.Header.Set("Origin", "http://console.test")
			}
			recorder := httptest.NewRecorder()
			application.routes().ServeHTTP(recorder, request)
			if recorder.Code != test.status {
				t.Fatalf("status = %d, want %d; body = %s", recorder.Code, test.status, recorder.Body.String())
			}
		})
	}
}

func TestControlProjectScannerAndRetentionOperationsUseOfficialAPI(t *testing.T) {
	retentionBody := `{"algorithm":"or","rules":[{"priority":1,"disabled":false,"action":"retain","template":"latestPushedK","params":{"latestPushedK":10},"tag_selectors":[{"kind":"doublestar","decoration":"matches","pattern":"**"}],"scope_selectors":{"repository":[{"kind":"doublestar","decoration":"repoMatches","pattern":"**"}]}}],"trigger":{"kind":"Schedule","settings":{"cron":"0 0 0 * * *"}},"scope":{"level":"project","ref":1}}`
	tests := []struct {
		name       string
		method     string
		consoleURL string
		wantPath   string
		body       string
		upstream   string
		status     int
		project    bool
	}{
		{name: "get project scanner", method: http.MethodGet, consoleURL: "/api/control/project-scanner?project=platform", wantPath: "/api/v2.0/projects/platform/scanner", upstream: `{"uuid":"9f4f3538-31b8-4e23-a59f-8b071dfd0a55"}`, status: http.StatusOK, project: true},
		{name: "set project scanner", method: http.MethodPut, consoleURL: "/api/control/project-scanner?project=platform", wantPath: "/api/v2.0/projects/platform/scanner", body: `{"uuid":"9f4f3538-31b8-4e23-a59f-8b071dfd0a55"}`, upstream: `{}`, status: http.StatusOK, project: true},
		{name: "list project scanner candidates", method: http.MethodGet, consoleURL: "/api/control/project-scanner-candidates?project=platform&page=2&page_size=50&q=name%3D~trivy&sort=name", wantPath: "/api/v2.0/projects/platform/scanner/candidates", upstream: `[]`, status: http.StatusOK, project: true},
		{name: "create retention", method: http.MethodPost, consoleURL: "/api/control/retentions", wantPath: "/api/v2.0/retentions", body: retentionBody, upstream: `{}`, status: http.StatusCreated},
		{name: "get retention", method: http.MethodGet, consoleURL: "/api/control/retention?id=7", wantPath: "/api/v2.0/retentions/7", upstream: retentionBody, status: http.StatusOK},
		{name: "update retention", method: http.MethodPut, consoleURL: "/api/control/retention?id=7", wantPath: "/api/v2.0/retentions/7", body: retentionBody, upstream: `{}`, status: http.StatusOK},
		{name: "delete retention", method: http.MethodDelete, consoleURL: "/api/control/retention?id=7", wantPath: "/api/v2.0/retentions/7", upstream: `{}`, status: http.StatusOK},
		{name: "list retention executions", method: http.MethodGet, consoleURL: "/api/control/retention-executions?id=7&page=1&page_size=20", wantPath: "/api/v2.0/retentions/7/executions", upstream: `[]`, status: http.StatusOK},
		{name: "run retention dry run", method: http.MethodPost, consoleURL: "/api/control/retention-executions?id=7", wantPath: "/api/v2.0/retentions/7/executions", body: `{"dry_run":true}`, upstream: `{}`, status: http.StatusCreated},
		{name: "stop retention execution", method: http.MethodPatch, consoleURL: "/api/control/retention-execution?id=7&eid=12", wantPath: "/api/v2.0/retentions/7/executions/12", body: `{"action":"stop"}`, upstream: `{}`, status: http.StatusOK},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			application, err := newApp()
			if err != nil {
				t.Fatal(err)
			}
			client := mockClient(func(request *http.Request) (int, string) {
				if request.Method != test.method || request.URL.Path != test.wantPath {
					t.Fatalf("upstream request = %s %s, want %s %s", request.Method, request.URL.Path, test.method, test.wantPath)
				}
				if test.project && request.Header.Get("X-Is-Resource-Name") != "true" {
					t.Fatal("project resource name header was not forwarded")
				}
				if test.body != "" {
					got, readErr := io.ReadAll(request.Body)
					if readErr != nil {
						t.Fatal(readErr)
					}
					if string(got) != test.body {
						t.Fatalf("upstream body = %s, want %s", got, test.body)
					}
				}
				return test.status, test.upstream
			})
			current := createTestSession(t, application, client, false)
			request := httptest.NewRequest(test.method, test.consoleURL, strings.NewReader(test.body))
			request.AddCookie(&http.Cookie{Name: sessionCookie, Value: current.ID})
			if test.method != http.MethodGet {
				request.Host = "console.test"
				request.Header.Set("Origin", "http://console.test")
			}
			recorder := httptest.NewRecorder()
			application.routes().ServeHTTP(recorder, request)
			if recorder.Code != test.status {
				t.Fatalf("status = %d, want %d; body = %s", recorder.Code, test.status, recorder.Body.String())
			}
		})
	}
}

func TestControlSecurityOperationsUseOfficialAPI(t *testing.T) {
	allowlistBody := `{"expires_at":null,"items":[{"cve_id":"CVE-2026-1842"}]}`
	exportBody := `{"projects":[1],"labels":[],"repositories":"platform/**","cveIds":"{CVE-2026-1842,CVE-2026-0917}","tags":"release-*"}`
	tests := []struct {
		name       string
		method     string
		consoleURL string
		wantPath   string
		body       string
		upstream   string
		status     int
		export     bool
		raw        bool
	}{
		{name: "security summary", method: http.MethodGet, consoleURL: "/api/control/security-summary?with_dangerous_cve=true&with_dangerous_artifact=true", wantPath: "/api/v2.0/security/summary", upstream: `{}`, status: http.StatusOK},
		{name: "security vulnerabilities", method: http.MethodGet, consoleURL: "/api/control/security-vulnerabilities?page=2&page_size=50&q=severity%3DCritical&tune_count=true&with_tag=true", wantPath: "/api/v2.0/security/vul", upstream: `[]`, status: http.StatusOK},
		{name: "stop artifact scan", method: http.MethodPost, consoleURL: "/api/control/artifact-scan-stop?project=platform&repository=platform%2Fteam%2Fgateway&reference=sha256%3Aabc", wantPath: "/api/v2.0/projects/platform/repositories/team%252Fgateway/artifacts/sha256:abc/scan/stop", body: `{"scan_type":"vulnerability"}`, upstream: `{}`, status: http.StatusAccepted},
		{name: "artifact scan log", method: http.MethodGet, consoleURL: "/api/control/artifact-scan-log?project=platform&repository=platform%2Fgateway&reference=sha256%3Aabc&report=report-1", wantPath: "/api/v2.0/projects/platform/repositories/gateway/artifacts/sha256:abc/scan/report-1/log", upstream: `scan completed`, status: http.StatusOK},
		{name: "get system allowlist", method: http.MethodGet, consoleURL: "/api/control/system-cve-allowlist", wantPath: "/api/v2.0/system/CVEAllowlist", upstream: allowlistBody, status: http.StatusOK},
		{name: "update system allowlist", method: http.MethodPut, consoleURL: "/api/control/system-cve-allowlist", wantPath: "/api/v2.0/system/CVEAllowlist", body: allowlistBody, upstream: `{}`, status: http.StatusOK},
		{name: "create cve export", method: http.MethodPost, consoleURL: "/api/control/cve-export", wantPath: "/api/v2.0/export/cve", body: exportBody, upstream: `{"id":9}`, status: http.StatusOK, export: true},
		{name: "list cve exports", method: http.MethodGet, consoleURL: "/api/control/cve-export-executions", wantPath: "/api/v2.0/export/cve/executions", upstream: `{"items":[]}`, status: http.StatusOK},
		{name: "get cve export", method: http.MethodGet, consoleURL: "/api/control/cve-export-execution?id=9", wantPath: "/api/v2.0/export/cve/execution/9", upstream: `{"id":9}`, status: http.StatusOK},
		{name: "download cve export", method: http.MethodGet, consoleURL: "/api/control/cve-export-download?id=9&format=CSV", wantPath: "/api/v2.0/export/cve/download/9", upstream: "cve_id,severity\nCVE-2026-1842,Critical\n", status: http.StatusOK, raw: true},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			application, err := newApp()
			if err != nil {
				t.Fatal(err)
			}
			client := mockClient(func(request *http.Request) (int, string) {
				if request.Method != test.method || request.URL.EscapedPath() != test.wantPath {
					t.Fatalf("upstream request = %s %s, want %s %s", request.Method, request.URL.EscapedPath(), test.method, test.wantPath)
				}
				if strings.Contains(test.wantPath, "/projects/platform/") && request.Header.Get("X-Is-Resource-Name") != "true" {
					t.Fatal("project resource name header was not forwarded")
				}
				if test.export && request.Header.Get("X-Scan-Data-Type") != "application/vnd.security.vulnerability.report; version=1.1" {
					t.Fatalf("X-Scan-Data-Type = %q", request.Header.Get("X-Scan-Data-Type"))
				}
				if test.body != "" {
					got, readErr := io.ReadAll(request.Body)
					if readErr != nil {
						t.Fatal(readErr)
					}
					if string(got) != test.body {
						t.Fatalf("upstream body = %s, want %s", got, test.body)
					}
				}
				return test.status, test.upstream
			})
			current := createTestSession(t, application, client, false)
			request := httptest.NewRequest(test.method, test.consoleURL, strings.NewReader(test.body))
			request.AddCookie(&http.Cookie{Name: sessionCookie, Value: current.ID})
			if test.method != http.MethodGet {
				request.Host = "console.test"
				request.Header.Set("Origin", "http://console.test")
			}
			recorder := httptest.NewRecorder()
			application.routes().ServeHTTP(recorder, request)
			if recorder.Code != test.status {
				t.Fatalf("status = %d, want %d; body = %s", recorder.Code, test.status, recorder.Body.String())
			}
			if test.raw && recorder.Body.String() != test.upstream {
				t.Fatalf("raw response = %q, want %q", recorder.Body.String(), test.upstream)
			}
		})
	}
}

func TestControlRejectsInvalidSecurityBodies(t *testing.T) {
	tests := []struct {
		method    string
		operation string
		body      string
	}{
		{method: http.MethodPost, operation: "artifact-scan-stop?project=p&repository=r&reference=x", body: `{"scan_type":"malware"}`},
		{method: http.MethodPost, operation: "artifact-scan?project=p&repository=r&reference=x", body: `{"scan_type":"malware"}`},
		{method: http.MethodPut, operation: "system-cve-allowlist", body: `{"expires_at":-1,"items":[]}`},
		{method: http.MethodPut, operation: "system-cve-allowlist", body: `{"expires_at":1893455999.5,"items":[]}`},
		{method: http.MethodPut, operation: "system-cve-allowlist", body: `{"expires_at":null,"items":[{"cve_id":"GHSA-invalid"}]}`},
		{method: http.MethodPut, operation: "project?project=p", body: `{"metadata":{"unknown":"true"}}`},
		{method: http.MethodPut, operation: "project?project=p", body: `{"storage_limit":"1073741824"}`},
		{method: http.MethodPut, operation: "project?project=p", body: `{"metadata":{"reuse_sys_cve_allowlist":"false"},"cve_allowlist":{"expires_at":null,"items":[{"cve_id":"CVE-2026-1842"},{"cve_id":"CVE-2026-1842"}]}}`},
		{method: http.MethodPost, operation: "cve-export", body: `{"projects":[1,2],"labels":[]}`},
		{method: http.MethodPost, operation: "cve-export", body: `{"projects":[1.5],"labels":[]}`},
	}
	for _, test := range tests {
		t.Run(test.operation, func(t *testing.T) {
			application, err := newApp()
			if err != nil {
				t.Fatal(err)
			}
			current := createTestSession(t, application, mockClient(func(*http.Request) (int, string) {
				t.Fatal("invalid security request reached Harbor")
				return http.StatusInternalServerError, `{}`
			}), false)
			request := httptest.NewRequest(test.method, "/api/control/"+test.operation, strings.NewReader(test.body))
			request.Host = "console.test"
			request.Header.Set("Origin", "http://console.test")
			request.AddCookie(&http.Cookie{Name: sessionCookie, Value: current.ID})
			recorder := httptest.NewRecorder()
			application.routes().ServeHTTP(recorder, request)
			if recorder.Code != http.StatusBadRequest {
				t.Fatalf("status = %d, want 400; body = %s", recorder.Code, recorder.Body.String())
			}
		})
	}
}

func TestControlP2PPreheatOperationsUseOfficialAPI(t *testing.T) {
	instanceBody := `{"name":"dragonfly-prod","description":"production","vendor":"dragonfly","endpoint":"https://dragonfly.test","auth_mode":"NONE","enabled":true,"insecure":false}`
	policyBody := `{"name":"release","description":"release images","project_id":1,"provider_id":4,"filters":"[{\"type\":\"repository\",\"value\":\"**\"},{\"type\":\"tag\",\"value\":\"release-*\"}]","trigger":"{\"type\":\"manual\",\"trigger_setting\":{\"cron\":\"\"}}","enabled":true}`
	tests := []struct {
		name       string
		method     string
		consoleURL string
		wantPath   string
		body       string
		upstream   string
		status     int
		project    bool
	}{
		{name: "list provider types", method: http.MethodGet, consoleURL: "/api/control/preheat-providers", wantPath: "/api/v2.0/p2p/preheat/providers", upstream: `[{"id":"dragonfly"}]`, status: http.StatusOK},
		{name: "list instances", method: http.MethodGet, consoleURL: "/api/control/preheat-instances?page=1&page_size=20&sort=name&q=name%3D~prod", wantPath: "/api/v2.0/p2p/preheat/instances", upstream: `[]`, status: http.StatusOK},
		{name: "create instance", method: http.MethodPost, consoleURL: "/api/control/preheat-instances", wantPath: "/api/v2.0/p2p/preheat/instances", body: instanceBody, upstream: `{}`, status: http.StatusCreated},
		{name: "get instance", method: http.MethodGet, consoleURL: "/api/control/preheat-instance?name=dragonfly-prod", wantPath: "/api/v2.0/p2p/preheat/instances/dragonfly-prod", upstream: instanceBody, status: http.StatusOK},
		{name: "update instance", method: http.MethodPut, consoleURL: "/api/control/preheat-instance?name=dragonfly-prod", wantPath: "/api/v2.0/p2p/preheat/instances/dragonfly-prod", body: instanceBody, upstream: `{}`, status: http.StatusOK},
		{name: "delete instance", method: http.MethodDelete, consoleURL: "/api/control/preheat-instance?name=dragonfly-prod", wantPath: "/api/v2.0/p2p/preheat/instances/dragonfly-prod", upstream: `{}`, status: http.StatusOK},
		{name: "ping saved instance", method: http.MethodPost, consoleURL: "/api/control/preheat-instance-ping", wantPath: "/api/v2.0/p2p/preheat/instances/ping", body: `{"id":4}`, upstream: `{}`, status: http.StatusOK},
		{name: "list project providers", method: http.MethodGet, consoleURL: "/api/control/project-preheat-providers?project=platform", wantPath: "/api/v2.0/projects/platform/preheat/providers", upstream: `[{"id":4,"provider":"dragonfly"}]`, status: http.StatusOK, project: true},
		{name: "list policies", method: http.MethodGet, consoleURL: "/api/control/preheat-policies?project=platform&page=1&page_size=20&sort=-update_time", wantPath: "/api/v2.0/projects/platform/preheat/policies", upstream: `[]`, status: http.StatusOK, project: true},
		{name: "create policy", method: http.MethodPost, consoleURL: "/api/control/preheat-policies?project=platform", wantPath: "/api/v2.0/projects/platform/preheat/policies", body: policyBody, upstream: `{}`, status: http.StatusCreated, project: true},
		{name: "get policy", method: http.MethodGet, consoleURL: "/api/control/preheat-policy?project=platform&name=release", wantPath: "/api/v2.0/projects/platform/preheat/policies/release", upstream: policyBody, status: http.StatusOK, project: true},
		{name: "update policy", method: http.MethodPut, consoleURL: "/api/control/preheat-policy?project=platform&name=release", wantPath: "/api/v2.0/projects/platform/preheat/policies/release", body: policyBody, upstream: `{}`, status: http.StatusOK, project: true},
		{name: "manual preheat", method: http.MethodPost, consoleURL: "/api/control/preheat-policy?project=platform&name=release", wantPath: "/api/v2.0/projects/platform/preheat/policies/release", body: policyBody, upstream: `{}`, status: http.StatusCreated, project: true},
		{name: "delete policy", method: http.MethodDelete, consoleURL: "/api/control/preheat-policy?project=platform&name=release", wantPath: "/api/v2.0/projects/platform/preheat/policies/release", upstream: `{}`, status: http.StatusOK, project: true},
		{name: "list executions", method: http.MethodGet, consoleURL: "/api/control/preheat-executions?project=platform&name=release&page=1&page_size=20", wantPath: "/api/v2.0/projects/platform/preheat/policies/release/executions", upstream: `[]`, status: http.StatusOK, project: true},
		{name: "get execution", method: http.MethodGet, consoleURL: "/api/control/preheat-execution?project=platform&name=release&id=9", wantPath: "/api/v2.0/projects/platform/preheat/policies/release/executions/9", upstream: `{"id":9}`, status: http.StatusOK, project: true},
		{name: "stop execution", method: http.MethodPatch, consoleURL: "/api/control/preheat-execution?project=platform&name=release&id=9", wantPath: "/api/v2.0/projects/platform/preheat/policies/release/executions/9", body: `{"status":"Stopped"}`, upstream: `{}`, status: http.StatusOK, project: true},
		{name: "list tasks", method: http.MethodGet, consoleURL: "/api/control/preheat-tasks?project=platform&name=release&id=9&page=1&page_size=20", wantPath: "/api/v2.0/projects/platform/preheat/policies/release/executions/9/tasks", upstream: `[]`, status: http.StatusOK, project: true},
		{name: "get task log", method: http.MethodGet, consoleURL: "/api/control/preheat-task-log?project=platform&name=release&id=9&task=10", wantPath: "/api/v2.0/projects/platform/preheat/policies/release/executions/9/tasks/10/logs", upstream: "done", status: http.StatusOK, project: true},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			application, err := newApp()
			if err != nil {
				t.Fatal(err)
			}
			client := mockClient(func(request *http.Request) (int, string) {
				if request.Method != test.method || request.URL.Path != test.wantPath {
					t.Fatalf("upstream request = %s %s, want %s %s", request.Method, request.URL.Path, test.method, test.wantPath)
				}
				if test.project && request.Header.Get("X-Is-Resource-Name") != "true" {
					t.Fatal("project resource name header was not forwarded")
				}
				if test.body != "" {
					got, readErr := io.ReadAll(request.Body)
					if readErr != nil {
						t.Fatal(readErr)
					}
					if string(got) != test.body {
						t.Fatalf("upstream body = %s, want %s", got, test.body)
					}
				}
				return test.status, test.upstream
			})
			current := createTestSession(t, application, client, false)
			request := httptest.NewRequest(test.method, test.consoleURL, strings.NewReader(test.body))
			request.AddCookie(&http.Cookie{Name: sessionCookie, Value: current.ID})
			if test.method != http.MethodGet {
				request.Host = "console.test"
				request.Header.Set("Origin", "http://console.test")
			}
			recorder := httptest.NewRecorder()
			application.routes().ServeHTTP(recorder, request)
			if recorder.Code != test.status {
				t.Fatalf("status = %d, want %d; body = %s", recorder.Code, test.status, recorder.Body.String())
			}
		})
	}
}

func TestControlP2PPreheatRejectsInvalidOfficialPayloads(t *testing.T) {
	application, err := newApp()
	if err != nil {
		t.Fatal(err)
	}
	client := mockClient(func(request *http.Request) (int, string) {
		t.Fatalf("invalid P2P request reached Harbor: %s", request.URL.Path)
		return http.StatusInternalServerError, `{}`
	})
	current := createTestSession(t, application, client, false)
	tests := []struct{ name, operation, body string }{
		{name: "invalid instance name", operation: "preheat-instances", body: `{"name":"bad name","vendor":"dragonfly","endpoint":"https://dragonfly.test"}`},
		{name: "unsafe endpoint", operation: "preheat-instances", body: `{"name":"dragonfly","vendor":"dragonfly","endpoint":"file:///etc/passwd"}`},
		{name: "invalid filters", operation: "preheat-policies?project=platform", body: `{"name":"release","provider_id":1,"filters":"{}","trigger":"{\"type\":\"manual\"}"}`},
		{name: "missing scheduled cron", operation: "preheat-policies?project=platform", body: `{"name":"release","provider_id":1,"filters":"[{\"type\":\"repository\",\"value\":\"**\"}]","trigger":"{\"type\":\"scheduled\",\"trigger_setting\":{\"cron\":\"\"}}"}`},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			request := httptest.NewRequest(http.MethodPost, "/api/control/"+test.operation, strings.NewReader(test.body))
			request.AddCookie(&http.Cookie{Name: sessionCookie, Value: current.ID})
			request.Host = "console.test"
			request.Header.Set("Origin", "http://console.test")
			recorder := httptest.NewRecorder()
			application.routes().ServeHTTP(recorder, request)
			if recorder.Code != http.StatusBadRequest {
				t.Fatalf("status = %d, want 400; body = %s", recorder.Code, recorder.Body.String())
			}
		})
	}
}

func TestControlAdministrationOperationsUseOfficialAPI(t *testing.T) {
	tests := []struct {
		name       string
		method     string
		consoleURL string
		wantPath   string
		body       string
		upstream   string
		status     int
	}{
		{name: "list users", method: http.MethodGet, consoleURL: "/api/control/users?page=1&page_size=20&q=username%3D~dev", wantPath: "/api/v2.0/users", upstream: `[]`, status: http.StatusOK},
		{name: "create user", method: http.MethodPost, consoleURL: "/api/control/users", wantPath: "/api/v2.0/users", body: `{"username":"dev","password":"Password-123","email":"dev@example.com"}`, upstream: `{}`, status: http.StatusCreated},
		{name: "update user", method: http.MethodPut, consoleURL: "/api/control/user?id=7", wantPath: "/api/v2.0/users/7", body: `{"email":"dev@example.com","realname":"开发者","comment":"平台组"}`, upstream: `{}`, status: http.StatusOK},
		{name: "delete user", method: http.MethodDelete, consoleURL: "/api/control/user?id=7", wantPath: "/api/v2.0/users/7", upstream: `{}`, status: http.StatusOK},
		{name: "set sysadmin", method: http.MethodPut, consoleURL: "/api/control/user-sysadmin?id=7", wantPath: "/api/v2.0/users/7/sysadmin", body: `{"sysadmin_flag":true}`, upstream: `{}`, status: http.StatusOK},
		{name: "update password", method: http.MethodPut, consoleURL: "/api/control/user-password?id=7", wantPath: "/api/v2.0/users/7/password", body: `{"new_password":"Password-456"}`, upstream: `{}`, status: http.StatusOK},
		{name: "list groups", method: http.MethodGet, consoleURL: "/api/control/user-groups?page=1&page_size=20&group_name=ops", wantPath: "/api/v2.0/usergroups", upstream: `[]`, status: http.StatusOK},
		{name: "create group", method: http.MethodPost, consoleURL: "/api/control/user-groups", wantPath: "/api/v2.0/usergroups", body: `{"group_name":"platform-ops","group_type":3,"ldap_group_dn":""}`, upstream: `{}`, status: http.StatusCreated},
		{name: "update group", method: http.MethodPut, consoleURL: "/api/control/user-group?id=9", wantPath: "/api/v2.0/usergroups/9", body: `{"group_name":"release-ops","group_type":3,"ldap_group_dn":""}`, upstream: `{}`, status: http.StatusOK},
		{name: "delete group", method: http.MethodDelete, consoleURL: "/api/control/user-group?id=9", wantPath: "/api/v2.0/usergroups/9", upstream: `{}`, status: http.StatusOK},
		{name: "list quotas", method: http.MethodGet, consoleURL: "/api/control/quotas?page=1&page_size=20&reference=project", wantPath: "/api/v2.0/quotas", upstream: `[]`, status: http.StatusOK},
		{name: "update quota", method: http.MethodPut, consoleURL: "/api/control/quota?id=3", wantPath: "/api/v2.0/quotas/3", body: `{"hard":{"storage":53687091200}}`, upstream: `{}`, status: http.StatusOK},
		{name: "list scanners", method: http.MethodGet, consoleURL: "/api/control/scanners?page=1&page_size=20", wantPath: "/api/v2.0/scanners", upstream: `[]`, status: http.StatusOK},
		{name: "create scanner", method: http.MethodPost, consoleURL: "/api/control/scanners", wantPath: "/api/v2.0/scanners", body: `{"name":"Trivy","url":"http://scanner:8080","auth":"","access_credential":""}`, upstream: `{}`, status: http.StatusCreated},
		{name: "update scanner", method: http.MethodPut, consoleURL: "/api/control/scanner?id=trivy-001", wantPath: "/api/v2.0/scanners/trivy-001", body: `{"name":"Trivy","url":"http://scanner:8080","auth":"","access_credential":""}`, upstream: `{}`, status: http.StatusOK},
		{name: "default scanner", method: http.MethodPatch, consoleURL: "/api/control/scanner?id=trivy-001", wantPath: "/api/v2.0/scanners/trivy-001", body: `{"is_default":true}`, upstream: `{}`, status: http.StatusOK},
		{name: "delete scanner", method: http.MethodDelete, consoleURL: "/api/control/scanner?id=trivy-001", wantPath: "/api/v2.0/scanners/trivy-001", upstream: `{}`, status: http.StatusOK},
		{name: "ping scanner", method: http.MethodPost, consoleURL: "/api/control/scanner-ping", wantPath: "/api/v2.0/scanners/ping", body: `{"name":"Trivy","url":"http://scanner:8080"}`, upstream: `{}`, status: http.StatusOK},
		{name: "gc history", method: http.MethodGet, consoleURL: "/api/control/gc-history?page=1&page_size=20", wantPath: "/api/v2.0/system/gc", upstream: `[]`, status: http.StatusOK},
		{name: "gc log", method: http.MethodGet, consoleURL: "/api/control/gc-log?id=31", wantPath: "/api/v2.0/system/gc/31/log", upstream: "garbage collection log", status: http.StatusOK},
		{name: "run gc", method: http.MethodPost, consoleURL: "/api/control/gc-schedule", wantPath: "/api/v2.0/system/gc/schedule", body: `{"schedule":{"type":"Manual"},"parameters":{"dry_run":true,"delete_untagged":true,"delete_tag":false,"workers":2}}`, upstream: `{}`, status: http.StatusCreated},
		{name: "update gc schedule", method: http.MethodPut, consoleURL: "/api/control/gc-schedule", wantPath: "/api/v2.0/system/gc/schedule", body: `{"schedule":{"type":"Custom","cron":"0 0 2 * * *"},"parameters":{"dry_run":false,"delete_untagged":true,"delete_tag":true,"workers":1}}`, upstream: `{}`, status: http.StatusOK},
		{name: "stop gc", method: http.MethodPut, consoleURL: "/api/control/gc-job?id=31", wantPath: "/api/v2.0/system/gc/31", upstream: `{}`, status: http.StatusOK},
		{name: "scan metrics", method: http.MethodGet, consoleURL: "/api/control/scan-all-metrics", wantPath: "/api/v2.0/scans/all/metrics", upstream: `{}`, status: http.StatusOK},
		{name: "run scan all", method: http.MethodPost, consoleURL: "/api/control/scan-all-schedule", wantPath: "/api/v2.0/system/scanAll/schedule", body: `{"schedule":{"type":"Manual"}}`, upstream: `{}`, status: http.StatusCreated},
		{name: "stop scan all", method: http.MethodPost, consoleURL: "/api/control/scan-all-stop", wantPath: "/api/v2.0/system/scanAll/stop", upstream: `{}`, status: http.StatusAccepted},
		{name: "get configuration", method: http.MethodGet, consoleURL: "/api/control/configurations", wantPath: "/api/v2.0/configurations", upstream: `{}`, status: http.StatusOK},
		{name: "update configuration", method: http.MethodPut, consoleURL: "/api/control/configurations", wantPath: "/api/v2.0/configurations", body: `{"auth_mode":"oidc_auth","oidc_endpoint":"https://sso.example.com","oidc_verify_cert":true,"robot_name_prefix":"robot$","banner_message":"{\"message\":\"维护通知\",\"type\":\"warning\",\"closable\":true,\"fromDate\":null,\"toDate\":null}"}`, upstream: `{}`, status: http.StatusOK},
		{name: "download root certificate", method: http.MethodGet, consoleURL: "/api/control/system-root-certificate", wantPath: "/api/v2.0/systeminfo/getcert", upstream: "root-certificate", status: http.StatusOK},
		{name: "test ldap", method: http.MethodPost, consoleURL: "/api/control/ldap-ping", wantPath: "/api/v2.0/ldap/ping", body: `{"ldap_url":"ldaps://ldap.example.com:636","ldap_base_dn":"dc=example,dc=com","ldap_uid":"uid","ldap_scope":2,"ldap_connection_timeout":5,"ldap_verify_cert":true}`, upstream: `{"success":true}`, status: http.StatusOK},
		{name: "test oidc", method: http.MethodPost, consoleURL: "/api/control/oidc-ping", wantPath: "/api/v2.0/system/oidc/ping", body: `{"url":"https://sso.example.com","verify_cert":true}`, upstream: `{}`, status: http.StatusOK},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			application, err := newApp()
			if err != nil {
				t.Fatal(err)
			}
			client := mockClient(func(request *http.Request) (int, string) {
				if request.Method != test.method || request.URL.Path != test.wantPath {
					t.Fatalf("upstream request = %s %s, want %s %s", request.Method, request.URL.Path, test.method, test.wantPath)
				}
				if test.body != "" {
					got, readErr := io.ReadAll(request.Body)
					if readErr != nil {
						t.Fatal(readErr)
					}
					if string(got) != test.body {
						t.Fatalf("upstream body = %s, want %s", got, test.body)
					}
				}
				return test.status, test.upstream
			})
			current := createTestSession(t, application, client, false)
			request := httptest.NewRequest(test.method, test.consoleURL, strings.NewReader(test.body))
			request.AddCookie(&http.Cookie{Name: sessionCookie, Value: current.ID})
			if test.method != http.MethodGet {
				request.Host = "console.test"
				request.Header.Set("Origin", "http://console.test")
			}
			recorder := httptest.NewRecorder()
			application.routes().ServeHTTP(recorder, request)
			if recorder.Code != test.status {
				t.Fatalf("status = %d, want %d; body = %s", recorder.Code, test.status, recorder.Body.String())
			}
		})
	}
}

func TestControlDirectoryAndScannerMetadataUseOfficialAPI(t *testing.T) {
	tests := []struct {
		name       string
		method     string
		consoleURL string
		wantPath   string
		wantQuery  string
		body       string
		upstream   string
		status     int
	}{
		{name: "search ldap users", method: http.MethodGet, consoleURL: "/api/control/ldap-users-search?username=release", wantPath: "/api/v2.0/ldap/users/search", wantQuery: "username=release", upstream: `[{"username":"release-engineer","realname":"Release Engineer","email":"release@example.com"}]`, status: http.StatusOK},
		{name: "import ldap users", method: http.MethodPost, consoleURL: "/api/control/ldap-users-import", wantPath: "/api/v2.0/ldap/users/import", body: `{"ldap_uid_list":["release-engineer","security-reviewer"]}`, upstream: `{}`, status: http.StatusOK},
		{name: "search ldap groups by name", method: http.MethodGet, consoleURL: "/api/control/ldap-groups-search?groupname=platform", wantPath: "/api/v2.0/ldap/groups/search", wantQuery: "groupname=platform", upstream: `[{"group_name":"platform-ops","group_type":1,"ldap_group_dn":"cn=platform-ops,ou=groups,dc=example,dc=com"}]`, status: http.StatusOK},
		{name: "search ldap groups by dn", method: http.MethodGet, consoleURL: "/api/control/ldap-groups-search?groupdn=cn%3Drelease%2Cou%3Dgroups%2Cdc%3Dexample%2Cdc%3Dcom", wantPath: "/api/v2.0/ldap/groups/search", wantQuery: "groupdn=cn%3Drelease%2Cou%3Dgroups%2Cdc%3Dexample%2Cdc%3Dcom", upstream: `[]`, status: http.StatusOK},
		{name: "create project ldap group member", method: http.MethodPost, consoleURL: "/api/control/project-members?project=platform", wantPath: "/api/v2.0/projects/platform/members", body: `{"role_id":4,"member_group":{"group_name":"platform-ops","group_type":1,"ldap_group_dn":"cn=platform-ops,ou=groups,dc=example,dc=com"}}`, upstream: `{}`, status: http.StatusCreated},
		{name: "scanner metadata", method: http.MethodGet, consoleURL: "/api/control/scanner-metadata?id=trivy-001", wantPath: "/api/v2.0/scanners/trivy-001/metadata", upstream: `{"scanner":{"name":"Trivy","vendor":"Aqua Security","version":"0.57.1"},"capabilities":[{"type":"vulnerability","consumes_mime_types":["application/vnd.oci.image.manifest.v1+json"],"produces_mime_types":["application/vnd.scanner.adapter.vuln.report.harbor+json; version=1.1"]}],"properties":{"harbor.scanner-adapter/vulnerability-database-updated-at":"2026-07-30T00:00:00Z"}}`, status: http.StatusOK},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			application, err := newApp()
			if err != nil {
				t.Fatal(err)
			}
			client := mockClient(func(request *http.Request) (int, string) {
				if request.Method != test.method || request.URL.Path != test.wantPath {
					t.Fatalf("upstream request = %s %s, want %s %s", request.Method, request.URL.Path, test.method, test.wantPath)
				}
				if request.URL.RawQuery != test.wantQuery {
					t.Fatalf("upstream query = %q, want %q", request.URL.RawQuery, test.wantQuery)
				}
				if test.body != "" {
					got, readErr := io.ReadAll(request.Body)
					if readErr != nil {
						t.Fatal(readErr)
					}
					if string(got) != test.body {
						t.Fatalf("upstream body = %s, want %s", got, test.body)
					}
				}
				if strings.Contains(test.wantPath, "/projects/") && request.Header.Get("X-Is-Resource-Name") != "true" {
					t.Fatal("project resource name header was not forwarded")
				}
				return test.status, test.upstream
			})
			current := createTestSession(t, application, client, false)
			request := httptest.NewRequest(test.method, test.consoleURL, strings.NewReader(test.body))
			request.AddCookie(&http.Cookie{Name: sessionCookie, Value: current.ID})
			if test.method != http.MethodGet {
				request.Host = "console.test"
				request.Header.Set("Origin", "http://console.test")
			}
			recorder := httptest.NewRecorder()
			application.routes().ServeHTTP(recorder, request)
			if recorder.Code != test.status {
				t.Fatalf("status = %d, want %d; body = %s", recorder.Code, test.status, recorder.Body.String())
			}
		})
	}
}

func TestControlRejectsInvalidDirectoryPayloads(t *testing.T) {
	tests := []struct {
		name       string
		method     string
		consoleURL string
		body       string
	}{
		{name: "empty ldap import", method: http.MethodPost, consoleURL: "/api/control/ldap-users-import", body: `{"ldap_uid_list":[]}`},
		{name: "unknown ldap import field", method: http.MethodPost, consoleURL: "/api/control/ldap-users-import", body: `{"ldap_uid_list":["operator"],"admin":true}`},
		{name: "both user and group member", method: http.MethodPost, consoleURL: "/api/control/project-members?project=platform", body: `{"role_id":2,"member_user":{"username":"operator"},"member_group":{"group_name":"platform-ops","group_type":1,"ldap_group_dn":"cn=platform-ops,dc=example,dc=com"}}`},
		{name: "ldap group without dn", method: http.MethodPost, consoleURL: "/api/control/project-members?project=platform", body: `{"role_id":2,"member_group":{"group_name":"platform-ops","group_type":1,"ldap_group_dn":""}}`},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			application, err := newApp()
			if err != nil {
				t.Fatal(err)
			}
			current := createTestSession(t, application, mockClient(func(*http.Request) (int, string) {
				t.Fatal("invalid directory request reached Harbor")
				return http.StatusInternalServerError, `{}`
			}), false)
			request := httptest.NewRequest(test.method, test.consoleURL, strings.NewReader(test.body))
			request.AddCookie(&http.Cookie{Name: sessionCookie, Value: current.ID})
			request.Host = "console.test"
			request.Header.Set("Origin", "http://console.test")
			recorder := httptest.NewRecorder()
			application.routes().ServeHTTP(recorder, request)
			if recorder.Code != http.StatusBadRequest {
				t.Fatalf("status = %d, want 400; body = %s", recorder.Code, recorder.Body.String())
			}
		})
	}
}

func TestPublicCatalogUsesAnonymousOfficialAPIs(t *testing.T) {
	tests := []struct {
		name            string
		endpoint        string
		body            string
		wantPath        string
		wantEscapedPath string
		wantQuery       string
	}{
		{name: "projects", endpoint: "/api/public/projects", body: `{"url":"https://harbor.test","page":2,"page_size":20,"query":"platform"}`, wantPath: "/api/v2.0/projects", wantQuery: "page=2&page_size=20&public=true&q=name%3D~platform&sort=name&with_detail=true"},
		{name: "repositories", endpoint: "/api/public/repositories", body: `{"url":"https://harbor.test","project":"platform","page":1,"page_size":50}`, wantPath: "/api/v2.0/projects/platform/repositories", wantQuery: "page=1&page_size=50&sort=name"},
		{name: "artifacts", endpoint: "/api/public/artifacts", body: `{"url":"https://harbor.test","project":"platform","repository":"platform/team/gateway","page":1,"page_size":20}`, wantPath: "/api/v2.0/projects/platform/repositories/team%2Fgateway/artifacts", wantEscapedPath: "/api/v2.0/projects/platform/repositories/team%252Fgateway/artifacts", wantQuery: "page=1&page_size=20&sort=-push_time&with_accessory=true&with_label=true&with_scan_overview=true&with_tag=true"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			application, err := newApp()
			if err != nil {
				t.Fatal(err)
			}
			application.newClient = func(bool) *http.Client {
				return mockClient(func(request *http.Request) (int, string) {
					if request.Method != http.MethodGet || request.URL.Path != test.wantPath {
						t.Fatalf("upstream request = %s %s, want GET %s", request.Method, request.URL.Path, test.wantPath)
					}
					if request.URL.RawQuery != test.wantQuery {
						t.Fatalf("upstream query = %q, want %q", request.URL.RawQuery, test.wantQuery)
					}
					if test.wantEscapedPath != "" && request.URL.EscapedPath() != test.wantEscapedPath {
						t.Fatalf("upstream escaped path = %q, want %q", request.URL.EscapedPath(), test.wantEscapedPath)
					}
					if request.Header.Get("Authorization") != "" {
						t.Fatalf("public catalog forwarded credentials: %q", request.Header.Get("Authorization"))
					}
					return http.StatusOK, `[{"name":"platform"}]`
				})
			}
			request := httptest.NewRequest(http.MethodPost, test.endpoint, strings.NewReader(test.body))
			request.Host = "console.test"
			request.Header.Set("Origin", "http://console.test")
			recorder := httptest.NewRecorder()
			application.routes().ServeHTTP(recorder, request)
			if recorder.Code != http.StatusOK {
				t.Fatalf("status = %d, want 200; body = %s", recorder.Code, recorder.Body.String())
			}
			if len(recorder.Result().Cookies()) != 0 {
				t.Fatal("public catalog must not create a session cookie")
			}
		})
	}
}

func TestAboutExposesProductMetadataWithoutOperationManifest(t *testing.T) {
	application, err := newApp()
	if err != nil {
		t.Fatal(err)
	}
	recorder := httptest.NewRecorder()
	application.routes().ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api/about", nil))
	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body = %s", recorder.Code, recorder.Body.String())
	}
	var payload struct {
		Harbor struct {
			APIVersion string `json:"api_version"`
			License    struct {
				SPDX string `json:"spdx"`
			} `json:"license"`
		} `json:"harbor"`
		Operations    json.RawMessage  `json:"operations"`
		PublicCatalog []map[string]any `json:"public_catalog"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	if payload.Harbor.APIVersion != "v2.0" || payload.Harbor.License.SPDX != "Apache-2.0" {
		t.Fatalf("unexpected Harbor information: %#v", payload.Harbor)
	}
	if payload.Operations != nil {
		t.Fatalf("about payload must not expose the removed operation manifest: %s", payload.Operations)
	}
	if len(payload.PublicCatalog) != 3 {
		t.Fatalf("public catalog operation count = %d, want 3", len(payload.PublicCatalog))
	}
}

func TestControlCurrentUserOperationsUseOfficialAPI(t *testing.T) {
	tests := []struct {
		name       string
		method     string
		consoleURL string
		wantPath   string
		wantQuery  string
		body       string
		upstream   string
	}{
		{name: "current user", method: http.MethodGet, consoleURL: "/api/control/current-user", wantPath: "/api/v2.0/users/current", upstream: `{"user_id":7,"username":"operator"}`},
		{name: "system permissions", method: http.MethodGet, consoleURL: "/api/control/current-permissions?scope=%2F&relative=true", wantPath: "/api/v2.0/users/current/permissions", wantQuery: "relative=true&scope=%2F", upstream: `[{"resource":"system","action":"read"}]`},
		{name: "project permissions", method: http.MethodGet, consoleURL: "/api/control/current-permissions?scope=%2Fproject%2F9&relative=true", wantPath: "/api/v2.0/users/current/permissions", wantQuery: "relative=true&scope=%2Fproject%2F9", upstream: `[{"resource":"repository","action":"list"}]`},
		{name: "update own profile", method: http.MethodPut, consoleURL: "/api/control/user?id=7", wantPath: "/api/v2.0/users/7", body: `{"email":"operator@example.com","realname":"Operator","comment":"release"}`, upstream: `{}`},
		{name: "update own password", method: http.MethodPut, consoleURL: "/api/control/user-password?id=7", wantPath: "/api/v2.0/users/7/password", body: `{"old_password":"password-old","new_password":"Password-New1"}`, upstream: `{}`},
		{name: "set cli secret", method: http.MethodPut, consoleURL: "/api/control/user-cli-secret?id=7", wantPath: "/api/v2.0/users/7/cli_secret", body: `{"secret":"OidcCliSecret123"}`, upstream: `{}`},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			application, err := newApp()
			if err != nil {
				t.Fatal(err)
			}
			client := mockClient(func(request *http.Request) (int, string) {
				if request.Method != test.method || request.URL.Path != test.wantPath {
					t.Fatalf("upstream request = %s %s, want %s %s", request.Method, request.URL.Path, test.method, test.wantPath)
				}
				if request.URL.RawQuery != test.wantQuery {
					t.Fatalf("upstream query = %q, want %q", request.URL.RawQuery, test.wantQuery)
				}
				if test.body != "" {
					got, readErr := io.ReadAll(request.Body)
					if readErr != nil {
						t.Fatal(readErr)
					}
					if string(got) != test.body {
						t.Fatalf("upstream body = %s, want %s", got, test.body)
					}
				}
				return http.StatusOK, test.upstream
			})
			current := createTestSession(t, application, client, false)
			request := httptest.NewRequest(test.method, test.consoleURL, strings.NewReader(test.body))
			request.AddCookie(&http.Cookie{Name: sessionCookie, Value: current.ID})
			if test.method != http.MethodGet {
				request.Host = "console.test"
				request.Header.Set("Origin", "http://console.test")
			}
			recorder := httptest.NewRecorder()
			application.routes().ServeHTTP(recorder, request)
			if recorder.Code != http.StatusOK {
				t.Fatalf("status = %d, want 200; body = %s", recorder.Code, recorder.Body.String())
			}
		})
	}
}

func TestControlRejectsInvalidCurrentUserOperations(t *testing.T) {
	tests := []struct {
		name       string
		method     string
		consoleURL string
		body       string
	}{
		{name: "permission relative", method: http.MethodGet, consoleURL: "/api/control/current-permissions?scope=%2F&relative=yes"},
		{name: "permission scope", method: http.MethodGet, consoleURL: "/api/control/current-permissions?scope=project%2F9&relative=true"},
		{name: "profile unknown field", method: http.MethodPut, consoleURL: "/api/control/user?id=7", body: `{"email":"operator@example.com","username":"renamed"}`},
		{name: "password unknown field", method: http.MethodPut, consoleURL: "/api/control/user-password?id=7", body: `{"old_password":"password-old","new_password":"Password-New1","admin":true}`},
		{name: "short cli secret", method: http.MethodPut, consoleURL: "/api/control/user-cli-secret?id=7", body: `{"secret":"short"}`},
		{name: "cli secret unknown field", method: http.MethodPut, consoleURL: "/api/control/user-cli-secret?id=7", body: `{"secret":"OidcCliSecret123","keep":true}`},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			application, err := newApp()
			if err != nil {
				t.Fatal(err)
			}
			current := createTestSession(t, application, mockClient(func(*http.Request) (int, string) {
				t.Fatal("invalid current-user request reached Harbor")
				return http.StatusInternalServerError, `{}`
			}), false)
			request := httptest.NewRequest(test.method, test.consoleURL, strings.NewReader(test.body))
			request.AddCookie(&http.Cookie{Name: sessionCookie, Value: current.ID})
			if test.method != http.MethodGet {
				request.Host = "console.test"
				request.Header.Set("Origin", "http://console.test")
			}
			recorder := httptest.NewRecorder()
			application.routes().ServeHTTP(recorder, request)
			if recorder.Code != http.StatusBadRequest {
				t.Fatalf("status = %d, want 400; body = %s", recorder.Code, recorder.Body.String())
			}
		})
	}
}

func TestCurrentPasswordUpdateKeepsActiveSessionConnected(t *testing.T) {
	application, err := newApp()
	if err != nil {
		t.Fatal(err)
	}
	const oldPassword = "OldPassword1"
	const newPassword = "NewPassword2"
	passwordChanged := false
	client := mockClient(func(request *http.Request) (int, string) {
		username, password, ok := request.BasicAuth()
		if !ok || username != "operator" {
			t.Fatalf("missing operator basic auth")
		}
		if request.URL.Path == "/api/v2.0/users/current" {
			wantPassword := oldPassword
			if passwordChanged {
				wantPassword = newPassword
			}
			if password != wantPassword {
				t.Fatalf("current-user password = %q, want %q", password, wantPassword)
			}
			return http.StatusOK, `{"user_id":7,"username":"operator"}`
		}
		if request.URL.Path == "/api/v2.0/users/7/password" && request.Method == http.MethodPut {
			if password != oldPassword {
				t.Fatalf("password update used %q, want old credential", password)
			}
			passwordChanged = true
			return http.StatusOK, `{}`
		}
		t.Fatalf("unexpected upstream request %s %s", request.Method, request.URL.Path)
		return http.StatusInternalServerError, `{}`
	})
	current := createTestSession(t, application, client, false)
	application.sessions.mu.Lock()
	stored := application.sessions.sessions[current.ID]
	stored.Username = "operator"
	stored.Password = oldPassword
	stored.Instances[stored.ActiveInstance].Username = "operator"
	stored.Instances[stored.ActiveInstance].Password = oldPassword
	application.sessions.mu.Unlock()

	update := httptest.NewRequest(http.MethodPut, "/api/control/current-user-password?id=7", strings.NewReader(`{"old_password":"OldPassword1","new_password":"NewPassword2"}`))
	update.Host = "console.test"
	update.Header.Set("Origin", "http://console.test")
	update.AddCookie(&http.Cookie{Name: sessionCookie, Value: current.ID})
	updated := httptest.NewRecorder()
	application.routes().ServeHTTP(updated, update)
	if updated.Code != http.StatusOK {
		t.Fatalf("password update status = %d, body = %s", updated.Code, updated.Body.String())
	}

	verify := httptest.NewRequest(http.MethodGet, "/api/control/current-user", nil)
	verify.AddCookie(&http.Cookie{Name: sessionCookie, Value: current.ID})
	verified := httptest.NewRecorder()
	application.routes().ServeHTTP(verified, verify)
	if verified.Code != http.StatusOK {
		t.Fatalf("request after password update status = %d, body = %s", verified.Code, verified.Body.String())
	}
}

func TestControlRejectsInvalidGovernanceBodies(t *testing.T) {
	tests := []struct {
		operation string
		body      string
	}{
		{operation: "webhooks?project=platform", body: `{"name":"hook","targets":[{"address":"file:///etc/passwd"}],"event_types":["PUSH_ARTIFACT"]}`},
		{operation: "robots", body: `{"name":"ci","level":"project","duration":0,"permissions":[]}`},
		{operation: "labels", body: `{"name":"release","color":"#zzzzzz","scope":"p","project_id":1}`},
		{operation: "scanners", body: `{"name":"scanner","url":"file:///tmp/scanner"}`},
		{operation: "configurations", body: `{"unknown_option":true}`},
		{operation: "configurations", body: `{"auth_mode":"invalid_auth"}`},
		{operation: "configurations", body: `{"ldap_url":"https://ldap.example.com"}`},
		{operation: "configurations", body: `{"banner_message":"{\"message\":\"test\",\"type\":\"purple\",\"closable\":true}"}`},
	}
	for _, test := range tests {
		t.Run(test.operation, func(t *testing.T) {
			application, err := newApp()
			if err != nil {
				t.Fatal(err)
			}
			current := createTestSession(t, application, mockClient(func(*http.Request) (int, string) {
				t.Fatal("invalid request reached Harbor")
				return http.StatusInternalServerError, `{}`
			}), false)
			request := httptest.NewRequest(http.MethodPost, "/api/control/"+test.operation, strings.NewReader(test.body))
			if strings.HasPrefix(test.operation, "configurations") {
				request.Method = http.MethodPut
			}
			request.Host = "console.test"
			request.Header.Set("Origin", "http://console.test")
			request.AddCookie(&http.Cookie{Name: sessionCookie, Value: current.ID})
			recorder := httptest.NewRecorder()
			application.routes().ServeHTTP(recorder, request)
			if recorder.Code != http.StatusBadRequest {
				t.Fatalf("status = %d, want 400; body = %s", recorder.Code, recorder.Body.String())
			}
		})
	}
}

func TestControlRejectsInvalidScannerAndRetentionBodies(t *testing.T) {
	tests := []struct {
		name      string
		method    string
		operation string
		body      string
	}{
		{name: "scanner uuid", method: http.MethodPut, operation: "project-scanner?project=platform", body: `{"uuid":"not-a-uuid"}`},
		{name: "retention missing rules", method: http.MethodPost, operation: "retentions", body: `{"algorithm":"or","rules":[],"trigger":{"kind":"Schedule","settings":{}},"scope":{"level":"project","ref":1}}`},
		{name: "retention wrong scope", method: http.MethodPost, operation: "retentions", body: `{"algorithm":"or","rules":[{"action":"retain","template":"latestPushedK","params":{"latestPushedK":10},"tag_selectors":[{"pattern":"**"}],"scope_selectors":{"repository":[{"pattern":"**"}]}}],"trigger":{"kind":"Schedule","settings":{}},"scope":{"level":"system","ref":1}}`},
		{name: "retention execution dry run type", method: http.MethodPost, operation: "retention-executions?id=7", body: `{"dry_run":"yes"}`},
		{name: "retention execution action", method: http.MethodPatch, operation: "retention-execution?id=7&eid=12", body: `{"action":"delete"}`},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			application, err := newApp()
			if err != nil {
				t.Fatal(err)
			}
			current := createTestSession(t, application, mockClient(func(*http.Request) (int, string) {
				t.Fatal("invalid request reached Harbor")
				return http.StatusInternalServerError, `{}`
			}), false)
			request := httptest.NewRequest(test.method, "/api/control/"+test.operation, strings.NewReader(test.body))
			request.Host = "console.test"
			request.Header.Set("Origin", "http://console.test")
			request.AddCookie(&http.Cookie{Name: sessionCookie, Value: current.ID})
			recorder := httptest.NewRecorder()
			application.routes().ServeHTTP(recorder, request)
			if recorder.Code != http.StatusBadRequest {
				t.Fatalf("status = %d, want 400; body = %s", recorder.Code, recorder.Body.String())
			}
		})
	}
}

func TestControlRejectsInvalidGCScheduleParameters(t *testing.T) {
	tests := []string{
		`{"schedule":{"type":"Manual"},"parameters":{"delete_tag":"yes"}}`,
		`{"schedule":{"type":"Manual"},"parameters":{"delete_untagged":true,"workers":0}}`,
		`{"schedule":{"type":"Manual"},"parameters":{"workers":1.5}}`,
		`{"schedule":{"type":"Manual"},"parameters":{"unknown":true}}`,
	}
	for _, body := range tests {
		application, err := newApp()
		if err != nil {
			t.Fatal(err)
		}
		current := createTestSession(t, application, mockClient(func(*http.Request) (int, string) {
			t.Fatal("invalid garbage collection request reached Harbor")
			return http.StatusInternalServerError, `{}`
		}), false)
		request := httptest.NewRequest(http.MethodPost, "/api/control/gc-schedule", strings.NewReader(body))
		request.Host = "console.test"
		request.Header.Set("Origin", "http://console.test")
		request.AddCookie(&http.Cookie{Name: sessionCookie, Value: current.ID})
		recorder := httptest.NewRecorder()
		application.routes().ServeHTTP(recorder, request)
		if recorder.Code != http.StatusBadRequest {
			t.Fatalf("body %s: status = %d, want 400; response = %s", body, recorder.Code, recorder.Body.String())
		}
	}
}

func TestControlEventAndJobObservabilityUsesOfficialAPI(t *testing.T) {
	tests := []struct {
		name       string
		method     string
		consoleURL string
		wantPath   string
		wantQuery  string
		body       string
		upstream   string
		status     int
	}{
		{name: "webhook executions", method: http.MethodGet, consoleURL: "/api/control/webhook-executions?project=platform&id=41&page=2&page_size=20&q=status%3DFailed&sort=-start_time", wantPath: "/api/v2.0/projects/platform/webhook/policies/41/executions", wantQuery: "page=2&page_size=20&q=status%3DFailed&sort=-start_time", upstream: `[{"id":91,"status":"Failed"}]`, status: http.StatusOK},
		{name: "webhook execution tasks", method: http.MethodGet, consoleURL: "/api/control/webhook-tasks?project=platform&id=41&execution=91&page=1&page_size=50&q=status%3DFailed&sort=-start_time", wantPath: "/api/v2.0/projects/platform/webhook/policies/41/executions/91/tasks", wantQuery: "page=1&page_size=50&q=status%3DFailed&sort=-start_time", upstream: `[{"id":191,"status":"Failed"}]`, status: http.StatusOK},
		{name: "webhook task log", method: http.MethodGet, consoleURL: "/api/control/webhook-task-log?project=platform&id=41&execution=91&task=191", wantPath: "/api/v2.0/projects/platform/webhook/policies/41/executions/91/tasks/191/log", upstream: "2026-07-30T01:00:00Z [ERROR] delivery failed", status: http.StatusOK},
		{name: "retention tasks", method: http.MethodGet, consoleURL: "/api/control/retention-tasks?id=31&eid=71&page=2&page_size=20", wantPath: "/api/v2.0/retentions/31/executions/71/tasks", wantQuery: "page=2&page_size=20", upstream: `[{"id":171,"status":"Succeed"}]`, status: http.StatusOK},
		{name: "retention task log", method: http.MethodGet, consoleURL: "/api/control/retention-task-log?id=31&eid=71&tid=171", wantPath: "/api/v2.0/retentions/31/executions/71/tasks/171", upstream: "2026-07-30T01:00:00Z [INFO] retained tag latest", status: http.StatusOK},
		{name: "purge history", method: http.MethodGet, consoleURL: "/api/control/purge-history?page=1&page_size=20&q=status%3DSuccess&sort=-creation_time", wantPath: "/api/v2.0/system/purgeaudit", wantQuery: "page=1&page_size=20&q=status%3DSuccess&sort=-creation_time", upstream: `[{"id":401,"job_status":"Success"}]`, status: http.StatusOK},
		{name: "purge job", method: http.MethodGet, consoleURL: "/api/control/purge-job?id=401", wantPath: "/api/v2.0/system/purgeaudit/401", upstream: `{"id":401,"job_status":"Success"}`, status: http.StatusOK},
		{name: "stop purge job", method: http.MethodPut, consoleURL: "/api/control/purge-job?id=401", wantPath: "/api/v2.0/system/purgeaudit/401", upstream: `{}`, status: http.StatusOK},
		{name: "purge job log", method: http.MethodGet, consoleURL: "/api/control/purge-log?id=401", wantPath: "/api/v2.0/system/purgeaudit/401/log", upstream: "2026-07-30T01:00:00Z [INFO] purge completed", status: http.StatusOK},
		{name: "purge schedule", method: http.MethodGet, consoleURL: "/api/control/purge-schedule", wantPath: "/api/v2.0/system/purgeaudit/schedule", upstream: `{"id":23,"schedule":{"type":"Daily"}}`, status: http.StatusOK},
		{name: "create purge schedule", method: http.MethodPost, consoleURL: "/api/control/purge-schedule", wantPath: "/api/v2.0/system/purgeaudit/schedule", body: `{"parameters":{"audit_retention_hour":168,"dry_run":false,"include_event_types":"create_artifact,delete_artifact"},"schedule":{"type":"Daily","cron":"0 0 2 * * *"}}`, upstream: `{}`, status: http.StatusCreated},
		{name: "update purge schedule", method: http.MethodPut, consoleURL: "/api/control/purge-schedule", wantPath: "/api/v2.0/system/purgeaudit/schedule", body: `{"parameters":{"audit_retention_hour":336,"dry_run":true,"include_event_types":"pull_artifact"},"schedule":{"type":"Weekly","cron":"0 0 2 * * 1"}}`, upstream: `{}`, status: http.StatusOK},
		{name: "worker pools", method: http.MethodGet, consoleURL: "/api/control/jobservice-pools", wantPath: "/api/v2.0/jobservice/pools", upstream: `[{"worker_pool_id":"pool-1"}]`, status: http.StatusOK},
		{name: "workers", method: http.MethodGet, consoleURL: "/api/control/jobservice-workers?pool=all", wantPath: "/api/v2.0/jobservice/pools/all/workers", upstream: `[{"id":"worker-1"}]`, status: http.StatusOK},
		{name: "stop running job", method: http.MethodPut, consoleURL: "/api/control/jobservice-job?job=job-91", wantPath: "/api/v2.0/jobservice/jobs/job-91", upstream: `{}`, status: http.StatusOK},
		{name: "job log", method: http.MethodGet, consoleURL: "/api/control/jobservice-job-log?job=job-91", wantPath: "/api/v2.0/jobservice/jobs/job-91/log", upstream: "2026-07-30T01:00:00Z [INFO] job completed", status: http.StatusOK},
		{name: "job queues", method: http.MethodGet, consoleURL: "/api/control/jobservice-queues", wantPath: "/api/v2.0/jobservice/queues", upstream: `[{"job_type":"IMAGE_SCAN","count":2}]`, status: http.StatusOK},
		{name: "pause job queue", method: http.MethodPut, consoleURL: "/api/control/jobservice-queue?type=IMAGE_SCAN", wantPath: "/api/v2.0/jobservice/queues/IMAGE_SCAN", body: `{"action":"pause"}`, upstream: `{}`, status: http.StatusOK},
		{name: "schedules", method: http.MethodGet, consoleURL: "/api/control/jobservice-schedules?page=2&page_size=50", wantPath: "/api/v2.0/schedules", wantQuery: "page=2&page_size=50", upstream: `[{"id":17,"vendor_type":"GARBAGE_COLLECTION"}]`, status: http.StatusOK},
		{name: "schedule paused status", method: http.MethodGet, consoleURL: "/api/control/jobservice-schedule-status?type=all", wantPath: "/api/v2.0/schedules/all/paused", upstream: `{"paused":false}`, status: http.StatusOK},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			application, err := newApp()
			if err != nil {
				t.Fatal(err)
			}
			client := mockClient(func(request *http.Request) (int, string) {
				if request.Method != test.method || request.URL.Path != test.wantPath {
					t.Fatalf("upstream request = %s %s, want %s %s", request.Method, request.URL.Path, test.method, test.wantPath)
				}
				if request.URL.RawQuery != test.wantQuery {
					t.Fatalf("upstream query = %q, want %q", request.URL.RawQuery, test.wantQuery)
				}
				if test.body != "" {
					got, readErr := io.ReadAll(request.Body)
					if readErr != nil {
						t.Fatal(readErr)
					}
					if string(got) != test.body {
						t.Fatalf("upstream body = %s, want %s", got, test.body)
					}
				}
				return test.status, test.upstream
			})
			current := createTestSession(t, application, client, false)
			request := httptest.NewRequest(test.method, test.consoleURL, strings.NewReader(test.body))
			request.AddCookie(&http.Cookie{Name: sessionCookie, Value: current.ID})
			if test.method != http.MethodGet {
				request.Host = "console.test"
				request.Header.Set("Origin", "http://console.test")
			}
			recorder := httptest.NewRecorder()
			application.routes().ServeHTTP(recorder, request)
			if recorder.Code != test.status {
				t.Fatalf("status = %d, want %d; body = %s", recorder.Code, test.status, recorder.Body.String())
			}
		})
	}
}

func TestControlRejectsInvalidPurgeAndJobServiceActions(t *testing.T) {
	tests := []struct {
		operation string
		body      string
	}{
		{operation: "purge-schedule", body: `{"parameters":{"audit_retention_hour":0,"dry_run":false,"include_event_types":"create_artifact"},"schedule":{"type":"Daily"}}`},
		{operation: "purge-schedule", body: `{"parameters":{"audit_retention_hour":168,"dry_run":"false","include_event_types":"create_artifact"},"schedule":{"type":"Daily"}}`},
		{operation: "purge-schedule", body: `{"parameters":{"audit_retention_hour":168,"dry_run":false,"include_event_types":"create_artifact\nadmin"},"schedule":{"type":"Daily"}}`},
		{operation: "jobservice-queue?type=IMAGE_SCAN", body: `{"action":"delete"}`},
		{operation: "jobservice-queue?type=IMAGE_SCAN", body: `{"action":"pause","force":true}`},
	}
	for _, test := range tests {
		application, err := newApp()
		if err != nil {
			t.Fatal(err)
		}
		current := createTestSession(t, application, mockClient(func(*http.Request) (int, string) {
			t.Fatal("invalid observability action reached Harbor")
			return http.StatusInternalServerError, `{}`
		}), false)
		request := httptest.NewRequest(http.MethodPut, "/api/control/"+test.operation, strings.NewReader(test.body))
		request.Host = "console.test"
		request.Header.Set("Origin", "http://console.test")
		request.AddCookie(&http.Cookie{Name: sessionCookie, Value: current.ID})
		recorder := httptest.NewRecorder()
		application.routes().ServeHTTP(recorder, request)
		if recorder.Code != http.StatusBadRequest {
			t.Fatalf("%s: status = %d, want 400; body = %s", test.operation, recorder.Code, recorder.Body.String())
		}
	}
}

func TestControlWriteRejectsCrossOrigin(t *testing.T) {
	application, err := newApp()
	if err != nil {
		t.Fatal(err)
	}
	current := createTestSession(t, application, mockClient(func(*http.Request) (int, string) {
		t.Fatal("cross-origin request reached Harbor")
		return http.StatusInternalServerError, `{}`
	}), false)
	request := httptest.NewRequest(http.MethodDelete, "/api/control/project?project=platform", nil)
	request.Header.Set("Origin", "http://attacker.test")
	request.Host = "console.test"
	request.AddCookie(&http.Cookie{Name: sessionCookie, Value: current.ID})
	recorder := httptest.NewRecorder()
	application.routes().ServeHTTP(recorder, request)
	if recorder.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want 403", recorder.Code)
	}
}

func TestDemoControlProjectAndTagMutations(t *testing.T) {
	application, err := newApp()
	if err != nil {
		t.Fatal(err)
	}
	handler := application.routes()
	login := httptest.NewRecorder()
	handler.ServeHTTP(login, httptest.NewRequest(http.MethodPost, "/api/demo", strings.NewReader("{}")))
	cookie := login.Result().Cookies()[0]

	create := httptest.NewRequest(http.MethodPost, "/api/control/projects", strings.NewReader(`{"project_name":"release","storage_limit":53687091200,"registry_id":2,"metadata":{"public":"false","auto_scan":"false","proxy_speed_kb":"-1","max_upstream_conn":"10","proxy_cache_local_on_not_found":"true"}}`))
	create.AddCookie(cookie)
	created := httptest.NewRecorder()
	handler.ServeHTTP(created, create)
	if created.Code != http.StatusCreated {
		t.Fatalf("create status = %d, body = %s", created.Code, created.Body.String())
	}

	list := httptest.NewRequest(http.MethodGet, "/api/control/projects?page=1&page_size=100&name=release", nil)
	list.AddCookie(cookie)
	listed := httptest.NewRecorder()
	handler.ServeHTTP(listed, list)
	if listed.Code != http.StatusOK || !strings.Contains(listed.Body.String(), `"name":"release"`) || !strings.Contains(listed.Body.String(), `"registry_id":2`) || !strings.Contains(listed.Body.String(), `"storage_limit":53687091200`) || !strings.Contains(listed.Body.String(), `"auto_scan":"false"`) {
		t.Fatalf("list status = %d, body = %s", listed.Code, listed.Body.String())
	}

	quotas := httptest.NewRequest(http.MethodGet, "/api/control/quotas?page=1&page_size=100", nil)
	quotas.AddCookie(cookie)
	quotaList := httptest.NewRecorder()
	handler.ServeHTTP(quotaList, quotas)
	if quotaList.Code != http.StatusOK || !strings.Contains(quotaList.Body.String(), `"name":"release"`) || !strings.Contains(quotaList.Body.String(), `"storage":53687091200`) {
		t.Fatalf("quota list status = %d, body = %s", quotaList.Code, quotaList.Body.String())
	}

	tag := httptest.NewRequest(http.MethodPost, "/api/control/artifact-tags?project=platform&repository=platform%2Fgateway&reference=sha256%3A41bf0e3b54f9a760a6c1f0b170507173bf6d95f2e8db4dd79f858f31f36c28a4", strings.NewReader(`{"name":"stable"}`))
	tag.AddCookie(cookie)
	tagged := httptest.NewRecorder()
	handler.ServeHTTP(tagged, tag)
	if tagged.Code != http.StatusCreated {
		t.Fatalf("tag status = %d, body = %s", tagged.Code, tagged.Body.String())
	}

	const sourceDigest = "sha256:b4604fe30f9785345f61cb34209c2aa3053b67e24dd321caec892820646d9911"
	copyRequest := httptest.NewRequest(http.MethodPost, "/api/control/artifact-copy?project=commerce&repository=commerce%2Fgateway&from="+url.QueryEscape("platform/gateway@"+sourceDigest), nil)
	copyRequest.AddCookie(cookie)
	copied := httptest.NewRecorder()
	handler.ServeHTTP(copied, copyRequest)
	if copied.Code != http.StatusCreated {
		t.Fatalf("artifact copy status = %d, body = %s", copied.Code, copied.Body.String())
	}
	artifactRequest := httptest.NewRequest(http.MethodGet, "/api/control/artifact?project=commerce&repository=commerce%2Fgateway&reference="+url.QueryEscape(sourceDigest), nil)
	artifactRequest.AddCookie(cookie)
	artifact := httptest.NewRecorder()
	handler.ServeHTTP(artifact, artifactRequest)
	if artifact.Code != http.StatusOK || !strings.Contains(artifact.Body.String(), sourceDigest) {
		t.Fatalf("copied artifact was not persisted: %d %s", artifact.Code, artifact.Body.String())
	}

	const childDigest = "sha256:cf2df80ad906b495d13f65e450bfdbe64962b0b567886143a3200dd2b2b46861"
	childRequest := httptest.NewRequest(http.MethodGet, "/api/control/artifact?project=platform&repository=platform%2Fgateway&reference="+url.QueryEscape(childDigest), nil)
	childRequest.AddCookie(cookie)
	child := httptest.NewRecorder()
	handler.ServeHTTP(child, childRequest)
	if child.Code != http.StatusOK || !strings.Contains(child.Body.String(), childDigest) || !strings.Contains(child.Body.String(), `"architecture":"arm64"`) {
		t.Fatalf("multi-architecture child artifact is unavailable: %d %s", child.Code, child.Body.String())
	}

	artifactListRequest := httptest.NewRequest(http.MethodGet, "/api/control/artifacts?project=platform&repository=platform%2Fgateway&page=1&page_size=100", nil)
	artifactListRequest.AddCookie(cookie)
	artifactList := httptest.NewRecorder()
	handler.ServeHTTP(artifactList, artifactListRequest)
	var artifactCollection struct {
		Items []map[string]any `json:"items"`
	}
	if artifactList.Code != http.StatusOK || json.Unmarshal(artifactList.Body.Bytes(), &artifactCollection) != nil {
		t.Fatalf("artifact list is invalid: %d %s", artifactList.Code, artifactList.Body.String())
	}
	for _, listedArtifact := range artifactCollection.Items {
		if stringValue(listedArtifact["digest"]) != childDigest {
			continue
		}
		t.Fatalf("child manifest leaked into the top-level artifact list: %d %s", artifactList.Code, artifactList.Body.String())
	}
}

func TestDemoControlPreservesRobotTimesAndGCDryRun(t *testing.T) {
	application, err := newApp()
	if err != nil {
		t.Fatal(err)
	}
	handler := application.routes()
	login := httptest.NewRecorder()
	handler.ServeHTTP(login, httptest.NewRequest(http.MethodPost, "/api/demo", strings.NewReader("{}")))
	cookie := login.Result().Cookies()[0]

	robot := httptest.NewRequest(http.MethodPut, "/api/control/robot?id=41", strings.NewReader(`{"name":"robot$platform+ci-release","description":"已更新","level":"project","duration":365,"disable":false,"permissions":[{"kind":"project","namespace":"platform","access":[{"resource":"repository","action":"pull"}]}]}`))
	robot.AddCookie(cookie)
	robotRecorder := httptest.NewRecorder()
	handler.ServeHTTP(robotRecorder, robot)
	if robotRecorder.Code != http.StatusOK {
		t.Fatalf("robot update status = %d, body = %s", robotRecorder.Code, robotRecorder.Body.String())
	}
	if !strings.Contains(robotRecorder.Body.String(), `"creation_time"`) || !strings.Contains(robotRecorder.Body.String(), `"expires_at"`) {
		t.Fatalf("robot update dropped read-only times: %s", robotRecorder.Body.String())
	}

	gc := httptest.NewRequest(http.MethodPost, "/api/control/gc-schedule", strings.NewReader(`{"schedule":{"type":"Manual"},"parameters":{"dry_run":true}}`))
	gc.AddCookie(cookie)
	gcRecorder := httptest.NewRecorder()
	handler.ServeHTTP(gcRecorder, gc)
	if gcRecorder.Code != http.StatusCreated {
		t.Fatalf("gc status = %d, body = %s", gcRecorder.Code, gcRecorder.Body.String())
	}
	if !strings.Contains(gcRecorder.Body.String(), `"deleted":false`) || !strings.Contains(gcRecorder.Body.String(), `"dry_run":true`) {
		t.Fatalf("gc dry-run status is incorrect: %s", gcRecorder.Body.String())
	}
}

func TestDemoOfficialRobotReplicationAndRegistryMetadata(t *testing.T) {
	application, err := newApp()
	if err != nil {
		t.Fatal(err)
	}
	handler := application.routes()
	login := httptest.NewRecorder()
	handler.ServeHTTP(login, httptest.NewRequest(http.MethodPost, "/api/demo", strings.NewReader("{}")))
	cookie := login.Result().Cookies()[0]
	request := func(method, target, body string) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequest(method, target, strings.NewReader(body))
		req.AddCookie(cookie)
		recorder := httptest.NewRecorder()
		handler.ServeHTTP(recorder, req)
		return recorder
	}

	metadata := request(http.MethodGet, "/api/control/registry-adapter-infos", "")
	if metadata.Code != http.StatusOK || !strings.Contains(metadata.Body.String(), `"EndpointPatternTypeFix"`) || !strings.Contains(metadata.Body.String(), `"https://hub.docker.com"`) || !strings.Contains(metadata.Body.String(), `"ali-acr"`) {
		t.Fatalf("registry adapter metadata is incomplete: %d %s", metadata.Code, metadata.Body.String())
	}
	registryInfo := request(http.MethodGet, "/api/control/registry-info?id=0", "")
	if registryInfo.Code != http.StatusOK || !strings.Contains(registryInfo.Body.String(), `"supported_resource_filters"`) || !strings.Contains(registryInfo.Body.String(), `"event_based"`) {
		t.Fatalf("local registry replication capabilities are incomplete: %d %s", registryInfo.Code, registryInfo.Body.String())
	}
	permissions := request(http.MethodGet, "/api/control/permissions", "")
	if permissions.Code != http.StatusOK || !strings.Contains(permissions.Body.String(), `"system"`) || !strings.Contains(permissions.Body.String(), `"project"`) {
		t.Fatalf("robot permission metadata is incomplete: %d %s", permissions.Code, permissions.Body.String())
	}
	robotBody := `{"name":"ops","description":"系统自动化","level":"system","duration":90,"disable":false,"permissions":[{"kind":"system","namespace":"/","access":[{"resource":"registry","action":"read","effect":"allow"}]},{"kind":"project","namespace":"*","access":[{"resource":"repository","action":"pull","effect":"allow"}]}]}`
	createdRobot := request(http.MethodPost, "/api/control/robots", robotBody)
	if createdRobot.Code != http.StatusCreated || !strings.Contains(createdRobot.Body.String(), `"name":"robot$ops"`) || !strings.Contains(createdRobot.Body.String(), `"secret"`) {
		t.Fatalf("system robot create failed: %d %s", createdRobot.Code, createdRobot.Body.String())
	}

	tasks := request(http.MethodGet, "/api/control/replication-tasks?id=903&page=1&page_size=100&sort=-start_time", "")
	if tasks.Code != http.StatusOK || !strings.Contains(tasks.Body.String(), `"id":1906`) || !strings.Contains(tasks.Body.String(), `"InProgress"`) {
		t.Fatalf("replication task list failed: %d %s", tasks.Code, tasks.Body.String())
	}
	logResult := request(http.MethodGet, "/api/control/replication-task-log?id=903&task=1906", "")
	if logResult.Code != http.StatusOK || !strings.Contains(logResult.Body.String(), "正在传输镜像层") {
		t.Fatalf("replication task log failed: %d %s", logResult.Code, logResult.Body.String())
	}
	stopped := request(http.MethodPut, "/api/control/replication-execution?id=903", "")
	if stopped.Code != http.StatusOK || !strings.Contains(stopped.Body.String(), `"status":"Stopped"`) {
		t.Fatalf("replication stop failed: %d %s", stopped.Code, stopped.Body.String())
	}
	stoppedTasks := request(http.MethodGet, "/api/control/replication-tasks?id=903&page=1&page_size=100", "")
	if stoppedTasks.Code != http.StatusOK || !strings.Contains(stoppedTasks.Body.String(), `"status":"Stopped"`) {
		t.Fatalf("replication task status was not stopped: %d %s", stoppedTasks.Code, stoppedTasks.Body.String())
	}
}

func TestValidateReplicationPolicyOfficialFields(t *testing.T) {
	valid := map[string]any{
		"name":                         "生产镜像同步",
		"description":                  "同步带签核标签的发布镜像",
		"src_registry":                 nil,
		"dest_registry":                map[string]any{"id": float64(2)},
		"dest_namespace":               "production/releases",
		"dest_namespace_replace_count": float64(2),
		"trigger": map[string]any{
			"type":             "scheduled",
			"trigger_settings": map[string]any{"cron": "0 15 2 * * *"},
		},
		"filters": []any{
			map[string]any{"type": "name", "value": "platform/**"},
			map[string]any{"type": "tag", "value": "release-*", "decoration": "matches"},
			map[string]any{"type": "label", "value": []any{"已签核", "生产"}, "decoration": "matches"},
			map[string]any{"type": "resource", "value": "image"},
		},
		"replicate_deletion":        false,
		"override":                  true,
		"enabled":                   true,
		"speed":                     float64(2048),
		"copy_by_chunk":             true,
		"single_active_replication": true,
	}
	if err := validateReplicationPolicy(valid); err != nil {
		t.Fatalf("valid official replication policy rejected: %v", err)
	}
	eventPolicy := map[string]any{
		"name":                         "event-sync",
		"src_registry":                 nil,
		"dest_registry":                map[string]any{"id": float64(2)},
		"trigger":                      map[string]any{"type": "event_based", "trigger_settings": map[string]any{}},
		"filters":                      []any{},
		"replicate_deletion":           true,
		"single_active_replication":    false,
		"dest_namespace_replace_count": float64(-1),
		"speed":                        float64(-1),
	}
	if err := validateReplicationPolicy(eventPolicy); err != nil {
		t.Fatalf("valid event replication policy rejected: %v", err)
	}
}

func TestValidateReplicationPolicyRejectsInvalidFields(t *testing.T) {
	base := func() map[string]any {
		return map[string]any{
			"name":          "release-sync",
			"src_registry":  nil,
			"dest_registry": map[string]any{"id": float64(1)},
			"trigger":       map[string]any{"type": "manual", "trigger_settings": map[string]any{}},
			"filters":       []any{},
			"enabled":       true,
			"override":      true,
			"speed":         float64(-1),
		}
	}
	tests := []struct {
		name   string
		mutate func(map[string]any)
	}{
		{name: "unknown top-level field", mutate: func(body map[string]any) { body["private_extension"] = true }},
		{name: "both registries", mutate: func(body map[string]any) { body["src_registry"] = map[string]any{"id": float64(2)} }},
		{name: "registry secret", mutate: func(body map[string]any) {
			body["dest_registry"] = map[string]any{"id": float64(1), "credential": map[string]any{"access_secret": "secret"}}
		}},
		{name: "invalid namespace", mutate: func(body map[string]any) { body["dest_namespace"] = "Production//Images" }},
		{name: "invalid flatten level", mutate: func(body map[string]any) { body["dest_namespace_replace_count"] = float64(9) }},
		{name: "invalid trigger", mutate: func(body map[string]any) {
			body["trigger"] = map[string]any{"type": "continuous", "trigger_settings": map[string]any{}}
		}},
		{name: "scheduled without cron", mutate: func(body map[string]any) {
			body["trigger"] = map[string]any{"type": "scheduled", "trigger_settings": map[string]any{"cron": ""}}
		}},
		{name: "invalid cron", mutate: func(body map[string]any) {
			body["trigger"] = map[string]any{"type": "scheduled", "trigger_settings": map[string]any{"cron": "* * * * *"}}
		}},
		{name: "unknown filter", mutate: func(body map[string]any) {
			body["filters"] = []any{map[string]any{"type": "vulnerability", "value": "high"}}
		}},
		{name: "invalid label value", mutate: func(body map[string]any) {
			body["filters"] = []any{map[string]any{"type": "label", "value": "production"}}
		}},
		{name: "invalid decoration", mutate: func(body map[string]any) {
			body["filters"] = []any{map[string]any{"type": "tag", "value": "latest", "decoration": "contains"}}
		}},
		{name: "invalid speed", mutate: func(body map[string]any) { body["speed"] = float64(0) }},
		{name: "invalid boolean", mutate: func(body map[string]any) { body["copy_by_chunk"] = "true" }},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			body := base()
			test.mutate(body)
			if err := validateReplicationPolicy(body); err == nil {
				t.Fatal("invalid replication policy was accepted")
			}
		})
	}
}

func TestDemoReplicationPolicyOfficialFieldLifecycle(t *testing.T) {
	application, err := newApp()
	if err != nil {
		t.Fatal(err)
	}
	current := createTestSession(t, application, nil, true)
	handler := application.routes()
	request := func(method, target, body string) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequest(method, target, strings.NewReader(body))
		req.AddCookie(&http.Cookie{Name: sessionCookie, Value: current.ID})
		if method != http.MethodGet {
			req.Host = "console.test"
			req.Header.Set("Origin", "http://console.test")
		}
		recorder := httptest.NewRecorder()
		handler.ServeHTTP(recorder, req)
		return recorder
	}
	createBody := `{"name":"release-complete","description":"完整字段策略","src_registry":null,"dest_registry":{"id":1},"dest_namespace":"production/releases","dest_namespace_replace_count":2,"trigger":{"type":"scheduled","trigger_settings":{"cron":"0 15 2 * * *"}},"filters":[{"type":"name","value":"platform/**"},{"type":"tag","value":"release-*","decoration":"matches"},{"type":"label","value":["已签核"],"decoration":"matches"},{"type":"resource","value":"image"}],"replicate_deletion":false,"override":true,"enabled":true,"speed":2048,"copy_by_chunk":true,"single_active_replication":true}`
	created := request(http.MethodPost, "/api/control/replication-policies", createBody)
	if created.Code != http.StatusCreated || !strings.Contains(created.Body.String(), `"name":"prod-registry"`) || !strings.Contains(created.Body.String(), `"copy_by_chunk":true`) || !strings.Contains(created.Body.String(), `"已签核"`) {
		t.Fatalf("complete replication policy create failed: %d %s", created.Code, created.Body.String())
	}
	var createdPayload struct {
		Data map[string]any `json:"data"`
	}
	if err := json.Unmarshal(created.Body.Bytes(), &createdPayload); err != nil {
		t.Fatal(err)
	}
	id := numberValue(createdPayload.Data["id"])
	if id <= 0 {
		t.Fatalf("created policy has invalid id: %s", created.Body.String())
	}
	updateBody := `{"name":"release-complete","description":"改为从归档仓库拉取","src_registry":{"id":3},"dest_registry":null,"dest_namespace":"archive","dest_namespace_replace_count":-1,"trigger":{"type":"manual","trigger_settings":{}},"filters":[{"type":"name","value":"archive/**"}],"replicate_deletion":false,"override":false,"enabled":false,"speed":-1,"copy_by_chunk":false,"single_active_replication":true}`
	updated := request(http.MethodPut, fmt.Sprintf("/api/control/replication-policy?id=%d", id), updateBody)
	if updated.Code != http.StatusOK || !strings.Contains(updated.Body.String(), `"name":"cold-backup"`) || !strings.Contains(updated.Body.String(), `"dest_namespace_replace_count":-1`) || !strings.Contains(updated.Body.String(), `"enabled":false`) {
		t.Fatalf("complete replication policy update failed: %d %s", updated.Code, updated.Body.String())
	}
	loaded := request(http.MethodGet, fmt.Sprintf("/api/control/replication-policy?id=%d", id), "")
	if loaded.Code != http.StatusOK || !strings.Contains(loaded.Body.String(), `"archive/**"`) || !strings.Contains(loaded.Body.String(), `"speed":-1`) {
		t.Fatalf("updated replication policy was not persisted: %d %s", loaded.Code, loaded.Body.String())
	}
	deleted := request(http.MethodDelete, fmt.Sprintf("/api/control/replication-policy?id=%d", id), "")
	if deleted.Code != http.StatusOK {
		t.Fatalf("replication policy delete failed: %d %s", deleted.Code, deleted.Body.String())
	}
	missing := request(http.MethodGet, fmt.Sprintf("/api/control/replication-policy?id=%d", id), "")
	if missing.Code != http.StatusNotFound {
		t.Fatalf("deleted replication policy still exists: %d %s", missing.Code, missing.Body.String())
	}
}

func TestDemoProjectScannerAndRetentionLifecycle(t *testing.T) {
	application, err := newApp()
	if err != nil {
		t.Fatal(err)
	}
	handler := application.routes()
	login := httptest.NewRecorder()
	handler.ServeHTTP(login, httptest.NewRequest(http.MethodPost, "/api/demo", strings.NewReader("{}")))
	cookie := login.Result().Cookies()[0]
	request := func(method, target, body string) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequest(method, target, strings.NewReader(body))
		req.AddCookie(cookie)
		recorder := httptest.NewRecorder()
		handler.ServeHTTP(recorder, req)
		return recorder
	}
	data := func(recorder *httptest.ResponseRecorder) map[string]any {
		t.Helper()
		var payload map[string]any
		if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
			t.Fatal(err)
		}
		mapped, _ := payload["data"].(map[string]any)
		return mapped
	}

	createdScanner := request(http.MethodPost, "/api/control/scanners", `{"name":"Clair","url":"http://clair-scanner:8080","auth":"","access_credential":""}`)
	if createdScanner.Code != http.StatusCreated {
		t.Fatalf("scanner create status = %d, body = %s", createdScanner.Code, createdScanner.Body.String())
	}
	scannerUUID := stringValue(data(createdScanner)["uuid"])
	setScanner := request(http.MethodPut, "/api/control/project-scanner?project=commerce", `{"uuid":"`+scannerUUID+`"}`)
	if setScanner.Code != http.StatusOK {
		t.Fatalf("scanner set status = %d, body = %s", setScanner.Code, setScanner.Body.String())
	}
	currentScanner := request(http.MethodGet, "/api/control/project-scanner?project=commerce", "")
	if currentScanner.Code != http.StatusOK || stringValue(data(currentScanner)["uuid"]) != scannerUUID {
		t.Fatalf("project scanner was not persisted: %d %s", currentScanner.Code, currentScanner.Body.String())
	}

	retentionBody := `{"algorithm":"or","rules":[{"priority":1,"disabled":false,"action":"retain","template":"latestPushedK","params":{"latestPushedK":5},"tag_selectors":[{"kind":"doublestar","decoration":"matches","pattern":"release-*"}],"scope_selectors":{"repository":[{"kind":"doublestar","decoration":"repoMatches","pattern":"**"}]}}],"trigger":{"kind":"Schedule","settings":{"cron":"0 0 3 * * *"}},"scope":{"level":"project","ref":2}}`
	createdRetention := request(http.MethodPost, "/api/control/retentions", retentionBody)
	if createdRetention.Code != http.StatusCreated {
		t.Fatalf("retention create status = %d, body = %s", createdRetention.Code, createdRetention.Body.String())
	}
	retentionID := int64(numberValue(data(createdRetention)["id"]))
	if retentionID <= 0 {
		t.Fatalf("invalid retention id: %s", createdRetention.Body.String())
	}
	run := request(http.MethodPost, fmt.Sprintf("/api/control/retention-executions?id=%d", retentionID), `{"dry_run":true}`)
	if run.Code != http.StatusCreated {
		t.Fatalf("retention run status = %d, body = %s", run.Code, run.Body.String())
	}
	runID := int64(numberValue(data(run)["id"]))
	stopped := request(http.MethodPatch, fmt.Sprintf("/api/control/retention-execution?id=%d&eid=%d", retentionID, runID), `{"action":"stop"}`)
	if stopped.Code != http.StatusOK || stringValue(data(stopped)["status"]) != "Stopped" {
		t.Fatalf("retention stop failed: %d %s", stopped.Code, stopped.Body.String())
	}
	deleted := request(http.MethodDelete, fmt.Sprintf("/api/control/retention?id=%d", retentionID), "")
	if deleted.Code != http.StatusOK {
		t.Fatalf("retention delete status = %d, body = %s", deleted.Code, deleted.Body.String())
	}
	project := request(http.MethodGet, "/api/control/project?project=commerce", "")
	metadata, _ := data(project)["metadata"].(map[string]any)
	if stringValue(metadata["retention_id"]) != "" {
		t.Fatalf("retention binding was not cleared: %s", project.Body.String())
	}
}

func TestDemoSecurityLifecycle(t *testing.T) {
	application, err := newApp()
	if err != nil {
		t.Fatal(err)
	}
	handler := application.routes()
	login := httptest.NewRecorder()
	handler.ServeHTTP(login, httptest.NewRequest(http.MethodPost, "/api/demo", strings.NewReader("{}")))
	cookie := login.Result().Cookies()[0]
	request := func(method, target, body string) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequest(method, target, strings.NewReader(body))
		req.AddCookie(cookie)
		recorder := httptest.NewRecorder()
		handler.ServeHTTP(recorder, req)
		return recorder
	}
	readData := func(recorder *httptest.ResponseRecorder) map[string]any {
		t.Helper()
		var payload map[string]any
		if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
			t.Fatal(err)
		}
		mapped, _ := payload["data"].(map[string]any)
		return mapped
	}

	summary := request(http.MethodGet, "/api/control/security-summary?with_dangerous_cve=true&with_dangerous_artifact=true", "")
	if summary.Code != http.StatusOK || numberValue(readData(summary)["total_vuls"]) < 4 {
		t.Fatalf("security summary failed: %d %s", summary.Code, summary.Body.String())
	}
	critical := request(http.MethodGet, "/api/control/security-vulnerabilities?page=1&page_size=20&q=severity%3DCritical&with_tag=true", "")
	if critical.Code != http.StatusOK || !strings.Contains(critical.Body.String(), `"total":2`) {
		t.Fatalf("security vulnerability filter failed: %d %s", critical.Code, critical.Body.String())
	}

	digest := "sha256:41bf0e3b54f9a760a6c1f0b170507173bf6d95f2e8db4dd79f858f31f36c28a4"
	artifactPath := "/api/control/artifact?project=platform&repository=platform%2Fgateway&reference=" + url.QueryEscape(digest) + "&with_scan_overview=true&with_sbom_overview=true"
	startedSBOM := request(http.MethodPost, "/api/control/artifact-scan?project=platform&repository=platform%2Fgateway&reference="+url.QueryEscape(digest), `{"scan_type":"sbom"}`)
	if startedSBOM.Code != http.StatusAccepted {
		t.Fatalf("sbom scan start failed: %d %s", startedSBOM.Code, startedSBOM.Body.String())
	}
	artifactAfterStart := request(http.MethodGet, artifactPath, "")
	if artifactAfterStart.Code != http.StatusOK || !strings.Contains(artifactAfterStart.Body.String(), `"scan_status":"Running"`) {
		t.Fatalf("sbom scan status was not running: %d %s", artifactAfterStart.Code, artifactAfterStart.Body.String())
	}
	stoppedSBOM := request(http.MethodPost, "/api/control/artifact-scan-stop?project=platform&repository=platform%2Fgateway&reference="+url.QueryEscape(digest), `{"scan_type":"sbom"}`)
	if stoppedSBOM.Code != http.StatusAccepted {
		t.Fatalf("sbom scan stop failed: %d %s", stoppedSBOM.Code, stoppedSBOM.Body.String())
	}
	scanLog := request(http.MethodGet, "/api/control/artifact-scan-log?project=platform&repository=platform%2Fgateway&reference="+url.QueryEscape(digest)+"&report=demo-vuln-41bf0e3b54f9", "")
	if scanLog.Code != http.StatusOK || !strings.Contains(scanLog.Body.String(), "漏洞扫描完成") {
		t.Fatalf("artifact scan log failed: %d %s", scanLog.Code, scanLog.Body.String())
	}

	allowlistBody := `{"expires_at":null,"items":[{"cve_id":"CVE-2026-0917"}]}`
	updatedAllowlist := request(http.MethodPut, "/api/control/system-cve-allowlist", allowlistBody)
	if updatedAllowlist.Code != http.StatusOK {
		t.Fatalf("allowlist update failed: %d %s", updatedAllowlist.Code, updatedAllowlist.Body.String())
	}
	allowlist := request(http.MethodGet, "/api/control/system-cve-allowlist", "")
	if allowlist.Code != http.StatusOK || !strings.Contains(allowlist.Body.String(), "CVE-2026-0917") {
		t.Fatalf("allowlist was not persisted: %d %s", allowlist.Code, allowlist.Body.String())
	}
	certificate := request(http.MethodGet, "/api/control/system-root-certificate", "")
	if certificate.Code != http.StatusOK || !strings.Contains(certificate.Header().Get("Content-Disposition"), "harbor-ca.crt") || !strings.Contains(certificate.Body.String(), "BEGIN CERTIFICATE") {
		t.Fatalf("root certificate download failed: %d %s", certificate.Code, certificate.Body.String())
	}
	projectAllowlistBody := `{"metadata":{"reuse_sys_cve_allowlist":"false"},"cve_allowlist":{"expires_at":1893455999,"items":[{"cve_id":"CVE-2026-1842"}]}}`
	updatedProject := request(http.MethodPut, "/api/control/project?project=platform", projectAllowlistBody)
	if updatedProject.Code != http.StatusOK {
		t.Fatalf("project allowlist update failed: %d %s", updatedProject.Code, updatedProject.Body.String())
	}
	project := request(http.MethodGet, "/api/control/project?project=platform", "")
	if project.Code != http.StatusOK || !strings.Contains(project.Body.String(), `"reuse_sys_cve_allowlist":"false"`) || !strings.Contains(project.Body.String(), "CVE-2026-1842") {
		t.Fatalf("project allowlist was not persisted: %d %s", project.Code, project.Body.String())
	}

	created := request(http.MethodPost, "/api/control/cve-export", `{"projects":[1],"labels":[],"repositories":"platform/**"}`)
	if created.Code != http.StatusOK {
		t.Fatalf("cve export create failed: %d %s", created.Code, created.Body.String())
	}
	exportID := int64(numberValue(readData(created)["id"]))
	if exportID <= 501 {
		t.Fatalf("invalid export id: %s", created.Body.String())
	}
	executions := request(http.MethodGet, "/api/control/cve-export-executions", "")
	if executions.Code != http.StatusOK || !strings.Contains(executions.Body.String(), fmt.Sprintf(`"id":%d`, exportID)) {
		t.Fatalf("cve export execution missing: %d %s", executions.Code, executions.Body.String())
	}
	download := request(http.MethodGet, fmt.Sprintf("/api/control/cve-export-download?id=%d&format=CSV", exportID), "")
	if download.Code != http.StatusOK || !strings.Contains(download.Header().Get("Content-Type"), "text/csv") || !strings.Contains(download.Body.String(), "CVE-2026-1842") {
		t.Fatalf("cve export download failed: %d %s", download.Code, download.Body.String())
	}
}

func TestDemoDashboardHasSortableDrillDownAssets(t *testing.T) {
	state := newDemoState()
	dashboard := state.dashboard()
	statistics, _ := dashboard["statistics"].(map[string]any)
	if got := numberValue(statistics["total_repo_count"]); got != 86 {
		t.Fatalf("demo repository total = %d, want 86", got)
	}
	projects, _ := dashboard["projects"].([]any)
	if len(projects) != 6 {
		t.Fatalf("demo project count = %d, want 6", len(projects))
	}
	repositoryCounts := make(map[int64]bool)
	storageValues := make(map[int64]bool)
	for _, rawProject := range projects {
		project, _ := rawProject.(map[string]any)
		repositoryCounts[numberValue(project["repo_count"])] = true
		storageValues[numberValue(project["storage_used"])] = true
		name := stringValue(project["name"])
		if len(state.repositories[name]) == 0 || len(state.artifacts[stringValue(state.repositories[name][0]["name"])]) == 0 {
			t.Fatalf("project %q does not have drill-down assets", name)
		}
	}
	if len(repositoryCounts) < 4 || len(storageValues) < 4 {
		t.Fatalf("demo assets are not varied enough for sorting: repositories=%v storage=%v", repositoryCounts, storageValues)
	}
	policies, _ := dashboard["replication_policies"].([]any)
	if len(policies) != len(state.policies) {
		t.Fatalf("demo replication policies = %d, want %d", len(policies), len(state.policies))
	}
}

func TestDemoProjectsHonorNameSort(t *testing.T) {
	state := newDemoState()
	recorder := httptest.NewRecorder()
	state.writeList(recorder, state.projects, url.Values{"page": {"1"}, "page_size": {"50"}, "sort": {"name"}})
	if recorder.Code != http.StatusOK {
		t.Fatalf("demo project list status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
	var payload struct {
		Items []map[string]any `json:"items"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	if len(payload.Items) != 6 || stringValue(payload.Items[0]["name"]) != "commerce" || stringValue(payload.Items[5]["name"]) != "sandbox" {
		t.Fatalf("projects are not sorted by name: %#v", payload.Items)
	}
}

func TestDemoVolumesUseOfficialSystemInfoShape(t *testing.T) {
	payload, ok := demoResource("volumes", nil)
	if !ok {
		t.Fatal("demo volumes are missing")
	}
	systemInfo, ok := payload.(map[string]any)
	if !ok {
		t.Fatalf("demo volumes type = %T, want map", payload)
	}
	volumes, ok := systemInfo["storage"].([]any)
	if !ok || len(volumes) == 0 {
		t.Fatalf("demo storage = %#v, want official storage array", systemInfo["storage"])
	}
	storage, _ := volumes[0].(map[string]any)
	if numberValue(storage["total"]) <= 0 || numberValue(storage["free"]) <= 0 {
		t.Fatalf("demo storage values are invalid: %#v", storage)
	}
}

func TestDemoEventAndJobObservabilityLifecycle(t *testing.T) {
	application, err := newApp()
	if err != nil {
		t.Fatal(err)
	}
	current := createTestSession(t, application, http.DefaultClient, true)
	request := func(method, target, body string, want int) string {
		t.Helper()
		req := httptest.NewRequest(method, target, strings.NewReader(body))
		req.AddCookie(&http.Cookie{Name: sessionCookie, Value: current.ID})
		if method != http.MethodGet {
			req.Host = "console.test"
			req.Header.Set("Origin", "http://console.test")
		}
		recorder := httptest.NewRecorder()
		application.routes().ServeHTTP(recorder, req)
		if recorder.Code != want {
			t.Fatalf("%s %s status = %d, want %d; body = %s", method, target, recorder.Code, want, recorder.Body.String())
		}
		return recorder.Body.String()
	}

	if body := request(http.MethodGet, "/api/control/webhook-executions?project=platform&id=41&page=1&page_size=20", "", http.StatusOK); !strings.Contains(body, `"id":91`) {
		t.Fatalf("webhook history missing demo execution: %s", body)
	}
	if body := request(http.MethodGet, "/api/control/webhook-tasks?project=platform&id=41&execution=91&page=1&page_size=20", "", http.StatusOK); !strings.Contains(body, `"id":191`) {
		t.Fatalf("webhook tasks missing demo task: %s", body)
	}
	if body := request(http.MethodGet, "/api/control/webhook-task-log?project=platform&id=41&execution=91&task=191", "", http.StatusOK); !strings.Contains(body, "webhook delivered") {
		t.Fatalf("webhook log missing content: %s", body)
	}
	if body := request(http.MethodGet, "/api/control/retention-tasks?id=31&eid=71&page=1&page_size=20", "", http.StatusOK); !strings.Contains(body, `"repository":"platform/gateway"`) {
		t.Fatalf("retention tasks missing repository result: %s", body)
	}
	if body := request(http.MethodGet, "/api/control/retention-task-log?id=31&eid=71&tid=171", "", http.StatusOK); !strings.Contains(body, "retained 10 tags") {
		t.Fatalf("retention log missing content: %s", body)
	}

	purgeBody := `{"schedule":{"type":"Manual"},"parameters":{"audit_retention_hour":168,"dry_run":true,"include_event_types":"create_artifact,delete_artifact"}}`
	if body := request(http.MethodPost, "/api/control/purge-schedule", purgeBody, http.StatusCreated); !strings.Contains(body, `"id":402`) {
		t.Fatalf("manual purge did not create an execution: %s", body)
	}
	if body := request(http.MethodPut, "/api/control/purge-job?id=402", "", http.StatusOK); !strings.Contains(body, `"job_status":"Stopped"`) {
		t.Fatalf("purge execution was not stopped: %s", body)
	}
	if body := request(http.MethodGet, "/api/control/purge-log?id=402", "", http.StatusOK); !strings.Contains(body, "retention threshold") {
		t.Fatalf("purge log missing content: %s", body)
	}

	request(http.MethodPut, "/api/control/jobservice-queue?type=IMAGE_SCAN", `{"action":"pause"}`, http.StatusOK)
	if body := request(http.MethodGet, "/api/control/jobservice-queues", "", http.StatusOK); !strings.Contains(body, `"job_type":"IMAGE_SCAN","latency":18,"paused":true`) {
		t.Fatalf("queue pause state was not retained: %s", body)
	}
	request(http.MethodPut, "/api/control/jobservice-job?job=job-scan-1001", "", http.StatusOK)
	if body := request(http.MethodGet, "/api/control/jobservice-workers?pool=all", "", http.StatusOK); strings.Contains(body, `"job_id":"job-scan-1001"`) {
		t.Fatalf("stopped job is still assigned to a worker: %s", body)
	}
}

func TestDemoDirectoryAndScannerMetadataLifecycle(t *testing.T) {
	application, err := newApp()
	if err != nil {
		t.Fatal(err)
	}
	current := createTestSession(t, application, http.DefaultClient, true)
	request := func(method, target, body string, want int) string {
		t.Helper()
		req := httptest.NewRequest(method, target, strings.NewReader(body))
		req.AddCookie(&http.Cookie{Name: sessionCookie, Value: current.ID})
		if method != http.MethodGet {
			req.Host = "console.test"
			req.Header.Set("Origin", "http://console.test")
		}
		recorder := httptest.NewRecorder()
		application.routes().ServeHTTP(recorder, req)
		if recorder.Code != want {
			t.Fatalf("%s %s status = %d, want %d; body = %s", method, target, recorder.Code, want, recorder.Body.String())
		}
		return recorder.Body.String()
	}

	if body := request(http.MethodGet, "/api/control/ldap-users-search?username=build", "", http.StatusOK); !strings.Contains(body, `"username":"build-engineer"`) {
		t.Fatalf("LDAP search did not return the demo candidate: %s", body)
	}
	request(http.MethodPost, "/api/control/ldap-users-import", `{"ldap_uid_list":["build-engineer"]}`, http.StatusOK)
	if body := request(http.MethodGet, "/api/control/users?page=1&page_size=100&q=username%3D~build-engineer", "", http.StatusOK); !strings.Contains(body, `"username":"build-engineer"`) {
		t.Fatalf("imported LDAP user is missing from Harbor users: %s", body)
	}
	if body := request(http.MethodGet, "/api/control/ldap-users-search?username=build", "", http.StatusOK); strings.Contains(body, `"username":"build-engineer"`) {
		t.Fatalf("imported LDAP user remained in the import candidates: %s", body)
	}
	groupSearch := request(http.MethodGet, "/api/control/ldap-groups-search?groupname=release", "", http.StatusOK)
	if !strings.Contains(groupSearch, `"group_name":"release-managers"`) {
		t.Fatalf("LDAP group search did not return the demo group: %s", groupSearch)
	}
	request(http.MethodPost, "/api/control/project-members?project=platform", `{"role_id":4,"member_group":{"group_name":"release-managers","group_type":1,"ldap_group_dn":"cn=release-managers,ou=groups,dc=demo,dc=local"}}`, http.StatusCreated)
	if body := request(http.MethodGet, "/api/control/project-members?project=platform&page=1&page_size=100&entityname=release-managers", "", http.StatusOK); !strings.Contains(body, `"entity_type":"g"`) {
		t.Fatalf("project group member was not retained: %s", body)
	}
	if body := request(http.MethodGet, "/api/control/scanner-metadata?id=00000000-0000-4000-8000-000000000001", "", http.StatusOK); !strings.Contains(body, `"type":"vulnerability"`) || !strings.Contains(body, `"type":"sbom"`) {
		t.Fatalf("scanner metadata is incomplete: %s", body)
	}
}

func createTestSession(t *testing.T, application *app, client *http.Client, demo bool) *session {
	t.Helper()
	current := &session{InstanceURL: "https://harbor.test", Username: "admin", Password: "password", Client: client, Demo: demo}
	if demo {
		current.DemoData = newDemoState()
	}
	if err := application.sessions.create(current); err != nil {
		t.Fatal(err)
	}
	return current
}
