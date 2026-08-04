package app

import (
	"errors"
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

func validateProjectCreate(body map[string]any) error {
	name, _ := body["project_name"].(string)
	if err := validateResourceName(name, "项目名称", 255, false); err != nil {
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
			return errors.New("public 必须是布尔值或 null")
		}
	}
	if metadata, exists := body["metadata"]; exists {
		values, ok := metadata.(map[string]any)
		if !ok {
			return errors.New("metadata 必须是 JSON 对象")
		}
		if err := validateProjectMetadata(values); err != nil {
			return err
		}
	}
	if allowlist, exists := body["cve_allowlist"]; exists {
		values, ok := allowlist.(map[string]any)
		if !ok {
			return errors.New("cve_allowlist 必须是 JSON 对象")
		}
		if err := validateCVEAllowlist(values); err != nil {
			return err
		}
	}
	if storage, exists := body["storage_limit"]; create && exists && storage != nil {
		value, ok := integerNumberValue(storage)
		if !ok || value < -1 {
			return errors.New("storage_limit 必须为 -1、0 或正整数")
		}
	}
	if registry, exists := body["registry_id"]; create && exists && registry != nil {
		value, ok := integerNumberValue(registry)
		if !ok || value < 0 {
			return errors.New("registry_id 必须是 0 或正整数")
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
			return fmt.Errorf("项目 metadata.%s 名称无效", field)
		}
		text, ok := value.(string)
		if !ok || len(text) > 65535 || strings.ContainsRune(text, '\x00') {
			return fmt.Errorf("项目 metadata.%s 必须是长度受限的字符串", field)
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
				return fmt.Errorf("项目 metadata.%s 必须是字符串 true 或 false", field)
			}
		}
	}
	if raw, exists := metadata["severity"]; exists && raw != nil {
		value, ok := raw.(string)
		if !ok || !slicesContain([]string{"none", "low", "medium", "high", "critical"}, value) {
			return errors.New("项目 metadata.severity 必须是 none、low、medium、high 或 critical")
		}
	}
	for _, field := range []string{"retention_id", "proxy_speed_kb", "max_upstream_conn"} {
		if raw, exists := metadata[field]; exists && raw != nil {
			value, ok := raw.(string)
			if !ok || len(value) > 32 || strings.ContainsAny(value, "\r\n\x00") {
				return fmt.Errorf("项目 metadata.%s 必须是 32 个字符以内的单行字符串", field)
			}
			if field == "proxy_speed_kb" || field == "max_upstream_conn" {
				parsed, err := strconv.ParseInt(value, 10, 64)
				if err != nil || parsed == 0 || parsed < -1 {
					return fmt.Errorf("项目 metadata.%s 必须是 -1 或正整数", field)
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
		return errors.New("metadata value 必须是不超过 4096 字符的字符串")
	}
	return nil
}

func validateProjectScanner(body map[string]any) error {
	uuid, ok := body["uuid"].(string)
	if !ok || !validUUID(uuid) {
		return errors.New("扫描器 uuid 必须是有效的 UUID")
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
