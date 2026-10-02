package app

import (
	"errors"
	"fmt"
	"math"
	"net/url"
	"regexp"
	"strconv"
	"strings"
)

var replicationNamespacePattern = regexp.MustCompile(`^[a-z0-9]+(?:[/._-][a-z0-9]+)*$`)

func validateReplicationPolicy(body map[string]any) error {
	if err := validateAllowedFields(body,
		"name", "description", "src_registry", "dest_registry", "dest_namespace", "dest_namespace_replace_count",
		"trigger", "filters", "replicate_deletion", "override", "enabled", "speed", "copy_by_chunk", "single_active_replication",
	); err != nil {
		return err
	}
	name, _ := body["name"].(string)
	if err := validateResourceName(name, "策略名称", 255, true); err != nil {
		return err
	}
	if raw, exists := body["description"]; exists {
		description, ok := raw.(string)
		if !ok || exceedsCharacterLimit(description, 1024) || strings.ContainsRune(description, '\x00') {
			return errors.New("策略描述必须是 1024 个字符以内的文本")
		}
	}

	sourceID, sourceSet, err := replicationRegistryID(body["src_registry"], "src_registry")
	if err != nil {
		return err
	}
	destinationID, destinationSet, err := replicationRegistryID(body["dest_registry"], "dest_registry")
	if err != nil {
		return err
	}
	if sourceSet == destinationSet {
		return errors.New("src_registry 与 dest_registry 必须且只能设置一个")
	}

	if raw, exists := body["dest_namespace"]; exists && raw != nil {
		namespace, ok := raw.(string)
		if !ok || len(namespace) > 255 || (namespace != "" && !replicationNamespacePattern.MatchString(namespace)) {
			return errors.New("dest_namespace 必须是 255 个字符以内的小写命名空间路径")
		}
	}
	if raw, exists := body["dest_namespace_replace_count"]; exists && raw != nil {
		level, ok := integerNumberValue(raw)
		if !ok || !slicesContain([]string{"-1", "0", "1", "2", "3"}, strconv.FormatInt(level, 10)) {
			return errors.New("dest_namespace_replace_count 必须是 -1、0、1、2 或 3")
		}
	}

	triggerType, err := validateReplicationTrigger(body["trigger"])
	if err != nil {
		return err
	}
	if err := validateReplicationFilters(body["filters"]); err != nil {
		return err
	}

	booleanFields := []string{"replicate_deletion", "override", "enabled", "copy_by_chunk", "single_active_replication"}
	for _, field := range booleanFields {
		if raw, exists := body[field]; exists && raw != nil {
			if _, ok := raw.(bool); !ok {
				return fmt.Errorf("%s 必须是布尔值", field)
			}
		}
	}
	deletion := false
	if value, ok := body["replicate_deletion"].(bool); ok {
		deletion = value
	}
	if deletion && (triggerType != "event_based" || sourceSet || destinationID <= 0) {
		return errors.New("同步删除仅适用于推送方向的事件触发策略")
	}
	if single, _ := body["single_active_replication"].(bool); single && triggerType == "event_based" {
		return errors.New("事件触发策略不支持单活执行")
	}

	if raw, exists := body["speed"]; exists && raw != nil {
		speed, ok := integerNumberValue(raw)
		if !ok || speed == 0 || speed < -1 || speed > math.MaxInt32 {
			return errors.New("speed 必须是 -1（不限速）或不超过 2147483647 的正整数 Kbps")
		}
	}
	_ = sourceID
	return nil
}

func replicationRegistryID(raw any, field string) (int64, bool, error) {
	if raw == nil {
		return 0, false, nil
	}
	registry, ok := raw.(map[string]any)
	if !ok {
		return 0, false, fmt.Errorf("%s 必须是只包含 id 的对象或 null", field)
	}
	if err := validateAllowedFields(registry, "id"); err != nil {
		return 0, false, fmt.Errorf("%s 无效：%w", field, err)
	}
	id, ok := integerNumberValue(registry["id"])
	if !ok || id <= 0 {
		return 0, false, fmt.Errorf("%s.id 必须是正整数", field)
	}
	return id, true, nil
}

func validateReplicationTrigger(raw any) (string, error) {
	trigger, ok := raw.(map[string]any)
	if !ok {
		return "", errors.New("trigger 必须是 JSON 对象")
	}
	if err := validateAllowedFields(trigger, "type", "trigger_settings"); err != nil {
		return "", fmt.Errorf("trigger 无效：%w", err)
	}
	triggerType, _ := trigger["type"].(string)
	if !slicesContain([]string{"manual", "event_based", "scheduled"}, triggerType) {
		return "", errors.New("trigger.type 必须是 manual、event_based 或 scheduled")
	}
	settingsRaw, exists := trigger["trigger_settings"]
	if !exists || settingsRaw == nil {
		settingsRaw = map[string]any{}
	}
	settings, ok := settingsRaw.(map[string]any)
	if !ok {
		return "", errors.New("trigger.trigger_settings 必须是 JSON 对象")
	}
	if err := validateAllowedFields(settings, "cron"); err != nil {
		return "", fmt.Errorf("trigger.trigger_settings 无效：%w", err)
	}
	cron := ""
	if rawCron, exists := settings["cron"]; exists {
		var text bool
		cron, text = rawCron.(string)
		if !text || len(cron) > 255 || strings.ContainsAny(cron, "\r\n\x00") {
			return "", errors.New("trigger.trigger_settings.cron 必须是 255 个字符以内的单行文本")
		}
	}
	if triggerType == "scheduled" {
		parts := strings.Fields(cron)
		if len(parts) != 6 || parts[0] != "0" || parts[1] == "*" {
			return "", errors.New("定时复制必须使用以 0 开头的六段 Harbor Cron 表达式")
		}
	} else if strings.TrimSpace(cron) != "" {
		return "", errors.New("非定时复制不能设置 Cron 表达式")
	}
	return triggerType, nil
}

func validateReplicationFilters(raw any) error {
	if raw == nil {
		return nil
	}
	filters, ok := raw.([]any)
	if !ok || len(filters) > 16 {
		return errors.New("filters 必须是数量不超过 16 的数组")
	}
	seen := make(map[string]bool, len(filters))
	for index, rawFilter := range filters {
		filter, ok := rawFilter.(map[string]any)
		if !ok {
			return fmt.Errorf("第 %d 个复制筛选器必须是 JSON 对象", index+1)
		}
		if err := validateAllowedFields(filter, "type", "value", "decoration"); err != nil {
			return fmt.Errorf("第 %d 个复制筛选器无效：%w", index+1, err)
		}
		filterType, _ := filter["type"].(string)
		if !slicesContain([]string{"name", "tag", "label", "resource"}, filterType) {
			return fmt.Errorf("第 %d 个复制筛选器 type 不受 Harbor 复制 API 支持", index+1)
		}
		if seen[filterType] {
			return fmt.Errorf("复制筛选器 type %s 不能重复", filterType)
		}
		seen[filterType] = true
		if decorationRaw, exists := filter["decoration"]; exists {
			decoration, _ := decorationRaw.(string)
			if decoration != "matches" && decoration != "excludes" {
				return fmt.Errorf("第 %d 个复制筛选器 decoration 必须是 matches 或 excludes", index+1)
			}
		}
		if filterType == "label" {
			labels, ok := filter["value"].([]any)
			if !ok || len(labels) == 0 || len(labels) > 100 {
				return fmt.Errorf("第 %d 个标签筛选器 value 必须是 1 到 100 个标签名称的数组", index+1)
			}
			for _, rawLabel := range labels {
				label, ok := rawLabel.(string)
				if !ok || strings.TrimSpace(label) == "" || exceedsCharacterLimit(label, 255) || strings.ContainsAny(label, "\r\n\x00,") {
					return fmt.Errorf("第 %d 个标签筛选器包含无效标签名称", index+1)
				}
			}
			continue
		}
		value, ok := filter["value"].(string)
		if !ok || strings.TrimSpace(value) == "" || exceedsCharacterLimit(value, 1024) || strings.ContainsAny(value, "\r\n\x00") {
			return fmt.Errorf("第 %d 个复制筛选器 value 必须是 1024 个字符以内的非空文本", index+1)
		}
	}
	return nil
}

func validateReplicationStart(body map[string]any) error {
	return validatePositiveInteger(body["policy_id"], "policy_id")
}

func validateRegistryCreate(body map[string]any) error {
	name, _ := body["name"].(string)
	if err := validateResourceName(name, "连接名称", 255, true); err != nil {
		return err
	}
	registryType, _ := body["type"].(string)
	if strings.TrimSpace(registryType) == "" {
		return errors.New("必须选择远端仓库类型")
	}
	return validateRegistryURL(body["url"])
}

func validateRegistryUpdate(body map[string]any) error {
	if raw, ok := body["url"]; ok {
		return validateRegistryURL(raw)
	}
	return nil
}

func validateRegistryPing(body map[string]any) error {
	if id, exists := body["id"]; exists {
		return validatePositiveInteger(id, "远端仓库 id")
	}
	return validateRegistryURL(body["url"])
}

func validateRegistryURL(raw any) error {
	value, _ := raw.(string)
	parsed, err := url.Parse(strings.TrimSpace(value))
	if err != nil || parsed.Host == "" || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		return errors.New("远端仓库地址必须是完整的 http:// 或 https:// URL")
	}
	if parsed.User != nil || parsed.Fragment != "" {
		return errors.New("远端仓库地址不能包含凭据或片段")
	}
	return nil
}
