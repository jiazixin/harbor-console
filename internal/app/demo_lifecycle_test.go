package app

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
)

func TestDemoControlProjectAndTagMutations(t *testing.T) {
	application, err := newApp()
	if err != nil {
		t.Fatal(err)
	}
	handler := application.routes()
	login := httptest.NewRecorder()
	handler.ServeHTTP(login, httptest.NewRequest(http.MethodPost, "/api/demo", strings.NewReader("{}")))
	cookie := login.Result().Cookies()[0]

	create := httptest.NewRequest(http.MethodPost, "/api/control/projects", strings.NewReader(`{"project_name":"release","storage_limit":53687091200,"registry_id":2,"metadata":{"public":"false","auto_scan":"false","proxy_speed_kb":"-1","max_upstream_conn":"10","proxy_cache_local_on_not_found":"true"}}`))
	create.AddCookie(cookie)
	created := httptest.NewRecorder()
	handler.ServeHTTP(created, create)
	if created.Code != http.StatusCreated {
		t.Fatalf("create status = %d, body = %s", created.Code, created.Body.String())
	}

	list := httptest.NewRequest(http.MethodGet, "/api/control/projects?page=1&page_size=100&name=release", nil)
	list.AddCookie(cookie)
	listed := httptest.NewRecorder()
	handler.ServeHTTP(listed, list)
	if listed.Code != http.StatusOK || !strings.Contains(listed.Body.String(), `"name":"release"`) || !strings.Contains(listed.Body.String(), `"registry_id":2`) || !strings.Contains(listed.Body.String(), `"storage_limit":53687091200`) || !strings.Contains(listed.Body.String(), `"auto_scan":"false"`) {
		t.Fatalf("list status = %d, body = %s", listed.Code, listed.Body.String())
	}

	quotas := httptest.NewRequest(http.MethodGet, "/api/control/quotas?page=1&page_size=100", nil)
	quotas.AddCookie(cookie)
	quotaList := httptest.NewRecorder()
	handler.ServeHTTP(quotaList, quotas)
	if quotaList.Code != http.StatusOK || !strings.Contains(quotaList.Body.String(), `"name":"release"`) || !strings.Contains(quotaList.Body.String(), `"storage":53687091200`) {
		t.Fatalf("quota list status = %d, body = %s", quotaList.Code, quotaList.Body.String())
	}

	tag := httptest.NewRequest(http.MethodPost, "/api/control/artifact-tags?project=platform&repository=platform%2Fgateway&reference=sha256%3A41bf0e3b54f9a760a6c1f0b170507173bf6d95f2e8db4dd79f858f31f36c28a4", strings.NewReader(`{"name":"stable"}`))
	tag.AddCookie(cookie)
	tagged := httptest.NewRecorder()
	handler.ServeHTTP(tagged, tag)
	if tagged.Code != http.StatusCreated {
		t.Fatalf("tag status = %d, body = %s", tagged.Code, tagged.Body.String())
	}

	const sourceDigest = "sha256:b4604fe30f9785345f61cb34209c2aa3053b67e24dd321caec892820646d9911"
	copyRequest := httptest.NewRequest(http.MethodPost, "/api/control/artifact-copy?project=commerce&repository=commerce%2Fgateway&from="+url.QueryEscape("platform/gateway@"+sourceDigest), nil)
	copyRequest.AddCookie(cookie)
	copied := httptest.NewRecorder()
	handler.ServeHTTP(copied, copyRequest)
	if copied.Code != http.StatusCreated {
		t.Fatalf("artifact copy status = %d, body = %s", copied.Code, copied.Body.String())
	}
	artifactRequest := httptest.NewRequest(http.MethodGet, "/api/control/artifact?project=commerce&repository=commerce%2Fgateway&reference="+url.QueryEscape(sourceDigest), nil)
	artifactRequest.AddCookie(cookie)
	artifact := httptest.NewRecorder()
	handler.ServeHTTP(artifact, artifactRequest)
	if artifact.Code != http.StatusOK || !strings.Contains(artifact.Body.String(), sourceDigest) {
		t.Fatalf("copied artifact was not persisted: %d %s", artifact.Code, artifact.Body.String())
	}

	const childDigest = "sha256:cf2df80ad906b495d13f65e450bfdbe64962b0b567886143a3200dd2b2b46861"
	childRequest := httptest.NewRequest(http.MethodGet, "/api/control/artifact?project=platform&repository=platform%2Fgateway&reference="+url.QueryEscape(childDigest), nil)
	childRequest.AddCookie(cookie)
	child := httptest.NewRecorder()
	handler.ServeHTTP(child, childRequest)
	if child.Code != http.StatusOK || !strings.Contains(child.Body.String(), childDigest) || !strings.Contains(child.Body.String(), `"architecture":"arm64"`) {
		t.Fatalf("multi-architecture child artifact is unavailable: %d %s", child.Code, child.Body.String())
	}

	artifactListRequest := httptest.NewRequest(http.MethodGet, "/api/control/artifacts?project=platform&repository=platform%2Fgateway&page=1&page_size=100", nil)
	artifactListRequest.AddCookie(cookie)
	artifactList := httptest.NewRecorder()
	handler.ServeHTTP(artifactList, artifactListRequest)
	var artifactCollection struct {
		Items []map[string]any `json:"items"`
	}
	if artifactList.Code != http.StatusOK || json.Unmarshal(artifactList.Body.Bytes(), &artifactCollection) != nil {
		t.Fatalf("artifact list is invalid: %d %s", artifactList.Code, artifactList.Body.String())
	}
	for _, listedArtifact := range artifactCollection.Items {
		if stringValue(listedArtifact["digest"]) != childDigest {
			continue
		}
		t.Fatalf("child manifest leaked into the top-level artifact list: %d %s", artifactList.Code, artifactList.Body.String())
	}
}

func TestDemoControlPreservesRobotTimesAndGCDryRun(t *testing.T) {
	application, err := newApp()
	if err != nil {
		t.Fatal(err)
	}
	handler := application.routes()
	login := httptest.NewRecorder()
	handler.ServeHTTP(login, httptest.NewRequest(http.MethodPost, "/api/demo", strings.NewReader("{}")))
	cookie := login.Result().Cookies()[0]

	robot := httptest.NewRequest(http.MethodPut, "/api/control/robot?id=41", strings.NewReader(`{"name":"robot$platform+ci-release","description":"已更新","level":"project","duration":365,"disable":false,"permissions":[{"kind":"project","namespace":"platform","access":[{"resource":"repository","action":"pull"}]}]}`))
	robot.AddCookie(cookie)
	robotRecorder := httptest.NewRecorder()
	handler.ServeHTTP(robotRecorder, robot)
	if robotRecorder.Code != http.StatusOK {
		t.Fatalf("robot update status = %d, body = %s", robotRecorder.Code, robotRecorder.Body.String())
	}
	if !strings.Contains(robotRecorder.Body.String(), `"creation_time"`) || !strings.Contains(robotRecorder.Body.String(), `"expires_at"`) {
		t.Fatalf("robot update dropped read-only times: %s", robotRecorder.Body.String())
	}

	gc := httptest.NewRequest(http.MethodPost, "/api/control/gc-schedule", strings.NewReader(`{"schedule":{"type":"Manual"},"parameters":{"dry_run":true}}`))
	gc.AddCookie(cookie)
	gcRecorder := httptest.NewRecorder()
	handler.ServeHTTP(gcRecorder, gc)
	if gcRecorder.Code != http.StatusCreated {
		t.Fatalf("gc status = %d, body = %s", gcRecorder.Code, gcRecorder.Body.String())
	}
	if !strings.Contains(gcRecorder.Body.String(), `"deleted":false`) || !strings.Contains(gcRecorder.Body.String(), `\"dry_run\":true`) {
		t.Fatalf("gc dry-run status is incorrect: %s", gcRecorder.Body.String())
	}
}

func TestDemoOfficialRobotReplicationAndRegistryMetadata(t *testing.T) {
	application, err := newApp()
	if err != nil {
		t.Fatal(err)
	}
	handler := application.routes()
	login := httptest.NewRecorder()
	handler.ServeHTTP(login, httptest.NewRequest(http.MethodPost, "/api/demo", strings.NewReader("{}")))
	cookie := login.Result().Cookies()[0]
	request := func(method, target, body string) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequest(method, target, strings.NewReader(body))
		req.AddCookie(cookie)
		recorder := httptest.NewRecorder()
		handler.ServeHTTP(recorder, req)
		return recorder
	}

	metadata := request(http.MethodGet, "/api/control/registry-adapter-infos", "")
	if metadata.Code != http.StatusOK || !strings.Contains(metadata.Body.String(), `"EndpointPatternTypeFix"`) || !strings.Contains(metadata.Body.String(), `"https://hub.docker.com"`) || !strings.Contains(metadata.Body.String(), `"ali-acr"`) {
		t.Fatalf("registry adapter metadata is incomplete: %d %s", metadata.Code, metadata.Body.String())
	}
	registryInfo := request(http.MethodGet, "/api/control/registry-info?id=0", "")
	if registryInfo.Code != http.StatusOK || !strings.Contains(registryInfo.Body.String(), `"supported_resource_filters"`) || !strings.Contains(registryInfo.Body.String(), `"event_based"`) {
		t.Fatalf("local registry replication capabilities are incomplete: %d %s", registryInfo.Code, registryInfo.Body.String())
	}
	permissions := request(http.MethodGet, "/api/control/permissions", "")
	if permissions.Code != http.StatusOK || !strings.Contains(permissions.Body.String(), `"system"`) || !strings.Contains(permissions.Body.String(), `"project"`) {
		t.Fatalf("robot permission metadata is incomplete: %d %s", permissions.Code, permissions.Body.String())
	}
	robotBody := `{"name":"ops","description":"系统自动化","level":"system","duration":90,"disable":false,"permissions":[{"kind":"system","namespace":"/","access":[{"resource":"registry","action":"read","effect":"allow"}]},{"kind":"project","namespace":"*","access":[{"resource":"repository","action":"pull","effect":"allow"}]}]}`
	createdRobot := request(http.MethodPost, "/api/control/robots", robotBody)
	if createdRobot.Code != http.StatusCreated || !strings.Contains(createdRobot.Body.String(), `"name":"robot$ops"`) || !strings.Contains(createdRobot.Body.String(), `"secret"`) {
		t.Fatalf("system robot create failed: %d %s", createdRobot.Code, createdRobot.Body.String())
	}

	tasks := request(http.MethodGet, "/api/control/replication-tasks?id=903&page=1&page_size=100&sort=-start_time", "")
	if tasks.Code != http.StatusOK || !strings.Contains(tasks.Body.String(), `"id":1906`) || !strings.Contains(tasks.Body.String(), `"InProgress"`) {
		t.Fatalf("replication task list failed: %d %s", tasks.Code, tasks.Body.String())
	}
	logResult := request(http.MethodGet, "/api/control/replication-task-log?id=903&task=1906", "")
	if logResult.Code != http.StatusOK || !strings.Contains(logResult.Body.String(), "正在传输镜像层") {
		t.Fatalf("replication task log failed: %d %s", logResult.Code, logResult.Body.String())
	}
	stopped := request(http.MethodPut, "/api/control/replication-execution?id=903", "")
	if stopped.Code != http.StatusOK || !strings.Contains(stopped.Body.String(), `"status":"Stopped"`) {
		t.Fatalf("replication stop failed: %d %s", stopped.Code, stopped.Body.String())
	}
	stoppedTasks := request(http.MethodGet, "/api/control/replication-tasks?id=903&page=1&page_size=100", "")
	if stoppedTasks.Code != http.StatusOK || !strings.Contains(stoppedTasks.Body.String(), `"status":"Stopped"`) {
		t.Fatalf("replication task status was not stopped: %d %s", stoppedTasks.Code, stoppedTasks.Body.String())
	}
}

func TestValidateReplicationPolicyOfficialFields(t *testing.T) {
	valid := map[string]any{
		"name":                         "生产镜像同步",
		"description":                  "同步带签核标签的发布镜像",
		"src_registry":                 nil,
		"dest_registry":                map[string]any{"id": float64(2)},
		"dest_namespace":               "production/releases",
		"dest_namespace_replace_count": float64(2),
		"trigger": map[string]any{
			"type":             "scheduled",
			"trigger_settings": map[string]any{"cron": "0 15 2 * * *"},
		},
		"filters": []any{
			map[string]any{"type": "name", "value": "platform/**"},
			map[string]any{"type": "tag", "value": "release-*", "decoration": "matches"},
			map[string]any{"type": "label", "value": []any{"已签核", "生产"}, "decoration": "matches"},
			map[string]any{"type": "resource", "value": "image"},
		},
		"replicate_deletion":        false,
		"override":                  true,
		"enabled":                   true,
		"speed":                     float64(2048),
		"copy_by_chunk":             true,
		"single_active_replication": true,
	}
	if err := validateReplicationPolicy(valid); err != nil {
		t.Fatalf("valid official replication policy rejected: %v", err)
	}
	valid["description"] = strings.Repeat("界", 1024)
	if err := validateReplicationPolicy(valid); err != nil {
		t.Fatalf("1024-character Unicode description rejected: %v", err)
	}
	valid["description"] = strings.Repeat("界", 1025)
	if err := validateReplicationPolicy(valid); err == nil {
		t.Fatal("1025-character Unicode description was accepted")
	}
	eventPolicy := map[string]any{
		"name":                         "event-sync",
		"src_registry":                 nil,
		"dest_registry":                map[string]any{"id": float64(2)},
		"trigger":                      map[string]any{"type": "event_based", "trigger_settings": map[string]any{}},
		"filters":                      []any{},
		"replicate_deletion":           true,
		"single_active_replication":    false,
		"dest_namespace_replace_count": float64(-1),
		"speed":                        float64(-1),
	}
	if err := validateReplicationPolicy(eventPolicy); err != nil {
		t.Fatalf("valid event replication policy rejected: %v", err)
	}
}

func TestValidateReplicationPolicyRejectsInvalidFields(t *testing.T) {
	base := func() map[string]any {
		return map[string]any{
			"name":          "release-sync",
			"src_registry":  nil,
			"dest_registry": map[string]any{"id": float64(1)},
			"trigger":       map[string]any{"type": "manual", "trigger_settings": map[string]any{}},
			"filters":       []any{},
			"enabled":       true,
			"override":      true,
			"speed":         float64(-1),
		}
	}
	tests := []struct {
		name   string
		mutate func(map[string]any)
	}{
		{name: "unknown top-level field", mutate: func(body map[string]any) { body["private_extension"] = true }},
		{name: "deprecated deletion field", mutate: func(body map[string]any) { body["deletion"] = true }},
		{name: "both registries", mutate: func(body map[string]any) { body["src_registry"] = map[string]any{"id": float64(2)} }},
		{name: "registry secret", mutate: func(body map[string]any) {
			body["dest_registry"] = map[string]any{"id": float64(1), "credential": map[string]any{"access_secret": "secret"}}
		}},
		{name: "invalid namespace", mutate: func(body map[string]any) { body["dest_namespace"] = "Production//Images" }},
		{name: "invalid flatten level", mutate: func(body map[string]any) { body["dest_namespace_replace_count"] = float64(9) }},
		{name: "invalid trigger", mutate: func(body map[string]any) {
			body["trigger"] = map[string]any{"type": "continuous", "trigger_settings": map[string]any{}}
		}},
		{name: "scheduled without cron", mutate: func(body map[string]any) {
			body["trigger"] = map[string]any{"type": "scheduled", "trigger_settings": map[string]any{"cron": ""}}
		}},
		{name: "invalid cron", mutate: func(body map[string]any) {
			body["trigger"] = map[string]any{"type": "scheduled", "trigger_settings": map[string]any{"cron": "* * * * *"}}
		}},
		{name: "unknown filter", mutate: func(body map[string]any) {
			body["filters"] = []any{map[string]any{"type": "vulnerability", "value": "high"}}
		}},
		{name: "invalid label value", mutate: func(body map[string]any) {
			body["filters"] = []any{map[string]any{"type": "label", "value": "production"}}
		}},
		{name: "invalid decoration", mutate: func(body map[string]any) {
			body["filters"] = []any{map[string]any{"type": "tag", "value": "latest", "decoration": "contains"}}
		}},
		{name: "invalid speed", mutate: func(body map[string]any) { body["speed"] = float64(0) }},
		{name: "invalid boolean", mutate: func(body map[string]any) { body["copy_by_chunk"] = "true" }},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			body := base()
			test.mutate(body)
			if err := validateReplicationPolicy(body); err == nil {
				t.Fatal("invalid replication policy was accepted")
			}
		})
	}
}

func TestDemoReplicationPolicyOfficialFieldLifecycle(t *testing.T) {
	application, err := newApp()
	if err != nil {
		t.Fatal(err)
	}
	current := createTestSession(t, application, nil, true)
	handler := application.routes()
	request := func(method, target, body string) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequest(method, target, strings.NewReader(body))
		req.AddCookie(&http.Cookie{Name: sessionCookie, Value: current.ID})
		if method != http.MethodGet {
			req.Host = "console.test"
			req.Header.Set("Origin", "http://console.test")
		}
		recorder := httptest.NewRecorder()
		handler.ServeHTTP(recorder, req)
		return recorder
	}
	createBody := `{"name":"release-complete","description":"完整字段策略","src_registry":null,"dest_registry":{"id":1},"dest_namespace":"production/releases","dest_namespace_replace_count":2,"trigger":{"type":"scheduled","trigger_settings":{"cron":"0 15 2 * * *"}},"filters":[{"type":"name","value":"platform/**"},{"type":"tag","value":"release-*","decoration":"matches"},{"type":"label","value":["已签核"],"decoration":"matches"},{"type":"resource","value":"image"}],"replicate_deletion":false,"override":true,"enabled":true,"speed":2048,"copy_by_chunk":true,"single_active_replication":true}`
	created := request(http.MethodPost, "/api/control/replication-policies", createBody)
	if created.Code != http.StatusCreated || !strings.Contains(created.Body.String(), `"name":"prod-registry"`) || !strings.Contains(created.Body.String(), `"copy_by_chunk":true`) || !strings.Contains(created.Body.String(), `"已签核"`) {
		t.Fatalf("complete replication policy create failed: %d %s", created.Code, created.Body.String())
	}
	var createdPayload struct {
		Data map[string]any `json:"data"`
	}
	if err := json.Unmarshal(created.Body.Bytes(), &createdPayload); err != nil {
		t.Fatal(err)
	}
	id := numberValue(createdPayload.Data["id"])
	if id <= 0 {
		t.Fatalf("created policy has invalid id: %s", created.Body.String())
	}
	updateBody := `{"name":"release-complete","description":"改为从归档仓库拉取","src_registry":{"id":3},"dest_registry":null,"dest_namespace":"archive","dest_namespace_replace_count":-1,"trigger":{"type":"manual","trigger_settings":{}},"filters":[{"type":"name","value":"archive/**"}],"replicate_deletion":false,"override":false,"enabled":false,"speed":-1,"copy_by_chunk":false,"single_active_replication":true}`
	updated := request(http.MethodPut, fmt.Sprintf("/api/control/replication-policy?id=%d", id), updateBody)
	if updated.Code != http.StatusOK || !strings.Contains(updated.Body.String(), `"name":"cold-backup"`) || !strings.Contains(updated.Body.String(), `"dest_namespace_replace_count":-1`) || !strings.Contains(updated.Body.String(), `"enabled":false`) {
		t.Fatalf("complete replication policy update failed: %d %s", updated.Code, updated.Body.String())
	}
	loaded := request(http.MethodGet, fmt.Sprintf("/api/control/replication-policy?id=%d", id), "")
	if loaded.Code != http.StatusOK || !strings.Contains(loaded.Body.String(), `"archive/**"`) || !strings.Contains(loaded.Body.String(), `"speed":-1`) {
		t.Fatalf("updated replication policy was not persisted: %d %s", loaded.Code, loaded.Body.String())
	}
	deleted := request(http.MethodDelete, fmt.Sprintf("/api/control/replication-policy?id=%d", id), "")
	if deleted.Code != http.StatusOK {
		t.Fatalf("replication policy delete failed: %d %s", deleted.Code, deleted.Body.String())
	}
	missing := request(http.MethodGet, fmt.Sprintf("/api/control/replication-policy?id=%d", id), "")
	if missing.Code != http.StatusNotFound {
		t.Fatalf("deleted replication policy still exists: %d %s", missing.Code, missing.Body.String())
	}
}

func TestDemoProjectScannerAndRetentionLifecycle(t *testing.T) {
	application, err := newApp()
	if err != nil {
		t.Fatal(err)
	}
	handler := application.routes()
	login := httptest.NewRecorder()
	handler.ServeHTTP(login, httptest.NewRequest(http.MethodPost, "/api/demo", strings.NewReader("{}")))
	cookie := login.Result().Cookies()[0]
	request := func(method, target, body string) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequest(method, target, strings.NewReader(body))
		req.AddCookie(cookie)
		recorder := httptest.NewRecorder()
		handler.ServeHTTP(recorder, req)
		return recorder
	}
	data := func(recorder *httptest.ResponseRecorder) map[string]any {
		t.Helper()
		var payload map[string]any
		if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
			t.Fatal(err)
		}
		mapped, _ := payload["data"].(map[string]any)
		return mapped
	}

	createdScanner := request(http.MethodPost, "/api/control/scanners", `{"name":"Clair","url":"http://clair-scanner:8080","auth":"","access_credential":""}`)
	if createdScanner.Code != http.StatusCreated {
		t.Fatalf("scanner create status = %d, body = %s", createdScanner.Code, createdScanner.Body.String())
	}
	scannerUUID := stringValue(data(createdScanner)["uuid"])
	setScanner := request(http.MethodPut, "/api/control/project-scanner?project=commerce", `{"uuid":"`+scannerUUID+`"}`)
	if setScanner.Code != http.StatusOK {
		t.Fatalf("scanner set status = %d, body = %s", setScanner.Code, setScanner.Body.String())
	}
	currentScanner := request(http.MethodGet, "/api/control/project-scanner?project=commerce", "")
	if currentScanner.Code != http.StatusOK || stringValue(data(currentScanner)["uuid"]) != scannerUUID {
		t.Fatalf("project scanner was not persisted: %d %s", currentScanner.Code, currentScanner.Body.String())
	}

	retentionBody := `{"algorithm":"or","rules":[{"priority":1,"disabled":false,"action":"retain","template":"latestPushedK","params":{"latestPushedK":5},"tag_selectors":[{"kind":"doublestar","decoration":"matches","pattern":"release-*"}],"scope_selectors":{"repository":[{"kind":"doublestar","decoration":"repoMatches","pattern":"**"}]}}],"trigger":{"kind":"Schedule","settings":{"cron":"0 0 3 * * *"}},"scope":{"level":"project","ref":2}}`
	createdRetention := request(http.MethodPost, "/api/control/retentions", retentionBody)
	if createdRetention.Code != http.StatusCreated {
		t.Fatalf("retention create status = %d, body = %s", createdRetention.Code, createdRetention.Body.String())
	}
	retentionID := int64(numberValue(data(createdRetention)["id"]))
	if retentionID <= 0 {
		t.Fatalf("invalid retention id: %s", createdRetention.Body.String())
	}
	run := request(http.MethodPost, fmt.Sprintf("/api/control/retention-executions?id=%d", retentionID), `{"dry_run":true}`)
	if run.Code != http.StatusCreated {
		t.Fatalf("retention run status = %d, body = %s", run.Code, run.Body.String())
	}
	runID := int64(numberValue(data(run)["id"]))
	stopped := request(http.MethodPatch, fmt.Sprintf("/api/control/retention-execution?id=%d&eid=%d", retentionID, runID), `{"action":"stop"}`)
	if stopped.Code != http.StatusOK || stringValue(data(stopped)["status"]) != "Stopped" {
		t.Fatalf("retention stop failed: %d %s", stopped.Code, stopped.Body.String())
	}
	deleted := request(http.MethodDelete, fmt.Sprintf("/api/control/retention?id=%d", retentionID), "")
	if deleted.Code != http.StatusOK {
		t.Fatalf("retention delete status = %d, body = %s", deleted.Code, deleted.Body.String())
	}
	project := request(http.MethodGet, "/api/control/project?project=commerce", "")
	metadata, _ := data(project)["metadata"].(map[string]any)
	if stringValue(metadata["retention_id"]) != "" {
		t.Fatalf("retention binding was not cleared: %s", project.Body.String())
	}
}

func TestDemoSecurityLifecycle(t *testing.T) {
	application, err := newApp()
	if err != nil {
		t.Fatal(err)
	}
	handler := application.routes()
	login := httptest.NewRecorder()
	handler.ServeHTTP(login, httptest.NewRequest(http.MethodPost, "/api/demo", strings.NewReader("{}")))
	cookie := login.Result().Cookies()[0]
	request := func(method, target, body string) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequest(method, target, strings.NewReader(body))
		req.AddCookie(cookie)
		recorder := httptest.NewRecorder()
		handler.ServeHTTP(recorder, req)
		return recorder
	}
	readData := func(recorder *httptest.ResponseRecorder) map[string]any {
		t.Helper()
		var payload map[string]any
		if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
			t.Fatal(err)
		}
		mapped, _ := payload["data"].(map[string]any)
		return mapped
	}

	summary := request(http.MethodGet, "/api/control/security-summary?with_dangerous_cve=true&with_dangerous_artifact=true", "")
	if summary.Code != http.StatusOK || numberValue(readData(summary)["total_vuls"]) < 4 {
		t.Fatalf("security summary failed: %d %s", summary.Code, summary.Body.String())
	}
	critical := request(http.MethodGet, "/api/control/security-vulnerabilities?page=1&page_size=20&q=severity%3DCritical&with_tag=true", "")
	if critical.Code != http.StatusOK || !strings.Contains(critical.Body.String(), `"total":2`) {
		t.Fatalf("security vulnerability filter failed: %d %s", critical.Code, critical.Body.String())
	}

	digest := "sha256:41bf0e3b54f9a760a6c1f0b170507173bf6d95f2e8db4dd79f858f31f36c28a4"
	artifactPath := "/api/control/artifact?project=platform&repository=platform%2Fgateway&reference=" + url.QueryEscape(digest) + "&with_scan_overview=true&with_sbom_overview=true"
	startedSBOM := request(http.MethodPost, "/api/control/artifact-scan?project=platform&repository=platform%2Fgateway&reference="+url.QueryEscape(digest), `{"scan_type":"sbom"}`)
	if startedSBOM.Code != http.StatusAccepted {
		t.Fatalf("sbom scan start failed: %d %s", startedSBOM.Code, startedSBOM.Body.String())
	}
	artifactAfterStart := request(http.MethodGet, artifactPath, "")
	if artifactAfterStart.Code != http.StatusOK || !strings.Contains(artifactAfterStart.Body.String(), `"scan_status":"Running"`) {
		t.Fatalf("sbom scan status was not running: %d %s", artifactAfterStart.Code, artifactAfterStart.Body.String())
	}
	stoppedSBOM := request(http.MethodPost, "/api/control/artifact-scan-stop?project=platform&repository=platform%2Fgateway&reference="+url.QueryEscape(digest), `{"scan_type":"sbom"}`)
	if stoppedSBOM.Code != http.StatusAccepted {
		t.Fatalf("sbom scan stop failed: %d %s", stoppedSBOM.Code, stoppedSBOM.Body.String())
	}
	scanLog := request(http.MethodGet, "/api/control/artifact-scan-log?project=platform&repository=platform%2Fgateway&reference="+url.QueryEscape(digest)+"&report=demo-vuln-41bf0e3b54f9", "")
	if scanLog.Code != http.StatusOK || !strings.Contains(scanLog.Body.String(), "漏洞扫描完成") {
		t.Fatalf("artifact scan log failed: %d %s", scanLog.Code, scanLog.Body.String())
	}

	allowlistBody := `{"expires_at":null,"items":[{"cve_id":"CVE-2026-0917"}]}`
	updatedAllowlist := request(http.MethodPut, "/api/control/system-cve-allowlist", allowlistBody)
	if updatedAllowlist.Code != http.StatusOK {
		t.Fatalf("allowlist update failed: %d %s", updatedAllowlist.Code, updatedAllowlist.Body.String())
	}
	allowlist := request(http.MethodGet, "/api/control/system-cve-allowlist", "")
	if allowlist.Code != http.StatusOK || !strings.Contains(allowlist.Body.String(), "CVE-2026-0917") {
		t.Fatalf("allowlist was not persisted: %d %s", allowlist.Code, allowlist.Body.String())
	}
	certificate := request(http.MethodGet, "/api/control/system-root-certificate", "")
	if certificate.Code != http.StatusOK || !strings.Contains(certificate.Header().Get("Content-Disposition"), "harbor-ca.crt") || !strings.Contains(certificate.Body.String(), "BEGIN CERTIFICATE") {
		t.Fatalf("root certificate download failed: %d %s", certificate.Code, certificate.Body.String())
	}
	projectAllowlistBody := `{"metadata":{"reuse_sys_cve_allowlist":"false"},"cve_allowlist":{"expires_at":1893455999,"items":[{"cve_id":"CVE-2026-1842"}]}}`
	updatedProject := request(http.MethodPut, "/api/control/project?project=platform", projectAllowlistBody)
	if updatedProject.Code != http.StatusOK {
		t.Fatalf("project allowlist update failed: %d %s", updatedProject.Code, updatedProject.Body.String())
	}
	project := request(http.MethodGet, "/api/control/project?project=platform", "")
	if project.Code != http.StatusOK || !strings.Contains(project.Body.String(), `"reuse_sys_cve_allowlist":"false"`) || !strings.Contains(project.Body.String(), "CVE-2026-1842") {
		t.Fatalf("project allowlist was not persisted: %d %s", project.Code, project.Body.String())
	}

	created := request(http.MethodPost, "/api/control/cve-export", `{"projects":[1],"labels":[],"repositories":"platform/**"}`)
	if created.Code != http.StatusOK {
		t.Fatalf("cve export create failed: %d %s", created.Code, created.Body.String())
	}
	exportID := int64(numberValue(readData(created)["id"]))
	if exportID <= 501 {
		t.Fatalf("invalid export id: %s", created.Body.String())
	}
	executions := request(http.MethodGet, "/api/control/cve-export-executions", "")
	if executions.Code != http.StatusOK || !strings.Contains(executions.Body.String(), fmt.Sprintf(`"id":%d`, exportID)) {
		t.Fatalf("cve export execution missing: %d %s", executions.Code, executions.Body.String())
	}
	download := request(http.MethodGet, fmt.Sprintf("/api/control/cve-export-download?id=%d&format=CSV", exportID), "")
	if download.Code != http.StatusOK || !strings.Contains(download.Header().Get("Content-Type"), "text/csv") || !strings.Contains(download.Body.String(), "CVE-2026-1842") {
		t.Fatalf("cve export download failed: %d %s", download.Code, download.Body.String())
	}
}

func TestDemoDashboardHasSortableDrillDownAssets(t *testing.T) {
	state := newDemoState()
	dashboard := state.dashboard()
	statistics, _ := dashboard["statistics"].(map[string]any)
	if got := numberValue(statistics["total_repo_count"]); got != 86 {
		t.Fatalf("demo repository total = %d, want 86", got)
	}
	projects, _ := dashboard["projects"].([]any)
	if len(projects) != 6 {
		t.Fatalf("demo project count = %d, want 6", len(projects))
	}
	repositoryCounts := make(map[int64]bool)
	storageValues := make(map[int64]bool)
	for _, rawProject := range projects {
		project, _ := rawProject.(map[string]any)
		repositoryCounts[numberValue(project["repo_count"])] = true
		storageValues[numberValue(project["storage_used"])] = true
		name := stringValue(project["name"])
		if len(state.repositories[name]) == 0 || len(state.artifacts[stringValue(state.repositories[name][0]["name"])]) == 0 {
			t.Fatalf("project %q does not have drill-down assets", name)
		}
	}
	if len(repositoryCounts) < 4 || len(storageValues) < 4 {
		t.Fatalf("demo assets are not varied enough for sorting: repositories=%v storage=%v", repositoryCounts, storageValues)
	}
	policies, _ := dashboard["replication_policies"].([]any)
	if len(policies) != len(state.policies) {
		t.Fatalf("demo replication policies = %d, want %d", len(policies), len(state.policies))
	}
}

func TestDemoProjectsHonorNameSort(t *testing.T) {
	state := newDemoState()
	recorder := httptest.NewRecorder()
	state.writeList(recorder, state.projects, url.Values{"page": {"1"}, "page_size": {"50"}, "sort": {"name"}})
	if recorder.Code != http.StatusOK {
		t.Fatalf("demo project list status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
	var payload struct {
		Items []map[string]any `json:"items"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	if len(payload.Items) != 6 || stringValue(payload.Items[0]["name"]) != "commerce" || stringValue(payload.Items[5]["name"]) != "sandbox" {
		t.Fatalf("projects are not sorted by name: %#v", payload.Items)
	}
}

func TestDemoProjectsHonorBothSortDirections(t *testing.T) {
	state := newDemoState()
	for _, sortValue := range []string{"project_id", "-project_id", "name", "-name", "repo_count", "-repo_count", "update_time", "-update_time"} {
		recorder := httptest.NewRecorder()
		state.writeList(recorder, state.projects, url.Values{"page": {"1"}, "page_size": {"50"}, "sort": {sortValue}})
		if recorder.Code != http.StatusOK {
			t.Fatalf("sort %q status = %d, body = %s", sortValue, recorder.Code, recorder.Body.String())
		}
		var payload struct {
			Items []map[string]any `json:"items"`
		}
		if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
			t.Fatal(err)
		}
		if len(payload.Items) != len(state.projects) {
			t.Fatalf("sort %q returned %d projects, want %d", sortValue, len(payload.Items), len(state.projects))
		}
	}
}

func TestDemoVolumesUseOfficialSystemInfoShape(t *testing.T) {
	payload, ok := demoResource("volumes", nil)
	if !ok {
		t.Fatal("demo volumes are missing")
	}
	systemInfo, ok := payload.(map[string]any)
	if !ok {
		t.Fatalf("demo volumes type = %T, want map", payload)
	}
	volumes, ok := systemInfo["storage"].([]any)
	if !ok || len(volumes) == 0 {
		t.Fatalf("demo storage = %#v, want official storage array", systemInfo["storage"])
	}
	storage, _ := volumes[0].(map[string]any)
	if numberValue(storage["total"]) <= 0 || numberValue(storage["free"]) <= 0 {
		t.Fatalf("demo storage values are invalid: %#v", storage)
	}
}

func TestDemoEventAndJobObservabilityLifecycle(t *testing.T) {
	application, err := newApp()
	if err != nil {
		t.Fatal(err)
	}
	current := createTestSession(t, application, http.DefaultClient, true)
	request := func(method, target, body string, want int) string {
		t.Helper()
		req := httptest.NewRequest(method, target, strings.NewReader(body))
		req.AddCookie(&http.Cookie{Name: sessionCookie, Value: current.ID})
		if method != http.MethodGet {
			req.Host = "console.test"
			req.Header.Set("Origin", "http://console.test")
		}
		recorder := httptest.NewRecorder()
		application.routes().ServeHTTP(recorder, req)
		if recorder.Code != want {
			t.Fatalf("%s %s status = %d, want %d; body = %s", method, target, recorder.Code, want, recorder.Body.String())
		}
		return recorder.Body.String()
	}

	if body := request(http.MethodGet, "/api/control/webhook-executions?project=platform&id=41&page=1&page_size=20", "", http.StatusOK); !strings.Contains(body, `"id":91`) {
		t.Fatalf("webhook history missing demo execution: %s", body)
	}
	if body := request(http.MethodGet, "/api/control/webhook-tasks?project=platform&id=41&execution=91&page=1&page_size=20", "", http.StatusOK); !strings.Contains(body, `"id":191`) {
		t.Fatalf("webhook tasks missing demo task: %s", body)
	}
	if body := request(http.MethodGet, "/api/control/webhook-task-log?project=platform&id=41&execution=91&task=191", "", http.StatusOK); !strings.Contains(body, "webhook delivered") {
		t.Fatalf("webhook log missing content: %s", body)
	}
	if body := request(http.MethodGet, "/api/control/retention-tasks?id=31&eid=71&page=1&page_size=20", "", http.StatusOK); !strings.Contains(body, `"repository":"platform/gateway"`) {
		t.Fatalf("retention tasks missing repository result: %s", body)
	}
	if body := request(http.MethodGet, "/api/control/retention-task-log?id=31&eid=71&tid=171", "", http.StatusOK); !strings.Contains(body, "retained 10 tags") {
		t.Fatalf("retention log missing content: %s", body)
	}

	purgeBody := `{"schedule":{"type":"Manual"},"parameters":{"audit_retention_hour":168,"dry_run":true,"include_event_types":"create_artifact,delete_artifact"}}`
	if body := request(http.MethodPost, "/api/control/purge-schedule", purgeBody, http.StatusCreated); !strings.Contains(body, `"id":402`) {
		t.Fatalf("manual purge did not create an execution: %s", body)
	}
	if body := request(http.MethodPut, "/api/control/purge-job?id=402", "", http.StatusOK); !strings.Contains(body, `"job_status":"Stopped"`) {
		t.Fatalf("purge execution was not stopped: %s", body)
	}
	if body := request(http.MethodGet, "/api/control/purge-log?id=402", "", http.StatusOK); !strings.Contains(body, "retention threshold") {
		t.Fatalf("purge log missing content: %s", body)
	}

	request(http.MethodPut, "/api/control/jobservice-queue?type=IMAGE_SCAN", `{"action":"pause"}`, http.StatusOK)
	if body := request(http.MethodGet, "/api/control/jobservice-queues", "", http.StatusOK); !strings.Contains(body, `"job_type":"IMAGE_SCAN","latency":18,"paused":true`) {
		t.Fatalf("queue pause state was not retained: %s", body)
	}
	request(http.MethodPut, "/api/control/jobservice-job?job=job-scan-1001", "", http.StatusOK)
	if body := request(http.MethodGet, "/api/control/jobservice-workers?pool=all", "", http.StatusOK); strings.Contains(body, `"job_id":"job-scan-1001"`) {
		t.Fatalf("stopped job is still assigned to a worker: %s", body)
	}
}

func TestDemoDirectoryAndScannerMetadataLifecycle(t *testing.T) {
	application, err := newApp()
	if err != nil {
		t.Fatal(err)
	}
	current := createTestSession(t, application, http.DefaultClient, true)
	request := func(method, target, body string, want int) string {
		t.Helper()
		req := httptest.NewRequest(method, target, strings.NewReader(body))
		req.AddCookie(&http.Cookie{Name: sessionCookie, Value: current.ID})
		if method != http.MethodGet {
			req.Host = "console.test"
			req.Header.Set("Origin", "http://console.test")
		}
		recorder := httptest.NewRecorder()
		application.routes().ServeHTTP(recorder, req)
		if recorder.Code != want {
			t.Fatalf("%s %s status = %d, want %d; body = %s", method, target, recorder.Code, want, recorder.Body.String())
		}
		return recorder.Body.String()
	}

	if body := request(http.MethodGet, "/api/control/ldap-users-search?username=build", "", http.StatusOK); !strings.Contains(body, `"username":"build-engineer"`) {
		t.Fatalf("LDAP search did not return the demo candidate: %s", body)
	}
	request(http.MethodPost, "/api/control/ldap-users-import", `{"ldap_uid_list":["build-engineer"]}`, http.StatusOK)
	if body := request(http.MethodGet, "/api/control/users?page=1&page_size=100&q=username%3D~build-engineer", "", http.StatusOK); !strings.Contains(body, `"username":"build-engineer"`) {
		t.Fatalf("imported LDAP user is missing from Harbor users: %s", body)
	}
	if body := request(http.MethodGet, "/api/control/ldap-users-search?username=build", "", http.StatusOK); strings.Contains(body, `"username":"build-engineer"`) {
		t.Fatalf("imported LDAP user remained in the import candidates: %s", body)
	}
	groupSearch := request(http.MethodGet, "/api/control/ldap-groups-search?groupname=release", "", http.StatusOK)
	if !strings.Contains(groupSearch, `"group_name":"release-managers"`) {
		t.Fatalf("LDAP group search did not return the demo group: %s", groupSearch)
	}
	request(http.MethodPost, "/api/control/project-members?project=platform", `{"role_id":4,"member_group":{"group_name":"release-managers","group_type":1,"ldap_group_dn":"cn=release-managers,ou=groups,dc=demo,dc=local"}}`, http.StatusCreated)
	if body := request(http.MethodGet, "/api/control/project-members?project=platform&page=1&page_size=100&entityname=release-managers", "", http.StatusOK); !strings.Contains(body, `"entity_type":"g"`) {
		t.Fatalf("project group member was not retained: %s", body)
	}
	if body := request(http.MethodGet, "/api/control/scanner-metadata?id=00000000-0000-4000-8000-000000000001", "", http.StatusOK); !strings.Contains(body, `"type":"vulnerability"`) || !strings.Contains(body, `"type":"sbom"`) {
		t.Fatalf("scanner metadata is incomplete: %s", body)
	}
}

func createTestSession(t *testing.T, application *app, client *http.Client, demo bool) *session {
	t.Helper()
	current := &session{InstanceURL: "https://harbor.test", Username: "admin", Password: "password", Client: client, Demo: demo}
	if demo {
		current.DemoData = newDemoState()
	}
	if err := application.sessions.create(current); err != nil {
		t.Fatal(err)
	}
	return current
}
