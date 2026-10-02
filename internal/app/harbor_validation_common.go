package app

import (
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"net/url"
	"strings"
	"unicode/utf8"
)

func validateAllowedFields(body map[string]any, allowed ...string) error {
	for key := range body {
		if !slicesContain(allowed, key) {
			return fmt.Errorf("请求体包含不允许的字段 %s", key)
		}
	}
	return nil
}

func validateHTTPURL(raw any, label string) error {
	value, _ := raw.(string)
	parsed, err := url.Parse(strings.TrimSpace(value))
	if err != nil || parsed.Host == "" || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		return fmt.Errorf("%s 必须是完整的 http:// 或 https:// URL", label)
	}
	if parsed.User != nil || parsed.Fragment != "" {
		return fmt.Errorf("%s 不能包含凭据或片段", label)
	}
	return nil
}

func validateResourceName(value, label string, maximum int, allowSpaces bool) error {
	value = strings.TrimSpace(value)
	if value == "" {
		return errors.New(label + "不能为空")
	}
	if exceedsCharacterLimit(value, maximum) || strings.ContainsAny(value, "\r\n\x00/") {
		return fmt.Errorf("%s 包含无效字符或超过 %d 个字符", label, maximum)
	}
	if !allowSpaces && strings.ContainsAny(value, " \t") {
		return errors.New(label + "不能包含空格")
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

func validatePositiveInteger(value any, field string) error {
	number, valid := integerNumberValue(value)
	if !valid || number <= 0 {
		return fmt.Errorf("%s 必须是正整数", field)
	}
	return nil
}
