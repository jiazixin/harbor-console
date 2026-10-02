package app

import "errors"

func validateLabel(body map[string]any) error {
	name, _ := body["name"].(string)
	if err := validateResourceName(name, "标签名称", 128, true); err != nil {
		return err
	}
	if color, ok := body["color"].(string); ok && color != "" {
		if !validHexColor(color) {
			return errors.New("标签颜色必须使用 #RRGGBB 格式")
		}
	}
	if scope, ok := body["scope"].(string); ok && scope != "g" && scope != "p" {
		return errors.New("标签 scope 必须是 g 或 p")
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
