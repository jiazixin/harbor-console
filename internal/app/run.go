package app

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"sync"
	"time"

	"harbor-console/internal/config"
)

// Build describes the running binary; cmd/harbor-console passes it from its
// embedded build information.
type Build struct {
	Version  string // release, module version, short revision or "dev"
	Revision string // short VCS revision; empty when unknown
	Time     string // VCS commit time in RFC 3339; empty when unknown
	Modified bool   // built from a working tree with uncommitted changes
}

// Run listens on the configured address and serves until ctx ends, then shuts
// the server down within the configured timeout.
func Run(ctx context.Context, runtimeConfig config.Config, logger *slog.Logger, build Build) error {
	application, err := newAppWithConfig(runtimeConfig, logger, build)
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
	logger.Info("service_listening", "listen", address, "log_format", runtimeConfig.Logging.Format, "log_level", runtimeConfig.Logging.Level)
	// Cancelling the returned stop keeps the event out of logs when Run
	// returns for another reason and the caller cancels ctx afterwards.
	stopLogging := context.AfterFunc(ctx, func() { logger.Info("service_stopping") })
	defer stopLogging()
	return serveHTTP(ctx, server, listener, time.Duration(runtimeConfig.Server.ShutdownTimeout))
}

func serveHTTP(ctx context.Context, server *http.Server, listener net.Listener, shutdownTimeout time.Duration) error {
	served := make(chan struct{})
	shutdownDone := make(chan error, 1)
	var workers sync.WaitGroup
	workers.Go(func() {
		select {
		case <-ctx.Done():
			shutdown, cancel := context.WithTimeout(context.WithoutCancel(ctx), shutdownTimeout)
			defer cancel()
			err := server.Shutdown(shutdown)
			if err != nil {
				err = errors.Join(err, server.Close())
			}
			shutdownDone <- err
		case <-served:
			shutdownDone <- nil
		}
	})
	serveErr := server.Serve(listener)
	close(served)
	// Serve returns when the listener closes; Shutdown can still be waiting for
	// active handlers. Keep the process alive until they finish or are closed.
	shutdownErr := <-shutdownDone
	workers.Wait()
	if serveErr != nil && !errors.Is(serveErr, http.ErrServerClosed) {
		return fmt.Errorf("serve HTTP: %w", errors.Join(serveErr, shutdownErr))
	}
	if shutdownErr != nil {
		return fmt.Errorf("shutdown HTTP: %w", shutdownErr)
	}
	return nil
}
