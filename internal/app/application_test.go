package app

import (
	"context"
	"encoding/json"
	"io"
	"io/fs"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"harbor-console/internal/webui"
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
		{name: "path prefix", input: "https://example.com/harbor/", wantErr: true},
		{name: "double slash", input: "https://example.com//", wantErr: true},
		{name: "encoded path", input: "https://example.com/%2F", wantErr: true},
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

func TestEmbeddedFrontendIsOfflineAndCSPCompatible(t *testing.T) {
	webRoot, err := webui.Files()
	if err != nil {
		t.Fatal(err)
	}
	paths := make([]string, 0, 32)
	if err := fs.WalkDir(webRoot, ".", func(path string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if !entry.IsDir() {
			paths = append(paths, path)
		}
		return nil
	}); err != nil {
		t.Fatalf("walk embedded frontend: %v", err)
	}

	contents := make(map[string]string, len(paths))
	for _, path := range paths {
		content, err := webui.ReadFile(path)
		if err != nil {
			t.Fatalf("read embedded frontend %s: %v", path, err)
		}
		contents[path] = string(content)
		// CSP blocks inline style attributes in rendered HTML. Bundled JavaScript may
		// legitimately contain the token as library parser data without emitting it.
		if strings.HasSuffix(path, ".html") && strings.Contains(contents[path], "style=") {
			t.Fatalf("%s contains an inline style that the production CSP will block", path)
		}
	}
	if _, err := webui.ReadFile("date-utils.test.cjs"); err == nil {
		t.Fatal("frontend test source must not be embedded in the production binary")
	}

	index := contents["index.html"]
	for _, remoteReference := range []string{`src="http://`, `src="https://`, `href="http://`, `href="https://`, `//cdn.`} {
		if strings.Contains(index, remoteReference) {
			t.Fatalf("index contains remote frontend dependency %q", remoteReference)
		}
	}
	application, err := newApp()
	if err != nil {
		t.Fatal(err)
	}
	for _, path := range paths {
		if path == "index.html" {
			continue
		}
		if !strings.Contains(index, `"/`+path+`"`) {
			t.Fatalf("index is missing embedded resource %q", path)
		}
		asset := httptest.NewRecorder()
		application.routes().ServeHTTP(asset, httptest.NewRequest(http.MethodGet, "/"+path, nil))
		if asset.Code != http.StatusOK {
			t.Fatalf("embedded resource %s status = %d, want %d", path, asset.Code, http.StatusOK)
		}
	}
	recorder := httptest.NewRecorder()
	application.routes().ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/", nil))
	csp := recorder.Header().Get("Content-Security-Policy")
	if !strings.Contains(csp, "style-src 'self'") || strings.Contains(csp, "'unsafe-inline'") {
		t.Fatalf("unexpected frontend CSP: %q", csp)
	}
	testSource := httptest.NewRecorder()
	application.routes().ServeHTTP(testSource, httptest.NewRequest(http.MethodGet, "/date-utils.test.cjs", nil))
	if testSource.Code != http.StatusNotFound {
		t.Fatalf("frontend test source status = %d, want %d", testSource.Code, http.StatusNotFound)
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
			if r.URL.Path != "/api/v2.0/users/current" || r.URL.RawQuery != "" {
				t.Errorf("unexpected request: %s?%s", r.URL.Path, r.URL.RawQuery)
			}
			if got := r.Header.Get("User-Agent"); got != "Harbor-Console/dev" {
				t.Errorf("User-Agent = %q, want %q", got, "Harbor-Console/dev")
			}
			return http.StatusOK, `{"user_id":1,"username":"admin"}`
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

func TestConnectRejectsBadCredentialsWhenProjectsArePublic(t *testing.T) {
	application, err := newApp()
	if err != nil {
		t.Fatal(err)
	}
	var paths []string
	application.newClient = func(bool) *http.Client {
		return mockClient(func(r *http.Request) (int, string) {
			paths = append(paths, r.URL.Path)
			if r.URL.Path == "/api/v2.0/projects" {
				return http.StatusOK, `[]`
			}
			if r.URL.Path == "/api/v2.0/users/current" {
				return http.StatusUnauthorized, `{"errors":[{"message":"unauthorized"}]}`
			}
			t.Fatalf("unexpected upstream path %q", r.URL.Path)
			return http.StatusInternalServerError, `{}`
		})
	}
	body := `{"url":"https://harbor.test","username":"admin","password":"wrong"}`
	recorder := httptest.NewRecorder()
	application.routes().ServeHTTP(recorder, httptest.NewRequest(http.MethodPost, "/api/connect", strings.NewReader(body)))
	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401; body = %s", recorder.Code, recorder.Body.String())
	}
	if len(recorder.Result().Cookies()) != 0 {
		t.Fatalf("invalid credentials created a session cookie: %#v", recorder.Result().Cookies())
	}
	if len(paths) != 1 || paths[0] != "/api/v2.0/users/current" {
		t.Fatalf("authentication probe paths = %#v, want only current-user", paths)
	}
}

func TestAddInstanceRejectsBadCredentialsBeforePersisting(t *testing.T) {
	application, err := newApp()
	if err != nil {
		t.Fatal(err)
	}
	application.newClient = func(bool) *http.Client {
		return mockClient(func(r *http.Request) (int, string) {
			if r.URL.Path != "/api/v2.0/users/current" {
				t.Fatalf("unexpected upstream path: %s", r.URL.Path)
			}
			return http.StatusUnauthorized, `{"errors":[{"message":"unauthorized"}]}`
		})
	}
	current := createTestSession(t, application, nil, false)
	body := `{"url":"https://another.harbor.test","username":"admin","password":"wrong"}`
	request := httptest.NewRequest(http.MethodPost, "/api/instances", strings.NewReader(body))
	request.AddCookie(&http.Cookie{Name: sessionCookie, Value: current.ID})
	recorder := httptest.NewRecorder()
	application.routes().ServeHTTP(recorder, request)
	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401; body = %s", recorder.Code, recorder.Body.String())
	}
	if len(current.Instances) != 1 {
		t.Fatalf("invalid instance was persisted: %#v", current.Instances)
	}
}

func TestConnectRejectsNonRootURLBeforeUpstreamRequest(t *testing.T) {
	application, err := newApp()
	if err != nil {
		t.Fatal(err)
	}
	called := false
	application.newClient = func(bool) *http.Client {
		return mockClient(func(*http.Request) (int, string) {
			called = true
			return http.StatusOK, `{}`
		})
	}
	body := `{"url":"https://harbor.test/harbor","username":"admin","password":"Password-123"}`
	recorder := httptest.NewRecorder()
	application.routes().ServeHTTP(recorder, httptest.NewRequest(http.MethodPost, "/api/connect", strings.NewReader(body)))
	if recorder.Code != http.StatusBadRequest || called {
		t.Fatalf("status = %d, upstream called = %v; body = %s", recorder.Code, called, recorder.Body.String())
	}
}

func TestUserCommentLimitMatchesHarbor(t *testing.T) {
	tests := []struct {
		name       string
		method     string
		consoleURL string
		body       string
		wantStatus int
	}{
		{
			name:       "create at limit",
			method:     http.MethodPost,
			consoleURL: "/api/control/users",
			body:       `{"username":"acceptance-user","password":"Password-123","email":"user@example.com","realname":"Acceptance","comment":"123456789012345678901234567890"}`,
			wantStatus: http.StatusCreated,
		},
		{
			name:       "create over limit",
			method:     http.MethodPost,
			consoleURL: "/api/control/users",
			body:       `{"username":"acceptance-user","password":"Password-123","email":"user@example.com","realname":"Acceptance","comment":"1234567890123456789012345678901"}`,
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "update over limit",
			method:     http.MethodPut,
			consoleURL: "/api/control/user?id=7",
			body:       `{"email":"user@example.com","realname":"Acceptance","comment":"1234567890123456789012345678901"}`,
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "multibyte at byte limit",
			method:     http.MethodPut,
			consoleURL: "/api/control/user?id=7",
			body:       `{"email":"user@example.com","realname":"Acceptance","comment":"测试测试测试测试测试"}`,
			wantStatus: http.StatusCreated,
		},
		{
			name:       "multibyte over byte limit",
			method:     http.MethodPut,
			consoleURL: "/api/control/user?id=7",
			body:       `{"email":"user@example.com","realname":"Acceptance","comment":"测试测试测试测试测试测"}`,
			wantStatus: http.StatusBadRequest,
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			application, err := newApp()
			if err != nil {
				t.Fatal(err)
			}
			called := false
			client := mockClient(func(request *http.Request) (int, string) {
				called = true
				return http.StatusCreated, `{}`
			})
			current := createTestSession(t, application, client, false)
			request := httptest.NewRequest(test.method, test.consoleURL, strings.NewReader(test.body))
			request.Host = "console.test"
			request.Header.Set("Origin", "http://console.test")
			request.AddCookie(&http.Cookie{Name: sessionCookie, Value: current.ID})
			recorder := httptest.NewRecorder()
			application.routes().ServeHTTP(recorder, request)
			if recorder.Code != test.wantStatus {
				t.Fatalf("status = %d, want %d; body = %s", recorder.Code, test.wantStatus, recorder.Body.String())
			}
			if test.wantStatus == http.StatusBadRequest && called {
				t.Fatal("overlong comment reached Harbor")
			}
		})
	}
}
