package app

import "errors"

func validateQuota(body map[string]any) error {
	hard, ok := body["hard"].(map[string]any)
	if !ok || len(hard) == 0 {
		return errors.New("配额必须包含 hard 资源限制")
	}
	for resource, rawValue := range hard {
		value, valid := integerNumberValue(rawValue)
		if resource == "" || !valid || (value < 0 && value != -1) {
			return errors.New("配额值必须是 -1（不限制）或非负整数")
		}
	}
	return nil
}
