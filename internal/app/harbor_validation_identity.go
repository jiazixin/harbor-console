package app

import (
	"fmt"
	"net/url"
	"strings"
)

func validateLDAPPing(body map[string]any) error {
	if err := validateAllowedFields(body, "ldap_url", "ldap_search_dn", "ldap_search_password", "ldap_base_dn", "ldap_filter", "ldap_uid", "ldap_scope", "ldap_connection_timeout", "ldap_verify_cert"); err != nil {
		return err
	}
	configuration := cloneMap(body)
	if timeout, exists := configuration["ldap_connection_timeout"]; exists {
		configuration["ldap_timeout"] = timeout
		delete(configuration, "ldap_connection_timeout")
	}
	return validateConfigurations(configuration)
}

func validateLDAPUserImport(body map[string]any) error {
	if err := validateAllowedFields(body, "ldap_uid_list"); err != nil {
		return err
	}
	users, ok := body["ldap_uid_list"].([]any)
	if !ok || len(users) == 0 || len(users) > 100 {
		return invalidField("ldap_uid_list", "invalid_count", "must contain 1 to 100 LDAP user IDs")
	}
	seen := make(map[string]struct{}, len(users))
	for index, raw := range users {
		uid, ok := raw.(string)
		uid = strings.TrimSpace(uid)
		if !ok {
			return invalidField(fmt.Sprintf("ldap_uid_list.%d", index), "not_string", "must be a string")
		}
		if err := validateResourceName(resourceNameValidation{value: uid, path: fmt.Sprintf("ldap_uid_list.%d", index), maximum: 255, allowSpaces: true}); err != nil {
			return err
		}
		if _, exists := seen[uid]; exists {
			return invalidField("ldap_uid_list", "duplicate", "must not contain duplicate users")
		}
		seen[uid] = struct{}{}
	}
	return nil
}

func validateLDAPGroupSearchQuery(query url.Values) error {
	name := strings.TrimSpace(query.Get("groupname"))
	dn := strings.TrimSpace(query.Get("groupdn"))
	if name != "" && dn != "" {
		return invalidField("groupname", "exactly_one_of", "only one of groupname and groupdn may be set")
	}
	for key, value := range map[string]string{"groupname": name, "groupdn": dn} {
		if len(value) > 1024 || strings.ContainsAny(value, "\r\n\x00") {
			return invalidField(key, "invalid_text", "contains invalid characters or is too long")
		}
	}
	return nil
}

func validateOIDCPing(body map[string]any) error {
	if err := validateAllowedFields(body, "url", "verify_cert"); err != nil {
		return err
	}
	if err := validateHTTPURL(body["url"], "url"); err != nil {
		return err
	}
	if _, ok := body["verify_cert"].(bool); !ok {
		return invalidField("verify_cert", "not_boolean", "must be a boolean")
	}
	return nil
}
