package main

import (
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestConfigurableHealthEndpoint(t *testing.T) {
	config := defaultRuntimeConfig()
	config.Health.URI = "/healthy"
	application, err := newAppWithConfig(config, slog.New(slog.NewTextHandler(io.Discard, nil)))
	if err != nil {
		t.Fatal(err)
	}
	handler := application.routes()

	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/healthy", nil))
	if recorder.Code != http.StatusOK {
		t.Fatalf("GET /healthy status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
	if recorder.Header().Get("Cache-Control") != "no-store" {
		t.Fatalf("GET /healthy cache control = %q", recorder.Header().Get("Cache-Control"))
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
	handler.ServeHTTP(recorder, httptest.NewRequest(http.MethodPost, "/healthy", nil))
	if recorder.Code != http.StatusMethodNotAllowed {
		t.Fatalf("POST /healthy status = %d, want 405", recorder.Code)
	}
}
