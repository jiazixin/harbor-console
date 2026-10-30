package app

import (
	"encoding/json"
	"net/url"
	"strings"
)

func validateConfigurations(body map[string]any) error {
	if len(body) == 0 {
		return invalidField("", "body_required", "configuration update must not be empty")
	}
	if _, exists := body["self_registration"]; exists {
		return invalidField("self_registration", "read_only", "is read-only in Harbor v2.15")
	}
	stringFields := map[string]bool{
		"auth_mode": true, "ldap_base_dn": true, "ldap_filter": true, "ldap_group_base_dn": true,
		"ldap_group_admin_dn": true, "ldap_group_attribute_name": true, "ldap_group_search_filter": true,
		"ldap_search_dn": true, "ldap_search_password": true, "ldap_uid": true, "ldap_url": true,
		"ldap_group_membership_attribute": true, "uaa_client_id": true, "uaa_client_secret": true,
		"uaa_endpoint": true, "http_authproxy_endpoint": true, "http_authproxy_tokenreview_endpoint": true,
		"http_authproxy_admin_groups": true, "http_authproxy_admin_usernames": true,
		"http_authproxy_server_certificate": true, "oidc_name": true, "oidc_endpoint": true,
		"oidc_client_id": true, "oidc_client_secret": true, "oidc_groups_claim": true,
		"oidc_admin_group": true, "oidc_group_filter": true, "oidc_scope": true, "oidc_user_claim": true,
		"oidc_extra_redirect_parms": true, "project_creation_restriction": true, "robot_name_prefix": true,
		"audit_log_forward_endpoint": true, "banner_message": true, "disabled_audit_log_event_types": true,
	}
	boolFields := map[string]bool{
		"primary_auth_mode": true, "ldap_group_attach_parallel": true, "ldap_verify_cert": true,
		"uaa_verify_cert": true, "http_authproxy_verify_cert": true, "http_authproxy_skip_search": true,
		"oidc_verify_cert": true, "oidc_auto_onboard": true, "oidc_logout": true, "read_only": true,
		"notification_enable": true, "quota_per_project_enable": true,
		"skip_audit_log_database": true, "scanner_skip_update_pulltime": true,
	}
	numberFields := map[string]bool{
		"ldap_group_search_scope": true, "ldap_scope": true, "ldap_timeout": true,
		"token_expiration": true, "robot_token_duration": true, "storage_per_project": true, "session_timeout": true,
	}
	for key, value := range body {
		switch {
		case stringFields[key]:
			text, ok := value.(string)
			if !ok || len(text) > 65535 || strings.ContainsRune(text, '\x00') {
				return invalidField(key, "invalid_text", "must be a string of at most 65535 bytes")
			}
		case boolFields[key]:
			if _, ok := value.(bool); !ok {
				return invalidField(key, "not_boolean", "must be a boolean")
			}
		case numberFields[key]:
			number, ok := integerNumberValue(value)
			if !ok || !validConfigurationNumber(key, number) {
				return invalidField(key, "out_of_range", "is not a valid number for this setting")
			}
		default:
			return invalidField(key, "unknown_field", "is not in the console allowlist")
		}
	}
	if err := validateConfigurationSemantics(body); err != nil {
		return err
	}
	return nil
}

func validConfigurationNumber(key string, value int64) bool {
	switch key {
	case "storage_per_project":
		return value >= -1
	case "ldap_scope", "ldap_group_search_scope":
		return value >= 0 && value <= 2
	default:
		return value > 0
	}
}

func validateConfigurationSemantics(body map[string]any) error {
	if value, ok := body["auth_mode"].(string); ok && !slicesContain([]string{"db_auth", "ldap_auth", "uaa_auth", "oidc_auth", "http_auth"}, value) {
		return invalidField("auth_mode", "invalid_value", "must be db_auth, ldap_auth, uaa_auth, oidc_auth or http_auth")
	}
	if value, ok := body["project_creation_restriction"].(string); ok && !slicesContain([]string{"adminonly", "everyone"}, value) {
		return invalidField("project_creation_restriction", "invalid_value", "must be adminonly or everyone")
	}
	if value, ok := body["robot_name_prefix"].(string); ok && (strings.TrimSpace(value) == "" || len(value) > 255 || strings.ContainsAny(value, "\r\n")) {
		return invalidField("robot_name_prefix", "invalid_text", "must be non-empty single-line text of at most 255 characters")
	}
	for _, key := range []string{
		"uaa_endpoint", "http_authproxy_endpoint", "http_authproxy_tokenreview_endpoint", "oidc_endpoint",
		"audit_log_forward_endpoint",
	} {
		if value, ok := body[key].(string); ok && strings.TrimSpace(value) != "" {
			if err := validateHTTPURL(value, key); err != nil {
				return err
			}
		}
	}
	if value, ok := body["ldap_url"].(string); ok && strings.TrimSpace(value) != "" {
		parsed, err := url.Parse(strings.TrimSpace(value))
		if err != nil || parsed.Host == "" || (parsed.Scheme != "ldap" && parsed.Scheme != "ldaps") || parsed.User != nil || parsed.Fragment != "" {
			return invalidField("ldap_url", "invalid_ldap_url", "must be a complete ldap:// or ldaps:// URL")
		}
	}
	if raw, ok := body["banner_message"].(string); ok {
		if err := validateBannerMessage(raw); err != nil {
			return nestField("banner_message", err)
		}
	}
	return nil
}

func validateBannerMessage(raw string) error {
	if raw == "" {
		return nil
	}
	var banner map[string]any
	if err := json.Unmarshal([]byte(raw), &banner); err != nil {
		return invalidField("", "invalid_json", "must be Harbor BannerMessage JSON")
	}
	if err := validateAllowedFields(banner, "message", "closable", "type", "fromDate", "toDate"); err != nil {
		return err
	}
	message, ok := banner["message"].(string)
	if !ok || strings.TrimSpace(message) == "" || len(message) > 800 || strings.ContainsRune(message, '\x00') {
		return invalidField("message", "invalid_text", "must have 1 to 800 characters")
	}
	closable, ok := banner["closable"].(bool)
	if !ok {
		return invalidField("closable", "not_boolean", "must be a boolean")
	}
	_ = closable
	typeName, ok := banner["type"].(string)
	if !ok || !slicesContain([]string{"success", "info", "warning", "danger"}, typeName) {
		return invalidField("type", "invalid_value", "must be success, info, warning or danger")
	}
	for _, key := range []string{"fromDate", "toDate"} {
		if value, exists := banner[key]; exists && value != nil {
			if _, ok := value.(string); !ok {
				return invalidField(key, "invalid_date", "must be a date string or null")
			}
		}
	}
	return nil
}
