package app

import (
	"regexp"
	"strconv"
	"strings"
)

func validateProjectCreate(body map[string]any) error {
	name, _ := body["project_name"].(string)
	if err := validateResourceName(resourceNameValidation{value: name, path: "project_name", maximum: 255, allowSpaces: false}); err != nil {
		return err
	}
	if err := validateProjectFields(body, true); err != nil {
		return err
	}
	return nil
}

func validateProjectUpdate(body map[string]any) error {
	return validateProjectFields(body, false)
}

func validateProjectFields(body map[string]any, create bool) error {
	allowed := []string{"project_name", "public", "metadata", "cve_allowlist"}
	if create {
		allowed = append(allowed, "storage_limit", "registry_id")
	}
	if err := validateAllowedFields(body, allowed...); err != nil {
		return err
	}
	if public, exists := body["public"]; exists && public != nil {
		if _, ok := public.(bool); !ok {
			return invalidField("public", "not_boolean_or_null", "must be a boolean or null")
		}
	}
	if metadata, exists := body["metadata"]; exists {
		values, ok := metadata.(map[string]any)
		if !ok {
			return invalidField("metadata", "not_object", "must be a JSON object")
		}
		if err := validateProjectMetadata(values); err != nil {
			return nestField("metadata", err)
		}
	}
	if allowlist, exists := body["cve_allowlist"]; exists {
		values, ok := allowlist.(map[string]any)
		if !ok {
			return invalidField("cve_allowlist", "not_object", "must be a JSON object")
		}
		if err := validateCVEAllowlist(values); err != nil {
			return nestField("cve_allowlist", err)
		}
	}
	if storage, exists := body["storage_limit"]; create && exists && storage != nil {
		value, ok := integerNumberValue(storage)
		if !ok || value < -1 {
			return invalidField("storage_limit", "invalid_storage_limit", "must be -1, 0 or a positive integer")
		}
	}
	if registry, exists := body["registry_id"]; create && exists && registry != nil {
		value, ok := integerNumberValue(registry)
		if !ok || value < 0 {
			return invalidField("registry_id", "not_non_negative_integer", "must be 0 or a positive integer")
		}
	}
	return nil
}

func validateProjectMetadata(metadata map[string]any) error {
	allowed := []string{
		"public", "enable_content_trust", "enable_content_trust_cosign", "prevent_vul", "severity", "auto_scan",
		"auto_sbom_generation", "reuse_sys_cve_allowlist", "retention_id", "proxy_speed_kb", "max_upstream_conn",
		"proxy_cache_local_on_not_found", "proxy_referrer_api",
	}
	known := make(map[string]struct{}, len(allowed))
	for _, field := range allowed {
		known[field] = struct{}{}
	}
	for field, value := range metadata {
		if _, ok := known[field]; ok {
			continue
		}
		if len(field) == 0 || len(field) > 255 || !regexp.MustCompile(`^[A-Za-z0-9_.-]+$`).MatchString(field) {
			return invalidField(field, "invalid_key", "is not a valid metadata key")
		}
		text, ok := value.(string)
		if !ok || len(text) > 65535 || strings.ContainsRune(text, '\x00') {
			return invalidField(field, "invalid_text", "must be a string of limited length")
		}
	}
	booleanFields := []string{
		"public", "enable_content_trust", "enable_content_trust_cosign", "prevent_vul", "auto_scan",
		"auto_sbom_generation", "reuse_sys_cve_allowlist", "proxy_cache_local_on_not_found", "proxy_referrer_api",
	}
	for _, field := range booleanFields {
		if raw, exists := metadata[field]; exists && raw != nil {
			value, ok := raw.(string)
			if !ok || (value != "true" && value != "false") {
				return invalidField(field, "not_boolean_string", `must be the string "true" or "false"`)
			}
		}
	}
	if raw, exists := metadata["severity"]; exists && raw != nil {
		value, ok := raw.(string)
		if !ok || !slicesContain([]string{"none", "low", "medium", "high", "critical"}, value) {
			return invalidField("severity", "invalid_value", "must be none, low, medium, high or critical")
		}
	}
	for _, field := range []string{"retention_id", "proxy_speed_kb", "max_upstream_conn"} {
		if raw, exists := metadata[field]; exists && raw != nil {
			value, ok := raw.(string)
			if !ok || len(value) > 32 || strings.ContainsAny(value, "\r\n\x00") {
				return invalidField(field, "invalid_text", "must be a single-line string of at most 32 characters")
			}
			if field == "proxy_speed_kb" || field == "max_upstream_conn" {
				parsed, err := strconv.ParseInt(value, 10, 64)
				if err != nil || parsed == 0 || parsed < -1 {
					return invalidField(field, "not_minus_one_or_positive", "must be -1 or a positive integer")
				}
			}
		}
	}
	return nil
}

func validateProjectMetadataWrite(body map[string]any) error {
	if err := validateAllowedFields(body, "key", "value"); err != nil {
		return err
	}
	value, ok := body["value"].(string)
	if !ok || len(value) > 4096 {
		return invalidField("value", "invalid_text", "must be a string of at most 4096 characters")
	}
	return nil
}

func validateProjectScanner(body map[string]any) error {
	uuid, ok := body["uuid"].(string)
	if !ok || !validUUID(uuid) {
		return invalidField("uuid", "invalid_uuid", "must be a valid UUID")
	}
	return nil
}

func validUUID(value string) bool {
	if len(value) != 36 {
		return false
	}
	for index, character := range value {
		if index == 8 || index == 13 || index == 18 || index == 23 {
			if character != '-' {
				return false
			}
			continue
		}
		if !((character >= '0' && character <= '9') || (character >= 'a' && character <= 'f') || (character >= 'A' && character <= 'F')) {
			return false
		}
	}
	return true
}
