package app

import (
	"context"
	"encoding/json"
	"errors"
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
func (a *app) updateSystemCVEAllowlist(ctx context.Context, current *session, path string, requested map[string]any, headers http.Header) (*harborResponse, error) {
	var authoritative map[string]any
	if err := a.harborGetJSON(ctx, current, path, nil, &authoritative); err != nil {
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
	response, err := a.harborRequest(ctx, current, http.MethodPut, path, nil, body, headers)
	if err != nil {
		return nil, err
	}

	var persisted map[string]any
	if err := a.harborGetJSON(ctx, current, path, nil, &persisted); err != nil {
		return nil, &writeConfirmationError{err: err}
	}
	got, err := decodeCVEAllowlistState(persisted)
	if err != nil {
		return nil, &writeConfirmationError{err: err}
	}
	if !equalCVEAllowlistState(want, got) {
		return nil, &writeConfirmationError{err: &upstreamError{StatusCode: http.StatusBadGateway, Message: "Harbor 回读的 CVE Allowlist 与请求不一致"}}
	}
	return response, nil
}

func decodeCVEAllowlistState(value map[string]any) (cveAllowlistState, error) {
	state := cveAllowlistState{items: make([]string, 0)}
	if raw, exists := value["expires_at"]; exists && raw != nil {
		expiresAt, ok := integerNumberValue(raw)
		if !ok {
			return cveAllowlistState{}, errors.New("Harbor 返回的 CVE Allowlist expires_at 无效")
		}
		state.expiresAt = new(expiresAt)
	}
	if raw, exists := value["items"]; exists && raw != nil {
		items, ok := raw.([]any)
		if !ok {
			return cveAllowlistState{}, errors.New("Harbor 返回的 CVE Allowlist items 无效")
		}
		for _, rawItem := range items {
			item, ok := rawItem.(map[string]any)
			if !ok || stringValue(item["cve_id"]) == "" {
				return cveAllowlistState{}, errors.New("Harbor 返回的 CVE Allowlist 条目无效")
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
