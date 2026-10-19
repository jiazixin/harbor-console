package app

import (
	"fmt"
	"net/url"
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
			{"id": 31, "algorithm": "or", "rules": []any{map[string]any{"id": 1, "priority": 1, "disabled": false, "action": "retain", "template": "latestPushedK", "params": map[string]any{"latestPushedK": 10}, "tag_selectors": []any{map[string]any{"kind": "doublestar", "decoration": "excludes", "pattern": "scratch-*", "extras": `{"untagged":true,"future_extra":"preserve-me"}`}}, "scope_selectors": map[string]any{"repository": []any{map[string]any{"kind": "doublestar", "decoration": "repoExcludes", "pattern": "sandbox/**"}}}, "future_field": "preserve-me"}}, "trigger": map[string]any{"kind": "Schedule", "settings": map[string]any{"cron": "0 0 2 * * *"}}, "scope": map[string]any{"level": "project", "ref": 1}, "creation_time": "2026-03-18T08:00:00Z", "update_time": "2026-07-20T02:00:00Z"},
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
			{"id": 301, "job_name": "GARBAGE_COLLECTION", "job_kind": "GARBAGE_COLLECTION", "job_status": "Success", "deleted": false, "schedule": map[string]any{"type": "Manual"}, "job_parameters": `{"delete_untagged":true,"delete_tag":false,"workers":1,"dry_run":false,"purged_blobs":84,"purged_manifests":17,"freed_space":287309824}`, "creation_time": "2026-07-27T02:00:00Z", "update_time": "2026-07-27T02:04:18Z"},
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
			"self_registration":                   map[string]any{"value": false, "editable": false},
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
			state.artifacts[repositoryName] = append(visibleArtifacts, demoChildArtifacts(name, repositoryName, visibleArtifacts[0])...)
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
