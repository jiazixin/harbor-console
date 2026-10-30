package app

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"strings"
)

func (a *app) handleConnect(w http.ResponseWriter, r *http.Request) {
	if !a.loginLimits.allow(clientIP(r)) {
		writeError(w, r, errRateLimited)
		return
	}
	var input connectRequest
	if err := decodeJSON(w, r, &input); err != nil {
		writeError(w, r, err)
		return
	}
	candidate, err := a.prepareConnection(r.Context(), input)
	if err != nil {
		writeError(w, r, err)
		return
	}
	if token, ok := ctxCreationToken(r); ok {
		candidate.ID = token
	}
	a.sessions.create(candidate)
	if previousID, ok := sessionIDFromRequest(r); ok {
		a.sessions.delete(previousID)
	}
	a.setSessionCookie(w, r, candidate.ID)
	writeJSON(w, http.StatusCreated, sessionInfo(candidate))
}

func (a *app) prepareConnection(ctx context.Context, input connectRequest) (*session, error) {
	instanceURL, err := validateHarborURL(input.URL)
	if err != nil {
		return nil, err
	}
	switch {
	case strings.TrimSpace(input.Username) == "":
		return nil, invalidField("username", "required", "is required")
	case input.Password == "":
		return nil, invalidField("password", "required", "is required")
	case len(input.URL) > 2048:
		return nil, invalidField("url", "too_long", "exceeds 2048 bytes")
	case len(input.Username) > 256:
		return nil, invalidField("username", "too_long", "exceeds 256 bytes")
	case len(input.Password) > 4096:
		return nil, invalidField("password", "too_long", "exceeds 4096 bytes")
	}
	candidate := &session{
		InstanceURL: instanceURL, Username: strings.TrimSpace(input.Username), Password: input.Password,
		SkipTLSVerify: input.SkipTLSVerify, Client: a.newClient(input.SkipTLSVerify),
	}
	// The projects endpoint permits anonymous access to public projects. Use the
	// protected current-user endpoint so a successful response proves the supplied
	// credentials are actually valid before creating or adding a session.
	var currentUser map[string]any
	if err := a.harborGetJSON(ctx, harborJSONRequest{current: candidate, path: "/api/v2.0/users/current", query: nil, out: &currentUser}); err != nil {
		closeSessionClient(candidate)
		connectFailure := *upstreamFailure(err)
		connectFailure.status = http.StatusServiceUnavailable
		if upstream, ok := errors.AsType[*upstreamError](err); ok && (upstream.StatusCode == http.StatusUnauthorized || upstream.StatusCode == http.StatusForbidden) {
			connectFailure.status = http.StatusUnauthorized
		}
		return nil, &connectFailure
	}
	return candidate, nil
}

func (a *app) handleDemo(w http.ResponseWriter, r *http.Request) {
	var input struct{}
	if err := decodeJSON(w, r, &input); err != nil {
		writeError(w, r, err)
		return
	}
	if !a.loginLimits.allow(clientIP(r)) {
		writeError(w, r, errRateLimited)
		return
	}
	demo := &session{InstanceURL: "https://harbor.demo.local", Username: "demo-admin", Demo: true, DemoData: newDemoState()}
	if token, ok := ctxCreationToken(r); ok {
		demo.ID = token
	}
	a.sessions.create(demo)
	if previousID, ok := sessionIDFromRequest(r); ok {
		a.sessions.delete(previousID)
	}
	a.setSessionCookie(w, r, demo.ID)
	writeJSON(w, http.StatusCreated, sessionInfo(demo))
}

func (a *app) handleSession(w http.ResponseWriter, r *http.Request) {
	ensureCreationCookie(w, r)
	current, ok := a.currentSession(r)
	if !ok {
		writeError(w, r, errSessionRequired)
		return
	}
	writeJSON(w, http.StatusOK, sessionInfo(current))
}

func (a *app) handleInstances(w http.ResponseWriter, r *http.Request) {
	current, ok := a.currentSession(r)
	if !ok {
		writeError(w, r, errSessionRequired)
		return
	}
	writeJSON(w, http.StatusOK, instancesInfo(current))
}

func (a *app) handleAddInstance(w http.ResponseWriter, r *http.Request) {
	previous, ok := a.currentSession(r)
	if !ok {
		writeError(w, r, errSessionRequired)
		return
	}
	if !a.loginLimits.allow(clientIP(r)) {
		writeError(w, r, errRateLimited)
		return
	}
	var input connectRequest
	if err := decodeJSON(w, r, &input); err != nil {
		writeError(w, r, err)
		return
	}
	candidate, err := a.prepareConnection(r.Context(), input)
	if err != nil {
		writeError(w, r, err)
		return
	}
	current, err := a.sessions.addInstance(previous.ID, candidate)
	if err != nil {
		closeSessionClient(candidate)
		writeInstanceStoreError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, sessionInfo(current))
}

func (a *app) handleAddDemoInstance(w http.ResponseWriter, r *http.Request) {
	current, ok := a.currentSession(r)
	if !ok {
		writeError(w, r, errSessionRequired)
		return
	}
	var input struct{}
	if err := decodeJSON(w, r, &input); err != nil {
		writeError(w, r, err)
		return
	}
	demo := &session{InstanceURL: nextDemoInstanceURL(current), Username: "demo-admin", Demo: true, DemoData: newDemoState()}
	current, err := a.sessions.addInstance(current.ID, demo)
	if err != nil {
		writeInstanceStoreError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, sessionInfo(current))
}

func nextDemoInstanceURL(current *session) string {
	connected := make(map[string]bool, len(current.Instances))
	for _, instance := range current.Instances {
		connected[instance.InstanceURL] = true
	}
	for index := 2; ; index++ {
		candidate := fmt.Sprintf("https://harbor-demo-%d.local", index)
		if !connected[candidate] {
			return candidate
		}
	}
}

func (a *app) handleSwitchInstance(w http.ResponseWriter, r *http.Request) {
	sessionID, ok := sessionIDFromRequest(r)
	if !ok {
		writeError(w, r, errSessionRequired)
		return
	}
	var input struct {
		ID string `json:"id"`
	}
	if err := decodeJSON(w, r, &input); err != nil {
		writeError(w, r, err)
		return
	}
	if !connectionIDPattern.MatchString(input.ID) {
		writeError(w, r, errInvalidInstanceID)
		return
	}
	current, err := a.sessions.switchInstance(sessionID, input.ID)
	if err != nil {
		writeInstanceStoreError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, sessionInfo(current))
}

func (a *app) handleDeleteInstance(w http.ResponseWriter, r *http.Request) {
	sessionID, ok := sessionIDFromRequest(r)
	if !ok {
		writeError(w, r, errSessionRequired)
		return
	}
	connectionID := strings.TrimSpace(r.PathValue("id"))
	if !connectionIDPattern.MatchString(connectionID) {
		writeError(w, r, errInvalidInstanceID)
		return
	}
	current, err := a.sessions.removeInstance(sessionID, connectionID)
	if err != nil {
		writeInstanceStoreError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, sessionInfo(current))
}

func writeInstanceStoreError(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, errSessionNotFound):
		writeError(w, r, errSessionRequired)
	case errors.Is(err, errInstanceNotFound):
		writeError(w, r, failure(http.StatusNotFound, "instance_not_found", "Harbor connection not found"))
	case errors.Is(err, errInstanceExists):
		writeError(w, r, failure(http.StatusConflict, "instance_exists", "the same URL and account are already connected"))
	case errors.Is(err, errInstanceLimit):
		writeError(w, r, failure(http.StatusConflict, "instance_limit_reached", "session instance limit reached").with("limit", maxInstances))
	case errors.Is(err, errLastInstance):
		writeError(w, r, failure(http.StatusConflict, "last_instance", "cannot remove the last instance; log out instead"))
	default:
		writeError(w, r, fmt.Errorf("update session: %w", err))
	}
}

func (a *app) handleLogout(w http.ResponseWriter, r *http.Request) {
	if cookie, err := r.Cookie(sessionCookie); err == nil {
		a.sessions.delete(sessionDigest(cookie.Value))
	}
	http.SetCookie(w, &http.Cookie{
		Name: sessionCookie, Value: "", Path: "/", HttpOnly: true,
		SameSite: http.SameSiteStrictMode, Secure: requestIsTLS(r), MaxAge: -1,
	})
	w.WriteHeader(http.StatusNoContent)
}

var connectionIDPattern = regexp.MustCompile(`^[A-Z2-7]{26}$`)

func ctxCreationToken(r *http.Request) (string, bool) {
	token, ok := r.Context().Value(creationTokenKey{}).(string)
	return token, ok
}
