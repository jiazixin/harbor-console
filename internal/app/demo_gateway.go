package app

import (
	"net/http"
	"net/url"
)

type demoControlHandler func(
	http.ResponseWriter,
	string,
	string,
	url.Values,
	map[string]any,
) (bool, int, any, int, string)

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

func (state *demoState) handleControl(w http.ResponseWriter, method, operation string, query url.Values, body map[string]any, list bool) {
	state.mu.Lock()
	defer state.mu.Unlock()

	writer := &demoControlResponseWriter{ResponseWriter: w}
	handlers := []demoControlHandler{
		state.handleProjectControl,
		state.handleArtifactControl,
		state.handlePreheatControl,
		state.handleImmutabilityControl,
		state.handleWebhookControl,
		state.handleIdentityControl,
		state.handleQuotaControl,
		state.handleScannerControl,
		state.handleAdministrationControl,
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
