package app

import (
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"harbor-console/internal/config"
)

func TestHealthAndInfo(t *testing.T) {
	application, err := newAppWithConfig(config.Default(), slog.New(slog.NewTextHandler(io.Discard, nil)), Build{Version: "v1.2.3"})
	if err != nil {
		t.Fatal(err)
	}
	handler := application.routes()

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	request.Header.Set("X-Request-ID", "probe-7")
	handler.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusOK || strings.TrimSpace(recorder.Body.String()) != `{"status":"ok"}` {
		t.Fatalf("GET /healthz = %d %s", recorder.Code, recorder.Body.String())
	}
	if recorder.Header().Get("Cache-Control") != "no-store" || recorder.Header().Get("X-Request-ID") != "probe-7" {
		t.Fatalf("GET /healthz headers = %v", recorder.Header())
	}

	recorder = httptest.NewRecorder()
	handler.ServeHTTP(recorder, httptest.NewRequest(http.MethodPost, "/healthz", nil))
	if recorder.Code != http.StatusMethodNotAllowed {
		t.Fatalf("POST /healthz status = %d, want 405", recorder.Code)
	}

	recorder = httptest.NewRecorder()
	handler.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api/info", nil))
	if recorder.Code != http.StatusOK || !strings.Contains(recorder.Body.String(), `"version":"v1.2.3"`) || !strings.Contains(recorder.Body.String(), `"capabilities":[`) {
		t.Fatalf("GET /api/info = %d %s", recorder.Code, recorder.Body.String())
	}

	for _, test := range []struct {
		method, path string
		status       int
		code         string
	}{
		{http.MethodGet, "/api/unknown", http.StatusNotFound, "not_found"},
		{http.MethodGet, "/api/operations/not-an-operation", http.StatusNotFound, "not_found"},
		{http.MethodPost, "/api/sessions/current", http.StatusMethodNotAllowed, "method_not_allowed"},
	} {
		recorder = httptest.NewRecorder()
		handler.ServeHTTP(recorder, httptest.NewRequest(test.method, test.path, nil))
		if recorder.Code != test.status || !strings.Contains(recorder.Body.String(), `"code":"`+test.code+`"`) || recorder.Header().Get("X-Request-ID") == "" {
			t.Fatalf("%s %s = %d %s", test.method, test.path, recorder.Code, recorder.Body.String())
		}
	}
}
