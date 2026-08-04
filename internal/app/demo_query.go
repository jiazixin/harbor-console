package app

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"
)

func (state *demoState) writeList(w http.ResponseWriter, items []map[string]any, query url.Values) {
	state.writeListAny(w, mapsToAny(items), query)
}

func (state *demoState) writeListAny(w http.ResponseWriter, items []any, query url.Values) {
	items = append([]any(nil), items...)
	if sortField := strings.TrimSpace(strings.Split(query.Get("sort"), ",")[0]); sortField != "" {
		descending := strings.HasPrefix(sortField, "-")
		sortField = strings.TrimPrefix(sortField, "-")
		sort.SliceStable(items, func(left, right int) bool {
			leftMap, leftOK := items[left].(map[string]any)
			rightMap, rightOK := items[right].(map[string]any)
			if !leftOK || !rightOK {
				return false
			}
			comparison := compareDemoValues(leftMap[sortField], rightMap[sortField])
			if descending {
				return comparison > 0
			}
			return comparison < 0
		})
	}
	total := len(items)
	page, _ := positiveQueryInt(query.Get("page"), 1, 1_000_000)
	pageSize, _ := positiveQueryInt(query.Get("page_size"), 20, 100)
	start := (page - 1) * pageSize
	if start > total {
		start = total
	}
	end := start + pageSize
	if end > total {
		end = total
	}
	pageItems := make([]any, 0, end-start)
	for _, item := range items[start:end] {
		pageItems = append(pageItems, cloneDemoValue(item))
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": pageItems, "pagination": map[string]any{"page": page, "page_size": pageSize, "total": total}, "link": ""})
}

func compareDemoValues(left, right any) int {
	leftNumber, leftNumeric := demoNumericValue(left)
	rightNumber, rightNumeric := demoNumericValue(right)
	if leftNumeric && rightNumeric {
		switch {
		case leftNumber < rightNumber:
			return -1
		case leftNumber > rightNumber:
			return 1
		default:
			return 0
		}
	}
	return strings.Compare(strings.ToLower(fmt.Sprint(left)), strings.ToLower(fmt.Sprint(right)))
}

func demoNumericValue(value any) (float64, bool) {
	switch typed := value.(type) {
	case float64:
		return typed, true
	case int:
		return float64(typed), true
	case int64:
		return float64(typed), true
	case json.Number:
		parsed, err := typed.Float64()
		return parsed, err == nil
	default:
		return 0, false
	}
}

func filterMaps(items []map[string]any, term, field string) []map[string]any {
	term = strings.TrimSpace(strings.TrimPrefix(term, "name=~"))
	term = strings.ToLower(term)
	if term == "" {
		return items
	}
	result := make([]map[string]any, 0)
	for _, item := range items {
		if strings.Contains(strings.ToLower(stringValue(item[field])), term) {
			result = append(result, item)
		}
	}
	return result
}

func demoQueryNumber(query, key string) int64 {
	for _, segment := range strings.Split(query, ",") {
		parts := strings.SplitN(strings.TrimSpace(segment), "=", 2)
		if len(parts) == 2 && parts[0] == key {
			value, _ := strconv.ParseInt(parts[1], 10, 64)
			return value
		}
	}
	return 0
}

func demoQueryString(query, key string) string {
	for _, segment := range strings.Split(query, ",") {
		parts := strings.SplitN(strings.TrimSpace(segment), "=", 2)
		if len(parts) == 2 && parts[0] == key {
			return strings.Trim(parts[1], "~")
		}
	}
	return ""
}

func filterDemoAuditTimeRange(items []map[string]any, query string) []map[string]any {
	start, end, ok := demoQueryTimeRange(query, "op_time")
	if !ok {
		return items
	}
	filtered := make([]map[string]any, 0, len(items))
	for _, item := range items {
		occurredAt, err := time.Parse(time.RFC3339Nano, stringValue(item["op_time"]))
		if err != nil {
			continue
		}
		if !start.IsZero() && occurredAt.Before(start) {
			continue
		}
		if !end.IsZero() && occurredAt.After(end) {
			continue
		}
		filtered = append(filtered, item)
	}
	return filtered
}

func demoQueryTimeRange(query, key string) (time.Time, time.Time, bool) {
	for _, segment := range strings.Split(query, ",") {
		parts := strings.SplitN(strings.TrimSpace(segment), "=", 2)
		if len(parts) != 2 || parts[0] != key {
			continue
		}
		value := strings.TrimSpace(parts[1])
		if len(value) < 3 || value[0] != '[' || value[len(value)-1] != ']' {
			return time.Time{}, time.Time{}, false
		}
		bounds := strings.SplitN(value[1:len(value)-1], "~", 2)
		if len(bounds) != 2 {
			return time.Time{}, time.Time{}, false
		}
		var start, end time.Time
		var err error
		if bounds[0] != "" {
			start, err = time.Parse(time.RFC3339Nano, bounds[0])
			if err != nil {
				return time.Time{}, time.Time{}, false
			}
		}
		if bounds[1] != "" {
			end, err = time.Parse(time.RFC3339Nano, bounds[1])
			if err != nil {
				return time.Time{}, time.Time{}, false
			}
		}
		return start, end, true
	}
	return time.Time{}, time.Time{}, false
}
