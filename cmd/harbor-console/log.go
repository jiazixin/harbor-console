package main

import (
	"io"
	"log/slog"

	"harbor-console/internal/config"
	"harbor-console/internal/observability"
)

// newLogger builds the service logger on stdout. The close function is a
// no-op because the service does not own a log file.
func newLogger(settings config.Logging, stdout io.Writer) (*slog.Logger, func() error, error) {
	logger, err := observability.NewLogger(stdout, settings)
	if err != nil {
		return nil, nil, err
	}
	return logger, func() error { return nil }, nil
}
