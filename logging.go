package main

import (
	"io"
	"log/slog"
	"net/http"
	"time"
)

func newStructuredLogger(output io.Writer, config loggingConfig) (*slog.Logger, error) {
	level, err := parseLogLevel(config.Level)
	if err != nil {
		return nil, err
	}
	options := &slog.HandlerOptions{Level: level}
	switch config.Format {
	case "json":
		return slog.New(slog.NewJSONHandler(output, options)), nil
	case "logfmt":
		return slog.New(slog.NewTextHandler(output, options)), nil
	default:
		return nil, &configurationError{Field: "logging.format", Message: "必须是 json 或 logfmt"}
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
		return 0, &configurationError{Field: "logging.level", Message: "必须是 debug、info、warn 或 error"}
	}
}

type configurationError struct {
	Field   string
	Message string
}

func (e *configurationError) Error() string {
	return e.Field + " " + e.Message
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

func accessLogMiddleware(next http.Handler, logger *slog.Logger, config loggingConfig, healthPaths ...string) http.Handler {
	if !config.AccessLog || logger == nil {
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
		if !config.LogHealthChecks {
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
