package observability

import (
	"bytes"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"harbor-console/internal/config"
)

func TestStructuredLoggerJSONAndLevel(t *testing.T) {
	var output bytes.Buffer
	logger, err := NewLogger(&output, config.Logging{Level: "warn", Format: "json"})
	if err != nil {
		t.Fatal(err)
	}
	logger.Info("hidden")
	logger.Warn("visible", "component", "test")
	lines := strings.Split(strings.TrimSpace(output.String()), "\n")
	if len(lines) != 1 {
		t.Fatalf("JSON logger output = %q", output.String())
	}
	var record map[string]any
	if err := json.Unmarshal([]byte(lines[0]), &record); err != nil {
		t.Fatal(err)
	}
	if record["level"] != "WARN" || record["msg"] != "visible" || record["component"] != "test" {
		t.Fatalf("unexpected JSON log record: %#v", record)
	}
}

func TestStructuredLoggerLogfmt(t *testing.T) {
	var output bytes.Buffer
	logger, err := NewLogger(&output, config.Logging{Level: "info", Format: "logfmt"})
	if err != nil {
		t.Fatal(err)
	}
	logger.Info("server started", "address", "127.0.0.1:8080")
	logLine := output.String()
	for _, expected := range []string{"level=INFO", `msg="server started"`, "address=127.0.0.1:8080"} {
		if !strings.Contains(logLine, expected) {
			t.Fatalf("logfmt output %q does not contain %q", logLine, expected)
		}
	}
}

func TestAccessLoggerRecordsRequestWithoutQuery(t *testing.T) {
	var output bytes.Buffer
	logger, err := NewLogger(&output, config.Logging{Level: "debug", Format: "json"})
	if err != nil {
		t.Fatal(err)
	}
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusTeapot)
		_, _ = w.Write([]byte("teapot"))
	})
	handler := AccessLog(next, logger, config.Logging{AccessLog: true}, "/health")
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/example?token=secret", nil)
	request.RemoteAddr = "192.0.2.10:4321"
	handler.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusTeapot || recorder.Body.String() != "teapot" {
		t.Fatalf("wrapped response changed: %d %q", recorder.Code, recorder.Body.String())
	}
	var record map[string]any
	if err := json.Unmarshal(bytes.TrimSpace(output.Bytes()), &record); err != nil {
		t.Fatal(err)
	}
	if record["level"] != "WARN" || record["method"] != "GET" || record["path"] != "/api/example" || record["status"] != float64(http.StatusTeapot) || record["bytes"] != float64(6) || record["remote_addr"] != "192.0.2.10" {
		t.Fatalf("unexpected access log: %#v", record)
	}
	if strings.Contains(output.String(), "secret") {
		t.Fatalf("access log leaked query string: %s", output.String())
	}
}

func TestAccessLoggerSuppressesHealthChecks(t *testing.T) {
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) })
	for _, test := range []struct {
		name       string
		logHealth  bool
		wantOutput bool
	}{
		{name: "suppressed", logHealth: false, wantOutput: false},
		{name: "enabled", logHealth: true, wantOutput: true},
	} {
		t.Run(test.name, func(t *testing.T) {
			var output bytes.Buffer
			logger := slog.New(slog.NewJSONHandler(&output, nil))
			handler := AccessLog(next, logger, config.Logging{AccessLog: true, LogHealthChecks: test.logHealth}, "/health")
			handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/health", nil))
			if got := output.Len() > 0; got != test.wantOutput {
				t.Fatalf("health log output = %q, wantOutput %v", output.String(), test.wantOutput)
			}
		})
	}
}
