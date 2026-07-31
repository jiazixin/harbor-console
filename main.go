package main

import (
	"context"
	"crypto/rand"
	"crypto/tls"
	"embed"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"log/slog"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"sort"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"
)

const (
	sessionCookie  = "harbor_console_sid"
	sessionTTL     = 12 * time.Hour
	consoleVersion = "0.3.0-dev"
	maxBodyBytes   = 1 << 20
	maxReplyBytes  = 8 << 20
	maxSessions    = 1000
	maxInstances   = 20
	maxQueryBytes  = 8 << 10

	projectAssetPageSize       = 100
	dashboardProjectPageSize   = 100
	maxConcurrentProjectAssets = 8
)

//go:embed web/*
var embeddedWeb embed.FS

type session struct {
	ID             string
	InstanceURL    string
	Username       string
	Password       string
	SkipTLSVerify  bool
	Demo           bool
	CreatedAt      time.Time
	ExpiresAt      time.Time
	LastAccessedAt time.Time
	Client         *http.Client
	DemoData       *demoState
	ActiveInstance string
	Instances      map[string]*harborConnection
}

type harborConnection struct {
	ID            string
	InstanceURL   string
	Username      string
	Password      string
	SkipTLSVerify bool
	Demo          bool
	AddedAt       time.Time
	Client        *http.Client
	DemoData      *demoState
}

type sessionStore struct {
	mu       sync.RWMutex
	sessions map[string]*session
}

type rateLimiter struct {
	mu      sync.Mutex
	entries map[string][]time.Time
	limit   int
	window  time.Duration
}

func newRateLimiter(limit int, window time.Duration) *rateLimiter {
	return &rateLimiter{entries: make(map[string][]time.Time), limit: limit, window: window}
}

func (l *rateLimiter) allow(key string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := time.Now()
	cutoff := now.Add(-l.window)
	if len(l.entries) > 2048 {
		for entryKey, entryValues := range l.entries {
			if len(entryValues) == 0 || entryValues[len(entryValues)-1].Before(cutoff) {
				delete(l.entries, entryKey)
			}
		}
	}
	values := l.entries[key]
	kept := values[:0]
	for _, value := range values {
		if value.After(cutoff) {
			kept = append(kept, value)
		}
	}
	if len(kept) >= l.limit {
		l.entries[key] = kept
		return false
	}
	l.entries[key] = append(kept, now)
	return true
}

func newSessionStore() *sessionStore {
	return &sessionStore{sessions: make(map[string]*session)}
}

func (s *sessionStore) create(value *session) error {
	id, err := randomID()
	if err != nil {
		return err
	}
	connectionID, err := randomID()
	if err != nil {
		return err
	}
	now := time.Now()
	value.ID = id
	value.CreatedAt = now
	value.LastAccessedAt = now
	value.ExpiresAt = now.Add(sessionTTL)
	value.ActiveInstance = connectionID
	value.Instances = map[string]*harborConnection{connectionID: connectionFromSession(connectionID, value, now)}
	s.mu.Lock()
	for key, existing := range s.sessions {
		if now.After(existing.ExpiresAt) {
			closeSessionClient(existing)
			delete(s.sessions, key)
		}
	}
	if len(s.sessions) >= maxSessions {
		var oldestID string
		var oldestTime time.Time
		for key, existing := range s.sessions {
			if oldestID == "" || existing.LastAccessedAt.Before(oldestTime) {
				oldestID = key
				oldestTime = existing.LastAccessedAt
			}
		}
		closeSessionClient(s.sessions[oldestID])
		delete(s.sessions, oldestID)
	}
	s.sessions[id] = value
	s.mu.Unlock()
	return nil
}

func (s *sessionStore) get(id string) (*session, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	value, ok := s.sessions[id]
	if !ok || time.Now().After(value.ExpiresAt) {
		closeSessionClient(value)
		delete(s.sessions, id)
		return nil, false
	}
	value.LastAccessedAt = time.Now()
	return cloneSession(value), true
}

func (s *sessionStore) delete(id string) {
	s.mu.Lock()
	closeSessionClient(s.sessions[id])
	delete(s.sessions, id)
	s.mu.Unlock()
}

func (s *sessionStore) updateActivePassword(sessionID, password string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	current, ok := s.sessions[sessionID]
	if !ok || time.Now().After(current.ExpiresAt) {
		return errSessionNotFound
	}
	connection, ok := current.Instances[current.ActiveInstance]
	if !ok {
		return errInstanceNotFound
	}
	current.Password = password
	connection.Password = password
	current.LastAccessedAt = time.Now()
	return nil
}

var (
	errSessionNotFound  = errors.New("session not found")
	errInstanceNotFound = errors.New("instance not found")
	errInstanceExists   = errors.New("instance already exists")
	errInstanceLimit    = errors.New("instance limit reached")
	errLastInstance     = errors.New("last instance cannot be removed")
)

func (s *sessionStore) addInstance(sessionID string, candidate *session) (*session, error) {
	connectionID, err := randomID()
	if err != nil {
		return nil, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	current, ok := s.sessions[sessionID]
	if !ok || time.Now().After(current.ExpiresAt) {
		return nil, errSessionNotFound
	}
	if len(current.Instances) >= maxInstances {
		return nil, errInstanceLimit
	}
	for _, existing := range current.Instances {
		if existing.InstanceURL == candidate.InstanceURL && existing.Username == candidate.Username {
			return nil, errInstanceExists
		}
	}
	connection := connectionFromSession(connectionID, candidate, time.Now())
	current.Instances[connectionID] = connection
	current.ActiveInstance = connectionID
	applyConnection(current, connection)
	current.LastAccessedAt = time.Now()
	return cloneSession(current), nil
}

func (s *sessionStore) switchInstance(sessionID, connectionID string) (*session, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	current, ok := s.sessions[sessionID]
	if !ok || time.Now().After(current.ExpiresAt) {
		return nil, errSessionNotFound
	}
	connection, ok := current.Instances[connectionID]
	if !ok {
		return nil, errInstanceNotFound
	}
	current.ActiveInstance = connectionID
	applyConnection(current, connection)
	current.LastAccessedAt = time.Now()
	return cloneSession(current), nil
}

func (s *sessionStore) removeInstance(sessionID, connectionID string) (*session, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	current, ok := s.sessions[sessionID]
	if !ok || time.Now().After(current.ExpiresAt) {
		return nil, errSessionNotFound
	}
	connection, ok := current.Instances[connectionID]
	if !ok {
		return nil, errInstanceNotFound
	}
	if len(current.Instances) <= 1 {
		return nil, errLastInstance
	}
	if connection.Client != nil {
		connection.Client.CloseIdleConnections()
	}
	delete(current.Instances, connectionID)
	if current.ActiveInstance == connectionID {
		var next *harborConnection
		for _, candidate := range current.Instances {
			if next == nil || candidate.AddedAt.Before(next.AddedAt) {
				next = candidate
			}
		}
		current.ActiveInstance = next.ID
		applyConnection(current, next)
	}
	current.LastAccessedAt = time.Now()
	return cloneSession(current), nil
}

func cloneSession(current *session) *session {
	copy := *current
	copy.Instances = make(map[string]*harborConnection, len(current.Instances))
	for id, connection := range current.Instances {
		connectionCopy := *connection
		copy.Instances[id] = &connectionCopy
	}
	return &copy
}

func connectionFromSession(id string, current *session, addedAt time.Time) *harborConnection {
	return &harborConnection{
		ID: id, InstanceURL: current.InstanceURL, Username: current.Username, Password: current.Password,
		SkipTLSVerify: current.SkipTLSVerify, Demo: current.Demo, AddedAt: addedAt, Client: current.Client, DemoData: current.DemoData,
	}
}

func applyConnection(current *session, connection *harborConnection) {
	current.InstanceURL = connection.InstanceURL
	current.Username = connection.Username
	current.Password = connection.Password
	current.SkipTLSVerify = connection.SkipTLSVerify
	current.Demo = connection.Demo
	current.Client = connection.Client
	current.DemoData = connection.DemoData
}

func closeSessionClient(current *session) {
	if current == nil {
		return
	}
	if len(current.Instances) > 0 {
		for _, connection := range current.Instances {
			if connection.Client != nil {
				connection.Client.CloseIdleConnections()
			}
		}
		return
	}
	if current.Client != nil {
		current.Client.CloseIdleConnections()
	}
}

type app struct {
	sessions     *sessionStore
	loginLimits  *rateLimiter
	publicLimits *rateLimiter
	web          http.Handler
	newClient    func(skipTLSVerify bool) *http.Client
	healthURI    string
	startedAt    time.Time
	logger       *slog.Logger
	logging      loggingConfig
}

type connectRequest struct {
	URL           string `json:"url"`
	Username      string `json:"username"`
	Password      string `json:"password"`
	SkipTLSVerify bool   `json:"skip_tls_verify"`
}

type publicCatalogRequest struct {
	URL           string `json:"url"`
	SkipTLSVerify bool   `json:"skip_tls_verify"`
	Project       string `json:"project"`
	Repository    string `json:"repository"`
	Page          int    `json:"page"`
	PageSize      int    `json:"page_size"`
	Query         string `json:"query"`
}

type apiError struct {
	Error   string `json:"error"`
	Details string `json:"details,omitempty"`
}

type upstreamError struct {
	StatusCode int
	Message    string
}

func (e *upstreamError) Error() string {
	return e.Message
}

func newApp() (*app, error) {
	return newAppWithConfig(defaultRuntimeConfig(), slog.New(slog.NewTextHandler(io.Discard, nil)))
}

func newAppWithConfig(config runtimeConfig, logger *slog.Logger) (*app, error) {
	if err := config.validate(); err != nil {
		return nil, err
	}
	if logger == nil {
		logger = slog.New(slog.NewTextHandler(io.Discard, nil))
	}
	webRoot, err := fs.Sub(embeddedWeb, "web")
	if err != nil {
		return nil, err
	}
	return &app{
		sessions:     newSessionStore(),
		loginLimits:  newRateLimiter(30, time.Minute),
		publicLimits: newRateLimiter(180, time.Minute),
		web:          http.FileServer(http.FS(webRoot)),
		newClient:    newHarborClient,
		healthURI:    config.Health.URI,
		startedAt:    time.Now(),
		logger:       logger,
		logging:      config.Logging,
	}, nil
}

func (a *app) routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc(a.healthURI, a.handleHealth)
	mux.HandleFunc("GET /api/about", a.handleAbout)
	mux.HandleFunc("POST /api/public/projects", a.handlePublicProjects)
	mux.HandleFunc("POST /api/public/repositories", a.handlePublicRepositories)
	mux.HandleFunc("POST /api/public/artifacts", a.handlePublicArtifacts)
	mux.HandleFunc("POST /api/connect", a.handleConnect)
	mux.HandleFunc("POST /api/demo", a.handleDemo)
	mux.HandleFunc("GET /api/session", a.handleSession)
	mux.HandleFunc("DELETE /api/session", a.handleLogout)
	mux.HandleFunc("GET /api/instances", a.handleInstances)
	mux.HandleFunc("POST /api/instances", a.handleAddInstance)
	mux.HandleFunc("POST /api/instances/demo", a.handleAddDemoInstance)
	mux.HandleFunc("PUT /api/instances/current", a.handleSwitchInstance)
	mux.HandleFunc("DELETE /api/instances/{id}", a.handleDeleteInstance)
	mux.HandleFunc("GET /api/dashboard", a.handleDashboard)
	mux.HandleFunc("GET /api/resources/{kind}", a.handleResource)
	mux.HandleFunc("/api/control/{operation}", a.handleControl)
	mux.HandleFunc("GET /api/search", a.handleSearch)
	mux.Handle("/", a.web)
	handler := accessLogMiddleware(mux, a.logger, a.logging, a.healthURI)
	return securityHeaders(handler, a.healthURI)
}

func (a *app) handleHealth(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.Header().Set("Allow", http.MethodGet)
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"status": "error", "error": "method_not_allowed"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"status":         "ok",
		"service":        "harbor-console",
		"uptime_seconds": max(int64(0), int64(time.Since(a.startedAt)/time.Second)),
	})
}

func (a *app) handleAbout(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"console": map[string]any{
			"name": "Harbor Console", "version": consoleVersion, "deployment": "single-binary", "offline": true,
		},
		"harbor": map[string]any{
			"target_version": "v2.15.2", "api_version": "v2.0",
			"license": map[string]string{"name": "Apache License 2.0", "spdx": "Apache-2.0"},
		},
		"public_catalog": []map[string]any{
			{"id": "public-projects", "method": http.MethodGet, "path": "/api/v2.0/projects", "anonymous": true},
			{"id": "public-repositories", "method": http.MethodGet, "path": "/api/v2.0/projects/{project}/repositories", "anonymous": true},
			{"id": "public-artifacts", "method": http.MethodGet, "path": "/api/v2.0/projects/{project}/repositories/{repository}/artifacts", "anonymous": true},
		},
	})
}

func (a *app) handlePublicProjects(w http.ResponseWriter, r *http.Request) {
	a.handlePublicCatalog(w, r, "projects")
}

func (a *app) handlePublicRepositories(w http.ResponseWriter, r *http.Request) {
	a.handlePublicCatalog(w, r, "repositories")
}

func (a *app) handlePublicArtifacts(w http.ResponseWriter, r *http.Request) {
	a.handlePublicCatalog(w, r, "artifacts")
}

func (a *app) handlePublicCatalog(w http.ResponseWriter, r *http.Request, resource string) {
	if !sameOrigin(r) {
		writeError(w, http.StatusForbidden, "请求来源无效", "请从当前控制台浏览公开目录")
		return
	}
	if !a.publicLimits.allow(clientIP(r)) {
		writeError(w, http.StatusTooManyRequests, "公开目录请求过于频繁", "请稍后重试")
		return
	}
	var input publicCatalogRequest
	if err := decodeJSON(w, r, &input); err != nil {
		writeError(w, http.StatusBadRequest, "公开目录请求无效", err.Error())
		return
	}
	current, query, path, headers, err := a.buildPublicCatalogRequest(input, resource)
	if err != nil {
		writeError(w, http.StatusBadRequest, "公开目录请求无效", err.Error())
		return
	}
	response, err := a.harborRequest(r.Context(), current, http.MethodGet, path, query, nil, headers)
	if err != nil {
		writeUpstreamError(w, err)
		return
	}
	writeControlResponse(w, response, controlMethod{list: true}, query)
}

func (a *app) buildPublicCatalogRequest(input publicCatalogRequest, resource string) (*session, url.Values, string, http.Header, error) {
	instanceURL, err := validateHarborURL(input.URL)
	if err != nil {
		return nil, nil, "", nil, err
	}
	if len(input.URL) > 2048 {
		return nil, nil, "", nil, errors.New("Harbor 地址长度超过限制")
	}
	page := input.Page
	if page == 0 {
		page = 1
	}
	pageSize := input.PageSize
	if pageSize == 0 {
		pageSize = 20
	}
	if page < 1 || page > 1_000_000 || pageSize < 1 || pageSize > 100 {
		return nil, nil, "", nil, errors.New("分页参数超出允许范围")
	}
	if len(input.Query) > 255 || strings.ContainsAny(input.Query, "\r\n\x00,=") {
		return nil, nil, "", nil, errors.New("搜索内容包含无效字符或长度过长")
	}
	current := &session{InstanceURL: instanceURL, SkipTLSVerify: input.SkipTLSVerify, Client: a.newClient(input.SkipTLSVerify)}
	query := url.Values{"page": {strconv.Itoa(page)}, "page_size": {strconv.Itoa(pageSize)}}
	headers := make(http.Header)
	switch resource {
	case "projects":
		query.Set("sort", "name")
		query.Set("public", "true")
		query.Set("with_detail", "true")
		if term := strings.TrimSpace(input.Query); term != "" {
			query.Set("q", "name=~"+term)
		}
		return current, query, "/api/v2.0/projects", headers, nil
	case "repositories", "artifacts":
		project := strings.TrimSpace(input.Project)
		if err := validateResourceName(project, "项目名称", 255, false); err != nil {
			return nil, nil, "", nil, err
		}
		headers.Set("X-Is-Resource-Name", "true")
		base := "/api/v2.0/projects/" + url.PathEscape(project) + "/repositories"
		if resource == "repositories" {
			query.Set("sort", "name")
			if term := strings.TrimSpace(input.Query); term != "" {
				query.Set("q", "name=~"+term)
			}
			return current, query, base, headers, nil
		}
		repository := strings.TrimSpace(input.Repository)
		repository = strings.TrimPrefix(repository, project+"/")
		if repository == "" || len(repository) > 1024 || strings.ContainsAny(repository, "\r\n\x00") {
			return nil, nil, "", nil, errors.New("仓库名称无效")
		}
		query.Set("sort", "-push_time")
		query.Set("with_tag", "true")
		query.Set("with_label", "true")
		query.Set("with_scan_overview", "true")
		query.Set("with_accessory", "true")
		path := base + "/" + url.PathEscape(url.PathEscape(repository)) + "/artifacts"
		return current, query, path, headers, nil
	default:
		return nil, nil, "", nil, errors.New("未知公开目录资源")
	}
}

func securityHeaders(next http.Handler, healthPaths ...string) http.Handler {
	healthSet := make(map[string]struct{}, len(healthPaths))
	for _, healthPath := range healthPaths {
		healthSet[healthPath] = struct{}{}
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Referrer-Policy", "same-origin")
		w.Header().Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
		w.Header().Set("Content-Security-Policy", "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; font-src 'self'")
		_, healthRequest := healthSet[r.URL.Path]
		if strings.HasPrefix(r.URL.Path, "/api/") || healthRequest {
			w.Header().Set("Cache-Control", "no-store")
		}
		if requestIsTLS(r) {
			w.Header().Set("Strict-Transport-Security", "max-age=31536000")
		}
		next.ServeHTTP(w, r)
	})
}

func (a *app) handleConnect(w http.ResponseWriter, r *http.Request) {
	if !sameOrigin(r) {
		writeError(w, http.StatusForbidden, "请求来源无效", "请从当前控制台提交连接请求")
		return
	}
	if !a.loginLimits.allow(clientIP(r)) {
		writeError(w, http.StatusTooManyRequests, "连接尝试过于频繁", "请等待一分钟后重试")
		return
	}
	var input connectRequest
	if err := decodeJSON(w, r, &input); err != nil {
		writeError(w, http.StatusBadRequest, "连接信息无效", err.Error())
		return
	}
	candidate, status, err := a.prepareConnection(r.Context(), input)
	if err != nil {
		writeError(w, status, "无法连接 Harbor", err.Error())
		return
	}
	if err := a.sessions.create(candidate); err != nil {
		writeError(w, http.StatusInternalServerError, "无法创建会话", "随机会话标识生成失败")
		return
	}
	a.setSessionCookie(w, r, candidate.ID)
	writeJSON(w, http.StatusOK, sessionInfo(candidate))
}

func (a *app) prepareConnection(ctx context.Context, input connectRequest) (*session, int, error) {
	instanceURL, err := validateHarborURL(input.URL)
	if err != nil {
		return nil, http.StatusBadRequest, err
	}
	if strings.TrimSpace(input.Username) == "" || input.Password == "" {
		return nil, http.StatusBadRequest, errors.New("请输入 Harbor 用户名和密码")
	}
	if len(input.URL) > 2048 || len(input.Username) > 256 || len(input.Password) > 4096 {
		return nil, http.StatusBadRequest, errors.New("请检查 Harbor 地址和登录信息，字段长度超过限制")
	}
	candidate := &session{
		InstanceURL: instanceURL, Username: strings.TrimSpace(input.Username), Password: input.Password,
		SkipTLSVerify: input.SkipTLSVerify, Client: a.newClient(input.SkipTLSVerify),
	}
	var projects any
	query := url.Values{"page": {"1"}, "page_size": {"1"}}
	if err := a.harborJSON(ctx, candidate, http.MethodGet, "/api/v2.0/projects", query, &projects); err != nil {
		status := http.StatusBadGateway
		var upstream *upstreamError
		if errors.As(err, &upstream) && (upstream.StatusCode == http.StatusUnauthorized || upstream.StatusCode == http.StatusForbidden) {
			status = http.StatusUnauthorized
		}
		return nil, status, errors.New(friendlyUpstreamError(err))
	}
	return candidate, http.StatusOK, nil
}

func (a *app) handleDemo(w http.ResponseWriter, r *http.Request) {
	if !sameOrigin(r) {
		writeError(w, http.StatusForbidden, "请求来源无效", "请从当前控制台提交请求")
		return
	}
	if !a.loginLimits.allow(clientIP(r)) {
		writeError(w, http.StatusTooManyRequests, "请求过于频繁", "请等待一分钟后重试")
		return
	}
	demo := &session{InstanceURL: "https://harbor.demo.local", Username: "demo-admin", Demo: true, DemoData: newDemoState()}
	if err := a.sessions.create(demo); err != nil {
		writeError(w, http.StatusInternalServerError, "无法创建演示会话", "随机会话标识生成失败")
		return
	}
	a.setSessionCookie(w, r, demo.ID)
	writeJSON(w, http.StatusOK, sessionInfo(demo))
}

func (a *app) handleSession(w http.ResponseWriter, r *http.Request) {
	current, ok := a.currentSession(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "尚未连接 Harbor", "请先连接实例")
		return
	}
	writeJSON(w, http.StatusOK, sessionInfo(current))
}

func (a *app) handleInstances(w http.ResponseWriter, r *http.Request) {
	current, ok := a.currentSession(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "会话已失效", "请重新连接 Harbor")
		return
	}
	writeJSON(w, http.StatusOK, instancesInfo(current))
}

func (a *app) handleAddInstance(w http.ResponseWriter, r *http.Request) {
	if !sameOrigin(r) {
		writeError(w, http.StatusForbidden, "请求来源无效", "请从当前控制台提交连接请求")
		return
	}
	sessionID, ok := sessionIDFromRequest(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "会话已失效", "请重新连接 Harbor")
		return
	}
	if !a.loginLimits.allow(clientIP(r)) {
		writeError(w, http.StatusTooManyRequests, "连接尝试过于频繁", "请等待一分钟后重试")
		return
	}
	var input connectRequest
	if err := decodeJSON(w, r, &input); err != nil {
		writeError(w, http.StatusBadRequest, "连接信息无效", err.Error())
		return
	}
	candidate, status, err := a.prepareConnection(r.Context(), input)
	if err != nil {
		writeError(w, status, "无法连接 Harbor", err.Error())
		return
	}
	current, err := a.sessions.addInstance(sessionID, candidate)
	if err != nil {
		writeInstanceStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, sessionInfo(current))
}

func (a *app) handleAddDemoInstance(w http.ResponseWriter, r *http.Request) {
	if !sameOrigin(r) {
		writeError(w, http.StatusForbidden, "请求来源无效", "请从当前控制台提交请求")
		return
	}
	sessionID, ok := sessionIDFromRequest(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "会话已失效", "请重新连接 Harbor")
		return
	}
	current, ok := a.currentSession(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "会话已失效", "请重新连接 Harbor")
		return
	}
	index := len(current.Instances) + 1
	demo := &session{InstanceURL: fmt.Sprintf("https://harbor-demo-%d.local", index), Username: "demo-admin", Demo: true, DemoData: newDemoState()}
	current, err := a.sessions.addInstance(sessionID, demo)
	if err != nil {
		writeInstanceStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, sessionInfo(current))
}

func (a *app) handleSwitchInstance(w http.ResponseWriter, r *http.Request) {
	if !sameOrigin(r) {
		writeError(w, http.StatusForbidden, "请求来源无效", "请从当前控制台提交请求")
		return
	}
	sessionID, ok := sessionIDFromRequest(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "会话已失效", "请重新连接 Harbor")
		return
	}
	var input struct {
		ID string `json:"id"`
	}
	if err := decodeJSON(w, r, &input); err != nil || len(input.ID) != 64 {
		writeError(w, http.StatusBadRequest, "实例标识无效", "请选择已有 Harbor 实例")
		return
	}
	current, err := a.sessions.switchInstance(sessionID, input.ID)
	if err != nil {
		writeInstanceStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, sessionInfo(current))
}

func (a *app) handleDeleteInstance(w http.ResponseWriter, r *http.Request) {
	if !sameOrigin(r) {
		writeError(w, http.StatusForbidden, "请求来源无效", "请从当前控制台提交请求")
		return
	}
	sessionID, ok := sessionIDFromRequest(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "会话已失效", "请重新连接 Harbor")
		return
	}
	connectionID := strings.TrimSpace(r.PathValue("id"))
	if len(connectionID) != 64 {
		writeError(w, http.StatusBadRequest, "实例标识无效", "请选择已有 Harbor 实例")
		return
	}
	current, err := a.sessions.removeInstance(sessionID, connectionID)
	if err != nil {
		writeInstanceStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, sessionInfo(current))
}

func writeInstanceStoreError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, errSessionNotFound):
		writeError(w, http.StatusUnauthorized, "会话已失效", "请重新连接 Harbor")
	case errors.Is(err, errInstanceNotFound):
		writeError(w, http.StatusNotFound, "实例不存在", "该 Harbor 连接可能已被移除")
	case errors.Is(err, errInstanceExists):
		writeError(w, http.StatusConflict, "实例已经连接", "同一地址和账号无需重复添加")
	case errors.Is(err, errInstanceLimit):
		writeError(w, http.StatusConflict, "实例数量已达上限", fmt.Sprintf("每个会话最多连接 %d 个实例", maxInstances))
	case errors.Is(err, errLastInstance):
		writeError(w, http.StatusConflict, "不能移除最后一个实例", "如需结束会话，请使用断开连接")
	default:
		writeError(w, http.StatusInternalServerError, "实例操作失败", "无法更新当前会话")
	}
}

func (a *app) handleLogout(w http.ResponseWriter, r *http.Request) {
	if !sameOrigin(r) {
		writeError(w, http.StatusForbidden, "请求来源无效", "请从当前控制台提交请求")
		return
	}
	if cookie, err := r.Cookie(sessionCookie); err == nil {
		a.sessions.delete(cookie.Value)
	}
	http.SetCookie(w, &http.Cookie{
		Name: sessionCookie, Value: "", Path: "/", HttpOnly: true,
		SameSite: http.SameSiteStrictMode, Secure: requestIsTLS(r), MaxAge: -1,
	})
	w.WriteHeader(http.StatusNoContent)
}

func (a *app) handleDashboard(w http.ResponseWriter, r *http.Request) {
	current, ok := a.currentSession(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "会话已失效", "请重新连接 Harbor")
		return
	}
	if current.Demo {
		writeJSON(w, http.StatusOK, current.DemoData.dashboard())
		return
	}

	type target struct {
		key   string
		path  string
		query url.Values
	}
	targets := []target{
		{key: "health", path: "/api/v2.0/health"},
		{key: "statistics", path: "/api/v2.0/statistics"},
		{key: "systeminfo", path: "/api/v2.0/systeminfo"},
		{key: "replications", path: "/api/v2.0/replication/executions", query: url.Values{"page": {"1"}, "page_size": {"6"}, "sort": {"-start_time"}}},
		{key: "replication_policies", path: "/api/v2.0/replication/policies", query: url.Values{"page": {"1"}, "page_size": {"100"}, "sort": {"name"}}},
		{key: "registries", path: "/api/v2.0/registries", query: url.Values{"page": {"1"}, "page_size": {"20"}}},
		{key: "scanners", path: "/api/v2.0/scanners"},
	}

	result := map[string]any{"mode": "live", "instance": sessionInfo(current)}
	warnings := make([]string, 0)
	var mu sync.Mutex
	var wg sync.WaitGroup
	for _, item := range targets {
		item := item
		wg.Add(1)
		go func() {
			defer wg.Done()
			var payload any
			err := a.harborJSON(r.Context(), current, http.MethodGet, item.path, item.query, &payload)
			mu.Lock()
			defer mu.Unlock()
			if err != nil {
				warnings = append(warnings, item.key+": "+friendlyUpstreamError(err))
				return
			}
			result[item.key] = payload
		}()
	}
	wg.Add(1)
	go func() {
		defer wg.Done()
		projects, err := a.listAllProjects(r.Context(), current)
		mu.Lock()
		defer mu.Unlock()
		if err != nil {
			warnings = append(warnings, "projects: "+friendlyUpstreamError(err))
			return
		}
		result["projects"] = projects
	}()
	wg.Wait()
	if projects, ok := result["projects"].([]any); ok {
		if a.enrichProjectAssets(r.Context(), current, projects) {
			warnings = append(warnings, "部分项目资产明细读取失败，排序数据可能不完整")
		}
	}
	result["warnings"] = warnings
	writeJSON(w, http.StatusOK, result)
}

func (a *app) listAllProjects(ctx context.Context, current *session) ([]any, error) {
	projects := make([]any, 0)
	for page := 1; ; page++ {
		query := url.Values{
			"page":      {strconv.Itoa(page)},
			"page_size": {strconv.Itoa(dashboardProjectPageSize)},
			"sort":      {"-creation_time"},
		}
		response, err := a.harborRequest(ctx, current, http.MethodGet, "/api/v2.0/projects", query, nil, nil)
		if err != nil {
			return nil, err
		}
		var pageItems []any
		if err := json.Unmarshal(response.Body, &pageItems); err != nil {
			return nil, fmt.Errorf("Harbor returned invalid project JSON: %w", err)
		}
		projects = append(projects, pageItems...)
		total, totalErr := strconv.Atoi(response.Header.Get("X-Total-Count"))
		if len(pageItems) == 0 || (totalErr == nil && total >= 0 && len(projects) >= total) || (totalErr != nil && len(pageItems) < dashboardProjectPageSize) {
			break
		}
	}
	return projects, nil
}

func (a *app) enrichProjectAssets(ctx context.Context, current *session, projects []any) bool {
	var wg sync.WaitGroup
	var mu sync.Mutex
	semaphore := make(chan struct{}, maxConcurrentProjectAssets)
	hadError := false
	for _, rawProject := range projects {
		project, ok := rawProject.(map[string]any)
		if !ok {
			continue
		}
		name, _ := project["name"].(string)
		if strings.TrimSpace(name) == "" {
			continue
		}
		semaphore <- struct{}{}
		wg.Add(1)
		go func(project map[string]any, projectName string) {
			defer wg.Done()
			defer func() { <-semaphore }()
			headers := http.Header{"X-Is-Resource-Name": {"true"}}
			encodedName := url.PathEscape(projectName)
			summaryResponse, summaryErr := a.harborRequest(ctx, current, http.MethodGet, "/api/v2.0/projects/"+encodedName+"/summary", nil, nil, headers)
			if summaryErr == nil {
				var summary map[string]any
				if err := json.Unmarshal(summaryResponse.Body, &summary); err == nil {
					quota, _ := summary["quota"].(map[string]any)
					used, _ := quota["used"].(map[string]any)
					project["storage_used"] = numberValue(used["storage"])
				} else {
					summaryErr = err
				}
			}
			artifactCount, repositoriesErr := a.projectArtifactCount(ctx, current, encodedName, headers)
			if repositoriesErr == nil || artifactCount > 0 {
				project["artifact_count"] = artifactCount
			}
			if summaryErr != nil || repositoriesErr != nil {
				mu.Lock()
				hadError = true
				mu.Unlock()
			}
		}(project, name)
	}
	wg.Wait()
	return hadError
}

func (a *app) projectArtifactCount(ctx context.Context, current *session, encodedProjectName string, headers http.Header) (int64, error) {
	artifactCount := int64(0)
	path := "/api/v2.0/projects/" + encodedProjectName + "/repositories"
	for page := 1; ; page++ {
		query := url.Values{"page": {strconv.Itoa(page)}, "page_size": {strconv.Itoa(projectAssetPageSize)}}
		response, err := a.harborRequest(ctx, current, http.MethodGet, path, query, nil, headers)
		if err != nil {
			return artifactCount, err
		}
		var repositories []map[string]any
		if err := json.Unmarshal(response.Body, &repositories); err != nil {
			return artifactCount, fmt.Errorf("Harbor returned invalid repository JSON: %w", err)
		}
		for _, repository := range repositories {
			artifactCount += numberValue(repository["artifact_count"])
		}
		total, totalErr := strconv.Atoi(response.Header.Get("X-Total-Count"))
		if len(repositories) == 0 || (totalErr == nil && total >= 0 && page*projectAssetPageSize >= total) || (totalErr != nil && len(repositories) < projectAssetPageSize) {
			break
		}
	}
	return artifactCount, nil
}

type resourceSpec struct {
	path          string
	requiredQuery []string
	allowedQuery  []string
}

var resourceSpecs = map[string]resourceSpec{
	"projects": {
		path: "/api/v2.0/projects", allowedQuery: []string{"page", "page_size", "sort", "name", "public"},
	},
	"repositories": {
		path: "/api/v2.0/projects/{project}/repositories", requiredQuery: []string{"project"}, allowedQuery: []string{"page", "page_size", "sort", "q"},
	},
	"artifacts": {
		path: "/api/v2.0/projects/{project}/repositories/{repository}/artifacts", requiredQuery: []string{"project", "repository"}, allowedQuery: []string{"page", "page_size", "sort", "q", "with_tag", "with_scan_overview", "with_label", "with_accessory", "with_signature"},
	},
	"replication-policies": {
		path: "/api/v2.0/replication/policies", allowedQuery: []string{"page", "page_size", "sort", "name"},
	},
	"replications": {
		path: "/api/v2.0/replication/executions", allowedQuery: []string{"page", "page_size", "sort", "policy_id", "status", "trigger"},
	},
	"registries": {
		path: "/api/v2.0/registries", allowedQuery: []string{"page", "page_size", "sort", "name"},
	},
	"scanners": {path: "/api/v2.0/scanners"},
	"audit-logs": {
		path: "/api/v2.0/auditlog-exts", allowedQuery: []string{"q", "page", "page_size", "sort"},
	},
	"systeminfo": {path: "/api/v2.0/systeminfo"},
	"volumes":    {path: "/api/v2.0/systeminfo/volumes"},
	"health":     {path: "/api/v2.0/health"},
}

func (a *app) handleResource(w http.ResponseWriter, r *http.Request) {
	current, ok := a.currentSession(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "会话已失效", "请重新连接 Harbor")
		return
	}
	if len(r.URL.RawQuery) > maxQueryBytes {
		writeError(w, http.StatusBadRequest, "查询参数过长", "请缩短筛选条件后重试")
		return
	}
	kind := r.PathValue("kind")
	spec, ok := resourceSpecs[kind]
	if !ok {
		writeError(w, http.StatusNotFound, "未知资源", "该资源不在 Harbor 代理允许列表中")
		return
	}
	if current.Demo {
		payload, ok := demoResource(kind, r.URL.Query())
		if !ok {
			writeError(w, http.StatusNotFound, "没有演示数据", "该资源尚无演示数据")
			return
		}
		writeJSON(w, http.StatusOK, payload)
		return
	}

	path := spec.path
	for _, key := range spec.requiredQuery {
		value := strings.TrimSpace(r.URL.Query().Get(key))
		if value == "" {
			writeError(w, http.StatusBadRequest, "缺少查询参数", key+" 是必填参数")
			return
		}
		if key == "repository" {
			value = strings.TrimPrefix(value, strings.TrimSpace(r.URL.Query().Get("project"))+"/")
			value = url.PathEscape(url.PathEscape(value))
		} else {
			value = url.PathEscape(value)
		}
		path = strings.ReplaceAll(path, "{"+key+"}", value)
	}
	query := url.Values{}
	for _, key := range spec.allowedQuery {
		if values, exists := r.URL.Query()[key]; exists {
			for _, value := range values {
				query.Add(key, value)
			}
		}
	}
	if query.Get("page") == "" && slicesContain(spec.allowedQuery, "page") {
		query.Set("page", "1")
	}
	if query.Get("page_size") == "" && slicesContain(spec.allowedQuery, "page_size") {
		query.Set("page_size", "50")
	}
	var payload any
	if err := a.harborJSON(r.Context(), current, http.MethodGet, path, query, &payload); err != nil {
		writeUpstreamError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, payload)
}

func (a *app) handleSearch(w http.ResponseWriter, r *http.Request) {
	current, ok := a.currentSession(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "会话已失效", "请重新连接 Harbor")
		return
	}
	term := strings.TrimSpace(r.URL.Query().Get("q"))
	if len(term) < 2 {
		writeError(w, http.StatusBadRequest, "搜索词太短", "至少输入两个字符")
		return
	}
	if len(term) > 200 {
		writeError(w, http.StatusBadRequest, "搜索词太长", "搜索词不能超过 200 个字符")
		return
	}
	if current.Demo {
		writeJSON(w, http.StatusOK, demoSearch(term))
		return
	}
	var payload any
	if err := a.harborJSON(r.Context(), current, http.MethodGet, "/api/v2.0/search", url.Values{"q": {term}}, &payload); err != nil {
		writeUpstreamError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, payload)
}

func (a *app) harborJSON(ctx context.Context, current *session, method, path string, query url.Values, out any) error {
	response, err := a.harborRequest(ctx, current, method, path, query, nil, nil)
	if err != nil {
		return err
	}
	if len(response.Body) == 0 || out == nil {
		return nil
	}
	if err := json.Unmarshal(response.Body, out); err != nil {
		return fmt.Errorf("Harbor returned invalid JSON: %w", err)
	}
	return nil
}

type harborResponse struct {
	StatusCode int
	Header     http.Header
	Body       []byte
}

func (a *app) harborRequest(ctx context.Context, current *session, method, path string, query url.Values, body []byte, headers http.Header) (*harborResponse, error) {
	endpoint := current.InstanceURL + path
	if encoded := query.Encode(); encoded != "" {
		endpoint += "?" + encoded
	}
	var requestBody io.Reader
	if body != nil {
		requestBody = strings.NewReader(string(body))
	}
	req, err := http.NewRequestWithContext(ctx, method, endpoint, requestBody)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "Harbor-Console/1.0")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	for key, values := range headers {
		for _, value := range values {
			req.Header.Add(key, value)
		}
	}
	if current.Username != "" || current.Password != "" {
		req.SetBasicAuth(current.Username, current.Password)
	}

	client := current.Client
	if client == nil {
		client = a.newClient(current.SkipTLSVerify)
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()
	responseBody, err := io.ReadAll(io.LimitReader(resp.Body, maxReplyBytes+1))
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}
	if len(responseBody) > maxReplyBytes {
		return nil, errors.New("Harbor response exceeds the configured limit")
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		message := strings.TrimSpace(http.StatusText(resp.StatusCode))
		var harborErr struct {
			Errors []struct {
				Message string `json:"message"`
			} `json:"errors"`
		}
		if json.Unmarshal(responseBody, &harborErr) == nil && len(harborErr.Errors) > 0 && harborErr.Errors[0].Message != "" {
			message = harborErr.Errors[0].Message
		}
		return nil, &upstreamError{StatusCode: resp.StatusCode, Message: message}
	}
	return &harborResponse{StatusCode: resp.StatusCode, Header: resp.Header.Clone(), Body: responseBody}, nil
}

func newHarborClient(skipTLSVerify bool) *http.Client {
	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.TLSClientConfig = &tls.Config{MinVersion: tls.VersionTLS12, InsecureSkipVerify: skipTLSVerify} //nolint:gosec -- explicitly selected per Harbor connection
	return &http.Client{
		Timeout:   18 * time.Second,
		Transport: transport,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 3 {
				return errors.New("too many redirects")
			}
			if req.URL.Host != via[0].URL.Host || req.URL.Scheme != via[0].URL.Scheme {
				return errors.New("cross-origin redirect refused")
			}
			return nil
		},
	}
}

func (a *app) currentSession(r *http.Request) (*session, bool) {
	sessionID, ok := sessionIDFromRequest(r)
	if !ok {
		return nil, false
	}
	return a.sessions.get(sessionID)
}

func sessionIDFromRequest(r *http.Request) (string, bool) {
	cookie, err := r.Cookie(sessionCookie)
	if err != nil || cookie.Value == "" {
		return "", false
	}
	return cookie.Value, true
}

func (a *app) setSessionCookie(w http.ResponseWriter, r *http.Request, id string) {
	http.SetCookie(w, &http.Cookie{
		Name: sessionCookie, Value: id, Path: "/", HttpOnly: true,
		SameSite: http.SameSiteStrictMode, Secure: requestIsTLS(r), MaxAge: int(sessionTTL.Seconds()),
	})
}

func sessionInfo(current *session) map[string]any {
	return map[string]any{
		"connection_id":  current.ActiveInstance,
		"instance_url":   current.InstanceURL,
		"username":       current.Username,
		"demo":           current.Demo,
		"instance_count": len(current.Instances),
		"expires_at":     current.ExpiresAt.UTC().Format(time.RFC3339),
	}
}

func instancesInfo(current *session) map[string]any {
	items := make([]*harborConnection, 0, len(current.Instances))
	for _, connection := range current.Instances {
		items = append(items, connection)
	}
	sort.SliceStable(items, func(left, right int) bool {
		return items[left].AddedAt.Before(items[right].AddedAt)
	})
	payload := make([]map[string]any, 0, len(items))
	for _, connection := range items {
		payload = append(payload, map[string]any{
			"connection_id": connection.ID,
			"instance_url":  connection.InstanceURL,
			"username":      connection.Username,
			"demo":          connection.Demo,
			"active":        connection.ID == current.ActiveInstance,
			"added_at":      connection.AddedAt.UTC().Format(time.RFC3339),
		})
	}
	return map[string]any{"active_id": current.ActiveInstance, "items": payload, "expires_at": current.ExpiresAt.UTC().Format(time.RFC3339)}
}

func validateHarborURL(raw string) (string, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", errors.New("请输入 Harbor 实例地址")
	}
	parsed, err := url.Parse(raw)
	if err != nil || parsed.Host == "" {
		return "", errors.New("地址必须是完整的 http:// 或 https:// URL")
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return "", errors.New("仅支持 http 和 https 协议")
	}
	if parsed.User != nil {
		return "", errors.New("请在独立字段中输入用户名和密码")
	}
	if parsed.RawQuery != "" || parsed.Fragment != "" {
		return "", errors.New("地址不能包含查询参数或片段")
	}
	parsed.Path = strings.TrimRight(parsed.Path, "/")
	return parsed.String(), nil
}

func randomID() (string, error) {
	buffer := make([]byte, 32)
	if _, err := rand.Read(buffer); err != nil {
		return "", err
	}
	return hex.EncodeToString(buffer), nil
}

func decodeJSON(w http.ResponseWriter, r *http.Request, out any) error {
	r.Body = http.MaxBytesReader(w, r.Body, maxBodyBytes)
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(out); err != nil {
		return err
	}
	if decoder.Decode(&struct{}{}) != io.EOF {
		return errors.New("请求只能包含一个 JSON 对象")
	}
	return nil
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if status != http.StatusNoContent {
		_ = json.NewEncoder(w).Encode(payload)
	}
}

func writeError(w http.ResponseWriter, status int, message, details string) {
	writeJSON(w, status, apiError{Error: message, Details: details})
}

func writeUpstreamError(w http.ResponseWriter, err error) {
	status := http.StatusBadGateway
	var upstream *upstreamError
	if errors.As(err, &upstream) {
		switch upstream.StatusCode {
		case http.StatusBadRequest, http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound,
			http.StatusMethodNotAllowed, http.StatusConflict, http.StatusPreconditionFailed,
			http.StatusUnprocessableEntity, http.StatusTooManyRequests:
			status = upstream.StatusCode
		}
	}
	writeError(w, status, "Harbor 请求失败", friendlyUpstreamError(err))
}

func friendlyUpstreamError(err error) string {
	var upstream *upstreamError
	if errors.As(err, &upstream) {
		switch upstream.StatusCode {
		case http.StatusUnauthorized:
			return "用户名或密码无效"
		case http.StatusForbidden:
			return "当前 Harbor 账号没有访问该资源的权限"
		case http.StatusNotFound:
			return "Harbor 未找到请求的资源"
		case http.StatusBadRequest:
			return "请求不符合 Harbor API 要求：" + upstream.Message
		case http.StatusMethodNotAllowed:
			return "当前 Harbor 版本或资源状态不允许该操作"
		case http.StatusConflict:
			return "资源已存在或当前状态发生冲突：" + upstream.Message
		case http.StatusPreconditionFailed:
			return "资源当前不可删除或前置条件未满足：" + upstream.Message
		case http.StatusUnprocessableEntity:
			return "Harbor 无法处理该操作：" + upstream.Message
		case http.StatusTooManyRequests:
			return "Harbor 请求过于频繁，请稍后重试"
		default:
			return "Harbor 返回 " + strconv.Itoa(upstream.StatusCode) + ": " + upstream.Message
		}
	}
	message := err.Error()
	switch {
	case strings.Contains(message, "invalid JSON"):
		return "Harbor 返回的数据格式无效"
	case strings.Contains(message, "too many redirects"):
		return "Harbor 地址发生了过多重定向"
	case strings.Contains(message, "cross-origin redirect refused"):
		return "Harbor 将请求重定向到其他域名或协议，已为保护凭据而拒绝"
	case strings.Contains(message, "certificate"):
		return "Harbor 证书验证失败；请检查证书，或仅在可信内网启用自签名证书选项"
	case strings.Contains(message, "request failed"):
		return "无法访问 Harbor 实例，请检查地址、网络和端口"
	case strings.Contains(message, "read response"):
		return "读取 Harbor 响应失败，请稍后重试"
	default:
		return "Harbor 连接出现未知错误，请检查实例状态后重试"
	}
}

func sameOrigin(r *http.Request) bool {
	origin := r.Header.Get("Origin")
	if origin == "" {
		return true
	}
	parsed, err := url.Parse(origin)
	if err != nil {
		return false
	}
	expectedScheme := "http"
	if requestIsTLS(r) {
		expectedScheme = "https"
	}
	return strings.EqualFold(parsed.Scheme, expectedScheme) && strings.EqualFold(parsed.Host, r.Host)
}

func clientIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err == nil && host != "" {
		return host
	}
	if r.RemoteAddr != "" {
		return r.RemoteAddr
	}
	return "unknown"
}

func requestIsTLS(r *http.Request) bool {
	return r.TLS != nil || strings.EqualFold(r.Header.Get("X-Forwarded-Proto"), "https")
}

func slicesContain(values []string, target string) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}
	return false
}

func main() {
	config, err := loadRuntimeConfigFromEnvironment()
	if err != nil {
		slog.Error("configuration_load_failed", "error", err)
		os.Exit(1)
	}
	logger, err := newStructuredLogger(os.Stdout, config.Logging)
	if err != nil {
		slog.Error("logger_initialization_failed", "error", err)
		os.Exit(1)
	}
	slog.SetDefault(logger)
	application, err := newAppWithConfig(config, logger)
	if err != nil {
		logger.Error("application_initialization_failed", "error", err)
		os.Exit(1)
	}
	address := config.address()
	server := &http.Server{
		Addr:              address,
		Handler:           application.routes(),
		ReadHeaderTimeout: time.Duration(config.Server.ReadHeaderTimeout),
		ReadTimeout:       time.Duration(config.Server.ReadTimeout),
		WriteTimeout:      time.Duration(config.Server.WriteTimeout),
		IdleTimeout:       time.Duration(config.Server.IdleTimeout),
		MaxHeaderBytes:    64 << 10,
		ErrorLog:          slog.NewLogLogger(logger.Handler(), slog.LevelError),
	}
	shutdownContext, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	go func() {
		<-shutdownContext.Done()
		shutdown, cancel := context.WithTimeout(context.Background(), time.Duration(config.Server.ShutdownTimeout))
		defer cancel()
		if err := server.Shutdown(shutdown); err != nil {
			logger.Error("server_shutdown_failed", "error", err)
		}
	}()
	logger.Info("server_started", "address", address, "health_uri", config.Health.URI, "log_format", config.Logging.Format, "log_level", config.Logging.Level)
	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		logger.Error("server_stopped_unexpectedly", "error", err)
		os.Exit(1)
	}
	logger.Info("server_stopped")
}
