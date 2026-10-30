package app

import (
	"encoding/json"
	"net/http"
	"net/url"
)

// demoControlHandler answers the demo operations of one domain. It reports
// handled=false for operations it does not own; otherwise it returns either a
// success status with data or an error status and message, unless it already
// wrote the response itself (for example a paginated list).
type demoControlRequest struct {
	method    string
	operation string
	query     url.Values
	body      map[string]any
}

type demoControlHandler func(w http.ResponseWriter, request demoControlRequest) (handled bool, status int, data any, errStatus int, errMessage string)

type demoControlResponseWriter struct {
	http.ResponseWriter
	wrote bool
}

func (w *demoControlResponseWriter) WriteHeader(status int) {
	w.wrote = true
	w.ResponseWriter.WriteHeader(status)
}

func (w *demoControlResponseWriter) Write(body []byte) (int, error) {
	w.wrote = true
	return w.ResponseWriter.Write(body)
}

func (ds *demoState) handleControl(w http.ResponseWriter, r *http.Request, request demoControlRequest) {
	ds.mu.Lock()
	defer ds.mu.Unlock()

	if request.method != http.MethodGet {
		// Demo edits are isolated and bounded; reconnecting starts a new fixture.
		const maxDemoMutations = 256
		const maxDemoMutationBytes = 8 << 20
		encoded, err := json.Marshal(request.body)
		if err != nil {
			writeError(w, r, err)
			return
		}
		if ds.mutationCount >= maxDemoMutations || ds.mutationBytes+len(encoded) > maxDemoMutationBytes {
			writeError(w, r, failure(http.StatusServiceUnavailable, "demo_capacity", "demo mutation budget exhausted"))
			return
		}
		ds.mutationCount++
		ds.mutationBytes += len(encoded)
	}
	writer := &demoControlResponseWriter{ResponseWriter: w}
	handlers := []demoControlHandler{
		ds.handleProjectControl,
		ds.handleProjectSettingsControl,
		ds.handleProjectMemberControl,
		ds.handleRepositoryControl,
		ds.handleArtifactControl,
		ds.handleArtifactReferenceControl,
		ds.handleArtifactScanControl,
		ds.handleRobotControl,
		ds.handleLabelControl,
		ds.handlePreheatControl,
		ds.handlePreheatPolicyControl,
		ds.handleImmutabilityControl,
		ds.handleWebhookControl,
		ds.handleIdentityControl,
		ds.handleUserControl,
		ds.handleUserGroupControl,
		ds.handleQuotaControl,
		ds.handleScannerControl,
		ds.handleAdministrationControl,
		ds.handleRetentionControl,
		ds.handleCleanupControl,
		ds.handleJobserviceControl,
		ds.handleSecurityHubControl,
		ds.handleReplicationControl,
		ds.handleRegistryControl,
		ds.handleAuditControl,
	}
	for _, handler := range handlers {
		handled, status, data, errStatus, _ := handler(writer, request)
		if !handled {
			continue
		}
		if writer.wrote {
			return
		}
		if errStatus != 0 {
			writeError(w, r, harborStatusFailure(errStatus))
			return
		}
		if data == nil {
			if status == http.StatusOK {
				status = http.StatusNoContent
			}
			w.WriteHeader(status)
			return
		}
		writeJSON(w, status, cloneDemoValue(data))
		return
	}

	writeError(w, r, failure(http.StatusNotFound, "demo_unsupported", "operation not supported in demo mode"))
}
