package app

func demoRobotPermissions(project string, writable bool) []any {
	access := []any{
		map[string]any{"resource": "repository", "action": "pull", "effect": "allow"},
		map[string]any{"resource": "repository", "action": "read", "effect": "allow"},
		map[string]any{"resource": "artifact", "action": "read", "effect": "allow"},
		map[string]any{"resource": "artifact", "action": "list", "effect": "allow"},
	}
	if writable {
		access = append(access,
			map[string]any{"resource": "repository", "action": "push", "effect": "allow"},
			map[string]any{"resource": "artifact", "action": "create", "effect": "allow"},
			map[string]any{"resource": "tag", "action": "create", "effect": "allow"},
		)
	}
	return []any{map[string]any{"kind": "project", "namespace": project, "access": access}}
}

func demoRobotNamespace(robot map[string]any) string {
	permissions, _ := robot["permissions"].([]any)
	if len(permissions) == 0 {
		return "system"
	}
	permission, _ := permissions[0].(map[string]any)
	namespace := stringValue(permission["namespace"])
	if namespace == "" {
		return "system"
	}
	return namespace
}
