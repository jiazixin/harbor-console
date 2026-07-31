package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
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
			method(http.MethodPost, controlMethod{bodyRequired: true, validate: validateProjectCreate}),
		),
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
			method(http.MethodPost, controlMethod{bodyRequired: true, validate: validateRobot}),
		),
	},
	"robot": {
		path: "/api/v2.0/robots/{id}", params: []controlParam{{name: "id", placeholder: "id", numeric: true}},
		methods: methods(
			method(http.MethodGet, controlMethod{}),
			method(http.MethodPut, controlMethod{bodyRequired: true, validate: validateRobot}),
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

func (a *app) handleControl(w http.ResponseWriter, r *http.Request) {
	current, ok := a.currentSession(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "会话已失效", "请重新连接 Harbor")
		return
	}
	if len(r.URL.RawQuery) > maxQueryBytes {
		writeError(w, http.StatusBadRequest, "查询参数过长", "请缩短筛选条件后重试")
		return
	}
	operation := r.PathValue("operation")
	spec, ok := controlSpecs[operation]
	if !ok {
		writeError(w, http.StatusNotFound, "未知控制操作", "该操作不在 Harbor 官方 API 允许列表中")
		return
	}
	methodConfig, ok := spec.methods[r.Method]
	if !ok {
		w.Header().Set("Allow", allowedMethodHeader(spec.methods))
		writeError(w, http.StatusMethodNotAllowed, "操作方法不受支持", "该资源不允许使用 "+r.Method)
		return
	}
	if r.Method != http.MethodGet && r.Method != http.MethodHead && !sameOrigin(r) {
		writeError(w, http.StatusForbidden, "请求来源无效", "请从当前控制台提交写操作")
		return
	}

	path, requestHeaders, err := buildControlPath(spec, r.URL.Query())
	if err != nil {
		writeError(w, http.StatusBadRequest, "路径参数无效", err.Error())
		return
	}
	query, err := buildControlQuery(spec.allowedQuery, r.URL.Query(), methodConfig.list)
	if err != nil {
		writeError(w, http.StatusBadRequest, "查询参数无效", err.Error())
		return
	}
	if spec.validateQuery != nil {
		if err := spec.validateQuery(query); err != nil {
			writeError(w, http.StatusBadRequest, "查询参数无效", err.Error())
			return
		}
	}
	body, decoded, err := readControlBody(w, r, methodConfig)
	if err != nil {
		writeError(w, http.StatusBadRequest, "请求内容无效", err.Error())
		return
	}
	if methodConfig.validate != nil {
		if err := methodConfig.validate(decoded); err != nil {
			writeError(w, http.StatusBadRequest, "请求内容无效", err.Error())
			return
		}
	}

	if current.Demo {
		current.DemoData.handleControl(w, r.Method, operation, r.URL.Query(), decoded, methodConfig.list)
		return
	}
	if operation == "current-user-password" || operation == "current-user-cli-secret" {
		if err := a.requireCurrentUserID(r, current, r.URL.Query().Get("id")); err != nil {
			writeUpstreamError(w, err)
			return
		}
	}
	response, err := a.harborRequest(r.Context(), current, r.Method, path, query, body, requestHeaders)
	if err != nil {
		writeUpstreamError(w, err)
		return
	}
	if operation == "current-user-password" || operation == "current-user-cli-secret" {
		field := "new_password"
		if operation == "current-user-cli-secret" {
			field = "secret"
		}
		if password, ok := decoded[field].(string); ok {
			if err := a.sessions.updateActivePassword(current.ID, password); err != nil {
				a.logger.Warn("updated Harbor credential but failed to refresh local session", "session_id", current.ID, "error", err)
			}
		}
	}
	writeControlResponse(w, response, methodConfig, query)
}

func (a *app) requireCurrentUserID(r *http.Request, current *session, requestedID string) error {
	var user struct {
		UserID int64 `json:"user_id"`
	}
	if err := a.harborJSON(r.Context(), current, http.MethodGet, "/api/v2.0/users/current", nil, &user); err != nil {
		return err
	}
	actualID, err := strconv.ParseInt(requestedID, 10, 64)
	if err != nil || actualID <= 0 || actualID != user.UserID {
		return &upstreamError{StatusCode: http.StatusForbidden, Message: "credential update is limited to the current user"}
	}
	return nil
}

func buildControlPath(spec controlSpec, input url.Values) (string, http.Header, error) {
	path := spec.path
	headers := make(http.Header)
	for key, value := range spec.headers {
		headers.Set(key, value)
	}
	projectName := strings.TrimSpace(input.Get("project"))
	for _, parameter := range spec.params {
		value := strings.TrimSpace(input.Get(parameter.name))
		if value == "" {
			return "", nil, fmt.Errorf("%s 是必填参数", parameter.name)
		}
		if len(value) > 1024 || strings.ContainsAny(value, "\r\n\x00") {
			return "", nil, fmt.Errorf("%s 包含无效字符或长度过长", parameter.name)
		}
		if parameter.numeric {
			parsed, err := strconv.ParseInt(value, 10, 64)
			if err != nil || parsed < 0 || (!parameter.allowZero && parsed == 0) {
				if parameter.allowZero {
					return "", nil, fmt.Errorf("%s 必须是 0 或正整数", parameter.name)
				}
				return "", nil, fmt.Errorf("%s 必须是正整数", parameter.name)
			}
		}
		if len(parameter.allowed) > 0 && !slicesContain(parameter.allowed, value) {
			return "", nil, fmt.Errorf("%s 不是允许的取值", parameter.name)
		}
		if parameter.name == "repository" && projectName != "" {
			value = strings.TrimPrefix(value, projectName+"/")
			if value == "" {
				return "", nil, errors.New("repository 不能只包含项目名称")
			}
		}
		encoded := url.PathEscape(value)
		if parameter.doubleEncode {
			encoded = url.PathEscape(encoded)
		}
		path = strings.ReplaceAll(path, "{"+parameter.placeholder+"}", encoded)
		if parameter.name == "project" {
			headers.Set("X-Is-Resource-Name", "true")
		}
	}
	return path, headers, nil
}

func buildControlQuery(allowed []string, input url.Values, applyPaginationDefaults bool) (url.Values, error) {
	result := make(url.Values)
	for _, key := range allowed {
		values, exists := input[key]
		if !exists {
			continue
		}
		if len(values) > 4 {
			return nil, fmt.Errorf("%s 参数重复次数过多", key)
		}
		for _, value := range values {
			if len(value) > 2048 || strings.ContainsAny(value, "\r\n\x00") {
				return nil, fmt.Errorf("%s 参数包含无效字符或长度过长", key)
			}
			result.Add(key, value)
		}
	}
	if slicesContain(allowed, "page") && (applyPaginationDefaults || result.Has("page") || result.Has("page_size")) {
		page, err := positiveQueryInt(result.Get("page"), 1, 1_000_000)
		if err != nil {
			return nil, fmt.Errorf("page %w", err)
		}
		pageSize, err := positiveQueryInt(result.Get("page_size"), 20, 100)
		if err != nil {
			return nil, fmt.Errorf("page_size %w", err)
		}
		result.Set("page", strconv.Itoa(page))
		result.Set("page_size", strconv.Itoa(pageSize))
	}
	return result, nil
}

func positiveQueryInt(raw string, fallback, maximum int) (int, error) {
	if raw == "" {
		return fallback, nil
	}
	value, err := strconv.Atoi(raw)
	if err != nil || value < 1 || value > maximum {
		return 0, fmt.Errorf("必须是 1 到 %d 之间的整数", maximum)
	}
	return value, nil
}

func validateCurrentPermissionsQuery(query url.Values) error {
	if relative := query.Get("relative"); relative != "" && relative != "true" && relative != "false" {
		return errors.New("relative 必须是 true 或 false")
	}
	if scope := query.Get("scope"); scope != "" {
		if !strings.HasPrefix(scope, "/") || len(scope) > 1024 || strings.ContainsAny(scope, "\r\n\x00\t ") {
			return errors.New("scope 必须是以 / 开头且不含空白字符的权限范围")
		}
	}
	return nil
}

var artifactCopySourcePattern = regexp.MustCompile(`^[a-z0-9]+(?:[._-][a-z0-9]+)*(?:/[a-z0-9]+(?:[._-][a-z0-9]+)*)+(?::[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}|@sha256:[a-fA-F0-9]{64})$`)

func validateArtifactCopyQuery(query url.Values) error {
	source := query.Get("from")
	if len(source) > 1024 || !artifactCopySourcePattern.MatchString(source) {
		return errors.New("from 必须是 project/repository:tag 或 project/repository@sha256:digest")
	}
	return nil
}

func readControlBody(w http.ResponseWriter, r *http.Request, config controlMethod) ([]byte, map[string]any, error) {
	if !config.bodyRequired && !config.bodyOptional {
		return nil, nil, nil
	}
	r.Body = http.MaxBytesReader(w, r.Body, maxBodyBytes)
	body, err := io.ReadAll(r.Body)
	if err != nil {
		return nil, nil, errors.New("JSON 请求体超过 1 MiB 或读取失败")
	}
	if len(strings.TrimSpace(string(body))) == 0 {
		if config.bodyRequired {
			return nil, nil, errors.New("缺少 JSON 请求体")
		}
		return nil, nil, nil
	}
	var decoded map[string]any
	if err := json.Unmarshal(body, &decoded); err != nil || decoded == nil {
		return nil, nil, errors.New("请求体必须是一个有效的 JSON 对象")
	}
	return body, decoded, nil
}

func writeControlResponse(w http.ResponseWriter, response *harborResponse, config controlMethod, query url.Values) {
	if config.raw {
		for _, header := range []string{"Content-Type", "Content-Disposition"} {
			if value := response.Header.Get(header); value != "" {
				w.Header().Set(header, value)
			}
		}
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.WriteHeader(response.StatusCode)
		_, _ = w.Write(response.Body)
		return
	}
	if config.list {
		var items []any
		if len(response.Body) > 0 {
			if err := json.Unmarshal(response.Body, &items); err != nil {
				writeError(w, http.StatusBadGateway, "Harbor 响应无效", "列表接口没有返回 JSON 数组")
				return
			}
		}
		total := len(items)
		if headerTotal, err := strconv.Atoi(response.Header.Get("X-Total-Count")); err == nil && headerTotal >= 0 {
			total = headerTotal
		}
		page, _ := strconv.Atoi(query.Get("page"))
		pageSize, _ := strconv.Atoi(query.Get("page_size"))
		writeJSON(w, http.StatusOK, map[string]any{
			"items":      items,
			"pagination": map[string]any{"page": page, "page_size": pageSize, "total": total},
			"link":       response.Header.Get("Link"),
		})
		return
	}
	payload := map[string]any{"ok": true}
	if location := response.Header.Get("Location"); location != "" {
		payload["location"] = location
	}
	if len(response.Body) > 0 {
		var data any
		if json.Unmarshal(response.Body, &data) == nil {
			payload["data"] = data
		} else {
			payload["data"] = string(response.Body)
		}
	}
	status := response.StatusCode
	if status == http.StatusNoContent {
		status = http.StatusOK
	}
	writeJSON(w, status, payload)
}

func allowedMethodHeader(entries map[string]controlMethod) string {
	order := []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete}
	allowed := make([]string, 0, len(entries))
	for _, candidate := range order {
		if _, ok := entries[candidate]; ok {
			allowed = append(allowed, candidate)
		}
	}
	return strings.Join(allowed, ", ")
}

func validateProjectCreate(body map[string]any) error {
	name, _ := body["project_name"].(string)
	if err := validateResourceName(name, "项目名称", 255, false); err != nil {
		return err
	}
	return validateProjectUpdate(body)
}

func validateProjectUpdate(body map[string]any) error {
	if err := validateAllowedFields(body, "project_name", "public", "metadata", "cve_allowlist", "storage_limit", "registry_id"); err != nil {
		return err
	}
	if public, exists := body["public"]; exists && public != nil {
		if _, ok := public.(bool); !ok {
			return errors.New("public 必须是布尔值或 null")
		}
	}
	if metadata, exists := body["metadata"]; exists {
		values, ok := metadata.(map[string]any)
		if !ok {
			return errors.New("metadata 必须是 JSON 对象")
		}
		if err := validateProjectMetadata(values); err != nil {
			return err
		}
	}
	if allowlist, exists := body["cve_allowlist"]; exists {
		values, ok := allowlist.(map[string]any)
		if !ok {
			return errors.New("cve_allowlist 必须是 JSON 对象")
		}
		if err := validateCVEAllowlist(values); err != nil {
			return err
		}
	}
	if storage, exists := body["storage_limit"]; exists && storage != nil {
		value, ok := integerNumberValue(storage)
		if !ok || value < -1 {
			return errors.New("storage_limit 必须为 -1、0 或正整数")
		}
	}
	if registry, exists := body["registry_id"]; exists && registry != nil {
		value, ok := integerNumberValue(registry)
		if !ok || value < 0 {
			return errors.New("registry_id 必须是 0 或正整数")
		}
	}
	return nil
}

func validateProjectMetadata(metadata map[string]any) error {
	allowed := []string{
		"public", "enable_content_trust", "enable_content_trust_cosign", "prevent_vul", "severity", "auto_scan",
		"auto_sbom_generation", "reuse_sys_cve_allowlist", "retention_id", "proxy_speed_kb", "max_upstream_conn",
		"proxy_cache_local_on_not_found", "proxy_referrer_api",
	}
	if err := validateAllowedFields(metadata, allowed...); err != nil {
		return fmt.Errorf("项目 metadata 无效：%w", err)
	}
	booleanFields := []string{
		"public", "enable_content_trust", "enable_content_trust_cosign", "prevent_vul", "auto_scan",
		"auto_sbom_generation", "reuse_sys_cve_allowlist", "proxy_cache_local_on_not_found", "proxy_referrer_api",
	}
	for _, field := range booleanFields {
		if raw, exists := metadata[field]; exists && raw != nil {
			value, ok := raw.(string)
			if !ok || (value != "true" && value != "false") {
				return fmt.Errorf("项目 metadata.%s 必须是字符串 true 或 false", field)
			}
		}
	}
	if raw, exists := metadata["severity"]; exists && raw != nil {
		value, ok := raw.(string)
		if !ok || !slicesContain([]string{"none", "low", "medium", "high", "critical"}, value) {
			return errors.New("项目 metadata.severity 必须是 none、low、medium、high 或 critical")
		}
	}
	for _, field := range []string{"retention_id", "proxy_speed_kb", "max_upstream_conn"} {
		if raw, exists := metadata[field]; exists && raw != nil {
			value, ok := raw.(string)
			if !ok || len(value) > 32 || strings.ContainsAny(value, "\r\n\x00") {
				return fmt.Errorf("项目 metadata.%s 必须是 32 个字符以内的单行字符串", field)
			}
			if field == "proxy_speed_kb" || field == "max_upstream_conn" {
				parsed, err := strconv.ParseInt(value, 10, 64)
				if err != nil || parsed == 0 || parsed < -1 {
					return fmt.Errorf("项目 metadata.%s 必须是 -1 或正整数", field)
				}
			}
		}
	}
	return nil
}

func validateProjectScanner(body map[string]any) error {
	uuid, ok := body["uuid"].(string)
	if !ok || !validUUID(uuid) {
		return errors.New("扫描器 uuid 必须是有效的 UUID")
	}
	return nil
}

func validUUID(value string) bool {
	if len(value) != 36 {
		return false
	}
	for index, character := range value {
		if index == 8 || index == 13 || index == 18 || index == 23 {
			if character != '-' {
				return false
			}
			continue
		}
		if !((character >= '0' && character <= '9') || (character >= 'a' && character <= 'f') || (character >= 'A' && character <= 'F')) {
			return false
		}
	}
	return true
}

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
	if numberValue(body["id"]) <= 0 {
		return errors.New("标签 id 必须是正整数")
	}
	return nil
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

func validateAllowedFields(body map[string]any, allowed ...string) error {
	for key := range body {
		if !slicesContain(allowed, key) {
			return fmt.Errorf("请求体包含不允许的字段 %s", key)
		}
	}
	return nil
}

func validatePreheatInstance(body map[string]any) error {
	if err := validateAllowedFields(body, "id", "name", "description", "vendor", "endpoint", "auth_mode", "auth_info", "status", "enabled", "default", "insecure", "setup_timestamp"); err != nil {
		return err
	}
	name, _ := body["name"].(string)
	if err := validateResourceName(name, "P2P 实例名称", 255, true); err != nil {
		return err
	}
	if !validPreheatName(name) {
		return errors.New("P2P 实例名称只能使用字母、数字及单个点、下划线或连字符分隔")
	}
	vendor, _ := body["vendor"].(string)
	if err := validateResourceName(vendor, "P2P Provider", 255, false); err != nil {
		return err
	}
	if err := validateHTTPURL(body["endpoint"], "P2P 实例地址"); err != nil {
		return err
	}
	if description, ok := body["description"].(string); ok && (len(description) > 1024 || strings.ContainsAny(description, "\x00")) {
		return errors.New("P2P 实例描述不能超过 1024 个字符")
	}
	if authMode, ok := body["auth_mode"].(string); ok && (strings.TrimSpace(authMode) == "" || len(authMode) > 64 || strings.ContainsAny(authMode, "\r\n\x00")) {
		return errors.New("P2P 认证模式无效")
	}
	if authInfo, ok := body["auth_info"]; ok {
		credentials, objectOK := authInfo.(map[string]any)
		if !objectOK {
			return errors.New("P2P auth_info 必须是 JSON 对象")
		}
		for key, raw := range credentials {
			value, valueOK := raw.(string)
			if !valueOK || len(key) > 128 || len(value) > 4096 || strings.ContainsAny(key+value, "\x00") {
				return errors.New("P2P 凭据字段必须是长度受限的文本")
			}
		}
	}
	for _, field := range []string{"enabled", "default", "insecure"} {
		if raw, ok := body[field]; ok {
			if _, boolean := raw.(bool); !boolean {
				return fmt.Errorf("%s 必须是布尔值", field)
			}
		}
	}
	return nil
}

func validatePreheatInstancePing(body map[string]any) error {
	if numberValue(body["id"]) > 0 {
		return validateAllowedFields(body, "id")
	}
	return validatePreheatInstance(body)
}

func validatePreheatPolicy(body map[string]any) error {
	if err := validateAllowedFields(body, "id", "name", "description", "project_id", "provider_id", "filters", "trigger", "enabled", "extra_attrs", "creation_time", "update_time"); err != nil {
		return err
	}
	name, _ := body["name"].(string)
	if err := validateResourceName(name, "预热策略名称", 255, true); err != nil {
		return err
	}
	if !validPreheatName(name) {
		return errors.New("预热策略名称只能使用字母、数字及单个点、下划线或连字符分隔")
	}
	if raw, ok := body["id"]; ok && numberValue(raw) <= 0 {
		return errors.New("预热策略 id 必须是正整数")
	}
	if raw, ok := body["project_id"]; ok && numberValue(raw) <= 0 {
		return errors.New("预热策略 project_id 必须是正整数")
	}
	if numberValue(body["provider_id"]) <= 0 {
		return errors.New("预热策略 provider_id 必须是正整数")
	}
	for _, field := range []string{"description", "filters", "trigger", "extra_attrs"} {
		if raw, ok := body[field]; ok {
			value, text := raw.(string)
			if !text || len(value) > 65536 || strings.ContainsAny(value, "\x00") {
				return fmt.Errorf("预热策略 %s 必须是 65536 个字符以内的文本", field)
			}
		}
	}
	filtersText, _ := body["filters"].(string)
	var filters []map[string]any
	if strings.TrimSpace(filtersText) == "" || json.Unmarshal([]byte(filtersText), &filters) != nil || len(filters) == 0 {
		return errors.New("预热策略 filters 必须是非空 JSON 数组")
	}
	for _, filter := range filters {
		filterType, _ := filter["type"].(string)
		if !slicesContain([]string{"repository", "tag", "label", "signature", "vulnerability"}, filterType) {
			return errors.New("预热策略包含不支持的筛选类型")
		}
		if _, exists := filter["value"]; !exists {
			return errors.New("预热策略筛选条件缺少 value")
		}
	}
	triggerText, _ := body["trigger"].(string)
	var trigger struct {
		Type    string `json:"type"`
		Setting struct {
			Cron string `json:"cron"`
		} `json:"trigger_setting"`
	}
	if json.Unmarshal([]byte(triggerText), &trigger) != nil || !slicesContain([]string{"manual", "scheduled", "event_based", "scheduled(paused)"}, trigger.Type) {
		return errors.New("预热策略 trigger 必须包含有效的官方触发类型")
	}
	if trigger.Type == "scheduled" && strings.TrimSpace(trigger.Setting.Cron) == "" {
		return errors.New("定时预热策略必须包含 Cron 表达式")
	}
	if extraText, ok := body["extra_attrs"].(string); ok && strings.TrimSpace(extraText) != "" {
		var extra map[string]any
		if json.Unmarshal([]byte(extraText), &extra) != nil {
			return errors.New("预热策略 extra_attrs 必须是 JSON 对象")
		}
	}
	if raw, ok := body["enabled"]; ok {
		if _, boolean := raw.(bool); !boolean {
			return errors.New("预热策略 enabled 必须是布尔值")
		}
	}
	return nil
}

func validatePreheatExecutionStop(body map[string]any) error {
	if err := validateAllowedFields(body, "status"); err != nil {
		return err
	}
	status, _ := body["status"].(string)
	if !strings.EqualFold(status, "Stopped") {
		return errors.New("停止预热执行时 status 必须是 Stopped")
	}
	return nil
}

func validateHTTPURL(raw any, label string) error {
	value, _ := raw.(string)
	parsed, err := url.Parse(strings.TrimSpace(value))
	if err != nil || parsed.Host == "" || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		return fmt.Errorf("%s 必须是完整的 http:// 或 https:// URL", label)
	}
	if parsed.User != nil || parsed.Fragment != "" {
		return fmt.Errorf("%s 不能包含凭据或片段", label)
	}
	return nil
}

func validPreheatName(value string) bool {
	for index, character := range value {
		alphaNumeric := (character >= 'a' && character <= 'z') || (character >= 'A' && character <= 'Z') || (character >= '0' && character <= '9')
		if alphaNumeric {
			continue
		}
		if character != '.' && character != '_' && character != '-' {
			return false
		}
		if index == 0 || index == len(value)-1 {
			return false
		}
		previous := value[index-1]
		if previous == '.' || previous == '_' || previous == '-' {
			return false
		}
	}
	return value != ""
}

func validateMemberCreate(body map[string]any) error {
	if err := validateAllowedFields(body, "role_id", "member_user", "member_group"); err != nil {
		return err
	}
	if err := validateRole(body); err != nil {
		return err
	}
	user, userOK := body["member_user"].(map[string]any)
	group, groupOK := body["member_group"].(map[string]any)
	if userOK == groupOK {
		return errors.New("必须且只能提供 member_user 或 member_group")
	}
	if userOK {
		if err := validateAllowedFields(user, "user_id", "username"); err != nil {
			return fmt.Errorf("member_user 无效：%w", err)
		}
		username, _ := user["username"].(string)
		if err := validateResourceName(username, "成员用户名", 255, true); err != nil {
			return err
		}
	}
	if groupOK {
		if err := validateAllowedFields(group, "id", "group_name", "group_type", "ldap_group_dn"); err != nil {
			return fmt.Errorf("member_group 无效：%w", err)
		}
		name, _ := group["group_name"].(string)
		if err := validateResourceName(name, "成员组名称", 255, true); err != nil {
			return err
		}
		groupType := numberValue(group["group_type"])
		if groupType < 1 || groupType > 3 {
			return errors.New("成员组类型必须是 LDAP、HTTP 或 OIDC")
		}
		if groupType == 1 && strings.TrimSpace(stringValue(group["ldap_group_dn"])) == "" {
			return errors.New("LDAP 成员组必须包含 ldap_group_dn")
		}
	}
	return nil
}

func validateMemberRole(body map[string]any) error {
	return validateRole(body)
}

func validateRole(body map[string]any) error {
	role := int(numberValue(body["role_id"]))
	if role < 1 || role > 4 {
		return errors.New("role_id 必须是 1 到 4：项目管理员、开发者、访客或维护者")
	}
	return nil
}

var replicationNamespacePattern = regexp.MustCompile(`^[a-z0-9]+(?:[/._-][a-z0-9]+)*$`)

func validateReplicationPolicy(body map[string]any) error {
	if err := validateAllowedFields(body,
		"name", "description", "src_registry", "dest_registry", "dest_namespace", "dest_namespace_replace_count",
		"trigger", "filters", "replicate_deletion", "deletion", "override", "enabled", "speed", "copy_by_chunk", "single_active_replication",
	); err != nil {
		return err
	}
	name, _ := body["name"].(string)
	if err := validateResourceName(name, "策略名称", 255, true); err != nil {
		return err
	}
	if raw, exists := body["description"]; exists {
		description, ok := raw.(string)
		if !ok || len(description) > 1024 || strings.ContainsRune(description, '\x00') {
			return errors.New("策略描述必须是 1024 个字符以内的文本")
		}
	}

	sourceID, sourceSet, err := replicationRegistryID(body["src_registry"], "src_registry")
	if err != nil {
		return err
	}
	destinationID, destinationSet, err := replicationRegistryID(body["dest_registry"], "dest_registry")
	if err != nil {
		return err
	}
	if sourceSet == destinationSet {
		return errors.New("src_registry 与 dest_registry 必须且只能设置一个")
	}

	if raw, exists := body["dest_namespace"]; exists && raw != nil {
		namespace, ok := raw.(string)
		if !ok || len(namespace) > 255 || (namespace != "" && !replicationNamespacePattern.MatchString(namespace)) {
			return errors.New("dest_namespace 必须是 255 个字符以内的小写命名空间路径")
		}
	}
	if raw, exists := body["dest_namespace_replace_count"]; exists && raw != nil {
		level, ok := integerNumberValue(raw)
		if !ok || !slicesContain([]string{"-1", "0", "1", "2", "3"}, strconv.FormatInt(level, 10)) {
			return errors.New("dest_namespace_replace_count 必须是 -1、0、1、2 或 3")
		}
	}

	triggerType, err := validateReplicationTrigger(body["trigger"])
	if err != nil {
		return err
	}
	if err := validateReplicationFilters(body["filters"]); err != nil {
		return err
	}

	booleanFields := []string{"replicate_deletion", "deletion", "override", "enabled", "copy_by_chunk", "single_active_replication"}
	for _, field := range booleanFields {
		if raw, exists := body[field]; exists && raw != nil {
			if _, ok := raw.(bool); !ok {
				return fmt.Errorf("%s 必须是布尔值", field)
			}
		}
	}
	if _, hasCurrent := body["replicate_deletion"]; hasCurrent {
		if _, hasDeprecated := body["deletion"]; hasDeprecated {
			return errors.New("replicate_deletion 与已弃用的 deletion 不能同时提交")
		}
	}
	deletion := false
	if value, ok := body["replicate_deletion"].(bool); ok {
		deletion = value
	}
	if value, ok := body["deletion"].(bool); ok {
		deletion = value
	}
	if deletion && (triggerType != "event_based" || sourceSet || destinationID <= 0) {
		return errors.New("同步删除仅适用于推送方向的事件触发策略")
	}
	if single, _ := body["single_active_replication"].(bool); single && triggerType == "event_based" {
		return errors.New("事件触发策略不支持单活执行")
	}

	if raw, exists := body["speed"]; exists && raw != nil {
		speed, ok := integerNumberValue(raw)
		if !ok || speed == 0 || speed < -1 || speed > math.MaxInt32 {
			return errors.New("speed 必须是 -1（不限速）或不超过 2147483647 的正整数 Kbps")
		}
	}
	_ = sourceID
	return nil
}

func replicationRegistryID(raw any, field string) (int64, bool, error) {
	if raw == nil {
		return 0, false, nil
	}
	registry, ok := raw.(map[string]any)
	if !ok {
		return 0, false, fmt.Errorf("%s 必须是只包含 id 的对象或 null", field)
	}
	if err := validateAllowedFields(registry, "id"); err != nil {
		return 0, false, fmt.Errorf("%s 无效：%w", field, err)
	}
	id, ok := integerNumberValue(registry["id"])
	if !ok || id <= 0 {
		return 0, false, fmt.Errorf("%s.id 必须是正整数", field)
	}
	return id, true, nil
}

func validateReplicationTrigger(raw any) (string, error) {
	trigger, ok := raw.(map[string]any)
	if !ok {
		return "", errors.New("trigger 必须是 JSON 对象")
	}
	if err := validateAllowedFields(trigger, "type", "trigger_settings"); err != nil {
		return "", fmt.Errorf("trigger 无效：%w", err)
	}
	triggerType, _ := trigger["type"].(string)
	if !slicesContain([]string{"manual", "event_based", "scheduled"}, triggerType) {
		return "", errors.New("trigger.type 必须是 manual、event_based 或 scheduled")
	}
	settingsRaw, exists := trigger["trigger_settings"]
	if !exists || settingsRaw == nil {
		settingsRaw = map[string]any{}
	}
	settings, ok := settingsRaw.(map[string]any)
	if !ok {
		return "", errors.New("trigger.trigger_settings 必须是 JSON 对象")
	}
	if err := validateAllowedFields(settings, "cron"); err != nil {
		return "", fmt.Errorf("trigger.trigger_settings 无效：%w", err)
	}
	cron := ""
	if rawCron, exists := settings["cron"]; exists {
		var text bool
		cron, text = rawCron.(string)
		if !text || len(cron) > 255 || strings.ContainsAny(cron, "\r\n\x00") {
			return "", errors.New("trigger.trigger_settings.cron 必须是 255 个字符以内的单行文本")
		}
	}
	if triggerType == "scheduled" {
		parts := strings.Fields(cron)
		if len(parts) != 6 || parts[0] != "0" || parts[1] == "*" {
			return "", errors.New("定时复制必须使用以 0 开头的六段 Harbor Cron 表达式")
		}
	} else if strings.TrimSpace(cron) != "" {
		return "", errors.New("非定时复制不能设置 Cron 表达式")
	}
	return triggerType, nil
}

func validateReplicationFilters(raw any) error {
	if raw == nil {
		return nil
	}
	filters, ok := raw.([]any)
	if !ok || len(filters) > 16 {
		return errors.New("filters 必须是数量不超过 16 的数组")
	}
	seen := make(map[string]bool, len(filters))
	for index, rawFilter := range filters {
		filter, ok := rawFilter.(map[string]any)
		if !ok {
			return fmt.Errorf("第 %d 个复制筛选器必须是 JSON 对象", index+1)
		}
		if err := validateAllowedFields(filter, "type", "value", "decoration"); err != nil {
			return fmt.Errorf("第 %d 个复制筛选器无效：%w", index+1, err)
		}
		filterType, _ := filter["type"].(string)
		if !slicesContain([]string{"name", "tag", "label", "resource"}, filterType) {
			return fmt.Errorf("第 %d 个复制筛选器 type 不受 Harbor 复制 API 支持", index+1)
		}
		if seen[filterType] {
			return fmt.Errorf("复制筛选器 type %s 不能重复", filterType)
		}
		seen[filterType] = true
		if decorationRaw, exists := filter["decoration"]; exists {
			decoration, _ := decorationRaw.(string)
			if decoration != "matches" && decoration != "excludes" {
				return fmt.Errorf("第 %d 个复制筛选器 decoration 必须是 matches 或 excludes", index+1)
			}
		}
		if filterType == "label" {
			labels, ok := filter["value"].([]any)
			if !ok || len(labels) == 0 || len(labels) > 100 {
				return fmt.Errorf("第 %d 个标签筛选器 value 必须是 1 到 100 个标签名称的数组", index+1)
			}
			for _, rawLabel := range labels {
				label, ok := rawLabel.(string)
				if !ok || strings.TrimSpace(label) == "" || len(label) > 255 || strings.ContainsAny(label, "\r\n\x00,") {
					return fmt.Errorf("第 %d 个标签筛选器包含无效标签名称", index+1)
				}
			}
			continue
		}
		value, ok := filter["value"].(string)
		if !ok || strings.TrimSpace(value) == "" || len(value) > 1024 || strings.ContainsAny(value, "\r\n\x00") {
			return fmt.Errorf("第 %d 个复制筛选器 value 必须是 1024 个字符以内的非空文本", index+1)
		}
	}
	return nil
}

func validateReplicationStart(body map[string]any) error {
	if numberValue(body["policy_id"]) <= 0 {
		return errors.New("policy_id 必须是正整数")
	}
	return nil
}

func validateRegistryCreate(body map[string]any) error {
	name, _ := body["name"].(string)
	if err := validateResourceName(name, "连接名称", 255, true); err != nil {
		return err
	}
	registryType, _ := body["type"].(string)
	if strings.TrimSpace(registryType) == "" {
		return errors.New("必须选择远端仓库类型")
	}
	return validateRegistryURL(body["url"])
}

func validateRegistryUpdate(body map[string]any) error {
	if raw, ok := body["url"]; ok {
		return validateRegistryURL(raw)
	}
	return nil
}

func validateRegistryPing(body map[string]any) error {
	if numberValue(body["id"]) > 0 {
		return nil
	}
	return validateRegistryURL(body["url"])
}

func validateRegistryURL(raw any) error {
	value, _ := raw.(string)
	parsed, err := url.Parse(strings.TrimSpace(value))
	if err != nil || parsed.Host == "" || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		return errors.New("远端仓库地址必须是完整的 http:// 或 https:// URL")
	}
	if parsed.User != nil || parsed.Fragment != "" {
		return errors.New("远端仓库地址不能包含凭据或片段")
	}
	return nil
}

func validateRobot(body map[string]any) error {
	name, _ := body["name"].(string)
	if err := validateResourceName(name, "机器人名称", 255, true); err != nil {
		return err
	}
	level, _ := body["level"].(string)
	if level != "project" && level != "system" {
		return errors.New("机器人 level 必须是 project 或 system")
	}
	duration := numberValue(body["duration"])
	if duration != -1 && duration < 1 {
		return errors.New("机器人有效期必须是 -1（永不过期）或正整数")
	}
	permissions, ok := body["permissions"].([]any)
	if !ok || len(permissions) == 0 {
		return errors.New("机器人 permissions 不能为空")
	}
	for _, rawPermission := range permissions {
		permission, ok := rawPermission.(map[string]any)
		if !ok {
			return errors.New("机器人 permission 必须是 JSON 对象")
		}
		namespace, _ := permission["namespace"].(string)
		access, accessOK := permission["access"].([]any)
		if strings.TrimSpace(namespace) == "" || !accessOK || len(access) == 0 {
			return errors.New("机器人 permission 必须包含 namespace 和 access")
		}
	}
	return nil
}

func validateRobotSecret(body map[string]any) error {
	secret, ok := body["secret"].(string)
	if !ok {
		return errors.New("机器人密钥必须是文本")
	}
	if len(secret) > 255 || strings.ContainsAny(secret, "\r\n\x00") {
		return errors.New("机器人密钥包含无效字符或长度超过 255")
	}
	return nil
}

func validateLabel(body map[string]any) error {
	name, _ := body["name"].(string)
	if err := validateResourceName(name, "标签名称", 255, true); err != nil {
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
	if body["scope"] == "p" && numberValue(body["project_id"]) <= 0 {
		return errors.New("项目标签必须包含有效的 project_id")
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

func validateImmutableRule(body map[string]any) error {
	tags, ok := body["tag_selectors"].([]any)
	if !ok || len(tags) == 0 {
		return errors.New("不可变规则必须包含 tag_selectors")
	}
	scopes, ok := body["scope_selectors"].(map[string]any)
	if !ok {
		return errors.New("不可变规则必须包含 scope_selectors")
	}
	repositories, ok := scopes["repository"].([]any)
	if !ok || len(repositories) == 0 {
		return errors.New("不可变规则必须包含 repository 范围")
	}
	if err := validateImmutableSelectors(tags, "Tag"); err != nil {
		return err
	}
	if err := validateImmutableSelectors(repositories, "仓库"); err != nil {
		return err
	}
	return nil
}

func validateImmutableSelectors(selectors []any, label string) error {
	for _, rawSelector := range selectors {
		selector, ok := rawSelector.(map[string]any)
		if !ok {
			return fmt.Errorf("%s 选择器必须是 JSON 对象", label)
		}
		pattern, _ := selector["pattern"].(string)
		if strings.TrimSpace(pattern) == "" || len(pattern) > 1024 || strings.ContainsAny(pattern, "\r\n\x00") {
			return fmt.Errorf("%s 匹配规则不能为空或超过 1024 个字符", label)
		}
	}
	return nil
}

func validateWebhook(body map[string]any) error {
	name, _ := body["name"].(string)
	if err := validateResourceName(name, "Webhook 名称", 255, true); err != nil {
		return err
	}
	targets, ok := body["targets"].([]any)
	if !ok || len(targets) == 0 {
		return errors.New("Webhook 必须至少包含一个 target")
	}
	if len(targets) > 10 {
		return errors.New("Webhook target 数量不能超过 10")
	}
	for _, rawTarget := range targets {
		target, ok := rawTarget.(map[string]any)
		if !ok {
			return errors.New("Webhook target 必须是 JSON 对象")
		}
		address, _ := target["address"].(string)
		parsed, err := url.Parse(strings.TrimSpace(address))
		if err != nil || parsed.Host == "" || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.User != nil {
			return errors.New("Webhook 目标地址必须是完整的 http:// 或 https:// URL，且不能包含凭据")
		}
		if authHeader, ok := target["auth_header"].(string); ok && (len(authHeader) > 4096 || strings.ContainsAny(authHeader, "\r\n\x00")) {
			return errors.New("Webhook Authorization 请求头包含无效字符或长度过长")
		}
	}
	events, ok := body["event_types"].([]any)
	if !ok || len(events) == 0 {
		return errors.New("Webhook 必须至少选择一种事件")
	}
	if len(events) > 100 {
		return errors.New("Webhook 事件类型数量过多")
	}
	return nil
}

func validateUserCreate(body map[string]any) error {
	if err := validateAllowedFields(body, "username", "password", "email", "realname", "comment"); err != nil {
		return err
	}
	username, _ := body["username"].(string)
	if err := validateResourceName(username, "用户名", 255, false); err != nil {
		return err
	}
	password, _ := body["password"].(string)
	if err := validateUserSecret(password); err != nil {
		return fmt.Errorf("用户密码%s", err)
	}
	return validateUserProfileFields(body)
}

func validateUserProfile(body map[string]any) error {
	if err := validateAllowedFields(body, "email", "realname", "comment"); err != nil {
		return err
	}
	return validateUserProfileFields(body)
}

func validateUserProfileFields(body map[string]any) error {
	for _, field := range []string{"email", "realname", "comment"} {
		if value, ok := body[field]; ok {
			text, textOK := value.(string)
			if !textOK || len(text) > 1024 || strings.ContainsAny(text, "\r\n\x00") {
				return fmt.Errorf("%s 必须是 1024 个字符以内的文本", field)
			}
		}
	}
	if email, _ := body["email"].(string); email != "" && (!strings.Contains(email, "@") || len(email) > 255) {
		return errors.New("邮箱地址格式无效")
	}
	return nil
}

func validateUserSysadmin(body map[string]any) error {
	if _, ok := body["sysadmin_flag"].(bool); !ok {
		return errors.New("sysadmin_flag 必须是布尔值")
	}
	return nil
}

func validateUserPassword(body map[string]any) error {
	if err := validateAllowedFields(body, "old_password", "new_password"); err != nil {
		return err
	}
	password, _ := body["new_password"].(string)
	if err := validateUserSecret(password); err != nil {
		return fmt.Errorf("新密码%s", err)
	}
	if old, ok := body["old_password"].(string); ok && (len(old) > 4096 || strings.ContainsRune(old, '\x00')) {
		return errors.New("旧密码长度超过限制")
	}
	return nil
}

func validateUserCLISecret(body map[string]any) error {
	if err := validateAllowedFields(body, "secret"); err != nil {
		return err
	}
	secret, _ := body["secret"].(string)
	if err := validateUserSecret(secret); err != nil {
		return fmt.Errorf("CLI Secret%s", err)
	}
	return nil
}

func validateUserSecret(secret string) error {
	if len(secret) < 8 || len(secret) > 128 || strings.ContainsRune(secret, '\x00') {
		return errors.New("必须是 8 到 128 个字符，并至少包含一个大写字母、一个小写字母和一个数字")
	}
	hasUpper := regexp.MustCompile(`[A-Z]`).MatchString(secret)
	hasLower := regexp.MustCompile(`[a-z]`).MatchString(secret)
	hasNumber := regexp.MustCompile(`[0-9]`).MatchString(secret)
	if !hasUpper || !hasLower || !hasNumber {
		return errors.New("必须是 8 到 128 个字符，并至少包含一个大写字母、一个小写字母和一个数字")
	}
	return nil
}

func validateUserGroup(body map[string]any) error {
	name, _ := body["group_name"].(string)
	if err := validateResourceName(name, "用户组名称", 255, true); err != nil {
		return err
	}
	groupType := numberValue(body["group_type"])
	if groupType < 1 || groupType > 3 {
		return errors.New("用户组类型必须是 LDAP、HTTP 或 OIDC")
	}
	if groupType == 1 && strings.TrimSpace(stringValue(body["ldap_group_dn"])) == "" {
		return errors.New("LDAP 用户组必须填写组 DN")
	}
	return nil
}

func validateQuota(body map[string]any) error {
	hard, ok := body["hard"].(map[string]any)
	if !ok || len(hard) == 0 {
		return errors.New("配额必须包含 hard 资源限制")
	}
	for resource, rawValue := range hard {
		if resource == "" || (numberValue(rawValue) < 0 && numberValue(rawValue) != -1) {
			return errors.New("配额值必须是 -1（不限制）或非负整数")
		}
	}
	return nil
}

func validateScanner(body map[string]any) error {
	name, _ := body["name"].(string)
	if err := validateResourceName(name, "扫描器名称", 255, true); err != nil {
		return err
	}
	if err := validateRegistryURL(body["url"]); err != nil {
		return errors.New(strings.NewReplacer("远端仓库", "扫描器").Replace(err.Error()))
	}
	for _, field := range []string{"auth", "access_credential"} {
		if value, ok := body[field].(string); ok && (len(value) > 4096 || strings.ContainsAny(value, "\r\n\x00")) {
			return fmt.Errorf("扫描器 %s 包含无效字符或长度过长", field)
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

func validateRetentionPolicy(body map[string]any) error {
	algorithm, _ := body["algorithm"].(string)
	if algorithm != "or" && algorithm != "and" {
		return errors.New("Tag 保留策略 algorithm 必须是 or 或 and")
	}
	rules, ok := body["rules"].([]any)
	if !ok || len(rules) == 0 || len(rules) > 100 {
		return errors.New("Tag 保留策略必须包含 1 到 100 条 rules")
	}
	for index, rawRule := range rules {
		rule, ok := rawRule.(map[string]any)
		if !ok {
			return fmt.Errorf("第 %d 条 Tag 保留规则必须是 JSON 对象", index+1)
		}
		if err := validateRetentionRule(rule); err != nil {
			return fmt.Errorf("第 %d 条 Tag 保留规则无效：%w", index+1, err)
		}
	}

	trigger, ok := body["trigger"].(map[string]any)
	if !ok || stringValue(trigger["kind"]) != "Schedule" {
		return errors.New("Tag 保留策略 trigger.kind 必须是 Schedule")
	}
	settings, ok := trigger["settings"].(map[string]any)
	if !ok {
		return errors.New("Tag 保留策略 trigger.settings 必须是 JSON 对象")
	}
	if cron, exists := settings["cron"]; exists {
		value, valid := cron.(string)
		if !valid || len(value) > 255 || strings.ContainsAny(value, "\r\n\x00") {
			return errors.New("Tag 保留策略 Cron 表达式无效或过长")
		}
	}

	scope, ok := body["scope"].(map[string]any)
	if !ok || stringValue(scope["level"]) != "project" || numberValue(scope["ref"]) <= 0 {
		return errors.New("Tag 保留策略 scope 必须引用有效项目")
	}
	return nil
}

func validateRetentionRule(rule map[string]any) error {
	if disabled, exists := rule["disabled"]; exists {
		if _, ok := disabled.(bool); !ok {
			return errors.New("disabled 必须是布尔值")
		}
	}
	if action, _ := rule["action"].(string); action != "retain" {
		return errors.New("action 必须是 retain")
	}
	template, _ := rule["template"].(string)
	if strings.TrimSpace(template) == "" || len(template) > 255 || strings.ContainsAny(template, "\r\n\x00") {
		return errors.New("template 不能为空或超过 255 个字符")
	}
	if params, ok := rule["params"].(map[string]any); !ok || len(params) > 32 {
		return errors.New("params 必须是参数数量不超过 32 的 JSON 对象")
	}
	tags, ok := rule["tag_selectors"].([]any)
	if !ok || len(tags) == 0 || len(tags) > 32 {
		return errors.New("tag_selectors 必须包含 1 到 32 个选择器")
	}
	scopes, ok := rule["scope_selectors"].(map[string]any)
	if !ok {
		return errors.New("scope_selectors 必须是 JSON 对象")
	}
	repositories, ok := scopes["repository"].([]any)
	if !ok || len(repositories) == 0 || len(repositories) > 32 {
		return errors.New("repository 范围必须包含 1 到 32 个选择器")
	}
	if err := validateRetentionSelectors(tags, "Tag", []string{"matches", "excludes"}); err != nil {
		return err
	}
	return validateRetentionSelectors(repositories, "仓库", []string{"repoMatches", "repoExcludes"})
}

func validateRetentionSelectors(selectors []any, label string, decorations []string) error {
	for _, rawSelector := range selectors {
		selector, ok := rawSelector.(map[string]any)
		if !ok {
			return fmt.Errorf("%s 选择器必须是 JSON 对象", label)
		}
		if stringValue(selector["kind"]) != "doublestar" {
			return fmt.Errorf("%s 选择器 kind 必须是 doublestar", label)
		}
		if !slicesContain(decorations, stringValue(selector["decoration"])) {
			return fmt.Errorf("%s 选择器 decoration 不受 Harbor 官方 API 支持", label)
		}
		pattern, _ := selector["pattern"].(string)
		if strings.TrimSpace(pattern) == "" || len(pattern) > 1024 || strings.ContainsAny(pattern, "\r\n\x00") {
			return fmt.Errorf("%s 匹配规则不能为空或超过 1024 个字符", label)
		}
		if extras, exists := selector["extras"]; exists {
			values, ok := extras.(map[string]any)
			if !ok {
				return fmt.Errorf("%s 选择器 extras 必须是 JSON 对象", label)
			}
			if untagged, exists := values["untagged"]; exists {
				if _, ok := untagged.(bool); !ok {
					return fmt.Errorf("%s 选择器 extras.untagged 必须是布尔值", label)
				}
			}
		}
	}
	return nil
}

func validateRetentionExecution(body map[string]any) error {
	if len(body) != 1 {
		return errors.New("Tag 保留执行请求只能包含 dry_run")
	}
	if _, ok := body["dry_run"].(bool); !ok {
		return errors.New("dry_run 必须是布尔值")
	}
	return nil
}

func validateRetentionExecutionAction(body map[string]any) error {
	if len(body) != 1 || stringValue(body["action"]) != "stop" {
		return errors.New("Tag 保留执行操作只支持 stop")
	}
	return nil
}

func validateSchedule(body map[string]any) error {
	schedule, ok := body["schedule"].(map[string]any)
	if !ok {
		return errors.New("任务计划必须包含 schedule 对象")
	}
	typeName, _ := schedule["type"].(string)
	allowed := map[string]bool{"Hourly": true, "Daily": true, "Weekly": true, "Custom": true, "Manual": true, "None": true, "Schedule": true}
	if !allowed[typeName] {
		return errors.New("任务计划类型不受 Harbor 官方 API 支持")
	}
	if typeName == "Custom" || typeName == "Schedule" {
		cron, _ := schedule["cron"].(string)
		if strings.TrimSpace(cron) == "" || len(cron) > 255 || strings.ContainsAny(cron, "\r\n\x00") {
			return errors.New("自定义任务计划必须包含有效的 Cron 表达式")
		}
	}
	return nil
}

func validateGCSchedule(body map[string]any) error {
	if err := validateSchedule(body); err != nil {
		return err
	}
	if err := validateAllowedFields(body, "schedule", "parameters"); err != nil {
		return err
	}
	raw, exists := body["parameters"]
	if !exists {
		return nil
	}
	parameters, ok := raw.(map[string]any)
	if !ok {
		return errors.New("垃圾清理参数必须是 JSON 对象")
	}
	if err := validateAllowedFields(parameters, "delete_untagged", "delete_tag", "dry_run", "workers"); err != nil {
		return err
	}
	for _, key := range []string{"delete_untagged", "delete_tag", "dry_run"} {
		if value, present := parameters[key]; present {
			if _, valid := value.(bool); !valid {
				return fmt.Errorf("垃圾清理参数 %s 必须是布尔值", key)
			}
		}
	}
	if value, present := parameters["workers"]; present {
		workers, valid := integerNumberValue(value)
		if !valid || workers < 1 || workers > 10 {
			return errors.New("垃圾清理并行工作数必须是 1 到 10 的整数")
		}
	}
	return nil
}

var purgeEventTypesPattern = regexp.MustCompile(`^[A-Za-z0-9_.-]+(?:,[A-Za-z0-9_.-]+)*$`)

func validatePurgeSchedule(body map[string]any) error {
	if err := validateSchedule(body); err != nil {
		return err
	}
	if err := validateAllowedFields(body, "schedule", "parameters"); err != nil {
		return err
	}
	parameters, ok := body["parameters"].(map[string]any)
	if !ok {
		return errors.New("审计日志清理必须包含 parameters 对象")
	}
	if err := validateAllowedFields(parameters, "audit_retention_hour", "dry_run", "include_event_types"); err != nil {
		return err
	}
	hours, valid := integerNumberValue(parameters["audit_retention_hour"])
	if !valid || hours < 1 || hours > 87_600_000 {
		return errors.New("审计日志保留时间必须是 1 到 87600000 小时之间的整数")
	}
	if dryRun, exists := parameters["dry_run"]; exists {
		if _, valid := dryRun.(bool); !valid {
			return errors.New("审计日志清理 dry_run 必须是布尔值")
		}
	}
	events, ok := parameters["include_event_types"].(string)
	if !ok || len(events) > 8192 || !purgeEventTypesPattern.MatchString(events) {
		return errors.New("审计日志清理事件类型必须是逗号分隔的有效事件名称")
	}
	return nil
}

func validateJobServiceAction(body map[string]any) error {
	if len(body) != 1 {
		return errors.New("Job Service 队列操作只能包含 action")
	}
	action, _ := body["action"].(string)
	if !slicesContain([]string{"stop", "pause", "resume"}, action) {
		return errors.New("Job Service 队列操作只支持 stop、pause 或 resume")
	}
	return nil
}

func validateConfigurations(body map[string]any) error {
	if len(body) == 0 {
		return errors.New("系统配置更新内容不能为空")
	}
	stringFields := map[string]bool{
		"auth_mode": true, "ldap_base_dn": true, "ldap_filter": true, "ldap_group_base_dn": true,
		"ldap_group_admin_dn": true, "ldap_group_attribute_name": true, "ldap_group_search_filter": true,
		"ldap_search_dn": true, "ldap_search_password": true, "ldap_uid": true, "ldap_url": true,
		"ldap_group_membership_attribute": true, "uaa_client_id": true, "uaa_client_secret": true,
		"uaa_endpoint": true, "http_authproxy_endpoint": true, "http_authproxy_tokenreview_endpoint": true,
		"http_authproxy_admin_groups": true, "http_authproxy_admin_usernames": true,
		"http_authproxy_server_certificate": true, "oidc_name": true, "oidc_endpoint": true,
		"oidc_client_id": true, "oidc_client_secret": true, "oidc_groups_claim": true,
		"oidc_admin_group": true, "oidc_group_filter": true, "oidc_scope": true, "oidc_user_claim": true,
		"oidc_extra_redirect_parms": true, "project_creation_restriction": true, "robot_name_prefix": true,
		"audit_log_forward_endpoint": true, "banner_message": true, "disabled_audit_log_event_types": true,
	}
	boolFields := map[string]bool{
		"primary_auth_mode": true, "ldap_group_attach_parallel": true, "ldap_verify_cert": true,
		"uaa_verify_cert": true, "http_authproxy_verify_cert": true, "http_authproxy_skip_search": true,
		"oidc_verify_cert": true, "oidc_auto_onboard": true, "oidc_logout": true, "read_only": true,
		"self_registration": true, "notification_enable": true, "quota_per_project_enable": true,
		"skip_audit_log_database": true, "scanner_skip_update_pulltime": true,
	}
	numberFields := map[string]bool{
		"ldap_group_search_scope": true, "ldap_scope": true, "ldap_timeout": true,
		"token_expiration": true, "robot_token_duration": true, "storage_per_project": true, "session_timeout": true,
	}
	for key, value := range body {
		switch {
		case stringFields[key]:
			text, ok := value.(string)
			if !ok || len(text) > 65535 || strings.ContainsRune(text, '\x00') {
				return fmt.Errorf("系统配置项 %s 的类型或长度无效", key)
			}
		case boolFields[key]:
			if _, ok := value.(bool); !ok {
				return fmt.Errorf("系统配置项 %s 必须是布尔值", key)
			}
		case numberFields[key]:
			number, ok := integerNumberValue(value)
			if !ok || !validConfigurationNumber(key, number) {
				return fmt.Errorf("系统配置项 %s 的数值无效", key)
			}
		default:
			return fmt.Errorf("系统配置项 %s 不在控制台允许列表中", key)
		}
	}
	if err := validateConfigurationSemantics(body); err != nil {
		return err
	}
	return nil
}

func validConfigurationNumber(key string, value int64) bool {
	switch key {
	case "storage_per_project":
		return value >= -1
	case "ldap_scope", "ldap_group_search_scope":
		return value >= 0 && value <= 2
	default:
		return value > 0
	}
}

func validateConfigurationSemantics(body map[string]any) error {
	if value, ok := body["auth_mode"].(string); ok && !slicesContain([]string{"db_auth", "ldap_auth", "uaa_auth", "oidc_auth", "http_auth"}, value) {
		return errors.New("认证模式必须是 db_auth、ldap_auth、uaa_auth、oidc_auth 或 http_auth")
	}
	if value, ok := body["project_creation_restriction"].(string); ok && !slicesContain([]string{"adminonly", "everyone"}, value) {
		return errors.New("项目创建权限必须是 adminonly 或 everyone")
	}
	if value, ok := body["robot_name_prefix"].(string); ok && (strings.TrimSpace(value) == "" || len(value) > 255 || strings.ContainsAny(value, "\r\n")) {
		return errors.New("机器人账号前缀必须是 255 个字符以内的单行文本")
	}
	for key, label := range map[string]string{
		"uaa_endpoint": "UAA 地址", "http_authproxy_endpoint": "HTTP 认证地址",
		"http_authproxy_tokenreview_endpoint": "HTTP Token Review 地址", "oidc_endpoint": "OIDC 地址",
		"audit_log_forward_endpoint": "审计日志转发地址",
	} {
		if value, ok := body[key].(string); ok && strings.TrimSpace(value) != "" {
			if err := validateHTTPURL(value, label); err != nil {
				return err
			}
		}
	}
	if value, ok := body["ldap_url"].(string); ok && strings.TrimSpace(value) != "" {
		parsed, err := url.Parse(strings.TrimSpace(value))
		if err != nil || parsed.Host == "" || (parsed.Scheme != "ldap" && parsed.Scheme != "ldaps") || parsed.User != nil || parsed.Fragment != "" {
			return errors.New("LDAP 地址必须是完整的 ldap:// 或 ldaps:// URL")
		}
	}
	if raw, ok := body["banner_message"].(string); ok {
		if err := validateBannerMessage(raw); err != nil {
			return err
		}
	}
	return nil
}

func validateBannerMessage(raw string) error {
	if raw == "" {
		return nil
	}
	var banner map[string]any
	if err := json.Unmarshal([]byte(raw), &banner); err != nil {
		return errors.New("横幅消息必须是 Harbor 官方 BannerMessage JSON")
	}
	if err := validateAllowedFields(banner, "message", "closable", "type", "fromDate", "toDate"); err != nil {
		return fmt.Errorf("横幅消息无效：%w", err)
	}
	message, ok := banner["message"].(string)
	if !ok || strings.TrimSpace(message) == "" || len(message) > 800 || strings.ContainsRune(message, '\x00') {
		return errors.New("横幅消息正文必须是 1 到 800 个字符")
	}
	closable, ok := banner["closable"].(bool)
	if !ok {
		return errors.New("横幅消息 closable 必须是布尔值")
	}
	_ = closable
	typeName, ok := banner["type"].(string)
	if !ok || !slicesContain([]string{"success", "info", "warning", "danger"}, typeName) {
		return errors.New("横幅消息类型必须是 success、info、warning 或 danger")
	}
	for _, key := range []string{"fromDate", "toDate"} {
		if value, exists := banner[key]; exists && value != nil {
			if _, ok := value.(string); !ok {
				return fmt.Errorf("横幅消息 %s 必须是日期字符串或 null", key)
			}
		}
	}
	return nil
}

func validateLDAPPing(body map[string]any) error {
	if err := validateAllowedFields(body, "ldap_url", "ldap_search_dn", "ldap_search_password", "ldap_base_dn", "ldap_filter", "ldap_uid", "ldap_scope", "ldap_connection_timeout", "ldap_verify_cert"); err != nil {
		return err
	}
	configuration := cloneMap(body)
	if timeout, exists := configuration["ldap_connection_timeout"]; exists {
		configuration["ldap_timeout"] = timeout
		delete(configuration, "ldap_connection_timeout")
	}
	return validateConfigurations(configuration)
}

func validateLDAPUserImport(body map[string]any) error {
	if err := validateAllowedFields(body, "ldap_uid_list"); err != nil {
		return err
	}
	users, ok := body["ldap_uid_list"].([]any)
	if !ok || len(users) == 0 || len(users) > 100 {
		return errors.New("ldap_uid_list 必须包含 1 到 100 个 LDAP 用户标识")
	}
	seen := make(map[string]struct{}, len(users))
	for _, raw := range users {
		uid, ok := raw.(string)
		uid = strings.TrimSpace(uid)
		if !ok {
			return errors.New("LDAP 用户标识必须是字符串")
		}
		if err := validateResourceName(uid, "LDAP 用户标识", 255, true); err != nil {
			return err
		}
		if _, exists := seen[uid]; exists {
			return errors.New("ldap_uid_list 不能包含重复用户")
		}
		seen[uid] = struct{}{}
	}
	return nil
}

func validateLDAPGroupSearchQuery(query url.Values) error {
	name := strings.TrimSpace(query.Get("groupname"))
	dn := strings.TrimSpace(query.Get("groupdn"))
	if name != "" && dn != "" {
		return errors.New("groupname 与 groupdn 只能选择一个")
	}
	for key, value := range map[string]string{"groupname": name, "groupdn": dn} {
		if len(value) > 1024 || strings.ContainsAny(value, "\r\n\x00") {
			return fmt.Errorf("%s 包含无效字符或长度过长", key)
		}
	}
	return nil
}

func validateOIDCPing(body map[string]any) error {
	if err := validateAllowedFields(body, "url", "verify_cert"); err != nil {
		return err
	}
	if err := validateHTTPURL(body["url"], "OIDC 地址"); err != nil {
		return err
	}
	if _, ok := body["verify_cert"].(bool); !ok {
		return errors.New("verify_cert 必须是布尔值")
	}
	return nil
}

func validateResourceName(value, label string, maximum int, allowSpaces bool) error {
	value = strings.TrimSpace(value)
	if value == "" {
		return errors.New(label + "不能为空")
	}
	if len(value) > maximum || strings.ContainsAny(value, "\r\n\x00/") {
		return fmt.Errorf("%s 包含无效字符或超过 %d 个字符", label, maximum)
	}
	if !allowSpaces && strings.ContainsAny(value, " \t") {
		return errors.New(label + "不能包含空格")
	}
	return nil
}

func numberValue(value any) int64 {
	switch typed := value.(type) {
	case float64:
		return int64(typed)
	case int:
		return int64(typed)
	case int64:
		return typed
	case json.Number:
		parsed, _ := typed.Int64()
		return parsed
	default:
		return 0
	}
}

func integerNumberValue(value any) (int64, bool) {
	switch typed := value.(type) {
	case float64:
		if math.IsNaN(typed) || math.IsInf(typed, 0) || math.Trunc(typed) != typed || typed < math.MinInt64 || typed > math.MaxInt64 {
			return 0, false
		}
		return int64(typed), true
	case int:
		return int64(typed), true
	case int64:
		return typed, true
	case json.Number:
		parsed, err := typed.Int64()
		return parsed, err == nil
	default:
		return 0, false
	}
}
