// Command harbor-console serves the Harbor administration console.
package main

import (
	"context"
	"fmt"
	"io"
	"os"
	"os/signal"
	"syscall"

	"harbor-console/internal/app"
	"harbor-console/internal/config"
)

const (
	exitOK      = 0
	exitFailure = 1
	exitUsage   = 2
)

func main() {
	os.Exit(run(os.Args[1:], os.Stdout, os.Stderr))
}

// run reports usage and startup errors as plain text on stderr; once the
// logger is ready, failures are logged.
func run(args []string, stdout, stderr io.Writer) int {
	o, err := parseArgs(args)
	if err != nil {
		fmt.Fprintf(stderr, "harbor-console: %v\nRun 'harbor-console --help' for usage.\n", err)
		return exitUsage
	}
	build := currentBuild()
	switch {
	case o.help:
		fmt.Fprint(stdout, usage)
		return exitOK
	case o.version:
		fmt.Fprintln(stdout, "harbor-console", build)
		return exitOK
	}
	path, explicit, err := o.configPath(os.LookupEnv)
	if err != nil {
		fmt.Fprintf(stderr, "harbor-console: config: %v\n", err)
		return exitFailure
	}
	workDir, err := os.Getwd()
	if err != nil {
		fmt.Fprintf(stderr, "harbor-console: config: %v\n", err)
		return exitFailure
	}
	cfg, err := config.Load(config.Source{Path: path, Explicit: explicit, WorkDir: workDir, LookupEnv: os.LookupEnv})
	if err != nil {
		fmt.Fprintf(stderr, "harbor-console: config: %v\n", err)
		return exitFailure
	}
	logger, closeLog, err := newLogger(cfg.Logging, stdout)
	if err != nil {
		fmt.Fprintf(stderr, "harbor-console: log: %v\n", err)
		return exitFailure
	}
	defer func() {
		if err := closeLog(); err != nil {
			fmt.Fprintf(stderr, "harbor-console: log: %v\n", err)
		}
	}()
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	context.AfterFunc(ctx, stop) // a second signal terminates the process
	// version and revision stay separate fields so release checks can match them exactly.
	logger.Info("service_starting", "version", build.Version, "revision", build.Revision, "build_time", build.Time, "modified", build.Modified)
	err = app.Run(ctx, cfg, logger, app.Build{
		Version:  build.Version,
		Revision: build.Revision,
		Time:     build.Time,
		Modified: build.Modified,
	})
	if err != nil {
		logger.Error("service_failed", "error", err)
		return exitFailure
	}
	logger.Info("service_stopped")
	return exitOK
}
