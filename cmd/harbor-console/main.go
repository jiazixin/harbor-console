package main

import (
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

func main() {
	os.Exit(run(os.Args[1:], os.Stdout, os.Stderr))
}

func run(args []string, stdout, stderr io.Writer) int {
	options, err := parseArgs(args)
	if err != nil {
		fmt.Fprintf(stderr, "harbor-console: %v\n使用 --help 查看帮助。\n", err)
		return 2
	}
	if options.Help {
		fmt.Fprint(stdout, usageText)
		return 0
	}
	if options.Version {
		fmt.Fprintf(stdout, "harbor-console %s (commit: %s, built: %s)\n", buildinfo.Version, buildinfo.Commit, buildinfo.BuildDate)
		return 0
	}
	var runtimeConfig config.Config
	if options.ConfigPath != "" {
		runtimeConfig, err = config.LoadFile(options.ConfigPath)
	} else {
		runtimeConfig, err = config.Load()
	}
	if err != nil {
		fmt.Fprintf(stderr, "harbor-console: load configuration: %v\n", err)
		return 1
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	if err := app.Run(ctx, stdout, runtimeConfig); err != nil {
		fmt.Fprintf(stderr, "harbor-console: %v\n", err)
		return 1
	}
	return 0
}
