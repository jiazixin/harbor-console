package app

import (
	"context"
	"crypto/rand"
	"fmt"
	"log/slog"
	"net/http"
	"regexp"
	"strings"
	"time"
)

func upstreamRequestBudget(budget time.Duration) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if !strings.HasPrefix(r.URL.Path, "/api/") {
				next.ServeHTTP(w, r)
				return
			}
			// All upstream stages share one deadline, including preflight checks,
			// pagination and write confirmation. Parent cancellation stays intact.
			ctx, cancel := context.WithTimeout(r.Context(), budget)
			defer cancel()
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// crossOriginGuard rejects cross-site writes from browsers (代码规范.md §5.4):
// Sec-Fetch-Site or Origin must name this origin. Requests that carry
// neither header, such as command-line clients, pass.
func crossOriginGuard(next http.Handler) http.Handler {
	protection := http.NewCrossOriginProtection()
	protection.SetDenyHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		writeError(w, r, errOriginRejected)
	}))
	return protection.Handler(next)
}

func securityHeaders(healthPaths ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		healthSet := make(map[string]struct{}, len(healthPaths))
		for _, healthPath := range healthPaths {
			healthSet[healthPath] = struct{}{}
		}
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("X-Content-Type-Options", "nosniff")
			w.Header().Set("X-Frame-Options", "DENY")
			w.Header().Set("Referrer-Policy", "same-origin")
			w.Header().Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
			w.Header().Set("Content-Security-Policy", "default-src 'self'; base-uri 'none'; object-src 'none'; form-action 'self'; frame-ancestors 'none'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; font-src 'self'")
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
}

var requestIDPattern = regexp.MustCompile(`^[A-Za-z0-9-]{1,64}$`)

type loggerKey struct{}

// requestContext is the outermost middleware: it accepts or assigns the
// request ID, puts a logger carrying it into the request context and recovers
// handler panics.
func requestContext(logger *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			requestID := r.Header.Get("X-Request-ID")
			if !requestIDPattern.MatchString(requestID) {
				requestID = rand.Text()
			}
			w.Header().Set("X-Request-ID", requestID)
			requestLog := logger.With("request_id", requestID)
			r = r.WithContext(context.WithValue(r.Context(), loggerKey{}, requestLog))
			tracked := &startedWriter{ResponseWriter: w, logger: requestLog}
			defer func() {
				recovered := recover()
				if recovered == nil {
					return
				}
				if recovered == http.ErrAbortHandler {
					panic(recovered)
				}
				requestLog.Error("http_handler_panic", "method", r.Method, "path", r.URL.Path, "error", fmt.Sprint(recovered))
				if !tracked.started {
					writeError(tracked, r, errInternal)
				}
			}()
			next.ServeHTTP(tracked, r)
		})
	}
}

// requestLogger returns the logger carrying the request ID.
func requestLogger(r *http.Request) *slog.Logger {
	if logger, ok := r.Context().Value(loggerKey{}).(*slog.Logger); ok {
		return logger
	}
	return slog.New(slog.DiscardHandler)
}

// startedWriter records whether the response has started.
type startedWriter struct {
	http.ResponseWriter
	started bool
	logger  *slog.Logger
}

func (w *startedWriter) WriteHeader(status int) {
	w.started = true
	w.ResponseWriter.WriteHeader(status)
}

func (w *startedWriter) Write(body []byte) (int, error) {
	w.started = true
	written, err := w.ResponseWriter.Write(body)
	if err != nil && w.logger != nil {
		w.logger.Error("response_write_failed", "error", err)
	}
	return written, err
}

func (w *startedWriter) Unwrap() http.ResponseWriter { return w.ResponseWriter }

// apiErrors replaces the router's plain-text 404 and 405 responses on /api/
// paths with the JSON error body; the page fallback "GET /" would otherwise
// serve the web application for an unknown API path.
func apiErrors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasPrefix(r.URL.Path, "/api/") {
			next.ServeHTTP(w, r)
			return
		}
		next.ServeHTTP(&routerErrorWriter{ResponseWriter: w, request: r}, r)
	})
}

type routerErrorWriter struct {
	http.ResponseWriter
	request     *http.Request
	wroteHeader bool
	replaced    bool
}

func (w *routerErrorWriter) WriteHeader(status int) {
	if w.wroteHeader {
		return
	}
	w.wroteHeader = true
	plainText := strings.HasPrefix(w.Header().Get("Content-Type"), "text/plain")
	if plainText && (status == http.StatusNotFound || status == http.StatusMethodNotAllowed) {
		w.replaced = true
		w.Header().Del("Content-Length")
		if status == http.StatusNotFound {
			writeError(w.ResponseWriter, w.request, errNotFound)
		} else {
			writeError(w.ResponseWriter, w.request, errMethodNotAllowed)
		}
		return
	}
	w.ResponseWriter.WriteHeader(status)
}

func (w *routerErrorWriter) Write(body []byte) (int, error) {
	if !w.wroteHeader {
		w.WriteHeader(http.StatusOK)
	}
	if w.replaced {
		return len(body), nil
	}
	return w.ResponseWriter.Write(body)
}

func (w *routerErrorWriter) Unwrap() http.ResponseWriter { return w.ResponseWriter }

// boundedRequests rejects excess work instead of building an unbounded queue.
func boundedRequests(limit int) func(http.Handler) http.Handler {
	permits := make(chan struct{}, limit)
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			select {
			case permits <- struct{}{}:
				defer func() { <-permits }()
				next.ServeHTTP(w, r)
			default:
				w.Header().Set("Retry-After", "1")
				writeError(w, r, failure(http.StatusServiceUnavailable, "unavailable", "request concurrency limit reached"))
			}
		})
	}
}
