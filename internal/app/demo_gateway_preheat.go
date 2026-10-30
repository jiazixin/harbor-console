package app

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"harbor-console/internal/timefmt"
)

// handlePreheatControl serves preheat providers and provider instances.
func (ds *demoState) handlePreheatControl(w http.ResponseWriter, request demoControlRequest) (handled bool, status int, data any, errStatus int, errMessage string) {
	method, operation, query, body := request.method, request.operation, request.query, request.body
	handled = true
	status = http.StatusOK

	switch operation {
	case "preheat-providers":
		data = cloneMaps(ds.preheatProviders)

	case "preheat-instances":
		if method == http.MethodGet {
			items := ds.preheatInstances
			if name := demoQueryString(query.Get("q"), "name"); name != "" {
				items = filterMaps(items, name, "name")
			}
			if endpoint := demoQueryString(query.Get("q"), "endpoint"); endpoint != "" {
				items = filterMaps(items, endpoint, "endpoint")
			}
			ds.writeList(w, items, query)
			return
		}
		name := stringValue(body["name"])
		if _, found := findMap(ds.preheatInstances, "name", name); found {
			errStatus, errMessage = http.StatusConflict, "P2P instance name already exists"
			break
		}
		for _, instance := range ds.preheatInstances {
			if stringValue(instance["endpoint"]) == stringValue(body["endpoint"]) {
				errStatus, errMessage = http.StatusConflict, "P2P instance endpoint already registered"
				break
			}
		}
		if errStatus != 0 {
			break
		}
		ds.nextPreheatID++
		instance := cloneMap(body)
		instance["id"] = ds.nextPreheatID
		instance["status"] = "Healthy"
		instance["default"] = len(ds.preheatInstances) == 0
		instance["setup_timestamp"] = ds.now().Unix()
		if authInfo, ok := instance["auth_info"].(map[string]any); ok {
			for key := range authInfo {
				authInfo[key] = ""
			}
		}
		ds.preheatInstances = append(ds.preheatInstances, instance)
		status, data = http.StatusCreated, instance

	case "preheat-instance":
		index, found := findMap(ds.preheatInstances, "name", query.Get("name"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "P2P instance not found"
			break
		}
		if method == http.MethodGet {
			data = ds.preheatInstances[index]
		} else if method == http.MethodPut {
			id := ds.preheatInstances[index]["id"]
			setup := ds.preheatInstances[index]["setup_timestamp"]
			currentAuth := ds.preheatInstances[index]["auth_info"]
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
			ds.preheatInstances[index] = next
			data = next
		} else {
			instanceID := numberValue(ds.preheatInstances[index]["id"])
			for _, policies := range ds.preheatPolicies {
				for _, policy := range policies {
					if numberValue(policy["provider_id"]) == instanceID {
						errStatus, errMessage = http.StatusConflict, "P2P instance is still used by a preheat policy"
						break
					}
				}
			}
			if errStatus == 0 {
				ds.preheatInstances = append(ds.preheatInstances[:index], ds.preheatInstances[index+1:]...)
			}
		}

	case "preheat-instance-ping":
		if id := numberValue(body["id"]); id > 0 {
			if _, found := findMapNumber(ds.preheatInstances, "id", strconv.FormatInt(id, 10)); !found {
				errStatus, errMessage = http.StatusNotFound, "P2P instance not found"
			}
		} else if strings.Contains(strings.ToLower(stringValue(body["endpoint"])), "down") {
			errStatus, errMessage = http.StatusServiceUnavailable, "cannot connect to the P2P provider"
		}

	case "project-preheat-providers":
		providers := make([]any, 0)
		for _, instance := range ds.preheatInstances {
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
func (ds *demoState) handlePreheatPolicyControl(w http.ResponseWriter, request demoControlRequest) (handled bool, status int, data any, errStatus int, errMessage string) {
	method, operation, query, body := request.method, request.operation, request.query, request.body
	handled = true
	status = http.StatusOK

	switch operation {
	case "preheat-policies":
		projectName := query.Get("project")
		if method == http.MethodGet {
			items := ds.preheatPolicies[projectName]
			if name := demoQueryString(query.Get("q"), "name"); name != "" {
				items = filterMaps(items, name, "name")
			}
			ds.writeList(w, items, query)
			return
		}
		name := stringValue(body["name"])
		if _, found := findMap(ds.preheatPolicies[projectName], "name", name); found {
			errStatus, errMessage = http.StatusConflict, "preheat policy name already exists"
			break
		}
		ds.nextPreheatPolicy++
		policy := cloneMap(body)
		policy["id"] = ds.nextPreheatPolicy
		policy["project_id"] = projectID(ds.projects, projectName)
		now := ds.now().UTC().Format(timefmt.Layout)
		policy["creation_time"], policy["update_time"] = now, now
		ds.preheatPolicies[projectName] = append(ds.preheatPolicies[projectName], policy)
		ds.preheatExecutions[projectName+"/"+name] = []map[string]any{}
		status, data = http.StatusCreated, policy

	case "preheat-policy":
		projectName, originalName := query.Get("project"), query.Get("name")
		index, found := findMap(ds.preheatPolicies[projectName], "name", originalName)
		if !found {
			errStatus, errMessage = http.StatusNotFound, "preheat policy not found"
			break
		}
		if method == http.MethodGet {
			data = ds.preheatPolicies[projectName][index]
		} else if method == http.MethodPut {
			id := ds.preheatPolicies[projectName][index]["id"]
			projectIDValue := ds.preheatPolicies[projectName][index]["project_id"]
			created := ds.preheatPolicies[projectName][index]["creation_time"]
			policy := cloneMap(body)
			policy["id"], policy["project_id"], policy["creation_time"] = id, projectIDValue, created
			policy["update_time"] = ds.now().UTC().Format(timefmt.Layout)
			ds.preheatPolicies[projectName][index] = policy
			newName := stringValue(policy["name"])
			if newName != originalName {
				ds.preheatExecutions[projectName+"/"+newName] = ds.preheatExecutions[projectName+"/"+originalName]
				delete(ds.preheatExecutions, projectName+"/"+originalName)
			}
			data = policy
		} else if method == http.MethodPost {
			ds.nextPreheatRun++
			ds.nextPreheatTask++
			now := ds.now().UTC().Format(timefmt.Layout)
			execution := map[string]any{"id": ds.nextPreheatRun, "vendor_type": "PREHEAT", "vendor_id": ds.preheatPolicies[projectName][index]["id"], "status": "Running", "status_message": "", "metrics": map[string]any{"task_count": 1, "success_task_count": 0, "error_task_count": 0, "pending_task_count": 0, "running_task_count": 1, "scheduled_task_count": 0, "stopped_task_count": 0}, "trigger": "Manual", "extra_attrs": map[string]any{}, "start_time": now, "end_time": ""}
			key := projectName + "/" + originalName
			ds.preheatExecutions[key] = append([]map[string]any{execution}, ds.preheatExecutions[key]...)
			task := map[string]any{"id": ds.nextPreheatTask, "execution_id": ds.nextPreheatRun, "status": "Running", "status_message": "", "run_count": 1, "extra_attrs": map[string]any{"artifact": projectName + "/gateway:latest", "digest": "sha256:demo", "kind": "IMAGE"}, "creation_time": now, "update_time": now, "start_time": now, "end_time": ""}
			ds.preheatTasks[ds.nextPreheatRun] = []map[string]any{task}
			ds.preheatLogs[fmt.Sprintf("%d:%d", ds.nextPreheatRun, ds.nextPreheatTask)] = now + " [INFO] P2P preheat task submitted\n"
			status, data = http.StatusCreated, execution
		} else {
			ds.preheatPolicies[projectName] = append(ds.preheatPolicies[projectName][:index], ds.preheatPolicies[projectName][index+1:]...)
			delete(ds.preheatExecutions, projectName+"/"+originalName)
		}

	case "preheat-executions":
		key := query.Get("project") + "/" + query.Get("name")
		if _, found := findMap(ds.preheatPolicies[query.Get("project")], "name", query.Get("name")); !found {
			errStatus, errMessage = http.StatusNotFound, "preheat policy not found"
			break
		}
		ds.writeList(w, ds.preheatExecutions[key], query)
		return

	case "preheat-execution":
		key := query.Get("project") + "/" + query.Get("name")
		index, found := findMapNumber(ds.preheatExecutions[key], "id", query.Get("id"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "preheat execution not found"
			break
		}
		if method == http.MethodGet {
			data = ds.preheatExecutions[key][index]
		} else {
			execution := ds.preheatExecutions[key][index]
			execution["status"] = "Stopped"
			execution["end_time"] = ds.now().UTC().Format(timefmt.Layout)
			metrics, _ := execution["metrics"].(map[string]any)
			metrics["running_task_count"], metrics["stopped_task_count"] = 0, metrics["task_count"]
			executionID := parseDemoID(query.Get("id"))
			for taskIndex := range ds.preheatTasks[executionID] {
				ds.preheatTasks[executionID][taskIndex]["status"] = "Stopped"
				ds.preheatTasks[executionID][taskIndex]["end_time"] = execution["end_time"]
			}
			data = execution
		}

	case "preheat-tasks":
		executionID := parseDemoID(query.Get("id"))
		ds.writeList(w, ds.preheatTasks[executionID], query)
		return

	case "preheat-task-log":
		logText, found := ds.preheatLogs[query.Get("id")+":"+query.Get("task")]
		if !found {
			errStatus, errMessage = http.StatusNotFound, "preheat task log not found"
			break
		}
		data = logText

	default:
		handled = false
	}
	return
}
