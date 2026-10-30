package main

import (
	"strings"
	"testing"
)

func TestParseArgs(t *testing.T) {
	for _, tc := range []struct {
		args []string
		want options
	}{
		{nil, options{}},
		{[]string{"-c", "a.yaml"}, options{configFile: "a.yaml"}},
		{[]string{"--config", "a.yaml"}, options{configFile: "a.yaml"}},
		{[]string{"-c=a.yaml"}, options{configFile: "a.yaml"}},
		{[]string{"--config=a.yaml"}, options{configFile: "a.yaml"}},
		{[]string{"-c", "a.yaml", "--config", "a.yaml"}, options{configFile: "a.yaml"}},
		{[]string{"-h"}, options{help: true}},
		{[]string{"--help"}, options{help: true}},
		{[]string{"--version"}, options{version: true}},
	} {
		t.Run(strings.Join(tc.args, " "), func(t *testing.T) {
			got, err := parseArgs(tc.args)
			if err != nil || got != tc.want {
				t.Fatalf("got %+v, %v; want %+v", got, err, tc.want)
			}
		})
	}
}

func TestParseArgsErrors(t *testing.T) {
	for _, tc := range []struct {
		args []string
		want string
	}{
		{[]string{"-c"}, "flag needs an argument"},
		{[]string{"--config="}, "must not be empty"},
		{[]string{"-c", " "}, "must not be empty"},
		{[]string{"-c", "a.yaml", "--config", "b.yaml"}, `different files given for -c/--config: "a.yaml" and "b.yaml"`},
		{[]string{"-c", "a.yaml", "-c", "b.yaml"}, `different files given for -c/--config: "a.yaml" and "b.yaml"`},
		{[]string{"--bogus"}, "not defined: -bogus"},
		{[]string{"-v"}, "not defined: -v"},
		{[]string{"config.yaml"}, `unexpected argument "config.yaml"`},
		{[]string{"--", "config.yaml"}, `unexpected argument "config.yaml"`},
	} {
		t.Run(strings.Join(tc.args, " "), func(t *testing.T) {
			_, err := parseArgs(tc.args)
			if err == nil || !strings.Contains(err.Error(), tc.want) {
				t.Fatalf("got %v, want %q", err, tc.want)
			}
		})
	}
}

func TestConfigPath(t *testing.T) {
	environment := func(values map[string]string) func(string) (string, bool) {
		return func(key string) (string, bool) {
			value, ok := values[key]
			return value, ok
		}
	}
	for _, tc := range []struct {
		name         string
		configFile   string
		env          map[string]string
		wantPath     string
		wantExplicit bool
		wantErr      string
	}{
		{name: "default", wantPath: "configs/config.local.yaml"},
		{name: "environment", env: map[string]string{"CONFIG_FILE": "env.yaml"}, wantPath: "env.yaml", wantExplicit: true},
		{name: "flag beats environment", configFile: "flag.yaml", env: map[string]string{"CONFIG_FILE": "env.yaml"}, wantPath: "flag.yaml", wantExplicit: true},
		{name: "flag beats empty environment", configFile: "flag.yaml", env: map[string]string{"CONFIG_FILE": ""}, wantPath: "flag.yaml", wantExplicit: true},
		{name: "empty environment", env: map[string]string{"CONFIG_FILE": ""}, wantErr: "CONFIG_FILE is set but empty"},
		{name: "blank environment", env: map[string]string{"CONFIG_FILE": " \t"}, wantErr: "CONFIG_FILE is set but empty"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			path, explicit, err := options{configFile: tc.configFile}.configPath(environment(tc.env))
			gotErr := ""
			if err != nil {
				gotErr = err.Error()
			}
			if path != tc.wantPath || explicit != tc.wantExplicit || gotErr != tc.wantErr {
				t.Fatalf("got %q, %v, %q; want %q, %v, %q", path, explicit, gotErr, tc.wantPath, tc.wantExplicit, tc.wantErr)
			}
		})
	}
}
