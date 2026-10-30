package app

import (
	"fmt"
	"net/http"

	"harbor-console/internal/timefmt"
)

func (ds *demoState) handleScannerControl(w http.ResponseWriter, request demoControlRequest) (handled bool, status int, data any, errStatus int, errMessage string) {
	method, operation, query, body := request.method, request.operation, request.query, request.body
	handled = true
	status = http.StatusOK

	switch operation {
	case "scanners":
		if method == http.MethodGet {
			ds.writeList(w, filterMaps(ds.scanners, demoQueryString(query.Get("q"), "name"), "name"), query)
			return
		}
		ds.nextScannerID++
		scanner := cloneMap(body)
		scanner["uuid"] = fmt.Sprintf("00000000-0000-4000-8000-%012d", ds.nextScannerID)
		scanner["health"] = "healthy"
		scanner["is_default"] = false
		scanner["create_time"] = ds.now().UTC().Format(timefmt.Layout)
		delete(scanner, "access_credential")
		ds.scanners = append(ds.scanners, scanner)
		status, data = http.StatusCreated, scanner

	case "scanner":
		index, found := findMap(ds.scanners, "uuid", query.Get("id"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "scanner not found"
			break
		}
		if method == http.MethodGet {
			data = ds.scanners[index]
		} else if method == http.MethodPut {
			uuid, isDefault := ds.scanners[index]["uuid"], ds.scanners[index]["is_default"]
			for key, value := range body {
				if key != "access_credential" || stringValue(value) != "" {
					ds.scanners[index][key] = value
				}
			}
			ds.scanners[index]["uuid"], ds.scanners[index]["is_default"] = uuid, isDefault
			ds.scanners[index]["health"] = "healthy"
			ds.scanners[index]["update_time"] = ds.now().UTC().Format(timefmt.Layout)
			data = ds.scanners[index]
		} else if method == http.MethodPatch {
			for itemIndex := range ds.scanners {
				ds.scanners[itemIndex]["is_default"] = itemIndex == index && body["is_default"] == true
			}
			data = ds.scanners[index]
		} else {
			if ds.scanners[index]["is_default"] == true {
				errStatus, errMessage = http.StatusPreconditionFailed, "the default scanner cannot be deleted"
				break
			}
			ds.scanners = append(ds.scanners[:index], ds.scanners[index+1:]...)
		}

	case "scanner-ping":
		data = map[string]any{"health": "healthy"}

	case "scanner-metadata":
		index, found := findMap(ds.scanners, "uuid", query.Get("id"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "scanner not found"
			break
		}
		scanner := ds.scanners[index]
		data = map[string]any{
			"scanner": map[string]any{"name": scanner["name"], "vendor": scanner["vendor"], "version": scanner["version"]},
			"capabilities": []any{
				map[string]any{"type": "vulnerability", "consumes_mime_types": []any{"application/vnd.docker.distribution.manifest.v2+json", "application/vnd.oci.image.manifest.v1+json"}, "produces_mime_types": []any{"application/vnd.scanner.adapter.vuln.report.harbor+json; version=1.1"}},
				map[string]any{"type": "sbom", "consumes_mime_types": []any{"application/vnd.docker.distribution.manifest.v2+json", "application/vnd.oci.image.manifest.v1+json"}, "produces_mime_types": []any{"application/vnd.scanner.adapter.sbom.report.harbor+json; version=1.0"}},
			},
			"properties": map[string]any{
				"harbor.scanner-adapter/scanner-type":                      "os-package-vulnerability",
				"harbor.scanner-adapter/vulnerability-database-updated-at": "2026-07-30T00:00:00.000Z",
			},
		}

	default:
		handled = false
	}
	return
}
