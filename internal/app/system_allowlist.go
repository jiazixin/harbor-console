package app

import (
	"context"
	"encoding/json"
	"net/http"
	"slices"
)

type cveAllowlistState struct {
	expiresAt *int64
	items     []string
}

// updateSystemCVEAllowlist treats Harbor's GET response as authoritative. The
// browser payload is intentionally limited to the desired value; identity is
// copied server-side and the persisted value is read back before success is
// returned. This prevents a stale or incomplete form object from reporting a
// successful clear when Harbor retained an item.
func (a *app) updateSystemCVEAllowlist(ctx context.Context, options allowlistUpdate) (*harborResponse, error) {
	current, path, requested, headers := options.current, options.path, options.requested, options.headers
	var authoritative map[string]any
	if err := a.harborGetJSON(ctx, harborJSONRequest{current: current, path: path, query: nil, out: &authoritative}); err != nil {
		return nil, err
	}

	payload := make(map[string]any, 4)
	for _, key := range []string{"expires_at", "items"} {
		if value, ok := requested[key]; ok {
			payload[key] = value
		}
	}
	if _, ok := payload["items"]; !ok {
		payload["items"] = []any{}
	}
	for _, key := range []string{"id", "project_id"} {
		if value, ok := authoritative[key]; ok {
			payload[key] = value
		}
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	want, err := decodeCVEAllowlistState(payload)
	if err != nil {
		return nil, err
	}
	response, err := a.harborRequest(ctx, harborRequestOptions{current: current, method: http.MethodPut, path: path, query: nil, body: body, headers: headers})
	if err != nil {
		return nil, err
	}

	var persisted map[string]any
	if err := a.harborGetJSON(ctx, harborJSONRequest{current: current, path: path, query: nil, out: &persisted}); err != nil {
		return nil, &writeConfirmationError{err: err}
	}
	got, err := decodeCVEAllowlistState(persisted)
	if err != nil {
		return nil, &writeConfirmationError{err: err}
	}
	if !equalCVEAllowlistState(want, got) {
		return nil, &writeConfirmationError{err: failure(http.StatusServiceUnavailable, "harbor_readback_mismatch", "CVE allowlist read back from Harbor differs from the request")}
	}
	return response, nil
}

func decodeCVEAllowlistState(value map[string]any) (cveAllowlistState, error) {
	state := cveAllowlistState{items: make([]string, 0)}
	if raw, exists := value["expires_at"]; exists && raw != nil {
		expiresAt, ok := integerNumberValue(raw)
		if !ok {
			return cveAllowlistState{}, failure(http.StatusServiceUnavailable, "harbor_invalid_response", "Harbor returned an invalid CVE allowlist expires_at")
		}
		state.expiresAt = new(expiresAt)
	}
	if raw, exists := value["items"]; exists && raw != nil {
		items, ok := raw.([]any)
		if !ok {
			return cveAllowlistState{}, failure(http.StatusServiceUnavailable, "harbor_invalid_response", "Harbor returned invalid CVE allowlist items")
		}
		for _, rawItem := range items {
			item, ok := rawItem.(map[string]any)
			if !ok || stringValue(item["cve_id"]) == "" {
				return cveAllowlistState{}, failure(http.StatusServiceUnavailable, "harbor_invalid_response", "Harbor returned an invalid CVE allowlist entry")
			}
			state.items = append(state.items, stringValue(item["cve_id"]))
		}
	}
	slices.Sort(state.items)
	return state, nil
}

func equalCVEAllowlistState(left, right cveAllowlistState) bool {
	if (left.expiresAt == nil) != (right.expiresAt == nil) {
		return false
	}
	if left.expiresAt != nil && *left.expiresAt != *right.expiresAt {
		return false
	}
	if len(left.items) != len(right.items) {
		return false
	}
	for index := range left.items {
		if left.items[index] != right.items[index] {
			return false
		}
	}
	return true
}

type allowlistUpdate struct {
	current   *session
	path      string
	requested map[string]any
	headers   http.Header
}
