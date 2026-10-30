package app

import (
	"strings"
)

func validateScanner(body map[string]any) error {
	if err := validateAllowedFields(
		body,
		"name",
		"description",
		"url",
		"auth",
		"access_credential",
		"disabled",
		"skip_certVerify",
		"use_internal_addr",
	); err != nil {
		return err
	}
	name, _ := body["name"].(string)
	if err := validateResourceName(resourceNameValidation{value: name, path: "name", maximum: 128, allowSpaces: true}); err != nil {
		return err
	}
	description, _ := body["description"].(string)
	if exceedsCharacterLimit(description, 1024) || strings.ContainsRune(description, '\x00') {
		return invalidField("description", "too_long", "must be text of at most 1024 characters")
	}
	url, _ := body["url"].(string)
	if exceedsCharacterLimit(url, 512) {
		return invalidField("url", "too_long", "must not exceed 512 characters")
	}
	if err := validateRegistryURL(body["url"]); err != nil {
		return err
	}
	auth, _ := body["auth"].(string)
	if !slicesContain([]string{"", "Basic", "Bearer", "X-ScannerAdapter-API-Key"}, auth) {
		return invalidField("auth", "not_supported", "is not supported by the Harbor Scanner Adapter API")
	}
	credential, _ := body["access_credential"].(string)
	if exceedsCharacterLimit(credential, 512) || strings.ContainsAny(credential, "\r\n\x00") {
		return invalidField("access_credential", "invalid_text", "must not exceed 512 characters or contain control characters")
	}
	for _, field := range []string{"disabled", "skip_certVerify", "use_internal_addr"} {
		if value, exists := body[field]; exists {
			if _, ok := value.(bool); !ok {
				return invalidField(field, "not_boolean", "must be a boolean")
			}
		}
	}
	return nil
}

func validateScannerDefault(body map[string]any) error {
	if _, ok := body["is_default"].(bool); !ok {
		return invalidField("is_default", "not_boolean", "must be a boolean")
	}
	return nil
}
