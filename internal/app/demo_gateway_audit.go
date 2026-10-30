package app

import (
	"net/http"
	"strings"
)

func (ds *demoState) handleAuditControl(responseWriter http.ResponseWriter, request demoControlRequest) (handled bool, status int, data any, errStatus int, errMessage string) {
	operation, query := request.operation, request.query
	handled = true
	status = http.StatusOK
	switch operation {
	case "audit-logs":
		entries := filterDemoAuditEntries(mapsFromAny(demoAuditLogs()), query.Get("q"))
		if filterQuery := query.Get("q"); filterQuery != "" {
			entries = filterDemoAuditTimeRange(entries, filterQuery)
		}
		ds.writeList(responseWriter, entries, query)
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

	case "project-audit-logs":
		entries := mapsFromAny(demoAuditLogs())
		if project := strings.TrimSpace(query.Get("project")); project != "" {
			entries = filterMaps(entries, project+"/", "resource")
		}
		entries = filterDemoAuditEntries(entries, query.Get("q"))
		ds.writeList(responseWriter, entries, query)
		return

	default:
		handled = false
	}
	return
}

func filterDemoAuditEntries(entries []map[string]any, filterQuery string) []map[string]any {
	if filterQuery == "" {
		return entries
	}
	for _, field := range []string{"username", "resource", "operation"} {
		if filterValue := demoQueryString(filterQuery, field); filterValue != "" {
			entries = filterMaps(entries, filterValue, field)
		}
	}
	resultFilter := demoQueryString(filterQuery, "op_result")
	if resultFilter == "" {
		return entries
	}
	expectedResult := resultFilter == "true"
	filteredEntries := make([]map[string]any, 0, len(entries))
	for _, entry := range entries {
		if entry["operation_result"] == expectedResult {
			filteredEntries = append(filteredEntries, entry)
		}
	}
	return filteredEntries
}
