package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestDefaultRuntimeConfig(t *testing.T) {
	config := defaultRuntimeConfig()
	if got := config.address(); got != "127.0.0.1:8080" {
		t.Fatalf("default address = %q, want 127.0.0.1:8080", got)
	}
	if config.Health.URI != "/health" {
		t.Fatalf("default health URI = %q, want /health", config.Health.URI)
	}
	if config.Logging.Format != "json" || config.Logging.Level != "info" || !config.Logging.AccessLog || config.Logging.LogHealthChecks {
		t.Fatalf("unexpected default logging config: %#v", config.Logging)
	}
	if time.Duration(config.Server.ShutdownTimeout) != 10*time.Second {
		t.Fatalf("default shutdown timeout = %s", time.Duration(config.Server.ShutdownTimeout))
	}
}

func TestLoadRuntimeConfigYAMLAndEnvironment(t *testing.T) {
	path := writeRuntimeConfig(t, `
server:
  listen: 0.0.0.0
  port: 8088
  read_header_timeout: 4s
  read_timeout: 15s
  write_timeout: 25s
  idle_timeout: 75s
  shutdown_timeout: 8s
health:
  uri: /healthy
logging:
  level: debug
  format: logfmt
  access_log: false
  log_health_checks: true
`)
	environment := map[string]string{
		"LISTEN":     "::1",
		"PORT":       "9010",
		"HEALTH_URI": "/status/health",
		"LOG_LEVEL":  "warn",
		"LOG_FORMAT": "json",
	}
	config, err := loadRuntimeConfig(path, true, mapEnvironment(environment))
	if err != nil {
		t.Fatal(err)
	}
	if got := config.address(); got != "[::1]:9010" {
		t.Fatalf("overridden address = %q, want [::1]:9010", got)
	}
	if config.Health.URI != "/status/health" || config.Logging.Level != "warn" || config.Logging.Format != "json" {
		t.Fatalf("environment overrides were not applied: %#v", config)
	}
	if config.Logging.AccessLog || !config.Logging.LogHealthChecks {
		t.Fatalf("YAML boolean values were not retained: %#v", config.Logging)
	}
	if time.Duration(config.Server.ReadHeaderTimeout) != 4*time.Second || time.Duration(config.Server.ShutdownTimeout) != 8*time.Second {
		t.Fatalf("YAML durations were not parsed: %#v", config.Server)
	}
}

func TestLoadRuntimeConfigMissingFileBehavior(t *testing.T) {
	missing := filepath.Join(t.TempDir(), "missing.yaml")
	config, err := loadRuntimeConfig(missing, false, mapEnvironment(nil))
	if err != nil {
		t.Fatalf("implicit missing config should use defaults: %v", err)
	}
	if config.address() != "127.0.0.1:8080" {
		t.Fatalf("missing implicit config did not use defaults: %#v", config)
	}
	if _, err := loadRuntimeConfig(missing, true, mapEnvironment(nil)); err == nil {
		t.Fatal("explicit missing config should fail")
	}
	if _, err := loadRuntimeConfig("", true, mapEnvironment(nil)); err == nil {
		t.Fatal("explicit empty config path should fail")
	}
}

func TestLoadRuntimeConfigRejectsInvalidValues(t *testing.T) {
	tests := []struct {
		name    string
		content string
		want    string
	}{
		{name: "unknown field", content: "server:\n  porrt: 8080\n", want: "field porrt not found"},
		{name: "invalid port", content: "server:\n  port: 70000\n", want: "port"},
		{name: "listener includes port", content: "server:\n  listen: 127.0.0.1:8080\n", want: "listen"},
		{name: "invalid health URI", content: "health:\n  uri: api/health\n", want: "health.uri"},
		{name: "API conflict", content: "health:\n  uri: /api/health\n", want: "health.uri"},
		{name: "invalid duration", content: "server:\n  read_timeout: 0s\n", want: "read_timeout"},
		{name: "invalid log level", content: "logging:\n  level: trace\n", want: "logging.level"},
		{name: "invalid log format", content: "logging:\n  format: plain\n", want: "logging.format"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			path := writeRuntimeConfig(t, test.content)
			_, err := loadRuntimeConfig(path, true, mapEnvironment(nil))
			if err == nil || !strings.Contains(err.Error(), test.want) {
				t.Fatalf("loadRuntimeConfig() error = %v, want containing %q", err, test.want)
			}
		})
	}
}

func TestLoadRuntimeConfigRejectsInvalidEnvironment(t *testing.T) {
	tests := []map[string]string{
		{"PORT": "zero"},
		{"HEALTH_URI": "/"},
		{"LOG_LEVEL": "verbose"},
		{"LOG_FORMAT": "console"},
	}
	for _, environment := range tests {
		if _, err := loadRuntimeConfig("", false, mapEnvironment(environment)); err == nil {
			t.Fatalf("invalid environment should fail: %#v", environment)
		}
	}
}

func writeRuntimeConfig(t *testing.T, content string) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "config.yaml")
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}
	return path
}

func mapEnvironment(values map[string]string) environmentLookup {
	return func(key string) (string, bool) {
		value, ok := values[key]
		return value, ok
	}
}
