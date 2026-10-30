package app

func validateLabel(body map[string]any) error {
	name, _ := body["name"].(string)
	if err := validateResourceName(resourceNameValidation{value: name, path: "name", maximum: 128, allowSpaces: true}); err != nil {
		return err
	}
	if color, ok := body["color"].(string); ok && color != "" {
		if !validHexColor(color) {
			return invalidField("color", "invalid_color", "must use the #RRGGBB format")
		}
	}
	if scope, ok := body["scope"].(string); ok && scope != "g" && scope != "p" {
		return invalidField("scope", "invalid_value", "must be g or p")
	}
	if body["scope"] == "p" {
		if err := validatePositiveInteger(body["project_id"], "project_id"); err != nil {
			return err
		}
	}
	return nil
}

func validHexColor(value string) bool {
	if len(value) != 7 || value[0] != '#' {
		return false
	}
	for _, character := range value[1:] {
		if !((character >= '0' && character <= '9') || (character >= 'a' && character <= 'f') || (character >= 'A' && character <= 'F')) {
			return false
		}
	}
	return true
}
