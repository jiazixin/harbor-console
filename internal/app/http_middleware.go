package app

import (
	"net/http"
	"strings"
)

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
