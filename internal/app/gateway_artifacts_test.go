package app

import (
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
)

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

func TestControlArtifactIconUsesOfficialAPI(t *testing.T) {
	application, err := newApp()
	if err != nil {
		t.Fatal(err)
	}
	client := mockClient(func(request *http.Request) (int, string) {
		if request.Method != http.MethodGet {
			t.Fatalf("method = %s, want GET", request.Method)
		}
		if got, want := request.URL.EscapedPath(), "/api/v2.0/icons/sha256:icon%2Fdigest"; got != want {
			t.Fatalf("path = %q, want %q", got, want)
		}
		return http.StatusOK, `{"content-type":"image/png","content":"iVBORw0KGgo="}`
	})
	current := createTestSession(t, application, client, false)
	request := httptest.NewRequest(http.MethodGet, "/api/control/artifact-icon?digest="+url.QueryEscape("sha256:icon/digest"), nil)
	request.AddCookie(&http.Cookie{Name: sessionCookie, Value: current.ID})
	recorder := httptest.NewRecorder()
	application.routes().ServeHTTP(recorder, request)
	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
	if !strings.Contains(recorder.Body.String(), `"content-type":"image/png"`) {
		t.Fatalf("icon response = %s", recorder.Body.String())
	}
}

func TestDemoArtifactIconAndMetadata(t *testing.T) {
	application, err := newApp()
	if err != nil {
		t.Fatal(err)
	}
	handler := application.routes()
	login := httptest.NewRecorder()
	handler.ServeHTTP(login, httptest.NewRequest(http.MethodPost, "/api/demo", strings.NewReader("{}")))
	cookie := login.Result().Cookies()[0]

	icon := httptest.NewRecorder()
	iconRequest := httptest.NewRequest(http.MethodGet, "/api/control/artifact-icon?digest="+url.QueryEscape(demoArtifactIconDigest), nil)
	iconRequest.AddCookie(cookie)
	handler.ServeHTTP(icon, iconRequest)
	if icon.Code != http.StatusOK || !strings.Contains(icon.Body.String(), `"content-type":"image/png"`) || !strings.Contains(icon.Body.String(), `"content":"iVBORw0KGgo`) {
		t.Fatalf("demo icon response = %d %s", icon.Code, icon.Body.String())
	}

	artifact := httptest.NewRecorder()
	artifactRequest := httptest.NewRequest(http.MethodGet, "/api/control/artifact?project=platform&repository=platform%2Fgateway&reference="+url.QueryEscape("sha256:41bf0e3b54f9a760a6c1f0b170507173bf6d95f2e8db4dd79f858f31f36c28a4")+"&with_accessory=true", nil)
	artifactRequest.AddCookie(cookie)
	handler.ServeHTTP(artifact, artifactRequest)
	for _, expected := range []string{`"icon":"` + demoArtifactIconDigest, `"signature.cosign"`, `"signature.notation"`, `"org.opencontainers.image.source"`} {
		if !strings.Contains(artifact.Body.String(), expected) {
			t.Fatalf("demo artifact is missing %q: %s", expected, artifact.Body.String())
		}
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
