package main

import (
	"net/url"
	"strings"
	"time"
)

const demoArtifactIconDigest = "sha256:75d8e7440af4f5d4d9a67f8d9237fd08e9e2713ae34c73d369e1f2a5c7051a12"

func demoDashboard() map[string]any {
	return map[string]any{
		"mode": "demo",
		"instance": map[string]any{
			"instance_url": "https://harbor.demo.local",
			"username":     "demo-admin",
			"demo":         true,
			"expires_at":   time.Now().Add(sessionTTL).UTC().Format(time.RFC3339),
		},
		"health": map[string]any{"status": "healthy", "components": []any{
			map[string]any{"name": "core", "status": "healthy"},
			map[string]any{"name": "database", "status": "healthy"},
			map[string]any{"name": "jobservice", "status": "healthy"},
			map[string]any{"name": "registry", "status": "healthy"},
			map[string]any{"name": "redis", "status": "healthy"},
		}},
		"statistics": map[string]any{
			"total_project_count": 12, "public_project_count": 3, "private_project_count": 9,
			"total_repo_count": 86, "public_repo_count": 14, "private_repo_count": 72,
			"total_storage_consumption": 438912430080,
		},
		"systeminfo": map[string]any{
			"harbor_version": "v2.15.2", "auth_mode": "oidc_auth", "registry_url": "harbor.demo.local",
			"project_creation_restriction": "adminonly", "self_registration": false, "read_only": false,
			"has_ca_root": true,
		},
		"projects":             demoProjects(),
		"replications":         demoReplications(),
		"replication_policies": mustDemoResource("replication-policies"),
		"registries":           demoRegistries(),
		"scanners":             demoScanners(),
		"warnings":             []string{},
	}
}

func demoResource(kind string, query url.Values) (any, bool) {
	switch kind {
	case "projects":
		return demoProjects(), true
	case "repositories":
		project := query.Get("project")
		if project == "" {
			project = "platform"
		}
		return demoRepositories(project), true
	case "artifacts":
		return demoArtifacts(query.Get("project"), query.Get("repository")), true
	case "replication-policies":
		return []any{
			map[string]any{"id": 1, "name": "production-mirror", "description": "生产发布镜像定时同步", "enabled": true, "creation_time": "2026-07-12T08:00:00Z", "update_time": "2026-07-28T06:21:44Z", "trigger": map[string]any{"type": "scheduled", "trigger_settings": map[string]any{"cron": "0 0 */2 * * *"}}, "src_registry": map[string]any{"id": 0}, "dest_registry": map[string]any{"id": 1, "name": "prod-registry"}, "dest_namespace": "production", "dest_namespace_replace_count": 1, "filters": []any{map[string]any{"type": "name", "value": "platform/**"}, map[string]any{"type": "tag", "value": "release-*", "decoration": "matches"}}, "replicate_deletion": false, "override": true, "speed": 2048, "copy_by_chunk": true, "single_active_replication": true},
			map[string]any{"id": 2, "name": "edge-on-push", "description": "镜像推送后同步到边缘仓库", "enabled": true, "creation_time": "2026-06-19T09:30:00Z", "update_time": "2026-07-26T14:10:00Z", "trigger": map[string]any{"type": "event_based", "trigger_settings": map[string]any{}}, "src_registry": map[string]any{"id": 0}, "dest_registry": map[string]any{"id": 2, "name": "edge-shanghai"}, "filters": []any{map[string]any{"type": "resource", "value": "image"}}, "replicate_deletion": true, "override": false, "speed": -1, "single_active_replication": false},
			map[string]any{"id": 3, "name": "weekly-backup", "description": "从云端仓库拉取归档镜像", "enabled": false, "creation_time": "2026-05-03T01:00:00Z", "update_time": "2026-07-22T01:30:00Z", "trigger": map[string]any{"type": "scheduled", "trigger_settings": map[string]any{"cron": "0 30 1 * * 1"}}, "src_registry": map[string]any{"id": 3, "name": "cold-backup"}, "dest_registry": map[string]any{"id": 0}, "dest_namespace_replace_count": -1, "filters": []any{map[string]any{"type": "name", "value": "archive/**"}}, "replicate_deletion": false, "override": false, "speed": -1, "copy_by_chunk": false, "single_active_replication": true},
		}, true
	case "replications":
		return demoReplications(), true
	case "registries":
		return demoRegistries(), true
	case "scanners":
		return demoScanners(), true
	case "audit-logs":
		return demoAuditLogs(), true
	case "systeminfo":
		return demoDashboard()["systeminfo"], true
	case "volumes":
		return map[string]any{"storage": []any{
			map[string]any{"total": 1099511627776, "free": 660599197696},
		}}, true
	case "health":
		return demoDashboard()["health"], true
	default:
		return nil, false
	}
}

func demoProjects() []any {
	return []any{
		map[string]any{"project_id": 1, "name": "platform", "repo_count": 24, "creation_time": "2025-11-18T08:20:00Z", "update_time": "2026-07-28T06:42:00Z", "metadata": map[string]any{"public": "false", "auto_scan": "true", "prevent_vul": "true", "severity": "high"}},
		map[string]any{"project_id": 2, "name": "commerce", "repo_count": 18, "creation_time": "2025-12-03T03:12:00Z", "update_time": "2026-07-28T05:09:00Z", "metadata": map[string]any{"public": "false", "auto_scan": "true", "prevent_vul": "true", "severity": "critical"}},
		map[string]any{"project_id": 3, "name": "data-pipeline", "repo_count": 15, "creation_time": "2026-01-12T10:30:00Z", "update_time": "2026-07-27T14:18:00Z", "metadata": map[string]any{"public": "false", "auto_scan": "true", "prevent_vul": "false", "severity": "critical"}},
		map[string]any{"project_id": 4, "name": "edge", "repo_count": 11, "creation_time": "2026-02-22T11:44:00Z", "update_time": "2026-07-26T23:06:00Z", "metadata": map[string]any{"public": "true", "auto_scan": "true", "prevent_vul": "false", "severity": "high"}},
		map[string]any{"project_id": 5, "name": "observability", "repo_count": 9, "creation_time": "2026-03-08T02:18:00Z", "update_time": "2026-07-25T08:57:00Z", "metadata": map[string]any{"public": "false", "auto_scan": "true", "prevent_vul": "true", "severity": "high"}},
		map[string]any{"project_id": 6, "name": "sandbox", "repo_count": 9, "creation_time": "2026-05-14T09:15:00Z", "update_time": "2026-07-24T19:31:00Z", "metadata": map[string]any{"public": "true", "auto_scan": "false", "prevent_vul": "false", "severity": "critical"}},
	}
}

func demoRepositories(project string) []any {
	base := []any{
		map[string]any{"id": 101, "name": project + "/gateway", "artifact_count": 28, "pull_count": 18462, "creation_time": "2026-01-08T08:24:00Z", "update_time": "2026-07-28T06:42:00Z"},
		map[string]any{"id": 102, "name": project + "/worker", "artifact_count": 16, "pull_count": 9317, "creation_time": "2026-02-11T12:10:00Z", "update_time": "2026-07-28T03:11:00Z"},
		map[string]any{"id": 103, "name": project + "/web", "artifact_count": 41, "pull_count": 26380, "creation_time": "2025-12-22T04:19:00Z", "update_time": "2026-07-27T21:04:00Z"},
		map[string]any{"id": 104, "name": project + "/migrations", "artifact_count": 8, "pull_count": 2104, "creation_time": "2026-03-19T09:08:00Z", "update_time": "2026-07-26T18:47:00Z"},
		map[string]any{"id": 105, "name": project + "/runtime-base", "artifact_count": 12, "pull_count": 31092, "creation_time": "2026-01-27T16:31:00Z", "update_time": "2026-07-24T07:25:00Z"},
	}
	return base
}

func demoArtifacts(project, repository string) []any {
	if project == "" {
		project = "platform"
	}
	if repository == "" {
		repository = project + "/gateway"
	}
	_ = repository
	artifacts := []any{
		artifact("sha256:41bf0e3b54f9a760a6c1f0b170507173bf6d95f2e8db4dd79f858f31f36c28a4", "v3.18.4", 184968312, "2026-07-28T06:42:00Z", 0, 0, 2, 11, 37),
		artifact("sha256:9fbc61f1d0ee55d7d0485ca645fd73ec56ae6eea483a8514cf6b611fc4b66f9e", "v3.18.3", 184782641, "2026-07-26T15:20:00Z", 1, 3, 6, 18, 42),
		artifact("sha256:63b54a12f28adfeaa30b233441266073669c2f951995a75a975ac9712fb218c6", "canary-7d12f9", 185301820, "2026-07-25T22:31:00Z", 0, 1, 4, 15, 39),
		artifact("sha256:e8cd42e7fc8a214be8653295582340fc45616df8c7938854c5ddaffd4a71339f", "v3.17.9", 181954112, "2026-07-19T11:05:00Z", 2, 6, 13, 29, 54),
		artifact("sha256:b4604fe30f9785345f61cb34209c2aa3053b67e24dd321caec892820646d9911", "v3.17.8", 181837281, "2026-07-12T08:48:00Z", 0, 2, 8, 21, 47),
	}
	multiArchitecture := artifacts[0].(map[string]any)
	multiArchitecture["icon"] = demoArtifactIconDigest
	multiArchitecture["annotations"] = map[string]any{
		"org.opencontainers.image.source":        "https://git.example.internal/platform/gateway",
		"org.opencontainers.image.revision":      "5d4a8a79fc3f",
		"org.opencontainers.image.version":       "v3.18.4",
		"org.opencontainers.image.documentation": "https://docs.example.internal/gateway/releases/v3.18.4",
	}
	multiArchitecture["manifest_media_type"] = "application/vnd.oci.image.index.v1+json"
	multiArchitecture["extra_attrs"] = map[string]any{}
	multiArchitecture["references"] = []any{
		map[string]any{"parent_id": 1001, "child_id": 1002, "child_digest": "sha256:189badc21f5408801364f4f59ee1408160992896397e968072130166ddad2c7c", "platform": map[string]any{"os": "linux", "architecture": "amd64"}},
		map[string]any{"parent_id": 1001, "child_id": 1003, "child_digest": "sha256:cf2df80ad906b495d13f65e450bfdbe64962b0b567886143a3200dd2b2b46861", "platform": map[string]any{"os": "linux", "architecture": "arm64", "variant": "v8"}},
		map[string]any{"parent_id": 1001, "child_id": 1004, "child_digest": "sha256:8f6b16ca32b11c525188e7005b2cf5766faf575ec55a95a302542b4c3226a608", "platform": map[string]any{"os": "linux", "architecture": "ppc64le"}},
	}
	chart := artifacts[3].(map[string]any)
	chart["type"] = "CHART"
	chart["media_type"] = "application/vnd.cncf.helm.chart.content.v1.tar+gzip"
	return artifacts
}

func demoChildArtifacts(parent map[string]any) []map[string]any {
	references, _ := parent["references"].([]any)
	children := make([]map[string]any, 0, len(references))
	for _, rawReference := range references {
		reference, ok := rawReference.(map[string]any)
		if !ok || stringValue(reference["child_digest"]) == "" {
			continue
		}
		platform, _ := reference["platform"].(map[string]any)
		child := map[string]any{
			"id":                  reference["child_id"],
			"digest":              reference["child_digest"],
			"size":                numberValue(parent["size"]) / int64(len(references)),
			"push_time":           parent["push_time"],
			"pull_time":           parent["pull_time"],
			"type":                "IMAGE",
			"media_type":          "application/vnd.oci.image.config.v1+json",
			"manifest_media_type": "application/vnd.oci.image.manifest.v1+json",
			"extra_attrs":         cloneMap(platform),
			"tags":                []any{},
			"labels":              []any{},
			"references":          []any{},
			"demo_child":          true,
		}
		if overview, ok := parent["scan_overview"].(map[string]any); ok {
			child["scan_overview"] = cloneMap(overview)
		}
		children = append(children, child)
	}
	return children
}

func artifact(digest, tag string, size int64, pushed string, critical, high, medium, low, negligible int) map[string]any {
	return map[string]any{
		"digest": digest, "size": size, "push_time": pushed, "pull_time": pushed,
		"type": "IMAGE", "media_type": "application/vnd.oci.image.config.v1+json", "manifest_media_type": "application/vnd.oci.image.manifest.v1+json",
		"extra_attrs": map[string]any{"os": "linux", "architecture": "amd64"},
		"tags":        []any{map[string]any{"name": tag, "push_time": pushed}},
		"scan_overview": map[string]any{"application/vnd.scanner.adapter.vuln.report.harbor+json; version=1.0": map[string]any{
			"scan_status": "Success", "severity": severityName(critical, high, medium), "report_id": "demo-vuln-" + strings.TrimPrefix(digest, "sha256:")[:12],
			"summary": map[string]any{"total": critical + high + medium + low + negligible, "summary": map[string]any{"Critical": critical, "High": high, "Medium": medium, "Low": low, "Negligible": negligible}},
		}},
	}
}

func severityName(critical, high, medium int) string {
	if critical > 0 {
		return "Critical"
	}
	if high > 0 {
		return "High"
	}
	if medium > 0 {
		return "Medium"
	}
	return "Low"
}

func demoReplications() []any {
	return []any{
		map[string]any{"id": 904, "policy_id": 1, "status": "Succeed", "trigger": "scheduled", "start_time": "2026-07-28T06:00:01Z", "end_time": "2026-07-28T06:02:14Z", "total": 18, "succeed": 18, "failed": 0, "in_progress": 0, "stopped": 0},
		map[string]any{"id": 903, "policy_id": 2, "status": "InProgress", "trigger": "event_based", "start_time": "2026-07-28T05:09:22Z", "end_time": "", "total": 2, "succeed": 1, "failed": 0, "in_progress": 1, "stopped": 0},
		map[string]any{"id": 902, "policy_id": 1, "status": "Succeed", "trigger": "scheduled", "start_time": "2026-07-28T04:00:00Z", "end_time": "2026-07-28T04:01:51Z", "total": 15, "succeed": 15, "failed": 0, "in_progress": 0, "stopped": 0},
		map[string]any{"id": 901, "policy_id": 2, "status": "Failed", "trigger": "event_based", "start_time": "2026-07-27T22:15:19Z", "end_time": "2026-07-27T22:16:03Z", "total": 3, "succeed": 2, "failed": 1, "in_progress": 0, "stopped": 0},
	}
}

func demoRegistries() []any {
	return []any{
		map[string]any{"id": 1, "name": "prod-registry", "type": "harbor", "url": "https://registry.prod.internal", "status": "healthy", "creation_time": "2025-11-20T04:30:00Z"},
		map[string]any{"id": 2, "name": "edge-shanghai", "type": "docker-hub", "url": "https://hub.docker.com", "status": "healthy", "creation_time": "2026-01-14T09:45:00Z"},
		map[string]any{"id": 3, "name": "cold-backup", "type": "aws-ecr", "url": "https://123456789.dkr.ecr.ap-east-1.amazonaws.com", "status": "healthy", "creation_time": "2026-02-09T13:22:00Z"},
	}
}

func demoScanners() []any {
	return []any{
		map[string]any{"uuid": "trivy-adapter-demo", "name": "Trivy", "description": "Aqua Security Trivy vulnerability scanner", "url": "http://trivy-adapter:8080", "is_default": true, "auth": "None", "health": "healthy", "version": "v0.57.1"},
	}
}

func demoAuditLogs() []any {
	return []any{
		map[string]any{"id": 48320, "username": "ci-bot", "resource": "platform/gateway:v3.18.4", "resource_type": "artifact", "operation": "push", "operation_description": "push artifact manifest and blobs", "operation_result": true, "op_time": "2026-07-28T06:42:05Z"},
		map[string]any{"id": 48319, "username": "release-engineer", "resource": "commerce/checkout:v8.2.1", "resource_type": "artifact", "operation": "pull", "operation_description": "pull artifact", "operation_result": true, "op_time": "2026-07-28T06:39:18Z"},
		map[string]any{"id": 48318, "username": "admin", "resource": "production-mirror", "resource_type": "replication", "operation": "create_replication_policy", "operation_description": "create replication policy", "operation_result": true, "op_time": "2026-07-28T06:21:44Z"},
		map[string]any{"id": 48317, "username": "ci-bot", "resource": "data-pipeline/scheduler:canary", "resource_type": "artifact", "operation": "push", "operation_description": "push artifact manifest", "operation_result": false, "op_time": "2026-07-28T06:12:07Z"},
		map[string]any{"id": 48316, "username": "security-reviewer", "resource": "platform/runtime-base:v4.5", "resource_type": "artifact", "operation": "scan", "operation_description": "trigger vulnerability scan", "operation_result": true, "op_time": "2026-07-28T05:58:56Z"},
		map[string]any{"id": 48315, "username": "replication", "resource": "edge-shanghai", "resource_type": "registry", "operation": "pull", "operation_description": "pull artifact from remote registry", "operation_result": true, "op_time": "2026-07-28T05:09:48Z"},
	}
}

func demoSearch(term string) map[string]any {
	term = strings.ToLower(term)
	projects := make([]any, 0)
	for _, item := range demoProjects() {
		project := item.(map[string]any)
		if strings.Contains(strings.ToLower(project["name"].(string)), term) {
			projects = append(projects, map[string]any{"project_id": project["project_id"], "name": project["name"], "public": project["metadata"].(map[string]any)["public"] == "true"})
		}
	}
	repositories := make([]any, 0)
	for _, item := range demoRepositories("platform") {
		repo := item.(map[string]any)
		if strings.Contains(strings.ToLower(repo["name"].(string)), term) {
			repositories = append(repositories, map[string]any{"repository_name": repo["name"], "project_id": 1, "project_name": "platform", "artifact_count": repo["artifact_count"]})
		}
	}
	return map[string]any{"project": projects, "repository": repositories}
}
