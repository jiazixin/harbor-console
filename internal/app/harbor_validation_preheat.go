package app

import (
	"encoding/json"
	"fmt"
	"strings"
)

func validatePreheatInstance(body map[string]any) error {
	if err := validateAllowedFields(body, "id", "name", "description", "vendor", "endpoint", "auth_mode", "auth_info", "status", "enabled", "default", "insecure", "setup_timestamp"); err != nil {
		return err
	}
	name, _ := body["name"].(string)
	if err := validateResourceName(resourceNameValidation{value: name, path: "name", maximum: 255, allowSpaces: true}); err != nil {
		return err
	}
	if !validPreheatName(name) {
		return invalidField("name", "invalid_preheat_name", "may contain only letters and digits separated by single dots, underscores or hyphens")
	}
	vendor, _ := body["vendor"].(string)
	if err := validateResourceName(resourceNameValidation{value: vendor, path: "vendor", maximum: 255, allowSpaces: false}); err != nil {
		return err
	}
	if err := validateHTTPURL(body["endpoint"], "endpoint"); err != nil {
		return err
	}
	if description, ok := body["description"].(string); ok && (len(description) > 1024 || strings.ContainsAny(description, "\x00")) {
		return invalidField("description", "too_long", "must not exceed 1024 characters")
	}
	if authMode, ok := body["auth_mode"].(string); ok && (strings.TrimSpace(authMode) == "" || len(authMode) > 64 || strings.ContainsAny(authMode, "\r\n\x00")) {
		return invalidField("auth_mode", "invalid_text", "must be non-empty single-line text of at most 64 characters")
	}
	if authInfo, ok := body["auth_info"]; ok {
		credentials, objectOK := authInfo.(map[string]any)
		if !objectOK {
			return invalidField("auth_info", "not_object", "must be a JSON object")
		}
		for key, raw := range credentials {
			value, valueOK := raw.(string)
			if !valueOK || len(key) > 128 || len(value) > 4096 || strings.ContainsAny(key+value, "\x00") {
				return invalidField("auth_info."+key, "invalid_text", "must be text of limited length")
			}
		}
	}
	for _, field := range []string{"enabled", "default", "insecure"} {
		if raw, ok := body[field]; ok {
			if _, boolean := raw.(bool); !boolean {
				return invalidField(field, "not_boolean", "must be a boolean")
			}
		}
	}
	return nil
}

func validatePreheatInstancePing(body map[string]any) error {
	if id, exists := body["id"]; exists {
		if err := validatePositiveInteger(id, "id"); err != nil {
			return err
		}
		return validateAllowedFields(body, "id")
	}
	return validatePreheatInstance(body)
}

func validatePreheatPolicy(body map[string]any) error {
	if err := validateAllowedFields(body, "id", "name", "description", "project_id", "provider_id", "filters", "trigger", "enabled", "extra_attrs", "creation_time", "update_time"); err != nil {
		return err
	}
	name, _ := body["name"].(string)
	if err := validateResourceName(resourceNameValidation{value: name, path: "name", maximum: 255, allowSpaces: true}); err != nil {
		return err
	}
	if !validPreheatName(name) {
		return invalidField("name", "invalid_preheat_name", "may contain only letters and digits separated by single dots, underscores or hyphens")
	}
	for _, field := range []string{"id", "project_id"} {
		if raw, exists := body[field]; exists {
			if err := validatePositiveInteger(raw, field); err != nil {
				return err
			}
		}
	}
	if err := validatePositiveInteger(body["provider_id"], "provider_id"); err != nil {
		return err
	}
	for _, field := range []string{"description", "filters", "trigger", "extra_attrs"} {
		if raw, ok := body[field]; ok {
			value, text := raw.(string)
			if !text || len(value) > 65536 || strings.ContainsAny(value, "\x00") {
				return invalidField(field, "too_long", "must be text of at most 65536 characters")
			}
		}
	}
	filtersText, _ := body["filters"].(string)
	var filters []map[string]any
	if strings.TrimSpace(filtersText) == "" || json.Unmarshal([]byte(filtersText), &filters) != nil || len(filters) == 0 {
		return invalidField("filters", "invalid_json", "must be a non-empty JSON array")
	}
	for index, filter := range filters {
		filterType, _ := filter["type"].(string)
		if !slicesContain([]string{"repository", "tag", "label", "signature", "vulnerability"}, filterType) {
			return invalidField(fmt.Sprintf("filters.%d.type", index), "not_supported", "is not a supported filter type")
		}
		if _, exists := filter["value"]; !exists {
			return invalidField(fmt.Sprintf("filters.%d.value", index), "required", "is required")
		}
	}
	triggerText, _ := body["trigger"].(string)
	var trigger struct {
		Type    string `json:"type"`
		Setting struct {
			Cron string `json:"cron"`
		} `json:"trigger_setting"`
	}
	if json.Unmarshal([]byte(triggerText), &trigger) != nil || !slicesContain([]string{"manual", "scheduled", "event_based", "scheduled(paused)"}, trigger.Type) {
		return invalidField("trigger", "invalid_value", "must contain a valid Harbor trigger type")
	}
	if trigger.Type == "scheduled" && strings.TrimSpace(trigger.Setting.Cron) == "" {
		return invalidField("trigger.trigger_setting.cron", "required", "is required for scheduled policies")
	}
	if extraText, ok := body["extra_attrs"].(string); ok && strings.TrimSpace(extraText) != "" {
		var extra map[string]any
		if json.Unmarshal([]byte(extraText), &extra) != nil {
			return invalidField("extra_attrs", "invalid_json", "must contain a JSON object")
		}
	}
	if raw, ok := body["enabled"]; ok {
		if _, boolean := raw.(bool); !boolean {
			return invalidField("enabled", "not_boolean", "must be a boolean")
		}
	}
	return nil
}

func validatePreheatExecutionStop(body map[string]any) error {
	if err := validateAllowedFields(body, "status"); err != nil {
		return err
	}
	status, _ := body["status"].(string)
	if !strings.EqualFold(status, "Stopped") {
		return invalidField("status", "invalid_value", "must be Stopped")
	}
	return nil
}

func validPreheatName(value string) bool {
	for index, character := range value {
		alphaNumeric := (character >= 'a' && character <= 'z') || (character >= 'A' && character <= 'Z') || (character >= '0' && character <= '9')
		if alphaNumeric {
			continue
		}
		if character != '.' && character != '_' && character != '-' {
			return false
		}
		if index == 0 || index == len(value)-1 {
			return false
		}
		previous := value[index-1]
		if previous == '.' || previous == '_' || previous == '-' {
			return false
		}
	}
	return value != ""
}
