package config

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestDefaultRuntimeConfig(t *testing.T) {
	cfg := Default()
	if got := cfg.Address(); got != "127.0.0.1:8080" {
		t.Fatalf("default address = %q, want 127.0.0.1:8080", got)
	}
	if cfg.Logging.Format != "json" || cfg.Logging.Level != "info" || !cfg.Logging.AccessLog || cfg.Logging.LogHealthChecks {
		t.Fatalf("unexpected default logging config: %#v", cfg.Logging)
	}
	if time.Duration(cfg.Server.ShutdownTimeout) != 10*time.Second {
		t.Fatalf("default shutdown timeout = %s", time.Duration(cfg.Server.ShutdownTimeout))
	}
	if err := cfg.Validate(); err != nil {
		t.Fatalf("default config is invalid: %v", err)
	}
}

func TestLoadYAMLAndEnvironment(t *testing.T) {
	path := writeRuntimeConfig(t, `
server:
  listen: 0.0.0.0
  port: 8088
  read_header_timeout: 4s
  read_timeout: 15s
  write_timeout: 25s
  idle_timeout: 75s
  shutdown_timeout: 8s
logging:
  level: debug
  format: logfmt
  access_log: false
  log_health_checks: true
`)
	environment := map[string]string{
		"HARBOR_CONSOLE_SERVER__LISTEN":       "::1",
		"HARBOR_CONSOLE_SERVER__PORT":         "9010",
		"HARBOR_CONSOLE_LOGGING__LEVEL":       "warn",
		"HARBOR_CONSOLE_LOGGING__FORMAT":      "json",
		"HARBOR_CONSOLE_SERVER__IDLE_TIMEOUT": "70s",
	}
	cfg, err := Load(Source{Path: path, Explicit: true, LookupEnv: mapEnvironment(environment)})
	if err != nil {
		t.Fatal(err)
	}
	if got := cfg.Address(); got != "[::1]:9010" {
		t.Fatalf("overridden address = %q, want [::1]:9010", got)
	}
	if cfg.Logging.Level != "warn" || cfg.Logging.Format != "json" || time.Duration(cfg.Server.IdleTimeout) != 70*time.Second {
		t.Fatalf("environment overrides were not applied: %#v", cfg)
	}
	if cfg.Logging.AccessLog || !cfg.Logging.LogHealthChecks {
		t.Fatalf("YAML boolean values were not retained: %#v", cfg.Logging)
	}
	if time.Duration(cfg.Server.ReadHeaderTimeout) != 4*time.Second || time.Duration(cfg.Server.ShutdownTimeout) != 8*time.Second {
		t.Fatalf("YAML durations were not parsed: %#v", cfg.Server)
	}
}

func TestLoadNormalizesBeforeValidating(t *testing.T) {
	path := writeRuntimeConfig(t, "server:\n  listen: \" 127.0.0.1 \"\nlogging:\n  level: \" DEBUG \"\n  format: LogFmt\n")
	cfg, err := Load(Source{Path: path, Explicit: true})
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Server.Listen != "127.0.0.1" || cfg.Logging.Level != "debug" || cfg.Logging.Format != "logfmt" {
		t.Fatalf("got %#v", cfg)
	}
}

func TestValidateDoesNotModify(t *testing.T) {
	cfg := Default()
	cfg.Logging.Level = " INFO "
	if err := cfg.Validate(); err == nil {
		t.Fatal("unnormalized level should be rejected by Validate")
	}
	if cfg.Logging.Level != " INFO " {
		t.Fatalf("Validate modified the config: %q", cfg.Logging.Level)
	}
}

func TestLoadMissingFile(t *testing.T) {
	missing := filepath.Join(t.TempDir(), "missing.yaml")
	cfg, err := Load(Source{Path: missing})
	if err != nil {
		t.Fatalf("implicit missing config should use defaults: %v", err)
	}
	if cfg.Address() != "127.0.0.1:8080" {
		t.Fatalf("missing implicit config did not use defaults: %#v", cfg)
	}
	_, err = Load(Source{Path: missing, Explicit: true})
	if err == nil || !strings.HasPrefix(err.Error(), "read config file: ") || !strings.Contains(err.Error(), missing) {
		t.Fatalf("got %v, want a read error naming %q", err, missing)
	}
	for _, path := range []string{"", "   "} {
		if _, err := Load(Source{Path: path, Explicit: true}); err == nil || err.Error() != "config file path must not be empty" {
			t.Fatalf("Load(%q) error = %v", path, err)
		}
	}
}

func TestLoadResolvesRelativePathAgainstWorkDir(t *testing.T) {
	workDir := t.TempDir()
	if err := os.Mkdir(filepath.Join(workDir, "configs"), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(workDir, "configs", "config.local.yaml"), []byte("server:\n  port: 8088\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	// The process working directory holds no configuration, so only WorkDir can supply it.
	t.Chdir(t.TempDir())
	for _, explicit := range []bool{false, true} {
		cfg, err := Load(Source{Path: "configs/config.local.yaml", Explicit: explicit, WorkDir: workDir})
		if err != nil || cfg.Server.Port != 8088 {
			t.Fatalf("explicit=%v: got %#v, %v", explicit, cfg.Server, err)
		}
	}
}

func TestLoadRejectsInvalidValues(t *testing.T) {
	tests := []struct {
		name    string
		content string
		want    string
	}{
		{name: "unknown field", content: "server:\n  porrt: 8080\n", want: "field porrt not found"},
		{name: "second document", content: "server:\n  port: 8080\n---\nserver:\n  port: 9090\n", want: "only one YAML document is allowed"},
		{name: "invalid port", content: "server:\n  port: 70000\n", want: "server.port: must be between 1 and 65535"},
		{name: "listener includes port", content: "server:\n  listen: 127.0.0.1:8080\n", want: "server.listen: must be a host name or an IP address without a port"},
		{name: "removed health section", content: "health:\n  uri: /health\n", want: "field health not found"},
		{name: "invalid duration", content: "server:\n  read_timeout: 0s\n", want: "server.read_timeout: must be greater than 0"},
		{name: "unparsable duration", content: "server:\n  read_timeout: soon\n", want: `parse duration "soon"`},
		{name: "invalid log level", content: "logging:\n  level: trace\n", want: "logging.level: must be debug, info, warn or error"},
		{name: "invalid log format", content: "logging:\n  format: plain\n", want: "logging.format: must be json or logfmt"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			path := writeRuntimeConfig(t, test.content)
			_, err := Load(Source{Path: path, Explicit: true})
			if err == nil || !strings.Contains(err.Error(), test.want) {
				t.Fatalf("got %v, want containing %q", err, test.want)
			}
		})
	}
}

func TestValidateReportsFieldError(t *testing.T) {
	cfg := Default()
	cfg.Server.Port = 0
	fieldErr, ok := errors.AsType[*FieldError](cfg.Validate())
	if !ok || fieldErr.Field != "server.port" || fieldErr.Error() != "server.port: must be between 1 and 65535" {
		t.Fatalf("got %#v", fieldErr)
	}
}

func TestLoadRejectsInvalidEnvironment(t *testing.T) {
	for _, tc := range []struct {
		environment map[string]string
		want        string
	}{
		{map[string]string{"HARBOR_CONSOLE_SERVER__PORT": "zero"}, "parse environment variable HARBOR_CONSOLE_SERVER__PORT: "},
		{map[string]string{"HARBOR_CONSOLE_LOGGING__ACCESS_LOG": "maybe"}, "parse environment variable HARBOR_CONSOLE_LOGGING__ACCESS_LOG: "},
		{map[string]string{"HARBOR_CONSOLE_SERVER__READ_TIMEOUT": "soon"}, "parse environment variable HARBOR_CONSOLE_SERVER__READ_TIMEOUT: "},
		{map[string]string{"HARBOR_CONSOLE_LOGGING__LEVEL": "verbose"}, "logging.level: "},
		{map[string]string{"HARBOR_CONSOLE_LOGGING__FORMAT": "console"}, "logging.format: "},
	} {
		_, err := Load(Source{LookupEnv: mapEnvironment(tc.environment)})
		if err == nil || !strings.Contains(err.Error(), tc.want) {
			t.Fatalf("%v: got %v, want containing %q", tc.environment, err, tc.want)
		}
	}
}

func TestLoadIgnoresProcessEnvironment(t *testing.T) {
	// Load reads only src.LookupEnv; CONFIG_FILE and field variables in the
	// process environment have no effect.
	t.Chdir(t.TempDir())
	t.Setenv("CONFIG_FILE", "missing.yaml")
	t.Setenv("HARBOR_CONSOLE_SERVER__PORT", "9010")
	cfg, err := Load(Source{Path: "configs/config.local.yaml", WorkDir: t.TempDir()})
	if err != nil || cfg.Server.Port != 8080 {
		t.Fatalf("got %#v, %v", cfg.Server, err)
	}
}

func TestLoadAppliesEnvironmentOverExplicitFile(t *testing.T) {
	path := writeRuntimeConfig(t, "server:\n  port: 8088\n  listen: 0.0.0.0\n")
	cfg, err := Load(Source{Path: path, Explicit: true, LookupEnv: mapEnvironment(map[string]string{"HARBOR_CONSOLE_SERVER__PORT": "9010", "PORT": "1"})})
	if err != nil || cfg.Server.Listen != "0.0.0.0" || cfg.Server.Port != 9010 {
		t.Fatalf("got %#v, %v", cfg, err)
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

func mapEnvironment(values map[string]string) func(string) (string, bool) {
	return func(key string) (string, bool) {
		value, ok := values[key]
		return value, ok
	}
}
