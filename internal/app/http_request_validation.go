package app

import (
	"errors"
	"net"
	"net/http"
	"net/url"
	"strings"
)

func validateHarborURL(raw string) (string, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", errors.New("请输入 Harbor 实例地址")
	}
	parsed, err := url.Parse(raw)
	if err != nil || parsed.Host == "" {
		return "", errors.New("地址必须是完整的 http:// 或 https:// URL")
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return "", errors.New("仅支持 http 和 https 协议")
	}
	if parsed.User != nil {
		return "", errors.New("请在独立字段中输入用户名和密码")
	}
	if parsed.RawQuery != "" || parsed.Fragment != "" {
		return "", errors.New("地址不能包含查询参数或片段")
	}
	// Harbor Console joins this value with official API paths. A path prefix
	// would make every request target a different reverse-proxy namespace and
	// can silently turn a valid-looking URL into a broken connection.
	if parsed.Path != "" && parsed.Path != "/" {
		return "", errors.New("Harbor 地址必须是实例根地址，不能包含路径前缀")
	}
	if parsed.RawPath != "" && parsed.RawPath != "/" {
		return "", errors.New("Harbor 地址必须是实例根地址，不能包含路径前缀")
	}
	parsed.Path = ""
	parsed.RawPath = ""
	return parsed.String(), nil
}

func sameOrigin(r *http.Request) bool {
	origin := r.Header.Get("Origin")
	if origin == "" {
		return true
	}
	parsed, err := url.Parse(origin)
	if err != nil {
		return false
	}
	expectedScheme := "http"
	if requestIsTLS(r) {
		expectedScheme = "https"
	}
	return strings.EqualFold(parsed.Scheme, expectedScheme) && strings.EqualFold(parsed.Host, r.Host)
}

func clientIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err == nil && host != "" {
		return host
	}
	if r.RemoteAddr != "" {
		return r.RemoteAddr
	}
	return "unknown"
}

func requestIsTLS(r *http.Request) bool {
	return r.TLS != nil || strings.EqualFold(r.Header.Get("X-Forwarded-Proto"), "https")
}

func slicesContain(values []string, target string) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}
	return false
}
