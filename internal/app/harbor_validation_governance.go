package app

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"strings"
)

func validateImmutableRule(body map[string]any) error {
	tags, ok := body["tag_selectors"].([]any)
	if !ok || len(tags) == 0 {
		return errors.New("不可变规则必须包含 tag_selectors")
	}
	scopes, ok := body["scope_selectors"].(map[string]any)
	if !ok {
		return errors.New("不可变规则必须包含 scope_selectors")
	}
	repositories, ok := scopes["repository"].([]any)
	if !ok || len(repositories) == 0 {
		return errors.New("不可变规则必须包含 repository 范围")
	}
	if err := validateImmutableSelectors(tags, "Tag"); err != nil {
		return err
	}
	if err := validateImmutableSelectors(repositories, "仓库"); err != nil {
		return err
	}
	return nil
}

func validateImmutableSelectors(selectors []any, label string) error {
	for _, rawSelector := range selectors {
		selector, ok := rawSelector.(map[string]any)
		if !ok {
			return fmt.Errorf("%s 选择器必须是 JSON 对象", label)
		}
		pattern, _ := selector["pattern"].(string)
		if strings.TrimSpace(pattern) == "" || len(pattern) > 1024 || strings.ContainsAny(pattern, "\r\n\x00") {
			return fmt.Errorf("%s 匹配规则不能为空或超过 1024 个字符", label)
		}
	}
	return nil
}

func validateWebhook(body map[string]any) error {
	name, _ := body["name"].(string)
	if err := validateResourceName(name, "Webhook 名称", 255, true); err != nil {
		return err
	}
	targets, ok := body["targets"].([]any)
	if !ok || len(targets) == 0 {
		return errors.New("Webhook 必须至少包含一个 target")
	}
	if len(targets) > 10 {
		return errors.New("Webhook target 数量不能超过 10")
	}
	for _, rawTarget := range targets {
		target, ok := rawTarget.(map[string]any)
		if !ok {
			return errors.New("Webhook target 必须是 JSON 对象")
		}
		address, _ := target["address"].(string)
		parsed, err := url.Parse(strings.TrimSpace(address))
		if err != nil || parsed.Host == "" || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.User != nil {
			return errors.New("Webhook 目标地址必须是完整的 http:// 或 https:// URL，且不能包含凭据")
		}
		if authHeader, ok := target["auth_header"].(string); ok && (len(authHeader) > 4096 || strings.ContainsAny(authHeader, "\r\n\x00")) {
			return errors.New("Webhook Authorization 请求头包含无效字符或长度过长")
		}
	}
	events, ok := body["event_types"].([]any)
	if !ok || len(events) == 0 {
		return errors.New("Webhook 必须至少选择一种事件")
	}
	if len(events) > 100 {
		return errors.New("Webhook 事件类型数量过多")
	}
	return nil
}

func validateRetentionPolicy(body map[string]any) error {
	algorithm, _ := body["algorithm"].(string)
	if algorithm != "or" && algorithm != "and" {
		return errors.New("Tag 保留策略 algorithm 必须是 or 或 and")
	}
	rules, ok := body["rules"].([]any)
	if !ok || len(rules) == 0 || len(rules) > 100 {
		return errors.New("Tag 保留策略必须包含 1 到 100 条 rules")
	}
	for index, rawRule := range rules {
		rule, ok := rawRule.(map[string]any)
		if !ok {
			return fmt.Errorf("第 %d 条 Tag 保留规则必须是 JSON 对象", index+1)
		}
		if err := validateRetentionRule(rule); err != nil {
			return fmt.Errorf("第 %d 条 Tag 保留规则无效：%w", index+1, err)
		}
	}

	trigger, ok := body["trigger"].(map[string]any)
	if !ok || stringValue(trigger["kind"]) != "Schedule" {
		return errors.New("Tag 保留策略 trigger.kind 必须是 Schedule")
	}
	settings, ok := trigger["settings"].(map[string]any)
	if !ok {
		return errors.New("Tag 保留策略 trigger.settings 必须是 JSON 对象")
	}
	if cron, exists := settings["cron"]; exists {
		value, valid := cron.(string)
		if !valid || len(value) > 255 || strings.ContainsAny(value, "\r\n\x00") {
			return errors.New("Tag 保留策略 Cron 表达式无效或过长")
		}
	}

	scope, ok := body["scope"].(map[string]any)
	if !ok || stringValue(scope["level"]) != "project" || numberValue(scope["ref"]) <= 0 {
		return errors.New("Tag 保留策略 scope 必须引用有效项目")
	}
	return nil
}

func validateRetentionRule(rule map[string]any) error {
	if disabled, exists := rule["disabled"]; exists {
		if _, ok := disabled.(bool); !ok {
			return errors.New("disabled 必须是布尔值")
		}
	}
	if action, _ := rule["action"].(string); action != "retain" {
		return errors.New("action 必须是 retain")
	}
	template, _ := rule["template"].(string)
	if strings.TrimSpace(template) == "" || len(template) > 255 || strings.ContainsAny(template, "\r\n\x00") {
		return errors.New("template 不能为空或超过 255 个字符")
	}
	if params, ok := rule["params"].(map[string]any); !ok || len(params) > 32 {
		return errors.New("params 必须是参数数量不超过 32 的 JSON 对象")
	}
	tags, ok := rule["tag_selectors"].([]any)
	if !ok || len(tags) == 0 || len(tags) > 32 {
		return errors.New("tag_selectors 必须包含 1 到 32 个选择器")
	}
	scopes, ok := rule["scope_selectors"].(map[string]any)
	if !ok {
		return errors.New("scope_selectors 必须是 JSON 对象")
	}
	repositories, ok := scopes["repository"].([]any)
	if !ok || len(repositories) == 0 || len(repositories) > 32 {
		return errors.New("repository 范围必须包含 1 到 32 个选择器")
	}
	if err := validateRetentionSelectors(tags, "Tag", []string{"matches", "excludes"}); err != nil {
		return err
	}
	return validateRetentionSelectors(repositories, "仓库", []string{"repoMatches", "repoExcludes"})
}

func validateRetentionSelectors(selectors []any, label string, decorations []string) error {
	for _, rawSelector := range selectors {
		selector, ok := rawSelector.(map[string]any)
		if !ok {
			return fmt.Errorf("%s 选择器必须是 JSON 对象", label)
		}
		if stringValue(selector["kind"]) != "doublestar" {
			return fmt.Errorf("%s 选择器 kind 必须是 doublestar", label)
		}
		if !slicesContain(decorations, stringValue(selector["decoration"])) {
			return fmt.Errorf("%s 选择器 decoration 不受 Harbor 官方 API 支持", label)
		}
		pattern, _ := selector["pattern"].(string)
		if strings.TrimSpace(pattern) == "" || len(pattern) > 1024 || strings.ContainsAny(pattern, "\r\n\x00") {
			return fmt.Errorf("%s 匹配规则不能为空或超过 1024 个字符", label)
		}
		if extras, exists := selector["extras"]; exists {
			value, ok := extras.(string)
			if !ok || len(value) > 4096 || strings.ContainsAny(value, "\r\n\x00") {
				return fmt.Errorf("%s 选择器 extras 必须是 4096 字符以内的 JSON 字符串", label)
			}
			values := map[string]any{}
			if err := json.Unmarshal([]byte(value), &values); err != nil {
				return fmt.Errorf("%s 选择器 extras 必须包含有效的 JSON 对象", label)
			}
			if untagged, exists := values["untagged"]; exists {
				if _, ok := untagged.(bool); !ok {
					return fmt.Errorf("%s 选择器 extras.untagged 必须是布尔值", label)
				}
			}
		}
	}
	return nil
}

func validateRetentionExecution(body map[string]any) error {
	if len(body) != 1 {
		return errors.New("Tag 保留执行请求只能包含 dry_run")
	}
	if _, ok := body["dry_run"].(bool); !ok {
		return errors.New("dry_run 必须是布尔值")
	}
	return nil
}

func validateRetentionExecutionAction(body map[string]any) error {
	if len(body) != 1 || stringValue(body["action"]) != "stop" {
		return errors.New("Tag 保留执行操作只支持 stop")
	}
	return nil
}

func validateSchedule(body map[string]any) error {
	schedule, ok := body["schedule"].(map[string]any)
	if !ok {
		return errors.New("任务计划必须包含 schedule 对象")
	}
	typeName, _ := schedule["type"].(string)
	allowed := map[string]bool{"Hourly": true, "Daily": true, "Weekly": true, "Custom": true, "Manual": true, "None": true, "Schedule": true}
	if !allowed[typeName] {
		return errors.New("任务计划类型不受 Harbor 官方 API 支持")
	}
	if typeName == "Custom" || typeName == "Schedule" {
		cron, _ := schedule["cron"].(string)
		if strings.TrimSpace(cron) == "" || len(cron) > 255 || strings.ContainsAny(cron, "\r\n\x00") {
			return errors.New("自定义任务计划必须包含有效的 Cron 表达式")
		}
	}
	return nil
}
