package app

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"harbor-console/internal/timefmt"
)

// handleArtifactControl serves artifacts, their accessories and build additions.
func (ds *demoState) handleArtifactControl(w http.ResponseWriter, request demoControlRequest) (handled bool, status int, data any, errStatus int, errMessage string) {
	method, operation, query := request.method, request.operation, request.query
	handled = true
	status = http.StatusOK

	switch operation {
	case "artifact-copy":
		targetRepository := query.Get("repository")
		if !strings.HasPrefix(targetRepository, query.Get("project")+"/") {
			targetRepository = query.Get("project") + "/" + targetRepository
		}
		if _, found := ds.artifacts[targetRepository]; !found {
			errStatus, errMessage = http.StatusNotFound, "target repository not found"
			break
		}
		sourceRepository, sourceReference, found := splitDemoArtifactSource(query.Get("from"))
		if !found {
			errStatus, errMessage = http.StatusBadRequest, "invalid copy source"
			break
		}
		sourceIndex, found := findArtifact(ds.artifacts[sourceRepository], sourceReference)
		if !found {
			errStatus, errMessage = http.StatusNotFound, "copy source artifact not found"
			break
		}
		source := ds.artifacts[sourceRepository][sourceIndex]
		if _, exists := findArtifact(ds.artifacts[targetRepository], stringValue(source["digest"])); exists {
			errStatus, errMessage = http.StatusConflict, "artifact already exists in the target repository"
			break
		}
		copied := cloneMap(source)
		ds.nextArtifactID++
		copied["id"] = ds.nextArtifactID
		copied["push_time"] = ds.now().UTC().Format(timefmt.Layout)
		copied["pull_time"] = nil
		copied["labels"] = []any{}
		copied["accessories"] = []any{}
		delete(copied, "demo_child")
		if strings.Contains(query.Get("from"), ":") && !strings.Contains(query.Get("from"), "@") {
			copied["tags"] = []any{map[string]any{"id": 1, "name": sourceReference, "push_time": copied["push_time"], "immutable": false}}
		} else {
			copied["tags"] = []any{}
		}
		ds.artifacts[targetRepository] = append([]map[string]any{copied}, ds.artifacts[targetRepository]...)
		ds.updateArtifactCount(demoArtifactCount{repositories: ds.repositories, project: query.Get("project"), repository: targetRepository, count: len(demoVisibleArtifacts(ds.artifacts[targetRepository]))})
		status = http.StatusCreated

	case "artifacts":
		repositoryName := query.Get("repository")
		items, found := ds.artifacts[repositoryName]
		if !found {
			errStatus, errMessage = http.StatusNotFound, "repository not found"
			break
		}
		ds.writeList(w, demoVisibleArtifacts(items), query)
		return

	case "artifact":
		repositoryName := query.Get("repository")
		index, found := findArtifact(ds.artifacts[repositoryName], query.Get("reference"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "artifact not found"
			break
		}
		if method == http.MethodGet {
			data = ds.artifacts[repositoryName][index]
		} else {
			ds.artifacts[repositoryName] = append(ds.artifacts[repositoryName][:index], ds.artifacts[repositoryName][index+1:]...)
			ds.updateArtifactCount(demoArtifactCount{repositories: ds.repositories, project: query.Get("project"), repository: repositoryName, count: len(demoVisibleArtifacts(ds.artifacts[repositoryName]))})
		}

	case "artifact-accessories":
		repositoryName := query.Get("repository")
		artifactIndex, found := findArtifact(ds.artifacts[repositoryName], query.Get("reference"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "artifact not found"
			break
		}
		accessories, _ := ds.artifacts[repositoryName][artifactIndex]["accessories"].([]any)
		ds.writeListAny(w, accessories, query)
		return

	case "artifact-icon":
		if query.Get("digest") != demoArtifactIconDigest {
			errStatus, errMessage = http.StatusNotFound, "artifact icon not found"
			break
		}
		data = map[string]any{"content-type": "image/png", "content": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL07wAAAABJRU5ErkJggg=="}

	case "artifact-addition":
		repositoryName := query.Get("repository")
		if _, found := findArtifact(ds.artifacts[repositoryName], query.Get("reference")); !found {
			errStatus, errMessage = http.StatusNotFound, "artifact not found"
			break
		}
		addition, found := demoArtifactAddition(query.Get("addition"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "artifact has no such addition"
			break
		}
		data = addition

	default:
		handled = false
	}
	return
}

// handleArtifactReferenceControl serves the tags and labels attached to an artifact.
func (ds *demoState) handleArtifactReferenceControl(w http.ResponseWriter, request demoControlRequest) (handled bool, status int, data any, errStatus int, errMessage string) {
	method, operation, query, body := request.method, request.operation, request.query, request.body
	handled = true
	status = http.StatusOK

	switch operation {
	case "artifact-tags":
		repositoryName := query.Get("repository")
		index, found := findArtifact(ds.artifacts[repositoryName], query.Get("reference"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "artifact not found"
			break
		}
		if method == http.MethodGet {
			ds.writeListAny(w, mapsToAny(tagsOf(ds.artifacts[repositoryName][index])), query)
			return
		}
		tagName := stringValue(body["name"])
		tags := tagsOf(ds.artifacts[repositoryName][index])
		for _, tag := range tags {
			if stringValue(tag["name"]) == tagName {
				errStatus, errMessage = http.StatusConflict, "tag already exists"
				break
			}
		}
		if errStatus != 0 {
			break
		}
		tag := map[string]any{"id": len(tags) + 1, "name": tagName, "push_time": ds.now().UTC().Format(timefmt.Layout), "immutable": false}
		tags = append(tags, tag)
		ds.artifacts[repositoryName][index]["tags"] = mapsToAny(tags)
		status, data = http.StatusCreated, tag

	case "artifact-tag":
		repositoryName := query.Get("repository")
		index, found := findArtifact(ds.artifacts[repositoryName], query.Get("reference"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "artifact not found"
			break
		}
		tags := tagsOf(ds.artifacts[repositoryName][index])
		tagIndex, found := findMap(tags, "name", query.Get("tag"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "tag not found"
			break
		}
		if immutable, _ := tags[tagIndex]["immutable"].(bool); immutable {
			errStatus, errMessage = http.StatusPreconditionFailed, "immutable tag cannot be deleted"
			break
		}
		tags = append(tags[:tagIndex], tags[tagIndex+1:]...)
		ds.artifacts[repositoryName][index]["tags"] = mapsToAny(tags)

	case "artifact-labels":
		repositoryName := query.Get("repository")
		artifactIndex, found := findArtifact(ds.artifacts[repositoryName], query.Get("reference"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "artifact not found"
			break
		}
		labelID := numberValue(body["id"])
		labelIndex, found := findMapNumber(ds.labels, "id", strconv.FormatInt(labelID, 10))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "label not found"
			break
		}
		labels := labelsOf(ds.artifacts[repositoryName][artifactIndex])
		if _, attached := findMapNumber(labels, "id", strconv.FormatInt(labelID, 10)); attached {
			errStatus, errMessage = http.StatusConflict, "label already attached to the artifact"
			break
		}
		label := ds.labels[labelIndex]
		projectID := numberValue(projectID(ds.projects, query.Get("project")))
		if stringValue(label["scope"]) == "p" && numberValue(label["project_id"]) != projectID {
			errStatus, errMessage = http.StatusForbidden, "cannot attach a label of another project"
			break
		}
		labels = append(labels, cloneMap(label))
		ds.artifacts[repositoryName][artifactIndex]["labels"] = mapsToAny(labels)

	case "artifact-label":
		repositoryName := query.Get("repository")
		artifactIndex, found := findArtifact(ds.artifacts[repositoryName], query.Get("reference"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "artifact not found"
			break
		}
		labels := labelsOf(ds.artifacts[repositoryName][artifactIndex])
		labelIndex, found := findMapNumber(labels, "id", query.Get("label"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "label not attached to the artifact"
			break
		}
		labels = append(labels[:labelIndex], labels[labelIndex+1:]...)
		ds.artifacts[repositoryName][artifactIndex]["labels"] = mapsToAny(labels)

	default:
		handled = false
	}
	return
}

// handleArtifactScanControl serves artifact scans and their vulnerability reports.
func (ds *demoState) handleArtifactScanControl(w http.ResponseWriter, request demoControlRequest) (handled bool, status int, data any, errStatus int, errMessage string) {
	operation, query, body := request.operation, request.query, request.body
	handled = true
	status = http.StatusOK

	switch operation {
	case "artifact-scan":
		repositoryName := query.Get("repository")
		index, found := findArtifact(ds.artifacts[repositoryName], query.Get("reference"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "artifact not found"
			break
		}
		artifactItem := ds.artifacts[repositoryName][index]
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
				report["start_time"] = ds.now().UTC().Format(timefmt.Layout)
			}
		}
		status = http.StatusAccepted

	case "artifact-scan-stop":
		repositoryName := query.Get("repository")
		index, found := findArtifact(ds.artifacts[repositoryName], query.Get("reference"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "artifact not found"
			break
		}
		overviewKey := "scan_overview"
		if stringValue(body["scan_type"]) == "sbom" {
			overviewKey = "sbom_overview"
		}
		overview, _ := ds.artifacts[repositoryName][index][overviewKey].(map[string]any)
		for _, raw := range overview {
			if report, ok := raw.(map[string]any); ok {
				report["scan_status"] = "Stopped"
				report["end_time"] = ds.now().UTC().Format(timefmt.Layout)
			}
		}
		status = http.StatusAccepted

	case "artifact-scan-log":
		repositoryName := query.Get("repository")
		if _, found := findArtifact(ds.artifacts[repositoryName], query.Get("reference")); !found {
			errStatus, errMessage = http.StatusNotFound, "artifact not found"
			break
		}
		data = "2026-07-28T06:40:00Z [INFO] pulling the vulnerability database\n2026-07-28T06:40:03Z [INFO] analyzing system packages\n2026-07-28T06:40:11Z [INFO] vulnerability scan completed\n"

	case "artifact-vulnerabilities":
		repositoryName := query.Get("repository")
		_, found := findArtifact(ds.artifacts[repositoryName], query.Get("reference"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "artifact not found"
			break
		}
		data = demoVulnerabilityReport(ds.now())

	default:
		handled = false
	}
	return
}

// handleRobotControl serves robot accounts.
func (ds *demoState) handleRobotControl(w http.ResponseWriter, request demoControlRequest) (handled bool, status int, data any, errStatus int, errMessage string) {
	method, operation, query, body := request.method, request.operation, request.query, request.body
	handled = true
	status = http.StatusOK

	switch operation {
	case "robots":
		if method == http.MethodGet {
			items := ds.robots
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
			ds.writeList(w, items, query)
			return
		}
		ds.nextRobotID++
		robot := cloneMap(body)
		namespace := demoRobotNamespace(robot)
		robot["id"] = ds.nextRobotID
		if stringValue(robot["level"]) == "system" {
			robot["name"] = "robot$" + stringValue(robot["name"])
		} else {
			robot["name"] = "robot$" + namespace + "+" + stringValue(robot["name"])
		}
		robot["project_id"] = numberValue(projectID(ds.projects, namespace))
		robot["editable"] = true
		robot["creation_time"] = ds.now().UTC().Format(timefmt.Layout)
		duration := numberValue(robot["duration"])
		if duration < 0 {
			robot["expires_at"] = -1
		} else {
			robot["expires_at"] = ds.now().Add(time.Duration(duration) * 24 * time.Hour).Unix()
		}
		ds.robots = append(ds.robots, robot)
		status = http.StatusCreated
		data = map[string]any{"id": ds.nextRobotID, "name": robot["name"], "secret": fmt.Sprintf("demo-secret-%d-X7k2", ds.nextRobotID), "creation_time": robot["creation_time"], "expires_at": robot["expires_at"]}

	case "robot":
		index, found := findMapNumber(ds.robots, "id", query.Get("id"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "robot account not found"
			break
		}
		if method == http.MethodGet {
			data = ds.robots[index]
		} else if method == http.MethodPut {
			current := ds.robots[index]
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
					current["expires_at"] = ds.now().Add(time.Duration(newDuration) * 24 * time.Hour).Unix()
				}
			}
			current["update_time"] = ds.now().UTC().Format(timefmt.Layout)
			data = ds.robots[index]
		} else if method == http.MethodPatch {
			data = map[string]any{"secret": fmt.Sprintf("demo-secret-%s-R9p4", query.Get("id"))}
		} else {
			ds.robots = append(ds.robots[:index], ds.robots[index+1:]...)
		}

	default:
		handled = false
	}
	return
}

// handleLabelControl serves global and project label definitions.
func (ds *demoState) handleLabelControl(w http.ResponseWriter, request demoControlRequest) (handled bool, status int, data any, errStatus int, errMessage string) {
	method, operation, query, body := request.method, request.operation, request.query, request.body
	handled = true
	status = http.StatusOK

	switch operation {
	case "labels":
		if method == http.MethodGet {
			items := ds.labels
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
			ds.writeList(w, items, query)
			return
		}
		ds.nextLabelID++
		label := cloneMap(body)
		label["id"] = ds.nextLabelID
		label["creation_time"] = ds.now().UTC().Format(timefmt.Layout)
		ds.labels = append(ds.labels, label)
		status, data = http.StatusCreated, label

	case "label":
		index, found := findMapNumber(ds.labels, "id", query.Get("id"))
		if !found {
			errStatus, errMessage = http.StatusNotFound, "project label not found"
			break
		}
		if method == http.MethodGet {
			data = ds.labels[index]
		} else if method == http.MethodPut {
			id, projectID := ds.labels[index]["id"], ds.labels[index]["project_id"]
			ds.labels[index] = cloneMap(body)
			ds.labels[index]["id"], ds.labels[index]["project_id"] = id, projectID
			ds.labels[index]["update_time"] = ds.now().UTC().Format(timefmt.Layout)
			data = ds.labels[index]
		} else {
			deletedID := numberValue(ds.labels[index]["id"])
			ds.labels = append(ds.labels[:index], ds.labels[index+1:]...)
			for repositoryName := range ds.artifacts {
				for artifactIndex := range ds.artifacts[repositoryName] {
					labels := labelsOf(ds.artifacts[repositoryName][artifactIndex])
					filtered := labels[:0]
					for _, label := range labels {
						if numberValue(label["id"]) != deletedID {
							filtered = append(filtered, label)
						}
					}
					ds.artifacts[repositoryName][artifactIndex]["labels"] = mapsToAny(filtered)
				}
			}
		}

	default:
		handled = false
	}
	return
}
