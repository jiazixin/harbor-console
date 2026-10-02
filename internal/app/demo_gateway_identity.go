package app

import (
	"net/http"
	"net/url"
	"strings"
	"time"
)

func (state *demoState) handleIdentityControl(
	w http.ResponseWriter,
	method, operation string,
	query url.Values,
	body map[string]any,
) (handled bool, status int, data any, errStatus int, errMessage string) {
	handled = true
	status = http.StatusOK

	switch operation {
	case "permissions":
		data = demoPermissionMetadata()

	case "current-user":
		if len(state.users) == 0 {
			errStatus, errMessage = http.StatusUnauthorized, "当前用户不存在"
			break
		}
		current := cloneMap(state.users[0])
		current["oidc_user_meta"] = map[string]any{"id": 1, "user_id": current["user_id"], "creation_time": "2026-01-12T08:00:00Z", "update_time": current["update_time"]}
		data = current

	case "current-permissions":
		scope := query.Get("scope")
		permissions := []any{
			map[string]any{"resource": "system", "action": "read"},
			map[string]any{"resource": "system", "action": "list"},
			map[string]any{"resource": "system", "action": "create"},
			map[string]any{"resource": "system", "action": "update"},
			map[string]any{"resource": "system", "action": "delete"},
		}
		if strings.HasPrefix(scope, "/project/") {
			permissions = []any{
				map[string]any{"resource": "repository", "action": "list"},
				map[string]any{"resource": "repository", "action": "pull"},
				map[string]any{"resource": "repository", "action": "push"},
				map[string]any{"resource": "repository", "action": "delete"},
				map[string]any{"resource": "artifact", "action": "read"},
				map[string]any{"resource": "artifact", "action": "create"},
				map[string]any{"resource": "artifact", "action": "delete"},
				map[string]any{"resource": "member", "action": "list"},
				map[string]any{"resource": "member", "action": "create"},
				map[string]any{"resource": "member", "action": "update"},
				map[string]any{"resource": "member", "action": "delete"},
			}
		}
		state.writeListAny(w, permissions, query)
		return

	case "users":
		if method == http.MethodGet {
			items := state.users
			if queryText := demoQueryString(query.Get("q"), "username"); queryText != "" {
				items = filterMaps(items, queryText, "username")
			}
			state.writeList(w, items, query)
			return
		}
		username := stringValue(body["username"])
		if _, found := findMap(state.users, "username", username); found {
			errStatus, errMessage = http.StatusConflict, "用户名已经存在"
			break
		}
		state.nextUserID++
		user := cloneMap(body)
		delete(user, "password")
		user["user_id"] = state.nextUserID
		user["sysadmin_flag"] = false
		user["creation_time"] = time.Now().UTC().Format(time.RFC3339)
		state.users = append(state.users, user)
		status, data = http.StatusCreated, user

	case "users-search":
		state.writeList(w, filterMaps(state.users, query.Get("username"), "username"), query)
		return

	case "user":
		index, found := findMapNumber(state.users, "user_id", query.Get("id"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "用户不存在"
			break
		}
		if method == http.MethodGet {
			data = state.users[index]
		} else if method == http.MethodPut {
			for _, field := range []string{"email", "realname", "comment"} {
				if value, ok := body[field]; ok {
					state.users[index][field] = value
				}
			}
			state.users[index]["update_time"] = time.Now().UTC().Format(time.RFC3339)
			data = state.users[index]
		} else {
			if stringValue(state.users[index]["username"]) == "demo-admin" {
				errStatus, errMessage = http.StatusForbidden, "不能删除当前演示管理员"
				break
			}
			state.users = append(state.users[:index], state.users[index+1:]...)
		}

	case "user-sysadmin":
		index, found := findMapNumber(state.users, "user_id", query.Get("id"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "用户不存在"
			break
		}
		state.users[index]["sysadmin_flag"] = body["sysadmin_flag"]
		state.users[index]["update_time"] = time.Now().UTC().Format(time.RFC3339)
		data = state.users[index]

	case "user-password", "current-user-password":
		if _, found := findMapNumber(state.users, "user_id", query.Get("id")); !found {
			errStatus, errMessage = http.StatusNotFound, "用户不存在"
			break
		}
		data = map[string]any{"updated": true}

	case "user-cli-secret", "current-user-cli-secret":
		index, found := findMapNumber(state.users, "user_id", query.Get("id"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "用户不存在"
			break
		}
		state.users[index]["update_time"] = time.Now().UTC().Format(time.RFC3339)
		state.users[index]["has_cli_secret"] = true
		data = map[string]any{"updated": true}

	case "user-groups":
		if method == http.MethodGet {
			state.writeList(w, filterMaps(state.userGroups, query.Get("group_name"), "group_name"), query)
			return
		}
		state.nextGroupID++
		group := cloneMap(body)
		group["id"] = state.nextGroupID
		state.userGroups = append(state.userGroups, group)
		status, data = http.StatusCreated, group

	case "user-groups-search":
		state.writeList(w, filterMaps(state.userGroups, query.Get("groupname"), "group_name"), query)
		return

	case "user-group":
		index, found := findMapNumber(state.userGroups, "id", query.Get("id"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "用户组不存在"
			break
		}
		if method == http.MethodGet {
			data = state.userGroups[index]
		} else if method == http.MethodPut {
			id := state.userGroups[index]["id"]
			state.userGroups[index] = cloneMap(body)
			state.userGroups[index]["id"] = id
			data = state.userGroups[index]
		} else {
			state.userGroups = append(state.userGroups[:index], state.userGroups[index+1:]...)
		}

	default:
		handled = false
	}
	return
}
