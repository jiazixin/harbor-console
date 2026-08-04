package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"

	"harbor-console/internal/app"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	if err := app.Run(ctx, os.Stdout); err != nil {
		log.Printf("harbor-console: %v", err)
		os.Exit(1)
	}
}
