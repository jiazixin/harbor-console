package app

import (
	"net/http"

	"harbor-console/internal/timefmt"
)

func (ds *demoState) handleRegistryControl(responseWriter http.ResponseWriter, request demoControlRequest) (handled bool, status int, data any, errStatus int, errMessage string) {
	method, operation, query, body := request.method, request.operation, request.query, request.body
	handled = true
	status = http.StatusOK
	switch operation {
	case "registries":
		if method == http.MethodGet {
			ds.writeList(responseWriter, filterMaps(ds.registries, query.Get("name"), "name"), query)
			return
		}
		ds.nextRegistryID++
		registry := cloneMap(body)
		registry["id"] = ds.nextRegistryID
		registry["status"] = "healthy"
		registry["creation_time"] = ds.now().UTC().Format(timefmt.Layout)
		if credential, ok := registry["credential"].(map[string]any); ok {
			credential["access_secret"] = ""
		}
		ds.registries = append(ds.registries, registry)
		status, data = http.StatusCreated, registry

	case "registry-adapters":
		data = []any{"harbor", "docker-hub", "docker-registry", "ali-acr", "aws-ecr", "azure-acr", "google-gcr"}

	case "registry-adapter-infos":
		data = demoRegistryAdapterInfos()

	case "registry-info":
		data = demoRegistryInfo(parseDemoID(query.Get("id")))

	case "registry":
		index, found := findMapNumber(ds.registries, "id", query.Get("id"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "registry not found"
			break
		}
		if method == http.MethodGet {
			data = ds.registries[index]
		} else if method == http.MethodPut {
			for key, value := range body {
				ds.registries[index][key] = value
			}
			ds.registries[index]["update_time"] = ds.now().UTC().Format(timefmt.Layout)
			data = ds.registries[index]
		} else {
			ds.registries = append(ds.registries[:index], ds.registries[index+1:]...)
		}

	case "registry-ping":
		data = map[string]any{"status": "healthy"}

	default:
		handled = false
	}
	return
}
