package app

import (
	"net/http"
	"net/url"
	"strings"
	"time"
)

func (state *demoState) handleProjectControl(
	w http.ResponseWriter,
	method, operation string,
	query url.Values,
	body map[string]any,
) (handled bool, status int, data any, errStatus int, errMessage string) {
	handled = true
	status = http.StatusOK

	switch operation {
	case "projects":
		if method == http.MethodHead {
			w.WriteHeader(http.StatusOK)
			return
		}
		if method == http.MethodGet {
			items := filterMaps(state.projects, query.Get("name"), "name")
			items = filterMaps(items, query.Get("owner"), "owner_name")
			if query.Has("public") {
				wantPublic := query.Get("public") == "true"
				filtered := make([]map[string]any, 0, len(items))
				for _, item := range items {
					metadata, _ := item["metadata"].(map[string]any)
					if (stringValue(metadata["public"]) == "true") == wantPublic {
						filtered = append(filtered, item)
					}
				}
				items = filtered
			}
			state.writeList(w, items, query)
			return
		}
		name := strings.TrimSpace(stringValue(body["project_name"]))
		if _, found := findMap(state.projects, "name", name); found {
			errStatus, errMessage = http.StatusConflict, "同名项目已经存在"
			break
		}
		state.nextProjectID++
		now := time.Now().UTC().Format(time.RFC3339)
		metadata := map[string]any{"public": "false", "auto_scan": "false", "prevent_vul": "false", "severity": "critical", "auto_sbom_generation": "false", "reuse_sys_cve_allowlist": "true"}
		if provided, ok := body["metadata"].(map[string]any); ok {
			for key, value := range provided {
				metadata[key] = value
			}
		}
		project := map[string]any{"project_id": state.nextProjectID, "name": name, "repo_count": 0, "owner_name": "demo-admin", "creation_time": now, "update_time": now, "metadata": metadata, "cve_allowlist": map[string]any{"project_id": state.nextProjectID, "expires_at": nil, "items": []any{}}}
		storageLimit := int64(-1)
		if configured, ok := state.configurations["storage_per_project"].(map[string]any); ok {
			storageLimit = numberValue(configured["value"])
		}
		if requested, ok := body["storage_limit"]; ok {
			storageLimit = numberValue(requested)
		}
		project["storage_limit"] = storageLimit
		if registryID, ok := body["registry_id"]; ok && registryID != nil && numberValue(registryID) > 0 {
			project["registry_id"] = numberValue(registryID)
		}
		state.projects = append([]map[string]any{project}, state.projects...)
		state.quotas = append(state.quotas, map[string]any{
			"id": state.nextProjectID, "ref": map[string]any{"id": state.nextProjectID, "name": name, "owner_name": "demo-admin"},
			"hard": map[string]any{"storage": storageLimit}, "used": map[string]any{"storage": int64(0)}, "creation_time": now,
		})
		state.repositories[name] = []map[string]any{}
		state.members[name] = []map[string]any{{"id": 1, "project_id": state.nextProjectID, "entity_name": "demo-admin", "role_name": "projectAdmin", "role_id": 1, "entity_id": 1, "entity_type": "u"}}
		state.projectScanners[name] = "00000000-0000-4000-8000-000000000001"
		status, data = http.StatusCreated, project

	case "project":
		projectName := query.Get("project")
		index, found := findMap(state.projects, "name", projectName)
		if !found {
			errStatus, errMessage = http.StatusNotFound, "项目不存在"
			break
		}
		if method == http.MethodGet {
			data = state.projects[index]
		} else if method == http.MethodPut {
			if metadata, ok := body["metadata"].(map[string]any); ok {
				current, _ := state.projects[index]["metadata"].(map[string]any)
				for key, value := range metadata {
					current[key] = value
				}
			}
			if allowlist, ok := body["cve_allowlist"].(map[string]any); ok {
				state.projects[index]["cve_allowlist"] = cloneMap(allowlist)
			}
			state.projects[index]["update_time"] = time.Now().UTC().Format(time.RFC3339)
			data = state.projects[index]
		} else {
			if len(state.repositories[projectName]) > 0 {
				errStatus, errMessage = http.StatusPreconditionFailed, "项目仍包含仓库，请先删除仓库"
				break
			}
			projectID := numberValue(state.projects[index]["project_id"])
			state.projects = append(state.projects[:index], state.projects[index+1:]...)
			filteredQuotas := state.quotas[:0]
			for _, quota := range state.quotas {
				ref, _ := quota["ref"].(map[string]any)
				if numberValue(ref["id"]) != projectID {
					filteredQuotas = append(filteredQuotas, quota)
				}
			}
			state.quotas = filteredQuotas
			delete(state.repositories, projectName)
			delete(state.members, projectName)
			delete(state.projectScanners, projectName)
		}

	case "project-summary":
		projectName := query.Get("project")
		if _, found := findMap(state.projects, "name", projectName); !found {
			errStatus, errMessage = http.StatusNotFound, "项目不存在"
			break
		}
		repositories := state.repositories[projectName]
		artifactCount := 0
		for _, repository := range repositories {
			artifactCount += len(demoVisibleArtifacts(state.artifacts[stringValue(repository["name"])]))
		}
		roleCounts := map[int]int{}
		for _, member := range state.members[projectName] {
			roleCounts[int(numberValue(member["role_id"]))]++
		}
		data = map[string]any{"repo_count": len(repositories), "artifact_count": artifactCount, "project_admin_count": roleCounts[1], "maintainer_count": roleCounts[4], "developer_count": roleCounts[2], "guest_count": roleCounts[3]}

	case "project-deletable":
		projectName := query.Get("project")
		if _, found := findMap(state.projects, "name", projectName); !found {
			errStatus, errMessage = http.StatusNotFound, "项目不存在"
			break
		}
		if len(state.repositories[projectName]) > 0 {
			data = map[string]any{"deletable": false, "message": "项目仍包含仓库，请先删除仓库"}
		} else {
			data = map[string]any{"deletable": true}
		}

	case "project-scanner":
		projectName := query.Get("project")
		if _, found := findMap(state.projects, "name", projectName); !found {
			errStatus, errMessage = http.StatusNotFound, "项目不存在"
			break
		}
		if method == http.MethodPut {
			uuid := stringValue(body["uuid"])
			index, found := findMap(state.scanners, "uuid", uuid)
			if !found || state.scanners[index]["disabled"] == true {
				errStatus, errMessage = http.StatusNotFound, "扫描器不存在或已停用"
				break
			}
			state.projectScanners[projectName] = uuid
		}
		uuid := state.projectScanners[projectName]
		index, found := findMap(state.scanners, "uuid", uuid)
		if !found {
			errStatus, errMessage = http.StatusNotFound, "项目扫描器不存在"
			break
		}
		data = state.scanners[index]

	case "project-scanner-candidates":
		projectName := query.Get("project")
		if _, found := findMap(state.projects, "name", projectName); !found {
			errStatus, errMessage = http.StatusNotFound, "项目不存在"
			break
		}
		items := make([]map[string]any, 0, len(state.scanners))
		for _, scanner := range filterMaps(state.scanners, demoQueryString(query.Get("q"), "name"), "name") {
			if scanner["disabled"] != true {
				items = append(items, scanner)
			}
		}
		state.writeList(w, items, query)
		return

	case "project-members":
		projectName := query.Get("project")
		if _, found := state.members[projectName]; !found {
			errStatus, errMessage = http.StatusNotFound, "项目不存在"
			break
		}
		if method == http.MethodGet {
			items := filterMaps(state.members[projectName], query.Get("entityname"), "entity_name")
			state.writeList(w, items, query)
			return
		}
		role := int(numberValue(body["role_id"]))
		user, hasUser := body["member_user"].(map[string]any)
		group, hasGroup := body["member_group"].(map[string]any)
		name := stringValue(user["username"])
		entityType := "u"
		if !hasUser && hasGroup {
			name = stringValue(group["group_name"])
			if name == "" {
				name = stringValue(group["ldap_group_dn"])
			}
			entityType = "g"
		}
		for _, member := range state.members[projectName] {
			if strings.EqualFold(stringValue(member["entity_name"]), name) {
				errStatus, errMessage = http.StatusConflict, "该成员已经在项目中"
				break
			}
		}
		if errStatus != 0 {
			break
		}
		state.nextMemberID++
		member := map[string]any{"id": state.nextMemberID, "project_id": projectID(state.projects, projectName), "entity_name": name, "role_name": demoRoleName(role), "role_id": role, "entity_id": state.nextMemberID, "entity_type": entityType}
		state.members[projectName] = append(state.members[projectName], member)
		status, data = http.StatusCreated, member

	case "project-member":
		projectName := query.Get("project")
		memberID := query.Get("member")
		index, found := findMapNumber(state.members[projectName], "id", memberID)
		if !found {
			errStatus, errMessage = http.StatusNotFound, "项目成员不存在"
			break
		}
		if method == http.MethodPut {
			role := int(numberValue(body["role_id"]))
			state.members[projectName][index]["role_id"] = role
			state.members[projectName][index]["role_name"] = demoRoleName(role)
			data = state.members[projectName][index]
		} else {
			state.members[projectName] = append(state.members[projectName][:index], state.members[projectName][index+1:]...)
		}

	case "project-member-detail":
		projectName := query.Get("project")
		index, found := findMapNumber(state.members[projectName], "id", query.Get("member"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "项目成员不存在"
			break
		}
		data = state.members[projectName][index]

	case "project-artifacts":
		projectName := query.Get("project")
		items := make([]map[string]any, 0)
		for repositoryName, artifacts := range state.artifacts {
			if strings.HasPrefix(repositoryName, projectName+"/") {
				items = append(items, demoVisibleArtifacts(artifacts)...)
			}
		}
		state.writeList(w, items, query)
		return

	case "project-metadatas":
		projectName := query.Get("project")
		index, found := findMap(state.projects, "name", projectName)
		if !found {
			errStatus, errMessage = http.StatusNotFound, "项目不存在"
			break
		}
		metadata, _ := state.projects[index]["metadata"].(map[string]any)
		if method == http.MethodGet {
			data = metadata
			break
		}
		key := strings.TrimSpace(stringValue(body["key"]))
		value := stringValue(body["value"])
		if key == "" {
			errStatus, errMessage = http.StatusBadRequest, "metadata key 不能为空"
			break
		}
		metadata[key] = value
		data = metadata

	case "project-metadata":
		projectName := query.Get("project")
		index, found := findMap(state.projects, "name", projectName)
		if !found {
			errStatus, errMessage = http.StatusNotFound, "项目不存在"
			break
		}
		metadata, _ := state.projects[index]["metadata"].(map[string]any)
		key := query.Get("meta")
		if method == http.MethodGet {
			value, exists := metadata[key]
			if !exists {
				errStatus, errMessage = http.StatusNotFound, "metadata 不存在"
				break
			}
			data = map[string]any{"value": value}
		} else if method == http.MethodPut {
			metadata[key] = body["value"]
			data = map[string]any{"value": metadata[key]}
		} else {
			delete(metadata, key)
		}

	case "all-repositories":
		items := make([]map[string]any, 0)
		for _, repositories := range state.repositories {
			items = append(items, repositories...)
		}
		state.writeList(w, items, query)
		return

	case "repositories":
		projectName := query.Get("project")
		items, found := state.repositories[projectName]
		if !found {
			errStatus, errMessage = http.StatusNotFound, "项目不存在"
			break
		}
		items = filterMaps(items, query.Get("q"), "name")
		state.writeList(w, items, query)
		return

	case "repository":
		projectName := query.Get("project")
		repositoryName := query.Get("repository")
		index, found := findMap(state.repositories[projectName], "name", repositoryName)
		if !found {
			errStatus, errMessage = http.StatusNotFound, "仓库不存在"
			break
		}
		if method == http.MethodGet {
			data = state.repositories[projectName][index]
		} else if method == http.MethodPut {
			if description, ok := body["description"].(string); ok {
				state.repositories[projectName][index]["description"] = description
			}
			state.repositories[projectName][index]["update_time"] = time.Now().UTC().Format(time.RFC3339)
			data = state.repositories[projectName][index]
		} else {
			state.repositories[projectName] = append(state.repositories[projectName][:index], state.repositories[projectName][index+1:]...)
			delete(state.artifacts, repositoryName)
			updateDemoRepoCount(state.projects, projectName, len(state.repositories[projectName]))
		}

	default:
		handled = false
	}
	return
}
