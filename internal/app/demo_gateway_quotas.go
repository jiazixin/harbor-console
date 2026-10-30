package app

import (
	"net/http"

	"harbor-console/internal/timefmt"
)

func (ds *demoState) handleQuotaControl(w http.ResponseWriter, request demoControlRequest) (handled bool, status int, data any, errStatus int, errMessage string) {
	method, operation, query, body := request.method, request.operation, request.query, request.body
	handled = true
	status = http.StatusOK

	switch operation {
	case "quotas":
		ds.writeList(w, ds.quotas, query)
		return

	case "quota":
		index, found := findMapNumber(ds.quotas, "id", query.Get("id"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "quota not found"
			break
		}
		if method == http.MethodGet {
			data = ds.quotas[index]
		} else {
			ds.quotas[index]["hard"] = cloneMap(body["hard"].(map[string]any))
			ds.quotas[index]["update_time"] = ds.now().UTC().Format(timefmt.Layout)
			data = ds.quotas[index]
		}

	default:
		handled = false
	}
	return
}
