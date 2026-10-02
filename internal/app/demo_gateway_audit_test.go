package app

import (
	"reflect"
	"testing"
)

func TestFilterDemoAuditEntries(t *testing.T) {
	entries := []map[string]any{
		{"username": "release-bot", "resource": "platform/api", "operation": "push", "operation_result": true},
		{"username": "release-bot", "resource": "platform/api", "operation": "push", "operation_result": false},
		{"username": "reader", "resource": "platform/web", "operation": "pull", "operation_result": true},
	}
	for _, testCase := range []struct {
		name    string
		query   string
		indexes []int
	}{
		{name: "no filters", indexes: []int{0, 1, 2}},
		{name: "combined text and success", query: "username=~release,resource=~platform/api,operation=push,op_result=true", indexes: []int{0}},
		{name: "failed operations", query: "op_result=false", indexes: []int{1}},
		{name: "no match", query: "username=missing", indexes: []int{}},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			want := make([]map[string]any, 0, len(testCase.indexes))
			for _, index := range testCase.indexes {
				want = append(want, entries[index])
			}
			got := filterDemoAuditEntries(entries, testCase.query)
			if !reflect.DeepEqual(got, want) {
				t.Fatalf("filtered entries = %#v, want %#v", got, want)
			}
		})
	}
	if len(entries) != 3 || entries[0]["username"] != "release-bot" {
		t.Fatal("filter changed source entries")
	}
}
