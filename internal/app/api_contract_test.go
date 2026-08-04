package app

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

//go:embed testdata/harbor-v2.15.2-stable-operations.txt
var harborOperationFixture embed.FS

const stableOperationCount = 198

var directHarborOperations = map[string]struct{}{
	http.MethodGet + " /api/v2.0/health":             {},
	http.MethodGet + " /api/v2.0/search":             {},
	http.MethodGet + " /api/v2.0/statistics":         {},
	http.MethodGet + " /api/v2.0/systeminfo":         {},
	http.MethodGet + " /api/v2.0/systeminfo/volumes": {},
}

// These operations use the same upstream method/path as their administrator
// counterparts but enforce that the requested user is the active session user.
var operationCoverageAliases = map[string]struct{}{
	"current-user-password":   {},
	"current-user-cli-secret": {},
}

func TestHarborV2152StableOperationContract(t *testing.T) {
	want := loadHarborOperationFixture(t)
	got, duplicates := mappedHarborOperations()
	missing := operationDifference(want, got)
	unexpected := operationDifference(got, want)

	if len(missing) != 0 || len(unexpected) != 0 || len(duplicates) != 0 {
		t.Fatalf("Harbor v2.15.2 stable operation contract mismatch:\nmissing:\n%s\nunexpected:\n%s\nduplicates:\n%s",
			formatOperations(missing), formatOperations(unexpected), formatOperations(duplicates))
	}
}

type operationSet map[string]string

func loadHarborOperationFixture(t *testing.T) operationSet {
	t.Helper()
	file, err := harborOperationFixture.Open("testdata/harbor-v2.15.2-stable-operations.txt")
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
	if len(operations) != stableOperationCount {
		t.Fatalf("fixture operation count = %d, want %d", len(operations), stableOperationCount)
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
	for operation := range directHarborOperations {
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

func TestHarborV2152StableOperationFixtureIsSorted(t *testing.T) {
	contents, err := fs.ReadFile(harborOperationFixture, "testdata/harbor-v2.15.2-stable-operations.txt")
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
