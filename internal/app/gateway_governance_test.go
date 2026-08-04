package app

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestControlGovernanceOperationsUseOfficialAPI(t *testing.T) {
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
		{name: "list robots", method: http.MethodGet, consoleURL: "/api/control/robots?page=1&page_size=20&q=Level%3Dproject%2CProjectID%3D7", wantPath: "/api/v2.0/robots", wantQuery: "page=1&page_size=20&q=Level%3Dproject%2CProjectID%3D7", upstream: `[]`, status: http.StatusOK},
		{name: "create robot", method: http.MethodPost, consoleURL: "/api/control/robots", wantPath: "/api/v2.0/robots", body: `{"name":"ci","level":"project","duration":90,"permissions":[{"kind":"project","namespace":"platform","access":[{"resource":"repository","action":"pull"}]}]}`, upstream: `{"id":42,"name":"robot$platform+ci","secret":"secret"}`, status: http.StatusCreated},
		{name: "update robot", method: http.MethodPut, consoleURL: "/api/control/robot?id=42", wantPath: "/api/v2.0/robots/42", body: `{"name":"robot$platform+ci","description":"pipeline","level":"project","duration":90,"disable":true,"permissions":[{"kind":"project","namespace":"platform","access":[{"resource":"repository","action":"pull"}]}]}`, upstream: `{}`, status: http.StatusOK},
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
				if test.wantQuery != "" && request.URL.Query().Encode() != test.wantQuery {
					t.Fatalf("upstream query = %q, want %q", request.URL.Query().Encode(), test.wantQuery)
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

func TestControlRetentionMetadataUsesOfficialAPI(t *testing.T) {
	application, err := newApp()
	if err != nil {
		t.Fatal(err)
	}
	client := mockClient(func(request *http.Request) (int, string) {
		if request.Method != http.MethodGet || request.URL.Path != "/api/v2.0/retentions/metadatas" {
			t.Fatalf("upstream request = %s %s", request.Method, request.URL.Path)
		}
		return http.StatusOK, `{"templates":[{"rule_template":"latestPushedK"}],"scope_selectors":[{"kind":"doublestar","decorations":["repoMatches","repoExcludes"]}],"tag_selectors":[{"kind":"doublestar","decorations":["matches","excludes"]}]}`
	})
	current := createTestSession(t, application, client, false)
	request := httptest.NewRequest(http.MethodGet, "/api/control/retention-metadatas", nil)
	request.AddCookie(&http.Cookie{Name: sessionCookie, Value: current.ID})
	recorder := httptest.NewRecorder()
	application.routes().ServeHTTP(recorder, request)
	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
}

func TestControlMemberDirectorySearch(t *testing.T) {
	for _, test := range []struct {
		name, operation, wantPath, wantQuery string
	}{
		{name: "users", operation: "users-search?username=release&page=1&page_size=20", wantPath: "/api/v2.0/users/search", wantQuery: "page=1&page_size=20&username=release"},
		{name: "groups", operation: "user-groups-search?groupname=platform&page=1&page_size=20", wantPath: "/api/v2.0/usergroups/search", wantQuery: "groupname=platform&page=1&page_size=20"},
	} {
		t.Run(test.name, func(t *testing.T) {
			application, err := newApp()
			if err != nil {
				t.Fatal(err)
			}
			current := createTestSession(t, application, mockClient(func(request *http.Request) (int, string) {
				if request.Method != http.MethodGet || request.URL.Path != test.wantPath || request.URL.RawQuery != test.wantQuery {
					t.Fatalf("upstream request = %s %s?%s", request.Method, request.URL.Path, request.URL.RawQuery)
				}
				return http.StatusOK, `[]`
			}), false)
			request := httptest.NewRequest(http.MethodGet, "/api/control/"+test.operation, nil)
			request.AddCookie(&http.Cookie{Name: sessionCookie, Value: current.ID})
			recorder := httptest.NewRecorder()
			application.routes().ServeHTTP(recorder, request)
			if recorder.Code != http.StatusOK {
				t.Fatalf("status = %d, body = %s", recorder.Code, recorder.Body.String())
			}
		})
	}

	for _, operation := range []string{
		"users-search?username=%20%20",
		"users-search?username=release&unexpected=true",
		"user-groups-search?groupname=" + strings.Repeat("a", 256),
	} {
		t.Run("invalid_"+operation[:strings.IndexByte(operation, '?')], func(t *testing.T) {
			application, err := newApp()
			if err != nil {
				t.Fatal(err)
			}
			current := createTestSession(t, application, mockClient(func(*http.Request) (int, string) {
				t.Fatal("invalid directory query reached Harbor")
				return http.StatusInternalServerError, "{}"
			}), false)
			request := httptest.NewRequest(http.MethodGet, "/api/control/"+operation, nil)
			request.AddCookie(&http.Cookie{Name: sessionCookie, Value: current.ID})
			recorder := httptest.NewRecorder()
			application.routes().ServeHTTP(recorder, request)
			if recorder.Code != http.StatusBadRequest {
				t.Fatalf("status = %d, want 400; body = %s", recorder.Code, recorder.Body.String())
			}
		})
	}
}

func TestControlProjectAuditOperations(t *testing.T) {
	application, err := newApp()
	if err != nil {
		t.Fatal(err)
	}
	current := createTestSession(t, application, mockClient(func(request *http.Request) (int, string) {
		if request.Method != http.MethodGet || request.URL.Path != "/api/v2.0/projects/platform/auditlog-exts" || request.URL.Query().Get("q") != "username=~release" {
			t.Fatalf("upstream request = %s %s?%s", request.Method, request.URL.Path, request.URL.RawQuery)
		}
		if request.Header.Get("X-Is-Resource-Name") != "true" {
			t.Fatal("project resource name header was not forwarded")
		}
		return http.StatusOK, `[]`
	}), false)
	request := httptest.NewRequest(http.MethodGet, "/api/control/project-audit-logs?project=platform&page=1&page_size=20&sort=-op_time&q=username%3D~release", nil)
	request.AddCookie(&http.Cookie{Name: sessionCookie, Value: current.ID})
	recorder := httptest.NewRecorder()
	application.routes().ServeHTTP(recorder, request)
	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
}

func TestControlProjectDeletableUsesOfficialAPI(t *testing.T) {
	application, err := newApp()
	if err != nil {
		t.Fatal(err)
	}
	current := createTestSession(t, application, mockClient(func(request *http.Request) (int, string) {
		if request.Method != http.MethodGet || request.URL.Path != "/api/v2.0/projects/platform/_deletable" || request.Header.Get("X-Is-Resource-Name") != "true" {
			t.Fatalf("upstream request = %s %s", request.Method, request.URL.Path)
		}
		return http.StatusOK, `{"deletable":false,"message":"contains repositories"}`
	}), false)
	request := httptest.NewRequest(http.MethodGet, "/api/control/project-deletable?project=platform", nil)
	request.AddCookie(&http.Cookie{Name: sessionCookie, Value: current.ID})
	recorder := httptest.NewRecorder()
	application.routes().ServeHTTP(recorder, request)
	if recorder.Code != http.StatusOK || !strings.Contains(recorder.Body.String(), `"deletable":false`) {
		t.Fatalf("status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
}

func TestDemoMemberDirectorySearch(t *testing.T) {
	application, err := newApp()
	if err != nil {
		t.Fatal(err)
	}
	current := createTestSession(t, application, http.DefaultClient, true)
	request := func(path string) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequest(http.MethodGet, path, nil)
		req.AddCookie(&http.Cookie{Name: sessionCookie, Value: current.ID})
		recorder := httptest.NewRecorder()
		application.routes().ServeHTTP(recorder, req)
		return recorder
	}
	users := request("/api/control/users-search?username=RELEASE&page=1&page_size=1")
	if users.Code != http.StatusOK || !strings.Contains(users.Body.String(), `"username":"release-engineer"`) || !strings.Contains(users.Body.String(), `"total":1`) {
		t.Fatalf("unexpected demo user search: %d %s", users.Code, users.Body.String())
	}
	groups := request("/api/control/user-groups-search?groupname=PLATFORM&page=1&page_size=20")
	if groups.Code != http.StatusOK || !strings.Contains(groups.Body.String(), `"group_name":"platform-ops"`) {
		t.Fatalf("unexpected demo group search: %d %s", groups.Code, groups.Body.String())
	}
}

func TestDemoRetentionRuleRoundTrip(t *testing.T) {
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
		if method != http.MethodGet {
			req.Host = "console.test"
			req.Header.Set("Origin", "http://console.test")
		}
		recorder := httptest.NewRecorder()
		handler.ServeHTTP(recorder, req)
		return recorder
	}

	metadata := request(http.MethodGet, "/api/control/retention-metadatas", "")
	if metadata.Code != http.StatusOK {
		t.Fatalf("metadata status = %d, body = %s", metadata.Code, metadata.Body.String())
	}
	current := request(http.MethodGet, "/api/control/retention?id=31", "")
	if current.Code != http.StatusOK {
		t.Fatalf("retention status = %d, body = %s", current.Code, current.Body.String())
	}
	var envelope struct {
		Data map[string]any `json:"data"`
	}
	if err := json.Unmarshal(current.Body.Bytes(), &envelope); err != nil {
		t.Fatal(err)
	}
	rules, _ := envelope.Data["rules"].([]any)
	rule, _ := rules[0].(map[string]any)
	params, _ := rule["params"].(map[string]any)
	params["latestPushedK"] = float64(20)
	body, err := json.Marshal(envelope.Data)
	if err != nil {
		t.Fatal(err)
	}
	updated := request(http.MethodPut, "/api/control/retention?id=31", string(body))
	if updated.Code != http.StatusOK {
		t.Fatalf("retention update status = %d, body = %s", updated.Code, updated.Body.String())
	}
	var updatedEnvelope struct {
		Data map[string]any `json:"data"`
	}
	if err := json.Unmarshal(updated.Body.Bytes(), &updatedEnvelope); err != nil {
		t.Fatal(err)
	}
	updatedRules, _ := updatedEnvelope.Data["rules"].([]any)
	updatedRule, _ := updatedRules[0].(map[string]any)
	tags, _ := updatedRule["tag_selectors"].([]any)
	tag, _ := tags[0].(map[string]any)
	scopes, _ := updatedRule["scope_selectors"].(map[string]any)
	repositories, _ := scopes["repository"].([]any)
	repository, _ := repositories[0].(map[string]any)
	extras := map[string]any{}
	if value, ok := tag["extras"].(string); ok {
		if err := json.Unmarshal([]byte(value), &extras); err != nil {
			t.Fatal(err)
		}
	}
	if repository["decoration"] != "repoExcludes" || tag["decoration"] != "excludes" || extras["untagged"] != true || updatedRule["future_field"] != "preserve-me" {
		t.Fatalf("retention rule semantics were not preserved: %#v", updatedRule)
	}
}
