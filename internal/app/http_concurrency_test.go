package app

import (
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
)

func TestRequestConcurrencyRejectsOverflowAndReleasesPermit(t *testing.T) {
	t.Parallel()
	started := make(chan struct{})
	release := make(chan struct{})
	var once sync.Once
	handler := boundedRequests(1)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		once.Do(func() { close(started) })
		select {
		case <-release:
			w.WriteHeader(http.StatusNoContent)
		case <-r.Context().Done():
		}
	}))
	request := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/api/info", nil)
	first := httptest.NewRecorder()
	finished := make(chan struct{})
	go func() {
		defer close(finished)
		handler.ServeHTTP(first, request)
	}()
	select {
	case <-started:
	case <-t.Context().Done():
		t.Fatal("first request did not start")
	}
	overflow := httptest.NewRecorder()
	handler.ServeHTTP(overflow, request)
	close(release)
	<-finished
	if overflow.Code != http.StatusServiceUnavailable || overflow.Header().Get("Retry-After") != "1" {
		t.Fatalf("overflow got status=%d retry_after=%q", overflow.Code, overflow.Header().Get("Retry-After"))
	}
	if first.Code != http.StatusNoContent {
		t.Fatalf("first request got %d, want 204", first.Code)
	}
	next := httptest.NewRecorder()
	handler.ServeHTTP(next, request)
	if next.Code != http.StatusNoContent {
		t.Fatalf("next request got %d, want released permit", next.Code)
	}
}
