package app

import (
	"strings"
	"testing"
)

func TestValidateLabelUsesHarborNameBoundary(t *testing.T) {
	valid := map[string]any{
		"name":       strings.Repeat("a", 128),
		"color":      "#2878b5",
		"scope":      "g",
		"project_id": 0,
	}
	if err := validateLabel(valid); err != nil {
		t.Fatalf("validate 128-character label: %v", err)
	}

	invalid := map[string]any{
		"name":       strings.Repeat("a", 129),
		"color":      "#2878b5",
		"scope":      "g",
		"project_id": 0,
	}
	if err := validateLabel(invalid); err == nil {
		t.Fatal("expected 129-character label name to be rejected")
	}
}
