package observability

import (
	"io"
	"log/slog"
	"net"
	"net/http"
	"strings"
	"time"

	"harbor-console/internal/config"
)

// NewLogger returns a JSON or logfmt logger writing to output at the configured
// level.
func NewLogger(output io.Writer, settings config.Logging) (*slog.Logger, error) {
	level, err := parseLogLevel(settings.Level)
	if err != nil {
		return nil, err
	}
	options := &slog.HandlerOptions{Level: level}
	switch settings.Format {
	case "json":
		return slog.New(slog.NewJSONHandler(output, options)), nil
	case "logfmt":
		return slog.New(slog.NewTextHandler(output, options)), nil
	default:
		return nil, &configurationError{Field: "logging.format", Message: "must be json or logfmt"}
	}
}

func parseLogLevel(value string) (slog.Level, error) {
	switch value {
	case "debug":
		return slog.LevelDebug, nil
	case "info":
		return slog.LevelInfo, nil
	case "warn":
		return slog.LevelWarn, nil
	case "error":
		return slog.LevelError, nil
	default:
		return 0, &configurationError{Field: "logging.level", Message: "must be debug, info, warn or error"}
	}
}

type configurationError struct {
	Field   string
	Message string
}

func (e *configurationError) Error() string {
	return e.Field + ": " + e.Message
}

type responseMetricsWriter struct {
	http.ResponseWriter
	status int
	bytes  int
}

func (w *responseMetricsWriter) WriteHeader(status int) {
	if w.status != 0 {
		return
	}
	w.status = status
	w.ResponseWriter.WriteHeader(status)
}

func (w *responseMetricsWriter) Write(content []byte) (int, error) {
	if w.status == 0 {
		w.WriteHeader(http.StatusOK)
	}
	written, err := w.ResponseWriter.Write(content)
	w.bytes += written
	return written, err
}

func (w *responseMetricsWriter) Unwrap() http.ResponseWriter {
	return w.ResponseWriter
}

// AccessLog wraps next to log each request at a level chosen by its status. It
// returns next unchanged when access logging is disabled, and skips requests to
// healthPaths unless health check logging is enabled.
func AccessLog(options AccessLogOptions) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		logger, settings, healthPaths := options.Logger, options.Settings, options.HealthPaths
		if !settings.AccessLog || logger == nil {
			return next
		}
		healthSet := make(map[string]struct{}, len(healthPaths))
		for _, healthPath := range healthPaths {
			healthSet[healthPath] = struct{}{}
		}
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			started := time.Now()
			metrics := &responseMetricsWriter{ResponseWriter: w}
			next.ServeHTTP(metrics, r)
			if metrics.status == 0 {
				metrics.status = http.StatusOK
			}
			if !settings.LogHealthChecks {
				if _, healthRequest := healthSet[r.URL.Path]; healthRequest {
					return
				}
			}
			attributes := []any{
				"method", r.Method,
				"path", r.URL.Path,
				"status", metrics.status,
				"duration_ms", float64(time.Since(started).Microseconds()) / 1000,
				"bytes", metrics.bytes,
				"remote_addr", clientIP(r),
			}
			switch {
			case metrics.status >= http.StatusInternalServerError:
				logger.Error("http_request", attributes...)
			case metrics.status >= http.StatusBadRequest:
				logger.Warn("http_request", attributes...)
			default:
				logger.Info("http_request", attributes...)
			}
		})
	}
}

func clientIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err == nil && host != "" {
		return host
	}
	if strings.TrimSpace(r.RemoteAddr) != "" {
		return r.RemoteAddr
	}
	return "unknown"
}

// AccessLogOptions selects the logger, access-log policy and health paths.
type AccessLogOptions struct {
	Logger      *slog.Logger
	Settings    config.Logging
	HealthPaths []string
}
