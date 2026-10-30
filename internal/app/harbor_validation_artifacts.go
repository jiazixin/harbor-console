package app

import (
	"fmt"
	"strings"
)

func validateRepositoryUpdate(body map[string]any) error {
	if description, ok := body["description"]; ok {
		value, ok := description.(string)
		if !ok || len(value) > 1024 {
			return invalidField("description", "too_long", "must be text of at most 1024 characters")
		}
	}
	return nil
}

func validateTagCreate(body map[string]any) error {
	name, _ := body["name"].(string)
	return validateResourceName(resourceNameValidation{value: name, path: "name", maximum: 128, allowSpaces: false})
}

func validateArtifactLabel(body map[string]any) error {
	if err := validateAllowedFields(body, "id"); err != nil {
		return err
	}
	return validatePositiveInteger(body["id"], "id")
}

func validateScanType(body map[string]any) error {
	if err := validateAllowedFields(body, "scan_type"); err != nil {
		return err
	}
	if scanType, _ := body["scan_type"].(string); scanType != "vulnerability" && scanType != "sbom" {
		return invalidField("scan_type", "invalid_value", "must be vulnerability or sbom")
	}
	return nil
}

func validateOptionalScanType(body map[string]any) error {
	if len(body) == 0 {
		return nil
	}
	return validateScanType(body)
}

func validateCVEAllowlist(body map[string]any) error {
	if err := validateAllowedFields(body, "id", "project_id", "expires_at", "items"); err != nil {
		return err
	}
	if expiresAt, exists := body["expires_at"]; exists && expiresAt != nil {
		value, ok := integerNumberValue(expiresAt)
		if !ok || value <= 0 {
			return invalidField("expires_at", "invalid_timestamp", "must be a positive integer timestamp or null")
		}
	}
	if id, exists := body["id"]; exists && id != nil {
		value, ok := integerNumberValue(id)
		if !ok || value <= 0 {
			return invalidField("id", "not_positive_integer", "must be a positive integer")
		}
	}
	if projectID, exists := body["project_id"]; exists && projectID != nil {
		value, ok := integerNumberValue(projectID)
		if !ok || value < 0 {
			return invalidField("project_id", "not_non_negative_integer", "must be 0 or a positive integer")
		}
	}
	items, ok := body["items"].([]any)
	if !ok || len(items) > 1000 {
		return invalidField("items", "invalid_count", "must be an array of at most 1000 entries")
	}
	seen := make(map[string]bool, len(items))
	for index, raw := range items {
		item, objectOK := raw.(map[string]any)
		if !objectOK {
			return invalidField(fmt.Sprintf("items.%d", index), "not_object", "must be a JSON object")
		}
		if err := validateAllowedFields(item, "cve_id"); err != nil {
			return nestField(fmt.Sprintf("items.%d", index), err)
		}
		cveID, _ := item["cve_id"].(string)
		if !validCVEID(cveID) {
			return invalidField(fmt.Sprintf("items.%d.cve_id", index), "invalid_cve_id", "is not a valid CVE ID")
		}
		if seen[cveID] {
			return invalidField(fmt.Sprintf("items.%d.cve_id", index), "duplicate", "repeats an earlier CVE ID")
		}
		seen[cveID] = true
	}
	return nil
}

func validCVEID(value string) bool {
	if len(value) < 13 || len(value) > 32 || !strings.HasPrefix(value, "CVE-") {
		return false
	}
	parts := strings.Split(value, "-")
	if len(parts) != 3 || len(parts[1]) != 4 || len(parts[2]) < 4 {
		return false
	}
	for _, part := range parts[1:] {
		for _, character := range part {
			if character < '0' || character > '9' {
				return false
			}
		}
	}
	return true
}

func validateCVEExport(body map[string]any) error {
	if err := validateAllowedFields(body, "job_name", "projects", "labels", "repositories", "cveIds", "tags"); err != nil {
		return err
	}
	projects, ok := body["projects"].([]any)
	projectID, validProject := int64(0), false
	if ok && len(projects) == 1 {
		projectID, validProject = integerNumberValue(projects[0])
	}
	if !ok || len(projects) != 1 || !validProject || projectID <= 0 {
		return invalidField("projects", "exactly_one_project", "must contain exactly one valid project ID")
	}
	if labels, exists := body["labels"]; exists {
		values, arrayOK := labels.([]any)
		if !arrayOK || len(values) > 100 {
			return invalidField("labels", "invalid_count", "must be an array of at most 100 entries")
		}
		for _, value := range values {
			labelID, valid := integerNumberValue(value)
			if !valid || labelID <= 0 {
				return invalidField("labels", "not_positive_integer", "must contain only positive integers")
			}
		}
	}
	for _, field := range []string{"job_name", "repositories", "cveIds", "tags"} {
		if raw, exists := body[field]; exists && raw != nil {
			value, text := raw.(string)
			if !text || len(value) > 2048 || strings.ContainsAny(value, "\r\n\x00") {
				return invalidField(field, "invalid_text", "must be single-line text of at most 2048 characters")
			}
		}
	}
	return nil
}
