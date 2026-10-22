package app

import (
	"io"
	"log/slog"
	"net/http"
	"time"

	"harbor-console/internal/config"
	"harbor-console/internal/observability"
	"harbor-console/web"
)

type app struct {
	sessions        *sessionStore
	loginLimits     *rateLimiter
	publicLimits    *rateLimiter
	web             http.Handler
	newClient       func(skipTLSVerify bool) *http.Client
	healthURI       string
	startedAt       time.Time
	logger          *slog.Logger
	logging         config.Logging
	upstreamTimeout time.Duration
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

func newAppWithConfig(runtimeConfig config.Config, logger *slog.Logger) (*app, error) {
	if err := runtimeConfig.Validate(); err != nil {
		return nil, err
	}
	if logger == nil {
		logger = slog.New(slog.NewTextHandler(io.Discard, nil))
	}
	webRoot, err := webui.Files()
	if err != nil {
		return nil, err
	}
	writeTimeout := time.Duration(runtimeConfig.Server.WriteTimeout)
	return &app{
		sessions:        newSessionStore(),
		loginLimits:     newRateLimiter(30, time.Minute),
		publicLimits:    newRateLimiter(180, time.Minute),
		web:             staticFiles(webRoot),
		newClient:       newHarborClient,
		healthURI:       runtimeConfig.Health.URI,
		startedAt:       time.Now(),
		logger:          logger,
		logging:         runtimeConfig.Logging,
		upstreamTimeout: min(harborRequestTimeout, writeTimeout-writeTimeout/10),
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
	handler := upstreamRequestBudget(mux, a.upstreamTimeout)
	handler = observability.AccessLog(handler, a.logger, a.logging, a.healthURI)
	return securityHeaders(handler, a.healthURI)
}
