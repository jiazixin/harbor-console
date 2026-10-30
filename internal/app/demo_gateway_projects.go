package app

import (
	"net/http"
	"strings"

	"harbor-console/internal/timefmt"
)

// handleProjectControl serves projects and their summaries.
func (ds *demoState) handleProjectControl(w http.ResponseWriter, request demoControlRequest) (handled bool, status int, data any, errStatus int, errMessage string) {
	method, operation, query, body := request.method, request.operation, request.query, request.body
	handled = true
	status = http.StatusOK

	switch operation {
	case "projects":
		if method == http.MethodHead {
			w.WriteHeader(http.StatusOK)
			return
		}
		if method == http.MethodGet {
			items := filterMaps(ds.projects, query.Get("name"), "name")
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
			ds.writeList(w, items, query)
			return
		}
		name := strings.TrimSpace(stringValue(body["project_name"]))
		if _, found := findMap(ds.projects, "name", name); found {
			errStatus, errMessage = http.StatusConflict, "a project with the same name already exists"
			break
		}
		ds.nextProjectID++
		now := ds.now().UTC().Format(timefmt.Layout)
		metadata := map[string]any{"public": "false", "auto_scan": "false", "prevent_vul": "false", "severity": "critical", "auto_sbom_generation": "false", "reuse_sys_cve_allowlist": "true"}
		if provided, ok := body["metadata"].(map[string]any); ok {
			for key, value := range provided {
				metadata[key] = value
			}
		}
		project := map[string]any{"project_id": ds.nextProjectID, "name": name, "repo_count": 0, "owner_name": "demo-admin", "creation_time": now, "update_time": now, "metadata": metadata, "cve_allowlist": map[string]any{"project_id": ds.nextProjectID, "expires_at": nil, "items": []any{}}}
		storageLimit := int64(-1)
		if configured, ok := ds.configurations["storage_per_project"].(map[string]any); ok {
			storageLimit = numberValue(configured["value"])
		}
		if requested, ok := body["storage_limit"]; ok {
			storageLimit = numberValue(requested)
		}
		project["storage_limit"] = storageLimit
		if registryID, ok := body["registry_id"]; ok && registryID != nil && numberValue(registryID) > 0 {
			project["registry_id"] = numberValue(registryID)
		}
		ds.projects = append([]map[string]any{project}, ds.projects...)
		ds.quotas = append(ds.quotas, map[string]any{
			"id": ds.nextProjectID, "ref": map[string]any{"id": ds.nextProjectID, "name": name, "owner_name": "demo-admin"},
			"hard": map[string]any{"storage": storageLimit}, "used": map[string]any{"storage": int64(0)}, "creation_time": now,
		})
		ds.repositories[name] = []map[string]any{}
		ds.members[name] = []map[string]any{{"id": 1, "project_id": ds.nextProjectID, "entity_name": "demo-admin", "role_name": "projectAdmin", "role_id": 1, "entity_id": 1, "entity_type": "u"}}
		ds.projectScanners[name] = "00000000-0000-4000-8000-000000000001"
		status, data = http.StatusCreated, project

	case "project":
		projectName := query.Get("project")
		index, found := findMap(ds.projects, "name", projectName)
		if !found {
			errStatus, errMessage = http.StatusNotFound, "project not found"
			break
		}
		if method == http.MethodGet {
			data = ds.projects[index]
		} else if method == http.MethodPut {
			if metadata, ok := body["metadata"].(map[string]any); ok {
				current, _ := ds.projects[index]["metadata"].(map[string]any)
				for key, value := range metadata {
					current[key] = value
				}
			}
			if allowlist, ok := body["cve_allowlist"].(map[string]any); ok {
				ds.projects[index]["cve_allowlist"] = cloneMap(allowlist)
			}
			ds.projects[index]["update_time"] = ds.now().UTC().Format(timefmt.Layout)
			data = ds.projects[index]
		} else {
			if len(ds.repositories[projectName]) > 0 {
				errStatus, errMessage = http.StatusPreconditionFailed, "project still contains repositories; delete them first"
				break
			}
			projectID := numberValue(ds.projects[index]["project_id"])
			ds.projects = append(ds.projects[:index], ds.projects[index+1:]...)
			filteredQuotas := ds.quotas[:0]
			for _, quota := range ds.quotas {
				ref, _ := quota["ref"].(map[string]any)
				if numberValue(ref["id"]) != projectID {
					filteredQuotas = append(filteredQuotas, quota)
				}
			}
			ds.quotas = filteredQuotas
			delete(ds.repositories, projectName)
			delete(ds.members, projectName)
			delete(ds.projectScanners, projectName)
		}

	case "project-summary":
		projectName := query.Get("project")
		if _, found := findMap(ds.projects, "name", projectName); !found {
			errStatus, errMessage = http.StatusNotFound, "project not found"
			break
		}
		repositories := ds.repositories[projectName]
		artifactCount := 0
		for _, repository := range repositories {
			artifactCount += len(demoVisibleArtifacts(ds.artifacts[stringValue(repository["name"])]))
		}
		roleCounts := map[int]int{}
		for _, member := range ds.members[projectName] {
			roleCounts[int(numberValue(member["role_id"]))]++
		}
		data = map[string]any{"repo_count": len(repositories), "artifact_count": artifactCount, "project_admin_count": roleCounts[1], "maintainer_count": roleCounts[4], "developer_count": roleCounts[2], "guest_count": roleCounts[3]}

	case "project-deletable":
		projectName := query.Get("project")
		if _, found := findMap(ds.projects, "name", projectName); !found {
			errStatus, errMessage = http.StatusNotFound, "project not found"
			break
		}
		if len(ds.repositories[projectName]) > 0 {
			data = map[string]any{"deletable": false, "message": "project still contains repositories; delete them first"}
		} else {
			data = map[string]any{"deletable": true}
		}

	case "project-artifacts":
		projectName := query.Get("project")
		items := make([]map[string]any, 0)
		for repositoryName, artifacts := range ds.artifacts {
			if strings.HasPrefix(repositoryName, projectName+"/") {
				items = append(items, demoVisibleArtifacts(artifacts)...)
			}
		}
		ds.writeList(w, items, query)
		return

	default:
		handled = false
	}
	return
}

// handleProjectSettingsControl serves project metadata and the project scanner.
func (ds *demoState) handleProjectSettingsControl(w http.ResponseWriter, request demoControlRequest) (handled bool, status int, data any, errStatus int, errMessage string) {
	method, operation, query, body := request.method, request.operation, request.query, request.body
	handled = true
	status = http.StatusOK

	switch operation {
	case "project-metadatas":
		projectName := query.Get("project")
		index, found := findMap(ds.projects, "name", projectName)
		if !found {
			errStatus, errMessage = http.StatusNotFound, "project not found"
			break
		}
		metadata, _ := ds.projects[index]["metadata"].(map[string]any)
		if method == http.MethodGet {
			data = metadata
			break
		}
		key := strings.TrimSpace(stringValue(body["key"]))
		value := stringValue(body["value"])
		if key == "" {
			errStatus, errMessage = http.StatusBadRequest, "metadata key must not be empty"
			break
		}
		metadata[key] = value
		data = metadata

	case "project-metadata":
		projectName := query.Get("project")
		index, found := findMap(ds.projects, "name", projectName)
		if !found {
			errStatus, errMessage = http.StatusNotFound, "project not found"
			break
		}
		metadata, _ := ds.projects[index]["metadata"].(map[string]any)
		key := query.Get("meta")
		if method == http.MethodGet {
			value, exists := metadata[key]
			if !exists {
				errStatus, errMessage = http.StatusNotFound, "metadata not found"
				break
			}
			data = map[string]any{"value": value}
		} else if method == http.MethodPut {
			metadata[key] = body["value"]
			data = map[string]any{"value": metadata[key]}
		} else {
			delete(metadata, key)
		}

	case "project-scanner":
		projectName := query.Get("project")
		if _, found := findMap(ds.projects, "name", projectName); !found {
			errStatus, errMessage = http.StatusNotFound, "project not found"
			break
		}
		if method == http.MethodPut {
			uuid := stringValue(body["uuid"])
			index, found := findMap(ds.scanners, "uuid", uuid)
			if !found || ds.scanners[index]["disabled"] == true {
				errStatus, errMessage = http.StatusNotFound, "scanner not found or disabled"
				break
			}
			ds.projectScanners[projectName] = uuid
		}
		uuid := ds.projectScanners[projectName]
		index, found := findMap(ds.scanners, "uuid", uuid)
		if !found {
			errStatus, errMessage = http.StatusNotFound, "project scanner not found"
			break
		}
		data = ds.scanners[index]

	case "project-scanner-candidates":
		projectName := query.Get("project")
		if _, found := findMap(ds.projects, "name", projectName); !found {
			errStatus, errMessage = http.StatusNotFound, "project not found"
			break
		}
		items := make([]map[string]any, 0, len(ds.scanners))
		for _, scanner := range filterMaps(ds.scanners, demoQueryString(query.Get("q"), "name"), "name") {
			if scanner["disabled"] != true {
				items = append(items, scanner)
			}
		}
		ds.writeList(w, items, query)
		return

	default:
		handled = false
	}
	return
}

// handleProjectMemberControl serves project members.
func (ds *demoState) handleProjectMemberControl(w http.ResponseWriter, request demoControlRequest) (handled bool, status int, data any, errStatus int, errMessage string) {
	method, operation, query, body := request.method, request.operation, request.query, request.body
	handled = true
	status = http.StatusOK

	switch operation {
	case "project-members":
		projectName := query.Get("project")
		if _, found := ds.members[projectName]; !found {
			errStatus, errMessage = http.StatusNotFound, "project not found"
			break
		}
		if method == http.MethodGet {
			items := filterMaps(ds.members[projectName], query.Get("entityname"), "entity_name")
			ds.writeList(w, items, query)
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
		for _, member := range ds.members[projectName] {
			if strings.EqualFold(stringValue(member["entity_name"]), name) {
				errStatus, errMessage = http.StatusConflict, "member already in the project"
				break
			}
		}
		if errStatus != 0 {
			break
		}
		ds.nextMemberID++
		member := map[string]any{"id": ds.nextMemberID, "project_id": projectID(ds.projects, projectName), "entity_name": name, "role_name": demoRoleName(role), "role_id": role, "entity_id": ds.nextMemberID, "entity_type": entityType}
		ds.members[projectName] = append(ds.members[projectName], member)
		status, data = http.StatusCreated, member

	case "project-member":
		projectName := query.Get("project")
		memberID := query.Get("member")
		index, found := findMapNumber(ds.members[projectName], "id", memberID)
		if !found {
			errStatus, errMessage = http.StatusNotFound, "project member not found"
			break
		}
		if method == http.MethodPut {
			role := int(numberValue(body["role_id"]))
			ds.members[projectName][index]["role_id"] = role
			ds.members[projectName][index]["role_name"] = demoRoleName(role)
			data = ds.members[projectName][index]
		} else {
			ds.members[projectName] = append(ds.members[projectName][:index], ds.members[projectName][index+1:]...)
		}

	case "project-member-detail":
		projectName := query.Get("project")
		index, found := findMapNumber(ds.members[projectName], "id", query.Get("member"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "project member not found"
			break
		}
		data = ds.members[projectName][index]

	default:
		handled = false
	}
	return
}

// handleRepositoryControl serves repositories across and within projects.
func (ds *demoState) handleRepositoryControl(w http.ResponseWriter, request demoControlRequest) (handled bool, status int, data any, errStatus int, errMessage string) {
	method, operation, query, body := request.method, request.operation, request.query, request.body
	handled = true
	status = http.StatusOK

	switch operation {
	case "all-repositories":
		items := make([]map[string]any, 0)
		for _, repositories := range ds.repositories {
			items = append(items, repositories...)
		}
		ds.writeList(w, items, query)
		return

	case "repositories":
		projectName := query.Get("project")
		items, found := ds.repositories[projectName]
		if !found {
			errStatus, errMessage = http.StatusNotFound, "project not found"
			break
		}
		items = filterMaps(items, query.Get("q"), "name")
		ds.writeList(w, items, query)
		return

	case "repository":
		projectName := query.Get("project")
		repositoryName := query.Get("repository")
		index, found := findMap(ds.repositories[projectName], "name", repositoryName)
		if !found {
			errStatus, errMessage = http.StatusNotFound, "repository not found"
			break
		}
		if method == http.MethodGet {
			data = ds.repositories[projectName][index]
		} else if method == http.MethodPut {
			if description, ok := body["description"].(string); ok {
				ds.repositories[projectName][index]["description"] = description
			}
			ds.repositories[projectName][index]["update_time"] = ds.now().UTC().Format(timefmt.Layout)
			data = ds.repositories[projectName][index]
		} else {
			ds.repositories[projectName] = append(ds.repositories[projectName][:index], ds.repositories[projectName][index+1:]...)
			delete(ds.artifacts, repositoryName)
			ds.updateRepoCount(projectName)
		}

	default:
		handled = false
	}
	return
}
