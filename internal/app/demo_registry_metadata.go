package app

import "fmt"

func (state *demoState) expandDemoPolicyRegistries(policy map[string]any) {
	for _, key := range []string{"src_registry", "dest_registry"} {
		reference, ok := policy[key].(map[string]any)
		if !ok || numberValue(reference["id"]) <= 0 {
			continue
		}
		if index, found := findMapNumber(state.registries, "id", fmt.Sprint(numberValue(reference["id"]))); found {
			policy[key] = cloneMap(state.registries[index])
		}
	}
}

func demoPermissionMetadata() map[string]any {
	permission := func(resource, action string) any {
		return map[string]any{"resource": resource, "action": action}
	}
	return map[string]any{
		"system": []any{
			permission("audit-log", "list"), permission("project", "list"), permission("project", "create"),
			permission("replication-policy", "read"), permission("replication-policy", "list"), permission("replication-policy", "create"), permission("replication-policy", "update"), permission("replication-policy", "delete"),
			permission("replication", "read"), permission("replication", "list"), permission("replication", "create"),
			permission("registry", "read"), permission("registry", "list"), permission("registry", "create"), permission("registry", "update"), permission("registry", "delete"),
			permission("scanner", "read"), permission("scanner", "list"), permission("scan-all", "read"), permission("scan-all", "create"), permission("scan-all", "stop"),
			permission("system-volumes", "read"), permission("garbage-collection", "read"), permission("garbage-collection", "list"), permission("garbage-collection", "create"), permission("garbage-collection", "stop"),
			permission("robot", "read"), permission("robot", "list"), permission("robot", "create"), permission("robot", "delete"),
		},
		"project": []any{
			permission("audit-log", "list"),
			permission("repository", "read"), permission("repository", "list"), permission("repository", "pull"), permission("repository", "push"), permission("repository", "update"), permission("repository", "delete"),
			permission("artifact", "read"), permission("artifact", "list"), permission("artifact", "create"), permission("artifact", "delete"),
			permission("tag", "list"), permission("tag", "create"), permission("tag", "delete"), permission("scan", "read"), permission("scan", "create"), permission("scan", "stop"),
			permission("sbom", "read"), permission("sbom", "create"), permission("label", "read"), permission("label", "list"), permission("label", "create"), permission("label", "update"), permission("label", "delete"),
		},
	}
}

func demoRegistryAdapterInfos() map[string]any {
	return map[string]any{
		"docker-hub": map[string]any{"endpoint_pattern": map[string]any{"endpoint_type": "EndpointPatternTypeFix", "endpoints": []any{map[string]any{"key": "hub.docker.com", "value": "https://hub.docker.com"}}}},
		"ali-acr": map[string]any{"endpoint_pattern": map[string]any{"endpoint_type": "EndpointPatternTypeList", "endpoints": []any{
			map[string]any{"key": "cn-hangzhou", "value": "https://registry.cn-hangzhou.aliyuncs.com"},
			map[string]any{"key": "cn-shanghai", "value": "https://registry.cn-shanghai.aliyuncs.com"},
			map[string]any{"key": "cn-beijing", "value": "https://registry.cn-beijing.aliyuncs.com"},
			map[string]any{"key": "cn-shenzhen", "value": "https://registry.cn-shenzhen.aliyuncs.com"},
		}}},
		"aws-ecr": map[string]any{"endpoint_pattern": map[string]any{"endpoint_type": "EndpointPatternTypeList", "endpoints": []any{
			map[string]any{"key": "ap-east-1", "value": "https://api.ecr.ap-east-1.amazonaws.com"},
			map[string]any{"key": "ap-southeast-1", "value": "https://api.ecr.ap-southeast-1.amazonaws.com"},
			map[string]any{"key": "us-east-1", "value": "https://api.ecr.us-east-1.amazonaws.com"},
		}}},
		"google-gcr": map[string]any{
			"endpoint_pattern":   map[string]any{"endpoint_type": "EndpointPatternTypeList", "endpoints": []any{map[string]any{"key": "gcr.io", "value": "https://gcr.io"}, map[string]any{"key": "asia.gcr.io", "value": "https://asia.gcr.io"}}},
			"credential_pattern": map[string]any{"access_key_type": "AccessKeyTypeFix", "access_key_data": "_json_key", "access_secret_type": "AccessSecretTypeFile", "access_secret_data": "No Change"},
		},
	}
}

func demoRegistryInfo(id int64) map[string]any {
	filters := []any{
		map[string]any{"type": "name", "style": "input", "values": []any{}},
		map[string]any{"type": "tag", "style": "input", "values": []any{}},
		map[string]any{"type": "resource", "style": "radio", "values": []any{"image"}},
	}
	triggers := []any{"manual", "scheduled"}
	registryType := "docker-registry"
	copyByChunk := false
	if id == 0 || id == 1 {
		registryType = "harbor"
		copyByChunk = true
		filters = append(filters, map[string]any{"type": "label", "style": "list", "values": []any{"已签核", "生产", "候选"}})
	}
	if id == 0 {
		triggers = append(triggers, "event_based")
	}
	return map[string]any{
		"type":                       registryType,
		"description":                "Harbor 官方 RegistryInfo 演示能力",
		"supported_resource_filters": filters,
		"supported_triggers":         triggers,
		"supported_copy_by_chunk":    copyByChunk,
	}
}
