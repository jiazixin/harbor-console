package app

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"time"

	"harbor-console/internal/buildinfo"
	"harbor-console/internal/config"
	"harbor-console/internal/observability"
)

func Run(ctx context.Context, output io.Writer) error {
	runtimeConfig, err := config.Load()
	if err != nil {
		return fmt.Errorf("load configuration: %w", err)
	}
	logger, err := observability.NewLogger(output, runtimeConfig.Logging)
	if err != nil {
		return fmt.Errorf("initialize logger: %w", err)
	}
	slog.SetDefault(logger)
	application, err := newAppWithConfig(runtimeConfig, logger)
	if err != nil {
		return fmt.Errorf("initialize application: %w", err)
	}
	address := runtimeConfig.Address()
	server := &http.Server{
		Addr:              address,
		Handler:           application.routes(),
		ReadHeaderTimeout: time.Duration(runtimeConfig.Server.ReadHeaderTimeout),
		ReadTimeout:       time.Duration(runtimeConfig.Server.ReadTimeout),
		WriteTimeout:      time.Duration(runtimeConfig.Server.WriteTimeout),
		IdleTimeout:       time.Duration(runtimeConfig.Server.IdleTimeout),
		MaxHeaderBytes:    64 << 10,
		ErrorLog:          slog.NewLogLogger(logger.Handler(), slog.LevelError),
	}
	go func() {
		<-ctx.Done()
		shutdown, cancel := context.WithTimeout(context.Background(), time.Duration(runtimeConfig.Server.ShutdownTimeout))
		defer cancel()
		if err := server.Shutdown(shutdown); err != nil {
			logger.Error("server_shutdown_failed", "error", err)
		}
	}()
	logger.Info("server_started", "address", address, "health_uri", runtimeConfig.Health.URI, "log_format", runtimeConfig.Logging.Format, "log_level", runtimeConfig.Logging.Level, "version", buildinfo.Version, "commit", buildinfo.Commit, "build_date", buildinfo.BuildDate)
	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return fmt.Errorf("serve HTTP: %w", err)
	}
	logger.Info("server_stopped")
	return nil
}
