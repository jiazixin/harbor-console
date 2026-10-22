package app

import (
	"net/http"
	"net/url"
)

// demoControlHandler answers the demo operations of one domain. It reports
// handled=false for operations it does not own; otherwise it returns either a
// success status with data or an error status and message, unless it already
// wrote the response itself (for example a paginated list).
type demoControlHandler func(
	w http.ResponseWriter,
	method, operation string,
	query url.Values,
	body map[string]any,
) (handled bool, status int, data any, errStatus int, errMessage string)

type demoControlResponseWriter struct {
	http.ResponseWriter
	wrote bool
}

func (writer *demoControlResponseWriter) WriteHeader(status int) {
	writer.wrote = true
	writer.ResponseWriter.WriteHeader(status)
}

func (writer *demoControlResponseWriter) Write(body []byte) (int, error) {
	writer.wrote = true
	return writer.ResponseWriter.Write(body)
}

func (state *demoState) handleControl(w http.ResponseWriter, method, operation string, query url.Values, body map[string]any) {
	state.mu.Lock()
	defer state.mu.Unlock()

	writer := &demoControlResponseWriter{ResponseWriter: w}
	handlers := []demoControlHandler{
		state.handleProjectControl,
		state.handleProjectSettingsControl,
		state.handleProjectMemberControl,
		state.handleRepositoryControl,
		state.handleArtifactControl,
		state.handleArtifactReferenceControl,
		state.handleArtifactScanControl,
		state.handleRobotControl,
		state.handleLabelControl,
		state.handlePreheatControl,
		state.handlePreheatPolicyControl,
		state.handleImmutabilityControl,
		state.handleWebhookControl,
		state.handleIdentityControl,
		state.handleUserControl,
		state.handleUserGroupControl,
		state.handleQuotaControl,
		state.handleScannerControl,
		state.handleAdministrationControl,
		state.handleRetentionControl,
		state.handleCleanupControl,
		state.handleJobserviceControl,
		state.handleSecurityHubControl,
		state.handleReplicationControl,
		state.handleRegistryControl,
		state.handleAuditControl,
	}
	for _, handler := range handlers {
		handled, status, data, errStatus, errMessage := handler(writer, method, operation, query, body)
		if !handled {
			continue
		}
		if writer.wrote {
			return
		}
		if errStatus != 0 {
			writeError(w, errStatus, "Harbor 请求失败", errMessage)
			return
		}
		payload := map[string]any{"ok": true}
		if data != nil {
			payload["data"] = cloneDemoValue(data)
		}
		writeJSON(w, status, payload)
		return
	}

	writeError(w, http.StatusNotFound, "Harbor 请求失败", "演示模式不支持该操作")
}
