package app

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"testing/fstest"
)

func TestStaticFilesUseVersionedCachePolicy(t *testing.T) {
	handler := staticFiles(fstest.MapFS{
		"index.html":               {Data: []byte("<!doctype html><title>Harbor</title>")},
		"favicon.svg":              {Data: []byte("<svg></svg>")},
		"bundles/app-Ab12cd34.js":  {Data: []byte("export const app = true;")},
		"bundles/app-Ab12cd34.css": {Data: []byte("body { margin: 0; }")},
		"bundles/unversioned.js":   {Data: []byte("export const app = true;")},
	})
	for _, test := range []struct {
		path   string
		status int
		cache  string
	}{
		{path: "/", status: http.StatusOK, cache: "no-cache"},
		{path: "/favicon.svg", status: http.StatusOK, cache: "public, max-age=3600"},
		{path: "/bundles/app-Ab12cd34.js", status: http.StatusOK, cache: "public, max-age=31536000, immutable"},
		{path: "/bundles/app-Ab12cd34.css", status: http.StatusOK, cache: "public, max-age=31536000, immutable"},
		{path: "/bundles/unversioned.js", status: http.StatusOK, cache: "no-cache"},
		{path: "/bundles/missing-Ab12cd34.js", status: http.StatusNotFound},
	} {
		t.Run(test.path, func(t *testing.T) {
			response := httptest.NewRecorder()
			handler.ServeHTTP(response, httptest.NewRequest(http.MethodGet, test.path, nil))
			if response.Code != test.status || response.Header().Get("Cache-Control") != test.cache {
				t.Fatalf("static response = %d %q, want %d %q", response.Code, response.Header().Get("Cache-Control"), test.status, test.cache)
			}
		})
	}
}
