package app

import (
	"encoding/json"
	"math"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestGatewayRejectsPathTraversalBeforeHarbor(t *testing.T) {
	for _, target := range []string{
		"/api/control/project?project=..",
		"/api/control/artifact?project=platform&repository=team%2F..%2Fother&reference=stable",
		"/api/control/artifact?project=platform&repository=gateway&reference=..",
		"/api/resources/repositories?project=..",
		"/api/resources/artifacts?project=platform&repository=platform%2F",
	} {
		t.Run(target, func(t *testing.T) {
			application, err := newApp()
			if err != nil {
				t.Fatal(err)
			}
			current := createTestSession(t, application, mockClient(func(*http.Request) (int, string) {
				t.Fatal("invalid path reached Harbor")
				return http.StatusInternalServerError, `{}`
			}), false)
			request := httptest.NewRequest(http.MethodGet, target, nil)
			request.AddCookie(&http.Cookie{Name: sessionCookie, Value: current.ID})
			response := httptest.NewRecorder()
			application.routes().ServeHTTP(response, request)
			if response.Code != http.StatusBadRequest {
				t.Fatalf("invalid path response = %d, body = %s", response.Code, response.Body.String())
			}
		})
	}
}

func TestGatewayRejectsFractionalIDsAndUnsupportedAccessFields(t *testing.T) {
	for _, test := range []struct {
		method string
		path   string
		body   string
	}{
		{method: http.MethodPut, path: "project-member?project=platform&member=1", body: `{"role_id":1.5}`},
		{method: http.MethodPut, path: "project-member?project=platform&member=1", body: `{"role_id":1,"unexpected":true}`},
		{method: http.MethodPost, path: "artifact-labels?project=platform&repository=gateway&reference=stable", body: `{"id":1.5}`},
		{method: http.MethodPost, path: "replication-executions", body: `{"policy_id":1.5}`},
		{method: http.MethodPost, path: "registry-ping", body: `{"id":1.5}`},
		{method: http.MethodPost, path: "preheat-instance-ping", body: `{"id":1.5}`},
		{method: http.MethodPost, path: "preheat-policies?project=platform", body: `{"name":"release","provider_id":1.5}`},
		{method: http.MethodPost, path: "labels", body: `{"name":"release","scope":"p","project_id":1.5}`},
		{method: http.MethodPost, path: "user-groups", body: `{"group_name":"release","group_type":2.5}`},
		{method: http.MethodPost, path: "robots", body: `{"name":"ci","level":"system","duration":1.5,"permissions":[]}`},
		{method: http.MethodPatch, path: "robot?id=1", body: `{"secret":"NewSecret1","disable":true}`},
		{method: http.MethodPut, path: "user-sysadmin?id=1", body: `{"sysadmin_flag":true,"username":"shadow"}`},
	} {
		t.Run(test.path+test.body, func(t *testing.T) {
			application, err := newApp()
			if err != nil {
				t.Fatal(err)
			}
			current := createTestSession(t, application, mockClient(func(*http.Request) (int, string) {
				t.Fatal("invalid numeric or access-control field reached Harbor")
				return http.StatusInternalServerError, `{}`
			}), false)
			request := httptest.NewRequest(test.method, "/api/control/"+test.path, strings.NewReader(test.body))
			request.AddCookie(&http.Cookie{Name: sessionCookie, Value: current.ID})
			response := httptest.NewRecorder()
			application.routes().ServeHTTP(response, request)
			if response.Code != http.StatusBadRequest {
				t.Fatalf("invalid body response = %d, body = %s", response.Code, response.Body.String())
			}
		})
	}
}

func TestIntegerNumberValueRejectsFloatOverflow(t *testing.T) {
	for _, value := range []float64{math.MaxInt64, math.Inf(1), math.NaN(), 1.5} {
		if _, valid := integerNumberValue(value); valid {
			t.Errorf("invalid integer float %v was accepted", value)
		}
	}
	value, valid := integerNumberValue(json.Number("9223372036854775807"))
	if !valid || value != math.MaxInt64 {
		t.Fatal("exact int64 maximum should remain valid")
	}
}

func TestPublicCatalogRejectsPathTraversalBeforeHarbor(t *testing.T) {
	application, err := newApp()
	if err != nil {
		t.Fatal(err)
	}
	application.newClient = func(bool) *http.Client {
		return mockClient(func(*http.Request) (int, string) {
			t.Fatal("invalid public path reached Harbor")
			return http.StatusInternalServerError, `{}`
		})
	}
	request := httptest.NewRequest(http.MethodPost, "/api/public/repositories", strings.NewReader(`{"url":"https://harbor.test","project":".."}`))
	response := httptest.NewRecorder()
	application.routes().ServeHTTP(response, request)
	if response.Code != http.StatusBadRequest {
		t.Fatalf("invalid public path response = %d", response.Code)
	}
}

func TestResourceRejectsInvalidPaginationBeforeHarbor(t *testing.T) {
	for _, query := range []string{"page=0", "page_size=101", "page=1.5", "page_size=-1"} {
		t.Run(query, func(t *testing.T) {
			application, err := newApp()
			if err != nil {
				t.Fatal(err)
			}
			current := createTestSession(t, application, mockClient(func(*http.Request) (int, string) {
				t.Fatal("invalid pagination reached Harbor")
				return http.StatusInternalServerError, `{}`
			}), false)
			request := httptest.NewRequest(http.MethodGet, "/api/resources/projects?"+query, nil)
			request.AddCookie(&http.Cookie{Name: sessionCookie, Value: current.ID})
			response := httptest.NewRecorder()
			application.routes().ServeHTTP(response, request)
			if response.Code != http.StatusBadRequest {
				t.Fatalf("invalid pagination response = %d", response.Code)
			}
		})
	}
}

func TestResourceUsesNumericProjectAsName(t *testing.T) {
	application, err := newApp()
	if err != nil {
		t.Fatal(err)
	}
	current := createTestSession(t, application, mockClient(func(request *http.Request) (int, string) {
		if request.URL.Path != "/api/v2.0/projects/123/repositories" || request.Header.Get("X-Is-Resource-Name") != "true" {
			t.Fatalf("resource request treated a numeric project name as an ID: %s %v", request.URL.Path, request.Header)
		}
		if request.URL.Query().Get("page_size") != "50" {
			t.Fatal("resource default page size changed")
		}
		return http.StatusOK, `[]`
	}), false)
	request := httptest.NewRequest(http.MethodGet, "/api/resources/repositories?project=123", nil)
	request.AddCookie(&http.Cookie{Name: sessionCookie, Value: current.ID})
	response := httptest.NewRecorder()
	application.routes().ServeHTTP(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("numeric project resource response = %d, body = %s", response.Code, response.Body.String())
	}
}
