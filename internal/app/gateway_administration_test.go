package app

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

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
		Console struct {
			Version   string `json:"version"`
			Commit    string `json:"commit"`
			BuildDate string `json:"build_date"`
		} `json:"console"`
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
	if payload.Console.Version != "dev" || payload.Console.Commit != "unknown" || payload.Console.BuildDate != "unknown" {
		t.Fatalf("unexpected console build information: %#v", payload.Console)
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
		{operation: "configurations", body: `{"self_registration":false}`},
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

func TestControlRejectsInvalidQuotaValuesBeforeHarbor(t *testing.T) {
	application, err := newApp()
	if err != nil {
		t.Fatal(err)
	}
	current := createTestSession(t, application, mockClient(func(*http.Request) (int, string) {
		t.Fatal("invalid quota request reached Harbor")
		return http.StatusInternalServerError, `{}`
	}), false)
	for _, body := range []string{`{"hard":{"storage":"not-a-number"}}`, `{"hard":{"storage":-2}}`, `{"hard":{"storage":1.5}}`} {
		request := httptest.NewRequest(http.MethodPut, "/api/control/quota?id=3", strings.NewReader(body))
		request.Host = "console.test"
		request.Header.Set("Origin", "http://console.test")
		request.AddCookie(&http.Cookie{Name: sessionCookie, Value: current.ID})
		recorder := httptest.NewRecorder()
		application.routes().ServeHTTP(recorder, request)
		if recorder.Code != http.StatusBadRequest {
			t.Fatalf("body %s status = %d, want 400; body = %s", body, recorder.Code, recorder.Body.String())
		}
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
		{name: "retention unknown tag decoration", method: http.MethodPost, operation: "retentions", body: `{"algorithm":"or","rules":[{"action":"retain","template":"latestPushedK","params":{"latestPushedK":10},"tag_selectors":[{"kind":"doublestar","decoration":"unknown","pattern":"**"}],"scope_selectors":{"repository":[{"kind":"doublestar","decoration":"repoMatches","pattern":"**"}]}}],"trigger":{"kind":"Schedule","settings":{}},"scope":{"level":"project","ref":1}}`},
		{name: "retention extras must be string", method: http.MethodPost, operation: "retentions", body: `{"algorithm":"or","rules":[{"action":"retain","template":"latestPushedK","params":{"latestPushedK":10},"tag_selectors":[{"kind":"doublestar","decoration":"matches","pattern":"**","extras":{"untagged":true}}],"scope_selectors":{"repository":[{"kind":"doublestar","decoration":"repoMatches","pattern":"**"}]}}],"trigger":{"kind":"Schedule","settings":{}},"scope":{"level":"project","ref":1}}`},
		{name: "retention untagged must be boolean", method: http.MethodPost, operation: "retentions", body: `{"algorithm":"or","rules":[{"action":"retain","template":"latestPushedK","params":{"latestPushedK":10},"tag_selectors":[{"kind":"doublestar","decoration":"matches","pattern":"**","extras":"{\"untagged\":\"true\"}"}],"scope_selectors":{"repository":[{"kind":"doublestar","decoration":"repoMatches","pattern":"**"}]}}],"trigger":{"kind":"Schedule","settings":{}},"scope":{"level":"project","ref":1}}`},
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
