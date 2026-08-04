package app

import (
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"harbor-console/internal/config"
)

func TestHealthHandler(t *testing.T) {
	for _, test := range []struct {
		name string
		path string
	}{
		{name: "default path", path: "/health"},
		{name: "configured path", path: "/healthy"},
	} {
		t.Run(test.name, func(t *testing.T) {
			settings := config.Default()
			settings.Health.URI = test.path
			application, err := newAppWithConfig(settings, slog.New(slog.NewTextHandler(io.Discard, nil)))
			if err != nil {
				t.Fatal(err)
			}
			handler := application.routes()

			recorder := httptest.NewRecorder()
			handler.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, test.path, nil))
			if recorder.Code != http.StatusOK {
				t.Fatalf("GET %s status = %d, body = %s", test.path, recorder.Code, recorder.Body.String())
			}
			if recorder.Header().Get("Cache-Control") != "no-store" {
				t.Fatalf("GET %s cache control = %q", test.path, recorder.Header().Get("Cache-Control"))
			}
			var response struct {
				Status        string `json:"status"`
				Service       string `json:"service"`
				UptimeSeconds int64  `json:"uptime_seconds"`
			}
			if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
				t.Fatal(err)
			}
			if response.Status != "ok" || response.Service != "harbor-console" || response.UptimeSeconds < 0 {
				t.Fatalf("unexpected health response: %#v", response)
			}

			recorder = httptest.NewRecorder()
			handler.ServeHTTP(recorder, httptest.NewRequest(http.MethodPost, test.path, nil))
			if recorder.Code != http.StatusMethodNotAllowed {
				t.Fatalf("POST %s status = %d, want 405", test.path, recorder.Code)
			}
		})
	}
}
