package app

import (
	"net/http"
	"strings"

	"harbor-console/internal/timefmt"
)

// handleIdentityControl serves the signed-in account and its permissions.
func (ds *demoState) handleIdentityControl(w http.ResponseWriter, request demoControlRequest) (handled bool, status int, data any, errStatus int, errMessage string) {
	operation, query := request.operation, request.query
	handled = true
	status = http.StatusOK

	switch operation {
	case "permissions":
		data = demoPermissionMetadata()

	case "current-user":
		if len(ds.users) == 0 {
			errStatus, errMessage = http.StatusUnauthorized, "current user not found"
			break
		}
		current := cloneMap(ds.users[0])
		current["oidc_user_meta"] = map[string]any{"id": 1, "user_id": current["user_id"], "creation_time": "2026-01-12T08:00:00.000Z", "update_time": current["update_time"]}
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
		ds.writeListAny(w, permissions, query)
		return

	default:
		handled = false
	}
	return
}

// handleUserControl serves local users and their credentials.
func (ds *demoState) handleUserControl(w http.ResponseWriter, request demoControlRequest) (handled bool, status int, data any, errStatus int, errMessage string) {
	method, operation, query, body := request.method, request.operation, request.query, request.body
	handled = true
	status = http.StatusOK

	switch operation {
	case "users":
		if method == http.MethodGet {
			items := ds.users
			if queryText := demoQueryString(query.Get("q"), "username"); queryText != "" {
				items = filterMaps(items, queryText, "username")
			}
			ds.writeList(w, items, query)
			return
		}
		username := stringValue(body["username"])
		if _, found := findMap(ds.users, "username", username); found {
			errStatus, errMessage = http.StatusConflict, "username already exists"
			break
		}
		ds.nextUserID++
		user := cloneMap(body)
		delete(user, "password")
		user["user_id"] = ds.nextUserID
		user["sysadmin_flag"] = false
		user["creation_time"] = ds.now().UTC().Format(timefmt.Layout)
		ds.users = append(ds.users, user)
		status, data = http.StatusCreated, user

	case "users-search":
		ds.writeList(w, filterMaps(ds.users, query.Get("username"), "username"), query)
		return

	case "user":
		index, found := findMapNumber(ds.users, "user_id", query.Get("id"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "user not found"
			break
		}
		if method == http.MethodGet {
			data = ds.users[index]
		} else if method == http.MethodPut {
			for _, field := range []string{"email", "realname", "comment"} {
				if value, ok := body[field]; ok {
					ds.users[index][field] = value
				}
			}
			ds.users[index]["update_time"] = ds.now().UTC().Format(timefmt.Layout)
			data = ds.users[index]
		} else {
			if stringValue(ds.users[index]["username"]) == "demo-admin" {
				errStatus, errMessage = http.StatusForbidden, "cannot delete the current demo administrator"
				break
			}
			ds.users = append(ds.users[:index], ds.users[index+1:]...)
		}

	case "user-sysadmin":
		index, found := findMapNumber(ds.users, "user_id", query.Get("id"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "user not found"
			break
		}
		ds.users[index]["sysadmin_flag"] = body["sysadmin_flag"]
		ds.users[index]["update_time"] = ds.now().UTC().Format(timefmt.Layout)
		data = ds.users[index]

	case "user-password", "current-user-password":
		if _, found := findMapNumber(ds.users, "user_id", query.Get("id")); !found {
			errStatus, errMessage = http.StatusNotFound, "user not found"
			break
		}
		data = map[string]any{"updated": true}

	case "user-cli-secret", "current-user-cli-secret":
		index, found := findMapNumber(ds.users, "user_id", query.Get("id"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "user not found"
			break
		}
		ds.users[index]["update_time"] = ds.now().UTC().Format(timefmt.Layout)
		ds.users[index]["has_cli_secret"] = true
		data = map[string]any{"updated": true}

	default:
		handled = false
	}
	return
}

// handleUserGroupControl serves user groups.
func (ds *demoState) handleUserGroupControl(w http.ResponseWriter, request demoControlRequest) (handled bool, status int, data any, errStatus int, errMessage string) {
	method, operation, query, body := request.method, request.operation, request.query, request.body
	handled = true
	status = http.StatusOK

	switch operation {
	case "user-groups":
		if method == http.MethodGet {
			ds.writeList(w, filterMaps(ds.userGroups, query.Get("group_name"), "group_name"), query)
			return
		}
		ds.nextGroupID++
		group := cloneMap(body)
		group["id"] = ds.nextGroupID
		ds.userGroups = append(ds.userGroups, group)
		status, data = http.StatusCreated, group

	case "user-groups-search":
		ds.writeList(w, filterMaps(ds.userGroups, query.Get("groupname"), "group_name"), query)
		return

	case "user-group":
		index, found := findMapNumber(ds.userGroups, "id", query.Get("id"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "user group not found"
			break
		}
		if method == http.MethodGet {
			data = ds.userGroups[index]
		} else if method == http.MethodPut {
			id := ds.userGroups[index]["id"]
			ds.userGroups[index] = cloneMap(body)
			ds.userGroups[index]["id"] = id
			data = ds.userGroups[index]
		} else {
			ds.userGroups = append(ds.userGroups[:index], ds.userGroups[index+1:]...)
		}

	default:
		handled = false
	}
	return
}
