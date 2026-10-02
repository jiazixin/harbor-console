package app

import (
	"errors"
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
		return errors.New("必须且只能提供 member_user 或 member_group")
	}
	if userOK {
		if err := validateAllowedFields(user, "user_id", "username"); err != nil {
			return fmt.Errorf("member_user 无效：%w", err)
		}
		username, _ := user["username"].(string)
		if err := validateResourceName(username, "成员用户名", 255, true); err != nil {
			return err
		}
	}
	if groupOK {
		if err := validateAllowedFields(group, "id", "group_name", "group_type", "ldap_group_dn"); err != nil {
			return fmt.Errorf("member_group 无效：%w", err)
		}
		name, _ := group["group_name"].(string)
		if err := validateResourceName(name, "成员组名称", 255, true); err != nil {
			return err
		}
		groupType, valid := integerNumberValue(group["group_type"])
		if !valid || groupType < 1 || groupType > 3 {
			return errors.New("成员组类型必须是 LDAP、HTTP 或 OIDC")
		}
		if groupType == 1 && strings.TrimSpace(stringValue(group["ldap_group_dn"])) == "" {
			return errors.New("LDAP 成员组必须包含 ldap_group_dn")
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
		return errors.New("role_id 必须是 1 到 4：项目管理员、开发者、访客或维护者")
	}
	return nil
}

func validateRobotCreate(body map[string]any) error {
	if err := validateAllowedFields(body, "name", "description", "level", "duration", "disable", "permissions"); err != nil {
		return err
	}
	name, _ := body["name"].(string)
	if err := validateResourceName(name, "机器人名称", 255, true); err != nil {
		return err
	}
	level, _ := body["level"].(string)
	if level != "project" && level != "system" {
		return errors.New("机器人 level 必须是 project 或 system")
	}
	return validateRobotUpdateFields(body)
}

func validateRobotUpdate(body map[string]any) error {
	if err := validateAllowedFields(body, "name", "description", "level", "duration", "disable", "permissions"); err != nil {
		return err
	}
	name, _ := body["name"].(string)
	if err := validateResourceName(name, "机器人名称", 255, true); err != nil {
		return err
	}
	level, _ := body["level"].(string)
	if level != "project" && level != "system" {
		return errors.New("机器人 level 必须是 project 或 system")
	}
	return validateRobotUpdateFields(body)
}

func validateRobotUpdateFields(body map[string]any) error {
	if rawDescription, exists := body["description"]; exists {
		description, ok := rawDescription.(string)
		if !ok || len(description) > 1024 || strings.ContainsRune(description, '\x00') {
			return errors.New("机器人描述必须是 1024 个字符以内的文本")
		}
	}
	if rawDisabled, exists := body["disable"]; exists {
		if _, ok := rawDisabled.(bool); !ok {
			return errors.New("机器人 disable 必须是布尔值")
		}
	}
	duration, valid := integerNumberValue(body["duration"])
	if !valid || (duration != -1 && duration < 1) {
		return errors.New("机器人有效期必须是 -1（永不过期）或正整数")
	}
	permissions, ok := body["permissions"].([]any)
	if !ok || len(permissions) == 0 {
		return errors.New("机器人 permissions 不能为空")
	}
	for _, rawPermission := range permissions {
		permission, ok := rawPermission.(map[string]any)
		if !ok {
			return errors.New("机器人 permission 必须是 JSON 对象")
		}
		namespace, _ := permission["namespace"].(string)
		access, accessOK := permission["access"].([]any)
		if strings.TrimSpace(namespace) == "" || !accessOK || len(access) == 0 {
			return errors.New("机器人 permission 必须包含 namespace 和 access")
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
		return errors.New("机器人密钥必须是文本")
	}
	if len(secret) > 255 || strings.ContainsAny(secret, "\r\n\x00") {
		return errors.New("机器人密钥包含无效字符或长度超过 255")
	}
	return nil
}

func validateUserCreate(body map[string]any) error {
	if err := validateAllowedFields(body, "username", "password", "email", "realname", "comment"); err != nil {
		return err
	}
	username, _ := body["username"].(string)
	if err := validateResourceName(username, "用户名", 255, false); err != nil {
		return err
	}
	password, _ := body["password"].(string)
	if err := validateUserSecret(password); err != nil {
		return fmt.Errorf("用户密码%s", err)
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
				return fmt.Errorf("%s 必须是文本且不能包含换行或控制字符", field)
			}
			maximum := 255
			if field == "comment" {
				maximum = 30
			}
			if len(text) > maximum {
				return fmt.Errorf("%s 必须是 %d 个 UTF-8 字节以内的文本", field, maximum)
			}
		}
	}
	if email, _ := body["email"].(string); email != "" && (!strings.Contains(email, "@") || len(email) > 255) {
		return errors.New("邮箱地址格式无效")
	}
	return nil
}

func validateUserSysadmin(body map[string]any) error {
	if err := validateAllowedFields(body, "sysadmin_flag"); err != nil {
		return err
	}
	if _, ok := body["sysadmin_flag"].(bool); !ok {
		return errors.New("sysadmin_flag 必须是布尔值")
	}
	return nil
}

func validateUserPassword(body map[string]any) error {
	if err := validateAllowedFields(body, "old_password", "new_password"); err != nil {
		return err
	}
	password, _ := body["new_password"].(string)
	if err := validateUserSecret(password); err != nil {
		return fmt.Errorf("新密码%s", err)
	}
	if old, ok := body["old_password"].(string); ok && (len(old) > 4096 || strings.ContainsRune(old, '\x00')) {
		return errors.New("旧密码长度超过限制")
	}
	return nil
}

func validateUserCLISecret(body map[string]any) error {
	if err := validateAllowedFields(body, "secret"); err != nil {
		return err
	}
	secret, _ := body["secret"].(string)
	if err := validateUserSecret(secret); err != nil {
		return fmt.Errorf("CLI Secret%s", err)
	}
	return nil
}

func validateUserSecret(secret string) error {
	if len(secret) < 8 || len(secret) > 128 || strings.ContainsRune(secret, '\x00') {
		return errors.New("必须是 8 到 128 个字符，并至少包含一个大写字母、一个小写字母和一个数字")
	}
	hasUpper := regexp.MustCompile(`[A-Z]`).MatchString(secret)
	hasLower := regexp.MustCompile(`[a-z]`).MatchString(secret)
	hasNumber := regexp.MustCompile(`[0-9]`).MatchString(secret)
	if !hasUpper || !hasLower || !hasNumber {
		return errors.New("必须是 8 到 128 个字符，并至少包含一个大写字母、一个小写字母和一个数字")
	}
	return nil
}

func validateUserGroup(body map[string]any) error {
	name, _ := body["group_name"].(string)
	if err := validateResourceName(name, "用户组名称", 255, true); err != nil {
		return err
	}
	groupType, valid := integerNumberValue(body["group_type"])
	if !valid || groupType < 1 || groupType > 3 {
		return errors.New("用户组类型必须是 LDAP、HTTP 或 OIDC")
	}
	if groupType == 1 && strings.TrimSpace(stringValue(body["ldap_group_dn"])) == "" {
		return errors.New("LDAP 用户组必须填写组 DN")
	}
	return nil
}
