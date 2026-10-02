package app

import (
	"fmt"
	"maps"
	"net/url"
	"path"
	"regexp"
	"strings"
	"testing"
)

var (
	htmlResourceReferences  = regexp.MustCompile(`(?:src|href)\s*=\s*["']([^"']+)["']`)
	staticModuleReferences  = regexp.MustCompile("(?:^|[;}])\\s*(?:import|export)\\s*(?:[^;\"'`]*?\\bfrom\\s*)?[\"'`]([^\"'`]+)[\"'`]")
	dynamicModuleReferences = regexp.MustCompile("\\bimport\\s*\\(\\s*[\"'`]([^\"'`]+)[\"'`]")
	moduleURLReferences     = regexp.MustCompile("\\bnew\\s+URL\\s*\\(\\s*[\"'`]([^\"'`]+)[\"'`]\\s*,\\s*import\\.meta\\.url")
	vitePreloadReferences   = regexp.MustCompile("[\"'`]((?:/?bundles/)[^\"'`]+?\\.(?:js|css)(?:[?#][^\"'`]*)?)[\"'`]")
	cssURLReferences        = regexp.MustCompile(`url\(\s*(?:"([^"]*)"|'([^']*)'|([^\s)]+))\s*\)`)
	cssImportReferences     = regexp.MustCompile(`@import\s*["']([^"']+)["']`)
)

type embeddedReference struct {
	url          string
	rootRelative bool
	allowData    bool
}

func validateEmbeddedResourceGraph(contents map[string]string) error {
	visited := make(map[string]bool, len(contents))
	queue := []string{"index.html"}
	for len(queue) > 0 {
		filename := queue[0]
		queue = queue[1:]
		if visited[filename] {
			continue
		}
		source, exists := contents[filename]
		if !exists {
			return fmt.Errorf("embedded entry or dependency %q is missing", filename)
		}
		visited[filename] = true
		for _, reference := range embeddedResourceReferences(filename, source) {
			parsed, err := url.Parse(reference.url)
			if err != nil {
				return fmt.Errorf("%s has an invalid runtime resource %q: %w", filename, reference.url, err)
			}
			if reference.allowData && parsed.Scheme == "data" {
				continue
			}
			if parsed.Scheme != "" || parsed.Host != "" {
				return fmt.Errorf("%s depends on an external runtime resource %q", filename, reference.url)
			}
			if parsed.Path == "" {
				continue
			}
			base := &url.URL{Path: "/" + filename}
			if reference.rootRelative {
				// Vite's preload map contains paths relative to the application
				// root; ordinary module imports are relative to the parent module.
				base.Path = "/"
			}
			dependency := strings.TrimPrefix(base.ResolveReference(parsed).Path, "/")
			if _, exists := contents[dependency]; !exists {
				return fmt.Errorf("%s references missing embedded resource %q", filename, dependency)
			}
			queue = append(queue, dependency)
		}
	}
	for filename := range contents {
		if (path.Ext(filename) == ".js" || path.Ext(filename) == ".css") && !visited[filename] {
			return fmt.Errorf("embedded bundle %q is unreachable from index.html", filename)
		}
	}
	return nil
}

func embeddedResourceReferences(filename, source string) []embeddedReference {
	references := make([]embeddedReference, 0)
	appendMatches := func(pattern *regexp.Regexp, rootRelative, allowData bool) {
		for _, match := range pattern.FindAllStringSubmatch(source, -1) {
			references = append(references, embeddedReference{url: match[1], rootRelative: rootRelative, allowData: allowData})
		}
	}
	switch path.Ext(filename) {
	case ".html":
		appendMatches(htmlResourceReferences, false, false)
	case ".js":
		appendMatches(staticModuleReferences, false, false)
		appendMatches(dynamicModuleReferences, false, false)
		appendMatches(moduleURLReferences, false, false)
		appendMatches(vitePreloadReferences, true, false)
	case ".css":
		appendMatches(cssImportReferences, false, false)
		for _, match := range cssURLReferences.FindAllStringSubmatch(source, -1) {
			for _, value := range match[1:] {
				if value != "" {
					references = append(references, embeddedReference{url: value, allowData: true})
					break
				}
			}
		}
	}
	return references
}

func TestEmbeddedResourceGraphHandlesLazyDependencies(t *testing.T) {
	contents := map[string]string{
		"index.html":         `<script type="module" src="/bundles/entry.js"></script>`,
		"bundles/entry.js":   `import "./shared.js"; import("./page.js"); const preload = ["bundles/page.css"]; const labels = ["import", "export"];`,
		"bundles/shared.js":  `export const shared = true;`,
		"bundles/page.js":    `import { shared } from "./shared.js"; export { shared };`,
		"bundles/page.css":   `@import "./shared.css"; body { background-image: url("data:image/svg+xml,%3Csvg%3E%3C/svg%3E"); }`,
		"bundles/shared.css": `body { color: black; }`,
	}
	if err := validateEmbeddedResourceGraph(contents); err != nil {
		t.Fatal(err)
	}
	for _, test := range []struct {
		name    string
		file    string
		content string
		want    string
	}{
		{name: "missing dynamic dependency", file: "bundles/page.js", content: `import("./missing.js");`, want: "references missing"},
		{name: "external html dependency", file: "index.html", content: `<script src="https://cdn.example.com/entry.js"></script>`, want: "external runtime"},
		{name: "external dynamic dependency", file: "bundles/page.js", content: `import("https://cdn.example.com/page.js");`, want: "external runtime"},
		{name: "external static dependency", file: "bundles/page.js", content: `import { shared } from "//cdn.example.com/shared.js";`, want: "external runtime"},
		{name: "external module url", file: "bundles/page.js", content: `const worker = new URL("https://cdn.example.com/worker.js", import.meta.url);`, want: "external runtime"},
		{name: "external css dependency", file: "bundles/page.css", content: `@import "https://cdn.example.com/style.css";`, want: "external runtime"},
		{name: "missing css dependency", file: "bundles/page.css", content: `body { background: url("./missing.svg"); }`, want: "references missing"},
		{name: "orphan bundle", file: "bundles/orphan.js", content: `export const unused = true;`, want: "unreachable"},
	} {
		t.Run(test.name, func(t *testing.T) {
			changed := maps.Clone(contents)
			changed[test.file] = test.content
			if err := validateEmbeddedResourceGraph(changed); err == nil || !strings.Contains(err.Error(), test.want) {
				t.Fatalf("dependency graph error = %v, want %q", err, test.want)
			}
		})
	}
}
