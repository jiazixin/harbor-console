package app

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestControlSecurityOperationsUseOfficialAPI(t *testing.T) {
	allowlistBody := `{"id":1,"project_id":0,"expires_at":null,"items":[{"cve_id":"CVE-2026-1842"}]}`
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

func TestSystemCVEAllowlistUpdateUsesAuthoritativeIdentityAndVerifiesPersistence(t *testing.T) {
	application, err := newApp()
	if err != nil {
		t.Fatal(err)
	}
	requestCount := 0
	client := mockClient(func(request *http.Request) (int, string) {
		requestCount++
		if request.URL.Path != "/api/v2.0/system/CVEAllowlist" {
			t.Fatalf("upstream path = %q", request.URL.Path)
		}
		switch requestCount {
		case 1:
			if request.Method != http.MethodGet {
				t.Fatalf("initial method = %s, want GET", request.Method)
			}
			return http.StatusOK, `{"id":17,"project_id":0,"expires_at":1893455999,"items":[{"cve_id":"CVE-2026-1842"}]}`
		case 2:
			if request.Method != http.MethodPut {
				t.Fatalf("update method = %s, want PUT", request.Method)
			}
			var body map[string]any
			if err := json.NewDecoder(request.Body).Decode(&body); err != nil {
				t.Fatal(err)
			}
			if numberValue(body["id"]) != 17 || numberValue(body["project_id"]) != 0 {
				t.Fatalf("authoritative identity missing from PUT body: %#v", body)
			}
			items, _ := body["items"].([]any)
			if len(items) != 0 {
				t.Fatalf("expected an empty item list, got %#v", items)
			}
			return http.StatusOK, `{}`
		case 3:
			if request.Method != http.MethodGet {
				t.Fatalf("verification method = %s, want GET", request.Method)
			}
			return http.StatusOK, `{"id":17,"project_id":0,"expires_at":null,"items":[]}`
		default:
			t.Fatalf("unexpected extra request #%d", requestCount)
			return http.StatusInternalServerError, `{}`
		}
	})
	current := createTestSession(t, application, client, false)
	request := httptest.NewRequest(http.MethodPut, "/api/control/system-cve-allowlist", strings.NewReader(`{"expires_at":null,"items":[]}`))
	request.Host = "console.test"
	request.Header.Set("Origin", "http://console.test")
	request.AddCookie(&http.Cookie{Name: sessionCookie, Value: current.ID})
	recorder := httptest.NewRecorder()
	application.routes().ServeHTTP(recorder, request)
	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body = %s", recorder.Code, recorder.Body.String())
	}
	if requestCount != 3 {
		t.Fatalf("upstream request count = %d, want 3", requestCount)
	}
}

func TestSystemCVEAllowlistUpdateRejectsFalseSuccessAfterVerification(t *testing.T) {
	application, err := newApp()
	if err != nil {
		t.Fatal(err)
	}
	requestCount := 0
	client := mockClient(func(request *http.Request) (int, string) {
		requestCount++
		switch requestCount {
		case 1:
			return http.StatusOK, `{"id":17,"project_id":0,"expires_at":null,"items":[{"cve_id":"CVE-2026-1842"}]}`
		case 2:
			return http.StatusOK, `{}`
		case 3:
			// Simulate the Harbor regression: PUT responds successfully but the
			// old item remains in the authoritative resource.
			return http.StatusOK, `{"id":17,"project_id":0,"expires_at":null,"items":[{"cve_id":"CVE-2026-1842"}]}`
		default:
			t.Fatalf("unexpected request #%d: %s", requestCount, request.URL.Path)
			return http.StatusInternalServerError, `{}`
		}
	})
	current := createTestSession(t, application, client, false)
	request := httptest.NewRequest(http.MethodPut, "/api/control/system-cve-allowlist", strings.NewReader(`{"expires_at":null,"items":[]}`))
	request.Host = "console.test"
	request.Header.Set("Origin", "http://console.test")
	request.AddCookie(&http.Cookie{Name: sessionCookie, Value: current.ID})
	recorder := httptest.NewRecorder()
	application.routes().ServeHTTP(recorder, request)
	if recorder.Code == http.StatusOK {
		t.Fatalf("false success reported after persistence mismatch: %s", recorder.Body.String())
	}
	if !strings.Contains(recorder.Body.String(), "Harbor 已接受写入") || !strings.Contains(recorder.Body.String(), "回读的 CVE Allowlist 与请求不一致") {
		t.Fatalf("mismatch detail missing: %s", recorder.Body.String())
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
		{method: http.MethodPut, operation: "project?project=p", body: `{"metadata":{"unknown":true}}`},
		{method: http.MethodPut, operation: "project?project=p", body: `{"storage_limit":"1073741824"}`},
		{method: http.MethodPut, operation: "project?project=p", body: `{"metadata":{"reuse_sys_cve_allowlist":"false"},"cve_allowlist":{"expires_at":null,"items":[{"cve_id":"CVE-2026-1842"},{"cve_id":"CVE-2026-1842"}]}}`},
		{method: http.MethodPost, operation: "cve-export", body: `{"projects":[1,2],"labels":[]}`},
		{method: http.MethodPost, operation: "cve-export", body: `{"projects":[1.5],"labels":[]}`},
		{method: http.MethodPost, operation: "scanners", body: `{"name":"` + strings.Repeat("s", 129) + `","description":"","url":"http://scanner:8080","auth":"","access_credential":"","disabled":false,"skip_certVerify":false,"use_internal_addr":false}`},
		{method: http.MethodPost, operation: "scanners", body: `{"name":"scanner","description":"","url":"http://scanner:8080","auth":"unsupported","access_credential":"","disabled":false,"skip_certVerify":false,"use_internal_addr":false}`},
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
