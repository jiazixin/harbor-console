package app

import (
	"crypto/rand"
	"io"
	"log/slog"
	"net/http"
	"time"

	"harbor-console/internal/config"
	"harbor-console/internal/observability"
	"harbor-console/web"
)

const maxConcurrentRequests = 64

type app struct {
	creationSecret  creationSecret
	sessions        *sessionStore
	idempotency     *idempotencyCache
	loginLimits     *rateLimiter
	publicLimits    *rateLimiter
	web             http.Handler
	newClient       func(skipTLSVerify bool) *http.Client
	startedAt       time.Time
	logger          *slog.Logger
	logging         config.Logging
	upstreamTimeout time.Duration
	build           Build
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
	Offset        int    `json:"offset"`
	Limit         int    `json:"limit"`
	Query         string `json:"query"`
}

type upstreamError struct {
	StatusCode int
	Message    string
}

func (e *upstreamError) Error() string {
	return e.Message
}

func newAppWithConfig(runtimeConfig config.Config, logger *slog.Logger, build Build) (*app, error) {
	if err := runtimeConfig.Validate(); err != nil {
		return nil, err
	}
	if logger == nil {
		logger = slog.New(slog.NewTextHandler(io.Discard, nil))
	}
	webRoot, err := web.Files()
	if err != nil {
		return nil, err
	}
	writeTimeout := time.Duration(runtimeConfig.Server.WriteTimeout)
	return &app{
		creationSecret:  creationSecret(rand.Text()),
		sessions:        newSessionStore(),
		idempotency:     newIdempotencyCache(),
		loginLimits:     newRateLimiter(30, time.Minute),
		publicLimits:    newRateLimiter(180, time.Minute),
		web:             staticFiles(webRoot),
		newClient:       newHarborClient,
		startedAt:       time.Now(),
		logger:          logger,
		logging:         runtimeConfig.Logging,
		upstreamTimeout: min(harborRequestTimeout, writeTimeout-writeTimeout/10),
		build:           build,
	}, nil
}

func (a *app) routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET "+healthPath, a.handleHealth)
	mux.HandleFunc("GET /api/info", a.handleInfo)
	mux.HandleFunc("POST /api/public/projects", a.handlePublicProjects)
	mux.HandleFunc("POST /api/public/repositories", a.handlePublicRepositories)
	mux.HandleFunc("POST /api/public/artifacts", a.handlePublicArtifacts)
	mux.HandleFunc("POST /api/sessions", a.idempotent(a.handleConnect))
	mux.HandleFunc("POST /api/demo-sessions", a.idempotent(a.handleDemo))
	mux.HandleFunc("GET /api/sessions/current", a.handleSession)
	mux.HandleFunc("DELETE /api/sessions/current", a.handleLogout)
	mux.HandleFunc("GET /api/instances", a.handleInstances)
	mux.HandleFunc("POST /api/instances", a.idempotent(a.handleAddInstance))
	mux.HandleFunc("POST /api/instances/demo", a.idempotent(a.handleAddDemoInstance))
	mux.HandleFunc("PUT /api/instances/current", a.handleSwitchInstance)
	mux.HandleFunc("DELETE /api/instances/{id}", a.handleDeleteInstance)
	mux.HandleFunc("GET /api/dashboards/current", a.handleDashboard)
	mux.HandleFunc("GET /api/resources/{kind}", a.handleResource)
	// Each allowed Harbor operation and method is its own route, so the router
	// answers unknown operations with 404 and other methods with 405.
	for operation, spec := range controlSpecs {
		for method := range spec.methods {
			handler := a.handleControl
			if method == http.MethodPost {
				handler = a.idempotent(handler)
			}
			mux.HandleFunc(method+" /api/operations/"+operation, handler)
		}
	}
	mux.HandleFunc("GET /api/search-results", a.handleSearch)
	mux.Handle("GET /", a.web)
	handler := upstreamRequestBudget(a.upstreamTimeout)(crossOriginGuard(mux))
	handler = boundedRequests(maxConcurrentRequests)(apiErrors(handler))
	handler = observability.AccessLog(observability.AccessLogOptions{Logger: a.logger, Settings: a.logging, HealthPaths: []string{healthPath}})(handler)
	return requestContext(a.logger)(securityHeaders(healthPath)(handler))
}
