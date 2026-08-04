package app

import (
	"errors"
	"fmt"
	"regexp"
)

func validateGCSchedule(body map[string]any) error {
	if err := validateSchedule(body); err != nil {
		return err
	}
	if err := validateAllowedFields(body, "schedule", "parameters"); err != nil {
		return err
	}
	raw, exists := body["parameters"]
	if !exists {
		return nil
	}
	parameters, ok := raw.(map[string]any)
	if !ok {
		return errors.New("垃圾清理参数必须是 JSON 对象")
	}
	if err := validateAllowedFields(parameters, "delete_untagged", "delete_tag", "dry_run", "workers"); err != nil {
		return err
	}
	for _, key := range []string{"delete_untagged", "delete_tag", "dry_run"} {
		if value, present := parameters[key]; present {
			if _, valid := value.(bool); !valid {
				return fmt.Errorf("垃圾清理参数 %s 必须是布尔值", key)
			}
		}
	}
	if value, present := parameters["workers"]; present {
		workers, valid := integerNumberValue(value)
		if !valid || workers < 1 || workers > 10 {
			return errors.New("垃圾清理并行工作数必须是 1 到 10 的整数")
		}
	}
	return nil
}

var purgeEventTypesPattern = regexp.MustCompile(`^[A-Za-z0-9_.-]+(?:,[A-Za-z0-9_.-]+)*$`)

func validatePurgeSchedule(body map[string]any) error {
	if err := validateSchedule(body); err != nil {
		return err
	}
	if err := validateAllowedFields(body, "schedule", "parameters"); err != nil {
		return err
	}
	parameters, ok := body["parameters"].(map[string]any)
	if !ok {
		return errors.New("审计日志清理必须包含 parameters 对象")
	}
	if err := validateAllowedFields(parameters, "audit_retention_hour", "dry_run", "include_event_types"); err != nil {
		return err
	}
	hours, valid := integerNumberValue(parameters["audit_retention_hour"])
	if !valid || hours < 1 || hours > 87_600_000 {
		return errors.New("审计日志保留时间必须是 1 到 87600000 小时之间的整数")
	}
	if dryRun, exists := parameters["dry_run"]; exists {
		if _, valid := dryRun.(bool); !valid {
			return errors.New("审计日志清理 dry_run 必须是布尔值")
		}
	}
	events, ok := parameters["include_event_types"].(string)
	if !ok || len(events) > 8192 || !purgeEventTypesPattern.MatchString(events) {
		return errors.New("审计日志清理事件类型必须是逗号分隔的有效事件名称")
	}
	return nil
}

func validateJobServiceAction(body map[string]any) error {
	if len(body) != 1 {
		return errors.New("Job Service 队列操作只能包含 action")
	}
	action, _ := body["action"].(string)
	if !slicesContain([]string{"stop", "pause", "resume"}, action) {
		return errors.New("Job Service 队列操作只支持 stop、pause 或 resume")
	}
	return nil
}
