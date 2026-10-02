package app

import (
	"net/http"
	"net/url"
	"time"
)

func (state *demoState) handleRegistryControl(
	responseWriter http.ResponseWriter,
	method, operation string,
	query url.Values,
	body map[string]any,
) (handled bool, status int, data any, errStatus int, errMessage string) {
	handled = true
	status = http.StatusOK
	switch operation {
	case "registries":
		if method == http.MethodGet {
			state.writeList(responseWriter, filterMaps(state.registries, query.Get("name"), "name"), query)
			return
		}
		state.nextRegistryID++
		registry := cloneMap(body)
		registry["id"] = state.nextRegistryID
		registry["status"] = "healthy"
		registry["creation_time"] = time.Now().UTC().Format(time.RFC3339)
		if credential, ok := registry["credential"].(map[string]any); ok {
			credential["access_secret"] = ""
		}
		state.registries = append(state.registries, registry)
		status, data = http.StatusCreated, registry

	case "registry-adapters":
		data = []any{"harbor", "docker-hub", "docker-registry", "ali-acr", "aws-ecr", "azure-acr", "google-gcr"}

	case "registry-adapter-infos":
		data = demoRegistryAdapterInfos()

	case "registry-info":
		data = demoRegistryInfo(parseDemoID(query.Get("id")))

	case "registry":
		index, found := findMapNumber(state.registries, "id", query.Get("id"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "远端仓库不存在"
			break
		}
		if method == http.MethodGet {
			data = state.registries[index]
		} else if method == http.MethodPut {
			for key, value := range body {
				state.registries[index][key] = value
			}
			state.registries[index]["update_time"] = time.Now().UTC().Format(time.RFC3339)
			data = state.registries[index]
		} else {
			state.registries = append(state.registries[:index], state.registries[index+1:]...)
		}

	case "registry-ping":
		data = map[string]any{"status": "healthy"}

	default:
		handled = false
	}
	return
}
