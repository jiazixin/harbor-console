package app

import (
	"errors"
	"fmt"
	"strings"
)

func validateRepositoryUpdate(body map[string]any) error {
	if description, ok := body["description"]; ok {
		value, ok := description.(string)
		if !ok || len(value) > 1024 {
			return errors.New("仓库描述必须是 1024 字符以内的文本")
		}
	}
	return nil
}

func validateTagCreate(body map[string]any) error {
	name, _ := body["name"].(string)
	return validateResourceName(name, "Tag 名称", 128, false)
}

func validateArtifactLabel(body map[string]any) error {
	if err := validateAllowedFields(body, "id"); err != nil {
		return err
	}
	return validatePositiveInteger(body["id"], "标签 id")
}

func validateScanType(body map[string]any) error {
	if err := validateAllowedFields(body, "scan_type"); err != nil {
		return err
	}
	if scanType, _ := body["scan_type"].(string); scanType != "vulnerability" && scanType != "sbom" {
		return errors.New("scan_type 必须是 vulnerability 或 sbom")
	}
	return nil
}

func validateOptionalScanType(body map[string]any) error {
	if len(body) == 0 {
		return nil
	}
	return validateScanType(body)
}

func validateCVEAllowlist(body map[string]any) error {
	if err := validateAllowedFields(body, "id", "project_id", "expires_at", "items"); err != nil {
		return err
	}
	if expiresAt, exists := body["expires_at"]; exists && expiresAt != nil {
		value, ok := integerNumberValue(expiresAt)
		if !ok || value <= 0 {
			return errors.New("CVE Allowlist 的 expires_at 必须是正整数时间戳或 null")
		}
	}
	if id, exists := body["id"]; exists && id != nil {
		value, ok := integerNumberValue(id)
		if !ok || value <= 0 {
			return errors.New("CVE Allowlist 的 id 必须是正整数")
		}
	}
	if projectID, exists := body["project_id"]; exists && projectID != nil {
		value, ok := integerNumberValue(projectID)
		if !ok || value < 0 {
			return errors.New("CVE Allowlist 的 project_id 必须是 0 或正整数")
		}
	}
	items, ok := body["items"].([]any)
	if !ok || len(items) > 1000 {
		return errors.New("CVE Allowlist 的 items 必须是数量不超过 1000 的数组")
	}
	seen := make(map[string]bool, len(items))
	for index, raw := range items {
		item, objectOK := raw.(map[string]any)
		if !objectOK {
			return fmt.Errorf("第 %d 个 CVE 条目必须是 JSON 对象", index+1)
		}
		if err := validateAllowedFields(item, "cve_id"); err != nil {
			return fmt.Errorf("第 %d 个 CVE 条目无效：%w", index+1, err)
		}
		cveID, _ := item["cve_id"].(string)
		if !validCVEID(cveID) {
			return fmt.Errorf("第 %d 个 CVE 编号格式无效", index+1)
		}
		if seen[cveID] {
			return fmt.Errorf("CVE 编号 %s 重复", cveID)
		}
		seen[cveID] = true
	}
	return nil
}

func validCVEID(value string) bool {
	if len(value) < 13 || len(value) > 32 || !strings.HasPrefix(value, "CVE-") {
		return false
	}
	parts := strings.Split(value, "-")
	if len(parts) != 3 || len(parts[1]) != 4 || len(parts[2]) < 4 {
		return false
	}
	for _, part := range parts[1:] {
		for _, character := range part {
			if character < '0' || character > '9' {
				return false
			}
		}
	}
	return true
}

func validateCVEExport(body map[string]any) error {
	if err := validateAllowedFields(body, "job_name", "projects", "labels", "repositories", "cveIds", "tags"); err != nil {
		return err
	}
	projects, ok := body["projects"].([]any)
	projectID, validProject := int64(0), false
	if ok && len(projects) == 1 {
		projectID, validProject = integerNumberValue(projects[0])
	}
	if !ok || len(projects) != 1 || !validProject || projectID <= 0 {
		return errors.New("CVE 导出当前必须选择且只能选择一个有效项目")
	}
	if labels, exists := body["labels"]; exists {
		values, arrayOK := labels.([]any)
		if !arrayOK || len(values) > 100 {
			return errors.New("CVE 导出 labels 必须是数量不超过 100 的数组")
		}
		for _, value := range values {
			labelID, valid := integerNumberValue(value)
			if !valid || labelID <= 0 {
				return errors.New("CVE 导出 labels 只能包含正整数")
			}
		}
	}
	for _, field := range []string{"job_name", "repositories", "cveIds", "tags"} {
		if raw, exists := body[field]; exists && raw != nil {
			value, text := raw.(string)
			if !text || len(value) > 2048 || strings.ContainsAny(value, "\r\n\x00") {
				return fmt.Errorf("CVE 导出的 %s 必须是 2048 个字符以内的单行文本", field)
			}
		}
	}
	return nil
}
