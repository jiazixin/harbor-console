package app

import (
	"fmt"
	"strconv"
)

func findMap(items []map[string]any, field, value string) (int, bool) {
	for index, item := range items {
		if stringValue(item[field]) == value {
			return index, true
		}
	}
	return -1, false
}

func findMapNumber(items []map[string]any, field, value string) (int, bool) {
	for index, item := range items {
		if fmt.Sprint(item[field]) == value {
			return index, true
		}
	}
	return -1, false
}

func mapsToAny(items []map[string]any) []any {
	result := make([]any, 0, len(items))
	for _, item := range items {
		result = append(result, item)
	}
	return result
}

func asAnySlice(value any) []any {
	items, _ := value.([]any)
	return items
}

func cloneDemoValue(value any) any {
	switch typed := value.(type) {
	case map[string]any:
		return cloneMap(typed)
	case []map[string]any:
		return cloneMaps(typed)
	case []any:
		result := make([]any, len(typed))
		for index, item := range typed {
			result[index] = cloneDemoValue(item)
		}
		return result
	default:
		return value
	}
}

func stringValue(value any) string {
	text, _ := value.(string)
	return text
}

func parseDemoID(value string) int64 {
	parsed, _ := strconv.ParseInt(value, 10, 64)
	return parsed
}
