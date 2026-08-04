package app

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
)

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

func TestDemoAuditLogsSupportTimeRangeFilter(t *testing.T) {
	application, err := newApp()
	if err != nil {
		t.Fatal(err)
	}
	current := createTestSession(t, application, nil, true)
	request := httptest.NewRequest(http.MethodGet, "/api/control/audit-logs?page=1&page_size=20&sort=-op_time&q=op_time%3D%5B2026-07-28T06%3A20%3A00Z~2026-07-28T06%3A40%3A00Z%5D", nil)
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
	if payload.Pagination.Total != 2 || len(payload.Items) != 2 {
		t.Fatalf("unexpected time-range audit result: %#v", payload)
	}
	if payload.Items[0]["id"] != float64(48319) || payload.Items[1]["id"] != float64(48318) {
		t.Fatalf("unexpected time-range audit items: %#v", payload.Items)
	}
}
