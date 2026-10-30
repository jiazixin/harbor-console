package app

func validateQuota(body map[string]any) error {
	hard, ok := body["hard"].(map[string]any)
	if !ok || len(hard) == 0 {
		return invalidField("hard", "required", "must contain resource limits")
	}
	for resource, rawValue := range hard {
		value, valid := integerNumberValue(rawValue)
		if resource == "" || !valid || (value < 0 && value != -1) {
			return invalidField("hard."+resource, "invalid_quota", "must be -1 (unlimited) or a non-negative integer")
		}
	}
	return nil
}
