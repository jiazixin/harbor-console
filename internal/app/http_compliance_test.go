package app

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestHarborClientNeverFollowsRedirects(t *testing.T) {
	t.Parallel()
	client := newHarborClient(false)
	t.Cleanup(client.CloseIdleConnections)
	request := httptest.NewRequest(http.MethodGet, "https://harbor.test/target", nil)
	previous := httptest.NewRequest(http.MethodGet, "https://harbor.test/source", nil)
	previous.SetBasicAuth("user", "secret")
	if err := client.CheckRedirect(request, []*http.Request{previous}); !errors.Is(err, http.ErrUseLastResponse) {
		t.Fatalf("got %v, want ErrUseLastResponse", err)
	}
}

func TestDecodeJSONRejectsOversizedTrailingWhitespace(t *testing.T) {
	t.Parallel()
	request := jsonRequest(http.MethodPost, "/api/sessions", strings.NewReader("{}"+strings.Repeat(" ", maxBodyBytes)))
	err := decodeJSON(httptest.NewRecorder(), request, &connectRequest{})
	if _, ok := errors.AsType[*http.MaxBytesError](err); !ok {
		t.Fatalf("got %v, want MaxBytesError", err)
	}
}

func TestIdempotencyRechecksSessionBeforeReplay(t *testing.T) {
	t.Parallel()
	application, err := newApp()
	if err != nil {
		t.Fatal(err)
	}
	handler := application.routes()
	login := httptest.NewRecorder()
	handler.ServeHTTP(login, jsonRequest(http.MethodPost, "/api/demo-sessions", strings.NewReader("{}")))
	cookie := login.Result().Cookies()[0]
	create := func() *httptest.ResponseRecorder {
		t.Helper()
		request := jsonRequest(http.MethodPost, "/api/instances/demo", strings.NewReader("{}"))
		request.AddCookie(cookie)
		request.Header.Set("Idempotency-Key", "demo-creation")
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, request)
		return response
	}
	if response := create(); response.Code != http.StatusCreated {
		t.Fatalf("got %d, want 201", response.Code)
	}
	logout := httptest.NewRequest(http.MethodDelete, "/api/sessions/current", nil)
	logout.AddCookie(cookie)
	handler.ServeHTTP(httptest.NewRecorder(), logout)
	if response := create(); response.Code != http.StatusUnauthorized {
		t.Fatalf("got %d, want 401 after logout", response.Code)
	}
}

func TestSessionSwitchPreservesDecodeFailure(t *testing.T) {
	t.Parallel()
	application, err := newApp()
	if err != nil {
		t.Fatal(err)
	}
	request := jsonRequest(http.MethodPut, "/api/instances/current", strings.NewReader(strings.Repeat(" ", maxBodyBytes+1)))
	request.AddCookie(&http.Cookie{Name: sessionCookie, Value: "session"})
	response := httptest.NewRecorder()
	application.handleSwitchInstance(response, request)
	if response.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("got %d, want 413", response.Code)
	}
}
