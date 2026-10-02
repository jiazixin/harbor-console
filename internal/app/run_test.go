package app

import (
	"context"
	"errors"
	"io"
	"net"
	"net/http"
	"sync"
	"testing"
	"time"
)

func TestServeHTTPWaitsForActiveRequest(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	started := make(chan struct{})
	finish := make(chan struct{})
	var finishOnce sync.Once
	releaseRequest := func() { finishOnce.Do(func() { close(finish) }) }
	t.Cleanup(releaseRequest)
	shutdownStarted := make(chan struct{})
	server := &http.Server{Handler: http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		close(started)
		<-finish
		_, _ = io.WriteString(w, "completed")
	})}
	server.RegisterOnShutdown(func() { close(shutdownStarted) })
	t.Cleanup(func() { _ = server.Close() })
	ctx, cancel := context.WithCancel(t.Context())
	defer cancel()
	served := make(chan error, 1)
	go func() { served <- serveHTTP(ctx, server, listener, time.Second) }()
	responseDone := make(chan error, 1)
	go func() {
		response, err := http.Get("http://" + listener.Addr().String())
		if err == nil {
			defer response.Body.Close()
			var content []byte
			content, err = io.ReadAll(response.Body)
			if err == nil && string(content) != "completed" {
				err = errors.New("request did not finish with its complete response")
			}
		}
		responseDone <- err
	}()
	<-started
	cancel()
	<-shutdownStarted
	select {
	case err := <-served:
		t.Fatalf("server returned while a request was still active: %v", err)
	case <-time.After(50 * time.Millisecond):
	}
	releaseRequest()
	if err := <-responseDone; err != nil {
		t.Fatalf("active request failed during graceful shutdown: %v", err)
	}
	if err := <-served; err != nil {
		t.Fatalf("graceful shutdown failed: %v", err)
	}
}

func TestServeHTTPClosesRequestsAfterShutdownDeadline(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	started := make(chan struct{})
	handlerDone := make(chan struct{})
	server := &http.Server{Handler: http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
		close(started)
		<-r.Context().Done()
		close(handlerDone)
	})}
	t.Cleanup(func() { _ = server.Close() })
	ctx, cancel := context.WithCancel(t.Context())
	defer cancel()
	served := make(chan error, 1)
	go func() { served <- serveHTTP(ctx, server, listener, 20*time.Millisecond) }()
	responseDone := make(chan error, 1)
	go func() {
		response, err := http.Get("http://" + listener.Addr().String())
		if response != nil {
			_ = response.Body.Close()
		}
		responseDone <- err
	}()
	<-started
	cancel()
	if err := <-served; !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("shutdown error = %v, want deadline exceeded", err)
	}
	select {
	case <-handlerDone:
	case <-time.After(time.Second):
		t.Fatal("timed out request was not canceled")
	}
	if err := <-responseDone; err == nil {
		t.Fatal("timed out request remained connected")
	}
}
