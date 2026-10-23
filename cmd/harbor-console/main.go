// Command harbor-console serves the Harbor administration console.
package main

import (
	"cmp"
	"context"
	"fmt"
	"io"
	"os"
	"os/signal"
	"syscall"

	"harbor-console/internal/app"
	"harbor-console/internal/buildinfo"
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
// configuration loads, the service logs through its configured logger.
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
	buildinfo.Version = build.Version
	buildinfo.Commit = cmp.Or(build.Revision, "unknown")
	buildinfo.BuildDate = cmp.Or(build.Time, "unknown")

	var c config.Config
	if o.configFile != "" {
		c, err = config.LoadFile(o.configFile)
	} else {
		c, err = config.Load()
	}
	if err != nil {
		fmt.Fprintf(stderr, "harbor-console: config: %v\n", err)
		return exitFailure
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	if err := app.Run(ctx, stdout, c); err != nil {
		fmt.Fprintf(stderr, "harbor-console: %v\n", err)
		return exitFailure
	}
	return exitOK
}
