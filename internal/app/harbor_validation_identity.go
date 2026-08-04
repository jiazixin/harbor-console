package app

import (
	"errors"
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
		return errors.New("ldap_uid_list 必须包含 1 到 100 个 LDAP 用户标识")
	}
	seen := make(map[string]struct{}, len(users))
	for _, raw := range users {
		uid, ok := raw.(string)
		uid = strings.TrimSpace(uid)
		if !ok {
			return errors.New("LDAP 用户标识必须是字符串")
		}
		if err := validateResourceName(uid, "LDAP 用户标识", 255, true); err != nil {
			return err
		}
		if _, exists := seen[uid]; exists {
			return errors.New("ldap_uid_list 不能包含重复用户")
		}
		seen[uid] = struct{}{}
	}
	return nil
}

func validateLDAPGroupSearchQuery(query url.Values) error {
	name := strings.TrimSpace(query.Get("groupname"))
	dn := strings.TrimSpace(query.Get("groupdn"))
	if name != "" && dn != "" {
		return errors.New("groupname 与 groupdn 只能选择一个")
	}
	for key, value := range map[string]string{"groupname": name, "groupdn": dn} {
		if len(value) > 1024 || strings.ContainsAny(value, "\r\n\x00") {
			return fmt.Errorf("%s 包含无效字符或长度过长", key)
		}
	}
	return nil
}

func validateOIDCPing(body map[string]any) error {
	if err := validateAllowedFields(body, "url", "verify_cert"); err != nil {
		return err
	}
	if err := validateHTTPURL(body["url"], "OIDC 地址"); err != nil {
		return err
	}
	if _, ok := body["verify_cert"].(bool); !ok {
		return errors.New("verify_cert 必须是布尔值")
	}
	return nil
}
