package app

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
)

func validatePreheatInstance(body map[string]any) error {
	if err := validateAllowedFields(body, "id", "name", "description", "vendor", "endpoint", "auth_mode", "auth_info", "status", "enabled", "default", "insecure", "setup_timestamp"); err != nil {
		return err
	}
	name, _ := body["name"].(string)
	if err := validateResourceName(name, "P2P 实例名称", 255, true); err != nil {
		return err
	}
	if !validPreheatName(name) {
		return errors.New("P2P 实例名称只能使用字母、数字及单个点、下划线或连字符分隔")
	}
	vendor, _ := body["vendor"].(string)
	if err := validateResourceName(vendor, "P2P Provider", 255, false); err != nil {
		return err
	}
	if err := validateHTTPURL(body["endpoint"], "P2P 实例地址"); err != nil {
		return err
	}
	if description, ok := body["description"].(string); ok && (len(description) > 1024 || strings.ContainsAny(description, "\x00")) {
		return errors.New("P2P 实例描述不能超过 1024 个字符")
	}
	if authMode, ok := body["auth_mode"].(string); ok && (strings.TrimSpace(authMode) == "" || len(authMode) > 64 || strings.ContainsAny(authMode, "\r\n\x00")) {
		return errors.New("P2P 认证模式无效")
	}
	if authInfo, ok := body["auth_info"]; ok {
		credentials, objectOK := authInfo.(map[string]any)
		if !objectOK {
			return errors.New("P2P auth_info 必须是 JSON 对象")
		}
		for key, raw := range credentials {
			value, valueOK := raw.(string)
			if !valueOK || len(key) > 128 || len(value) > 4096 || strings.ContainsAny(key+value, "\x00") {
				return errors.New("P2P 凭据字段必须是长度受限的文本")
			}
		}
	}
	for _, field := range []string{"enabled", "default", "insecure"} {
		if raw, ok := body[field]; ok {
			if _, boolean := raw.(bool); !boolean {
				return fmt.Errorf("%s 必须是布尔值", field)
			}
		}
	}
	return nil
}

func validatePreheatInstancePing(body map[string]any) error {
	if numberValue(body["id"]) > 0 {
		return validateAllowedFields(body, "id")
	}
	return validatePreheatInstance(body)
}

func validatePreheatPolicy(body map[string]any) error {
	if err := validateAllowedFields(body, "id", "name", "description", "project_id", "provider_id", "filters", "trigger", "enabled", "extra_attrs", "creation_time", "update_time"); err != nil {
		return err
	}
	name, _ := body["name"].(string)
	if err := validateResourceName(name, "预热策略名称", 255, true); err != nil {
		return err
	}
	if !validPreheatName(name) {
		return errors.New("预热策略名称只能使用字母、数字及单个点、下划线或连字符分隔")
	}
	if raw, ok := body["id"]; ok && numberValue(raw) <= 0 {
		return errors.New("预热策略 id 必须是正整数")
	}
	if raw, ok := body["project_id"]; ok && numberValue(raw) <= 0 {
		return errors.New("预热策略 project_id 必须是正整数")
	}
	if numberValue(body["provider_id"]) <= 0 {
		return errors.New("预热策略 provider_id 必须是正整数")
	}
	for _, field := range []string{"description", "filters", "trigger", "extra_attrs"} {
		if raw, ok := body[field]; ok {
			value, text := raw.(string)
			if !text || len(value) > 65536 || strings.ContainsAny(value, "\x00") {
				return fmt.Errorf("预热策略 %s 必须是 65536 个字符以内的文本", field)
			}
		}
	}
	filtersText, _ := body["filters"].(string)
	var filters []map[string]any
	if strings.TrimSpace(filtersText) == "" || json.Unmarshal([]byte(filtersText), &filters) != nil || len(filters) == 0 {
		return errors.New("预热策略 filters 必须是非空 JSON 数组")
	}
	for _, filter := range filters {
		filterType, _ := filter["type"].(string)
		if !slicesContain([]string{"repository", "tag", "label", "signature", "vulnerability"}, filterType) {
			return errors.New("预热策略包含不支持的筛选类型")
		}
		if _, exists := filter["value"]; !exists {
			return errors.New("预热策略筛选条件缺少 value")
		}
	}
	triggerText, _ := body["trigger"].(string)
	var trigger struct {
		Type    string `json:"type"`
		Setting struct {
			Cron string `json:"cron"`
		} `json:"trigger_setting"`
	}
	if json.Unmarshal([]byte(triggerText), &trigger) != nil || !slicesContain([]string{"manual", "scheduled", "event_based", "scheduled(paused)"}, trigger.Type) {
		return errors.New("预热策略 trigger 必须包含有效的官方触发类型")
	}
	if trigger.Type == "scheduled" && strings.TrimSpace(trigger.Setting.Cron) == "" {
		return errors.New("定时预热策略必须包含 Cron 表达式")
	}
	if extraText, ok := body["extra_attrs"].(string); ok && strings.TrimSpace(extraText) != "" {
		var extra map[string]any
		if json.Unmarshal([]byte(extraText), &extra) != nil {
			return errors.New("预热策略 extra_attrs 必须是 JSON 对象")
		}
	}
	if raw, ok := body["enabled"]; ok {
		if _, boolean := raw.(bool); !boolean {
			return errors.New("预热策略 enabled 必须是布尔值")
		}
	}
	return nil
}

func validatePreheatExecutionStop(body map[string]any) error {
	if err := validateAllowedFields(body, "status"); err != nil {
		return err
	}
	status, _ := body["status"].(string)
	if !strings.EqualFold(status, "Stopped") {
		return errors.New("停止预热执行时 status 必须是 Stopped")
	}
	return nil
}

func validPreheatName(value string) bool {
	for index, character := range value {
		alphaNumeric := (character >= 'a' && character <= 'z') || (character >= 'A' && character <= 'Z') || (character >= '0' && character <= '9')
		if alphaNumeric {
			continue
		}
		if character != '.' && character != '_' && character != '-' {
			return false
		}
		if index == 0 || index == len(value)-1 {
			return false
		}
		previous := value[index-1]
		if previous == '.' || previous == '_' || previous == '-' {
			return false
		}
	}
	return value != ""
}
