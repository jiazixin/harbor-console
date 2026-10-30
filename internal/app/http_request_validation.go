package app

import (
	"net"
	"net/http"
	"net/url"
	"strings"
)

func validateHarborURL(raw string) (string, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", invalidField("url", "required", "is required")
	}
	parsed, err := url.Parse(raw)
	if err != nil || parsed.Host == "" {
		return "", invalidField("url", "invalid_url", "must be a complete http:// or https:// URL")
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return "", invalidField("url", "invalid_url", "must use http or https")
	}
	if parsed.User != nil {
		return "", invalidField("url", "url_has_credentials", "must not contain credentials")
	}
	if parsed.RawQuery != "" || parsed.Fragment != "" {
		return "", invalidField("url", "url_has_query", "must not contain a query or fragment")
	}
	// Harbor Console joins this value with official API paths. A path prefix
	// would make every request target a different reverse-proxy namespace and
	// can silently turn a valid-looking URL into a broken connection.
	if parsed.Path != "" && parsed.Path != "/" {
		return "", invalidField("url", "url_has_path", "must be the instance root without a path")
	}
	if parsed.RawPath != "" && parsed.RawPath != "/" {
		return "", invalidField("url", "url_has_path", "must be the instance root without a path")
	}
	parsed.Path = ""
	parsed.RawPath = ""
	return parsed.String(), nil
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
