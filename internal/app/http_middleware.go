package app

import (
	"context"
	"net/http"
	"strings"
	"time"
)

func upstreamRequestBudget(next http.Handler, budget time.Duration) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasPrefix(r.URL.Path, "/api/") {
			next.ServeHTTP(w, r)
			return
		}
		// All upstream stages share one deadline, including preflight checks,
		// pagination and write confirmation. Parent cancellation stays intact.
		ctx, cancel := context.WithTimeout(r.Context(), budget)
		defer cancel()
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func securityHeaders(next http.Handler, healthPaths ...string) http.Handler {
	healthSet := make(map[string]struct{}, len(healthPaths))
	for _, healthPath := range healthPaths {
		healthSet[healthPath] = struct{}{}
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Referrer-Policy", "same-origin")
		w.Header().Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
		w.Header().Set("Content-Security-Policy", "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; font-src 'self'")
		_, healthRequest := healthSet[r.URL.Path]
		if strings.HasPrefix(r.URL.Path, "/api/") || healthRequest {
			w.Header().Set("Cache-Control", "no-store")
		}
		if requestIsTLS(r) {
			w.Header().Set("Strict-Transport-Security", "max-age=31536000")
		}
		next.ServeHTTP(w, r)
	})
}
