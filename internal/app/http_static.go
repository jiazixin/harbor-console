package app

import (
	"io/fs"
	"net/http"
	"regexp"
)

var hashedBundlePath = regexp.MustCompile(`^/bundles/[A-Za-z0-9][A-Za-z0-9._-]*-[A-Za-z0-9_-]{8,}\.(?:js|css)$`)

func staticFiles(files fs.FS) http.Handler {
	server := http.FileServerFS(files)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cacheControl := "no-cache"
		switch {
		case hashedBundlePath.MatchString(r.URL.Path):
			cacheControl = "public, max-age=31536000, immutable"
		case r.URL.Path == "/favicon.svg":
			cacheControl = "public, max-age=3600"
		}
		server.ServeHTTP(&staticCacheWriter{ResponseWriter: w, cacheControl: cacheControl}, r)
	})
}

type staticCacheWriter struct {
	http.ResponseWriter
	cacheControl string
	wroteHeader  bool
}

func (w *staticCacheWriter) WriteHeader(status int) {
	if w.wroteHeader {
		return
	}
	w.wroteHeader = true
	if (status >= http.StatusOK && status < http.StatusMultipleChoices) || status == http.StatusNotModified {
		w.Header().Set("Cache-Control", w.cacheControl)
	}
	w.ResponseWriter.WriteHeader(status)
}

func (w *staticCacheWriter) Write(body []byte) (int, error) {
	if !w.wroteHeader {
		w.WriteHeader(http.StatusOK)
	}
	return w.ResponseWriter.Write(body)
}

func (w *staticCacheWriter) Unwrap() http.ResponseWriter {
	return w.ResponseWriter
}
