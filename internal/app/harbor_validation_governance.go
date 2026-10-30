package app

import (
	"encoding/json"
	"fmt"
	"net/url"
	"strings"
)

func validateImmutableRule(body map[string]any) error {
	tags, ok := body["tag_selectors"].([]any)
	if !ok || len(tags) == 0 {
		return invalidField("tag_selectors", "required", "must contain at least one selector")
	}
	scopes, ok := body["scope_selectors"].(map[string]any)
	if !ok {
		return invalidField("scope_selectors", "not_object", "must be a JSON object")
	}
	repositories, ok := scopes["repository"].([]any)
	if !ok || len(repositories) == 0 {
		return invalidField("scope_selectors.repository", "required", "must contain at least one selector")
	}
	if err := validateImmutableSelectors(tags, "tag_selectors"); err != nil {
		return err
	}
	if err := validateImmutableSelectors(repositories, "scope_selectors.repository"); err != nil {
		return err
	}
	return nil
}

func validateImmutableSelectors(selectors []any, path string) error {
	for index, rawSelector := range selectors {
		selectorPath := fmt.Sprintf("%s.%d", path, index)
		selector, ok := rawSelector.(map[string]any)
		if !ok {
			return invalidField(selectorPath, "not_object", "must be a JSON object")
		}
		pattern, _ := selector["pattern"].(string)
		if strings.TrimSpace(pattern) == "" || len(pattern) > 1024 || strings.ContainsAny(pattern, "\r\n\x00") {
			return invalidField(selectorPath+".pattern", "invalid_text", "must be non-empty single-line text of at most 1024 characters")
		}
	}
	return nil
}

func validateWebhook(body map[string]any) error {
	name, _ := body["name"].(string)
	if err := validateResourceName(resourceNameValidation{value: name, path: "name", maximum: 255, allowSpaces: true}); err != nil {
		return err
	}
	targets, ok := body["targets"].([]any)
	if !ok || len(targets) == 0 {
		return invalidField("targets", "required", "must contain at least one target")
	}
	if len(targets) > 10 {
		return invalidField("targets", "invalid_count", "must contain at most 10 targets")
	}
	for index, rawTarget := range targets {
		target, ok := rawTarget.(map[string]any)
		if !ok {
			return invalidField(fmt.Sprintf("targets.%d", index), "not_object", "must be a JSON object")
		}
		address, _ := target["address"].(string)
		parsed, err := url.Parse(strings.TrimSpace(address))
		if err != nil || parsed.Host == "" || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.User != nil {
			return invalidField(fmt.Sprintf("targets.%d.address", index), "invalid_url", "must be a complete http:// or https:// URL without credentials")
		}
		if authHeader, ok := target["auth_header"].(string); ok && (len(authHeader) > 4096 || strings.ContainsAny(authHeader, "\r\n\x00")) {
			return invalidField(fmt.Sprintf("targets.%d.auth_header", index), "invalid_text", "contains invalid characters or is too long")
		}
	}
	events, ok := body["event_types"].([]any)
	if !ok || len(events) == 0 {
		return invalidField("event_types", "required", "must contain at least one event type")
	}
	if len(events) > 100 {
		return invalidField("event_types", "invalid_count", "must contain at most 100 event types")
	}
	return nil
}

func validateRetentionPolicy(body map[string]any) error {
	algorithm, _ := body["algorithm"].(string)
	if algorithm != "or" && algorithm != "and" {
		return invalidField("algorithm", "invalid_value", "must be or or and")
	}
	rules, ok := body["rules"].([]any)
	if !ok || len(rules) == 0 || len(rules) > 100 {
		return invalidField("rules", "invalid_count", "must contain 1 to 100 rules")
	}
	for index, rawRule := range rules {
		rule, ok := rawRule.(map[string]any)
		if !ok {
			return invalidField(fmt.Sprintf("rules.%d", index), "not_object", "must be a JSON object")
		}
		if err := validateRetentionRule(rule); err != nil {
			return nestField(fmt.Sprintf("rules.%d", index), err)
		}
	}

	trigger, ok := body["trigger"].(map[string]any)
	if !ok || stringValue(trigger["kind"]) != "Schedule" {
		return invalidField("trigger.kind", "invalid_value", "must be Schedule")
	}
	settings, ok := trigger["settings"].(map[string]any)
	if !ok {
		return invalidField("trigger.settings", "not_object", "must be a JSON object")
	}
	if cron, exists := settings["cron"]; exists {
		value, valid := cron.(string)
		if !valid || len(value) > 255 || strings.ContainsAny(value, "\r\n\x00") {
			return invalidField("trigger.settings.cron", "invalid_cron", "must be a single-line cron expression of at most 255 characters")
		}
	}

	scope, ok := body["scope"].(map[string]any)
	if !ok || stringValue(scope["level"]) != "project" {
		return invalidField("scope.level", "invalid_value", "must be project")
	}
	if err := validatePositiveInteger(scope["ref"], "scope.ref"); err != nil {
		return err
	}
	return nil
}

func validateRetentionRule(rule map[string]any) error {
	if disabled, exists := rule["disabled"]; exists {
		if _, ok := disabled.(bool); !ok {
			return invalidField("disabled", "not_boolean", "must be a boolean")
		}
	}
	if action, _ := rule["action"].(string); action != "retain" {
		return invalidField("action", "invalid_value", "must be retain")
	}
	template, _ := rule["template"].(string)
	if strings.TrimSpace(template) == "" || len(template) > 255 || strings.ContainsAny(template, "\r\n\x00") {
		return invalidField("template", "invalid_text", "must be non-empty single-line text of at most 255 characters")
	}
	if params, ok := rule["params"].(map[string]any); !ok || len(params) > 32 {
		return invalidField("params", "invalid_count", "must be a JSON object with at most 32 entries")
	}
	tags, ok := rule["tag_selectors"].([]any)
	if !ok || len(tags) == 0 || len(tags) > 32 {
		return invalidField("tag_selectors", "invalid_count", "must contain 1 to 32 selectors")
	}
	scopes, ok := rule["scope_selectors"].(map[string]any)
	if !ok {
		return invalidField("scope_selectors", "not_object", "must be a JSON object")
	}
	repositories, ok := scopes["repository"].([]any)
	if !ok || len(repositories) == 0 || len(repositories) > 32 {
		return invalidField("scope_selectors.repository", "invalid_count", "must contain 1 to 32 selectors")
	}
	if err := validateRetentionSelectors(tags, "tag_selectors", []string{"matches", "excludes"}); err != nil {
		return err
	}
	return validateRetentionSelectors(repositories, "scope_selectors.repository", []string{"repoMatches", "repoExcludes"})
}

func validateRetentionSelectors(selectors []any, path string, decorations []string) error {
	for index, rawSelector := range selectors {
		selectorPath := fmt.Sprintf("%s.%d", path, index)
		selector, ok := rawSelector.(map[string]any)
		if !ok {
			return invalidField(selectorPath, "not_object", "must be a JSON object")
		}
		if stringValue(selector["kind"]) != "doublestar" {
			return invalidField(selectorPath+".kind", "invalid_value", "must be doublestar")
		}
		if !slicesContain(decorations, stringValue(selector["decoration"])) {
			return invalidField(selectorPath+".decoration", "not_supported", "is not supported by the Harbor API")
		}
		pattern, _ := selector["pattern"].(string)
		if strings.TrimSpace(pattern) == "" || len(pattern) > 1024 || strings.ContainsAny(pattern, "\r\n\x00") {
			return invalidField(selectorPath+".pattern", "invalid_text", "must be non-empty single-line text of at most 1024 characters")
		}
		if extras, exists := selector["extras"]; exists {
			value, ok := extras.(string)
			if !ok || len(value) > 4096 || strings.ContainsAny(value, "\r\n\x00") {
				return invalidField(selectorPath+".extras", "invalid_text", "must be a JSON string of at most 4096 characters")
			}
			values := map[string]any{}
			if err := json.Unmarshal([]byte(value), &values); err != nil {
				return invalidField(selectorPath+".extras", "invalid_json", "must contain a valid JSON object")
			}
			if untagged, exists := values["untagged"]; exists {
				if _, ok := untagged.(bool); !ok {
					return invalidField(selectorPath+".extras.untagged", "not_boolean", "must be a boolean")
				}
			}
		}
	}
	return nil
}

func validateRetentionExecution(body map[string]any) error {
	if len(body) != 1 {
		return invalidField("dry_run", "only_field", "must be the only field")
	}
	if _, ok := body["dry_run"].(bool); !ok {
		return invalidField("dry_run", "not_boolean", "must be a boolean")
	}
	return nil
}

func validateRetentionExecutionAction(body map[string]any) error {
	if len(body) != 1 || stringValue(body["action"]) != "stop" {
		return invalidField("action", "invalid_value", "must be stop and the only field")
	}
	return nil
}

func validateSchedule(body map[string]any) error {
	schedule, ok := body["schedule"].(map[string]any)
	if !ok {
		return invalidField("schedule", "not_object", "must be a JSON object")
	}
	typeName, _ := schedule["type"].(string)
	allowed := map[string]bool{"Hourly": true, "Daily": true, "Weekly": true, "Custom": true, "Manual": true, "None": true, "Schedule": true}
	if !allowed[typeName] {
		return invalidField("schedule.type", "not_supported", "is not supported by the Harbor API")
	}
	if typeName == "Custom" || typeName == "Schedule" {
		cron, _ := schedule["cron"].(string)
		if strings.TrimSpace(cron) == "" || len(cron) > 255 || strings.ContainsAny(cron, "\r\n\x00") {
			return invalidField("schedule.cron", "invalid_cron", "must be a valid cron expression")
		}
	}
	return nil
}
