package app

import (
	"fmt"
	"regexp"
	"strings"
)

func validateMemberCreate(body map[string]any) error {
	if err := validateAllowedFields(body, "role_id", "member_user", "member_group"); err != nil {
		return err
	}
	if err := validateRole(body); err != nil {
		return err
	}
	user, userOK := body["member_user"].(map[string]any)
	group, groupOK := body["member_group"].(map[string]any)
	if userOK == groupOK {
		return invalidField("member_user", "exactly_one_of", "exactly one of member_user and member_group is required")
	}
	if userOK {
		if err := validateAllowedFields(user, "user_id", "username"); err != nil {
			return nestField("member_user", err)
		}
		username, _ := user["username"].(string)
		if err := validateResourceName(resourceNameValidation{value: username, path: "member_user.username", maximum: 255, allowSpaces: true}); err != nil {
			return err
		}
	}
	if groupOK {
		if err := validateAllowedFields(group, "id", "group_name", "group_type", "ldap_group_dn"); err != nil {
			return nestField("member_group", err)
		}
		name, _ := group["group_name"].(string)
		if err := validateResourceName(resourceNameValidation{value: name, path: "member_group.group_name", maximum: 255, allowSpaces: true}); err != nil {
			return err
		}
		groupType, valid := integerNumberValue(group["group_type"])
		if !valid || groupType < 1 || groupType > 3 {
			return invalidField("member_group.group_type", "invalid_group_type", "must be 1 (LDAP), 2 (HTTP) or 3 (OIDC)")
		}
		if groupType == 1 && strings.TrimSpace(stringValue(group["ldap_group_dn"])) == "" {
			return invalidField("member_group.ldap_group_dn", "required", "is required for LDAP groups")
		}
	}
	return nil
}

func validateMemberRole(body map[string]any) error {
	if err := validateAllowedFields(body, "role_id"); err != nil {
		return err
	}
	return validateRole(body)
}

func validateRole(body map[string]any) error {
	role, valid := integerNumberValue(body["role_id"])
	if !valid || role < 1 || role > 4 {
		return invalidField("role_id", "invalid_role", "must be 1 to 4: project admin, developer, guest or maintainer")
	}
	return nil
}

func validateRobotCreate(body map[string]any) error {
	if err := validateAllowedFields(body, "name", "description", "level", "duration", "disable", "permissions"); err != nil {
		return err
	}
	name, _ := body["name"].(string)
	if err := validateResourceName(resourceNameValidation{value: name, path: "name", maximum: 255, allowSpaces: true}); err != nil {
		return err
	}
	level, _ := body["level"].(string)
	if level != "project" && level != "system" {
		return invalidField("level", "invalid_value", "must be project or system")
	}
	return validateRobotUpdateFields(body)
}

func validateRobotUpdate(body map[string]any) error {
	if err := validateAllowedFields(body, "name", "description", "level", "duration", "disable", "permissions"); err != nil {
		return err
	}
	name, _ := body["name"].(string)
	if err := validateResourceName(resourceNameValidation{value: name, path: "name", maximum: 255, allowSpaces: true}); err != nil {
		return err
	}
	level, _ := body["level"].(string)
	if level != "project" && level != "system" {
		return invalidField("level", "invalid_value", "must be project or system")
	}
	return validateRobotUpdateFields(body)
}

func validateRobotUpdateFields(body map[string]any) error {
	if rawDescription, exists := body["description"]; exists {
		description, ok := rawDescription.(string)
		if !ok || len(description) > 1024 || strings.ContainsRune(description, '\x00') {
			return invalidField("description", "too_long", "must be text of at most 1024 characters")
		}
	}
	if rawDisabled, exists := body["disable"]; exists {
		if _, ok := rawDisabled.(bool); !ok {
			return invalidField("disable", "not_boolean", "must be a boolean")
		}
	}
	duration, valid := integerNumberValue(body["duration"])
	if !valid || (duration != -1 && duration < 1) {
		return invalidField("duration", "invalid_duration", "must be -1 (never expires) or a positive integer")
	}
	permissions, ok := body["permissions"].([]any)
	if !ok || len(permissions) == 0 {
		return invalidField("permissions", "required", "must not be empty")
	}
	for index, rawPermission := range permissions {
		permission, ok := rawPermission.(map[string]any)
		if !ok {
			return invalidField(fmt.Sprintf("permissions.%d", index), "not_object", "must be a JSON object")
		}
		namespace, _ := permission["namespace"].(string)
		access, accessOK := permission["access"].([]any)
		if strings.TrimSpace(namespace) == "" || !accessOK || len(access) == 0 {
			return invalidField(fmt.Sprintf("permissions.%d", index), "invalid_permission", "must contain namespace and access")
		}
	}
	return nil
}

func validateRobotSecret(body map[string]any) error {
	if err := validateAllowedFields(body, "secret"); err != nil {
		return err
	}
	secret, ok := body["secret"].(string)
	if !ok {
		return invalidField("secret", "not_string", "must be a string")
	}
	if len(secret) > 255 || strings.ContainsAny(secret, "\r\n\x00") {
		return invalidField("secret", "invalid_text", "contains invalid characters or exceeds 255 bytes")
	}
	return nil
}

func validateUserCreate(body map[string]any) error {
	if err := validateAllowedFields(body, "username", "password", "email", "realname", "comment"); err != nil {
		return err
	}
	username, _ := body["username"].(string)
	if err := validateResourceName(resourceNameValidation{value: username, path: "username", maximum: 255, allowSpaces: false}); err != nil {
		return err
	}
	password, _ := body["password"].(string)
	if err := validateUserSecret(password, "password"); err != nil {
		return err
	}
	return validateUserProfileFields(body)
}

func validateUserProfile(body map[string]any) error {
	if err := validateAllowedFields(body, "email", "realname", "comment"); err != nil {
		return err
	}
	return validateUserProfileFields(body)
}

func validateUserProfileFields(body map[string]any) error {
	for _, field := range []string{"email", "realname", "comment"} {
		if value, ok := body[field]; ok {
			text, textOK := value.(string)
			if !textOK || strings.ContainsAny(text, "\r\n\x00") {
				return invalidField(field, "invalid_text", "must be text without line breaks or control characters")
			}
			maximum := 255
			if field == "comment" {
				maximum = 30
			}
			if len(text) > maximum {
				return invalidField(field, "too_long", fmt.Sprintf("must not exceed %d UTF-8 bytes", maximum))
			}
		}
	}
	if email, _ := body["email"].(string); email != "" && (!strings.Contains(email, "@") || len(email) > 255) {
		return invalidField("email", "invalid_email", "is not a valid email address")
	}
	return nil
}

func validateUserSysadmin(body map[string]any) error {
	if err := validateAllowedFields(body, "sysadmin_flag"); err != nil {
		return err
	}
	if _, ok := body["sysadmin_flag"].(bool); !ok {
		return invalidField("sysadmin_flag", "not_boolean", "must be a boolean")
	}
	return nil
}

func validateUserPassword(body map[string]any) error {
	if err := validateAllowedFields(body, "old_password", "new_password"); err != nil {
		return err
	}
	password, _ := body["new_password"].(string)
	if err := validateUserSecret(password, "new_password"); err != nil {
		return err
	}
	if old, ok := body["old_password"].(string); ok && (len(old) > 4096 || strings.ContainsRune(old, '\x00')) {
		return invalidField("old_password", "too_long", "exceeds 4096 bytes or contains NUL")
	}
	return nil
}

func validateUserCLISecret(body map[string]any) error {
	if err := validateAllowedFields(body, "secret"); err != nil {
		return err
	}
	secret, _ := body["secret"].(string)
	if err := validateUserSecret(secret, "secret"); err != nil {
		return err
	}
	return nil
}

func validateUserSecret(secret, path string) error {
	if len(secret) < 8 || len(secret) > 128 || strings.ContainsRune(secret, '\x00') {
		return invalidField(path, "password_policy", "must have 8 to 128 characters with an uppercase letter, a lowercase letter and a digit")
	}
	hasUpper := regexp.MustCompile(`[A-Z]`).MatchString(secret)
	hasLower := regexp.MustCompile(`[a-z]`).MatchString(secret)
	hasNumber := regexp.MustCompile(`[0-9]`).MatchString(secret)
	if !hasUpper || !hasLower || !hasNumber {
		return invalidField(path, "password_policy", "must have 8 to 128 characters with an uppercase letter, a lowercase letter and a digit")
	}
	return nil
}

func validateUserGroup(body map[string]any) error {
	name, _ := body["group_name"].(string)
	if err := validateResourceName(resourceNameValidation{value: name, path: "group_name", maximum: 255, allowSpaces: true}); err != nil {
		return err
	}
	groupType, valid := integerNumberValue(body["group_type"])
	if !valid || groupType < 1 || groupType > 3 {
		return invalidField("group_type", "invalid_group_type", "must be 1 (LDAP), 2 (HTTP) or 3 (OIDC)")
	}
	if groupType == 1 && strings.TrimSpace(stringValue(body["ldap_group_dn"])) == "" {
		return invalidField("ldap_group_dn", "required", "is required for LDAP groups")
	}
	return nil
}
