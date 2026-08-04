package app

import (
	"errors"
	"fmt"
	"strings"
)

func validateScanner(body map[string]any) error {
	if err := validateAllowedFields(
		body,
		"name",
		"description",
		"url",
		"auth",
		"access_credential",
		"disabled",
		"skip_certVerify",
		"use_internal_addr",
	); err != nil {
		return err
	}
	name, _ := body["name"].(string)
	if err := validateResourceName(name, "扫描器名称", 128, true); err != nil {
		return err
	}
	description, _ := body["description"].(string)
	if exceedsCharacterLimit(description, 1024) || strings.ContainsRune(description, '\x00') {
		return errors.New("扫描器描述必须是 1024 个字符以内的文本")
	}
	url, _ := body["url"].(string)
	if exceedsCharacterLimit(url, 512) {
		return errors.New("扫描器地址不能超过 512 个字符")
	}
	if err := validateRegistryURL(body["url"]); err != nil {
		return errors.New(strings.NewReplacer("远端仓库", "扫描器").Replace(err.Error()))
	}
	auth, _ := body["auth"].(string)
	if !slicesContain([]string{"", "Basic", "Bearer", "X-ScannerAdapter-API-Key"}, auth) {
		return errors.New("扫描器认证方式不受 Harbor Scanner Adapter API 支持")
	}
	credential, _ := body["access_credential"].(string)
	if exceedsCharacterLimit(credential, 512) || strings.ContainsAny(credential, "\r\n\x00") {
		return errors.New("扫描器访问凭据不能超过 512 个字符或包含控制字符")
	}
	for _, field := range []string{"disabled", "skip_certVerify", "use_internal_addr"} {
		if value, exists := body[field]; exists {
			if _, ok := value.(bool); !ok {
				return fmt.Errorf("扫描器 %s 必须是布尔值", field)
			}
		}
	}
	return nil
}

func validateScannerDefault(body map[string]any) error {
	if _, ok := body["is_default"].(bool); !ok {
		return errors.New("is_default 必须是布尔值")
	}
	return nil
}
