package app

import (
	"net/http"
	"time"

	"harbor-console/internal/buildinfo"
)

func (a *app) handleHealth(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.Header().Set("Allow", http.MethodGet)
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"status": "error", "error": "method_not_allowed"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"status":         "ok",
		"service":        "harbor-console",
		"uptime_seconds": max(int64(0), int64(time.Since(a.startedAt)/time.Second)),
	})
}

func (a *app) handleAbout(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"console": map[string]any{
			"name": "Harbor Console", "version": buildinfo.Version, "commit": buildinfo.Commit,
			"build_date": buildinfo.BuildDate, "deployment": "single-binary", "offline": true,
		},
		"harbor": map[string]any{
			"target_version": "v2.15.2", "api_version": "v2.0",
			"license": map[string]string{"name": "Apache License 2.0", "spdx": "Apache-2.0"},
		},
		"public_catalog": []map[string]any{
			{"id": "public-projects", "method": http.MethodGet, "path": "/api/v2.0/projects", "anonymous": true},
			{"id": "public-repositories", "method": http.MethodGet, "path": "/api/v2.0/projects/{project}/repositories", "anonymous": true},
			{"id": "public-artifacts", "method": http.MethodGet, "path": "/api/v2.0/projects/{project}/repositories/{repository}/artifacts", "anonymous": true},
		},
	})
}
