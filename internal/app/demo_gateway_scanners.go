package app

import (
	"fmt"
	"net/http"
	"net/url"
	"time"
)

func (state *demoState) handleScannerControl(
	w http.ResponseWriter,
	method, operation string,
	query url.Values,
	body map[string]any,
) (handled bool, status int, data any, errStatus int, errMessage string) {
	handled = true
	status = http.StatusOK

	switch operation {
	case "scanners":
		if method == http.MethodGet {
			state.writeList(w, filterMaps(state.scanners, demoQueryString(query.Get("q"), "name"), "name"), query)
			return
		}
		state.nextScannerID++
		scanner := cloneMap(body)
		scanner["uuid"] = fmt.Sprintf("00000000-0000-4000-8000-%012d", state.nextScannerID)
		scanner["health"] = "healthy"
		scanner["is_default"] = false
		scanner["create_time"] = time.Now().UTC().Format(time.RFC3339)
		delete(scanner, "access_credential")
		state.scanners = append(state.scanners, scanner)
		status, data = http.StatusCreated, scanner

	case "scanner":
		index, found := findMap(state.scanners, "uuid", query.Get("id"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "扫描器不存在"
			break
		}
		if method == http.MethodGet {
			data = state.scanners[index]
		} else if method == http.MethodPut {
			uuid, isDefault := state.scanners[index]["uuid"], state.scanners[index]["is_default"]
			for key, value := range body {
				if key != "access_credential" || stringValue(value) != "" {
					state.scanners[index][key] = value
				}
			}
			state.scanners[index]["uuid"], state.scanners[index]["is_default"] = uuid, isDefault
			state.scanners[index]["health"] = "healthy"
			state.scanners[index]["update_time"] = time.Now().UTC().Format(time.RFC3339)
			data = state.scanners[index]
		} else if method == http.MethodPatch {
			for itemIndex := range state.scanners {
				state.scanners[itemIndex]["is_default"] = itemIndex == index && body["is_default"] == true
			}
			data = state.scanners[index]
		} else {
			if state.scanners[index]["is_default"] == true {
				errStatus, errMessage = http.StatusPreconditionFailed, "默认扫描器不能直接删除"
				break
			}
			state.scanners = append(state.scanners[:index], state.scanners[index+1:]...)
		}

	case "scanner-ping":
		data = map[string]any{"health": "healthy"}

	case "scanner-metadata":
		index, found := findMap(state.scanners, "uuid", query.Get("id"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "扫描器不存在"
			break
		}
		scanner := state.scanners[index]
		data = map[string]any{
			"scanner": map[string]any{"name": scanner["name"], "vendor": scanner["vendor"], "version": scanner["version"]},
			"capabilities": []any{
				map[string]any{"type": "vulnerability", "consumes_mime_types": []any{"application/vnd.docker.distribution.manifest.v2+json", "application/vnd.oci.image.manifest.v1+json"}, "produces_mime_types": []any{"application/vnd.scanner.adapter.vuln.report.harbor+json; version=1.1"}},
				map[string]any{"type": "sbom", "consumes_mime_types": []any{"application/vnd.docker.distribution.manifest.v2+json", "application/vnd.oci.image.manifest.v1+json"}, "produces_mime_types": []any{"application/vnd.scanner.adapter.sbom.report.harbor+json; version=1.0"}},
			},
			"properties": map[string]any{
				"harbor.scanner-adapter/scanner-type":                      "os-package-vulnerability",
				"harbor.scanner-adapter/vulnerability-database-updated-at": "2026-07-30T00:00:00Z",
			},
		}

	default:
		handled = false
	}
	return
}
