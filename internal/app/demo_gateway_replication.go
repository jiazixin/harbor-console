package app

import (
	"fmt"
	"net/http"
	"time"

	"harbor-console/internal/timefmt"
)

func (ds *demoState) handleReplicationControl(w http.ResponseWriter, request demoControlRequest) (handled bool, status int, data any, errStatus int, errMessage string) {
	method, operation, query, body := request.method, request.operation, request.query, request.body
	handled = true
	status = http.StatusOK

	switch operation {
	case "replication-policies":
		if method == http.MethodGet {
			ds.writeList(w, filterMaps(ds.policies, query.Get("name"), "name"), query)
			return
		}
		ds.nextPolicyID++
		policy := cloneMap(body)
		ds.expandDemoPolicyRegistries(policy)
		policy["id"] = ds.nextPolicyID
		now := ds.now().UTC().Format(timefmt.Layout)
		policy["creation_time"], policy["update_time"] = now, now
		ds.policies = append(ds.policies, policy)
		status, data = http.StatusCreated, policy

	case "replication-policy":
		index, found := findMapNumber(ds.policies, "id", query.Get("id"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "replication policy not found"
			break
		}
		if method == http.MethodGet {
			data = ds.policies[index]
		} else if method == http.MethodPut {
			id := ds.policies[index]["id"]
			ds.policies[index] = cloneMap(body)
			ds.expandDemoPolicyRegistries(ds.policies[index])
			ds.policies[index]["id"] = id
			ds.policies[index]["update_time"] = ds.now().UTC().Format(timefmt.Layout)
			data = ds.policies[index]
		} else {
			ds.policies = append(ds.policies[:index], ds.policies[index+1:]...)
		}

	case "replication-executions":
		if method == http.MethodGet {
			items := ds.executions
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
			ds.writeList(w, items, query)
			return
		}
		ds.nextExecution++
		now := ds.now().UTC()
		execution := map[string]any{"id": ds.nextExecution, "policy_id": numberValue(body["policy_id"]), "status": "Succeed", "trigger": "manual", "start_time": now.Format(timefmt.Layout), "end_time": now.Add(2 * time.Second).Format(timefmt.Layout), "total": 1, "succeed": 1, "failed": 0, "in_progress": 0, "stopped": 0}
		ds.executions = append([]map[string]any{execution}, ds.executions...)
		taskID := ds.nextExecution + 1000
		ds.replicationTasks[ds.nextExecution] = []map[string]any{{"id": taskID, "execution_id": ds.nextExecution, "status": "Succeed", "job_id": fmt.Sprintf("demo-job-%d", taskID), "operation": "copy", "resource_type": "image", "src_resource": "platform/gateway:latest", "dst_resource": "registry.demo.local/platform/gateway:latest", "start_time": now.Format(timefmt.Layout), "end_time": now.Add(2 * time.Second).Format(timefmt.Layout)}}
		ds.replicationLogs[fmt.Sprintf("%d:%d", ds.nextExecution, taskID)] = fmt.Sprintf("%s [INFO] replicating platform/gateway:latest\n%s [INFO] replication task completed\n", now.Format(timefmt.Layout), now.Add(2*time.Second).Format(timefmt.Layout))
		status, data = http.StatusCreated, execution

	case "replication-execution":
		index, found := findMapNumber(ds.executions, "id", query.Get("id"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "replication execution not found"
			break
		}
		if method == http.MethodGet {
			data = ds.executions[index]
		} else {
			ds.executions[index]["status"] = "Stopped"
			ds.executions[index]["stopped"] = numberValue(ds.executions[index]["in_progress"])
			ds.executions[index]["in_progress"] = 0
			ds.executions[index]["end_time"] = ds.now().UTC().Format(timefmt.Layout)
			executionID := parseDemoID(query.Get("id"))
			for _, task := range ds.replicationTasks[executionID] {
				if stringValue(task["status"]) == "InProgress" {
					task["status"] = "Stopped"
					task["end_time"] = ds.executions[index]["end_time"]
				}
			}
			data = ds.executions[index]
		}

	case "replication-tasks":
		executionID := parseDemoID(query.Get("id"))
		if _, found := findMapNumber(ds.executions, "id", query.Get("id")); !found {
			errStatus, errMessage = http.StatusNotFound, "replication execution not found"
			break
		}
		ds.writeList(w, ds.replicationTasks[executionID], query)
		return

	case "replication-task-log":
		key := query.Get("id") + ":" + query.Get("task")
		logText, found := ds.replicationLogs[key]
		if !found {
			errStatus, errMessage = http.StatusNotFound, "replication task log not found"
			break
		}
		data = logText

	default:
		handled = false
	}
	return
}
