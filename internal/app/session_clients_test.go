package app

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

type cleanupTrackingTransport struct {
	http.RoundTripper
	closeCount int
}

func TestDemoInstanceCanBeReaddedAfterRemoval(t *testing.T) {
	application, err := newApp()
	if err != nil {
		t.Fatal(err)
	}
	current := createTestSession(t, testSessionOptions{application: application, client: nil, demo: true})
	handler := application.routes()
	add := func() string {
		t.Helper()
		request := jsonRequest(http.MethodPost, "/api/instances/demo", strings.NewReader(`{}`))
		request.AddCookie(&http.Cookie{Name: sessionCookie, Value: current.ID})
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, request)
		if response.Code != http.StatusCreated {
			t.Fatalf("add demo response = %d, body = %s", response.Code, response.Body.String())
		}
		var payload struct {
			ConnectionID string `json:"connection_id"`
		}
		if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
			t.Fatal(err)
		}
		return payload.ConnectionID
	}
	removedID := add()
	_ = add()
	remove := httptest.NewRequest(http.MethodDelete, "/api/instances/"+removedID, nil)
	remove.AddCookie(&http.Cookie{Name: sessionCookie, Value: current.ID})
	removed := httptest.NewRecorder()
	handler.ServeHTTP(removed, remove)
	if removed.Code != http.StatusOK {
		t.Fatalf("remove demo response = %d, body = %s", removed.Code, removed.Body.String())
	}
	_ = add()
}

func (ds *cleanupTrackingTransport) CloseIdleConnections() {
	ds.closeCount++
}

func TestPublicCatalogClosesTemporaryClient(t *testing.T) {
	for _, status := range []int{http.StatusOK, http.StatusInternalServerError} {
		t.Run(http.StatusText(status), func(t *testing.T) {
			application, err := newApp()
			if err != nil {
				t.Fatal(err)
			}
			transport := &cleanupTrackingTransport{RoundTripper: mockClient(func(*http.Request) (int, string) {
				return status, `[]`
			}).Transport}
			application.newClient = func(bool) *http.Client { return &http.Client{Transport: transport} }
			request := jsonRequest(http.MethodPost, "/api/public/projects", strings.NewReader(`{"url":"https://harbor.test"}`))
			application.routes().ServeHTTP(httptest.NewRecorder(), request)
			if transport.closeCount != 1 {
				t.Fatalf("temporary client cleanup count = %d, want 1", transport.closeCount)
			}
		})
	}
}

func TestFailedConnectionsCloseUnusedClients(t *testing.T) {
	for _, test := range []struct {
		name     string
		path     string
		upstream int
		want     int
	}{
		{name: "bad credentials", path: "/api/sessions", upstream: http.StatusUnauthorized, want: http.StatusUnauthorized},
		{name: "duplicate instance", path: "/api/instances", upstream: http.StatusOK, want: http.StatusConflict},
	} {
		t.Run(test.name, func(t *testing.T) {
			application, err := newApp()
			if err != nil {
				t.Fatal(err)
			}
			current := createTestSession(t, testSessionOptions{application: application, client: nil, demo: false})
			transport := &cleanupTrackingTransport{RoundTripper: mockClient(func(*http.Request) (int, string) {
				return test.upstream, `{"user_id":7}`
			}).Transport}
			application.newClient = func(bool) *http.Client { return &http.Client{Transport: transport} }
			request := jsonRequest(http.MethodPost, test.path, strings.NewReader(`{"url":"https://harbor.test","username":"admin","password":"password"}`))
			request.AddCookie(&http.Cookie{Name: sessionCookie, Value: current.ID})
			response := httptest.NewRecorder()
			application.routes().ServeHTTP(response, request)
			if response.Code != test.want || transport.closeCount != 1 {
				t.Fatalf("failed connection response = %d, cleanup count = %d", response.Code, transport.closeCount)
			}
			if _, ok := application.sessions.get(sessionDigest(current.ID)); !ok {
				t.Fatal("failed connection removed the original session")
			}
		})
	}
}

func TestAddInstanceRejectsInvalidSessionBeforeConnecting(t *testing.T) {
	application, err := newApp()
	if err != nil {
		t.Fatal(err)
	}
	application.newClient = func(bool) *http.Client {
		t.Fatal("invalid session attempted an upstream connection")
		return nil
	}
	request := jsonRequest(http.MethodPost, "/api/instances", strings.NewReader(`{"url":"https://harbor.test","username":"admin","password":"password"}`))
	request.AddCookie(&http.Cookie{Name: sessionCookie, Value: "unknown-session"})
	response := httptest.NewRecorder()
	application.routes().ServeHTTP(response, request)
	if response.Code != http.StatusUnauthorized {
		t.Fatalf("invalid session response = %d, want 401", response.Code)
	}
}

func TestReplacementSessionClosesPreviousConnections(t *testing.T) {
	for _, path := range []string{"/api/sessions", "/api/demo-sessions"} {
		t.Run(path, func(t *testing.T) {
			application, err := newApp()
			if err != nil {
				t.Fatal(err)
			}
			previousTransport := &cleanupTrackingTransport{}
			previous := createTestSession(t, testSessionOptions{application: application, client: &http.Client{Transport: previousTransport}, demo: false})
			candidateTransport := &cleanupTrackingTransport{RoundTripper: mockClient(func(*http.Request) (int, string) {
				return http.StatusOK, `{"user_id":7}`
			}).Transport}
			application.newClient = func(bool) *http.Client { return &http.Client{Transport: candidateTransport} }
			body := `{"url":"https://other.harbor.test","username":"admin","password":"password"}`
			if path == "/api/demo-sessions" {
				body = `{}`
			}
			request := jsonRequest(http.MethodPost, path, strings.NewReader(body))
			request.AddCookie(&http.Cookie{Name: sessionCookie, Value: previous.ID})
			response := httptest.NewRecorder()
			application.routes().ServeHTTP(response, request)
			if response.Code != http.StatusCreated || previousTransport.closeCount != 1 {
				t.Fatalf("replacement response = %d, previous cleanup count = %d", response.Code, previousTransport.closeCount)
			}
			if _, ok := application.sessions.get(sessionDigest(previous.ID)); ok {
				t.Fatal("replacement left the previous session and credentials in the store")
			}
			if candidateTransport.closeCount != 0 {
				t.Fatal("replacement closed the active connection client")
			}
		})
	}
}
