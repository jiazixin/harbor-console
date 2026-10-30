package app

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"harbor-console/internal/timefmt"
)

// handleAdministrationControl serves instance configuration and LDAP / OIDC checks.
func (ds *demoState) handleAdministrationControl(w http.ResponseWriter, request demoControlRequest) (handled bool, status int, data any, errStatus int, errMessage string) {
	method, operation, query, body := request.method, request.operation, request.query, request.body
	handled = true
	status = http.StatusOK

	switch operation {
	case "internal-config":
		data = map[string]any{"auth_mode": "oidc_auth", "external_url": "https://harbor.demo.local", "read_only": false}

	case "ping":
		data = map[string]any{"status": "healthy"}

	case "configurations":
		if method == http.MethodGet {
			data = ds.configurations
			break
		}
		for key, value := range body {
			item, ok := ds.configurations[key].(map[string]any)
			if !ok {
				item = map[string]any{"editable": true}
				ds.configurations[key] = item
			}
			item["value"] = value
		}
		data = ds.configurations

	case "system-root-certificate":
		w.Header().Set("Content-Type", "application/octet-stream")
		w.Header().Set("Content-Disposition", `attachment; filename="harbor-ca.crt"`)
		w.Header().Set("X-Content-Type-Options", "nosniff")
		_, _ = w.Write([]byte("-----BEGIN CERTIFICATE-----\nMIIBdemoHarborConsoleRootCertificate\n-----END CERTIFICATE-----\n"))
		return

	case "ldap-ping":
		data = map[string]any{"success": true, "message": "LDAP server connection succeeded"}

	case "ldap-users-search":
		ds.writeList(w, filterMaps(ds.ldapUsers, query.Get("username"), "username"), query)
		return

	case "ldap-users-import":
		uids := body["ldap_uid_list"].([]any)
		for _, rawUID := range uids {
			uid := stringValue(rawUID)
			index, found := findMap(ds.ldapUsers, "username", uid)
			if !found {
				continue
			}
			ds.nextUserID++
			candidate := cloneMap(ds.ldapUsers[index])
			candidate["user_id"] = ds.nextUserID
			candidate["comment"] = "imported from LDAP"
			candidate["sysadmin_flag"] = false
			candidate["creation_time"] = ds.now().UTC().Format(timefmt.Layout)
			ds.users = append(ds.users, candidate)
			ds.ldapUsers = append(ds.ldapUsers[:index], ds.ldapUsers[index+1:]...)
		}
		data = map[string]any{"imported": len(uids)}

	case "ldap-groups-search":
		items := ds.ldapGroups
		if name := query.Get("groupname"); name != "" {
			items = filterMaps(items, name, "group_name")
		} else if dn := query.Get("groupdn"); dn != "" {
			items = filterMaps(items, dn, "ldap_group_dn")
		}
		ds.writeList(w, items, query)
		return

	case "oidc-ping":
		data = map[string]any{"success": true}

	default:
		handled = false
	}
	return
}

// handleRetentionControl serves Tag retention policies and their runs.
func (ds *demoState) handleRetentionControl(w http.ResponseWriter, request demoControlRequest) (handled bool, status int, data any, errStatus int, errMessage string) {
	method, operation, query, body := request.method, request.operation, request.query, request.body
	handled = true
	status = http.StatusOK

	switch operation {
	case "retentions":
		scope, _ := body["scope"].(map[string]any)
		projectIndex, found := findMapNumber(ds.projects, "project_id", fmt.Sprint(numberValue(scope["ref"])))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "project referenced by the retention policy not found"
			break
		}
		metadata, _ := ds.projects[projectIndex]["metadata"].(map[string]any)
		if stringValue(metadata["retention_id"]) != "" {
			errStatus, errMessage = http.StatusConflict, "project already has a retention policy"
			break
		}
		ds.nextRetentionID++
		policy := cloneMap(body)
		policy["id"] = ds.nextRetentionID
		now := ds.now().UTC().Format(timefmt.Layout)
		policy["creation_time"], policy["update_time"] = now, now
		ds.retentions = append(ds.retentions, policy)
		ds.retentionRuns[ds.nextRetentionID] = []map[string]any{}
		metadata["retention_id"] = strconv.FormatInt(ds.nextRetentionID, 10)
		status, data = http.StatusCreated, policy

	case "retention-metadatas":
		data = cloneMap(ds.retentionMetadata)

	case "retention":
		index, found := findMapNumber(ds.retentions, "id", query.Get("id"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "retention policy not found"
			break
		}
		retentionID := parseDemoID(query.Get("id"))
		if method == http.MethodGet {
			data = ds.retentions[index]
		} else if method == http.MethodPut {
			id := ds.retentions[index]["id"]
			creationTime := ds.retentions[index]["creation_time"]
			ds.retentions[index] = cloneMap(body)
			ds.retentions[index]["id"] = id
			ds.retentions[index]["creation_time"] = creationTime
			ds.retentions[index]["update_time"] = ds.now().UTC().Format(timefmt.Layout)
			data = ds.retentions[index]
		} else {
			scope, _ := ds.retentions[index]["scope"].(map[string]any)
			if projectIndex, exists := findMapNumber(ds.projects, "project_id", fmt.Sprint(numberValue(scope["ref"]))); exists {
				metadata, _ := ds.projects[projectIndex]["metadata"].(map[string]any)
				delete(metadata, "retention_id")
			}
			ds.retentions = append(ds.retentions[:index], ds.retentions[index+1:]...)
			delete(ds.retentionRuns, retentionID)
		}

	case "retention-executions":
		retentionID := parseDemoID(query.Get("id"))
		if _, found := findMapNumber(ds.retentions, "id", query.Get("id")); !found {
			errStatus, errMessage = http.StatusNotFound, "retention policy not found"
			break
		}
		if method == http.MethodGet {
			ds.writeList(w, ds.retentionRuns[retentionID], query)
			return
		}
		ds.nextRetentionRunID++
		now := ds.now().UTC().Format(timefmt.Layout)
		run := map[string]any{"id": ds.nextRetentionRunID, "policy_id": retentionID, "status": "Running", "trigger": "Manual", "dry_run": body["dry_run"], "start_time": now}
		ds.retentionRuns[retentionID] = append([]map[string]any{run}, ds.retentionRuns[retentionID]...)
		taskID := ds.nextRetentionRunID + 100
		ds.retentionTasks[ds.nextRetentionRunID] = []map[string]any{{"id": taskID, "execution_id": ds.nextRetentionRunID, "repository": "platform/gateway", "job_id": fmt.Sprintf("retention-job-%d", taskID), "status": "Running", "status_code": 0, "status_revision": 1, "start_time": now, "end_time": "", "total": 28, "retained": 10}}
		ds.retentionLogs[fmt.Sprintf("%d:%d", ds.nextRetentionRunID, taskID)] = fmt.Sprintf("%s [INFO] starting retention for platform/gateway\n%s [INFO] evaluating 28 tags\n", now, now)
		status, data = http.StatusCreated, run

	case "retention-execution":
		retentionID := parseDemoID(query.Get("id"))
		index, found := findMapNumber(ds.retentionRuns[retentionID], "id", query.Get("eid"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "retention execution not found"
			break
		}
		ds.retentionRuns[retentionID][index]["status"] = "Stopped"
		ds.retentionRuns[retentionID][index]["end_time"] = ds.now().UTC().Format(timefmt.Layout)
		executionID := parseDemoID(query.Get("eid"))
		for _, task := range ds.retentionTasks[executionID] {
			if stringValue(task["status"]) == "Running" {
				task["status"] = "Stopped"
				task["end_time"] = ds.retentionRuns[retentionID][index]["end_time"]
			}
		}
		data = ds.retentionRuns[retentionID][index]

	case "retention-tasks":
		executionID := parseDemoID(query.Get("eid"))
		if _, found := findMapNumber(ds.retentionRuns[parseDemoID(query.Get("id"))], "id", query.Get("eid")); !found {
			errStatus, errMessage = http.StatusNotFound, "retention execution not found"
			break
		}
		ds.writeList(w, ds.retentionTasks[executionID], query)
		return

	case "retention-task-log":
		key := query.Get("eid") + ":" + query.Get("tid")
		logText, found := ds.retentionLogs[key]
		if !found {
			errStatus, errMessage = http.StatusNotFound, "retention task log not found"
			break
		}
		data = logText

	default:
		handled = false
	}
	return
}

// handleCleanupControl serves garbage collection and audit log purge jobs.
func (ds *demoState) handleCleanupControl(w http.ResponseWriter, request demoControlRequest) (handled bool, status int, data any, errStatus int, errMessage string) {
	method, operation, query, body := request.method, request.operation, request.query, request.body
	handled = true
	status = http.StatusOK

	switch operation {
	case "gc-history":
		ds.writeList(w, ds.gcHistory, query)
		return

	case "gc-job":
		index, found := findMapNumber(ds.gcHistory, "id", query.Get("id"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "garbage collection job not found"
			break
		}
		if method == http.MethodGet {
			data = ds.gcHistory[index]
		} else {
			ds.gcHistory[index]["job_status"] = "Stopped"
			ds.gcHistory[index]["update_time"] = ds.now().UTC().Format(timefmt.Layout)
			data = ds.gcHistory[index]
		}

	case "gc-log":
		index, found := findMapNumber(ds.gcHistory, "id", query.Get("id"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "garbage collection job not found"
			break
		}
		job := ds.gcHistory[index]
		data = fmt.Sprintf("%s [INFO] initialization completed\n%s [INFO] Garbage Collection parameters: %v\n%s [INFO] mark phase completed\n%s [INFO] sweep phase completed\n%s [INFO] garbage collection job #%v finished with status %v\n",
			stringValue(job["creation_time"]), stringValue(job["creation_time"]), job["job_parameters"], stringValue(job["creation_time"]), stringValue(job["update_time"]), stringValue(job["update_time"]), job["id"], job["job_status"])

	case "gc-schedule":
		if method == http.MethodGet {
			data = ds.gcSchedule
			break
		}
		schedule, _ := body["schedule"].(map[string]any)
		if stringValue(schedule["type"]) == "Manual" {
			ds.nextGCID++
			now := ds.now().UTC().Format(timefmt.Layout)
			parameters, _ := body["parameters"].(map[string]any)
			parameters["purged_blobs"] = 0
			parameters["purged_manifests"] = 0
			parameters["freed_space"] = 0
			jobParameters, _ := json.Marshal(parameters)
			job := map[string]any{"id": ds.nextGCID, "job_name": "GARBAGE_COLLECTION", "job_kind": "GARBAGE_COLLECTION", "job_status": "Success", "deleted": false, "schedule": map[string]any{"type": "Manual"}, "job_parameters": string(jobParameters), "creation_time": now, "update_time": now}
			ds.gcHistory = append([]map[string]any{job}, ds.gcHistory...)
			status, data = http.StatusCreated, job
		} else {
			ds.gcSchedule = cloneMap(body)
			ds.gcSchedule["id"] = 21
			ds.gcSchedule["status"] = "Scheduled"
			if method == http.MethodPost {
				status = http.StatusCreated
			}
			data = ds.gcSchedule
		}

	case "purge-history":
		ds.writeList(w, ds.purgeHistory, query)
		return

	case "purge-job":
		index, found := findMapNumber(ds.purgeHistory, "id", query.Get("id"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "audit log purge job not found"
			break
		}
		if method == http.MethodPut {
			ds.purgeHistory[index]["job_status"] = "Stopped"
			ds.purgeHistory[index]["update_time"] = ds.now().UTC().Format(timefmt.Layout)
		}
		data = ds.purgeHistory[index]

	case "purge-log":
		logText, found := ds.purgeLogs[parseDemoID(query.Get("id"))]
		if !found {
			errStatus, errMessage = http.StatusNotFound, "audit log purge log not found"
			break
		}
		data = logText

	case "purge-schedule":
		if method == http.MethodGet {
			data = ds.purgeSchedule
			break
		}
		schedule, _ := body["schedule"].(map[string]any)
		parameters, _ := body["parameters"].(map[string]any)
		if stringValue(schedule["type"]) == "Manual" {
			ds.nextPurgeID++
			now := ds.now().UTC().Format(timefmt.Layout)
			encodedParameters, _ := json.Marshal(parameters)
			job := map[string]any{"id": ds.nextPurgeID, "job_name": "PURGE_AUDIT", "job_kind": "Manual", "job_parameters": string(encodedParameters), "job_status": "Running", "deleted": false, "creation_time": now, "update_time": now}
			ds.purgeHistory = append([]map[string]any{job}, ds.purgeHistory...)
			ds.purgeLogs[ds.nextPurgeID] = fmt.Sprintf("%s [INFO] starting audit log purge\n%s [INFO] retention threshold: %v hours\n", now, now, parameters["audit_retention_hour"])
			status, data = http.StatusCreated, job
		} else {
			ds.purgeSchedule = cloneMap(body)
			ds.purgeSchedule["id"] = 23
			ds.purgeSchedule["status"] = "Scheduled"
			if method == http.MethodPost {
				status = http.StatusCreated
			}
			data = ds.purgeSchedule
		}

	default:
		handled = false
	}
	return
}

// handleJobserviceControl serves job service pools, workers, queues and schedules.
func (ds *demoState) handleJobserviceControl(w http.ResponseWriter, request demoControlRequest) (handled bool, status int, data any, errStatus int, errMessage string) {
	operation, query, body := request.operation, request.query, request.body
	handled = true
	status = http.StatusOK

	switch operation {
	case "jobservice-pools":
		data = mapsToAny(ds.jobPools)

	case "jobservice-workers":
		poolID := query.Get("pool")
		if poolID == "all" {
			workers := make([]any, 0)
			for _, items := range ds.jobWorkers {
				workers = append(workers, mapsToAny(items)...)
			}
			data = workers
			break
		}
		workers, found := ds.jobWorkers[poolID]
		if !found {
			errStatus, errMessage = http.StatusNotFound, "job service pool not found"
			break
		}
		data = mapsToAny(workers)

	case "jobservice-job":
		jobID := query.Get("job")
		found := false
		for _, workers := range ds.jobWorkers {
			for _, worker := range workers {
				if stringValue(worker["job_id"]) == jobID {
					worker["job_name"], worker["job_id"], worker["check_in"] = "", "", "stopped"
					worker["checkin_at"] = ds.now().UTC().Format(timefmt.Layout)
					found = true
				}
			}
		}
		if !found {
			errStatus, errMessage = http.StatusNotFound, "running job not found"
			break
		}
		data = map[string]any{"stopped": true}

	case "jobservice-job-log":
		logText, found := ds.jobLogs[query.Get("job")]
		if !found {
			errStatus, errMessage = http.StatusNotFound, "job service job log not found"
			break
		}
		data = logText

	case "jobservice-queues":
		data = mapsToAny(ds.jobQueues)

	case "jobservice-queue":
		jobType := query.Get("type")
		action := stringValue(body["action"])
		matched := false
		for _, queue := range ds.jobQueues {
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
			errStatus, errMessage = http.StatusNotFound, "job service queue not found"
			break
		}
		data = map[string]any{"action": action}

	case "jobservice-schedules":
		ds.writeList(w, ds.jobSchedules, query)
		return

	case "jobservice-schedule-status":
		data = map[string]any{"paused": ds.jobSchedulePaused}

	default:
		handled = false
	}
	return
}

// handleSecurityHubControl serves system-wide scanning, vulnerability summaries, the CVE allowlist and CVE exports.
func (ds *demoState) handleSecurityHubControl(w http.ResponseWriter, request demoControlRequest) (handled bool, status int, data any, errStatus int, errMessage string) {
	method, operation, query, body := request.method, request.operation, request.query, request.body
	handled = true
	status = http.StatusOK

	switch operation {
	case "scan-all-metrics":
		data = ds.scanMetrics

	case "scan-all-schedule":
		if method == http.MethodGet {
			data = ds.scanSchedule
			break
		}
		schedule, _ := body["schedule"].(map[string]any)
		if stringValue(schedule["type"]) == "Manual" {
			ds.scanMetrics = map[string]any{"total": 24, "completed": 24, "metrics": map[string]any{"Success": 24}}
			status, data = http.StatusCreated, ds.scanMetrics
		} else {
			ds.scanSchedule = cloneMap(body)
			ds.scanSchedule["id"] = 22
			ds.scanSchedule["status"] = "Scheduled"
			if method == http.MethodPost {
				status = http.StatusCreated
			}
			data = ds.scanSchedule
		}

	case "scan-all-stop":
		ds.scanMetrics = map[string]any{"total": 24, "completed": 24, "metrics": map[string]any{"Stopped": 24}}
		status, data = http.StatusAccepted, ds.scanMetrics

	case "security-summary":
		data = demoSecuritySummary(ds.securityVuls, ds.artifacts)

	case "security-vulnerabilities":
		ds.writeList(w, filterDemoSecurityVulnerabilities(ds.securityVuls, query.Get("q")), query)
		return

	case "system-cve-allowlist":
		if method == http.MethodGet {
			data = ds.systemCVEAllowlist
			break
		}
		created := ds.systemCVEAllowlist["creation_time"]
		ds.systemCVEAllowlist = cloneMap(body)
		ds.systemCVEAllowlist["id"] = 1
		ds.systemCVEAllowlist["project_id"] = 0
		ds.systemCVEAllowlist["creation_time"] = created
		ds.systemCVEAllowlist["update_time"] = ds.now().UTC().Format(timefmt.Layout)
		data = ds.systemCVEAllowlist

	case "cve-export":
		ds.nextCVEExportID++
		now := ds.now().UTC().Format(timefmt.Layout)
		execution := map[string]any{"id": ds.nextCVEExportID, "user_id": 1, "user_name": "demo-admin", "status": "Success", "trigger": "Manual", "start_time": now, "end_time": now, "status_text": "", "file_present": true}
		ds.cveExports = append([]map[string]any{execution}, ds.cveExports...)
		ds.cveExportFiles[ds.nextCVEExportID] = demoCVEExportCSV()
		status, data = http.StatusOK, map[string]any{"id": ds.nextCVEExportID}

	case "cve-export-executions":
		data = map[string]any{"items": mapsToAny(ds.cveExports)}

	case "cve-export-execution":
		index, found := findMapNumber(ds.cveExports, "id", query.Get("id"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "CVE export execution not found"
			break
		}
		data = ds.cveExports[index]

	case "cve-export-download":
		id := parseDemoID(query.Get("id"))
		content, found := ds.cveExportFiles[id]
		if !found {
			errStatus, errMessage = http.StatusNotFound, "CVE export file not found or expired"
			break
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
