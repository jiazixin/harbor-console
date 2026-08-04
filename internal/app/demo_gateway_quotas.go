package app

import (
	"net/http"
	"net/url"
	"time"
)

func (state *demoState) handleQuotaControl(
	w http.ResponseWriter,
	method, operation string,
	query url.Values,
	body map[string]any,
) (handled bool, status int, data any, errStatus int, errMessage string) {
	handled = true
	status = http.StatusOK

	switch operation {
	case "quotas":
		state.writeList(w, state.quotas, query)
		return

	case "quota":
		index, found := findMapNumber(state.quotas, "id", query.Get("id"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "配额不存在"
			break
		}
		if method == http.MethodGet {
			data = state.quotas[index]
		} else {
			state.quotas[index]["hard"] = cloneMap(body["hard"].(map[string]any))
			state.quotas[index]["update_time"] = time.Now().UTC().Format(time.RFC3339)
			data = state.quotas[index]
		}

	default:
		handled = false
	}
	return
}
