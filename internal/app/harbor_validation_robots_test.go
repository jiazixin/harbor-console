package app

import "testing"

func validRobotPermissions() []any {
	return []any{
		map[string]any{
			"kind":      "system",
			"namespace": "/",
			"access": []any{
				map[string]any{"resource": "audit-log", "action": "list"},
			},
		},
	}
}

func TestValidateRobotSeparatesCreateAndUpdateContracts(t *testing.T) {
	create := map[string]any{
		"name":        "acceptance-robot",
		"description": "automation",
		"level":       "system",
		"duration":    float64(90),
		"disable":     true,
		"permissions": validRobotPermissions(),
	}
	if err := validateRobotCreate(create); err != nil {
		t.Fatalf("validate robot create: %v", err)
	}

	update := map[string]any{
		"name":        "robot$acceptance-robot",
		"description": "updated automation",
		"level":       "system",
		"duration":    float64(90),
		"disable":     true,
		"permissions": validRobotPermissions(),
	}
	if err := validateRobotUpdate(update); err != nil {
		t.Fatalf("validate robot update: %v", err)
	}

	delete(update, "name")
	if err := validateRobotUpdate(update); err == nil {
		t.Fatal("expected robot update without the current name to be rejected")
	}
}
