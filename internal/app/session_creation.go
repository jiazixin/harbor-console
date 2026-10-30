package app

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base32"
	"net/http"
)

const creationCookie = "harbor_console_creation"

type creationTokenKey struct{}

// creationSecret derives replayable cookies without retaining bearer tokens.
type creationSecret []byte

func (s creationSecret) String() string   { return "[redacted]" }
func (s creationSecret) GoString() string { return "[redacted]" }

func (a *app) creationToken(scope, seed string) string {
	digest := hmac.New(sha256.New, a.creationSecret)
	// hash.Hash.Write cannot fail; this is a fixed in-memory primitive.
	_, _ = digest.Write([]byte(scope + "\x00" + seed))
	return base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(digest.Sum(nil))
}

func ensureCreationCookie(w http.ResponseWriter, r *http.Request) {
	if cookie, err := r.Cookie(creationCookie); err == nil && connectionIDPattern.MatchString(cookie.Value) {
		return
	}
	http.SetCookie(w, &http.Cookie{
		Name: creationCookie, Value: rand.Text(), Path: "/", HttpOnly: true,
		SameSite: http.SameSiteStrictMode, Secure: requestIsTLS(r), MaxAge: int(idempotencyWindow.Seconds()),
	})
}

func creationScope(r *http.Request) (string, error) {
	cookie, err := r.Cookie(creationCookie)
	if err != nil || !connectionIDPattern.MatchString(cookie.Value) {
		return "", invalidField("Idempotency-Key", "required", "initialize the browser session before an idempotent sign-in")
	}
	return "creation\x00" + sessionDigest(cookie.Value), nil
}
