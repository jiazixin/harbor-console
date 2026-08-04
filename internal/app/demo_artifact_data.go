package app

import (
	"strings"
	"time"
)

func splitDemoArtifactSource(source string) (string, string, bool) {
	if index := strings.LastIndex(source, "@"); index > 0 {
		return source[:index], source[index+1:], true
	}
	if index := strings.LastIndex(source, ":"); index > 0 {
		return source[:index], source[index+1:], true
	}
	return "", "", false
}

func findArtifact(items []map[string]any, reference string) (int, bool) {
	for index, item := range items {
		if stringValue(item["digest"]) == reference {
			return index, true
		}
		for _, tag := range tagsOf(item) {
			if stringValue(tag["name"]) == reference {
				return index, true
			}
		}
	}
	return -1, false
}

func tagsOf(artifactItem map[string]any) []map[string]any {
	raw, _ := artifactItem["tags"].([]any)
	return mapsFromAny(raw)
}

func labelsOf(artifactItem map[string]any) []map[string]any {
	raw, _ := artifactItem["labels"].([]any)
	return mapsFromAny(raw)
}

func demoArtifactAddition(addition string) (any, bool) {
	additions := map[string]any{
		"build_history": []any{
			map[string]any{"created": "2026-07-28T06:38:14Z", "created_by": "/bin/sh -c #(nop)  ENTRYPOINT [\"/gateway\"]", "empty_layer": true},
			map[string]any{"created": "2026-07-28T06:37:52Z", "created_by": "/bin/sh -c COPY gateway /gateway # buildkit", "empty_layer": false},
		},
		"values.yaml": "replicaCount: 3\nimage:\n  repository: harbor.example.com/platform/gateway\n  tag: v3.18.4\nservice:\n  type: ClusterIP\n  port: 8080\n",
		"readme.md":   "# Gateway\n\n平台统一入口服务。\n\n## 部署\n\n使用 Helm values 配置副本数、镜像和服务端口。\n",
		"dependencies": []any{
			map[string]any{"name": "alpine", "version": "3.22.1", "repository": "https://dl-cdn.alpinelinux.org/alpine"},
			map[string]any{"name": "ca-certificates", "version": "20250619-r0"},
		},
		"sbom":    map[string]any{"spdxVersion": "SPDX-2.3", "name": "platform/gateway:v3.18.4", "documentNamespace": "https://harbor.demo.local/sbom/platform-gateway-v3.18.4", "packages": []any{map[string]any{"name": "alpine-baselayout", "versionInfo": "3.7.0-r0", "licenseConcluded": "GPL-2.0-only"}, map[string]any{"name": "gateway", "versionInfo": "3.18.4", "licenseConcluded": "Apache-2.0"}}},
		"license": map[string]any{"licenses": []any{map[string]any{"id": "Apache-2.0", "name": "Apache License 2.0", "count": 1}, map[string]any{"id": "GPL-2.0-only", "name": "GNU General Public License v2.0 only", "count": 3}}},
		"files":   []any{"/gateway", "/etc/alpine-release", "/etc/ssl/certs/ca-certificates.crt", "/usr/share/zoneinfo/UTC"},
	}
	value, ok := additions[addition]
	return value, ok
}

func updateDemoArtifactCount(repositories map[string][]map[string]any, project, repository string, count int) {
	if index, found := findMap(repositories[project], "name", repository); found {
		repositories[project][index]["artifact_count"] = count
		repositories[project][index]["update_time"] = time.Now().UTC().Format(time.RFC3339)
	}
}
