package app

import (
	"regexp"
)

func validateGCSchedule(body map[string]any) error {
	if err := validateSchedule(body); err != nil {
		return err
	}
	if err := validateAllowedFields(body, "schedule", "parameters"); err != nil {
		return err
	}
	raw, exists := body["parameters"]
	if !exists {
		return nil
	}
	parameters, ok := raw.(map[string]any)
	if !ok {
		return invalidField("parameters", "not_object", "must be a JSON object")
	}
	if err := validateAllowedFields(parameters, "delete_untagged", "delete_tag", "dry_run", "workers"); err != nil {
		return nestField("parameters", err)
	}
	for _, key := range []string{"delete_untagged", "delete_tag", "dry_run"} {
		if value, present := parameters[key]; present {
			if _, valid := value.(bool); !valid {
				return invalidField("parameters."+key, "not_boolean", "must be a boolean")
			}
		}
	}
	if value, present := parameters["workers"]; present {
		workers, valid := integerNumberValue(value)
		if !valid || workers < 1 || workers > 10 {
			return invalidField("parameters.workers", "invalid_workers", "must be an integer from 1 to 10")
		}
	}
	return nil
}

var purgeEventTypesPattern = regexp.MustCompile(`^[A-Za-z0-9_.-]+(?:,[A-Za-z0-9_.-]+)*$`)

func validatePurgeSchedule(body map[string]any) error {
	if err := validateSchedule(body); err != nil {
		return err
	}
	if err := validateAllowedFields(body, "schedule", "parameters"); err != nil {
		return err
	}
	parameters, ok := body["parameters"].(map[string]any)
	if !ok {
		return invalidField("parameters", "not_object", "must be a JSON object")
	}
	if err := validateAllowedFields(parameters, "audit_retention_hour", "dry_run", "include_event_types"); err != nil {
		return nestField("parameters", err)
	}
	hours, valid := integerNumberValue(parameters["audit_retention_hour"])
	if !valid || hours < 1 || hours > 87_600_000 {
		return invalidField("parameters.audit_retention_hour", "invalid_retention_hours", "must be an integer from 1 to 87600000 hours")
	}
	if dryRun, exists := parameters["dry_run"]; exists {
		if _, valid := dryRun.(bool); !valid {
			return invalidField("parameters.dry_run", "not_boolean", "must be a boolean")
		}
	}
	events, ok := parameters["include_event_types"].(string)
	if !ok || len(events) > 8192 || !purgeEventTypesPattern.MatchString(events) {
		return invalidField("parameters.include_event_types", "invalid_event_types", "must be a comma-separated list of valid event names")
	}
	return nil
}

func validateJobServiceAction(body map[string]any) error {
	if len(body) != 1 {
		return invalidField("action", "only_field", "must be the only field")
	}
	action, _ := body["action"].(string)
	if !slicesContain([]string{"stop", "pause", "resume"}, action) {
		return invalidField("action", "invalid_value", "must be stop, pause or resume")
	}
	return nil
}
