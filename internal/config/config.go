package config

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"net"
	"os"
	"path"
	"slices"
	"strconv"
	"strings"
	"time"

	"gopkg.in/yaml.v3"
)

type Duration time.Duration

func (d *Duration) UnmarshalYAML(node *yaml.Node) error {
	value, err := time.ParseDuration(strings.TrimSpace(node.Value))
	if err != nil {
		return fmt.Errorf("无效时长 %q: %w", node.Value, err)
	}
	*d = Duration(value)
	return nil
}

type Config struct {
	Server  Server  `yaml:"server"`
	Health  Health  `yaml:"health"`
	Logging Logging `yaml:"logging"`
}

type Server struct {
	Listen            string   `yaml:"listen"`
	Port              int      `yaml:"port"`
	ReadHeaderTimeout Duration `yaml:"read_header_timeout"`
	ReadTimeout       Duration `yaml:"read_timeout"`
	WriteTimeout      Duration `yaml:"write_timeout"`
	IdleTimeout       Duration `yaml:"idle_timeout"`
	ShutdownTimeout   Duration `yaml:"shutdown_timeout"`
}

type Health struct {
	URI string `yaml:"uri"`
}

type Logging struct {
	Level           string `yaml:"level"`
	Format          string `yaml:"format"`
	AccessLog       bool   `yaml:"access_log"`
	LogHealthChecks bool   `yaml:"log_health_checks"`
}

type environmentLookup func(string) (string, bool)

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
		Health: Health{URI: "/health"},
		Logging: Logging{
			Level:     "info",
			Format:    "json",
			AccessLog: true,
		},
	}
}

func Load() (Config, error) {
	configPath, explicitlyConfigured := os.LookupEnv("CONFIG_FILE")
	if !explicitlyConfigured {
		configPath = "config.yaml"
	}
	return loadRuntimeConfig(strings.TrimSpace(configPath), explicitlyConfigured, os.LookupEnv)
}

func loadRuntimeConfig(configPath string, requireFile bool, lookup environmentLookup) (Config, error) {
	config := Default()
	if requireFile && strings.TrimSpace(configPath) == "" {
		return Config{}, fmt.Errorf("环境变量 CONFIG_FILE 不能为空")
	}
	if configPath != "" {
		content, err := os.ReadFile(configPath)
		if err != nil {
			if !requireFile && errors.Is(err, os.ErrNotExist) {
				content = nil
			} else {
				return Config{}, fmt.Errorf("读取配置文件 %s: %w", configPath, err)
			}
		}
		if len(content) > 0 {
			decoder := yaml.NewDecoder(bytes.NewReader(content))
			decoder.KnownFields(true)
			if err := decoder.Decode(&config); err != nil {
				return Config{}, fmt.Errorf("解析配置文件 %s: %w", configPath, err)
			}
			var extra any
			if err := decoder.Decode(&extra); err != io.EOF {
				if err == nil {
					return Config{}, fmt.Errorf("解析配置文件 %s: 只允许一个 YAML 文档", configPath)
				}
				return Config{}, fmt.Errorf("解析配置文件 %s: %w", configPath, err)
			}
		}
	}
	if lookup == nil {
		lookup = os.LookupEnv
	}
	if err := applyEnvironmentOverrides(&config, lookup); err != nil {
		return Config{}, err
	}
	if err := config.Validate(); err != nil {
		return Config{}, err
	}
	return config, nil
}

func applyEnvironmentOverrides(config *Config, lookup environmentLookup) error {
	if value, ok := environmentValue(lookup, "LISTEN"); ok {
		config.Server.Listen = value
	}
	if value, ok := environmentValue(lookup, "PORT"); ok {
		port, err := strconv.Atoi(value)
		if err != nil {
			return fmt.Errorf("环境变量 PORT 必须是整数: %w", err)
		}
		config.Server.Port = port
	}
	if value, ok := environmentValue(lookup, "HEALTH_URI"); ok {
		config.Health.URI = value
	}
	if value, ok := environmentValue(lookup, "LOG_LEVEL"); ok {
		config.Logging.Level = value
	}
	if value, ok := environmentValue(lookup, "LOG_FORMAT"); ok {
		config.Logging.Format = value
	}
	if err := overrideBoolean(lookup, "ACCESS_LOG", &config.Logging.AccessLog); err != nil {
		return err
	}
	if err := overrideBoolean(lookup, "LOG_HEALTH_CHECKS", &config.Logging.LogHealthChecks); err != nil {
		return err
	}
	durations := []struct {
		name   string
		target *Duration
	}{
		{name: "READ_HEADER_TIMEOUT", target: &config.Server.ReadHeaderTimeout},
		{name: "READ_TIMEOUT", target: &config.Server.ReadTimeout},
		{name: "WRITE_TIMEOUT", target: &config.Server.WriteTimeout},
		{name: "IDLE_TIMEOUT", target: &config.Server.IdleTimeout},
		{name: "SHUTDOWN_TIMEOUT", target: &config.Server.ShutdownTimeout},
	}
	for _, item := range durations {
		if value, ok := environmentValue(lookup, item.name); ok {
			duration, err := time.ParseDuration(value)
			if err != nil {
				return fmt.Errorf("环境变量 %s 必须是 Go 时长，例如 10s: %w", item.name, err)
			}
			*item.target = Duration(duration)
		}
	}
	return nil
}

func environmentValue(lookup environmentLookup, key string) (string, bool) {
	value, ok := lookup(key)
	if !ok {
		return "", false
	}
	return strings.TrimSpace(value), true
}

func overrideBoolean(lookup environmentLookup, key string, target *bool) error {
	value, ok := environmentValue(lookup, key)
	if !ok {
		return nil
	}
	parsed, err := strconv.ParseBool(value)
	if err != nil {
		return fmt.Errorf("环境变量 %s 必须是 true 或 false: %w", key, err)
	}
	*target = parsed
	return nil
}

func (config *Config) Validate() error {
	config.Server.Listen = strings.TrimSpace(config.Server.Listen)
	config.Health.URI = strings.TrimSpace(config.Health.URI)
	config.Logging.Level = strings.ToLower(strings.TrimSpace(config.Logging.Level))
	config.Logging.Format = strings.ToLower(strings.TrimSpace(config.Logging.Format))

	if config.Server.Port < 1 || config.Server.Port > 65535 {
		return fmt.Errorf("server.port 必须在 1 到 65535 之间")
	}
	if listen := config.Server.Listen; listen != "" && net.ParseIP(listen) == nil && strings.ContainsAny(listen, ":/ \t\r\n[]") {
		return fmt.Errorf("server.listen 必须是主机名或不带端口的 IP 地址")
	}
	durations := []struct {
		name  string
		value Duration
	}{
		{name: "server.read_header_timeout", value: config.Server.ReadHeaderTimeout},
		{name: "server.read_timeout", value: config.Server.ReadTimeout},
		{name: "server.write_timeout", value: config.Server.WriteTimeout},
		{name: "server.idle_timeout", value: config.Server.IdleTimeout},
		{name: "server.shutdown_timeout", value: config.Server.ShutdownTimeout},
	}
	for _, item := range durations {
		if time.Duration(item.value) <= 0 {
			return fmt.Errorf("%s 必须大于 0", item.name)
		}
	}
	if config.Health.URI == "" || !strings.HasPrefix(config.Health.URI, "/") || config.Health.URI == "/" || path.Clean(config.Health.URI) != config.Health.URI || strings.ContainsAny(config.Health.URI, "?#") {
		return fmt.Errorf("health.uri 必须是规范的绝对路径，例如 /health")
	}
	if config.Health.URI == "/api" || strings.HasPrefix(config.Health.URI, "/api/") {
		return fmt.Errorf("health.uri 不能与 /api 路由冲突")
	}
	if !slices.Contains([]string{"debug", "info", "warn", "error"}, config.Logging.Level) {
		return fmt.Errorf("logging.level 必须是 debug、info、warn 或 error")
	}
	if !slices.Contains([]string{"json", "logfmt"}, config.Logging.Format) {
		return fmt.Errorf("logging.format 必须是 json 或 logfmt")
	}
	return nil
}

func (config Config) Address() string {
	return net.JoinHostPort(config.Server.Listen, strconv.Itoa(config.Server.Port))
}
