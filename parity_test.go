package main

import (
	"bufio"
	"embed"
	"fmt"
	"io/fs"
	"net/http"
	"regexp"
	"sort"
	"strings"
	"testing"
)

//go:embed testdata/harbor-v2.15.2-operations.txt
var harborOperationFixture embed.FS

type harborOperationClass string

const (
	harborOperationPortal           harborOperationClass = "portal"
	harborOperationStableAPIOnly    harborOperationClass = "stable-api-only"
	harborOperationDeprecatedCompat harborOperationClass = "deprecated-compat"
	harborOperationDirect           harborOperationClass = "direct"
)

// harborOperationClasses describes the intended consumer for every named
// gateway operation. It is deliberately independent of the Swagger fixture.
var harborOperationClasses = func() map[string]harborOperationClass {
	classes := make(map[string]harborOperationClass, len(controlSpecs))
	for operation := range controlSpecs {
		classes[operation] = harborOperationPortal
	}
	for _, operation := range []string{
		"cve-export-download",
		"jobservice-pools",
		"jobservice-queues",
		"jobservice-schedule-status",
		"jobservice-schedules",
		"jobservice-workers",
		"purge-history",
		"scan-all-metrics",
		"system-root-certificate",
		"user-cli-secret",
	} {
		classes[operation] = harborOperationStableAPIOnly
	}
	classes["legacy-project-audit-logs"] = harborOperationDeprecatedCompat
	return classes
}()

var directHarborOperationClasses = map[string]harborOperationClass{
	http.MethodGet + " /api/v2.0/health":             harborOperationDirect,
	http.MethodGet + " /api/v2.0/search":             harborOperationDirect,
	http.MethodGet + " /api/v2.0/statistics":         harborOperationDirect,
	http.MethodGet + " /api/v2.0/systeminfo":         harborOperationDirect,
	http.MethodGet + " /api/v2.0/systeminfo/volumes": harborOperationDirect,
}

// These operations use the same upstream method/path as their administrator
// counterparts but enforce that the requested user is the active session user.
var operationCoverageAliases = map[string]struct{}{
	"current-user-password":   {},
	"current-user-cli-secret": {},
}

func TestHarborV2152OperationCoverage(t *testing.T) {
	want := loadHarborOperationFixture(t)
	got, duplicates := mappedHarborOperations()
	missing := operationDifference(want, got)
	unexpected := operationDifference(got, want)

	if len(missing) != 0 || len(unexpected) != 0 || len(duplicates) != 0 {
		t.Fatalf("Harbor v2.15.2 operation coverage mismatch:\nmissing:\n%s\nunexpected:\n%s\nduplicates:\n%s",
			formatOperations(missing), formatOperations(unexpected), formatOperations(duplicates))
	}
}

func TestHarborV2152OperationConsumers(t *testing.T) {
	for operation := range controlSpecs {
		classification, ok := harborOperationClasses[operation]
		if !ok {
			t.Errorf("control operation %q has no Harbor operation classification", operation)
			continue
		}
		if classification == harborOperationPortal && !frontendUsesControlOperation(t, operation) {
			t.Errorf("portal control operation %q has no frontend consumer", operation)
		}
	}
	for operation := range harborOperationClasses {
		if _, ok := controlSpecs[operation]; !ok {
			t.Errorf("Harbor operation classification %q does not name a control operation", operation)
		}
	}
}

func frontendUsesControlOperation(t *testing.T, operation string) bool {
	t.Helper()
	for _, name := range []string{"web/app.js", "web/control-ui.js", "web/admin-ui.js"} {
		contents, err := embeddedWeb.ReadFile(name)
		if err != nil {
			t.Fatal(err)
		}
		for _, function := range []string{"controlData", "controlList", "controlMutation"} {
			if strings.Contains(string(contents), function+`("`+operation+`"`) {
				return true
			}
		}
	}
	return false
}

type operationSet map[string]string

func loadHarborOperationFixture(t *testing.T) operationSet {
	t.Helper()
	file, err := harborOperationFixture.Open("testdata/harbor-v2.15.2-operations.txt")
	if err != nil {
		t.Fatal(err)
	}
	defer file.Close()

	operations := make(operationSet)
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		operation := strings.TrimSpace(scanner.Text())
		if operation == "" {
			continue
		}
		key := normalizeHarborOperation(operation)
		if _, exists := operations[key]; exists {
			t.Fatalf("fixture contains duplicate operation %q", operation)
		}
		operations[key] = operation
	}
	if err := scanner.Err(); err != nil {
		t.Fatal(err)
	}
	if len(operations) != 203 {
		t.Fatalf("fixture operation count = %d, want 203", len(operations))
	}
	return operations
}

func mappedHarborOperations() (operationSet, []string) {
	operations := make(operationSet)
	duplicates := make([]string, 0)
	for name, spec := range controlSpecs {
		if _, alias := operationCoverageAliases[name]; alias {
			continue
		}
		for method := range spec.methods {
			operation := method + " " + spec.path
			key := normalizeHarborOperation(operation)
			if _, exists := operations[key]; exists {
				duplicates = append(duplicates, operation)
			}
			operations[key] = operation
		}
	}
	for operation := range directHarborOperationClasses {
		key := normalizeHarborOperation(operation)
		if _, exists := operations[key]; exists {
			continue
		}
		operations[key] = operation
	}
	return operations, duplicates
}

var harborPathParameter = regexp.MustCompile(`\{[^}]+\}`)

func normalizeHarborPath(path string) string {
	return harborPathParameter.ReplaceAllString(path, "{parameter}")
}

func normalizeHarborOperation(operation string) string {
	method, path, found := strings.Cut(operation, " ")
	if !found {
		return operation
	}
	return method + " " + normalizeHarborPath(path)
}

func operationDifference(left, right operationSet) []string {
	result := make([]string, 0)
	for key, operation := range left {
		if _, found := right[key]; !found {
			result = append(result, operation)
		}
	}
	sort.Strings(result)
	return result
}

func formatOperations(operations []string) string {
	if len(operations) == 0 {
		return "(none)"
	}
	return strings.Join(operations, "\n")
}

func TestHarborV2152FixtureIsSorted(t *testing.T) {
	contents, err := fs.ReadFile(harborOperationFixture, "testdata/harbor-v2.15.2-operations.txt")
	if err != nil {
		t.Fatal(err)
	}
	lines := strings.Fields(string(contents))
	operations := make([]string, 0, len(lines)/2)
	for index := 0; index < len(lines); index += 2 {
		if index+1 >= len(lines) {
			t.Fatalf("malformed fixture line near %q", lines[index])
		}
		operations = append(operations, fmt.Sprintf("%s %s", lines[index], lines[index+1]))
	}
	if !sort.StringsAreSorted(operations) {
		t.Fatal("Harbor operation fixture must be sorted")
	}
}
