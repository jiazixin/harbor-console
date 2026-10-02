package app

import (
	"fmt"
	"net/http"
	"net/url"
	"time"
)

func (state *demoState) handleReplicationControl(
	w http.ResponseWriter,
	method, operation string,
	query url.Values,
	body map[string]any,
) (handled bool, status int, data any, errStatus int, errMessage string) {
	handled = true
	status = http.StatusOK

	switch operation {
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

	default:
		handled = false
	}
	return
}
