package main

import (
	"bytes"
	"net"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
)

func TestRunUsageErrors(t *testing.T) {
	for _, args := range [][]string{{"--bogus"}, {"-c"}, {"--config="}, {"config.yaml"}, {"-c", "a.yaml", "-c", "b.yaml"}} {
		t.Run(strings.Join(args, " "), func(t *testing.T) {
			var stdout, stderr bytes.Buffer
			if code := run(args, &stdout, &stderr); code != exitUsage {
				t.Fatalf("exit %d, want %d", code, exitUsage)
			}
			if stdout.Len() != 0 || !strings.HasPrefix(stderr.String(), "harbor-console: ") || !strings.HasSuffix(stderr.String(), "\nRun 'harbor-console --help' for usage.\n") {
				t.Fatalf("stdout %q, stderr %q", stdout.String(), stderr.String())
			}
		})
	}
}

func TestRunHelpAndVersionSkipConfiguration(t *testing.T) {
	t.Chdir(t.TempDir())
	t.Setenv("CONFIG_FILE", "missing.yaml")
	for _, tc := range []struct {
		args []string
		want string
	}{
		{[]string{"-h"}, usage},
		{[]string{"--help"}, usage},
		{[]string{"-c", "missing.yaml", "--help"}, usage},
		{[]string{"--help", "--version"}, usage},
		{[]string{"--version"}, "harbor-console " + currentBuild().String() + "\n"},
	} {
		t.Run(strings.Join(tc.args, " "), func(t *testing.T) {
			var stdout, stderr bytes.Buffer
			if code := run(tc.args, &stdout, &stderr); code != exitOK {
				t.Fatalf("exit %d, stderr %q", code, stderr.String())
			}
			if stdout.String() != tc.want || stderr.Len() != 0 {
				t.Fatalf("stdout %q, stderr %q", stdout.String(), stderr.String())
			}
		})
	}
}

func TestRunConfigSelection(t *testing.T) {
	t.Chdir(t.TempDir())
	dir := t.TempDir()
	flagFile, envFile := filepath.Join(dir, "flag.yaml"), filepath.Join(dir, "env.yaml")
	t.Setenv("CONFIG_FILE", envFile)
	for _, tc := range []struct {
		name          string
		args          []string
		want, notWant string
	}{
		{"environment", []string{}, envFile, flagFile},
		{"flag beats environment", []string{"-c", flagFile}, flagFile, envFile},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var stdout, stderr bytes.Buffer
			if code := run(tc.args, &stdout, &stderr); code != exitFailure {
				t.Fatalf("exit %d, want %d", code, exitFailure)
			}
			got := stderr.String()
			if stdout.Len() != 0 || !strings.HasPrefix(got, "harbor-console: config: read config file: ") || !strings.Contains(got, tc.want) || strings.Contains(got, tc.notWant) || strings.Count(got, "\n") != 1 {
				t.Fatalf("stdout %q, stderr %q", stdout.String(), got)
			}
		})
	}
}

func TestRunConfigFailures(t *testing.T) {
	t.Chdir(t.TempDir())
	invalid := filepath.Join(t.TempDir(), "invalid.yaml")
	if err := os.WriteFile(invalid, []byte("server:\n  port: 70000\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct {
		name, configFile string
		args             []string
		want             string
	}{
		{"blank CONFIG_FILE", " ", nil, "harbor-console: config: CONFIG_FILE is set but empty\n"},
		{"empty CONFIG_FILE", "", nil, "harbor-console: config: CONFIG_FILE is set but empty\n"},
		{"invalid field", invalid, nil, "harbor-console: config: server.port: must be between 1 and 65535\n"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Setenv("CONFIG_FILE", tc.configFile)
			var stdout, stderr bytes.Buffer
			if code := run(tc.args, &stdout, &stderr); code != exitFailure {
				t.Fatalf("exit %d, want %d", code, exitFailure)
			}
			if stdout.Len() != 0 || stderr.String() != tc.want {
				t.Fatalf("stdout %q, stderr %q; want stderr %q", stdout.String(), stderr.String(), tc.want)
			}
		})
	}
}

func TestRunLogsFailuresAfterLoggerIsReady(t *testing.T) {
	t.Chdir(t.TempDir())
	t.Setenv("CONFIG_FILE", "")
	if err := os.Unsetenv("CONFIG_FILE"); err != nil {
		t.Fatal(err)
	}
	occupied, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer occupied.Close()
	t.Setenv("HARBOR_CONSOLE_SERVER__LISTEN", "127.0.0.1")
	t.Setenv("HARBOR_CONSOLE_SERVER__PORT", strconv.Itoa(occupied.Addr().(*net.TCPAddr).Port))
	t.Setenv("HARBOR_CONSOLE_LOGGING__FORMAT", "json")
	var stdout, stderr bytes.Buffer
	if code := run(nil, &stdout, &stderr); code != exitFailure {
		t.Fatalf("exit %d, want %d", code, exitFailure)
	}
	got := stdout.String()
	if stderr.Len() != 0 || !strings.Contains(got, `"msg":"service_starting"`) || !strings.Contains(got, `"msg":"service_failed"`) || strings.Contains(got, "service_stopped") {
		t.Fatalf("stdout %q, stderr %q", got, stderr.String())
	}
	if entries, err := os.ReadDir("."); err != nil || len(entries) != 0 {
		t.Fatalf("working directory entries %v, %v; want none", entries, err)
	}
}
