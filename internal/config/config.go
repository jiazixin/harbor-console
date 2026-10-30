// Package config loads the service configuration from YAML and field-level
// environment overrides.
package config

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"net"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"time"

	"go.yaml.in/yaml/v3"
)

// Duration is a time.Duration decoded from Go duration strings such as "10s".
type Duration time.Duration

// UnmarshalYAML decodes a Go duration string.
func (d *Duration) UnmarshalYAML(node *yaml.Node) error {
	value, err := time.ParseDuration(strings.TrimSpace(node.Value))
	if err != nil {
		return fmt.Errorf("parse duration %q: %w", node.Value, err)
	}
	*d = Duration(value)
	return nil
}

// Config is the complete service configuration.
type Config struct {
	Server  Server  `yaml:"server"`
	Logging Logging `yaml:"logging"`
}

// Server holds the HTTP listener settings.
type Server struct {
	Listen            string   `yaml:"listen"`
	Port              int      `yaml:"port"`
	ReadHeaderTimeout Duration `yaml:"read_header_timeout"`
	ReadTimeout       Duration `yaml:"read_timeout"`
	WriteTimeout      Duration `yaml:"write_timeout"`
	IdleTimeout       Duration `yaml:"idle_timeout"`
	ShutdownTimeout   Duration `yaml:"shutdown_timeout"`
}

// Logging holds the application and access log settings.
type Logging struct {
	Level           string `yaml:"level"`
	Format          string `yaml:"format"`
	AccessLog       bool   `yaml:"access_log"`
	LogHealthChecks bool   `yaml:"log_health_checks"`
}

// Source describes where configuration comes from.
type Source struct {
	Path      string                      // selected file
	Explicit  bool                        // chosen by --config or CONFIG_FILE
	WorkDir   string                      // base for relative paths when no file is used
	LookupEnv func(string) (string, bool) // os.LookupEnv in production
}

// FieldError reports an invalid configuration field by its YAML path.
type FieldError struct {
	Field   string // e.g. "server.port"
	Message string // e.g. "must be between 1 and 65535"
}

// Error implements error.
func (e *FieldError) Error() string {
	return e.Field + ": " + e.Message
}

// Default returns the built-in configuration used when no file is present.
func Default() Config {
	return Config{
		Server: Server{
			Listen:            "127.0.0.1",
			Port:              8080,
			ReadHeaderTimeout: Duration(5 * time.Second),
			ReadTimeout:       Duration(20 * time.Second),
			WriteTimeout:      Duration(30 * time.Second),
			IdleTimeout:       Duration(90 * time.Second),
			ShutdownTimeout:   Duration(10 * time.Second),
		},
		Logging: Logging{
			Level:     "info",
			Format:    "json",
			AccessLog: true,
		},
	}
}

// Load reads src.Path over the built-in defaults, applies field environment
// overrides and validates the result. A missing file is an error only when
// src.Explicit is set; every field has a built-in default.
func Load(src Source) (Config, error) {
	cfg := Default()
	// Surrounding whitespace in a selected path is not significant.
	src.Path = strings.TrimSpace(src.Path)
	if src.Explicit && src.Path == "" {
		return Config{}, errors.New("config file path must not be empty")
	}
	if src.Path != "" {
		if err := decodeFile(&cfg, src); err != nil {
			return Config{}, err
		}
	}
	lookup := src.LookupEnv
	if lookup == nil {
		lookup = func(string) (string, bool) { return "", false }
	}
	if err := applyEnvironmentOverrides(&cfg, lookup); err != nil {
		return Config{}, err
	}
	cfg.normalize()
	if err := cfg.Validate(); err != nil {
		return Config{}, err
	}
	return cfg, nil
}

func decodeFile(cfg *Config, src Source) error {
	name := src.Path
	if !filepath.IsAbs(name) && src.WorkDir != "" {
		name = filepath.Join(src.WorkDir, name)
	}
	file, err := os.Open(name)
	if err != nil {
		if !src.Explicit && errors.Is(err, fs.ErrNotExist) {
			return nil
		}
		return fmt.Errorf("read config file: %w", err)
	}
	// Reading to EOF reports read failures; Close only releases a read-only descriptor.
	defer file.Close()
	const maxConfigBytes = 1 << 20
	content, err := io.ReadAll(io.LimitReader(file, maxConfigBytes+1))
	if err != nil {
		return fmt.Errorf("read config file: %w", err)
	}
	if len(content) > maxConfigBytes {
		return errors.New("config file exceeds 1 MiB")
	}
	if len(content) == 0 {
		return nil
	}
	decoder := yaml.NewDecoder(bytes.NewReader(content))
	decoder.KnownFields(true)
	if err := decoder.Decode(cfg); err != nil {
		return fmt.Errorf("parse config file %q: %w", src.Path, err)
	}
	var extra any
	if err := decoder.Decode(&extra); !errors.Is(err, io.EOF) {
		if err == nil {
			return fmt.Errorf("parse config file %q: only one YAML document is allowed", src.Path)
		}
		return fmt.Errorf("parse config file %q: %w", src.Path, err)
	}
	return nil
}

// envPrefix starts every environment override; nested YAML fields join their
// section and field with "__" (HARBOR_CONSOLE_SERVER__PORT).
const envPrefix = "HARBOR_CONSOLE_"

func applyEnvironmentOverrides(cfg *Config, lookup func(string) (string, bool)) error {
	if value, ok := environmentValue(lookup, "SERVER__LISTEN"); ok {
		cfg.Server.Listen = value
	}
	if value, ok := environmentValue(lookup, "SERVER__PORT"); ok {
		port, err := strconv.Atoi(value)
		if err != nil {
			return fmt.Errorf("parse environment variable %sSERVER__PORT: %w", envPrefix, err)
		}
		cfg.Server.Port = port
	}
	if value, ok := environmentValue(lookup, "LOGGING__LEVEL"); ok {
		cfg.Logging.Level = value
	}
	if value, ok := environmentValue(lookup, "LOGGING__FORMAT"); ok {
		cfg.Logging.Format = value
	}
	if err := overrideBoolean(lookup, "LOGGING__ACCESS_LOG", &cfg.Logging.AccessLog); err != nil {
		return err
	}
	if err := overrideBoolean(lookup, "LOGGING__LOG_HEALTH_CHECKS", &cfg.Logging.LogHealthChecks); err != nil {
		return err
	}
	durations := []struct {
		name   string
		target *Duration
	}{
		{name: "SERVER__READ_HEADER_TIMEOUT", target: &cfg.Server.ReadHeaderTimeout},
		{name: "SERVER__READ_TIMEOUT", target: &cfg.Server.ReadTimeout},
		{name: "SERVER__WRITE_TIMEOUT", target: &cfg.Server.WriteTimeout},
		{name: "SERVER__IDLE_TIMEOUT", target: &cfg.Server.IdleTimeout},
		{name: "SERVER__SHUTDOWN_TIMEOUT", target: &cfg.Server.ShutdownTimeout},
	}
	for _, item := range durations {
		if value, ok := environmentValue(lookup, item.name); ok {
			duration, err := time.ParseDuration(value)
			if err != nil {
				return fmt.Errorf("parse environment variable %s%s: %w", envPrefix, item.name, err)
			}
			*item.target = Duration(duration)
		}
	}
	return nil
}

func environmentValue(lookup func(string) (string, bool), key string) (string, bool) {
	value, ok := lookup(envPrefix + key)
	if !ok {
		return "", false
	}
	return strings.TrimSpace(value), true
}

func overrideBoolean(lookup func(string) (string, bool), key string, target *bool) error {
	value, ok := environmentValue(lookup, key)
	if !ok {
		return nil
	}
	parsed, err := strconv.ParseBool(value)
	if err != nil {
		return fmt.Errorf("parse environment variable %s%s: %w", envPrefix, key, err)
	}
	*target = parsed
	return nil
}

// normalize trims text fields and lowercases enumerations after decoding.
func (c *Config) normalize() {
	c.Server.Listen = strings.TrimSpace(c.Server.Listen)
	c.Logging.Level = strings.ToLower(strings.TrimSpace(c.Logging.Level))
	c.Logging.Format = strings.ToLower(strings.TrimSpace(c.Logging.Format))
}

// Validate reports the first invalid field as a *FieldError. It does not
// modify c; Load normalizes values before validating.
func (c Config) Validate() error {
	if c.Server.Port < 1 || c.Server.Port > 65535 {
		return &FieldError{Field: "server.port", Message: "must be between 1 and 65535"}
	}
	if listen := c.Server.Listen; listen != "" && net.ParseIP(listen) == nil && strings.ContainsAny(listen, ":/ \t\r\n[]") {
		return &FieldError{Field: "server.listen", Message: "must be a host name or an IP address without a port"}
	}
	durations := []struct {
		name  string
		value Duration
	}{
		{name: "server.read_header_timeout", value: c.Server.ReadHeaderTimeout},
		{name: "server.read_timeout", value: c.Server.ReadTimeout},
		{name: "server.write_timeout", value: c.Server.WriteTimeout},
		{name: "server.idle_timeout", value: c.Server.IdleTimeout},
		{name: "server.shutdown_timeout", value: c.Server.ShutdownTimeout},
	}
	for _, item := range durations {
		if time.Duration(item.value) <= 0 {
			return &FieldError{Field: item.name, Message: "must be greater than 0"}
		}
	}
	if !slices.Contains([]string{"debug", "info", "warn", "error"}, c.Logging.Level) {
		return &FieldError{Field: "logging.level", Message: "must be debug, info, warn or error"}
	}
	if !slices.Contains([]string{"json", "logfmt"}, c.Logging.Format) {
		return &FieldError{Field: "logging.format", Message: "must be json or logfmt"}
	}
	return nil
}

// Address returns the host:port the HTTP server listens on.
func (c Config) Address() string {
	return net.JoinHostPort(c.Server.Listen, strconv.Itoa(c.Server.Port))
}
