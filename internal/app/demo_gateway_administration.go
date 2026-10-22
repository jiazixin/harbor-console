package app

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"time"
)

// handleAdministrationControl serves instance configuration and LDAP / OIDC checks.
func (state *demoState) handleAdministrationControl(
	w http.ResponseWriter,
	method, operation string,
	query url.Values,
	body map[string]any,
) (handled bool, status int, data any, errStatus int, errMessage string) {
	handled = true
	status = http.StatusOK

	switch operation {
	case "internal-config":
		data = map[string]any{"auth_mode": "oidc_auth", "external_url": "https://harbor.demo.local", "read_only": false}

	case "ping":
		data = map[string]any{"status": "healthy"}

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

	default:
		handled = false
	}
	return
}

// handleRetentionControl serves Tag retention policies and their runs.
func (state *demoState) handleRetentionControl(
	w http.ResponseWriter,
	method, operation string,
	query url.Values,
	body map[string]any,
) (handled bool, status int, data any, errStatus int, errMessage string) {
	handled = true
	status = http.StatusOK

	switch operation {
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

	default:
		handled = false
	}
	return
}

// handleCleanupControl serves garbage collection and audit log purge jobs.
func (state *demoState) handleCleanupControl(
	w http.ResponseWriter,
	method, operation string,
	query url.Values,
	body map[string]any,
) (handled bool, status int, data any, errStatus int, errMessage string) {
	handled = true
	status = http.StatusOK

	switch operation {
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
			stringValue(job["creation_time"]), stringValue(job["creation_time"]), job["job_parameters"], stringValue(job["creation_time"]), stringValue(job["update_time"]), stringValue(job["update_time"]), job["id"], job["job_status"])

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
			parameters["purged_blobs"] = 0
			parameters["purged_manifests"] = 0
			parameters["freed_space"] = 0
			jobParameters, _ := json.Marshal(parameters)
			job := map[string]any{"id": state.nextGCID, "job_name": "GARBAGE_COLLECTION", "job_kind": "GARBAGE_COLLECTION", "job_status": "Success", "deleted": false, "schedule": map[string]any{"type": "Manual"}, "job_parameters": string(jobParameters), "creation_time": now, "update_time": now}
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

	default:
		handled = false
	}
	return
}

// handleJobserviceControl serves job service pools, workers, queues and schedules.
func (state *demoState) handleJobserviceControl(
	w http.ResponseWriter,
	method, operation string,
	query url.Values,
	body map[string]any,
) (handled bool, status int, data any, errStatus int, errMessage string) {
	handled = true
	status = http.StatusOK

	switch operation {
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

	default:
		handled = false
	}
	return
}

// handleSecurityHubControl serves system-wide scanning, vulnerability summaries, the CVE allowlist and CVE exports.
func (state *demoState) handleSecurityHubControl(
	w http.ResponseWriter,
	method, operation string,
	query url.Values,
	body map[string]any,
) (handled bool, status int, data any, errStatus int, errMessage string) {
	handled = true
	status = http.StatusOK

	switch operation {
	case "scan-all-metrics":
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

	default:
		handled = false
	}
	return
}
