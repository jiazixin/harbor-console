package app

import (
	"net/http"

	"harbor-console/internal/timefmt"
)

func (ds *demoState) handleWebhookControl(w http.ResponseWriter, request demoControlRequest) (handled bool, status int, data any, errStatus int, errMessage string) {
	method, operation, query, body := request.method, request.operation, request.query, request.body
	handled = true
	status = http.StatusOK

	switch operation {
	case "webhooks":
		projectName := query.Get("project")
		if method == http.MethodGet {
			ds.writeList(w, ds.webhooks[projectName], query)
			return
		}
		ds.nextWebhookID++
		webhook := cloneMap(body)
		webhook["id"] = ds.nextWebhookID
		webhook["project_id"] = projectID(ds.projects, projectName)
		webhook["creation_time"] = ds.now().UTC().Format(timefmt.Layout)
		ds.webhooks[projectName] = append(ds.webhooks[projectName], webhook)
		status, data = http.StatusCreated, webhook

	case "webhook":
		projectName := query.Get("project")
		index, found := findMapNumber(ds.webhooks[projectName], "id", query.Get("id"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "webhook not found"
			break
		}
		if method == http.MethodGet {
			data = ds.webhooks[projectName][index]
		} else if method == http.MethodPut {
			id, projectID := ds.webhooks[projectName][index]["id"], ds.webhooks[projectName][index]["project_id"]
			ds.webhooks[projectName][index] = cloneMap(body)
			ds.webhooks[projectName][index]["id"], ds.webhooks[projectName][index]["project_id"] = id, projectID
			ds.webhooks[projectName][index]["update_time"] = ds.now().UTC().Format(timefmt.Layout)
			data = ds.webhooks[projectName][index]
		} else {
			ds.webhooks[projectName] = append(ds.webhooks[projectName][:index], ds.webhooks[projectName][index+1:]...)
		}

	case "webhook-events":
		data = map[string]any{"event_type": []any{"PUSH_ARTIFACT", "PULL_ARTIFACT", "DELETE_ARTIFACT", "SCANNING_COMPLETED", "SCANNING_FAILED", "QUOTA_EXCEED", "TAG_RETENTION"}, "notify_type": []any{"http"}, "payload_formats": []any{map[string]any{"notify_type": "http", "formats": []any{"Default", "CloudEvents"}}}}

	case "webhook-executions":
		projectName := query.Get("project")
		if _, found := findMapNumber(ds.webhooks[projectName], "id", query.Get("id")); !found {
			errStatus, errMessage = http.StatusNotFound, "webhook policy not found"
			break
		}
		executions := ds.webhookExecutions[parseDemoID(query.Get("id"))]
		executions = filterMaps(executions, demoQueryString(query.Get("q"), "status"), "status")
		ds.writeList(w, executions, query)
		return

	case "webhook-tasks":
		executionID := parseDemoID(query.Get("execution"))
		if _, found := findMapNumber(ds.webhookExecutions[parseDemoID(query.Get("id"))], "id", query.Get("execution")); !found {
			errStatus, errMessage = http.StatusNotFound, "webhook execution not found"
			break
		}
		ds.writeList(w, ds.webhookTasks[executionID], query)
		return

	case "webhook-task-log":
		key := query.Get("execution") + ":" + query.Get("task")
		logText, found := ds.webhookLogs[key]
		if !found {
			errStatus, errMessage = http.StatusNotFound, "webhook task log not found"
			break
		}
		data = logText

	default:
		handled = false
	}
	return
}
