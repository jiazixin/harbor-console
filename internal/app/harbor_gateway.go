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
		writeError(w, r, errSessionRequired)
		return
	}
	if len(r.URL.RawQuery) > maxQueryBytes {
		writeError(w, r, errQueryTooLong)
		return
	}
	// The route pattern is "METHOD /api/operations/<operation>".
	operation := strings.TrimPrefix(r.URL.Path, "/api/operations/")
	spec := controlSpecs[operation]
	methodConfig, ok := spec.methods[r.Method]
	if !ok && r.Method == http.MethodHead {
		methodConfig = spec.methods[http.MethodGet]
	}
	input, err := harborPaging(r.URL.Query(), methodConfig.list && slicesContain(spec.allowedQuery, "page"))
	if err != nil {
		writeError(w, r, err)
		return
	}
	if err := validateControlQueryKeys(spec, input); err != nil {
		writeError(w, r, err)
		return
	}

	path, requestHeaders, err := buildControlPath(spec, input)
	if err != nil {
		writeError(w, r, err)
		return
	}
	query, err := buildControlQuery(spec.allowedQuery, input, methodConfig.list)
	if err != nil {
		writeError(w, r, err)
		return
	}
	if spec.validateQuery != nil {
		if err := spec.validateQuery(query); err != nil {
			writeError(w, r, err)
			return
		}
	}
	body, decoded, err := readControlBody(w, r, methodConfig)
	if err != nil {
		writeError(w, r, err)
		return
	}
	if methodConfig.validate != nil {
		if err := methodConfig.validate(decoded); err != nil {
			writeError(w, r, err)
			return
		}
	}

	if current.Demo {
		current.DemoData.handleControl(w, r, demoControlRequest{method: r.Method, operation: operation, query: input, body: decoded})
		return
	}
	if operation == "system-cve-allowlist" && r.Method == http.MethodPut {
		response, err := a.updateSystemCVEAllowlist(r.Context(), allowlistUpdate{current: current, path: path, requested: decoded, headers: requestHeaders})
		if err != nil {
			writeUpstreamError(w, r, err)
			return
		}
		writeControlResponse(w, r, controlResponse{response: response, config: methodConfig, query: query})
		return
	}
	if operation == "current-user-password" || operation == "current-user-cli-secret" {
		if err := a.requireCurrentUserID(r, current, input.Get("id")); err != nil {
			writeUpstreamError(w, r, err)
			return
		}
	}
	response, err := a.harborRequest(r.Context(), harborRequestOptions{current: current, method: r.Method, path: path, query: query, body: body, headers: requestHeaders})
	if err != nil {
		writeUpstreamError(w, r, err)
		return
	}
	if operation == "current-user-password" || operation == "current-user-cli-secret" {
		field := "new_password"
		if operation == "current-user-cli-secret" {
			field = "secret"
		}
		if password, ok := decoded[field].(string); ok {
			if err := a.sessions.updateInstancePassword(current.ID, current.ActiveInstance, password); err != nil {
				requestLogger(r).Warn("connection_credential_refresh_failed", "connection_id", current.ActiveInstance, "error", err)
			}
		}
	}
	if methodConfig.head {
		w.WriteHeader(response.StatusCode)
		return
	}
	writeControlResponse(w, r, controlResponse{response: response, config: methodConfig, query: query})
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
			return invalidField(key, "unknown_field", "is not an allowed parameter of this operation")
		}
	}
	return nil
}

func (a *app) requireCurrentUserID(r *http.Request, current *session, requestedID string) error {
	var user struct {
		UserID int64 `json:"user_id"`
	}
	if err := a.harborGetJSON(r.Context(), harborJSONRequest{current: current, path: "/api/v2.0/users/current", query: nil, out: &user}); err != nil {
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
					return "", nil, invalidField(parameter.name, "not_non_negative_integer", "must be 0 or a positive integer")
				}
				return "", nil, invalidField(parameter.name, "not_positive_integer", "must be a positive integer")
			}
		}
		if len(parameter.allowed) > 0 && !slicesContain(parameter.allowed, value) {
			return "", nil, invalidField(parameter.name, "invalid_value", "is not an allowed value")
		}
		if parameter.name == "repository" && projectName != "" {
			value = strings.TrimPrefix(value, projectName+"/")
			if value == "" {
				return "", nil, invalidField("repository", "repository_name_missing", "must not contain only the project name")
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
		return invalidField(name, "required", "is required")
	}
	if len(value) > 1024 || strings.ContainsAny(value, "\r\n\x00") {
		return invalidField(name, "invalid_text", "contains invalid characters or is too long")
	}
	// PathEscape leaves dot segments unchanged; upstream proxies may normalize
	// them and route outside the declared operation's path.
	for segment := range strings.SplitSeq(value, "/") {
		if segment == "." || segment == ".." {
			return invalidField(name, "path_traversal", "must not contain dot segments")
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
			return nil, invalidField(key, "too_many_values", "is repeated too often")
		}
		for _, value := range values {
			if len(value) > 2048 || strings.ContainsAny(value, "\r\n\x00") {
				return nil, invalidField(key, "invalid_text", "contains invalid characters or is too long")
			}
			result.Add(key, value)
		}
	}
	if slicesContain(allowed, "page") && (applyPaginationDefaults || result.Has("page") || result.Has("page_size")) {
		page, err := positiveQueryInt(result.Get("page"), 1, 1_000_000)
		if err != nil {
			return nil, nestField("page", err)
		}
		pageSize, err := positiveQueryInt(result.Get("page_size"), 20, 100)
		if err != nil {
			return nil, nestField("page_size", err)
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
		return 0, invalidField("", "out_of_range", fmt.Sprintf("must be an integer from 1 to %d", maximum))
	}
	return value, nil
}

func validateRequiredDirectorySearchQuery(key string) func(url.Values) error {
	return func(query url.Values) error {
		term := strings.TrimSpace(query.Get(key))
		if term == "" || len(term) > 255 || strings.ContainsAny(term, "\r\n\x00") {
			return invalidField(key, "invalid_search_term", "must be a single-line search term of 1 to 255 characters")
		}
		query.Set(key, term)
		return nil
	}
}

func validateCurrentPermissionsQuery(query url.Values) error {
	if relative := query.Get("relative"); relative != "" && relative != "true" && relative != "false" {
		return invalidField("relative", "not_boolean", "must be true or false")
	}
	if scope := query.Get("scope"); scope != "" {
		if !strings.HasPrefix(scope, "/") || len(scope) > 1024 || strings.ContainsAny(scope, "\r\n\x00\t ") {
			return invalidField("scope", "invalid_permission_scope", "must start with / and contain no whitespace")
		}
	}
	return nil
}

var artifactCopySourcePattern = regexp.MustCompile(`^[a-z0-9]+(?:[._-][a-z0-9]+)*(?:/[a-z0-9]+(?:[._-][a-z0-9]+)*)+(?::[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}|@sha256:[a-fA-F0-9]{64})$`)

func validateArtifactCopyQuery(query url.Values) error {
	source := query.Get("from")
	if len(source) > 1024 || !artifactCopySourcePattern.MatchString(source) {
		return invalidField("from", "invalid_artifact_reference", "must be project/repository:tag or project/repository@sha256:digest")
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
		if _, ok := errors.AsType[*http.MaxBytesError](err); ok {
			return nil, nil, err
		}
		return nil, nil, invalidField("", "invalid_json", "reading the request body failed")
	}
	if len(strings.TrimSpace(string(body))) == 0 {
		if config.bodyRequired {
			return nil, nil, invalidField("", "body_required", "a JSON request body is required")
		}
		return nil, nil, nil
	}
	var decoded map[string]any
	if err := json.Unmarshal(body, &decoded); err != nil || decoded == nil {
		return nil, nil, invalidField("", "invalid_json", "request body must be one valid JSON object")
	}
	return body, decoded, nil
}

// controlList is the console's list response: Harbor's page of items with the
// total and the offset paging the client asked for (docs/API.md).
type controlList struct {
	Items  []any `json:"items"`
	Total  int   `json:"total"`
	Offset int   `json:"offset"`
	Limit  int   `json:"limit"`
}

// harborPaging translates the console's offset and limit into Harbor's page and
// page_size for paged list operations. Clients never send Harbor's paging
// parameters themselves.
func harborPaging(input url.Values, paged bool) (url.Values, error) {
	values := url.Values{}
	for key, value := range input {
		values[key] = value
	}
	for _, key := range []string{"page", "page_size"} {
		if values.Has(key) {
			return nil, invalidField(key, "unknown_field", "is not an allowed parameter; use offset and limit")
		}
	}
	offsetText, limitText := values.Get("offset"), values.Get("limit")
	values.Del("offset")
	values.Del("limit")
	if !paged {
		if offsetText != "" {
			return nil, invalidField("offset", "unknown_field", "this operation is not paged")
		}
		if limitText != "" {
			return nil, invalidField("limit", "unknown_field", "this operation is not paged")
		}
		return values, nil
	}
	limit := 20
	if limitText != "" {
		parsed, err := strconv.Atoi(limitText)
		if err != nil || parsed < 1 || parsed > 100 {
			return nil, invalidField("limit", "out_of_range", "must be between 1 and 100")
		}
		limit = parsed
	}
	offset := 0
	if offsetText != "" {
		parsed, err := strconv.Atoi(offsetText)
		if err != nil || parsed < 0 || parsed%limit != 0 {
			return nil, invalidField("offset", "invalid_value", "must be a non-negative multiple of limit")
		}
		offset = parsed
	}
	values.Set("page", strconv.Itoa(offset/limit+1))
	values.Set("page_size", strconv.Itoa(limit))
	return values, nil
}

func writeControlResponse(w http.ResponseWriter, r *http.Request, options controlResponse) {
	response, config, query := options.response, options.config, options.query
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
				writeError(w, r, failure(http.StatusServiceUnavailable, "harbor_invalid_response", "Harbor list endpoint did not return a JSON array"))
				return
			}
		}
		total := len(items)
		if headerTotal, err := strconv.Atoi(response.Header.Get("X-Total-Count")); err == nil && headerTotal >= 0 {
			total = headerTotal
		}
		if items == nil {
			items = []any{}
		}
		// Unpaged lists return everything at once.
		list := controlList{Items: items, Total: total, Limit: len(items)}
		if page, err := strconv.Atoi(query.Get("page")); err == nil {
			list.Limit, _ = strconv.Atoi(query.Get("page_size"))
			list.Offset = (page - 1) * list.Limit
		}
		writeJSON(w, http.StatusOK, list)
		return
	}
	// Harbor's resource is the response body; text bodies stay JSON strings.
	if location := response.Header.Get("Location"); location != "" {
		w.Header().Set("Location", location)
	}
	status := response.StatusCode
	if len(response.Body) == 0 {
		if status == http.StatusOK {
			status = http.StatusNoContent
		}
		w.WriteHeader(status)
		return
	}
	if json.Valid(response.Body) {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.WriteHeader(status)
		_, _ = w.Write(response.Body)
		return
	}
	writeJSON(w, status, string(response.Body))
}

type controlResponse struct {
	response *harborResponse
	config   controlMethod
	query    url.Values
}
