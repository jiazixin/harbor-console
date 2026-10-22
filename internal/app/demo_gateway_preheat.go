package app

import (
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

// handlePreheatControl serves preheat providers and provider instances.
func (state *demoState) handlePreheatControl(
	w http.ResponseWriter,
	method, operation string,
	query url.Values,
	body map[string]any,
) (handled bool, status int, data any, errStatus int, errMessage string) {
	handled = true
	status = http.StatusOK

	switch operation {
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

	default:
		handled = false
	}
	return
}

// handlePreheatPolicyControl serves project preheat policies and their executions.
func (state *demoState) handlePreheatPolicyControl(
	w http.ResponseWriter,
	method, operation string,
	query url.Values,
	body map[string]any,
) (handled bool, status int, data any, errStatus int, errMessage string) {
	handled = true
	status = http.StatusOK

	switch operation {
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

	default:
		handled = false
	}
	return
}
