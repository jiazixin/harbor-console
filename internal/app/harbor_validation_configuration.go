package app

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"strings"
)

func validateConfigurations(body map[string]any) error {
	if len(body) == 0 {
		return errors.New("系统配置更新内容不能为空")
	}
	if _, exists := body["self_registration"]; exists {
		return errors.New("self_registration 是 Harbor v2.15 的只读配置项，不能通过此 API 修改")
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
				return fmt.Errorf("系统配置项 %s 的类型或长度无效", key)
			}
		case boolFields[key]:
			if _, ok := value.(bool); !ok {
				return fmt.Errorf("系统配置项 %s 必须是布尔值", key)
			}
		case numberFields[key]:
			number, ok := integerNumberValue(value)
			if !ok || !validConfigurationNumber(key, number) {
				return fmt.Errorf("系统配置项 %s 的数值无效", key)
			}
		default:
			return fmt.Errorf("系统配置项 %s 不在控制台允许列表中", key)
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
		return errors.New("认证模式必须是 db_auth、ldap_auth、uaa_auth、oidc_auth 或 http_auth")
	}
	if value, ok := body["project_creation_restriction"].(string); ok && !slicesContain([]string{"adminonly", "everyone"}, value) {
		return errors.New("项目创建权限必须是 adminonly 或 everyone")
	}
	if value, ok := body["robot_name_prefix"].(string); ok && (strings.TrimSpace(value) == "" || len(value) > 255 || strings.ContainsAny(value, "\r\n")) {
		return errors.New("机器人账号前缀必须是 255 个字符以内的单行文本")
	}
	for key, label := range map[string]string{
		"uaa_endpoint": "UAA 地址", "http_authproxy_endpoint": "HTTP 认证地址",
		"http_authproxy_tokenreview_endpoint": "HTTP Token Review 地址", "oidc_endpoint": "OIDC 地址",
		"audit_log_forward_endpoint": "审计日志转发地址",
	} {
		if value, ok := body[key].(string); ok && strings.TrimSpace(value) != "" {
			if err := validateHTTPURL(value, label); err != nil {
				return err
			}
		}
	}
	if value, ok := body["ldap_url"].(string); ok && strings.TrimSpace(value) != "" {
		parsed, err := url.Parse(strings.TrimSpace(value))
		if err != nil || parsed.Host == "" || (parsed.Scheme != "ldap" && parsed.Scheme != "ldaps") || parsed.User != nil || parsed.Fragment != "" {
			return errors.New("LDAP 地址必须是完整的 ldap:// 或 ldaps:// URL")
		}
	}
	if raw, ok := body["banner_message"].(string); ok {
		if err := validateBannerMessage(raw); err != nil {
			return err
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
		return errors.New("横幅消息必须是 Harbor 官方 BannerMessage JSON")
	}
	if err := validateAllowedFields(banner, "message", "closable", "type", "fromDate", "toDate"); err != nil {
		return fmt.Errorf("横幅消息无效：%w", err)
	}
	message, ok := banner["message"].(string)
	if !ok || strings.TrimSpace(message) == "" || len(message) > 800 || strings.ContainsRune(message, '\x00') {
		return errors.New("横幅消息正文必须是 1 到 800 个字符")
	}
	closable, ok := banner["closable"].(bool)
	if !ok {
		return errors.New("横幅消息 closable 必须是布尔值")
	}
	_ = closable
	typeName, ok := banner["type"].(string)
	if !ok || !slicesContain([]string{"success", "info", "warning", "danger"}, typeName) {
		return errors.New("横幅消息类型必须是 success、info、warning 或 danger")
	}
	for _, key := range []string{"fromDate", "toDate"} {
		if value, exists := banner[key]; exists && value != nil {
			if _, ok := value.(string); !ok {
				return fmt.Errorf("横幅消息 %s 必须是日期字符串或 null", key)
			}
		}
	}
	return nil
}
