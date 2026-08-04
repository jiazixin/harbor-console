package app

import (
	"strings"
	"time"
)

func demoVulnerabilityReport() map[string]any {
	items := []any{
		map[string]any{"id": "CVE-2026-1842", "package": "libssl3", "version": "3.4.0-r1", "fix_version": "3.4.1-r0", "severity": "Critical", "description": "OpenSSL 边界检查缺陷"},
		map[string]any{"id": "CVE-2026-0917", "package": "busybox", "version": "1.37.0-r3", "fix_version": "1.37.0-r5", "severity": "High", "description": "归档解包路径验证缺陷"},
		map[string]any{"id": "CVE-2025-52881", "package": "zlib", "version": "1.3.1-r1", "fix_version": "1.3.1-r2", "severity": "Medium", "description": "特制输入导致资源消耗"},
	}
	return map[string]any{"generated_at": time.Now().UTC().Format(time.RFC3339), "scanner": map[string]any{"name": "Trivy", "version": "v0.57.1"}, "severity": "Critical", "vulnerabilities": items}
}

func demoSecurityVulnerabilities() []map[string]any {
	return []map[string]any{
		{"project_id": 1, "repository_name": "platform/gateway", "digest": "sha256:41bf0e3b54f9a760a6c1f0b170507173bf6d95f2e8db4dd79f858f31f36c28a4", "tags": []any{"v3.18.4", "stable"}, "cve_id": "CVE-2026-1842", "severity": "Critical", "status": "fixed", "cvss_v3_score": 9.8, "package": "libssl3", "version": "3.4.0-r1", "fixed_version": "3.4.1-r0", "desc": "OpenSSL 边界检查缺陷", "links": []any{"https://nvd.nist.gov/vuln/detail/CVE-2026-1842"}},
		{"project_id": 1, "repository_name": "platform/gateway", "digest": "sha256:41bf0e3b54f9a760a6c1f0b170507173bf6d95f2e8db4dd79f858f31f36c28a4", "tags": []any{"v3.18.4", "stable"}, "cve_id": "CVE-2026-0917", "severity": "High", "status": "fixed", "cvss_v3_score": 8.1, "package": "busybox", "version": "1.37.0-r3", "fixed_version": "1.37.0-r5", "desc": "归档解包路径验证缺陷", "links": []any{"https://nvd.nist.gov/vuln/detail/CVE-2026-0917"}},
		{"project_id": 1, "repository_name": "platform/worker", "digest": "sha256:9fbc61f1d0ee55d7d0485ca645fd73ec56ae6eea483a8514cf6b611fc4b66f9e", "tags": []any{"v2.8.0"}, "cve_id": "CVE-2025-52881", "severity": "Medium", "status": "will_not_fix", "cvss_v3_score": 6.5, "package": "zlib", "version": "1.3.1-r1", "fixed_version": "1.3.1-r2", "desc": "特制输入导致资源消耗", "links": []any{"https://nvd.nist.gov/vuln/detail/CVE-2025-52881"}},
		{"project_id": 2, "repository_name": "commerce/checkout", "digest": "sha256:7af722317aba03d9fb414579251fb58a17d4a2569c4068635a86fab748959e0f", "tags": []any{"v8.2.1"}, "cve_id": "CVE-2026-1842", "severity": "Critical", "status": "fixed", "cvss_v3_score": 9.8, "package": "libssl3", "version": "3.4.0-r1", "fixed_version": "3.4.1-r0", "desc": "OpenSSL 边界检查缺陷", "links": []any{"https://nvd.nist.gov/vuln/detail/CVE-2026-1842"}},
	}
}

func filterDemoSecurityVulnerabilities(items []map[string]any, query string) []map[string]any {
	result := append([]map[string]any(nil), items...)
	for _, key := range []string{"cve_id", "severity", "status", "repository_name", "package", "digest"} {
		if expected := demoQueryString(query, key); expected != "" {
			filtered := make([]map[string]any, 0, len(result))
			for _, item := range result {
				if strings.EqualFold(stringValue(item[key]), expected) {
					filtered = append(filtered, item)
				}
			}
			result = filtered
		}
	}
	if projectID := demoQueryNumber(query, "project_id"); projectID > 0 {
		filtered := make([]map[string]any, 0, len(result))
		for _, item := range result {
			if numberValue(item["project_id"]) == projectID {
				filtered = append(filtered, item)
			}
		}
		result = filtered
	}
	if expectedTag := demoQueryString(query, "tag"); expectedTag != "" {
		filtered := make([]map[string]any, 0, len(result))
		for _, item := range result {
			for _, rawTag := range asAnySlice(item["tags"]) {
				if strings.EqualFold(stringValue(rawTag), expectedTag) {
					filtered = append(filtered, item)
					break
				}
			}
		}
		result = filtered
	}
	return result
}

func demoSecuritySummary(vulnerabilities []map[string]any, artifacts map[string][]map[string]any) map[string]any {
	summary := map[string]any{"critical_cnt": 0, "high_cnt": 0, "medium_cnt": 0, "low_cnt": 0, "none_cnt": 0, "unknown_cnt": 0, "total_vuls": len(vulnerabilities), "fixable_cnt": 0}
	dangerousCVEs := make([]any, 0)
	seenCVEs := make(map[string]bool)
	artifactCounts := make(map[string]map[string]any)
	for _, vulnerability := range vulnerabilities {
		severity := strings.ToLower(stringValue(vulnerability["severity"]))
		key := severity + "_cnt"
		summary[key] = int(numberValue(summary[key])) + 1
		if stringValue(vulnerability["fixed_version"]) != "" {
			summary["fixable_cnt"] = int(numberValue(summary["fixable_cnt"])) + 1
		}
		cveID := stringValue(vulnerability["cve_id"])
		if !seenCVEs[cveID] && len(dangerousCVEs) < 5 {
			dangerousCVEs = append(dangerousCVEs, map[string]any{"cve_id": cveID, "severity": vulnerability["severity"], "cvss_score_v3": vulnerability["cvss_v3_score"], "desc": vulnerability["desc"], "package": vulnerability["package"], "version": vulnerability["version"]})
			seenCVEs[cveID] = true
		}
		artifactKey := stringValue(vulnerability["repository_name"]) + "@" + stringValue(vulnerability["digest"])
		entry := artifactCounts[artifactKey]
		if entry == nil {
			entry = map[string]any{"project_id": vulnerability["project_id"], "repository_name": vulnerability["repository_name"], "digest": vulnerability["digest"], "critical_cnt": 0, "high_cnt": 0, "medium_cnt": 0}
			artifactCounts[artifactKey] = entry
		}
		if severity == "critical" || severity == "high" || severity == "medium" {
			entry[severity+"_cnt"] = int(numberValue(entry[severity+"_cnt"])) + 1
		}
	}
	totalArtifacts := 0
	for _, repositoryArtifacts := range artifacts {
		totalArtifacts += len(repositoryArtifacts)
	}
	dangerousArtifacts := make([]any, 0, len(artifactCounts))
	for _, entry := range artifactCounts {
		dangerousArtifacts = append(dangerousArtifacts, entry)
	}
	summary["scanned_cnt"] = len(artifactCounts)
	summary["total_artifact"] = totalArtifacts
	summary["dangerous_cves"] = dangerousCVEs
	summary["dangerous_artifacts"] = dangerousArtifacts
	return summary
}

func demoCVEExportCSV() string {
	return "CVE ID,Severity,Repository,Tag,Package,Installed Version,Fixed Version\nCVE-2026-1842,Critical,platform/gateway,v3.18.4,libssl3,3.4.0-r1,3.4.1-r0\nCVE-2026-0917,High,platform/gateway,v3.18.4,busybox,1.37.0-r3,1.37.0-r5\n"
}
