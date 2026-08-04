package app

import (
	"net/http"
	"net/url"
	"time"
)

func (state *demoState) handleWebhookControl(
	w http.ResponseWriter,
	method, operation string,
	query url.Values,
	body map[string]any,
) (handled bool, status int, data any, errStatus int, errMessage string) {
	handled = true
	status = http.StatusOK

	switch operation {
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

	default:
		handled = false
	}
	return
}
