package app

import (
	"fmt"
	"math"
	"net/url"
	"regexp"
	"strconv"
	"strings"
)

var replicationNamespacePattern = regexp.MustCompile(`^[a-z0-9]+(?:[/._-][a-z0-9]+)*$`)

func validateReplicationPolicy(body map[string]any) error {
	if err := validateAllowedFields(body,
		"name", "description", "src_registry", "dest_registry", "dest_namespace", "dest_namespace_replace_count",
		"trigger", "filters", "replicate_deletion", "override", "enabled", "speed", "copy_by_chunk", "single_active_replication",
	); err != nil {
		return err
	}
	name, _ := body["name"].(string)
	if err := validateResourceName(resourceNameValidation{value: name, path: "name", maximum: 255, allowSpaces: true}); err != nil {
		return err
	}
	if raw, exists := body["description"]; exists {
		description, ok := raw.(string)
		if !ok || exceedsCharacterLimit(description, 1024) || strings.ContainsRune(description, '\x00') {
			return invalidField("description", "too_long", "must be text of at most 1024 characters")
		}
	}

	sourceID, sourceSet, err := replicationRegistryID(body["src_registry"], "src_registry")
	if err != nil {
		return err
	}
	destinationID, destinationSet, err := replicationRegistryID(body["dest_registry"], "dest_registry")
	if err != nil {
		return err
	}
	if sourceSet == destinationSet {
		return invalidField("src_registry", "exactly_one_of", "exactly one of src_registry and dest_registry is required")
	}

	if raw, exists := body["dest_namespace"]; exists && raw != nil {
		namespace, ok := raw.(string)
		if !ok || len(namespace) > 255 || (namespace != "" && !replicationNamespacePattern.MatchString(namespace)) {
			return invalidField("dest_namespace", "invalid_namespace", "must be a lowercase namespace path of at most 255 characters")
		}
	}
	if raw, exists := body["dest_namespace_replace_count"]; exists && raw != nil {
		level, ok := integerNumberValue(raw)
		if !ok || !slicesContain([]string{"-1", "0", "1", "2", "3"}, strconv.FormatInt(level, 10)) {
			return invalidField("dest_namespace_replace_count", "invalid_value", "must be -1, 0, 1, 2 or 3")
		}
	}

	triggerType, err := validateReplicationTrigger(body["trigger"])
	if err != nil {
		return err
	}
	if err := validateReplicationFilters(body["filters"]); err != nil {
		return err
	}

	booleanFields := []string{"replicate_deletion", "override", "enabled", "copy_by_chunk", "single_active_replication"}
	for _, field := range booleanFields {
		if raw, exists := body[field]; exists && raw != nil {
			if _, ok := raw.(bool); !ok {
				return invalidField(field, "not_boolean", "must be a boolean")
			}
		}
	}
	deletion := false
	if value, ok := body["replicate_deletion"].(bool); ok {
		deletion = value
	}
	if deletion && (triggerType != "event_based" || sourceSet || destinationID <= 0) {
		return invalidField("replicate_deletion", "deletion_requires_push_event", "applies only to event-based push policies")
	}
	if single, _ := body["single_active_replication"].(bool); single && triggerType == "event_based" {
		return invalidField("single_active_replication", "not_supported_for_event_trigger", "is not supported by event-based policies")
	}

	if raw, exists := body["speed"]; exists && raw != nil {
		speed, ok := integerNumberValue(raw)
		if !ok || speed == 0 || speed < -1 || speed > math.MaxInt32 {
			return invalidField("speed", "invalid_speed", "must be -1 (unlimited) or a positive integer up to 2147483647 Kbps")
		}
	}
	_ = sourceID
	return nil
}

func replicationRegistryID(raw any, field string) (int64, bool, error) {
	if raw == nil {
		return 0, false, nil
	}
	registry, ok := raw.(map[string]any)
	if !ok {
		return 0, false, invalidField(field, "invalid_registry_reference", "must be an object with only id, or null")
	}
	if err := validateAllowedFields(registry, "id"); err != nil {
		return 0, false, nestField(field, err)
	}
	id, ok := integerNumberValue(registry["id"])
	if !ok || id <= 0 {
		return 0, false, invalidField(field+".id", "not_positive_integer", "must be a positive integer")
	}
	return id, true, nil
}

func validateReplicationTrigger(raw any) (string, error) {
	trigger, ok := raw.(map[string]any)
	if !ok {
		return "", invalidField("trigger", "not_object", "must be a JSON object")
	}
	if err := validateAllowedFields(trigger, "type", "trigger_settings"); err != nil {
		return "", nestField("trigger", err)
	}
	triggerType, _ := trigger["type"].(string)
	if !slicesContain([]string{"manual", "event_based", "scheduled"}, triggerType) {
		return "", invalidField("trigger.type", "invalid_value", "must be manual, event_based or scheduled")
	}
	settingsRaw, exists := trigger["trigger_settings"]
	if !exists || settingsRaw == nil {
		settingsRaw = map[string]any{}
	}
	settings, ok := settingsRaw.(map[string]any)
	if !ok {
		return "", invalidField("trigger.trigger_settings", "not_object", "must be a JSON object")
	}
	if err := validateAllowedFields(settings, "cron"); err != nil {
		return "", nestField("trigger.trigger_settings", err)
	}
	cron := ""
	if rawCron, exists := settings["cron"]; exists {
		var text bool
		cron, text = rawCron.(string)
		if !text || len(cron) > 255 || strings.ContainsAny(cron, "\r\n\x00") {
			return "", invalidField("trigger.trigger_settings.cron", "invalid_text", "must be single-line text of at most 255 characters")
		}
	}
	if triggerType == "scheduled" {
		parts := strings.Fields(cron)
		if len(parts) != 6 || parts[0] != "0" || parts[1] == "*" {
			return "", invalidField("trigger.trigger_settings.cron", "invalid_harbor_cron", "must be a six-field Harbor cron expression starting with 0")
		}
	} else if strings.TrimSpace(cron) != "" {
		return "", invalidField("trigger.trigger_settings.cron", "cron_requires_schedule", "must be empty unless the trigger is scheduled")
	}
	return triggerType, nil
}

func validateReplicationFilters(raw any) error {
	if raw == nil {
		return nil
	}
	filters, ok := raw.([]any)
	if !ok || len(filters) > 16 {
		return invalidField("filters", "invalid_count", "must be an array of at most 16 filters")
	}
	seen := make(map[string]bool, len(filters))
	for index, rawFilter := range filters {
		filter, ok := rawFilter.(map[string]any)
		if !ok {
			return invalidField(fmt.Sprintf("filters.%d", index), "not_object", "must be a JSON object")
		}
		if err := validateAllowedFields(filter, "type", "value", "decoration"); err != nil {
			return nestField(fmt.Sprintf("filters.%d", index), err)
		}
		filterType, _ := filter["type"].(string)
		if !slicesContain([]string{"name", "tag", "label", "resource"}, filterType) {
			return invalidField(fmt.Sprintf("filters.%d.type", index), "not_supported", "is not supported by the Harbor replication API")
		}
		if seen[filterType] {
			return invalidField(fmt.Sprintf("filters.%d.type", index), "duplicate", "repeats an earlier filter type")
		}
		seen[filterType] = true
		if decorationRaw, exists := filter["decoration"]; exists {
			decoration, _ := decorationRaw.(string)
			if decoration != "matches" && decoration != "excludes" {
				return invalidField(fmt.Sprintf("filters.%d.decoration", index), "invalid_value", "must be matches or excludes")
			}
		}
		if filterType == "label" {
			labels, ok := filter["value"].([]any)
			if !ok || len(labels) == 0 || len(labels) > 100 {
				return invalidField(fmt.Sprintf("filters.%d.value", index), "invalid_count", "must be an array of 1 to 100 label names")
			}
			for _, rawLabel := range labels {
				label, ok := rawLabel.(string)
				if !ok || strings.TrimSpace(label) == "" || exceedsCharacterLimit(label, 255) || strings.ContainsAny(label, "\r\n\x00,") {
					return invalidField(fmt.Sprintf("filters.%d.value", index), "invalid_text", "contains an invalid label name")
				}
			}
			continue
		}
		value, ok := filter["value"].(string)
		if !ok || strings.TrimSpace(value) == "" || exceedsCharacterLimit(value, 1024) || strings.ContainsAny(value, "\r\n\x00") {
			return invalidField(fmt.Sprintf("filters.%d.value", index), "invalid_text", "must be non-empty single-line text of at most 1024 characters")
		}
	}
	return nil
}

func validateReplicationStart(body map[string]any) error {
	return validatePositiveInteger(body["policy_id"], "policy_id")
}

func validateRegistryCreate(body map[string]any) error {
	name, _ := body["name"].(string)
	if err := validateResourceName(resourceNameValidation{value: name, path: "name", maximum: 255, allowSpaces: true}); err != nil {
		return err
	}
	registryType, _ := body["type"].(string)
	if strings.TrimSpace(registryType) == "" {
		return invalidField("type", "required", "is required")
	}
	return validateRegistryURL(body["url"])
}

func validateRegistryUpdate(body map[string]any) error {
	if raw, ok := body["url"]; ok {
		return validateRegistryURL(raw)
	}
	return nil
}

func validateRegistryPing(body map[string]any) error {
	if id, exists := body["id"]; exists {
		return validatePositiveInteger(id, "id")
	}
	return validateRegistryURL(body["url"])
}

func validateRegistryURL(raw any) error {
	value, _ := raw.(string)
	parsed, err := url.Parse(strings.TrimSpace(value))
	if err != nil || parsed.Host == "" || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		return invalidField("url", "invalid_url", "must be a complete http:// or https:// URL")
	}
	if parsed.User != nil || parsed.Fragment != "" {
		return invalidField("url", "url_has_credentials", "must not contain credentials or a fragment")
	}
	return nil
}
