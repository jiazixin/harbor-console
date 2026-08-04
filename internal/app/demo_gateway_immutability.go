package app

import (
	"net/http"
	"net/url"
)

func (state *demoState) handleImmutabilityControl(
	w http.ResponseWriter,
	method, operation string,
	query url.Values,
	body map[string]any,
) (handled bool, status int, data any, errStatus int, errMessage string) {
	handled = true
	status = http.StatusOK

	switch operation {
	case "immutable-rules":
		projectName := query.Get("project")
		if method == http.MethodGet {
			state.writeList(w, state.immutableRules[projectName], query)
			return
		}
		state.nextRuleID++
		rule := cloneMap(body)
		rule["id"] = state.nextRuleID
		state.immutableRules[projectName] = append(state.immutableRules[projectName], rule)
		status, data = http.StatusCreated, rule

	case "immutable-rule":
		projectName := query.Get("project")
		index, found := findMapNumber(state.immutableRules[projectName], "id", query.Get("id"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "不可变 Tag 规则不存在"
			break
		}
		if method == http.MethodPut {
			id := state.immutableRules[projectName][index]["id"]
			state.immutableRules[projectName][index] = cloneMap(body)
			state.immutableRules[projectName][index]["id"] = id
			data = state.immutableRules[projectName][index]
		} else {
			state.immutableRules[projectName] = append(state.immutableRules[projectName][:index], state.immutableRules[projectName][index+1:]...)
		}

	default:
		handled = false
	}
	return
}
