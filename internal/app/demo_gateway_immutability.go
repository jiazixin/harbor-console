package app

import (
	"net/http"
)

func (ds *demoState) handleImmutabilityControl(w http.ResponseWriter, request demoControlRequest) (handled bool, status int, data any, errStatus int, errMessage string) {
	method, operation, query, body := request.method, request.operation, request.query, request.body
	handled = true
	status = http.StatusOK

	switch operation {
	case "immutable-rules":
		projectName := query.Get("project")
		if method == http.MethodGet {
			ds.writeList(w, ds.immutableRules[projectName], query)
			return
		}
		ds.nextRuleID++
		rule := cloneMap(body)
		rule["id"] = ds.nextRuleID
		ds.immutableRules[projectName] = append(ds.immutableRules[projectName], rule)
		status, data = http.StatusCreated, rule

	case "immutable-rule":
		projectName := query.Get("project")
		index, found := findMapNumber(ds.immutableRules[projectName], "id", query.Get("id"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "immutable tag rule not found"
			break
		}
		if method == http.MethodPut {
			id := ds.immutableRules[projectName][index]["id"]
			ds.immutableRules[projectName][index] = cloneMap(body)
			ds.immutableRules[projectName][index]["id"] = id
			data = ds.immutableRules[projectName][index]
		} else {
			ds.immutableRules[projectName] = append(ds.immutableRules[projectName][:index], ds.immutableRules[projectName][index+1:]...)
		}

	default:
		handled = false
	}
	return
}
