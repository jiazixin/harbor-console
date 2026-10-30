package app

import (
	"encoding/json"
	"fmt"
	"math"
	"net/url"
	"strings"
	"unicode/utf8"
)

func validateAllowedFields(body map[string]any, allowed ...string) error {
	for key := range body {
		if !slicesContain(allowed, key) {
			return invalidField(key, "unknown_field", "is not an allowed field")
		}
	}
	return nil
}

func validateHTTPURL(raw any, path string) error {
	value, _ := raw.(string)
	parsed, err := url.Parse(strings.TrimSpace(value))
	if err != nil || parsed.Host == "" || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		return invalidField(path, "invalid_url", "must be a complete http:// or https:// URL")
	}
	if parsed.User != nil || parsed.Fragment != "" {
		return invalidField(path, "url_has_credentials", "must not contain credentials or a fragment")
	}
	return nil
}

func validateResourceName(options resourceNameValidation) error {
	value, path, maximum, allowSpaces := options.value, options.path, options.maximum, options.allowSpaces
	value = strings.TrimSpace(value)
	if value == "" {
		return invalidField(path, "required", "is required")
	}
	if exceedsCharacterLimit(value, maximum) || strings.ContainsAny(value, "\r\n\x00/") {
		return invalidField(path, "invalid_text", fmt.Sprintf("contains invalid characters or exceeds %d characters", maximum))
	}
	if !allowSpaces && strings.ContainsAny(value, " \t") {
		return invalidField(path, "contains_whitespace", "must not contain spaces")
	}
	return nil
}

func exceedsCharacterLimit(value string, maximum int) bool {
	return utf8.RuneCountInString(value) > maximum
}

func numberValue(value any) int64 {
	switch typed := value.(type) {
	case float64:
		return int64(typed)
	case int:
		return int64(typed)
	case int64:
		return typed
	case json.Number:
		parsed, _ := typed.Int64()
		return parsed
	default:
		return 0
	}
}

func integerNumberValue(value any) (int64, bool) {
	switch typed := value.(type) {
	case float64:
		if math.IsNaN(typed) || math.IsInf(typed, 0) || math.Trunc(typed) != typed || typed < math.MinInt64 || typed >= math.MaxInt64 {
			return 0, false
		}
		return int64(typed), true
	case int:
		return int64(typed), true
	case int64:
		return typed, true
	case json.Number:
		parsed, err := typed.Int64()
		return parsed, err == nil
	default:
		return 0, false
	}
}

func validatePositiveInteger(value any, path string) error {
	number, valid := integerNumberValue(value)
	if !valid || number <= 0 {
		return invalidField(path, "not_positive_integer", "must be a positive integer")
	}
	return nil
}

type resourceNameValidation struct {
	value       string
	path        string
	maximum     int
	allowSpaces bool
}
