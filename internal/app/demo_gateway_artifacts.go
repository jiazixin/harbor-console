package app

import (
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

// handleArtifactControl serves artifacts, their accessories and build additions.
func (state *demoState) handleArtifactControl(
	w http.ResponseWriter,
	method, operation string,
	query url.Values,
	body map[string]any,
) (handled bool, status int, data any, errStatus int, errMessage string) {
	handled = true
	status = http.StatusOK

	switch operation {
	case "artifact-copy":
		targetRepository := query.Get("repository")
		if !strings.HasPrefix(targetRepository, query.Get("project")+"/") {
			targetRepository = query.Get("project") + "/" + targetRepository
		}
		if _, found := state.artifacts[targetRepository]; !found {
			errStatus, errMessage = http.StatusNotFound, "目标仓库不存在"
			break
		}
		sourceRepository, sourceReference, found := splitDemoArtifactSource(query.Get("from"))
		if !found {
			errStatus, errMessage = http.StatusBadRequest, "复制源格式无效"
			break
		}
		sourceIndex, found := findArtifact(state.artifacts[sourceRepository], sourceReference)
		if !found {
			errStatus, errMessage = http.StatusNotFound, "复制源制品不存在"
			break
		}
		source := state.artifacts[sourceRepository][sourceIndex]
		if _, exists := findArtifact(state.artifacts[targetRepository], stringValue(source["digest"])); exists {
			errStatus, errMessage = http.StatusConflict, "目标仓库中已经存在该制品"
			break
		}
		copied := cloneMap(source)
		copied["id"] = time.Now().UnixNano()
		copied["push_time"] = time.Now().UTC().Format(time.RFC3339)
		copied["pull_time"] = nil
		copied["labels"] = []any{}
		copied["accessories"] = []any{}
		delete(copied, "demo_child")
		if strings.Contains(query.Get("from"), ":") && !strings.Contains(query.Get("from"), "@") {
			copied["tags"] = []any{map[string]any{"id": 1, "name": sourceReference, "push_time": copied["push_time"], "immutable": false}}
		} else {
			copied["tags"] = []any{}
		}
		state.artifacts[targetRepository] = append([]map[string]any{copied}, state.artifacts[targetRepository]...)
		updateDemoArtifactCount(state.repositories, query.Get("project"), targetRepository, len(demoVisibleArtifacts(state.artifacts[targetRepository])))
		status = http.StatusCreated

	case "artifacts":
		repositoryName := query.Get("repository")
		items, found := state.artifacts[repositoryName]
		if !found {
			errStatus, errMessage = http.StatusNotFound, "仓库不存在"
			break
		}
		state.writeList(w, demoVisibleArtifacts(items), query)
		return

	case "artifact":
		repositoryName := query.Get("repository")
		index, found := findArtifact(state.artifacts[repositoryName], query.Get("reference"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "制品不存在"
			break
		}
		if method == http.MethodGet {
			data = state.artifacts[repositoryName][index]
		} else {
			state.artifacts[repositoryName] = append(state.artifacts[repositoryName][:index], state.artifacts[repositoryName][index+1:]...)
			updateDemoArtifactCount(state.repositories, query.Get("project"), repositoryName, len(demoVisibleArtifacts(state.artifacts[repositoryName])))
		}

	case "artifact-accessories":
		repositoryName := query.Get("repository")
		artifactIndex, found := findArtifact(state.artifacts[repositoryName], query.Get("reference"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "制品不存在"
			break
		}
		accessories, _ := state.artifacts[repositoryName][artifactIndex]["accessories"].([]any)
		state.writeListAny(w, accessories, query)
		return

	case "artifact-icon":
		if query.Get("digest") != demoArtifactIconDigest {
			errStatus, errMessage = http.StatusNotFound, "制品图标不存在"
			break
		}
		data = map[string]any{"content-type": "image/png", "content": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL07wAAAABJRU5ErkJggg=="}

	case "artifact-addition":
		repositoryName := query.Get("repository")
		if _, found := findArtifact(state.artifacts[repositoryName], query.Get("reference")); !found {
			errStatus, errMessage = http.StatusNotFound, "制品不存在"
			break
		}
		addition, found := demoArtifactAddition(query.Get("addition"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "当前制品没有该附加信息"
			break
		}
		data = addition

	default:
		handled = false
	}
	return
}

// handleArtifactReferenceControl serves the tags and labels attached to an artifact.
func (state *demoState) handleArtifactReferenceControl(
	w http.ResponseWriter,
	method, operation string,
	query url.Values,
	body map[string]any,
) (handled bool, status int, data any, errStatus int, errMessage string) {
	handled = true
	status = http.StatusOK

	switch operation {
	case "artifact-tags":
		repositoryName := query.Get("repository")
		index, found := findArtifact(state.artifacts[repositoryName], query.Get("reference"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "制品不存在"
			break
		}
		if method == http.MethodGet {
			state.writeListAny(w, mapsToAny(tagsOf(state.artifacts[repositoryName][index])), query)
			return
		}
		tagName := stringValue(body["name"])
		tags := tagsOf(state.artifacts[repositoryName][index])
		for _, tag := range tags {
			if stringValue(tag["name"]) == tagName {
				errStatus, errMessage = http.StatusConflict, "Tag 已存在"
				break
			}
		}
		if errStatus != 0 {
			break
		}
		tag := map[string]any{"id": len(tags) + 1, "name": tagName, "push_time": time.Now().UTC().Format(time.RFC3339), "immutable": false}
		tags = append(tags, tag)
		state.artifacts[repositoryName][index]["tags"] = mapsToAny(tags)
		status, data = http.StatusCreated, tag

	case "artifact-tag":
		repositoryName := query.Get("repository")
		index, found := findArtifact(state.artifacts[repositoryName], query.Get("reference"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "制品不存在"
			break
		}
		tags := tagsOf(state.artifacts[repositoryName][index])
		tagIndex, found := findMap(tags, "name", query.Get("tag"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "Tag 不存在"
			break
		}
		if immutable, _ := tags[tagIndex]["immutable"].(bool); immutable {
			errStatus, errMessage = http.StatusPreconditionFailed, "不可变 Tag 不能删除"
			break
		}
		tags = append(tags[:tagIndex], tags[tagIndex+1:]...)
		state.artifacts[repositoryName][index]["tags"] = mapsToAny(tags)

	case "artifact-labels":
		repositoryName := query.Get("repository")
		artifactIndex, found := findArtifact(state.artifacts[repositoryName], query.Get("reference"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "制品不存在"
			break
		}
		labelID := numberValue(body["id"])
		labelIndex, found := findMapNumber(state.labels, "id", strconv.FormatInt(labelID, 10))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "标签不存在"
			break
		}
		labels := labelsOf(state.artifacts[repositoryName][artifactIndex])
		if _, attached := findMapNumber(labels, "id", strconv.FormatInt(labelID, 10)); attached {
			errStatus, errMessage = http.StatusConflict, "标签已经绑定到该制品"
			break
		}
		label := state.labels[labelIndex]
		projectID := numberValue(projectID(state.projects, query.Get("project")))
		if stringValue(label["scope"]) == "p" && numberValue(label["project_id"]) != projectID {
			errStatus, errMessage = http.StatusForbidden, "不能绑定其他项目的标签"
			break
		}
		labels = append(labels, cloneMap(label))
		state.artifacts[repositoryName][artifactIndex]["labels"] = mapsToAny(labels)

	case "artifact-label":
		repositoryName := query.Get("repository")
		artifactIndex, found := findArtifact(state.artifacts[repositoryName], query.Get("reference"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "制品不存在"
			break
		}
		labels := labelsOf(state.artifacts[repositoryName][artifactIndex])
		labelIndex, found := findMapNumber(labels, "id", query.Get("label"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "制品未绑定该标签"
			break
		}
		labels = append(labels[:labelIndex], labels[labelIndex+1:]...)
		state.artifacts[repositoryName][artifactIndex]["labels"] = mapsToAny(labels)

	default:
		handled = false
	}
	return
}

// handleArtifactScanControl serves artifact scans and their vulnerability reports.
func (state *demoState) handleArtifactScanControl(
	w http.ResponseWriter,
	method, operation string,
	query url.Values,
	body map[string]any,
) (handled bool, status int, data any, errStatus int, errMessage string) {
	handled = true
	status = http.StatusOK

	switch operation {
	case "artifact-scan":
		repositoryName := query.Get("repository")
		index, found := findArtifact(state.artifacts[repositoryName], query.Get("reference"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "制品不存在"
			break
		}
		artifactItem := state.artifacts[repositoryName][index]
		overviewKey := "scan_overview"
		if stringValue(body["scan_type"]) == "sbom" {
			overviewKey = "sbom_overview"
		}
		overview, _ := artifactItem[overviewKey].(map[string]any)
		if overview == nil {
			overview = map[string]any{"application/vnd.scanner.adapter.vuln.report.harbor+json; version=1.0": map[string]any{"report_id": "demo-sbom-generated"}}
			artifactItem[overviewKey] = overview
		}
		for _, raw := range overview {
			if report, ok := raw.(map[string]any); ok {
				report["scan_status"] = "Running"
				report["start_time"] = time.Now().UTC().Format(time.RFC3339)
			}
		}
		status = http.StatusAccepted

	case "artifact-scan-stop":
		repositoryName := query.Get("repository")
		index, found := findArtifact(state.artifacts[repositoryName], query.Get("reference"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "制品不存在"
			break
		}
		overviewKey := "scan_overview"
		if stringValue(body["scan_type"]) == "sbom" {
			overviewKey = "sbom_overview"
		}
		overview, _ := state.artifacts[repositoryName][index][overviewKey].(map[string]any)
		for _, raw := range overview {
			if report, ok := raw.(map[string]any); ok {
				report["scan_status"] = "Stopped"
				report["end_time"] = time.Now().UTC().Format(time.RFC3339)
			}
		}
		status = http.StatusAccepted

	case "artifact-scan-log":
		repositoryName := query.Get("repository")
		if _, found := findArtifact(state.artifacts[repositoryName], query.Get("reference")); !found {
			errStatus, errMessage = http.StatusNotFound, "制品不存在"
			break
		}
		data = "2026-07-28T06:40:00Z [INFO] 开始拉取漏洞数据库\n2026-07-28T06:40:03Z [INFO] 分析系统软件包\n2026-07-28T06:40:11Z [INFO] 漏洞扫描完成\n"

	case "artifact-vulnerabilities":
		repositoryName := query.Get("repository")
		_, found := findArtifact(state.artifacts[repositoryName], query.Get("reference"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "制品不存在"
			break
		}
		data = demoVulnerabilityReport()

	default:
		handled = false
	}
	return
}

// handleRobotControl serves robot accounts.
func (state *demoState) handleRobotControl(
	w http.ResponseWriter,
	method, operation string,
	query url.Values,
	body map[string]any,
) (handled bool, status int, data any, errStatus int, errMessage string) {
	handled = true
	status = http.StatusOK

	switch operation {
	case "robots":
		if method == http.MethodGet {
			items := state.robots
			if level := demoQueryString(query.Get("q"), "level"); level != "" {
				filtered := make([]map[string]any, 0)
				for _, robot := range items {
					if stringValue(robot["level"]) == level {
						filtered = append(filtered, robot)
					}
				}
				items = filtered
			}
			if projectID := demoQueryNumber(query.Get("q"), "project_id"); projectID > 0 {
				filtered := make([]map[string]any, 0)
				for _, robot := range items {
					if numberValue(robot["project_id"]) == projectID {
						filtered = append(filtered, robot)
					}
				}
				items = filtered
			}
			if name := demoQueryString(query.Get("q"), "name"); name != "" {
				items = filterMaps(items, name, "name")
			}
			state.writeList(w, items, query)
			return
		}
		state.nextRobotID++
		robot := cloneMap(body)
		namespace := demoRobotNamespace(robot)
		robot["id"] = state.nextRobotID
		if stringValue(robot["level"]) == "system" {
			robot["name"] = "robot$" + stringValue(robot["name"])
		} else {
			robot["name"] = "robot$" + namespace + "+" + stringValue(robot["name"])
		}
		robot["project_id"] = numberValue(projectID(state.projects, namespace))
		robot["editable"] = true
		robot["creation_time"] = time.Now().UTC().Format(time.RFC3339)
		duration := numberValue(robot["duration"])
		if duration < 0 {
			robot["expires_at"] = -1
		} else {
			robot["expires_at"] = time.Now().Add(time.Duration(duration) * 24 * time.Hour).Unix()
		}
		state.robots = append(state.robots, robot)
		status = http.StatusCreated
		data = map[string]any{"id": state.nextRobotID, "name": robot["name"], "secret": fmt.Sprintf("demo-secret-%d-X7k2", state.nextRobotID), "creation_time": robot["creation_time"], "expires_at": robot["expires_at"]}

	case "robot":
		index, found := findMapNumber(state.robots, "id", query.Get("id"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "机器人账号不存在"
			break
		}
		if method == http.MethodGet {
			data = state.robots[index]
		} else if method == http.MethodPut {
			current := state.robots[index]
			oldDuration := numberValue(current["duration"])
			for key, value := range body {
				if key != "id" && key != "name" && key != "project_id" && key != "creation_time" && key != "expires_at" {
					current[key] = cloneDemoValue(value)
				}
			}
			newDuration := numberValue(current["duration"])
			if newDuration != oldDuration {
				if newDuration < 0 {
					current["expires_at"] = -1
				} else {
					current["expires_at"] = time.Now().Add(time.Duration(newDuration) * 24 * time.Hour).Unix()
				}
			}
			current["update_time"] = time.Now().UTC().Format(time.RFC3339)
			data = state.robots[index]
		} else if method == http.MethodPatch {
			data = map[string]any{"secret": fmt.Sprintf("demo-secret-%s-R9p4", query.Get("id"))}
		} else {
			state.robots = append(state.robots[:index], state.robots[index+1:]...)
		}

	default:
		handled = false
	}
	return
}

// handleLabelControl serves global and project label definitions.
func (state *demoState) handleLabelControl(
	w http.ResponseWriter,
	method, operation string,
	query url.Values,
	body map[string]any,
) (handled bool, status int, data any, errStatus int, errMessage string) {
	handled = true
	status = http.StatusOK

	switch operation {
	case "labels":
		if method == http.MethodGet {
			items := state.labels
			if scope := strings.TrimSpace(query.Get("scope")); scope != "" {
				filtered := make([]map[string]any, 0)
				for _, label := range items {
					if stringValue(label["scope"]) == scope {
						filtered = append(filtered, label)
					}
				}
				items = filtered
			}
			projectID, _ := strconv.ParseInt(query.Get("project_id"), 10, 64)
			if projectID > 0 {
				filtered := make([]map[string]any, 0)
				for _, label := range items {
					if numberValue(label["project_id"]) == projectID {
						filtered = append(filtered, label)
					}
				}
				items = filtered
			}
			if name := strings.TrimSpace(query.Get("name")); name != "" {
				items = filterMaps(items, name, "name")
			}
			state.writeList(w, items, query)
			return
		}
		state.nextLabelID++
		label := cloneMap(body)
		label["id"] = state.nextLabelID
		label["creation_time"] = time.Now().UTC().Format(time.RFC3339)
		state.labels = append(state.labels, label)
		status, data = http.StatusCreated, label

	case "label":
		index, found := findMapNumber(state.labels, "id", query.Get("id"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "项目标签不存在"
			break
		}
		if method == http.MethodGet {
			data = state.labels[index]
		} else if method == http.MethodPut {
			id, projectID := state.labels[index]["id"], state.labels[index]["project_id"]
			state.labels[index] = cloneMap(body)
			state.labels[index]["id"], state.labels[index]["project_id"] = id, projectID
			state.labels[index]["update_time"] = time.Now().UTC().Format(time.RFC3339)
			data = state.labels[index]
		} else {
			deletedID := numberValue(state.labels[index]["id"])
			state.labels = append(state.labels[:index], state.labels[index+1:]...)
			for repositoryName := range state.artifacts {
				for artifactIndex := range state.artifacts[repositoryName] {
					labels := labelsOf(state.artifacts[repositoryName][artifactIndex])
					filtered := labels[:0]
					for _, label := range labels {
						if numberValue(label["id"]) != deletedID {
							filtered = append(filtered, label)
						}
					}
					state.artifacts[repositoryName][artifactIndex]["labels"] = mapsToAny(filtered)
				}
			}
		}

	default:
		handled = false
	}
	return
}
