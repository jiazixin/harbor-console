package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

type demoState struct {
	mu                 sync.Mutex
	projects           []map[string]any
	repositories       map[string][]map[string]any
	artifacts          map[string][]map[string]any
	members            map[string][]map[string]any
	projectScanners    map[string]string
	retentions         []map[string]any
	retentionMetadata  map[string]any
	retentionRuns      map[int64][]map[string]any
	retentionTasks     map[int64][]map[string]any
	retentionLogs      map[string]string
	policies           []map[string]any
	executions         []map[string]any
	replicationTasks   map[int64][]map[string]any
	replicationLogs    map[string]string
	registries         []map[string]any
	robots             []map[string]any
	labels             []map[string]any
	immutableRules     map[string][]map[string]any
	webhooks           map[string][]map[string]any
	webhookExecutions  map[int64][]map[string]any
	webhookTasks       map[int64][]map[string]any
	webhookLogs        map[string]string
	preheatProviders   []map[string]any
	preheatInstances   []map[string]any
	preheatPolicies    map[string][]map[string]any
	preheatExecutions  map[string][]map[string]any
	preheatTasks       map[int64][]map[string]any
	preheatLogs        map[string]string
	users              []map[string]any
	userGroups         []map[string]any
	ldapUsers          []map[string]any
	ldapGroups         []map[string]any
	quotas             []map[string]any
	scanners           []map[string]any
	gcHistory          []map[string]any
	gcSchedule         map[string]any
	purgeHistory       []map[string]any
	purgeSchedule      map[string]any
	purgeLogs          map[int64]string
	jobPools           []map[string]any
	jobWorkers         map[string][]map[string]any
	jobQueues          []map[string]any
	jobSchedules       []map[string]any
	jobSchedulePaused  bool
	jobLogs            map[string]string
	scanSchedule       map[string]any
	scanMetrics        map[string]any
	securityVuls       []map[string]any
	systemCVEAllowlist map[string]any
	cveExports         []map[string]any
	cveExportFiles     map[int64]string
	configurations     map[string]any
	nextProjectID      int64
	nextMemberID       int64
	nextPolicyID       int64
	nextRegistryID     int64
	nextExecution      int64
	nextRobotID        int64
	nextLabelID        int64
	nextRuleID         int64
	nextWebhookID      int64
	nextPreheatID      int64
	nextPreheatPolicy  int64
	nextPreheatRun     int64
	nextPreheatTask    int64
	nextUserID         int64
	nextGroupID        int64
	nextGCID           int64
	nextPurgeID        int64
	nextScannerID      int64
	nextRetentionID    int64
	nextRetentionRunID int64
	nextCVEExportID    int64
}

func newDemoState() *demoState {
	state := &demoState{
		projects:        mapsFromAny(demoProjects()),
		repositories:    make(map[string][]map[string]any),
		artifacts:       make(map[string][]map[string]any),
		members:         make(map[string][]map[string]any),
		projectScanners: make(map[string]string),
		retentions: []map[string]any{
			{"id": 31, "algorithm": "or", "rules": []any{map[string]any{"id": 1, "priority": 1, "disabled": false, "action": "retain", "template": "latestPushedK", "params": map[string]any{"latestPushedK": 10}, "tag_selectors": []any{map[string]any{"kind": "doublestar", "decoration": "excludes", "pattern": "scratch-*", "extras": map[string]any{"untagged": true, "future_extra": "preserve-me"}}}, "scope_selectors": map[string]any{"repository": []any{map[string]any{"kind": "doublestar", "decoration": "repoExcludes", "pattern": "sandbox/**"}}}, "future_field": "preserve-me"}}, "trigger": map[string]any{"kind": "Schedule", "settings": map[string]any{"cron": "0 0 2 * * *"}}, "scope": map[string]any{"level": "project", "ref": 1}, "creation_time": "2026-03-18T08:00:00Z", "update_time": "2026-07-20T02:00:00Z"},
		},
		retentionMetadata: map[string]any{
			"templates": []any{
				map[string]any{"rule_template": "latestPushedK", "display_text": "保留最近推送的制品", "action": "retain", "params": []any{map[string]any{"type": "int", "unit": "count", "required": true}}},
				map[string]any{"rule_template": "latestPulledN", "display_text": "保留最近拉取的制品", "action": "retain", "params": []any{map[string]any{"type": "int", "unit": "count", "required": true}}},
				map[string]any{"rule_template": "nDaysSinceLastPush", "display_text": "保留最近推送天数内的制品", "action": "retain", "params": []any{map[string]any{"type": "int", "unit": "day", "required": true}}},
				map[string]any{"rule_template": "nDaysSinceLastPull", "display_text": "保留最近拉取天数内的制品", "action": "retain", "params": []any{map[string]any{"type": "int", "unit": "day", "required": true}}},
				map[string]any{"rule_template": "always", "display_text": "永久保留全部匹配制品", "action": "retain", "params": []any{}},
			},
			"scope_selectors": []any{map[string]any{"kind": "doublestar", "decorations": []any{"repoMatches", "repoExcludes"}}},
			"tag_selectors":   []any{map[string]any{"kind": "doublestar", "decorations": []any{"matches", "excludes"}}},
		},
		retentionRuns: map[int64][]map[string]any{
			31: {{"id": 71, "policy_id": 31, "status": "Succeed", "trigger": "Manual", "dry_run": true, "start_time": "2026-07-27T02:00:00Z", "end_time": "2026-07-27T02:00:18Z"}},
		},
		retentionTasks: map[int64][]map[string]any{
			71: {
				{"id": 171, "execution_id": 71, "repository": "platform/gateway", "job_id": "retention-job-171", "status": "Succeed", "status_code": 200, "status_revision": 1, "start_time": "2026-07-27T02:00:01Z", "end_time": "2026-07-27T02:00:09Z", "total": 28, "retained": 10},
				{"id": 172, "execution_id": 71, "repository": "platform/worker", "job_id": "retention-job-172", "status": "Succeed", "status_code": 200, "status_revision": 1, "start_time": "2026-07-27T02:00:09Z", "end_time": "2026-07-27T02:00:18Z", "total": 16, "retained": 10},
			},
		},
		retentionLogs: map[string]string{
			"71:171": "2026-07-27T02:00:01Z [INFO] repository platform/gateway matched 28 tags\n2026-07-27T02:00:04Z [INFO] retained 10 tags by latestPushedK\n2026-07-27T02:00:09Z [INFO] dry run completed; 18 tags would be deleted\n",
			"71:172": "2026-07-27T02:00:09Z [INFO] repository platform/worker matched 16 tags\n2026-07-27T02:00:18Z [INFO] dry run completed; 6 tags would be deleted\n",
		},
		policies:   mapsFromAny(mustDemoResource("replication-policies")),
		executions: mapsFromAny(demoReplications()),
		replicationTasks: map[int64][]map[string]any{
			904: {
				{"id": 1904, "execution_id": 904, "status": "Succeed", "job_id": "demo-job-1904", "operation": "copy", "resource_type": "image", "src_resource": "platform/gateway:v3.18.4", "dst_resource": "registry.prod.internal/platform/gateway:v3.18.4", "start_time": "2026-07-28T06:00:01Z", "end_time": "2026-07-28T06:00:19Z"},
				{"id": 1905, "execution_id": 904, "status": "Succeed", "job_id": "demo-job-1905", "operation": "copy", "resource_type": "image", "src_resource": "commerce/checkout:v8.2.1", "dst_resource": "registry.prod.internal/commerce/checkout:v8.2.1", "start_time": "2026-07-28T06:00:20Z", "end_time": "2026-07-28T06:00:41Z"},
			},
			903: {
				{"id": 1903, "execution_id": 903, "status": "Succeed", "job_id": "demo-job-1903", "operation": "copy", "resource_type": "image", "src_resource": "docker.io/library/nginx:1.29", "dst_resource": "edge/nginx:1.29", "start_time": "2026-07-28T05:09:22Z", "end_time": "2026-07-28T05:09:31Z"},
				{"id": 1906, "execution_id": 903, "status": "InProgress", "job_id": "demo-job-1906", "operation": "copy", "resource_type": "image", "src_resource": "docker.io/library/redis:8", "dst_resource": "edge/redis:8", "start_time": "2026-07-28T05:09:32Z", "end_time": ""},
			},
			901: {
				{"id": 1901, "execution_id": 901, "status": "Failed", "job_id": "demo-job-1901", "operation": "copy", "resource_type": "image", "src_resource": "edge/agent:v2.7.0", "dst_resource": "registry.prod.internal/edge/agent:v2.7.0", "start_time": "2026-07-27T22:15:19Z", "end_time": "2026-07-27T22:16:03Z"},
			},
		},
		replicationLogs: map[string]string{
			"904:1904": "2026-07-28T06:00:01Z [INFO] 开始复制 platform/gateway:v3.18.4\n2026-07-28T06:00:08Z [INFO] 清单与 12 个 Blob 已传输\n2026-07-28T06:00:19Z [INFO] 复制任务成功完成\n",
			"904:1905": "2026-07-28T06:00:20Z [INFO] 开始复制 commerce/checkout:v8.2.1\n2026-07-28T06:00:41Z [INFO] 复制任务成功完成\n",
			"903:1903": "2026-07-28T05:09:22Z [INFO] 开始复制 docker.io/library/nginx:1.29\n2026-07-28T05:09:31Z [INFO] 复制任务成功完成\n",
			"903:1906": "2026-07-28T05:09:32Z [INFO] 开始复制 docker.io/library/redis:8\n2026-07-28T05:09:36Z [INFO] 正在传输镜像层 4/9\n",
			"901:1901": "2026-07-27T22:15:19Z [INFO] 开始复制 edge/agent:v2.7.0\n2026-07-27T22:16:03Z [ERROR] 目标仓库返回 401 Unauthorized\n",
		},
		registries:     mapsFromAny(demoRegistries()),
		robots:         []map[string]any{},
		labels:         []map[string]any{},
		immutableRules: make(map[string][]map[string]any),
		webhooks:       make(map[string][]map[string]any),
		webhookExecutions: map[int64][]map[string]any{
			41: {
				{"id": 91, "vendor_type": "WEBHOOK", "vendor_id": 41, "status": "Success", "status_message": "", "metrics": map[string]any{"task_count": 2, "success_task_count": 2, "error_task_count": 0, "pending_task_count": 0, "running_task_count": 0, "scheduled_task_count": 0, "stopped_task_count": 0}, "trigger": "Event_based", "extra_attrs": map[string]any{"event_type": "PUSH_ARTIFACT"}, "start_time": "2026-07-28T06:42:05Z", "end_time": "2026-07-28T06:42:06Z"},
				{"id": 90, "vendor_type": "WEBHOOK", "vendor_id": 41, "status": "Error", "status_message": "target returned HTTP 503", "metrics": map[string]any{"task_count": 1, "success_task_count": 0, "error_task_count": 1, "pending_task_count": 0, "running_task_count": 0, "scheduled_task_count": 0, "stopped_task_count": 0}, "trigger": "Event_based", "extra_attrs": map[string]any{"event_type": "SCANNING_COMPLETED"}, "start_time": "2026-07-27T05:58:56Z", "end_time": "2026-07-27T05:58:58Z"},
			},
		},
		webhookTasks: map[int64][]map[string]any{
			91: {
				{"id": 191, "execution_id": 91, "status": "Success", "status_message": "", "run_count": 1, "extra_attrs": map[string]any{"event_type": "PUSH_ARTIFACT", "resource": "platform/gateway:v3.18.4", "destination": "https://hooks.demo.local/harbor"}, "creation_time": "2026-07-28T06:42:05Z", "update_time": "2026-07-28T06:42:06Z", "start_time": "2026-07-28T06:42:05Z", "end_time": "2026-07-28T06:42:06Z"},
				{"id": 192, "execution_id": 91, "status": "Success", "status_message": "", "run_count": 1, "extra_attrs": map[string]any{"event_type": "PUSH_ARTIFACT", "resource": "platform/gateway:v3.18.4", "destination": "https://audit.demo.local/events"}, "creation_time": "2026-07-28T06:42:05Z", "update_time": "2026-07-28T06:42:06Z", "start_time": "2026-07-28T06:42:05Z", "end_time": "2026-07-28T06:42:06Z"},
			},
			90: {{"id": 190, "execution_id": 90, "status": "Error", "status_message": "target returned HTTP 503", "run_count": 3, "extra_attrs": map[string]any{"event_type": "SCANNING_COMPLETED", "resource": "platform/runtime-base:v4.5", "destination": "https://hooks.demo.local/harbor"}, "creation_time": "2026-07-27T05:58:56Z", "update_time": "2026-07-27T05:58:58Z", "start_time": "2026-07-27T05:58:56Z", "end_time": "2026-07-27T05:58:58Z"}},
		},
		webhookLogs: map[string]string{
			"91:191": "2026-07-28T06:42:05Z [INFO] dispatching PUSH_ARTIFACT to https://hooks.demo.local/harbor\n2026-07-28T06:42:06Z [INFO] webhook delivered with HTTP 200\n",
			"91:192": "2026-07-28T06:42:05Z [INFO] dispatching PUSH_ARTIFACT to https://audit.demo.local/events\n2026-07-28T06:42:06Z [INFO] webhook delivered with HTTP 202\n",
			"90:190": "2026-07-27T05:58:56Z [INFO] dispatching SCANNING_COMPLETED\n2026-07-27T05:58:58Z [ERROR] webhook target returned HTTP 503 after 3 attempts\n",
		},
		preheatProviders: []map[string]any{
			{"id": "dragonfly", "name": "Dragonfly", "version": "v2", "maintainers": []any{"CNCF Dragonfly"}, "source": "https://github.com/dragonflyoss/Dragonfly2"},
			{"id": "kraken", "name": "Kraken", "version": "v1", "maintainers": []any{"Uber"}, "source": "https://github.com/uber/kraken"},
		},
		preheatInstances: []map[string]any{
			{"id": 61, "name": "dragonfly-shanghai", "description": "上海生产集群预热服务", "vendor": "dragonfly", "endpoint": "https://dragonfly.demo.local", "auth_mode": "BASIC", "auth_info": map[string]any{}, "status": "Healthy", "enabled": true, "default": true, "insecure": false, "setup_timestamp": time.Now().Add(-90 * 24 * time.Hour).Unix()},
		},
		preheatPolicies: map[string][]map[string]any{
			"platform": {{"id": 81, "name": "release-images", "description": "预热平台发布镜像", "project_id": 1, "provider_id": 61, "filters": `[{"type":"repository","value":"**"},{"type":"tag","value":"release-*"}]`, "trigger": `{"type":"scheduled","trigger_setting":{"cron":"0 0 2 * * *"}}`, "enabled": true, "extra_attrs": `{"scope":"all_seed_peers","cluster_ids":[1,2]}`, "creation_time": "2026-05-11T08:00:00Z", "update_time": "2026-07-28T02:00:00Z"}},
		},
		preheatExecutions: map[string][]map[string]any{
			"platform/release-images": {{"id": 8101, "vendor_type": "PREHEAT", "vendor_id": 81, "status": "Success", "status_message": "", "metrics": map[string]any{"task_count": 2, "success_task_count": 2, "error_task_count": 0, "pending_task_count": 0, "running_task_count": 0, "scheduled_task_count": 0, "stopped_task_count": 0}, "trigger": "Manual", "extra_attrs": map[string]any{}, "start_time": "2026-07-28T02:00:00Z", "end_time": "2026-07-28T02:00:21Z"}},
		},
		preheatTasks: map[int64][]map[string]any{
			8101: {{"id": 8201, "execution_id": 8101, "status": "Success", "status_message": "", "run_count": 1, "extra_attrs": map[string]any{"artifact": "platform/gateway:v3.18.4", "digest": "sha256:41bf0e3b54f9a760a6c1f0b170507173bf6d95f2e8db4dd79f858f31f36c28a4", "kind": "IMAGE"}, "creation_time": "2026-07-28T02:00:00Z", "update_time": "2026-07-28T02:00:12Z", "start_time": "2026-07-28T02:00:01Z", "end_time": "2026-07-28T02:00:12Z"}, {"id": 8202, "execution_id": 8101, "status": "Success", "status_message": "", "run_count": 1, "extra_attrs": map[string]any{"artifact": "platform/worker:v2.8.0", "digest": "sha256:9fbc61f1d0ee55d7d0485ca645fd73ec56ae6eea483a8514cf6b611fc4b66f9e", "kind": "IMAGE"}, "creation_time": "2026-07-28T02:00:00Z", "update_time": "2026-07-28T02:00:21Z", "start_time": "2026-07-28T02:00:01Z", "end_time": "2026-07-28T02:00:21Z"}},
		},
		preheatLogs: map[string]string{
			"8101:8201": "2026-07-28T02:00:01Z [INFO] 开始预热 platform/gateway:v3.18.4\n2026-07-28T02:00:12Z [INFO] Dragonfly 预热完成\n",
			"8101:8202": "2026-07-28T02:00:01Z [INFO] 开始预热 platform/worker:v2.8.0\n2026-07-28T02:00:21Z [INFO] Dragonfly 预热完成\n",
		},
		users: []map[string]any{
			{"user_id": 1, "username": "demo-admin", "email": "admin@example.com", "realname": "平台管理员", "comment": "Harbor 系统管理员", "sysadmin_flag": true, "creation_time": "2026-01-12T08:00:00Z"},
			{"user_id": 2, "username": "release-engineer", "email": "release@example.com", "realname": "发布工程师", "comment": "负责版本发布", "sysadmin_flag": false, "creation_time": "2026-02-04T09:20:00Z"},
			{"user_id": 3, "username": "security-reviewer", "email": "security@example.com", "realname": "安全审核员", "comment": "负责漏洞审核", "sysadmin_flag": false, "creation_time": "2026-02-18T03:10:00Z"},
		},
		userGroups: []map[string]any{
			{"id": 11, "group_name": "platform-ops", "group_type": 3, "ldap_group_dn": ""},
			{"id": 12, "group_name": "cn=release,ou=groups,dc=example,dc=com", "group_type": 1, "ldap_group_dn": "cn=release,ou=groups,dc=example,dc=com"},
		},
		ldapUsers: []map[string]any{
			{"username": "build-engineer", "realname": "构建工程师", "email": "build@demo.local"},
			{"username": "quality-reviewer", "realname": "质量审核员", "email": "qa@demo.local"},
			{"username": "release-operator", "realname": "发布操作员", "email": "release-operator@demo.local"},
		},
		ldapGroups: []map[string]any{
			{"group_name": "platform-ops", "group_type": 1, "ldap_group_dn": "cn=platform-ops,ou=groups,dc=demo,dc=local"},
			{"group_name": "release-managers", "group_type": 1, "ldap_group_dn": "cn=release-managers,ou=groups,dc=demo,dc=local"},
			{"group_name": "security-reviewers", "group_type": 1, "ldap_group_dn": "cn=security-reviewers,ou=groups,dc=demo,dc=local"},
		},
		quotas: []map[string]any{
			{"id": 1, "ref": map[string]any{"id": 1, "name": "platform", "owner_name": "demo-admin"}, "hard": map[string]any{"storage": int64(50 * 1024 * 1024 * 1024)}, "used": map[string]any{"storage": int64(18 * 1024 * 1024 * 1024)}, "creation_time": "2026-01-12T08:00:00Z"},
			{"id": 2, "ref": map[string]any{"id": 2, "name": "commerce", "owner_name": "demo-admin"}, "hard": map[string]any{"storage": int64(100 * 1024 * 1024 * 1024)}, "used": map[string]any{"storage": int64(63 * 1024 * 1024 * 1024)}, "creation_time": "2026-01-12T08:00:00Z"},
		},
		scanners: []map[string]any{
			{"uuid": "00000000-0000-4000-8000-000000000001", "name": "Trivy", "description": "默认漏洞扫描器", "url": "http://harbor-scanner-trivy:8080", "disabled": false, "is_default": true, "auth": "", "skip_certVerify": false, "use_internal_addr": true, "health": "healthy", "adapter": "Trivy", "vendor": "Aqua Security", "version": "0.57.1", "create_time": "2026-01-12T08:00:00Z"},
		},
		gcHistory: []map[string]any{
			{"id": 301, "job_name": "GARBAGE_COLLECTION", "job_kind": "Manual", "job_status": "Success", "deleted": true, "parameters": map[string]any{"delete_untagged": true, "delete_tag": false, "workers": 1, "dry_run": false}, "creation_time": "2026-07-27T02:00:00Z", "update_time": "2026-07-27T02:04:18Z"},
		},
		gcSchedule: map[string]any{"id": 21, "status": "Scheduled", "schedule": map[string]any{"type": "Daily", "cron": "0 0 2 * * *", "next_scheduled_time": "2026-07-29T02:00:00Z"}, "parameters": map[string]any{"delete_untagged": true, "delete_tag": false, "workers": 1, "dry_run": false}},
		purgeHistory: []map[string]any{
			{"id": 401, "job_name": "PURGE_AUDIT", "job_kind": "Manual", "job_parameters": `{"audit_retention_hour":720,"dry_run":false,"include_event_types":"create_artifact,delete_artifact,pull_artifact"}`, "job_status": "Success", "deleted": true, "creation_time": "2026-07-26T01:00:00Z", "update_time": "2026-07-26T01:00:08Z"},
		},
		purgeSchedule: map[string]any{"id": 23, "status": "Scheduled", "schedule": map[string]any{"type": "Weekly", "cron": "0 0 1 * * 0", "next_scheduled_time": "2026-08-02T01:00:00Z"}, "parameters": map[string]any{"audit_retention_hour": 720, "dry_run": false, "include_event_types": "create_artifact,delete_artifact,pull_artifact"}},
		purgeLogs: map[int64]string{
			401: "2026-07-26T01:00:00Z [INFO] starting audit log purge\n2026-07-26T01:00:01Z [INFO] retention threshold: 720 hours\n2026-07-26T01:00:08Z [INFO] deleted 1842 audit log records\n",
		},
		jobPools: []map[string]any{
			{"pid": 27, "worker_pool_id": "job-service-pool-1", "start_at": "2026-07-20T00:00:00Z", "heartbeat_at": "2026-07-30T03:10:00Z", "concurrency": 10, "host": "harbor-jobservice-6d8b7d8c7c-q2m5k"},
		},
		jobWorkers: map[string][]map[string]any{
			"job-service-pool-1": {
				{"id": "worker-01", "pool_id": "job-service-pool-1", "job_name": "IMAGE_SCAN", "job_id": "job-scan-1001", "start_at": "2026-07-30T03:08:00Z", "check_in": "running", "checkin_at": "2026-07-30T03:10:00Z"},
				{"id": "worker-02", "pool_id": "job-service-pool-1", "job_name": "", "job_id": "", "start_at": nil, "check_in": "idle", "checkin_at": "2026-07-30T03:10:00Z"},
			},
		},
		jobQueues: []map[string]any{
			{"job_type": "IMAGE_SCAN", "count": 4, "latency": 18, "paused": false},
			{"job_type": "WEBHOOK", "count": 1, "latency": 2, "paused": false},
			{"job_type": "GARBAGE_COLLECTION", "count": 0, "latency": 0, "paused": false},
		},
		jobSchedules: []map[string]any{
			{"id": 21, "vendor_type": "GARBAGE_COLLECTION", "vendor_id": 21, "cron": "0 0 2 * * *", "update_time": "2026-07-28T02:00:00Z"},
			{"id": 22, "vendor_type": "SCAN_ALL", "vendor_id": 22, "cron": "0 0 3 * * *", "update_time": "2026-07-28T03:00:00Z"},
			{"id": 23, "vendor_type": "PURGE_AUDIT", "vendor_id": 23, "cron": "0 0 1 * * 0", "update_time": "2026-07-27T01:00:00Z"},
		},
		jobLogs: map[string]string{
			"job-scan-1001": "2026-07-30T03:08:00Z [INFO] starting image scan\n2026-07-30T03:09:12Z [INFO] vulnerability database loaded\n2026-07-30T03:10:00Z [INFO] scanning layer 8/12\n",
		},
		scanSchedule: map[string]any{"id": 22, "status": "Scheduled", "schedule": map[string]any{"type": "Daily", "cron": "0 0 3 * * *", "next_scheduled_time": "2026-07-29T03:00:00Z"}},
		scanMetrics:  map[string]any{"total": 24, "completed": 24, "metrics": map[string]any{"Success": 22, "Error": 2}},
		securityVuls: demoSecurityVulnerabilities(),
		systemCVEAllowlist: map[string]any{"id": 1, "project_id": 0, "expires_at": nil, "items": []any{
			map[string]any{"cve_id": "CVE-2025-52881"},
		}, "creation_time": "2026-01-12T08:00:00Z", "update_time": "2026-07-18T09:30:00Z"},
		cveExports: []map[string]any{
			{"id": 501, "user_id": 1, "user_name": "demo-admin", "status": "Success", "trigger": "Manual", "start_time": "2026-07-27T09:00:00Z", "end_time": "2026-07-27T09:00:07Z", "status_text": "", "file_present": true},
			{"id": 500, "user_id": 1, "user_name": "demo-admin", "status": "Error", "trigger": "Manual", "start_time": "2026-07-26T08:00:00Z", "end_time": "2026-07-26T08:00:03Z", "status_text": "扫描报告数据暂不可用", "file_present": false},
		},
		cveExportFiles: map[int64]string{501: demoCVEExportCSV()},
		configurations: map[string]any{
			"auth_mode":                           map[string]any{"value": "oidc_auth", "editable": true},
			"primary_auth_mode":                   map[string]any{"value": true, "editable": true},
			"ldap_url":                            map[string]any{"value": "ldaps://ldap.demo.local:636", "editable": true},
			"ldap_search_dn":                      map[string]any{"value": "cn=harbor,ou=services,dc=demo,dc=local", "editable": true},
			"ldap_base_dn":                        map[string]any{"value": "ou=users,dc=demo,dc=local", "editable": true},
			"ldap_filter":                         map[string]any{"value": "", "editable": true},
			"ldap_uid":                            map[string]any{"value": "uid", "editable": true},
			"ldap_scope":                          map[string]any{"value": 2, "editable": true},
			"ldap_timeout":                        map[string]any{"value": 5, "editable": true},
			"ldap_group_base_dn":                  map[string]any{"value": "ou=groups,dc=demo,dc=local", "editable": true},
			"ldap_group_search_filter":            map[string]any{"value": "", "editable": true},
			"ldap_group_attribute_name":           map[string]any{"value": "cn", "editable": true},
			"ldap_group_admin_dn":                 map[string]any{"value": "cn=harbor-admins,ou=groups,dc=demo,dc=local", "editable": true},
			"ldap_group_membership_attribute":     map[string]any{"value": "memberOf", "editable": true},
			"ldap_group_search_scope":             map[string]any{"value": 2, "editable": true},
			"ldap_group_attach_parallel":          map[string]any{"value": true, "editable": true},
			"ldap_verify_cert":                    map[string]any{"value": true, "editable": true},
			"uaa_endpoint":                        map[string]any{"value": "https://uaa.demo.local", "editable": true},
			"uaa_client_id":                       map[string]any{"value": "harbor", "editable": true},
			"uaa_verify_cert":                     map[string]any{"value": true, "editable": true},
			"http_authproxy_endpoint":             map[string]any{"value": "https://auth.demo.local/login", "editable": true},
			"http_authproxy_tokenreview_endpoint": map[string]any{"value": "https://auth.demo.local/tokenreview", "editable": true},
			"http_authproxy_admin_groups":         map[string]any{"value": "harbor-admins", "editable": true},
			"http_authproxy_admin_usernames":      map[string]any{"value": "", "editable": true},
			"http_authproxy_verify_cert":          map[string]any{"value": true, "editable": true},
			"http_authproxy_skip_search":          map[string]any{"value": false, "editable": true},
			"oidc_name":                           map[string]any{"value": "Demo SSO", "editable": true},
			"oidc_endpoint":                       map[string]any{"value": "https://sso.demo.local", "editable": true},
			"oidc_client_id":                      map[string]any{"value": "harbor", "editable": true},
			"oidc_groups_claim":                   map[string]any{"value": "groups", "editable": true},
			"oidc_admin_group":                    map[string]any{"value": "harbor-admins", "editable": true},
			"oidc_group_filter":                   map[string]any{"value": "harbor-.*", "editable": true},
			"oidc_scope":                          map[string]any{"value": "openid,profile,email,groups", "editable": true},
			"oidc_user_claim":                     map[string]any{"value": "preferred_username", "editable": true},
			"oidc_verify_cert":                    map[string]any{"value": true, "editable": true},
			"oidc_auto_onboard":                   map[string]any{"value": true, "editable": true},
			"oidc_extra_redirect_parms":           map[string]any{"value": "", "editable": true},
			"oidc_logout":                         map[string]any{"value": true, "editable": true},
			"project_creation_restriction":        map[string]any{"value": "adminonly", "editable": true},
			"read_only":                           map[string]any{"value": false, "editable": true},
			"self_registration":                   map[string]any{"value": false, "editable": true},
			"token_expiration":                    map[string]any{"value": 30, "editable": true},
			"robot_token_duration":                map[string]any{"value": 30, "editable": true},
			"robot_name_prefix":                   map[string]any{"value": "robot$", "editable": true},
			"notification_enable":                 map[string]any{"value": true, "editable": true},
			"quota_per_project_enable":            map[string]any{"value": true, "editable": true},
			"storage_per_project":                 map[string]any{"value": int64(20 * 1024 * 1024 * 1024), "editable": true},
			"session_timeout":                     map[string]any{"value": 60, "editable": true},
			"scanner_skip_update_pulltime":        map[string]any{"value": false, "editable": true},
			"audit_log_forward_endpoint":          map[string]any{"value": "", "editable": true},
			"disabled_audit_log_event_types":      map[string]any{"value": "", "editable": true},
			"skip_audit_log_database":             map[string]any{"value": false, "editable": true},
			"banner_message":                      map[string]any{"value": "", "editable": true},
		},
		nextProjectID:      20,
		nextMemberID:       100,
		nextPolicyID:       20,
		nextRegistryID:     20,
		nextExecution:      1000,
		nextRobotID:        50,
		nextLabelID:        50,
		nextRuleID:         50,
		nextWebhookID:      50,
		nextPreheatID:      61,
		nextPreheatPolicy:  81,
		nextPreheatRun:     8101,
		nextPreheatTask:    8202,
		nextUserID:         20,
		nextGroupID:        20,
		nextGCID:           301,
		nextPurgeID:        401,
		nextScannerID:      1,
		nextRetentionID:    31,
		nextRetentionRunID: 71,
		nextCVEExportID:    501,
	}
	for projectIndex, project := range state.projects {
		name := stringValue(project["name"])
		project["owner_name"] = "demo-admin"
		targetRepositoryCount := int(numberValue(project["repo_count"]))
		repositories := mapsFromAny(demoRepositories(name))
		for len(repositories) < targetRepositoryCount {
			repositoryIndex := len(repositories)
			repositories = append(repositories, map[string]any{
				"id":             numberValue(project["project_id"])*1000 + int64(repositoryIndex+1),
				"name":           fmt.Sprintf("%s/service-%02d", name, repositoryIndex-4),
				"artifact_count": 0,
				"pull_count":     (projectIndex + 2) * (repositoryIndex + 1) * 137,
				"creation_time":  "2026-04-08T08:24:00Z",
				"update_time":    "2026-07-23T06:42:00Z",
			})
		}
		state.repositories[name] = repositories
		project["repo_count"] = len(state.repositories[name])
		for repositoryIndex, repository := range state.repositories[name] {
			repository["id"] = numberValue(project["project_id"])*1000 + int64(repositoryIndex+1)
			repositoryName := stringValue(repository["name"])
			artifacts := mapsFromAny(demoArtifacts(name, repositoryName))
			artifactLimit := 1 + (projectIndex*2+repositoryIndex)%len(artifacts)
			if projectIndex == 0 && repositoryIndex == 0 {
				artifactLimit = len(artifacts)
			}
			visibleArtifacts := append([]map[string]any(nil), artifacts[:artifactLimit]...)
			state.artifacts[repositoryName] = append(visibleArtifacts, demoChildArtifacts(visibleArtifacts[0])...)
			repository["artifact_count"] = len(visibleArtifacts)
		}
		metadata, _ := project["metadata"].(map[string]any)
		if _, exists := metadata["reuse_sys_cve_allowlist"]; !exists {
			metadata["reuse_sys_cve_allowlist"] = "true"
		}
		project["cve_allowlist"] = map[string]any{"id": project["project_id"], "project_id": project["project_id"], "expires_at": nil, "items": []any{}}
		state.members[name] = []map[string]any{
			{"id": 1, "project_id": project["project_id"], "entity_name": "demo-admin", "role_name": "projectAdmin", "role_id": 1, "entity_id": 1, "entity_type": "u"},
			{"id": 2, "project_id": project["project_id"], "entity_name": "release-engineer", "role_name": "developer", "role_id": 2, "entity_id": 2, "entity_type": "u"},
			{"id": 3, "project_id": project["project_id"], "entity_name": "security-reviewer", "role_name": "guest", "role_id": 3, "entity_id": 3, "entity_type": "u"},
		}
		state.immutableRules[name] = []map[string]any{}
		state.webhooks[name] = []map[string]any{}
		state.projectScanners[name] = "00000000-0000-4000-8000-000000000001"
	}
	if index, found := findMap(state.projects, "name", "platform"); found {
		metadata, _ := state.projects[index]["metadata"].(map[string]any)
		metadata["retention_id"] = "31"
	}
	state.robots = []map[string]any{
		{"id": 41, "name": "robot$platform+ci-release", "description": "发布流水线", "level": "project", "duration": 365, "disable": false, "expires_at": time.Now().Add(180 * 24 * time.Hour).Unix(), "project_id": 1, "permissions": demoRobotPermissions("platform", true), "creation_time": "2026-03-18T08:00:00Z"},
		{"id": 42, "name": "robot$global-mirror", "description": "跨项目镜像同步", "level": "system", "duration": 365, "disable": false, "expires_at": time.Now().Add(240 * 24 * time.Hour).Unix(), "project_id": 0, "permissions": []any{map[string]any{"kind": "project", "namespace": "*", "access": []any{map[string]any{"resource": "repository", "action": "pull", "effect": "allow"}, map[string]any{"resource": "repository", "action": "read", "effect": "allow"}}}, map[string]any{"kind": "system", "namespace": "/", "access": []any{map[string]any{"resource": "replication", "action": "read", "effect": "allow"}, map[string]any{"resource": "replication", "action": "list", "effect": "allow"}}}}, "creation_time": "2026-04-12T08:00:00Z"},
	}
	state.labels = []map[string]any{
		{"id": 41, "name": "生产", "description": "生产环境制品", "color": "#168352", "scope": "p", "project_id": 1, "creation_time": "2026-03-18T08:00:00Z"},
		{"id": 42, "name": "候选", "description": "待发布验证", "color": "#3569a8", "scope": "p", "project_id": 1, "creation_time": "2026-03-18T08:00:00Z"},
		{"id": 43, "name": "已签核", "description": "已通过平台安全签核", "color": "#7a4ca0", "scope": "g", "project_id": 0, "creation_time": "2026-03-18T08:00:00Z"},
	}
	if artifacts := state.artifacts["platform/gateway"]; len(artifacts) > 0 {
		artifacts[0]["labels"] = []any{cloneMap(state.labels[0]), cloneMap(state.labels[2])}
		artifacts[0]["sbom_overview"] = map[string]any{"application/vnd.scanner.adapter.vuln.report.harbor+json; version=1.0": map[string]any{"scan_status": "Success", "report_id": "demo-sbom-1001", "duration": 8}}
		artifacts[0]["accessories"] = []any{
			map[string]any{"id": 7001, "artifact_id": 7101, "subject_artifact_id": 1001, "subject_artifact_digest": artifacts[0]["digest"], "subject_artifact_repo": "platform/gateway", "size": 28419, "digest": "sha256:713832a739f26bd20c82cebbf72f6bf97f0fc023908470350d563235063ca541", "type": "signature.cosign", "creation_time": "2026-07-28T06:43:00Z"},
			map[string]any{"id": 7002, "artifact_id": 7102, "subject_artifact_id": 1001, "subject_artifact_digest": artifacts[0]["digest"], "subject_artifact_repo": "platform/gateway", "size": 19812, "digest": "sha256:4da7d3d4f71d0518d51bd1f9c20c3c510db4e36ea6d671e244c43aa4ac41cf95", "type": "signature.notation", "creation_time": "2026-07-28T06:44:00Z"},
		}
	}
	if artifacts := state.artifacts["platform/gateway"]; len(artifacts) > 2 {
		artifacts[2]["accessories"] = []any{}
	}
	state.immutableRules["platform"] = []map[string]any{
		{"id": 41, "priority": 0, "disabled": false, "action": "immutable", "template": "immutable_template", "params": map[string]any{}, "tag_selectors": []any{map[string]any{"kind": "doublestar", "decoration": "matches", "pattern": "release-*"}}, "scope_selectors": map[string]any{"repository": []any{map[string]any{"kind": "doublestar", "decoration": "repoMatches", "pattern": "**"}}}},
	}
	state.webhooks["platform"] = []map[string]any{
		{"id": 41, "name": "deploy-events", "description": "推送发布事件", "project_id": 1, "targets": []any{map[string]any{"type": "http", "address": "https://hooks.demo.local/harbor", "auth_header": "", "skip_cert_verify": false, "payload_format": "Default"}}, "event_types": []any{"PUSH_ARTIFACT", "SCANNING_COMPLETED"}, "enabled": true, "creation_time": "2026-03-18T08:00:00Z"},
	}
	return state
}

func mustDemoResource(kind string) []any {
	value, _ := demoResource(kind, url.Values{})
	items, _ := value.([]any)
	return items
}

func mapsFromAny(items []any) []map[string]any {
	result := make([]map[string]any, 0, len(items))
	for _, item := range items {
		if mapped, ok := item.(map[string]any); ok {
			result = append(result, cloneMap(mapped))
		}
	}
	return result
}

func demoVisibleArtifacts(items []map[string]any) []map[string]any {
	visible := make([]map[string]any, 0, len(items))
	for _, item := range items {
		if child, _ := item["demo_child"].(bool); !child {
			visible = append(visible, item)
		}
	}
	return visible
}

func cloneMap(input map[string]any) map[string]any {
	result := make(map[string]any, len(input))
	for key, value := range input {
		switch typed := value.(type) {
		case map[string]any:
			result[key] = cloneMap(typed)
		case []any:
			cloned := make([]any, len(typed))
			for index, item := range typed {
				if mapped, ok := item.(map[string]any); ok {
					cloned[index] = cloneMap(mapped)
				} else {
					cloned[index] = item
				}
			}
			result[key] = cloned
		default:
			result[key] = value
		}
	}
	return result
}

func cloneMaps(input []map[string]any) []any {
	result := make([]any, 0, len(input))
	for _, item := range input {
		result = append(result, cloneMap(item))
	}
	return result
}

func (state *demoState) dashboard() map[string]any {
	state.mu.Lock()
	defer state.mu.Unlock()
	dashboard := demoDashboard()
	if systemInfo, ok := dashboard["systeminfo"].(map[string]any); ok {
		for _, key := range []string{"auth_mode", "project_creation_restriction", "self_registration", "read_only", "banner_message"} {
			if item, ok := state.configurations[key].(map[string]any); ok {
				systemInfo[key] = item["value"]
			}
		}
	}
	projects := cloneMaps(state.projects)
	for _, rawProject := range projects {
		project, ok := rawProject.(map[string]any)
		if !ok {
			continue
		}
		name := stringValue(project["name"])
		artifactCount := 0
		tagCount := 0
		storageUsed := int64(0)
		for _, repository := range state.repositories[name] {
			for _, artifactItem := range demoVisibleArtifacts(state.artifacts[stringValue(repository["name"])]) {
				artifactCount++
				tagCount += len(tagsOf(artifactItem))
				storageUsed += numberValue(artifactItem["size"])
			}
		}
		project["artifact_count"] = artifactCount
		project["tag_count"] = tagCount
		project["storage_used"] = storageUsed
	}
	dashboard["projects"] = projects
	dashboard["replications"] = cloneMaps(state.executions)
	dashboard["replication_policies"] = cloneMaps(state.policies)
	dashboard["registries"] = cloneMaps(state.registries)
	statistics := dashboard["statistics"].(map[string]any)
	statistics["total_project_count"] = len(state.projects)
	privateCount := 0
	publicCount := 0
	repositoryCount := 0
	for _, project := range state.projects {
		metadata, _ := project["metadata"].(map[string]any)
		if stringValue(metadata["public"]) == "true" {
			publicCount++
		} else {
			privateCount++
		}
		repositoryCount += len(state.repositories[stringValue(project["name"])])
	}
	statistics["public_project_count"] = publicCount
	statistics["private_project_count"] = privateCount
	statistics["total_repo_count"] = repositoryCount
	return dashboard
}

func (state *demoState) handleControl(w http.ResponseWriter, method, operation string, query url.Values, body map[string]any, list bool) {
	state.mu.Lock()
	defer state.mu.Unlock()

	var data any
	status := http.StatusOK
	var errStatus int
	var errMessage string

	switch operation {
	case "internal-config":
		data = map[string]any{"auth_mode": "oidc_auth", "external_url": "https://harbor.demo.local", "read_only": false}

	case "ping":
		data = map[string]any{"status": "healthy"}

	case "projects":
		if method == http.MethodHead {
			w.WriteHeader(http.StatusOK)
			return
		}
		if method == http.MethodGet {
			items := filterMaps(state.projects, query.Get("name"), "name")
			items = filterMaps(items, query.Get("owner"), "owner_name")
			if query.Has("public") {
				wantPublic := query.Get("public") == "true"
				filtered := make([]map[string]any, 0, len(items))
				for _, item := range items {
					metadata, _ := item["metadata"].(map[string]any)
					if (stringValue(metadata["public"]) == "true") == wantPublic {
						filtered = append(filtered, item)
					}
				}
				items = filtered
			}
			state.writeList(w, items, query)
			return
		}
		name := strings.TrimSpace(stringValue(body["project_name"]))
		if _, found := findMap(state.projects, "name", name); found {
			errStatus, errMessage = http.StatusConflict, "同名项目已经存在"
			break
		}
		state.nextProjectID++
		now := time.Now().UTC().Format(time.RFC3339)
		metadata := map[string]any{"public": "false", "auto_scan": "false", "prevent_vul": "false", "severity": "critical", "auto_sbom_generation": "false", "reuse_sys_cve_allowlist": "true"}
		if provided, ok := body["metadata"].(map[string]any); ok {
			for key, value := range provided {
				metadata[key] = value
			}
		}
		project := map[string]any{"project_id": state.nextProjectID, "name": name, "repo_count": 0, "owner_name": "demo-admin", "creation_time": now, "update_time": now, "metadata": metadata, "cve_allowlist": map[string]any{"project_id": state.nextProjectID, "expires_at": nil, "items": []any{}}}
		storageLimit := int64(-1)
		if configured, ok := state.configurations["storage_per_project"].(map[string]any); ok {
			storageLimit = numberValue(configured["value"])
		}
		if requested, ok := body["storage_limit"]; ok {
			storageLimit = numberValue(requested)
		}
		project["storage_limit"] = storageLimit
		if registryID, ok := body["registry_id"]; ok && registryID != nil && numberValue(registryID) > 0 {
			project["registry_id"] = numberValue(registryID)
		}
		state.projects = append([]map[string]any{project}, state.projects...)
		state.quotas = append(state.quotas, map[string]any{
			"id": state.nextProjectID, "ref": map[string]any{"id": state.nextProjectID, "name": name, "owner_name": "demo-admin"},
			"hard": map[string]any{"storage": storageLimit}, "used": map[string]any{"storage": int64(0)}, "creation_time": now,
		})
		state.repositories[name] = []map[string]any{}
		state.members[name] = []map[string]any{{"id": 1, "project_id": state.nextProjectID, "entity_name": "demo-admin", "role_name": "projectAdmin", "role_id": 1, "entity_id": 1, "entity_type": "u"}}
		state.projectScanners[name] = "00000000-0000-4000-8000-000000000001"
		status, data = http.StatusCreated, project

	case "project":
		projectName := query.Get("project")
		index, found := findMap(state.projects, "name", projectName)
		if !found {
			errStatus, errMessage = http.StatusNotFound, "项目不存在"
			break
		}
		if method == http.MethodGet {
			data = state.projects[index]
		} else if method == http.MethodPut {
			if metadata, ok := body["metadata"].(map[string]any); ok {
				current, _ := state.projects[index]["metadata"].(map[string]any)
				for key, value := range metadata {
					current[key] = value
				}
			}
			if limit, ok := body["storage_limit"]; ok {
				state.projects[index]["storage_limit"] = limit
				for quotaIndex := range state.quotas {
					ref, _ := state.quotas[quotaIndex]["ref"].(map[string]any)
					if numberValue(ref["id"]) == numberValue(state.projects[index]["project_id"]) {
						state.quotas[quotaIndex]["hard"] = map[string]any{"storage": limit}
						state.quotas[quotaIndex]["update_time"] = time.Now().UTC().Format(time.RFC3339)
					}
				}
			}
			if registryID, ok := body["registry_id"]; ok {
				if registryID == nil || numberValue(registryID) == 0 {
					delete(state.projects[index], "registry_id")
				} else {
					state.projects[index]["registry_id"] = numberValue(registryID)
				}
			}
			if allowlist, ok := body["cve_allowlist"].(map[string]any); ok {
				state.projects[index]["cve_allowlist"] = cloneMap(allowlist)
			}
			state.projects[index]["update_time"] = time.Now().UTC().Format(time.RFC3339)
			data = state.projects[index]
		} else {
			if len(state.repositories[projectName]) > 0 {
				errStatus, errMessage = http.StatusPreconditionFailed, "项目仍包含仓库，请先删除仓库"
				break
			}
			projectID := numberValue(state.projects[index]["project_id"])
			state.projects = append(state.projects[:index], state.projects[index+1:]...)
			filteredQuotas := state.quotas[:0]
			for _, quota := range state.quotas {
				ref, _ := quota["ref"].(map[string]any)
				if numberValue(ref["id"]) != projectID {
					filteredQuotas = append(filteredQuotas, quota)
				}
			}
			state.quotas = filteredQuotas
			delete(state.repositories, projectName)
			delete(state.members, projectName)
			delete(state.projectScanners, projectName)
		}

	case "project-summary":
		projectName := query.Get("project")
		if _, found := findMap(state.projects, "name", projectName); !found {
			errStatus, errMessage = http.StatusNotFound, "项目不存在"
			break
		}
		repositories := state.repositories[projectName]
		artifactCount := 0
		for _, repository := range repositories {
			artifactCount += len(demoVisibleArtifacts(state.artifacts[stringValue(repository["name"])]))
		}
		roleCounts := map[int]int{}
		for _, member := range state.members[projectName] {
			roleCounts[int(numberValue(member["role_id"]))]++
		}
		data = map[string]any{"repo_count": len(repositories), "artifact_count": artifactCount, "project_admin_count": roleCounts[1], "maintainer_count": roleCounts[4], "developer_count": roleCounts[2], "guest_count": roleCounts[3]}

	case "project-deletable":
		projectName := query.Get("project")
		if _, found := findMap(state.projects, "name", projectName); !found {
			errStatus, errMessage = http.StatusNotFound, "项目不存在"
			break
		}
		if len(state.repositories[projectName]) > 0 {
			data = map[string]any{"deletable": false, "message": "项目仍包含仓库，请先删除仓库"}
		} else {
			data = map[string]any{"deletable": true}
		}

	case "project-scanner":
		projectName := query.Get("project")
		if _, found := findMap(state.projects, "name", projectName); !found {
			errStatus, errMessage = http.StatusNotFound, "项目不存在"
			break
		}
		if method == http.MethodPut {
			uuid := stringValue(body["uuid"])
			index, found := findMap(state.scanners, "uuid", uuid)
			if !found || state.scanners[index]["disabled"] == true {
				errStatus, errMessage = http.StatusNotFound, "扫描器不存在或已停用"
				break
			}
			state.projectScanners[projectName] = uuid
		}
		uuid := state.projectScanners[projectName]
		index, found := findMap(state.scanners, "uuid", uuid)
		if !found {
			errStatus, errMessage = http.StatusNotFound, "项目扫描器不存在"
			break
		}
		data = state.scanners[index]

	case "project-scanner-candidates":
		projectName := query.Get("project")
		if _, found := findMap(state.projects, "name", projectName); !found {
			errStatus, errMessage = http.StatusNotFound, "项目不存在"
			break
		}
		items := make([]map[string]any, 0, len(state.scanners))
		for _, scanner := range filterMaps(state.scanners, demoQueryString(query.Get("q"), "name"), "name") {
			if scanner["disabled"] != true {
				items = append(items, scanner)
			}
		}
		state.writeList(w, items, query)
		return

	case "project-members":
		projectName := query.Get("project")
		if _, found := state.members[projectName]; !found {
			errStatus, errMessage = http.StatusNotFound, "项目不存在"
			break
		}
		if method == http.MethodGet {
			items := filterMaps(state.members[projectName], query.Get("entityname"), "entity_name")
			state.writeList(w, items, query)
			return
		}
		role := int(numberValue(body["role_id"]))
		user, hasUser := body["member_user"].(map[string]any)
		group, hasGroup := body["member_group"].(map[string]any)
		name := stringValue(user["username"])
		entityType := "u"
		if !hasUser && hasGroup {
			name = stringValue(group["group_name"])
			if name == "" {
				name = stringValue(group["ldap_group_dn"])
			}
			entityType = "g"
		}
		for _, member := range state.members[projectName] {
			if strings.EqualFold(stringValue(member["entity_name"]), name) {
				errStatus, errMessage = http.StatusConflict, "该成员已经在项目中"
				break
			}
		}
		if errStatus != 0 {
			break
		}
		state.nextMemberID++
		member := map[string]any{"id": state.nextMemberID, "project_id": projectID(state.projects, projectName), "entity_name": name, "role_name": demoRoleName(role), "role_id": role, "entity_id": state.nextMemberID, "entity_type": entityType}
		state.members[projectName] = append(state.members[projectName], member)
		status, data = http.StatusCreated, member

	case "project-member":
		projectName := query.Get("project")
		memberID := query.Get("member")
		index, found := findMapNumber(state.members[projectName], "id", memberID)
		if !found {
			errStatus, errMessage = http.StatusNotFound, "项目成员不存在"
			break
		}
		if method == http.MethodPut {
			role := int(numberValue(body["role_id"]))
			state.members[projectName][index]["role_id"] = role
			state.members[projectName][index]["role_name"] = demoRoleName(role)
			data = state.members[projectName][index]
		} else {
			state.members[projectName] = append(state.members[projectName][:index], state.members[projectName][index+1:]...)
		}

	case "project-member-detail":
		projectName := query.Get("project")
		index, found := findMapNumber(state.members[projectName], "id", query.Get("member"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "项目成员不存在"
			break
		}
		data = state.members[projectName][index]

	case "project-artifacts":
		projectName := query.Get("project")
		items := make([]map[string]any, 0)
		for repositoryName, artifacts := range state.artifacts {
			if strings.HasPrefix(repositoryName, projectName+"/") {
				items = append(items, demoVisibleArtifacts(artifacts)...)
			}
		}
		state.writeList(w, items, query)
		return

	case "project-metadatas":
		projectName := query.Get("project")
		index, found := findMap(state.projects, "name", projectName)
		if !found {
			errStatus, errMessage = http.StatusNotFound, "项目不存在"
			break
		}
		metadata, _ := state.projects[index]["metadata"].(map[string]any)
		if method == http.MethodGet {
			data = metadata
			break
		}
		key := strings.TrimSpace(stringValue(body["key"]))
		value := stringValue(body["value"])
		if key == "" {
			errStatus, errMessage = http.StatusBadRequest, "metadata key 不能为空"
			break
		}
		metadata[key] = value
		data = metadata

	case "project-metadata":
		projectName := query.Get("project")
		index, found := findMap(state.projects, "name", projectName)
		if !found {
			errStatus, errMessage = http.StatusNotFound, "项目不存在"
			break
		}
		metadata, _ := state.projects[index]["metadata"].(map[string]any)
		key := query.Get("meta")
		if method == http.MethodGet {
			value, exists := metadata[key]
			if !exists {
				errStatus, errMessage = http.StatusNotFound, "metadata 不存在"
				break
			}
			data = map[string]any{"value": value}
		} else if method == http.MethodPut {
			metadata[key] = body["value"]
			data = map[string]any{"value": metadata[key]}
		} else {
			delete(metadata, key)
		}

	case "all-repositories":
		items := make([]map[string]any, 0)
		for _, repositories := range state.repositories {
			items = append(items, repositories...)
		}
		state.writeList(w, items, query)
		return

	case "repositories":
		projectName := query.Get("project")
		items, found := state.repositories[projectName]
		if !found {
			errStatus, errMessage = http.StatusNotFound, "项目不存在"
			break
		}
		items = filterMaps(items, query.Get("q"), "name")
		state.writeList(w, items, query)
		return

	case "repository":
		projectName := query.Get("project")
		repositoryName := query.Get("repository")
		index, found := findMap(state.repositories[projectName], "name", repositoryName)
		if !found {
			errStatus, errMessage = http.StatusNotFound, "仓库不存在"
			break
		}
		if method == http.MethodGet {
			data = state.repositories[projectName][index]
		} else if method == http.MethodPut {
			if description, ok := body["description"].(string); ok {
				state.repositories[projectName][index]["description"] = description
			}
			state.repositories[projectName][index]["update_time"] = time.Now().UTC().Format(time.RFC3339)
			data = state.repositories[projectName][index]
		} else {
			state.repositories[projectName] = append(state.repositories[projectName][:index], state.repositories[projectName][index+1:]...)
			delete(state.artifacts, repositoryName)
			updateDemoRepoCount(state.projects, projectName, len(state.repositories[projectName]))
		}

	case "artifact-copy":
		targetRepository := query.Get("repository")
		if !strings.HasPrefix(targetRepository, query.Get("project")+"/") {
			targetRepository = query.Get("project") + "/" + targetRepository
		}
		if _, found := state.artifacts[targetRepository]; !found {
			errStatus, errMessage = http.StatusNotFound, "目标仓库不存在"
			break
		}
		sourceRepository, sourceReference, found := splitDemoArtifactSource(query.Get("from"))
		if !found {
			errStatus, errMessage = http.StatusBadRequest, "复制源格式无效"
			break
		}
		sourceIndex, found := findArtifact(state.artifacts[sourceRepository], sourceReference)
		if !found {
			errStatus, errMessage = http.StatusNotFound, "复制源制品不存在"
			break
		}
		source := state.artifacts[sourceRepository][sourceIndex]
		if _, exists := findArtifact(state.artifacts[targetRepository], stringValue(source["digest"])); exists {
			errStatus, errMessage = http.StatusConflict, "目标仓库中已经存在该制品"
			break
		}
		copied := cloneMap(source)
		copied["id"] = time.Now().UnixNano()
		copied["push_time"] = time.Now().UTC().Format(time.RFC3339)
		copied["pull_time"] = nil
		copied["labels"] = []any{}
		copied["accessories"] = []any{}
		delete(copied, "demo_child")
		if strings.Contains(query.Get("from"), ":") && !strings.Contains(query.Get("from"), "@") {
			copied["tags"] = []any{map[string]any{"id": 1, "name": sourceReference, "push_time": copied["push_time"], "immutable": false}}
		} else {
			copied["tags"] = []any{}
		}
		state.artifacts[targetRepository] = append([]map[string]any{copied}, state.artifacts[targetRepository]...)
		updateDemoArtifactCount(state.repositories, query.Get("project"), targetRepository, len(demoVisibleArtifacts(state.artifacts[targetRepository])))
		status = http.StatusCreated

	case "artifacts":
		repositoryName := query.Get("repository")
		items, found := state.artifacts[repositoryName]
		if !found {
			errStatus, errMessage = http.StatusNotFound, "仓库不存在"
			break
		}
		state.writeList(w, demoVisibleArtifacts(items), query)
		return

	case "artifact":
		repositoryName := query.Get("repository")
		index, found := findArtifact(state.artifacts[repositoryName], query.Get("reference"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "制品不存在"
			break
		}
		if method == http.MethodGet {
			data = state.artifacts[repositoryName][index]
		} else {
			state.artifacts[repositoryName] = append(state.artifacts[repositoryName][:index], state.artifacts[repositoryName][index+1:]...)
			updateDemoArtifactCount(state.repositories, query.Get("project"), repositoryName, len(demoVisibleArtifacts(state.artifacts[repositoryName])))
		}

	case "artifact-tags":
		repositoryName := query.Get("repository")
		index, found := findArtifact(state.artifacts[repositoryName], query.Get("reference"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "制品不存在"
			break
		}
		if method == http.MethodGet {
			state.writeListAny(w, mapsToAny(tagsOf(state.artifacts[repositoryName][index])), query)
			return
		}
		tagName := stringValue(body["name"])
		tags := tagsOf(state.artifacts[repositoryName][index])
		for _, tag := range tags {
			if stringValue(tag["name"]) == tagName {
				errStatus, errMessage = http.StatusConflict, "Tag 已存在"
				break
			}
		}
		if errStatus != 0 {
			break
		}
		tag := map[string]any{"id": len(tags) + 1, "name": tagName, "push_time": time.Now().UTC().Format(time.RFC3339), "immutable": false}
		tags = append(tags, tag)
		state.artifacts[repositoryName][index]["tags"] = mapsToAny(tags)
		status, data = http.StatusCreated, tag

	case "artifact-tag":
		repositoryName := query.Get("repository")
		index, found := findArtifact(state.artifacts[repositoryName], query.Get("reference"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "制品不存在"
			break
		}
		tags := tagsOf(state.artifacts[repositoryName][index])
		tagIndex, found := findMap(tags, "name", query.Get("tag"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "Tag 不存在"
			break
		}
		if immutable, _ := tags[tagIndex]["immutable"].(bool); immutable {
			errStatus, errMessage = http.StatusPreconditionFailed, "不可变 Tag 不能删除"
			break
		}
		tags = append(tags[:tagIndex], tags[tagIndex+1:]...)
		state.artifacts[repositoryName][index]["tags"] = mapsToAny(tags)

	case "artifact-labels":
		repositoryName := query.Get("repository")
		artifactIndex, found := findArtifact(state.artifacts[repositoryName], query.Get("reference"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "制品不存在"
			break
		}
		labelID := numberValue(body["id"])
		labelIndex, found := findMapNumber(state.labels, "id", strconv.FormatInt(labelID, 10))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "标签不存在"
			break
		}
		labels := labelsOf(state.artifacts[repositoryName][artifactIndex])
		if _, attached := findMapNumber(labels, "id", strconv.FormatInt(labelID, 10)); attached {
			errStatus, errMessage = http.StatusConflict, "标签已经绑定到该制品"
			break
		}
		label := state.labels[labelIndex]
		projectID := numberValue(projectID(state.projects, query.Get("project")))
		if stringValue(label["scope"]) == "p" && numberValue(label["project_id"]) != projectID {
			errStatus, errMessage = http.StatusForbidden, "不能绑定其他项目的标签"
			break
		}
		labels = append(labels, cloneMap(label))
		state.artifacts[repositoryName][artifactIndex]["labels"] = mapsToAny(labels)

	case "artifact-label":
		repositoryName := query.Get("repository")
		artifactIndex, found := findArtifact(state.artifacts[repositoryName], query.Get("reference"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "制品不存在"
			break
		}
		labels := labelsOf(state.artifacts[repositoryName][artifactIndex])
		labelIndex, found := findMapNumber(labels, "id", query.Get("label"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "制品未绑定该标签"
			break
		}
		labels = append(labels[:labelIndex], labels[labelIndex+1:]...)
		state.artifacts[repositoryName][artifactIndex]["labels"] = mapsToAny(labels)

	case "artifact-accessories":
		repositoryName := query.Get("repository")
		artifactIndex, found := findArtifact(state.artifacts[repositoryName], query.Get("reference"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "制品不存在"
			break
		}
		accessories, _ := state.artifacts[repositoryName][artifactIndex]["accessories"].([]any)
		state.writeListAny(w, accessories, query)
		return

	case "artifact-icon":
		if query.Get("digest") != demoArtifactIconDigest {
			errStatus, errMessage = http.StatusNotFound, "制品图标不存在"
			break
		}
		data = map[string]any{"content-type": "image/png", "content": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL07wAAAABJRU5ErkJggg=="}

	case "artifact-addition":
		repositoryName := query.Get("repository")
		if _, found := findArtifact(state.artifacts[repositoryName], query.Get("reference")); !found {
			errStatus, errMessage = http.StatusNotFound, "制品不存在"
			break
		}
		addition, found := demoArtifactAddition(query.Get("addition"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "当前制品没有该附加信息"
			break
		}
		data = addition

	case "artifact-scan":
		repositoryName := query.Get("repository")
		index, found := findArtifact(state.artifacts[repositoryName], query.Get("reference"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "制品不存在"
			break
		}
		artifactItem := state.artifacts[repositoryName][index]
		overviewKey := "scan_overview"
		if stringValue(body["scan_type"]) == "sbom" {
			overviewKey = "sbom_overview"
		}
		overview, _ := artifactItem[overviewKey].(map[string]any)
		if overview == nil {
			overview = map[string]any{"application/vnd.scanner.adapter.vuln.report.harbor+json; version=1.0": map[string]any{"report_id": "demo-sbom-generated"}}
			artifactItem[overviewKey] = overview
		}
		for _, raw := range overview {
			if report, ok := raw.(map[string]any); ok {
				report["scan_status"] = "Running"
				report["start_time"] = time.Now().UTC().Format(time.RFC3339)
			}
		}
		status = http.StatusAccepted

	case "artifact-scan-stop":
		repositoryName := query.Get("repository")
		index, found := findArtifact(state.artifacts[repositoryName], query.Get("reference"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "制品不存在"
			break
		}
		overviewKey := "scan_overview"
		if stringValue(body["scan_type"]) == "sbom" {
			overviewKey = "sbom_overview"
		}
		overview, _ := state.artifacts[repositoryName][index][overviewKey].(map[string]any)
		for _, raw := range overview {
			if report, ok := raw.(map[string]any); ok {
				report["scan_status"] = "Stopped"
				report["end_time"] = time.Now().UTC().Format(time.RFC3339)
			}
		}
		status = http.StatusAccepted

	case "artifact-scan-log":
		repositoryName := query.Get("repository")
		if _, found := findArtifact(state.artifacts[repositoryName], query.Get("reference")); !found {
			errStatus, errMessage = http.StatusNotFound, "制品不存在"
			break
		}
		data = "2026-07-28T06:40:00Z [INFO] 开始拉取漏洞数据库\n2026-07-28T06:40:03Z [INFO] 分析系统软件包\n2026-07-28T06:40:11Z [INFO] 漏洞扫描完成\n"

	case "artifact-vulnerabilities":
		repositoryName := query.Get("repository")
		_, found := findArtifact(state.artifacts[repositoryName], query.Get("reference"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "制品不存在"
			break
		}
		data = demoVulnerabilityReport()

	case "robots":
		if method == http.MethodGet {
			items := state.robots
			if level := demoQueryString(query.Get("q"), "level"); level != "" {
				filtered := make([]map[string]any, 0)
				for _, robot := range items {
					if stringValue(robot["level"]) == level {
						filtered = append(filtered, robot)
					}
				}
				items = filtered
			}
			if projectID := demoQueryNumber(query.Get("q"), "project_id"); projectID > 0 {
				filtered := make([]map[string]any, 0)
				for _, robot := range items {
					if numberValue(robot["project_id"]) == projectID {
						filtered = append(filtered, robot)
					}
				}
				items = filtered
			}
			if name := demoQueryString(query.Get("q"), "name"); name != "" {
				items = filterMaps(items, name, "name")
			}
			state.writeList(w, items, query)
			return
		}
		state.nextRobotID++
		robot := cloneMap(body)
		namespace := demoRobotNamespace(robot)
		robot["id"] = state.nextRobotID
		if stringValue(robot["level"]) == "system" {
			robot["name"] = "robot$" + stringValue(robot["name"])
		} else {
			robot["name"] = "robot$" + namespace + "+" + stringValue(robot["name"])
		}
		robot["project_id"] = numberValue(projectID(state.projects, namespace))
		robot["editable"] = true
		robot["creation_time"] = time.Now().UTC().Format(time.RFC3339)
		duration := numberValue(robot["duration"])
		if duration < 0 {
			robot["expires_at"] = -1
		} else {
			robot["expires_at"] = time.Now().Add(time.Duration(duration) * 24 * time.Hour).Unix()
		}
		state.robots = append(state.robots, robot)
		status = http.StatusCreated
		data = map[string]any{"id": state.nextRobotID, "name": robot["name"], "secret": fmt.Sprintf("demo-secret-%d-X7k2", state.nextRobotID), "creation_time": robot["creation_time"], "expires_at": robot["expires_at"]}

	case "robot":
		index, found := findMapNumber(state.robots, "id", query.Get("id"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "机器人账号不存在"
			break
		}
		if method == http.MethodGet {
			data = state.robots[index]
		} else if method == http.MethodPut {
			current := state.robots[index]
			oldDuration := numberValue(current["duration"])
			for key, value := range body {
				if key != "id" && key != "name" && key != "project_id" && key != "creation_time" && key != "expires_at" {
					current[key] = cloneDemoValue(value)
				}
			}
			newDuration := numberValue(current["duration"])
			if newDuration != oldDuration {
				if newDuration < 0 {
					current["expires_at"] = -1
				} else {
					current["expires_at"] = time.Now().Add(time.Duration(newDuration) * 24 * time.Hour).Unix()
				}
			}
			current["update_time"] = time.Now().UTC().Format(time.RFC3339)
			data = state.robots[index]
		} else if method == http.MethodPatch {
			data = map[string]any{"secret": fmt.Sprintf("demo-secret-%s-R9p4", query.Get("id"))}
		} else {
			state.robots = append(state.robots[:index], state.robots[index+1:]...)
		}

	case "labels":
		if method == http.MethodGet {
			items := state.labels
			if scope := strings.TrimSpace(query.Get("scope")); scope != "" {
				filtered := make([]map[string]any, 0)
				for _, label := range items {
					if stringValue(label["scope"]) == scope {
						filtered = append(filtered, label)
					}
				}
				items = filtered
			}
			projectID, _ := strconv.ParseInt(query.Get("project_id"), 10, 64)
			if projectID > 0 {
				filtered := make([]map[string]any, 0)
				for _, label := range items {
					if numberValue(label["project_id"]) == projectID {
						filtered = append(filtered, label)
					}
				}
				items = filtered
			}
			if name := strings.TrimSpace(query.Get("name")); name != "" {
				items = filterMaps(items, name, "name")
			}
			state.writeList(w, items, query)
			return
		}
		state.nextLabelID++
		label := cloneMap(body)
		label["id"] = state.nextLabelID
		label["creation_time"] = time.Now().UTC().Format(time.RFC3339)
		state.labels = append(state.labels, label)
		status, data = http.StatusCreated, label

	case "label":
		index, found := findMapNumber(state.labels, "id", query.Get("id"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "项目标签不存在"
			break
		}
		if method == http.MethodGet {
			data = state.labels[index]
		} else if method == http.MethodPut {
			id, projectID := state.labels[index]["id"], state.labels[index]["project_id"]
			state.labels[index] = cloneMap(body)
			state.labels[index]["id"], state.labels[index]["project_id"] = id, projectID
			state.labels[index]["update_time"] = time.Now().UTC().Format(time.RFC3339)
			data = state.labels[index]
		} else {
			deletedID := numberValue(state.labels[index]["id"])
			state.labels = append(state.labels[:index], state.labels[index+1:]...)
			for repositoryName := range state.artifacts {
				for artifactIndex := range state.artifacts[repositoryName] {
					labels := labelsOf(state.artifacts[repositoryName][artifactIndex])
					filtered := labels[:0]
					for _, label := range labels {
						if numberValue(label["id"]) != deletedID {
							filtered = append(filtered, label)
						}
					}
					state.artifacts[repositoryName][artifactIndex]["labels"] = mapsToAny(filtered)
				}
			}
		}

	case "preheat-providers":
		data = cloneMaps(state.preheatProviders)

	case "preheat-instances":
		if method == http.MethodGet {
			items := state.preheatInstances
			if name := demoQueryString(query.Get("q"), "name"); name != "" {
				items = filterMaps(items, name, "name")
			}
			if endpoint := demoQueryString(query.Get("q"), "endpoint"); endpoint != "" {
				items = filterMaps(items, endpoint, "endpoint")
			}
			state.writeList(w, items, query)
			return
		}
		name := stringValue(body["name"])
		if _, found := findMap(state.preheatInstances, "name", name); found {
			errStatus, errMessage = http.StatusConflict, "P2P 实例名称已经存在"
			break
		}
		for _, instance := range state.preheatInstances {
			if stringValue(instance["endpoint"]) == stringValue(body["endpoint"]) {
				errStatus, errMessage = http.StatusConflict, "P2P 实例地址已经注册"
				break
			}
		}
		if errStatus != 0 {
			break
		}
		state.nextPreheatID++
		instance := cloneMap(body)
		instance["id"] = state.nextPreheatID
		instance["status"] = "Healthy"
		instance["default"] = len(state.preheatInstances) == 0
		instance["setup_timestamp"] = time.Now().Unix()
		if authInfo, ok := instance["auth_info"].(map[string]any); ok {
			for key := range authInfo {
				authInfo[key] = ""
			}
		}
		state.preheatInstances = append(state.preheatInstances, instance)
		status, data = http.StatusCreated, instance

	case "preheat-instance":
		index, found := findMap(state.preheatInstances, "name", query.Get("name"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "P2P 实例不存在"
			break
		}
		if method == http.MethodGet {
			data = state.preheatInstances[index]
		} else if method == http.MethodPut {
			id := state.preheatInstances[index]["id"]
			setup := state.preheatInstances[index]["setup_timestamp"]
			currentAuth := state.preheatInstances[index]["auth_info"]
			next := cloneMap(body)
			next["id"], next["setup_timestamp"], next["status"] = id, setup, "Healthy"
			if authInfo, exists := next["auth_info"].(map[string]any); !exists || len(authInfo) == 0 {
				if stringValue(next["auth_mode"]) != "NONE" {
					next["auth_info"] = currentAuth
				}
			} else {
				for key := range authInfo {
					authInfo[key] = ""
				}
			}
			state.preheatInstances[index] = next
			data = next
		} else {
			instanceID := numberValue(state.preheatInstances[index]["id"])
			for _, policies := range state.preheatPolicies {
				for _, policy := range policies {
					if numberValue(policy["provider_id"]) == instanceID {
						errStatus, errMessage = http.StatusConflict, "该 P2P 实例仍被预热策略使用"
						break
					}
				}
			}
			if errStatus == 0 {
				state.preheatInstances = append(state.preheatInstances[:index], state.preheatInstances[index+1:]...)
			}
		}

	case "preheat-instance-ping":
		if id := numberValue(body["id"]); id > 0 {
			if _, found := findMapNumber(state.preheatInstances, "id", strconv.FormatInt(id, 10)); !found {
				errStatus, errMessage = http.StatusNotFound, "P2P 实例不存在"
			}
		} else if strings.Contains(strings.ToLower(stringValue(body["endpoint"])), "down") {
			errStatus, errMessage = http.StatusBadGateway, "P2P Provider 无法连接"
		}

	case "project-preheat-providers":
		providers := make([]any, 0)
		for _, instance := range state.preheatInstances {
			if instance["enabled"] == true {
				providers = append(providers, map[string]any{"id": instance["id"], "provider": instance["vendor"], "enabled": instance["enabled"], "default": instance["default"]})
			}
		}
		data = providers

	case "preheat-policies":
		projectName := query.Get("project")
		if method == http.MethodGet {
			items := state.preheatPolicies[projectName]
			if name := demoQueryString(query.Get("q"), "name"); name != "" {
				items = filterMaps(items, name, "name")
			}
			state.writeList(w, items, query)
			return
		}
		name := stringValue(body["name"])
		if _, found := findMap(state.preheatPolicies[projectName], "name", name); found {
			errStatus, errMessage = http.StatusConflict, "预热策略名称已经存在"
			break
		}
		state.nextPreheatPolicy++
		policy := cloneMap(body)
		policy["id"] = state.nextPreheatPolicy
		policy["project_id"] = projectID(state.projects, projectName)
		now := time.Now().UTC().Format(time.RFC3339)
		policy["creation_time"], policy["update_time"] = now, now
		state.preheatPolicies[projectName] = append(state.preheatPolicies[projectName], policy)
		state.preheatExecutions[projectName+"/"+name] = []map[string]any{}
		status, data = http.StatusCreated, policy

	case "preheat-policy":
		projectName, originalName := query.Get("project"), query.Get("name")
		index, found := findMap(state.preheatPolicies[projectName], "name", originalName)
		if !found {
			errStatus, errMessage = http.StatusNotFound, "预热策略不存在"
			break
		}
		if method == http.MethodGet {
			data = state.preheatPolicies[projectName][index]
		} else if method == http.MethodPut {
			id := state.preheatPolicies[projectName][index]["id"]
			projectIDValue := state.preheatPolicies[projectName][index]["project_id"]
			created := state.preheatPolicies[projectName][index]["creation_time"]
			policy := cloneMap(body)
			policy["id"], policy["project_id"], policy["creation_time"] = id, projectIDValue, created
			policy["update_time"] = time.Now().UTC().Format(time.RFC3339)
			state.preheatPolicies[projectName][index] = policy
			newName := stringValue(policy["name"])
			if newName != originalName {
				state.preheatExecutions[projectName+"/"+newName] = state.preheatExecutions[projectName+"/"+originalName]
				delete(state.preheatExecutions, projectName+"/"+originalName)
			}
			data = policy
		} else if method == http.MethodPost {
			state.nextPreheatRun++
			state.nextPreheatTask++
			now := time.Now().UTC().Format(time.RFC3339)
			execution := map[string]any{"id": state.nextPreheatRun, "vendor_type": "PREHEAT", "vendor_id": state.preheatPolicies[projectName][index]["id"], "status": "Running", "status_message": "", "metrics": map[string]any{"task_count": 1, "success_task_count": 0, "error_task_count": 0, "pending_task_count": 0, "running_task_count": 1, "scheduled_task_count": 0, "stopped_task_count": 0}, "trigger": "Manual", "extra_attrs": map[string]any{}, "start_time": now, "end_time": ""}
			key := projectName + "/" + originalName
			state.preheatExecutions[key] = append([]map[string]any{execution}, state.preheatExecutions[key]...)
			task := map[string]any{"id": state.nextPreheatTask, "execution_id": state.nextPreheatRun, "status": "Running", "status_message": "", "run_count": 1, "extra_attrs": map[string]any{"artifact": projectName + "/gateway:latest", "digest": "sha256:demo", "kind": "IMAGE"}, "creation_time": now, "update_time": now, "start_time": now, "end_time": ""}
			state.preheatTasks[state.nextPreheatRun] = []map[string]any{task}
			state.preheatLogs[fmt.Sprintf("%d:%d", state.nextPreheatRun, state.nextPreheatTask)] = now + " [INFO] 已提交 P2P 预热任务\n"
			status, data = http.StatusCreated, execution
		} else {
			state.preheatPolicies[projectName] = append(state.preheatPolicies[projectName][:index], state.preheatPolicies[projectName][index+1:]...)
			delete(state.preheatExecutions, projectName+"/"+originalName)
		}

	case "preheat-executions":
		key := query.Get("project") + "/" + query.Get("name")
		if _, found := findMap(state.preheatPolicies[query.Get("project")], "name", query.Get("name")); !found {
			errStatus, errMessage = http.StatusNotFound, "预热策略不存在"
			break
		}
		state.writeList(w, state.preheatExecutions[key], query)
		return

	case "preheat-execution":
		key := query.Get("project") + "/" + query.Get("name")
		index, found := findMapNumber(state.preheatExecutions[key], "id", query.Get("id"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "预热执行记录不存在"
			break
		}
		if method == http.MethodGet {
			data = state.preheatExecutions[key][index]
		} else {
			execution := state.preheatExecutions[key][index]
			execution["status"] = "Stopped"
			execution["end_time"] = time.Now().UTC().Format(time.RFC3339)
			metrics, _ := execution["metrics"].(map[string]any)
			metrics["running_task_count"], metrics["stopped_task_count"] = 0, metrics["task_count"]
			executionID := parseDemoID(query.Get("id"))
			for taskIndex := range state.preheatTasks[executionID] {
				state.preheatTasks[executionID][taskIndex]["status"] = "Stopped"
				state.preheatTasks[executionID][taskIndex]["end_time"] = execution["end_time"]
			}
			data = execution
		}

	case "preheat-tasks":
		executionID := parseDemoID(query.Get("id"))
		state.writeList(w, state.preheatTasks[executionID], query)
		return

	case "preheat-task-log":
		logText, found := state.preheatLogs[query.Get("id")+":"+query.Get("task")]
		if !found {
			errStatus, errMessage = http.StatusNotFound, "预热任务日志不存在"
			break
		}
		data = logText

	case "immutable-rules":
		projectName := query.Get("project")
		if method == http.MethodGet {
			state.writeList(w, state.immutableRules[projectName], query)
			return
		}
		state.nextRuleID++
		rule := cloneMap(body)
		rule["id"] = state.nextRuleID
		state.immutableRules[projectName] = append(state.immutableRules[projectName], rule)
		status, data = http.StatusCreated, rule

	case "immutable-rule":
		projectName := query.Get("project")
		index, found := findMapNumber(state.immutableRules[projectName], "id", query.Get("id"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "不可变 Tag 规则不存在"
			break
		}
		if method == http.MethodPut {
			id := state.immutableRules[projectName][index]["id"]
			state.immutableRules[projectName][index] = cloneMap(body)
			state.immutableRules[projectName][index]["id"] = id
			data = state.immutableRules[projectName][index]
		} else {
			state.immutableRules[projectName] = append(state.immutableRules[projectName][:index], state.immutableRules[projectName][index+1:]...)
		}

	case "webhooks":
		projectName := query.Get("project")
		if method == http.MethodGet {
			state.writeList(w, state.webhooks[projectName], query)
			return
		}
		state.nextWebhookID++
		webhook := cloneMap(body)
		webhook["id"] = state.nextWebhookID
		webhook["project_id"] = projectID(state.projects, projectName)
		webhook["creation_time"] = time.Now().UTC().Format(time.RFC3339)
		state.webhooks[projectName] = append(state.webhooks[projectName], webhook)
		status, data = http.StatusCreated, webhook

	case "webhook":
		projectName := query.Get("project")
		index, found := findMapNumber(state.webhooks[projectName], "id", query.Get("id"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "Webhook 不存在"
			break
		}
		if method == http.MethodGet {
			data = state.webhooks[projectName][index]
		} else if method == http.MethodPut {
			id, projectID := state.webhooks[projectName][index]["id"], state.webhooks[projectName][index]["project_id"]
			state.webhooks[projectName][index] = cloneMap(body)
			state.webhooks[projectName][index]["id"], state.webhooks[projectName][index]["project_id"] = id, projectID
			state.webhooks[projectName][index]["update_time"] = time.Now().UTC().Format(time.RFC3339)
			data = state.webhooks[projectName][index]
		} else {
			state.webhooks[projectName] = append(state.webhooks[projectName][:index], state.webhooks[projectName][index+1:]...)
		}

	case "webhook-events":
		data = map[string]any{"event_type": []any{"PUSH_ARTIFACT", "PULL_ARTIFACT", "DELETE_ARTIFACT", "SCANNING_COMPLETED", "SCANNING_FAILED", "QUOTA_EXCEED", "TAG_RETENTION"}, "notify_type": []any{"http"}, "payload_formats": []any{map[string]any{"notify_type": "http", "formats": []any{"Default", "CloudEvents"}}}}

	case "legacy-webhook-jobs":
		items := make([]map[string]any, 0)
		for _, executions := range state.webhookExecutions {
			items = append(items, executions...)
		}
		state.writeList(w, items, query)
		return

	case "legacy-webhook-last-trigger":
		data = map[string]any{"status": "Success", "trigger_time": "2026-07-28T06:42:00Z"}

	case "webhook-executions":
		projectName := query.Get("project")
		if _, found := findMapNumber(state.webhooks[projectName], "id", query.Get("id")); !found {
			errStatus, errMessage = http.StatusNotFound, "Webhook 策略不存在"
			break
		}
		executions := state.webhookExecutions[parseDemoID(query.Get("id"))]
		executions = filterMaps(executions, demoQueryString(query.Get("q"), "status"), "status")
		state.writeList(w, executions, query)
		return

	case "webhook-tasks":
		executionID := parseDemoID(query.Get("execution"))
		if _, found := findMapNumber(state.webhookExecutions[parseDemoID(query.Get("id"))], "id", query.Get("execution")); !found {
			errStatus, errMessage = http.StatusNotFound, "Webhook 执行记录不存在"
			break
		}
		state.writeList(w, state.webhookTasks[executionID], query)
		return

	case "webhook-task-log":
		key := query.Get("execution") + ":" + query.Get("task")
		logText, found := state.webhookLogs[key]
		if !found {
			errStatus, errMessage = http.StatusNotFound, "Webhook 任务日志不存在"
			break
		}
		data = logText

	case "current-user":
		if len(state.users) == 0 {
			errStatus, errMessage = http.StatusUnauthorized, "当前用户不存在"
			break
		}
		current := cloneMap(state.users[0])
		current["oidc_user_meta"] = map[string]any{"id": 1, "user_id": current["user_id"], "creation_time": "2026-01-12T08:00:00Z", "update_time": current["update_time"]}
		data = current

	case "current-permissions":
		scope := query.Get("scope")
		permissions := []any{
			map[string]any{"resource": "system", "action": "read"},
			map[string]any{"resource": "system", "action": "list"},
			map[string]any{"resource": "system", "action": "create"},
			map[string]any{"resource": "system", "action": "update"},
			map[string]any{"resource": "system", "action": "delete"},
		}
		if strings.HasPrefix(scope, "/project/") {
			permissions = []any{
				map[string]any{"resource": "repository", "action": "list"},
				map[string]any{"resource": "repository", "action": "pull"},
				map[string]any{"resource": "repository", "action": "push"},
				map[string]any{"resource": "repository", "action": "delete"},
				map[string]any{"resource": "artifact", "action": "read"},
				map[string]any{"resource": "artifact", "action": "create"},
				map[string]any{"resource": "artifact", "action": "delete"},
				map[string]any{"resource": "member", "action": "list"},
				map[string]any{"resource": "member", "action": "create"},
				map[string]any{"resource": "member", "action": "update"},
				map[string]any{"resource": "member", "action": "delete"},
			}
		}
		state.writeListAny(w, permissions, query)
		return

	case "users":
		if method == http.MethodGet {
			items := state.users
			if queryText := demoQueryString(query.Get("q"), "username"); queryText != "" {
				items = filterMaps(items, queryText, "username")
			}
			state.writeList(w, items, query)
			return
		}
		username := stringValue(body["username"])
		if _, found := findMap(state.users, "username", username); found {
			errStatus, errMessage = http.StatusConflict, "用户名已经存在"
			break
		}
		state.nextUserID++
		user := cloneMap(body)
		delete(user, "password")
		user["user_id"] = state.nextUserID
		user["sysadmin_flag"] = false
		user["creation_time"] = time.Now().UTC().Format(time.RFC3339)
		state.users = append(state.users, user)
		status, data = http.StatusCreated, user

	case "users-search":
		state.writeList(w, filterMaps(state.users, query.Get("username"), "username"), query)
		return

	case "user":
		index, found := findMapNumber(state.users, "user_id", query.Get("id"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "用户不存在"
			break
		}
		if method == http.MethodGet {
			data = state.users[index]
		} else if method == http.MethodPut {
			for _, field := range []string{"email", "realname", "comment"} {
				if value, ok := body[field]; ok {
					state.users[index][field] = value
				}
			}
			state.users[index]["update_time"] = time.Now().UTC().Format(time.RFC3339)
			data = state.users[index]
		} else {
			if stringValue(state.users[index]["username"]) == "demo-admin" {
				errStatus, errMessage = http.StatusForbidden, "不能删除当前演示管理员"
				break
			}
			state.users = append(state.users[:index], state.users[index+1:]...)
		}

	case "user-sysadmin":
		index, found := findMapNumber(state.users, "user_id", query.Get("id"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "用户不存在"
			break
		}
		state.users[index]["sysadmin_flag"] = body["sysadmin_flag"]
		state.users[index]["update_time"] = time.Now().UTC().Format(time.RFC3339)
		data = state.users[index]

	case "user-password", "current-user-password":
		if _, found := findMapNumber(state.users, "user_id", query.Get("id")); !found {
			errStatus, errMessage = http.StatusNotFound, "用户不存在"
			break
		}
		data = map[string]any{"updated": true}

	case "user-cli-secret", "current-user-cli-secret":
		index, found := findMapNumber(state.users, "user_id", query.Get("id"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "用户不存在"
			break
		}
		state.users[index]["update_time"] = time.Now().UTC().Format(time.RFC3339)
		state.users[index]["has_cli_secret"] = true
		data = map[string]any{"updated": true}

	case "user-groups":
		if method == http.MethodGet {
			state.writeList(w, filterMaps(state.userGroups, query.Get("group_name"), "group_name"), query)
			return
		}
		state.nextGroupID++
		group := cloneMap(body)
		group["id"] = state.nextGroupID
		state.userGroups = append(state.userGroups, group)
		status, data = http.StatusCreated, group

	case "user-groups-search":
		state.writeList(w, filterMaps(state.userGroups, query.Get("groupname"), "group_name"), query)
		return

	case "user-group":
		index, found := findMapNumber(state.userGroups, "id", query.Get("id"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "用户组不存在"
			break
		}
		if method == http.MethodGet {
			data = state.userGroups[index]
		} else if method == http.MethodPut {
			id := state.userGroups[index]["id"]
			state.userGroups[index] = cloneMap(body)
			state.userGroups[index]["id"] = id
			data = state.userGroups[index]
		} else {
			state.userGroups = append(state.userGroups[:index], state.userGroups[index+1:]...)
		}

	case "quotas":
		state.writeList(w, state.quotas, query)
		return

	case "quota":
		index, found := findMapNumber(state.quotas, "id", query.Get("id"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "配额不存在"
			break
		}
		if method == http.MethodGet {
			data = state.quotas[index]
		} else {
			state.quotas[index]["hard"] = cloneMap(body["hard"].(map[string]any))
			state.quotas[index]["update_time"] = time.Now().UTC().Format(time.RFC3339)
			data = state.quotas[index]
		}

	case "scanners":
		if method == http.MethodGet {
			state.writeList(w, filterMaps(state.scanners, demoQueryString(query.Get("q"), "name"), "name"), query)
			return
		}
		state.nextScannerID++
		scanner := cloneMap(body)
		scanner["uuid"] = fmt.Sprintf("00000000-0000-4000-8000-%012d", state.nextScannerID)
		scanner["health"] = "healthy"
		scanner["is_default"] = false
		scanner["create_time"] = time.Now().UTC().Format(time.RFC3339)
		delete(scanner, "access_credential")
		state.scanners = append(state.scanners, scanner)
		status, data = http.StatusCreated, scanner

	case "scanner":
		index, found := findMap(state.scanners, "uuid", query.Get("id"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "扫描器不存在"
			break
		}
		if method == http.MethodGet {
			data = state.scanners[index]
		} else if method == http.MethodPut {
			uuid, isDefault := state.scanners[index]["uuid"], state.scanners[index]["is_default"]
			for key, value := range body {
				if key != "access_credential" || stringValue(value) != "" {
					state.scanners[index][key] = value
				}
			}
			state.scanners[index]["uuid"], state.scanners[index]["is_default"] = uuid, isDefault
			state.scanners[index]["health"] = "healthy"
			state.scanners[index]["update_time"] = time.Now().UTC().Format(time.RFC3339)
			data = state.scanners[index]
		} else if method == http.MethodPatch {
			for itemIndex := range state.scanners {
				state.scanners[itemIndex]["is_default"] = itemIndex == index && body["is_default"] == true
			}
			data = state.scanners[index]
		} else {
			if state.scanners[index]["is_default"] == true {
				errStatus, errMessage = http.StatusPreconditionFailed, "默认扫描器不能直接删除"
				break
			}
			state.scanners = append(state.scanners[:index], state.scanners[index+1:]...)
		}

	case "scanner-ping":
		data = map[string]any{"health": "healthy"}

	case "scanner-metadata":
		index, found := findMap(state.scanners, "uuid", query.Get("id"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "扫描器不存在"
			break
		}
		scanner := state.scanners[index]
		data = map[string]any{
			"scanner": map[string]any{"name": scanner["name"], "vendor": scanner["vendor"], "version": scanner["version"]},
			"capabilities": []any{
				map[string]any{"type": "vulnerability", "consumes_mime_types": []any{"application/vnd.docker.distribution.manifest.v2+json", "application/vnd.oci.image.manifest.v1+json"}, "produces_mime_types": []any{"application/vnd.scanner.adapter.vuln.report.harbor+json; version=1.1"}},
				map[string]any{"type": "sbom", "consumes_mime_types": []any{"application/vnd.docker.distribution.manifest.v2+json", "application/vnd.oci.image.manifest.v1+json"}, "produces_mime_types": []any{"application/vnd.scanner.adapter.sbom.report.harbor+json; version=1.0"}},
			},
			"properties": map[string]any{
				"harbor.scanner-adapter/scanner-type":                      "os-package-vulnerability",
				"harbor.scanner-adapter/vulnerability-database-updated-at": "2026-07-30T00:00:00Z",
			},
		}

	case "retentions":
		scope, _ := body["scope"].(map[string]any)
		projectIndex, found := findMapNumber(state.projects, "project_id", fmt.Sprint(numberValue(scope["ref"])))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "Tag 保留策略引用的项目不存在"
			break
		}
		metadata, _ := state.projects[projectIndex]["metadata"].(map[string]any)
		if stringValue(metadata["retention_id"]) != "" {
			errStatus, errMessage = http.StatusConflict, "项目已经绑定 Tag 保留策略"
			break
		}
		state.nextRetentionID++
		policy := cloneMap(body)
		policy["id"] = state.nextRetentionID
		now := time.Now().UTC().Format(time.RFC3339)
		policy["creation_time"], policy["update_time"] = now, now
		state.retentions = append(state.retentions, policy)
		state.retentionRuns[state.nextRetentionID] = []map[string]any{}
		metadata["retention_id"] = strconv.FormatInt(state.nextRetentionID, 10)
		status, data = http.StatusCreated, policy

	case "retention-metadatas":
		data = cloneMap(state.retentionMetadata)

	case "retention":
		index, found := findMapNumber(state.retentions, "id", query.Get("id"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "Tag 保留策略不存在"
			break
		}
		retentionID := parseDemoID(query.Get("id"))
		if method == http.MethodGet {
			data = state.retentions[index]
		} else if method == http.MethodPut {
			id := state.retentions[index]["id"]
			creationTime := state.retentions[index]["creation_time"]
			state.retentions[index] = cloneMap(body)
			state.retentions[index]["id"] = id
			state.retentions[index]["creation_time"] = creationTime
			state.retentions[index]["update_time"] = time.Now().UTC().Format(time.RFC3339)
			data = state.retentions[index]
		} else {
			scope, _ := state.retentions[index]["scope"].(map[string]any)
			if projectIndex, exists := findMapNumber(state.projects, "project_id", fmt.Sprint(numberValue(scope["ref"]))); exists {
				metadata, _ := state.projects[projectIndex]["metadata"].(map[string]any)
				delete(metadata, "retention_id")
			}
			state.retentions = append(state.retentions[:index], state.retentions[index+1:]...)
			delete(state.retentionRuns, retentionID)
		}

	case "retention-executions":
		retentionID := parseDemoID(query.Get("id"))
		if _, found := findMapNumber(state.retentions, "id", query.Get("id")); !found {
			errStatus, errMessage = http.StatusNotFound, "Tag 保留策略不存在"
			break
		}
		if method == http.MethodGet {
			state.writeList(w, state.retentionRuns[retentionID], query)
			return
		}
		state.nextRetentionRunID++
		now := time.Now().UTC().Format(time.RFC3339)
		run := map[string]any{"id": state.nextRetentionRunID, "policy_id": retentionID, "status": "Running", "trigger": "Manual", "dry_run": body["dry_run"], "start_time": now}
		state.retentionRuns[retentionID] = append([]map[string]any{run}, state.retentionRuns[retentionID]...)
		taskID := state.nextRetentionRunID + 100
		state.retentionTasks[state.nextRetentionRunID] = []map[string]any{{"id": taskID, "execution_id": state.nextRetentionRunID, "repository": "platform/gateway", "job_id": fmt.Sprintf("retention-job-%d", taskID), "status": "Running", "status_code": 0, "status_revision": 1, "start_time": now, "end_time": "", "total": 28, "retained": 10}}
		state.retentionLogs[fmt.Sprintf("%d:%d", state.nextRetentionRunID, taskID)] = fmt.Sprintf("%s [INFO] starting retention for platform/gateway\n%s [INFO] evaluating 28 tags\n", now, now)
		status, data = http.StatusCreated, run

	case "retention-execution":
		retentionID := parseDemoID(query.Get("id"))
		index, found := findMapNumber(state.retentionRuns[retentionID], "id", query.Get("eid"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "Tag 保留执行记录不存在"
			break
		}
		state.retentionRuns[retentionID][index]["status"] = "Stopped"
		state.retentionRuns[retentionID][index]["end_time"] = time.Now().UTC().Format(time.RFC3339)
		executionID := parseDemoID(query.Get("eid"))
		for _, task := range state.retentionTasks[executionID] {
			if stringValue(task["status"]) == "Running" {
				task["status"] = "Stopped"
				task["end_time"] = state.retentionRuns[retentionID][index]["end_time"]
			}
		}
		data = state.retentionRuns[retentionID][index]

	case "retention-tasks":
		executionID := parseDemoID(query.Get("eid"))
		if _, found := findMapNumber(state.retentionRuns[parseDemoID(query.Get("id"))], "id", query.Get("eid")); !found {
			errStatus, errMessage = http.StatusNotFound, "Tag 保留执行记录不存在"
			break
		}
		state.writeList(w, state.retentionTasks[executionID], query)
		return

	case "retention-task-log":
		key := query.Get("eid") + ":" + query.Get("tid")
		logText, found := state.retentionLogs[key]
		if !found {
			errStatus, errMessage = http.StatusNotFound, "Tag 保留任务日志不存在"
			break
		}
		data = logText

	case "gc-history":
		state.writeList(w, state.gcHistory, query)
		return

	case "gc-job":
		index, found := findMapNumber(state.gcHistory, "id", query.Get("id"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "垃圾清理任务不存在"
			break
		}
		if method == http.MethodGet {
			data = state.gcHistory[index]
		} else {
			state.gcHistory[index]["job_status"] = "Stopped"
			state.gcHistory[index]["update_time"] = time.Now().UTC().Format(time.RFC3339)
			data = state.gcHistory[index]
		}

	case "gc-log":
		index, found := findMapNumber(state.gcHistory, "id", query.Get("id"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "垃圾清理任务不存在"
			break
		}
		job := state.gcHistory[index]
		data = fmt.Sprintf("%s [INFO] initialization completed\n%s [INFO] Garbage Collection parameters: %v\n%s [INFO] mark phase completed\n%s [INFO] sweep phase completed\n%s [INFO] garbage collection job #%v finished with status %v\n",
			stringValue(job["creation_time"]), stringValue(job["creation_time"]), job["parameters"], stringValue(job["creation_time"]), stringValue(job["update_time"]), stringValue(job["update_time"]), job["id"], job["job_status"])

	case "gc-schedule":
		if method == http.MethodGet {
			data = state.gcSchedule
			break
		}
		schedule, _ := body["schedule"].(map[string]any)
		if stringValue(schedule["type"]) == "Manual" {
			state.nextGCID++
			now := time.Now().UTC().Format(time.RFC3339)
			parameters, _ := body["parameters"].(map[string]any)
			dryRun, _ := parameters["dry_run"].(bool)
			job := map[string]any{"id": state.nextGCID, "job_name": "GARBAGE_COLLECTION", "job_kind": "Manual", "job_status": "Success", "deleted": !dryRun, "dry_run": dryRun, "parameters": cloneMap(parameters), "creation_time": now, "update_time": now}
			state.gcHistory = append([]map[string]any{job}, state.gcHistory...)
			status, data = http.StatusCreated, job
		} else {
			state.gcSchedule = cloneMap(body)
			state.gcSchedule["id"] = 21
			state.gcSchedule["status"] = "Scheduled"
			if method == http.MethodPost {
				status = http.StatusCreated
			}
			data = state.gcSchedule
		}

	case "purge-history":
		state.writeList(w, state.purgeHistory, query)
		return

	case "purge-job":
		index, found := findMapNumber(state.purgeHistory, "id", query.Get("id"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "审计日志清理任务不存在"
			break
		}
		if method == http.MethodPut {
			state.purgeHistory[index]["job_status"] = "Stopped"
			state.purgeHistory[index]["update_time"] = time.Now().UTC().Format(time.RFC3339)
		}
		data = state.purgeHistory[index]

	case "purge-log":
		logText, found := state.purgeLogs[parseDemoID(query.Get("id"))]
		if !found {
			errStatus, errMessage = http.StatusNotFound, "审计日志清理日志不存在"
			break
		}
		data = logText

	case "purge-schedule":
		if method == http.MethodGet {
			data = state.purgeSchedule
			break
		}
		schedule, _ := body["schedule"].(map[string]any)
		parameters, _ := body["parameters"].(map[string]any)
		if stringValue(schedule["type"]) == "Manual" {
			state.nextPurgeID++
			now := time.Now().UTC().Format(time.RFC3339)
			encodedParameters, _ := json.Marshal(parameters)
			job := map[string]any{"id": state.nextPurgeID, "job_name": "PURGE_AUDIT", "job_kind": "Manual", "job_parameters": string(encodedParameters), "job_status": "Running", "deleted": false, "creation_time": now, "update_time": now}
			state.purgeHistory = append([]map[string]any{job}, state.purgeHistory...)
			state.purgeLogs[state.nextPurgeID] = fmt.Sprintf("%s [INFO] starting audit log purge\n%s [INFO] retention threshold: %v hours\n", now, now, parameters["audit_retention_hour"])
			status, data = http.StatusCreated, job
		} else {
			state.purgeSchedule = cloneMap(body)
			state.purgeSchedule["id"] = 23
			state.purgeSchedule["status"] = "Scheduled"
			if method == http.MethodPost {
				status = http.StatusCreated
			}
			data = state.purgeSchedule
		}

	case "jobservice-pools":
		data = mapsToAny(state.jobPools)

	case "jobservice-workers":
		poolID := query.Get("pool")
		if poolID == "all" {
			workers := make([]any, 0)
			for _, items := range state.jobWorkers {
				workers = append(workers, mapsToAny(items)...)
			}
			data = workers
			break
		}
		workers, found := state.jobWorkers[poolID]
		if !found {
			errStatus, errMessage = http.StatusNotFound, "Job Service 工作池不存在"
			break
		}
		data = mapsToAny(workers)

	case "jobservice-job":
		jobID := query.Get("job")
		found := false
		for _, workers := range state.jobWorkers {
			for _, worker := range workers {
				if stringValue(worker["job_id"]) == jobID {
					worker["job_name"], worker["job_id"], worker["check_in"] = "", "", "stopped"
					worker["checkin_at"] = time.Now().UTC().Format(time.RFC3339)
					found = true
				}
			}
		}
		if !found {
			errStatus, errMessage = http.StatusNotFound, "运行任务不存在"
			break
		}
		data = map[string]any{"stopped": true}

	case "jobservice-job-log":
		logText, found := state.jobLogs[query.Get("job")]
		if !found {
			errStatus, errMessage = http.StatusNotFound, "Job Service 任务日志不存在"
			break
		}
		data = logText

	case "jobservice-queues":
		data = mapsToAny(state.jobQueues)

	case "jobservice-queue":
		jobType := query.Get("type")
		action := stringValue(body["action"])
		matched := false
		for _, queue := range state.jobQueues {
			if jobType != "all" && stringValue(queue["job_type"]) != jobType {
				continue
			}
			matched = true
			if action == "stop" {
				queue["count"], queue["latency"] = 0, 0
			} else {
				queue["paused"] = action == "pause"
			}
		}
		if !matched {
			errStatus, errMessage = http.StatusNotFound, "Job Service 队列不存在"
			break
		}
		data = map[string]any{"action": action}

	case "jobservice-schedules":
		state.writeList(w, state.jobSchedules, query)
		return

	case "jobservice-schedule-status":
		data = map[string]any{"paused": state.jobSchedulePaused}

	case "scan-all-metrics", "legacy-scan-schedule-metrics":
		data = state.scanMetrics

	case "scan-all-schedule":
		if method == http.MethodGet {
			data = state.scanSchedule
			break
		}
		schedule, _ := body["schedule"].(map[string]any)
		if stringValue(schedule["type"]) == "Manual" {
			state.scanMetrics = map[string]any{"total": 24, "completed": 24, "metrics": map[string]any{"Success": 24}}
			status, data = http.StatusCreated, state.scanMetrics
		} else {
			state.scanSchedule = cloneMap(body)
			state.scanSchedule["id"] = 22
			state.scanSchedule["status"] = "Scheduled"
			if method == http.MethodPost {
				status = http.StatusCreated
			}
			data = state.scanSchedule
		}

	case "scan-all-stop":
		state.scanMetrics = map[string]any{"total": 24, "completed": 24, "metrics": map[string]any{"Stopped": 24}}
		status, data = http.StatusAccepted, state.scanMetrics

	case "security-summary":
		data = demoSecuritySummary(state.securityVuls, state.artifacts)

	case "security-vulnerabilities":
		state.writeList(w, filterDemoSecurityVulnerabilities(state.securityVuls, query.Get("q")), query)
		return

	case "system-cve-allowlist":
		if method == http.MethodGet {
			data = state.systemCVEAllowlist
			break
		}
		created := state.systemCVEAllowlist["creation_time"]
		state.systemCVEAllowlist = cloneMap(body)
		state.systemCVEAllowlist["id"] = 1
		state.systemCVEAllowlist["project_id"] = 0
		state.systemCVEAllowlist["creation_time"] = created
		state.systemCVEAllowlist["update_time"] = time.Now().UTC().Format(time.RFC3339)
		data = state.systemCVEAllowlist

	case "cve-export":
		state.nextCVEExportID++
		now := time.Now().UTC().Format(time.RFC3339)
		execution := map[string]any{"id": state.nextCVEExportID, "user_id": 1, "user_name": "demo-admin", "status": "Success", "trigger": "Manual", "start_time": now, "end_time": now, "status_text": "", "file_present": true}
		state.cveExports = append([]map[string]any{execution}, state.cveExports...)
		state.cveExportFiles[state.nextCVEExportID] = demoCVEExportCSV()
		status, data = http.StatusOK, map[string]any{"id": state.nextCVEExportID}

	case "cve-export-executions":
		data = map[string]any{"items": mapsToAny(state.cveExports)}

	case "cve-export-execution":
		index, found := findMapNumber(state.cveExports, "id", query.Get("id"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "CVE 导出执行不存在"
			break
		}
		data = state.cveExports[index]

	case "cve-export-download":
		id := parseDemoID(query.Get("id"))
		content, found := state.cveExportFiles[id]
		if !found {
			writeError(w, http.StatusNotFound, "Harbor 请求失败", "CVE 导出文件不存在或已过期")
			return
		}
		w.Header().Set("Content-Type", "text/csv; charset=utf-8")
		w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=harbor-cve-export-%d.csv", id))
		w.Header().Set("X-Content-Type-Options", "nosniff")
		_, _ = w.Write([]byte(content))
		return

	case "configurations":
		if method == http.MethodGet {
			data = state.configurations
			break
		}
		for key, value := range body {
			item, ok := state.configurations[key].(map[string]any)
			if !ok {
				item = map[string]any{"editable": true}
				state.configurations[key] = item
			}
			item["value"] = value
		}
		data = state.configurations

	case "system-root-certificate":
		w.Header().Set("Content-Type", "application/octet-stream")
		w.Header().Set("Content-Disposition", `attachment; filename="harbor-ca.crt"`)
		w.Header().Set("X-Content-Type-Options", "nosniff")
		_, _ = w.Write([]byte("-----BEGIN CERTIFICATE-----\nMIIBdemoHarborConsoleRootCertificate\n-----END CERTIFICATE-----\n"))
		return

	case "ldap-ping":
		data = map[string]any{"success": true, "message": "LDAP 服务连接成功"}

	case "ldap-users-search":
		state.writeList(w, filterMaps(state.ldapUsers, query.Get("username"), "username"), query)
		return

	case "ldap-users-import":
		uids := body["ldap_uid_list"].([]any)
		for _, rawUID := range uids {
			uid := stringValue(rawUID)
			index, found := findMap(state.ldapUsers, "username", uid)
			if !found {
				continue
			}
			state.nextUserID++
			candidate := cloneMap(state.ldapUsers[index])
			candidate["user_id"] = state.nextUserID
			candidate["comment"] = "从 LDAP 目录导入"
			candidate["sysadmin_flag"] = false
			candidate["creation_time"] = time.Now().UTC().Format(time.RFC3339)
			state.users = append(state.users, candidate)
			state.ldapUsers = append(state.ldapUsers[:index], state.ldapUsers[index+1:]...)
		}
		data = map[string]any{"imported": len(uids)}

	case "ldap-groups-search":
		items := state.ldapGroups
		if name := query.Get("groupname"); name != "" {
			items = filterMaps(items, name, "group_name")
		} else if dn := query.Get("groupdn"); dn != "" {
			items = filterMaps(items, dn, "ldap_group_dn")
		}
		state.writeList(w, items, query)
		return

	case "oidc-ping":
		data = map[string]any{"success": true}

	case "replication-policies":
		if method == http.MethodGet {
			state.writeList(w, filterMaps(state.policies, query.Get("name"), "name"), query)
			return
		}
		state.nextPolicyID++
		policy := cloneMap(body)
		state.expandDemoPolicyRegistries(policy)
		policy["id"] = state.nextPolicyID
		now := time.Now().UTC().Format(time.RFC3339)
		policy["creation_time"], policy["update_time"] = now, now
		state.policies = append(state.policies, policy)
		status, data = http.StatusCreated, policy

	case "replication-policy":
		index, found := findMapNumber(state.policies, "id", query.Get("id"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "复制策略不存在"
			break
		}
		if method == http.MethodGet {
			data = state.policies[index]
		} else if method == http.MethodPut {
			id := state.policies[index]["id"]
			state.policies[index] = cloneMap(body)
			state.expandDemoPolicyRegistries(state.policies[index])
			state.policies[index]["id"] = id
			state.policies[index]["update_time"] = time.Now().UTC().Format(time.RFC3339)
			data = state.policies[index]
		} else {
			state.policies = append(state.policies[:index], state.policies[index+1:]...)
		}

	case "replication-executions":
		if method == http.MethodGet {
			items := state.executions
			if statusFilter := query.Get("status"); statusFilter != "" {
				items = filterMaps(items, statusFilter, "status")
			}
			if triggerFilter := query.Get("trigger"); triggerFilter != "" {
				items = filterMaps(items, triggerFilter, "trigger")
			}
			if policyFilter := query.Get("policy_id"); policyFilter != "" {
				filtered := make([]map[string]any, 0, len(items))
				for _, item := range items {
					if fmt.Sprint(item["policy_id"]) == policyFilter {
						filtered = append(filtered, item)
					}
				}
				items = filtered
			}
			state.writeList(w, items, query)
			return
		}
		state.nextExecution++
		now := time.Now().UTC()
		execution := map[string]any{"id": state.nextExecution, "policy_id": numberValue(body["policy_id"]), "status": "Succeed", "trigger": "manual", "start_time": now.Format(time.RFC3339), "end_time": now.Add(2 * time.Second).Format(time.RFC3339), "total": 1, "succeed": 1, "failed": 0, "in_progress": 0, "stopped": 0}
		state.executions = append([]map[string]any{execution}, state.executions...)
		taskID := state.nextExecution + 1000
		state.replicationTasks[state.nextExecution] = []map[string]any{{"id": taskID, "execution_id": state.nextExecution, "status": "Succeed", "job_id": fmt.Sprintf("demo-job-%d", taskID), "operation": "copy", "resource_type": "image", "src_resource": "platform/gateway:latest", "dst_resource": "registry.demo.local/platform/gateway:latest", "start_time": now.Format(time.RFC3339), "end_time": now.Add(2 * time.Second).Format(time.RFC3339)}}
		state.replicationLogs[fmt.Sprintf("%d:%d", state.nextExecution, taskID)] = fmt.Sprintf("%s [INFO] 开始复制 platform/gateway:latest\n%s [INFO] 复制任务成功完成\n", now.Format(time.RFC3339), now.Add(2*time.Second).Format(time.RFC3339))
		status, data = http.StatusCreated, execution

	case "replication-execution":
		index, found := findMapNumber(state.executions, "id", query.Get("id"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "复制执行记录不存在"
			break
		}
		if method == http.MethodGet {
			data = state.executions[index]
		} else {
			state.executions[index]["status"] = "Stopped"
			state.executions[index]["stopped"] = numberValue(state.executions[index]["in_progress"])
			state.executions[index]["in_progress"] = 0
			state.executions[index]["end_time"] = time.Now().UTC().Format(time.RFC3339)
			executionID := parseDemoID(query.Get("id"))
			for _, task := range state.replicationTasks[executionID] {
				if stringValue(task["status"]) == "InProgress" {
					task["status"] = "Stopped"
					task["end_time"] = state.executions[index]["end_time"]
				}
			}
			data = state.executions[index]
		}

	case "replication-tasks":
		executionID := parseDemoID(query.Get("id"))
		if _, found := findMapNumber(state.executions, "id", query.Get("id")); !found {
			errStatus, errMessage = http.StatusNotFound, "复制执行记录不存在"
			break
		}
		state.writeList(w, state.replicationTasks[executionID], query)
		return

	case "replication-task-log":
		key := query.Get("id") + ":" + query.Get("task")
		logText, found := state.replicationLogs[key]
		if !found {
			errStatus, errMessage = http.StatusNotFound, "复制任务日志不存在"
			break
		}
		data = logText

	case "registries":
		if method == http.MethodGet {
			state.writeList(w, filterMaps(state.registries, query.Get("name"), "name"), query)
			return
		}
		state.nextRegistryID++
		registry := cloneMap(body)
		registry["id"] = state.nextRegistryID
		registry["status"] = "healthy"
		registry["creation_time"] = time.Now().UTC().Format(time.RFC3339)
		if credential, ok := registry["credential"].(map[string]any); ok {
			credential["access_secret"] = ""
		}
		state.registries = append(state.registries, registry)
		status, data = http.StatusCreated, registry

	case "registry-adapters":
		data = []any{"harbor", "docker-hub", "docker-registry", "ali-acr", "aws-ecr", "azure-acr", "google-gcr"}

	case "registry-adapter-infos":
		data = demoRegistryAdapterInfos()

	case "registry-info":
		data = demoRegistryInfo(parseDemoID(query.Get("id")))

	case "permissions":
		data = demoPermissionMetadata()

	case "audit-logs", "legacy-audit-logs":
		items := mapsFromAny(demoAuditLogs())
		if q := query.Get("q"); q != "" {
			if username := demoQueryString(q, "username"); username != "" {
				items = filterMaps(items, username, "username")
			}
			if resource := demoQueryString(q, "resource"); resource != "" {
				items = filterMaps(items, resource, "resource")
			}
			if operation := demoQueryString(q, "operation"); operation != "" {
				items = filterMaps(items, operation, "operation")
			}
			if result := demoQueryString(q, "op_result"); result != "" {
				want := result == "true"
				filtered := make([]map[string]any, 0, len(items))
				for _, item := range items {
					if item["operation_result"] == want {
						filtered = append(filtered, item)
					}
				}
				items = filtered
			}
		}
		state.writeList(w, items, query)
		return

	case "audit-log-events":
		data = []any{
			map[string]any{"event_type": "create_replication_policy"},
			map[string]any{"event_type": "create_user"},
			map[string]any{"event_type": "delete"},
			map[string]any{"event_type": "pull"},
			map[string]any{"event_type": "push"},
			map[string]any{"event_type": "scan"},
			map[string]any{"event_type": "update"},
		}

	case "project-audit-logs", "legacy-project-audit-logs":
		items := mapsFromAny(demoAuditLogs())
		project := strings.TrimSpace(query.Get("project"))
		if project != "" {
			items = filterMaps(items, project+"/", "resource")
		}
		if q := query.Get("q"); q != "" {
			if username := demoQueryString(q, "username"); username != "" {
				items = filterMaps(items, username, "username")
			}
			if resource := demoQueryString(q, "resource"); resource != "" {
				items = filterMaps(items, resource, "resource")
			}
			if operation := demoQueryString(q, "operation"); operation != "" {
				items = filterMaps(items, operation, "operation")
			}
			if result := demoQueryString(q, "op_result"); result != "" {
				filtered := make([]map[string]any, 0, len(items))
				for _, item := range items {
					if item["operation_result"] == (result == "true") {
						filtered = append(filtered, item)
					}
				}
				items = filtered
			}
		}
		state.writeList(w, items, query)
		return

	case "registry":
		index, found := findMapNumber(state.registries, "id", query.Get("id"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "远端仓库不存在"
			break
		}
		if method == http.MethodGet {
			data = state.registries[index]
		} else if method == http.MethodPut {
			for key, value := range body {
				state.registries[index][key] = value
			}
			state.registries[index]["update_time"] = time.Now().UTC().Format(time.RFC3339)
			data = state.registries[index]
		} else {
			state.registries = append(state.registries[:index], state.registries[index+1:]...)
		}

	case "registry-ping":
		data = map[string]any{"status": "healthy"}

	default:
		errStatus, errMessage = http.StatusNotFound, "演示模式不支持该操作"
	}

	if errStatus != 0 {
		writeError(w, errStatus, "Harbor 请求失败", errMessage)
		return
	}
	payload := map[string]any{"ok": true}
	if data != nil {
		payload["data"] = cloneDemoValue(data)
	}
	writeJSON(w, status, payload)
}

func splitDemoArtifactSource(source string) (string, string, bool) {
	if index := strings.LastIndex(source, "@"); index > 0 {
		return source[:index], source[index+1:], true
	}
	if index := strings.LastIndex(source, ":"); index > 0 {
		return source[:index], source[index+1:], true
	}
	return "", "", false
}

func (state *demoState) writeList(w http.ResponseWriter, items []map[string]any, query url.Values) {
	state.writeListAny(w, mapsToAny(items), query)
}

func (state *demoState) writeListAny(w http.ResponseWriter, items []any, query url.Values) {
	items = append([]any(nil), items...)
	if sortField := strings.TrimSpace(strings.Split(query.Get("sort"), ",")[0]); sortField != "" {
		descending := strings.HasPrefix(sortField, "-")
		sortField = strings.TrimPrefix(sortField, "-")
		sort.SliceStable(items, func(left, right int) bool {
			leftMap, leftOK := items[left].(map[string]any)
			rightMap, rightOK := items[right].(map[string]any)
			if !leftOK || !rightOK {
				return false
			}
			comparison := compareDemoValues(leftMap[sortField], rightMap[sortField])
			if descending {
				return comparison > 0
			}
			return comparison < 0
		})
	}
	total := len(items)
	page, _ := positiveQueryInt(query.Get("page"), 1, 1_000_000)
	pageSize, _ := positiveQueryInt(query.Get("page_size"), 20, 100)
	start := (page - 1) * pageSize
	if start > total {
		start = total
	}
	end := start + pageSize
	if end > total {
		end = total
	}
	pageItems := make([]any, 0, end-start)
	for _, item := range items[start:end] {
		pageItems = append(pageItems, cloneDemoValue(item))
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": pageItems, "pagination": map[string]any{"page": page, "page_size": pageSize, "total": total}, "link": ""})
}

func compareDemoValues(left, right any) int {
	leftNumber, leftNumeric := demoNumericValue(left)
	rightNumber, rightNumeric := demoNumericValue(right)
	if leftNumeric && rightNumeric {
		switch {
		case leftNumber < rightNumber:
			return -1
		case leftNumber > rightNumber:
			return 1
		default:
			return 0
		}
	}
	return strings.Compare(strings.ToLower(fmt.Sprint(left)), strings.ToLower(fmt.Sprint(right)))
}

func demoNumericValue(value any) (float64, bool) {
	switch typed := value.(type) {
	case float64:
		return typed, true
	case int:
		return float64(typed), true
	case int64:
		return float64(typed), true
	case json.Number:
		parsed, err := typed.Float64()
		return parsed, err == nil
	default:
		return 0, false
	}
}

func filterMaps(items []map[string]any, term, field string) []map[string]any {
	term = strings.TrimSpace(strings.TrimPrefix(term, "name=~"))
	term = strings.ToLower(term)
	if term == "" {
		return items
	}
	result := make([]map[string]any, 0)
	for _, item := range items {
		if strings.Contains(strings.ToLower(stringValue(item[field])), term) {
			result = append(result, item)
		}
	}
	return result
}

func findMap(items []map[string]any, field, value string) (int, bool) {
	for index, item := range items {
		if stringValue(item[field]) == value {
			return index, true
		}
	}
	return -1, false
}

func findMapNumber(items []map[string]any, field, value string) (int, bool) {
	for index, item := range items {
		if fmt.Sprint(item[field]) == value {
			return index, true
		}
	}
	return -1, false
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

func mapsToAny(items []map[string]any) []any {
	result := make([]any, 0, len(items))
	for _, item := range items {
		result = append(result, item)
	}
	return result
}

func projectID(projects []map[string]any, name string) any {
	if index, found := findMap(projects, "name", name); found {
		return projects[index]["project_id"]
	}
	return 0
}

func updateDemoRepoCount(projects []map[string]any, project string, count int) {
	if index, found := findMap(projects, "name", project); found {
		projects[index]["repo_count"] = count
		projects[index]["update_time"] = time.Now().UTC().Format(time.RFC3339)
	}
}

func updateDemoArtifactCount(repositories map[string][]map[string]any, project, repository string, count int) {
	if index, found := findMap(repositories[project], "name", repository); found {
		repositories[project][index]["artifact_count"] = count
		repositories[project][index]["update_time"] = time.Now().UTC().Format(time.RFC3339)
	}
}

func demoRoleName(role int) string {
	roles := map[int]string{1: "projectAdmin", 2: "developer", 3: "guest", 4: "maintainer"}
	return roles[role]
}

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

func asAnySlice(value any) []any {
	items, _ := value.([]any)
	return items
}

func demoCVEExportCSV() string {
	return "CVE ID,Severity,Repository,Tag,Package,Installed Version,Fixed Version\nCVE-2026-1842,Critical,platform/gateway,v3.18.4,libssl3,3.4.0-r1,3.4.1-r0\nCVE-2026-0917,High,platform/gateway,v3.18.4,busybox,1.37.0-r3,1.37.0-r5\n"
}

func cloneDemoValue(value any) any {
	switch typed := value.(type) {
	case map[string]any:
		return cloneMap(typed)
	case []map[string]any:
		return cloneMaps(typed)
	case []any:
		result := make([]any, len(typed))
		for index, item := range typed {
			result[index] = cloneDemoValue(item)
		}
		return result
	default:
		return value
	}
}

func stringValue(value any) string {
	text, _ := value.(string)
	return text
}

func sortDemoByID(items []map[string]any) {
	sort.SliceStable(items, func(left, right int) bool {
		return numberValue(items[left]["id"]) > numberValue(items[right]["id"])
	})
}

func parseDemoID(value string) int64 {
	parsed, _ := strconv.ParseInt(value, 10, 64)
	return parsed
}

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

func demoRobotPermissions(project string, writable bool) []any {
	access := []any{
		map[string]any{"resource": "repository", "action": "pull", "effect": "allow"},
		map[string]any{"resource": "repository", "action": "read", "effect": "allow"},
		map[string]any{"resource": "artifact", "action": "read", "effect": "allow"},
		map[string]any{"resource": "artifact", "action": "list", "effect": "allow"},
	}
	if writable {
		access = append(access,
			map[string]any{"resource": "repository", "action": "push", "effect": "allow"},
			map[string]any{"resource": "artifact", "action": "create", "effect": "allow"},
			map[string]any{"resource": "tag", "action": "create", "effect": "allow"},
		)
	}
	return []any{map[string]any{"kind": "project", "namespace": project, "access": access}}
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

func demoRobotNamespace(robot map[string]any) string {
	permissions, _ := robot["permissions"].([]any)
	if len(permissions) == 0 {
		return "system"
	}
	permission, _ := permissions[0].(map[string]any)
	namespace := stringValue(permission["namespace"])
	if namespace == "" {
		return "system"
	}
	return namespace
}

func demoQueryNumber(query, key string) int64 {
	for _, segment := range strings.Split(query, ",") {
		parts := strings.SplitN(strings.TrimSpace(segment), "=", 2)
		if len(parts) == 2 && parts[0] == key {
			value, _ := strconv.ParseInt(parts[1], 10, 64)
			return value
		}
	}
	return 0
}

func demoQueryString(query, key string) string {
	for _, segment := range strings.Split(query, ",") {
		parts := strings.SplitN(strings.TrimSpace(segment), "=", 2)
		if len(parts) == 2 && parts[0] == key {
			return strings.Trim(parts[1], "~")
		}
	}
	return ""
}
