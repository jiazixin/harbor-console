package app

import (
	"net/http"
	"net/url"
)

type controlParam struct {
	name         string
	placeholder  string
	doubleEncode bool
	numeric      bool
	allowZero    bool
	allowed      []string
}

type controlMethod struct {
	list         bool
	raw          bool
	head         bool
	bodyRequired bool
	bodyOptional bool
	validate     func(map[string]any) error
}

type controlSpec struct {
	path          string
	params        []controlParam
	allowedQuery  []string
	validateQuery func(url.Values) error
	headers       map[string]string
	methods       map[string]controlMethod
}

func methods(entries ...struct {
	method string
	config controlMethod
}) map[string]controlMethod {
	result := make(map[string]controlMethod, len(entries))
	for _, entry := range entries {
		result[entry.method] = entry.config
	}
	return result
}

func method(method string, config controlMethod) struct {
	method string
	config controlMethod
} {
	return struct {
		method string
		config controlMethod
	}{method: method, config: config}
}

var controlSpecs = map[string]controlSpec{
	"projects": {
		path: "/api/v2.0/projects", allowedQuery: []string{"q", "page", "page_size", "sort", "name", "public", "owner", "with_detail"},
		methods: methods(
			method(http.MethodGet, controlMethod{list: true}),
			method(http.MethodHead, controlMethod{head: true}),
			method(http.MethodPost, controlMethod{bodyRequired: true, validate: validateProjectCreate}),
		),
	},
	"internal-config": {
		path:    "/api/v2.0/internalconfig",
		methods: methods(method(http.MethodGet, controlMethod{})),
	},
	"ping": {
		path:    "/api/v2.0/ping",
		methods: methods(method(http.MethodGet, controlMethod{})),
	},
	"project": {
		path: "/api/v2.0/projects/{project}", params: []controlParam{{name: "project", placeholder: "project"}},
		methods: methods(
			method(http.MethodGet, controlMethod{}),
			method(http.MethodPut, controlMethod{bodyRequired: true, validate: validateProjectUpdate}),
			method(http.MethodDelete, controlMethod{}),
		),
	},
	"project-summary": {
		path: "/api/v2.0/projects/{project}/summary", params: []controlParam{{name: "project", placeholder: "project"}},
		methods: methods(method(http.MethodGet, controlMethod{})),
	},
	"project-deletable": {
		path:    "/api/v2.0/projects/{project}/_deletable",
		params:  []controlParam{{name: "project", placeholder: "project"}},
		methods: methods(method(http.MethodGet, controlMethod{})),
	},
	"project-scanner": {
		path: "/api/v2.0/projects/{project}/scanner", params: []controlParam{{name: "project", placeholder: "project"}},
		methods: methods(
			method(http.MethodGet, controlMethod{}),
			method(http.MethodPut, controlMethod{bodyRequired: true, validate: validateProjectScanner}),
		),
	},
	"project-scanner-candidates": {
		path: "/api/v2.0/projects/{project}/scanner/candidates", params: []controlParam{{name: "project", placeholder: "project"}},
		allowedQuery: []string{"q", "page", "page_size", "sort"},
		methods:      methods(method(http.MethodGet, controlMethod{list: true})),
	},
	"project-members": {
		path: "/api/v2.0/projects/{project}/members", params: []controlParam{{name: "project", placeholder: "project"}},
		allowedQuery: []string{"page", "page_size", "entityname"},
		methods: methods(
			method(http.MethodGet, controlMethod{list: true}),
			method(http.MethodPost, controlMethod{bodyRequired: true, validate: validateMemberCreate}),
		),
	},
	"project-member": {
		path:   "/api/v2.0/projects/{project}/members/{member}",
		params: []controlParam{{name: "project", placeholder: "project"}, {name: "member", placeholder: "member", numeric: true}},
		methods: methods(
			method(http.MethodPut, controlMethod{bodyRequired: true, validate: validateMemberRole}),
			method(http.MethodDelete, controlMethod{}),
		),
	},
	"project-member-detail": {
		path:    "/api/v2.0/projects/{project}/members/{member}",
		params:  []controlParam{{name: "project", placeholder: "project"}, {name: "member", placeholder: "member", numeric: true}},
		methods: methods(method(http.MethodGet, controlMethod{})),
	},
	"project-artifacts": {
		path:         "/api/v2.0/projects/{project}/artifacts",
		params:       []controlParam{{name: "project", placeholder: "project"}},
		allowedQuery: []string{"q", "page", "page_size", "sort", "with_tag", "with_label", "with_scan_overview", "with_sbom_overview", "with_accessory"},
		methods:      methods(method(http.MethodGet, controlMethod{list: true})),
	},
	"project-metadatas": {
		path:   "/api/v2.0/projects/{project}/metadatas/",
		params: []controlParam{{name: "project", placeholder: "project"}},
		methods: methods(
			method(http.MethodGet, controlMethod{}),
			method(http.MethodPost, controlMethod{bodyRequired: true, validate: validateProjectMetadataWrite}),
		),
	},
	"project-metadata": {
		path:   "/api/v2.0/projects/{project}/metadatas/{meta}",
		params: []controlParam{{name: "project", placeholder: "project"}, {name: "meta", placeholder: "meta", allowed: nil}},
		methods: methods(
			method(http.MethodGet, controlMethod{}),
			method(http.MethodPut, controlMethod{bodyRequired: true, validate: validateProjectMetadataWrite}),
			method(http.MethodDelete, controlMethod{}),
		),
	},
	"all-repositories": {
		path:         "/api/v2.0/repositories",
		allowedQuery: []string{"q", "page", "page_size", "sort"},
		methods:      methods(method(http.MethodGet, controlMethod{list: true})),
	},
	"repositories": {
		path: "/api/v2.0/projects/{project}/repositories", params: []controlParam{{name: "project", placeholder: "project"}},
		allowedQuery: []string{"q", "page", "page_size", "sort"},
		methods:      methods(method(http.MethodGet, controlMethod{list: true})),
	},
	"repository": {
		path:   "/api/v2.0/projects/{project}/repositories/{repository}",
		params: []controlParam{{name: "project", placeholder: "project"}, {name: "repository", placeholder: "repository", doubleEncode: true}},
		methods: methods(
			method(http.MethodGet, controlMethod{}),
			method(http.MethodPut, controlMethod{bodyRequired: true, validate: validateRepositoryUpdate}),
			method(http.MethodDelete, controlMethod{}),
		),
	},
	"artifacts": {
		path:         "/api/v2.0/projects/{project}/repositories/{repository}/artifacts",
		params:       []controlParam{{name: "project", placeholder: "project"}, {name: "repository", placeholder: "repository", doubleEncode: true}},
		allowedQuery: []string{"q", "page", "page_size", "sort", "with_tag", "with_label", "with_scan_overview", "with_sbom_overview", "with_immutable_status", "with_accessory"},
		methods:      methods(method(http.MethodGet, controlMethod{list: true})),
	},
	"artifact-copy": {
		path:          "/api/v2.0/projects/{project}/repositories/{repository}/artifacts",
		params:        []controlParam{{name: "project", placeholder: "project"}, {name: "repository", placeholder: "repository", doubleEncode: true}},
		allowedQuery:  []string{"from"},
		validateQuery: validateArtifactCopyQuery,
		methods:       methods(method(http.MethodPost, controlMethod{})),
	},
	"artifact": {
		path:         "/api/v2.0/projects/{project}/repositories/{repository}/artifacts/{reference}",
		params:       []controlParam{{name: "project", placeholder: "project"}, {name: "repository", placeholder: "repository", doubleEncode: true}, {name: "reference", placeholder: "reference"}},
		allowedQuery: []string{"page", "page_size", "with_tag", "with_label", "with_scan_overview", "with_sbom_overview", "with_accessory", "with_signature", "with_immutable_status"},
		methods:      methods(method(http.MethodGet, controlMethod{}), method(http.MethodDelete, controlMethod{})),
	},
	"artifact-scan": {
		path:    "/api/v2.0/projects/{project}/repositories/{repository}/artifacts/{reference}/scan",
		params:  []controlParam{{name: "project", placeholder: "project"}, {name: "repository", placeholder: "repository", doubleEncode: true}, {name: "reference", placeholder: "reference"}},
		methods: methods(method(http.MethodPost, controlMethod{bodyOptional: true, validate: validateOptionalScanType})),
	},
	"artifact-scan-stop": {
		path:    "/api/v2.0/projects/{project}/repositories/{repository}/artifacts/{reference}/scan/stop",
		params:  []controlParam{{name: "project", placeholder: "project"}, {name: "repository", placeholder: "repository", doubleEncode: true}, {name: "reference", placeholder: "reference"}},
		methods: methods(method(http.MethodPost, controlMethod{bodyRequired: true, validate: validateScanType})),
	},
	"artifact-scan-log": {
		path:    "/api/v2.0/projects/{project}/repositories/{repository}/artifacts/{reference}/scan/{report}/log",
		params:  []controlParam{{name: "project", placeholder: "project"}, {name: "repository", placeholder: "repository", doubleEncode: true}, {name: "reference", placeholder: "reference"}, {name: "report", placeholder: "report"}},
		methods: methods(method(http.MethodGet, controlMethod{})),
	},
	"artifact-tags": {
		path:         "/api/v2.0/projects/{project}/repositories/{repository}/artifacts/{reference}/tags",
		params:       []controlParam{{name: "project", placeholder: "project"}, {name: "repository", placeholder: "repository", doubleEncode: true}, {name: "reference", placeholder: "reference"}},
		allowedQuery: []string{"q", "page", "page_size", "sort", "with_immutable_status"},
		methods: methods(
			method(http.MethodGet, controlMethod{list: true}),
			method(http.MethodPost, controlMethod{bodyRequired: true, validate: validateTagCreate}),
		),
	},
	"artifact-tag": {
		path:    "/api/v2.0/projects/{project}/repositories/{repository}/artifacts/{reference}/tags/{tag}",
		params:  []controlParam{{name: "project", placeholder: "project"}, {name: "repository", placeholder: "repository", doubleEncode: true}, {name: "reference", placeholder: "reference"}, {name: "tag", placeholder: "tag"}},
		methods: methods(method(http.MethodDelete, controlMethod{})),
	},
	"artifact-labels": {
		path:   "/api/v2.0/projects/{project}/repositories/{repository}/artifacts/{reference}/labels",
		params: []controlParam{{name: "project", placeholder: "project"}, {name: "repository", placeholder: "repository", doubleEncode: true}, {name: "reference", placeholder: "reference"}},
		methods: methods(
			method(http.MethodPost, controlMethod{bodyRequired: true, validate: validateArtifactLabel}),
		),
	},
	"artifact-label": {
		path:    "/api/v2.0/projects/{project}/repositories/{repository}/artifacts/{reference}/labels/{label}",
		params:  []controlParam{{name: "project", placeholder: "project"}, {name: "repository", placeholder: "repository", doubleEncode: true}, {name: "reference", placeholder: "reference"}, {name: "label", placeholder: "label", numeric: true}},
		methods: methods(method(http.MethodDelete, controlMethod{})),
	},
	"artifact-accessories": {
		path:         "/api/v2.0/projects/{project}/repositories/{repository}/artifacts/{reference}/accessories",
		params:       []controlParam{{name: "project", placeholder: "project"}, {name: "repository", placeholder: "repository", doubleEncode: true}, {name: "reference", placeholder: "reference"}},
		allowedQuery: []string{"q", "page", "page_size", "sort"},
		methods:      methods(method(http.MethodGet, controlMethod{list: true})),
	},
	"artifact-icon": {
		path:    "/api/v2.0/icons/{digest}",
		params:  []controlParam{{name: "digest", placeholder: "digest"}},
		methods: methods(method(http.MethodGet, controlMethod{})),
	},
	"artifact-addition": {
		path: "/api/v2.0/projects/{project}/repositories/{repository}/artifacts/{reference}/additions/{addition}",
		params: []controlParam{
			{name: "project", placeholder: "project"},
			{name: "repository", placeholder: "repository", doubleEncode: true},
			{name: "reference", placeholder: "reference"},
			{name: "addition", placeholder: "addition", allowed: []string{"build_history", "values.yaml", "readme.md", "dependencies", "sbom", "license", "files"}},
		},
		methods: methods(method(http.MethodGet, controlMethod{})),
	},
	"artifact-vulnerabilities": {
		path:    "/api/v2.0/projects/{project}/repositories/{repository}/artifacts/{reference}/additions/vulnerabilities",
		params:  []controlParam{{name: "project", placeholder: "project"}, {name: "repository", placeholder: "repository", doubleEncode: true}, {name: "reference", placeholder: "reference"}},
		methods: methods(method(http.MethodGet, controlMethod{})),
	},
	"replication-policies": {
		path: "/api/v2.0/replication/policies", allowedQuery: []string{"q", "page", "page_size", "sort", "name"},
		methods: methods(
			method(http.MethodGet, controlMethod{list: true}),
			method(http.MethodPost, controlMethod{bodyRequired: true, validate: validateReplicationPolicy}),
		),
	},
	"replication-policy": {
		path: "/api/v2.0/replication/policies/{id}", params: []controlParam{{name: "id", placeholder: "id", numeric: true}},
		methods: methods(
			method(http.MethodGet, controlMethod{}),
			method(http.MethodPut, controlMethod{bodyRequired: true, validate: validateReplicationPolicy}),
			method(http.MethodDelete, controlMethod{}),
		),
	},
	"replication-executions": {
		path: "/api/v2.0/replication/executions", allowedQuery: []string{"page", "page_size", "sort", "policy_id", "status", "trigger"},
		methods: methods(
			method(http.MethodGet, controlMethod{list: true}),
			method(http.MethodPost, controlMethod{bodyRequired: true, validate: validateReplicationStart}),
		),
	},
	"replication-execution": {
		path: "/api/v2.0/replication/executions/{id}", params: []controlParam{{name: "id", placeholder: "id", numeric: true}},
		methods: methods(
			method(http.MethodGet, controlMethod{}),
			method(http.MethodPut, controlMethod{}),
		),
	},
	"replication-tasks": {
		path:         "/api/v2.0/replication/executions/{id}/tasks",
		params:       []controlParam{{name: "id", placeholder: "id", numeric: true}},
		allowedQuery: []string{"page", "page_size", "sort", "status", "resource_type"},
		methods:      methods(method(http.MethodGet, controlMethod{list: true})),
	},
	"replication-task-log": {
		path:    "/api/v2.0/replication/executions/{id}/tasks/{task}/log",
		params:  []controlParam{{name: "id", placeholder: "id", numeric: true}, {name: "task", placeholder: "task", numeric: true}},
		methods: methods(method(http.MethodGet, controlMethod{})),
	},
	"registries": {
		path: "/api/v2.0/registries", allowedQuery: []string{"q", "page", "page_size", "sort", "name"},
		methods: methods(
			method(http.MethodGet, controlMethod{list: true}),
			method(http.MethodPost, controlMethod{bodyRequired: true, validate: validateRegistryCreate}),
		),
	},
	"registry-adapters": {
		path:    "/api/v2.0/replication/adapters",
		methods: methods(method(http.MethodGet, controlMethod{})),
	},
	"registry-adapter-infos": {
		path:    "/api/v2.0/replication/adapterinfos",
		methods: methods(method(http.MethodGet, controlMethod{})),
	},
	"registry-info": {
		path:    "/api/v2.0/registries/{id}/info",
		params:  []controlParam{{name: "id", placeholder: "id", numeric: true, allowZero: true}},
		methods: methods(method(http.MethodGet, controlMethod{})),
	},
	"registry": {
		path: "/api/v2.0/registries/{id}", params: []controlParam{{name: "id", placeholder: "id", numeric: true}},
		methods: methods(
			method(http.MethodGet, controlMethod{}),
			method(http.MethodPut, controlMethod{bodyRequired: true, validate: validateRegistryUpdate}),
			method(http.MethodDelete, controlMethod{}),
		),
	},
	"registry-ping": {
		path:    "/api/v2.0/registries/ping",
		methods: methods(method(http.MethodPost, controlMethod{bodyRequired: true, validate: validateRegistryPing})),
	},
	"robots": {
		path: "/api/v2.0/robots", allowedQuery: []string{"q", "page", "page_size", "sort"},
		methods: methods(
			method(http.MethodGet, controlMethod{list: true}),
			method(http.MethodPost, controlMethod{bodyRequired: true, validate: validateRobotCreate}),
		),
	},
	"robot": {
		path: "/api/v2.0/robots/{id}", params: []controlParam{{name: "id", placeholder: "id", numeric: true}},
		methods: methods(
			method(http.MethodGet, controlMethod{}),
			method(http.MethodPut, controlMethod{bodyRequired: true, validate: validateRobotUpdate}),
			method(http.MethodPatch, controlMethod{bodyRequired: true, validate: validateRobotSecret}),
			method(http.MethodDelete, controlMethod{}),
		),
	},
	"permissions": {
		path:    "/api/v2.0/permissions",
		methods: methods(method(http.MethodGet, controlMethod{})),
	},
	"audit-logs": {
		path:         "/api/v2.0/auditlog-exts",
		allowedQuery: []string{"q", "page", "page_size", "sort"},
		methods:      methods(method(http.MethodGet, controlMethod{list: true})),
	},
	"audit-log-events": {
		path:    "/api/v2.0/auditlog-exts/events",
		methods: methods(method(http.MethodGet, controlMethod{})),
	},
	"project-audit-logs": {
		path:         "/api/v2.0/projects/{project}/auditlog-exts",
		params:       []controlParam{{name: "project", placeholder: "project"}},
		allowedQuery: []string{"q", "page", "page_size", "sort"},
		methods:      methods(method(http.MethodGet, controlMethod{list: true})),
	},
	"labels": {
		path: "/api/v2.0/labels", allowedQuery: []string{"q", "page", "page_size", "sort", "name", "scope", "project_id"},
		methods: methods(
			method(http.MethodGet, controlMethod{list: true}),
			method(http.MethodPost, controlMethod{bodyRequired: true, validate: validateLabel}),
		),
	},
	"label": {
		path: "/api/v2.0/labels/{id}", params: []controlParam{{name: "id", placeholder: "id", numeric: true}},
		methods: methods(
			method(http.MethodGet, controlMethod{}),
			method(http.MethodPut, controlMethod{bodyRequired: true, validate: validateLabel}),
			method(http.MethodDelete, controlMethod{}),
		),
	},
	"preheat-providers": {
		path:    "/api/v2.0/p2p/preheat/providers",
		methods: methods(method(http.MethodGet, controlMethod{})),
	},
	"preheat-instances": {
		path:         "/api/v2.0/p2p/preheat/instances",
		allowedQuery: []string{"q", "page", "page_size", "sort"},
		methods: methods(
			method(http.MethodGet, controlMethod{list: true}),
			method(http.MethodPost, controlMethod{bodyRequired: true, validate: validatePreheatInstance}),
		),
	},
	"preheat-instance": {
		path:   "/api/v2.0/p2p/preheat/instances/{name}",
		params: []controlParam{{name: "name", placeholder: "name"}},
		methods: methods(
			method(http.MethodGet, controlMethod{}),
			method(http.MethodPut, controlMethod{bodyRequired: true, validate: validatePreheatInstance}),
			method(http.MethodDelete, controlMethod{}),
		),
	},
	"preheat-instance-ping": {
		path:    "/api/v2.0/p2p/preheat/instances/ping",
		methods: methods(method(http.MethodPost, controlMethod{bodyRequired: true, validate: validatePreheatInstancePing})),
	},
	"project-preheat-providers": {
		path:    "/api/v2.0/projects/{project}/preheat/providers",
		params:  []controlParam{{name: "project", placeholder: "project"}},
		methods: methods(method(http.MethodGet, controlMethod{})),
	},
	"preheat-policies": {
		path:         "/api/v2.0/projects/{project}/preheat/policies",
		params:       []controlParam{{name: "project", placeholder: "project"}},
		allowedQuery: []string{"q", "page", "page_size", "sort"},
		methods: methods(
			method(http.MethodGet, controlMethod{list: true}),
			method(http.MethodPost, controlMethod{bodyRequired: true, validate: validatePreheatPolicy}),
		),
	},
	"preheat-policy": {
		path:   "/api/v2.0/projects/{project}/preheat/policies/{name}",
		params: []controlParam{{name: "project", placeholder: "project"}, {name: "name", placeholder: "name"}},
		methods: methods(
			method(http.MethodGet, controlMethod{}),
			method(http.MethodPut, controlMethod{bodyRequired: true, validate: validatePreheatPolicy}),
			method(http.MethodPost, controlMethod{bodyRequired: true, validate: validatePreheatPolicy}),
			method(http.MethodDelete, controlMethod{}),
		),
	},
	"preheat-executions": {
		path:         "/api/v2.0/projects/{project}/preheat/policies/{name}/executions",
		params:       []controlParam{{name: "project", placeholder: "project"}, {name: "name", placeholder: "name"}},
		allowedQuery: []string{"q", "page", "page_size", "sort"},
		methods:      methods(method(http.MethodGet, controlMethod{list: true})),
	},
	"preheat-execution": {
		path:   "/api/v2.0/projects/{project}/preheat/policies/{name}/executions/{id}",
		params: []controlParam{{name: "project", placeholder: "project"}, {name: "name", placeholder: "name"}, {name: "id", placeholder: "id", numeric: true}},
		methods: methods(
			method(http.MethodGet, controlMethod{}),
			method(http.MethodPatch, controlMethod{bodyRequired: true, validate: validatePreheatExecutionStop}),
		),
	},
	"preheat-tasks": {
		path:         "/api/v2.0/projects/{project}/preheat/policies/{name}/executions/{id}/tasks",
		params:       []controlParam{{name: "project", placeholder: "project"}, {name: "name", placeholder: "name"}, {name: "id", placeholder: "id", numeric: true}},
		allowedQuery: []string{"q", "page", "page_size", "sort"},
		methods:      methods(method(http.MethodGet, controlMethod{list: true})),
	},
	"preheat-task-log": {
		path:    "/api/v2.0/projects/{project}/preheat/policies/{name}/executions/{id}/tasks/{task}/logs",
		params:  []controlParam{{name: "project", placeholder: "project"}, {name: "name", placeholder: "name"}, {name: "id", placeholder: "id", numeric: true}, {name: "task", placeholder: "task", numeric: true}},
		methods: methods(method(http.MethodGet, controlMethod{})),
	},
	"immutable-rules": {
		path: "/api/v2.0/projects/{project}/immutabletagrules", params: []controlParam{{name: "project", placeholder: "project"}},
		allowedQuery: []string{"q", "page", "page_size", "sort"},
		methods: methods(
			method(http.MethodGet, controlMethod{list: true}),
			method(http.MethodPost, controlMethod{bodyRequired: true, validate: validateImmutableRule}),
		),
	},
	"immutable-rule": {
		path: "/api/v2.0/projects/{project}/immutabletagrules/{id}", params: []controlParam{{name: "project", placeholder: "project"}, {name: "id", placeholder: "id", numeric: true}},
		methods: methods(
			method(http.MethodPut, controlMethod{bodyRequired: true, validate: validateImmutableRule}),
			method(http.MethodDelete, controlMethod{}),
		),
	},
	"webhooks": {
		path: "/api/v2.0/projects/{project}/webhook/policies", params: []controlParam{{name: "project", placeholder: "project"}},
		allowedQuery: []string{"q", "page", "page_size", "sort"},
		methods: methods(
			method(http.MethodGet, controlMethod{list: true}),
			method(http.MethodPost, controlMethod{bodyRequired: true, validate: validateWebhook}),
		),
	},
	"webhook": {
		path: "/api/v2.0/projects/{project}/webhook/policies/{id}", params: []controlParam{{name: "project", placeholder: "project"}, {name: "id", placeholder: "id", numeric: true}},
		methods: methods(
			method(http.MethodGet, controlMethod{}),
			method(http.MethodPut, controlMethod{bodyRequired: true, validate: validateWebhook}),
			method(http.MethodDelete, controlMethod{}),
		),
	},
	"webhook-events": {
		path: "/api/v2.0/projects/{project}/webhook/events", params: []controlParam{{name: "project", placeholder: "project"}},
		methods: methods(method(http.MethodGet, controlMethod{})),
	},
	"webhook-executions": {
		path:         "/api/v2.0/projects/{project}/webhook/policies/{id}/executions",
		params:       []controlParam{{name: "project", placeholder: "project"}, {name: "id", placeholder: "id", numeric: true}},
		allowedQuery: []string{"q", "page", "page_size", "sort"},
		methods:      methods(method(http.MethodGet, controlMethod{list: true})),
	},
	"webhook-tasks": {
		path:         "/api/v2.0/projects/{project}/webhook/policies/{id}/executions/{execution}/tasks",
		params:       []controlParam{{name: "project", placeholder: "project"}, {name: "id", placeholder: "id", numeric: true}, {name: "execution", placeholder: "execution", numeric: true}},
		allowedQuery: []string{"q", "page", "page_size", "sort"},
		methods:      methods(method(http.MethodGet, controlMethod{list: true})),
	},
	"webhook-task-log": {
		path:    "/api/v2.0/projects/{project}/webhook/policies/{id}/executions/{execution}/tasks/{task}/log",
		params:  []controlParam{{name: "project", placeholder: "project"}, {name: "id", placeholder: "id", numeric: true}, {name: "execution", placeholder: "execution", numeric: true}, {name: "task", placeholder: "task", numeric: true}},
		methods: methods(method(http.MethodGet, controlMethod{})),
	},
	"users": {
		path: "/api/v2.0/users", allowedQuery: []string{"q", "page", "page_size", "sort"},
		methods: methods(
			method(http.MethodGet, controlMethod{list: true}),
			method(http.MethodPost, controlMethod{bodyRequired: true, validate: validateUserCreate}),
		),
	},
	"current-user": {
		path:    "/api/v2.0/users/current",
		methods: methods(method(http.MethodGet, controlMethod{})),
	},
	"current-permissions": {
		path:          "/api/v2.0/users/current/permissions",
		allowedQuery:  []string{"scope", "relative"},
		validateQuery: validateCurrentPermissionsQuery,
		methods:       methods(method(http.MethodGet, controlMethod{list: true})),
	},
	"user": {
		path: "/api/v2.0/users/{id}", params: []controlParam{{name: "id", placeholder: "id", numeric: true}},
		methods: methods(
			method(http.MethodGet, controlMethod{}),
			method(http.MethodPut, controlMethod{bodyRequired: true, validate: validateUserProfile}),
			method(http.MethodDelete, controlMethod{}),
		),
	},
	"user-sysadmin": {
		path: "/api/v2.0/users/{id}/sysadmin", params: []controlParam{{name: "id", placeholder: "id", numeric: true}},
		methods: methods(method(http.MethodPut, controlMethod{bodyRequired: true, validate: validateUserSysadmin})),
	},
	"user-password": {
		path: "/api/v2.0/users/{id}/password", params: []controlParam{{name: "id", placeholder: "id", numeric: true}},
		methods: methods(method(http.MethodPut, controlMethod{bodyRequired: true, validate: validateUserPassword})),
	},
	"current-user-password": {
		path: "/api/v2.0/users/{id}/password", params: []controlParam{{name: "id", placeholder: "id", numeric: true}},
		methods: methods(method(http.MethodPut, controlMethod{bodyRequired: true, validate: validateUserPassword})),
	},
	"user-cli-secret": {
		path: "/api/v2.0/users/{id}/cli_secret", params: []controlParam{{name: "id", placeholder: "id", numeric: true}},
		methods: methods(method(http.MethodPut, controlMethod{bodyRequired: true, validate: validateUserCLISecret})),
	},
	"current-user-cli-secret": {
		path: "/api/v2.0/users/{id}/cli_secret", params: []controlParam{{name: "id", placeholder: "id", numeric: true}},
		methods: methods(method(http.MethodPut, controlMethod{bodyRequired: true, validate: validateUserCLISecret})),
	},
	"user-groups": {
		path: "/api/v2.0/usergroups", allowedQuery: []string{"page", "page_size", "ldap_group_dn", "group_name"},
		methods: methods(
			method(http.MethodGet, controlMethod{list: true}),
			method(http.MethodPost, controlMethod{bodyRequired: true, validate: validateUserGroup}),
		),
	},
	"user-group": {
		path: "/api/v2.0/usergroups/{id}", params: []controlParam{{name: "id", placeholder: "id", numeric: true}},
		methods: methods(
			method(http.MethodGet, controlMethod{}),
			method(http.MethodPut, controlMethod{bodyRequired: true, validate: validateUserGroup}),
			method(http.MethodDelete, controlMethod{}),
		),
	},
	"quotas": {
		path: "/api/v2.0/quotas", allowedQuery: []string{"page", "page_size", "reference", "reference_id", "sort"},
		methods: methods(method(http.MethodGet, controlMethod{list: true})),
	},
	"quota": {
		path: "/api/v2.0/quotas/{id}", params: []controlParam{{name: "id", placeholder: "id", numeric: true}},
		methods: methods(
			method(http.MethodGet, controlMethod{}),
			method(http.MethodPut, controlMethod{bodyRequired: true, validate: validateQuota}),
		),
	},
	"scanners": {
		path: "/api/v2.0/scanners", allowedQuery: []string{"q", "page", "page_size", "sort"},
		methods: methods(
			method(http.MethodGet, controlMethod{list: true}),
			method(http.MethodPost, controlMethod{bodyRequired: true, validate: validateScanner}),
		),
	},
	"scanner": {
		path: "/api/v2.0/scanners/{id}", params: []controlParam{{name: "id", placeholder: "id"}},
		methods: methods(
			method(http.MethodGet, controlMethod{}),
			method(http.MethodPut, controlMethod{bodyRequired: true, validate: validateScanner}),
			method(http.MethodPatch, controlMethod{bodyRequired: true, validate: validateScannerDefault}),
			method(http.MethodDelete, controlMethod{}),
		),
	},
	"scanner-ping": {
		path:    "/api/v2.0/scanners/ping",
		methods: methods(method(http.MethodPost, controlMethod{bodyRequired: true, validate: validateScanner})),
	},
	"scanner-metadata": {
		path:    "/api/v2.0/scanners/{id}/metadata",
		params:  []controlParam{{name: "id", placeholder: "id"}},
		methods: methods(method(http.MethodGet, controlMethod{})),
	},
	"retentions": {
		path: "/api/v2.0/retentions",
		methods: methods(
			method(http.MethodPost, controlMethod{bodyRequired: true, validate: validateRetentionPolicy}),
		),
	},
	"retention": {
		path: "/api/v2.0/retentions/{id}", params: []controlParam{{name: "id", placeholder: "id", numeric: true}},
		methods: methods(
			method(http.MethodGet, controlMethod{}),
			method(http.MethodPut, controlMethod{bodyRequired: true, validate: validateRetentionPolicy}),
			method(http.MethodDelete, controlMethod{}),
		),
	},
	"retention-metadatas": {
		path:    "/api/v2.0/retentions/metadatas",
		methods: methods(method(http.MethodGet, controlMethod{})),
	},
	"retention-executions": {
		path: "/api/v2.0/retentions/{id}/executions", params: []controlParam{{name: "id", placeholder: "id", numeric: true}},
		allowedQuery: []string{"page", "page_size"},
		methods: methods(
			method(http.MethodGet, controlMethod{list: true}),
			method(http.MethodPost, controlMethod{bodyRequired: true, validate: validateRetentionExecution}),
		),
	},
	"retention-execution": {
		path:   "/api/v2.0/retentions/{id}/executions/{eid}",
		params: []controlParam{{name: "id", placeholder: "id", numeric: true}, {name: "eid", placeholder: "eid", numeric: true}},
		methods: methods(
			method(http.MethodPatch, controlMethod{bodyRequired: true, validate: validateRetentionExecutionAction}),
		),
	},
	"retention-tasks": {
		path:         "/api/v2.0/retentions/{id}/executions/{eid}/tasks",
		params:       []controlParam{{name: "id", placeholder: "id", numeric: true}, {name: "eid", placeholder: "eid", numeric: true}},
		allowedQuery: []string{"page", "page_size"},
		methods:      methods(method(http.MethodGet, controlMethod{list: true})),
	},
	"retention-task-log": {
		path:    "/api/v2.0/retentions/{id}/executions/{eid}/tasks/{tid}",
		params:  []controlParam{{name: "id", placeholder: "id", numeric: true}, {name: "eid", placeholder: "eid", numeric: true}, {name: "tid", placeholder: "tid", numeric: true}},
		methods: methods(method(http.MethodGet, controlMethod{})),
	},
	"gc-history": {
		path: "/api/v2.0/system/gc", allowedQuery: []string{"q", "page", "page_size", "sort"},
		methods: methods(method(http.MethodGet, controlMethod{list: true})),
	},
	"gc-job": {
		path: "/api/v2.0/system/gc/{id}", params: []controlParam{{name: "id", placeholder: "id", numeric: true}},
		methods: methods(
			method(http.MethodGet, controlMethod{}),
			method(http.MethodPut, controlMethod{}),
		),
	},
	"gc-log": {
		path:    "/api/v2.0/system/gc/{id}/log",
		params:  []controlParam{{name: "id", placeholder: "id", numeric: true}},
		methods: methods(method(http.MethodGet, controlMethod{})),
	},
	"gc-schedule": {
		path: "/api/v2.0/system/gc/schedule",
		methods: methods(
			method(http.MethodGet, controlMethod{}),
			method(http.MethodPost, controlMethod{bodyRequired: true, validate: validateGCSchedule}),
			method(http.MethodPut, controlMethod{bodyRequired: true, validate: validateGCSchedule}),
		),
	},
	"purge-history": {
		path: "/api/v2.0/system/purgeaudit", allowedQuery: []string{"q", "page", "page_size", "sort"},
		methods: methods(method(http.MethodGet, controlMethod{list: true})),
	},
	"purge-job": {
		path: "/api/v2.0/system/purgeaudit/{id}", params: []controlParam{{name: "id", placeholder: "id", numeric: true}},
		methods: methods(
			method(http.MethodGet, controlMethod{}),
			method(http.MethodPut, controlMethod{}),
		),
	},
	"purge-log": {
		path: "/api/v2.0/system/purgeaudit/{id}/log", params: []controlParam{{name: "id", placeholder: "id", numeric: true}},
		methods: methods(method(http.MethodGet, controlMethod{})),
	},
	"purge-schedule": {
		path: "/api/v2.0/system/purgeaudit/schedule",
		methods: methods(
			method(http.MethodGet, controlMethod{}),
			method(http.MethodPost, controlMethod{bodyRequired: true, validate: validatePurgeSchedule}),
			method(http.MethodPut, controlMethod{bodyRequired: true, validate: validatePurgeSchedule}),
		),
	},
	"jobservice-pools": {
		path:    "/api/v2.0/jobservice/pools",
		methods: methods(method(http.MethodGet, controlMethod{})),
	},
	"jobservice-workers": {
		path: "/api/v2.0/jobservice/pools/{pool}/workers", params: []controlParam{{name: "pool", placeholder: "pool"}},
		methods: methods(method(http.MethodGet, controlMethod{})),
	},
	"jobservice-job": {
		path: "/api/v2.0/jobservice/jobs/{job}", params: []controlParam{{name: "job", placeholder: "job"}},
		methods: methods(method(http.MethodPut, controlMethod{})),
	},
	"jobservice-job-log": {
		path: "/api/v2.0/jobservice/jobs/{job}/log", params: []controlParam{{name: "job", placeholder: "job"}},
		methods: methods(method(http.MethodGet, controlMethod{})),
	},
	"jobservice-queues": {
		path:    "/api/v2.0/jobservice/queues",
		methods: methods(method(http.MethodGet, controlMethod{})),
	},
	"jobservice-queue": {
		path: "/api/v2.0/jobservice/queues/{type}", params: []controlParam{{name: "type", placeholder: "type"}},
		methods: methods(method(http.MethodPut, controlMethod{bodyRequired: true, validate: validateJobServiceAction})),
	},
	"jobservice-schedules": {
		path: "/api/v2.0/schedules", allowedQuery: []string{"page", "page_size"},
		methods: methods(method(http.MethodGet, controlMethod{list: true})),
	},
	"jobservice-schedule-status": {
		path: "/api/v2.0/schedules/{type}/paused", params: []controlParam{{name: "type", placeholder: "type", allowed: []string{"all"}}},
		methods: methods(method(http.MethodGet, controlMethod{})),
	},
	"scan-all-metrics": {
		path:    "/api/v2.0/scans/all/metrics",
		methods: methods(method(http.MethodGet, controlMethod{})),
	},
	"scan-all-schedule": {
		path: "/api/v2.0/system/scanAll/schedule",
		methods: methods(
			method(http.MethodGet, controlMethod{}),
			method(http.MethodPost, controlMethod{bodyRequired: true, validate: validateSchedule}),
			method(http.MethodPut, controlMethod{bodyRequired: true, validate: validateSchedule}),
		),
	},
	"scan-all-stop": {
		path:    "/api/v2.0/system/scanAll/stop",
		methods: methods(method(http.MethodPost, controlMethod{})),
	},
	"security-summary": {
		path:         "/api/v2.0/security/summary",
		allowedQuery: []string{"with_dangerous_cve", "with_dangerous_artifact"},
		methods:      methods(method(http.MethodGet, controlMethod{})),
	},
	"security-vulnerabilities": {
		path:         "/api/v2.0/security/vul",
		allowedQuery: []string{"q", "page", "page_size", "tune_count", "with_tag"},
		methods:      methods(method(http.MethodGet, controlMethod{list: true})),
	},
	"system-cve-allowlist": {
		path: "/api/v2.0/system/CVEAllowlist",
		methods: methods(
			method(http.MethodGet, controlMethod{}),
			method(http.MethodPut, controlMethod{bodyRequired: true, validate: validateCVEAllowlist}),
		),
	},
	"cve-export": {
		path:    "/api/v2.0/export/cve",
		headers: map[string]string{"X-Scan-Data-Type": "application/vnd.security.vulnerability.report; version=1.1"},
		methods: methods(method(http.MethodPost, controlMethod{bodyRequired: true, validate: validateCVEExport})),
	},
	"cve-export-executions": {
		path:    "/api/v2.0/export/cve/executions",
		methods: methods(method(http.MethodGet, controlMethod{})),
	},
	"cve-export-execution": {
		path:    "/api/v2.0/export/cve/execution/{id}",
		params:  []controlParam{{name: "id", placeholder: "id", numeric: true}},
		methods: methods(method(http.MethodGet, controlMethod{})),
	},
	"cve-export-download": {
		path:         "/api/v2.0/export/cve/download/{id}",
		params:       []controlParam{{name: "id", placeholder: "id", numeric: true}},
		allowedQuery: []string{"format"},
		methods:      methods(method(http.MethodGet, controlMethod{raw: true})),
	},
	"configurations": {
		path: "/api/v2.0/configurations",
		methods: methods(
			method(http.MethodGet, controlMethod{}),
			method(http.MethodPut, controlMethod{bodyRequired: true, validate: validateConfigurations}),
		),
	},
	"system-root-certificate": {
		path:    "/api/v2.0/systeminfo/getcert",
		methods: methods(method(http.MethodGet, controlMethod{raw: true})),
	},
	"ldap-ping": {
		path:    "/api/v2.0/ldap/ping",
		methods: methods(method(http.MethodPost, controlMethod{bodyRequired: true, validate: validateLDAPPing})),
	},
	"ldap-users-search": {
		path:         "/api/v2.0/ldap/users/search",
		allowedQuery: []string{"username"},
		methods:      methods(method(http.MethodGet, controlMethod{list: true})),
	},
	"users-search": {
		path:          "/api/v2.0/users/search",
		allowedQuery:  []string{"username", "page", "page_size"},
		validateQuery: validateRequiredDirectorySearchQuery("username"),
		methods:       methods(method(http.MethodGet, controlMethod{list: true})),
	},
	"user-groups-search": {
		path:          "/api/v2.0/usergroups/search",
		allowedQuery:  []string{"groupname", "page", "page_size"},
		validateQuery: validateRequiredDirectorySearchQuery("groupname"),
		methods:       methods(method(http.MethodGet, controlMethod{list: true})),
	},
	"ldap-users-import": {
		path:    "/api/v2.0/ldap/users/import",
		methods: methods(method(http.MethodPost, controlMethod{bodyRequired: true, validate: validateLDAPUserImport})),
	},
	"ldap-groups-search": {
		path:          "/api/v2.0/ldap/groups/search",
		allowedQuery:  []string{"groupname", "groupdn"},
		validateQuery: validateLDAPGroupSearchQuery,
		methods:       methods(method(http.MethodGet, controlMethod{list: true})),
	},
	"oidc-ping": {
		path:    "/api/v2.0/system/oidc/ping",
		methods: methods(method(http.MethodPost, controlMethod{bodyRequired: true, validate: validateOIDCPing})),
	},
}
