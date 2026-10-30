package app

import (
	"cmp"
	"net/http"
	"time"

	"harbor-console/internal/timefmt"
)

// healthPath is the unauthenticated health check (代码规范.md §5.1).
const healthPath = "/healthz"

func (a *app) handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (a *app) handleInfo(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"version":      a.version(),
		"capabilities": []string{"demo", "multiple_instances", "public_catalog"},
		"console":      a.consoleMetadata(),
		"harbor": map[string]any{
			"target_version": "v2.15.x", "api_version": "v2.0",
			"license": map[string]string{"name": "Apache License 2.0", "spdx": "Apache-2.0"},
		},
		"public_catalog": []map[string]any{
			{"id": "public-projects", "method": http.MethodGet, "path": "/api/v2.0/projects", "anonymous": true},
			{"id": "public-repositories", "method": http.MethodGet, "path": "/api/v2.0/projects/{project}/repositories", "anonymous": true},
			{"id": "public-artifacts", "method": http.MethodGet, "path": "/api/v2.0/projects/{project}/repositories/{repository}/artifacts", "anonymous": true},
		},
	})
}

// version reports the console version for the API and outbound requests.
func (a *app) version() string {
	return cmp.Or(a.build.Version, "dev")
}

func (a *app) consoleMetadata() map[string]any {
	metadata := map[string]any{
		"name": "Harbor Console", "version": a.version(), "commit": cmp.Or(a.build.Revision, "unknown"),
		"deployment": "single-binary", "offline": true,
	}
	// Builds without VCS information have no date; omit unavailable metadata
	// instead of emitting a placeholder that violates the timestamp contract.
	if date, err := time.Parse(time.RFC3339, a.build.Time); err == nil {
		metadata["build_date"] = timefmt.Time(date)
	}
	return metadata
}
