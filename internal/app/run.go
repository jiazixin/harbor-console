package app

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"time"

	"harbor-console/internal/buildinfo"
	"harbor-console/internal/config"
	"harbor-console/internal/observability"
)

func Run(ctx context.Context, output io.Writer, runtimeConfig config.Config) error {
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
	listener, err := net.Listen("tcp", address)
	if err != nil {
		return fmt.Errorf("listen HTTP: %w", err)
	}
	logger.Info("server_started", "address", address, "health_uri", runtimeConfig.Health.URI, "log_format", runtimeConfig.Logging.Format, "log_level", runtimeConfig.Logging.Level, "version", buildinfo.Version, "commit", buildinfo.Commit, "build_date", buildinfo.BuildDate)
	if err := serveHTTP(ctx, server, listener, time.Duration(runtimeConfig.Server.ShutdownTimeout)); err != nil {
		return err
	}
	logger.Info("server_stopped")
	return nil
}

func serveHTTP(ctx context.Context, server *http.Server, listener net.Listener, shutdownTimeout time.Duration) error {
	served := make(chan struct{})
	shutdownDone := make(chan error, 1)
	go func() {
		select {
		case <-ctx.Done():
			shutdown, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
			defer cancel()
			err := server.Shutdown(shutdown)
			if err != nil {
				err = errors.Join(err, server.Close())
			}
			shutdownDone <- err
		case <-served:
			shutdownDone <- nil
		}
	}()
	serveErr := server.Serve(listener)
	close(served)
	// Serve returns when the listener closes; Shutdown can still be waiting for
	// active handlers. Keep the process alive until they finish or are closed.
	shutdownErr := <-shutdownDone
	if serveErr != nil && !errors.Is(serveErr, http.ErrServerClosed) {
		return fmt.Errorf("serve HTTP: %w", errors.Join(serveErr, shutdownErr))
	}
	if shutdownErr != nil {
		return fmt.Errorf("shutdown HTTP: %w", shutdownErr)
	}
	return nil
}
