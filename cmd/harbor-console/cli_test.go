package main

import (
	"bytes"
	"fmt"
	"path/filepath"
	"strings"
	"testing"

	"harbor-console/internal/buildinfo"
)

func TestParseArgs(t *testing.T) {
	tests := []struct {
		args []string
		want cliOptions
	}{
		{nil, cliOptions{}},
		{[]string{"-c", "custom.yaml"}, cliOptions{ConfigPath: "custom.yaml"}},
		{[]string{"--config", "custom.yaml"}, cliOptions{ConfigPath: "custom.yaml"}},
		{[]string{"-c=custom.yaml"}, cliOptions{ConfigPath: "custom.yaml"}},
		{[]string{"--config=custom.yaml"}, cliOptions{ConfigPath: "custom.yaml"}},
		{[]string{"-c", "custom.yaml", "--config", "custom.yaml"}, cliOptions{ConfigPath: "custom.yaml"}},
		{[]string{"-h"}, cliOptions{Help: true}},
		{[]string{"--help"}, cliOptions{Help: true}},
		{[]string{"--version"}, cliOptions{Version: true}},
	}
	for _, test := range tests {
		t.Run(fmt.Sprint(test.args), func(t *testing.T) {
			got, err := parseArgs(test.args)
			if err != nil || got != test.want {
				t.Fatalf("parseArgs(%q) = %#v, %v; want %#v", test.args, got, err, test.want)
			}
		})
	}
}

func TestRunRejectsInvalidArguments(t *testing.T) {
	for _, args := range [][]string{
		{"-c"}, {"--config"}, {"-c", ""}, {"--config="}, {"--config", "   "},
		{"-c", "a.yaml", "--config", "b.yaml"}, {"-c=a.yaml", "-c=b.yaml"},
		{"--unknown"}, {"config.yaml"}, {"--", "config.yaml"},
	} {
		t.Run(fmt.Sprint(args), func(t *testing.T) {
			var stdout, stderr bytes.Buffer
			if code := run(args, &stdout, &stderr); code != 2 || stdout.Len() != 0 || stderr.Len() == 0 {
				t.Fatalf("run(%q): code=%d stdout=%q stderr=%q", args, code, stdout.String(), stderr.String())
			}
		})
	}
}

func TestInformationalCommandsSkipConfiguration(t *testing.T) {
	t.Chdir(t.TempDir())
	t.Setenv("CONFIG_FILE", "missing.yaml")
	t.Setenv("PORT", "invalid")
	for _, flag := range []string{"-h", "--help", "--version"} {
		t.Run(flag, func(t *testing.T) {
			var stdout, stderr bytes.Buffer
			code := run([]string{flag}, &stdout, &stderr)
			if code != 0 || stderr.Len() != 0 {
				t.Fatalf("code=%d stderr=%q", code, stderr.String())
			}
			if flag == "--version" {
				want := fmt.Sprintf("harbor-console %s (commit: %s, built: %s)\n", buildinfo.Version, buildinfo.Commit, buildinfo.BuildDate)
				if stdout.String() != want {
					t.Fatalf("version=%q, want %q", stdout.String(), want)
				}
			} else if !strings.Contains(stdout.String(), "用法：harbor-console") {
				t.Fatalf("missing usage: %q", stdout.String())
			}
		})
	}
}

func TestRunUsesExplicitConfigBeforeEnvironment(t *testing.T) {
	t.Setenv("CONFIG_FILE", "environment-missing.yaml")
	path := filepath.Join(t.TempDir(), "cli-missing.yaml")
	for _, flag := range []string{"-c", "--config"} {
		var stdout, stderr bytes.Buffer
		code := run([]string{flag, path}, &stdout, &stderr)
		if code != 1 || stdout.Len() != 0 || !strings.Contains(stderr.String(), path) || strings.Contains(stderr.String(), "environment-missing.yaml") {
			t.Fatalf("code=%d stdout=%q stderr=%q", code, stdout.String(), stderr.String())
		}
	}
}
