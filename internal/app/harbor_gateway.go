package app

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
)

func (a *app) handleControl(w http.ResponseWriter, r *http.Request) {
	current, ok := a.currentSession(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "会话已失效", "请重新连接 Harbor")
		return
	}
	if len(r.URL.RawQuery) > maxQueryBytes {
		writeError(w, http.StatusBadRequest, "查询参数过长", "请缩短筛选条件后重试")
		return
	}
	operation := r.PathValue("operation")
	spec, ok := controlSpecs[operation]
	if !ok {
		writeError(w, http.StatusNotFound, "未知控制操作", "该操作不在 Harbor 官方 API 允许列表中")
		return
	}
	methodConfig, ok := spec.methods[r.Method]
	if !ok {
		w.Header().Set("Allow", allowedMethodHeader(spec.methods))
		writeError(w, http.StatusMethodNotAllowed, "操作方法不受支持", "该资源不允许使用 "+r.Method)
		return
	}
	if err := validateControlQueryKeys(spec, r.URL.Query()); err != nil {
		writeError(w, http.StatusBadRequest, "查询参数无效", err.Error())
		return
	}
	if r.Method != http.MethodGet && r.Method != http.MethodHead && !sameOrigin(r) {
		writeError(w, http.StatusForbidden, "请求来源无效", "请从当前控制台提交写操作")
		return
	}

	path, requestHeaders, err := buildControlPath(spec, r.URL.Query())
	if err != nil {
		writeError(w, http.StatusBadRequest, "路径参数无效", err.Error())
		return
	}
	query, err := buildControlQuery(spec.allowedQuery, r.URL.Query(), methodConfig.list)
	if err != nil {
		writeError(w, http.StatusBadRequest, "查询参数无效", err.Error())
		return
	}
	if spec.validateQuery != nil {
		if err := spec.validateQuery(query); err != nil {
			writeError(w, http.StatusBadRequest, "查询参数无效", err.Error())
			return
		}
	}
	body, decoded, err := readControlBody(w, r, methodConfig)
	if err != nil {
		writeError(w, http.StatusBadRequest, "请求内容无效", err.Error())
		return
	}
	if methodConfig.validate != nil {
		if err := methodConfig.validate(decoded); err != nil {
			writeError(w, http.StatusBadRequest, "请求内容无效", err.Error())
			return
		}
	}

	if current.Demo {
		current.DemoData.handleControl(w, r.Method, operation, r.URL.Query(), decoded)
		return
	}
	if operation == "system-cve-allowlist" && r.Method == http.MethodPut {
		response, err := a.updateSystemCVEAllowlist(r.Context(), current, path, decoded, requestHeaders)
		if err != nil {
			writeUpstreamError(w, err)
			return
		}
		writeControlResponse(w, response, methodConfig, query)
		return
	}
	if operation == "current-user-password" || operation == "current-user-cli-secret" {
		if err := a.requireCurrentUserID(r, current, r.URL.Query().Get("id")); err != nil {
			writeUpstreamError(w, err)
			return
		}
	}
	response, err := a.harborRequest(r.Context(), current, r.Method, path, query, body, requestHeaders)
	if err != nil {
		writeUpstreamError(w, err)
		return
	}
	if operation == "current-user-password" || operation == "current-user-cli-secret" {
		field := "new_password"
		if operation == "current-user-cli-secret" {
			field = "secret"
		}
		if password, ok := decoded[field].(string); ok {
			if err := a.sessions.updateInstancePassword(current.ID, current.ActiveInstance, password); err != nil {
				a.logger.Warn("updated Harbor credential but failed to refresh local connection", "connection_id", current.ActiveInstance, "error", err)
			}
		}
	}
	if methodConfig.head {
		w.WriteHeader(response.StatusCode)
		return
	}
	writeControlResponse(w, response, methodConfig, query)
}

func validateControlQueryKeys(spec controlSpec, input url.Values) error {
	allowed := make(map[string]struct{}, len(spec.params)+len(spec.allowedQuery))
	for _, parameter := range spec.params {
		allowed[parameter.name] = struct{}{}
	}
	for _, key := range spec.allowedQuery {
		allowed[key] = struct{}{}
	}
	for key := range input {
		if _, ok := allowed[key]; !ok {
			return fmt.Errorf("%s 不在该操作的允许参数中", key)
		}
	}
	return nil
}

func (a *app) requireCurrentUserID(r *http.Request, current *session, requestedID string) error {
	var user struct {
		UserID int64 `json:"user_id"`
	}
	if err := a.harborGetJSON(r.Context(), current, "/api/v2.0/users/current", nil, &user); err != nil {
		return err
	}
	actualID, err := strconv.ParseInt(requestedID, 10, 64)
	if err != nil || actualID <= 0 || actualID != user.UserID {
		return &upstreamError{StatusCode: http.StatusForbidden, Message: "credential update is limited to the current user"}
	}
	return nil
}

func buildControlPath(spec controlSpec, input url.Values) (string, http.Header, error) {
	path := spec.path
	headers := make(http.Header)
	for key, value := range spec.headers {
		headers.Set(key, value)
	}
	projectName := strings.TrimSpace(input.Get("project"))
	for _, parameter := range spec.params {
		value := strings.TrimSpace(input.Get(parameter.name))
		if err := validatePathParameter(value, parameter.name); err != nil {
			return "", nil, err
		}
		if parameter.numeric {
			parsed, err := strconv.ParseInt(value, 10, 64)
			if err != nil || parsed < 0 || (!parameter.allowZero && parsed == 0) {
				if parameter.allowZero {
					return "", nil, fmt.Errorf("%s 必须是 0 或正整数", parameter.name)
				}
				return "", nil, fmt.Errorf("%s 必须是正整数", parameter.name)
			}
		}
		if len(parameter.allowed) > 0 && !slicesContain(parameter.allowed, value) {
			return "", nil, fmt.Errorf("%s 不是允许的取值", parameter.name)
		}
		if parameter.name == "repository" && projectName != "" {
			value = strings.TrimPrefix(value, projectName+"/")
			if value == "" {
				return "", nil, errors.New("repository 不能只包含项目名称")
			}
		}
		encoded := url.PathEscape(value)
		if parameter.doubleEncode {
			encoded = url.PathEscape(encoded)
		}
		path = strings.ReplaceAll(path, "{"+parameter.placeholder+"}", encoded)
		if parameter.name == "project" {
			headers.Set("X-Is-Resource-Name", "true")
		}
	}
	return path, headers, nil
}

func validatePathParameter(value, name string) error {
	if value == "" {
		return fmt.Errorf("%s 是必填参数", name)
	}
	if len(value) > 1024 || strings.ContainsAny(value, "\r\n\x00") {
		return fmt.Errorf("%s 包含无效字符或长度过长", name)
	}
	// PathEscape leaves dot segments unchanged; upstream proxies may normalize
	// them and route outside the declared operation's path.
	for segment := range strings.SplitSeq(value, "/") {
		if segment == "." || segment == ".." {
			return fmt.Errorf("%s 不能包含路径跳转片段", name)
		}
	}
	return nil
}

func buildControlQuery(allowed []string, input url.Values, applyPaginationDefaults bool) (url.Values, error) {
	result := make(url.Values)
	for _, key := range allowed {
		values, exists := input[key]
		if !exists {
			continue
		}
		if len(values) > 4 {
			return nil, fmt.Errorf("%s 参数重复次数过多", key)
		}
		for _, value := range values {
			if len(value) > 2048 || strings.ContainsAny(value, "\r\n\x00") {
				return nil, fmt.Errorf("%s 参数包含无效字符或长度过长", key)
			}
			result.Add(key, value)
		}
	}
	if slicesContain(allowed, "page") && (applyPaginationDefaults || result.Has("page") || result.Has("page_size")) {
		page, err := positiveQueryInt(result.Get("page"), 1, 1_000_000)
		if err != nil {
			return nil, fmt.Errorf("page %w", err)
		}
		pageSize, err := positiveQueryInt(result.Get("page_size"), 20, 100)
		if err != nil {
			return nil, fmt.Errorf("page_size %w", err)
		}
		result.Set("page", strconv.Itoa(page))
		result.Set("page_size", strconv.Itoa(pageSize))
	}
	return result, nil
}

func positiveQueryInt(raw string, fallback, maximum int) (int, error) {
	if raw == "" {
		return fallback, nil
	}
	value, err := strconv.Atoi(raw)
	if err != nil || value < 1 || value > maximum {
		return 0, fmt.Errorf("必须是 1 到 %d 之间的整数", maximum)
	}
	return value, nil
}

func validateRequiredDirectorySearchQuery(key string) func(url.Values) error {
	return func(query url.Values) error {
		term := strings.TrimSpace(query.Get(key))
		if term == "" || len(term) > 255 || strings.ContainsAny(term, "\r\n\x00") {
			return fmt.Errorf("%s 必须是 1 到 255 个字符的单行搜索词", key)
		}
		query.Set(key, term)
		return nil
	}
}

func validateCurrentPermissionsQuery(query url.Values) error {
	if relative := query.Get("relative"); relative != "" && relative != "true" && relative != "false" {
		return errors.New("relative 必须是 true 或 false")
	}
	if scope := query.Get("scope"); scope != "" {
		if !strings.HasPrefix(scope, "/") || len(scope) > 1024 || strings.ContainsAny(scope, "\r\n\x00\t ") {
			return errors.New("scope 必须是以 / 开头且不含空白字符的权限范围")
		}
	}
	return nil
}

var artifactCopySourcePattern = regexp.MustCompile(`^[a-z0-9]+(?:[._-][a-z0-9]+)*(?:/[a-z0-9]+(?:[._-][a-z0-9]+)*)+(?::[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}|@sha256:[a-fA-F0-9]{64})$`)

func validateArtifactCopyQuery(query url.Values) error {
	source := query.Get("from")
	if len(source) > 1024 || !artifactCopySourcePattern.MatchString(source) {
		return errors.New("from 必须是 project/repository:tag 或 project/repository@sha256:digest")
	}
	return nil
}

func readControlBody(w http.ResponseWriter, r *http.Request, config controlMethod) ([]byte, map[string]any, error) {
	if !config.bodyRequired && !config.bodyOptional {
		return nil, nil, nil
	}
	r.Body = http.MaxBytesReader(w, r.Body, maxBodyBytes)
	body, err := io.ReadAll(r.Body)
	if err != nil {
		return nil, nil, errors.New("JSON 请求体超过 1 MiB 或读取失败")
	}
	if len(strings.TrimSpace(string(body))) == 0 {
		if config.bodyRequired {
			return nil, nil, errors.New("缺少 JSON 请求体")
		}
		return nil, nil, nil
	}
	var decoded map[string]any
	if err := json.Unmarshal(body, &decoded); err != nil || decoded == nil {
		return nil, nil, errors.New("请求体必须是一个有效的 JSON 对象")
	}
	return body, decoded, nil
}

func writeControlResponse(w http.ResponseWriter, response *harborResponse, config controlMethod, query url.Values) {
	if config.raw {
		for _, header := range []string{"Content-Type", "Content-Disposition"} {
			if value := response.Header.Get(header); value != "" {
				w.Header().Set(header, value)
			}
		}
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.WriteHeader(response.StatusCode)
		_, _ = w.Write(response.Body)
		return
	}
	if config.list {
		var items []any
		if len(response.Body) > 0 {
			if err := json.Unmarshal(response.Body, &items); err != nil {
				writeError(w, http.StatusBadGateway, "Harbor 响应无效", "列表接口没有返回 JSON 数组")
				return
			}
		}
		total := len(items)
		if headerTotal, err := strconv.Atoi(response.Header.Get("X-Total-Count")); err == nil && headerTotal >= 0 {
			total = headerTotal
		}
		page, _ := strconv.Atoi(query.Get("page"))
		pageSize, _ := strconv.Atoi(query.Get("page_size"))
		writeJSON(w, http.StatusOK, map[string]any{
			"items":      items,
			"pagination": map[string]any{"page": page, "page_size": pageSize, "total": total},
			"link":       response.Header.Get("Link"),
		})
		return
	}
	payload := map[string]any{"ok": true}
	if location := response.Header.Get("Location"); location != "" {
		payload["location"] = location
	}
	if len(response.Body) > 0 {
		var data any
		if json.Unmarshal(response.Body, &data) == nil {
			payload["data"] = data
		} else {
			payload["data"] = string(response.Body)
		}
	}
	status := response.StatusCode
	if status == http.StatusNoContent {
		status = http.StatusOK
	}
	writeJSON(w, status, payload)
}

func allowedMethodHeader(entries map[string]controlMethod) string {
	order := []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete}
	allowed := make([]string, 0, len(entries))
	for _, candidate := range order {
		if _, ok := entries[candidate]; ok {
			allowed = append(allowed, candidate)
		}
	}
	return strings.Join(allowed, ", ")
}
