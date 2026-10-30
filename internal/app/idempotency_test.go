package app

import (
	"crypto/sha256"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestIdempotencyCapacityAndRetention(t *testing.T) {
	t.Parallel()
	cache := newIdempotencyCache()
	now := time.Date(2026, 10, 31, 0, 0, 0, 0, time.UTC)
	cache.now = func() time.Time { return now }
	fingerprint := sha256.Sum256([]byte("first"))
	first, owner, err := cache.acquire("first", fingerprint)
	if err != nil || !owner {
		t.Fatalf("got owner=%v err=%v, want reservation", owner, err)
	}
	if _, _, err := cache.acquire("first", sha256.Sum256([]byte("other"))); !errors.Is(err, errKeyReused) {
		t.Fatalf("got %v, want reused key", err)
	}
	for index := 1; index < maxIdempotencyBytes/maxReplyBytes; index++ {
		if _, _, err := cache.acquire(fmt.Sprint(index), fingerprint); err != nil {
			t.Fatal(err)
		}
	}
	if _, _, err := cache.acquire("overflow", fingerprint); !errors.Is(err, errIdempotencyCapacity) {
		t.Fatalf("got %v, want capacity error", err)
	}
	cache.complete(first, idempotentResponse{status: http.StatusCreated, body: []byte("created")})
	now = now.Add(idempotencyWindow - time.Nanosecond)
	replay, owner, err := cache.acquire("first", fingerprint)
	if err != nil || owner || replay != first {
		t.Fatalf("got %v %v, want original entry", owner, err)
	}
	now = now.Add(time.Nanosecond)
	replay, owner, err = cache.acquire("first", fingerprint)
	if err != nil || !owner || replay == first {
		t.Fatalf("got %v %v, want expired entry replaced", owner, err)
	}
}

func TestSessionCreationReplayDoesNotStoreBearerToken(t *testing.T) {
	t.Parallel()
	application, err := newApp()
	if err != nil {
		t.Fatal(err)
	}
	handler := application.routes()
	bootstrap := httptest.NewRecorder()
	handler.ServeHTTP(bootstrap, httptest.NewRequest(http.MethodGet, "/api/sessions/current", nil))
	var nonce *http.Cookie
	for _, cookie := range bootstrap.Result().Cookies() {
		if cookie.Name == creationCookie {
			nonce = cookie
		}
	}
	if nonce == nil {
		t.Fatal("got no creation nonce")
	}
	request := func() *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequest(http.MethodPost, "/api/demo-sessions", strings.NewReader(`{}`))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Idempotency-Key", "demo-create")
		req.AddCookie(nonce)
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, req)
		return response
	}
	first, second := request(), request()
	if first.Code != http.StatusCreated || second.Code != http.StatusCreated || first.Body.String() != second.Body.String() {
		t.Fatalf("got %d/%d with differing body=%v, want replayed creation", first.Code, second.Code, first.Body.String() != second.Body.String())
	}
	token := first.Result().Cookies()[0].Value
	if second.Result().Cookies()[0].Value != token {
		t.Fatal("got different session token on replay")
	}
	for _, entry := range application.idempotency.entries {
		if entry.response.header.Get("Set-Cookie") != "" || strings.Contains(string(entry.response.body), token) {
			t.Fatal("bearer token retained in replay cache")
		}
	}
	for key, value := range application.sessions.sessions {
		if key == token || value.ID == token {
			t.Fatal("bearer token retained in session store")
		}
	}
	application.sessions.delete(sessionDigest(token))
	if got := request().Code; got != http.StatusUnauthorized {
		t.Fatalf("got %d, want revoked session rejected", got)
	}
}
