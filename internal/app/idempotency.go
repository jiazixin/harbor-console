package app

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"errors"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"
)

const (
	idempotencyWindow      = 24 * time.Hour
	maxIdempotencyEntries  = 4096
	maxIdempotencyBytes    = 64 << 20
	maxIdempotencyKeyBytes = 255
)

var errIdempotencyCapacity = failure(http.StatusServiceUnavailable, "unavailable", "idempotency cache is at capacity")

type idempotentResponse struct {
	status int
	header http.Header
	body   []byte
}

type idempotencyEntry struct {
	tokenSeed   string
	fingerprint [sha256.Size]byte
	done        chan struct{}
	created     time.Time
	response    idempotentResponse
}

// idempotencyCache belongs to one application. mu guards entries and usedBytes;
// a closed done channel publishes the immutable response to waiting requests.
// Pending entries reserve the maximum response size before a write is allowed.
// Unexpired results are never evicted to make room for another write.
type idempotencyCache struct {
	mu        sync.Mutex
	entries   map[string]*idempotencyEntry
	usedBytes int
	now       func() time.Time
}

func newIdempotencyCache() *idempotencyCache {
	return &idempotencyCache{entries: make(map[string]*idempotencyEntry), now: time.Now}
}

func (c *idempotencyCache) acquire(scope string, fingerprint [sha256.Size]byte) (*idempotencyEntry, bool, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	now := c.now()
	for key, entry := range c.entries {
		select {
		case <-entry.done:
			if !now.Before(entry.created.Add(idempotencyWindow)) {
				c.usedBytes -= len(entry.response.body)
				delete(c.entries, key)
			}
		default:
		}
	}
	if entry, ok := c.entries[scope]; ok {
		if entry.fingerprint != fingerprint {
			return nil, false, errKeyReused
		}
		return entry, false, nil
	}
	if len(c.entries) >= maxIdempotencyEntries || c.usedBytes+maxReplyBytes > maxIdempotencyBytes {
		return nil, false, errIdempotencyCapacity
	}
	entry := &idempotencyEntry{tokenSeed: rand.Text(), fingerprint: fingerprint, done: make(chan struct{}), created: now}
	c.entries[scope] = entry
	c.usedBytes += maxReplyBytes
	return entry, true, nil
}

func (c *idempotencyCache) complete(entry *idempotencyEntry, response idempotentResponse) {
	c.mu.Lock()
	defer c.mu.Unlock()
	entry.response = response
	entry.created = c.now()
	c.usedBytes += len(response.body) - maxReplyBytes
	close(entry.done)
}

// idempotent serializes identical keys, including concurrent requests, and
// replays the first completed result for 24 hours within the process lifetime.
// Authentication is checked before replay; a key cannot cross instance scopes.
func (a *app) idempotent(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		key := r.Header.Get("Idempotency-Key")
		if key == "" {
			next(w, r)
			return
		}
		if len(key) > maxIdempotencyKeyBytes || strings.TrimSpace(key) != key {
			writeError(w, r, invalidField("Idempotency-Key", "invalid_value", "must contain 1 to 255 non-padded bytes"))
			return
		}

		isCreation := r.URL.Path == "/api/sessions" || r.URL.Path == "/api/demo-sessions"
		var current *session
		var scope string
		if isCreation {
			var err error
			scope, err = creationScope(r)
			if err != nil {
				writeError(w, r, err)
				return
			}
		} else {
			var ok bool
			current, ok = a.currentSession(r)
			if !ok {
				writeError(w, r, errSessionRequired)
				return
			}
			scope = current.ID
		}

		body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, maxBodyBytes))
		if err != nil {
			writeError(w, r, err)
			return
		}
		r.Body = io.NopCloser(bytes.NewReader(body))
		identity := r.Method + " " + r.URL.RequestURI() + "\n" + r.Header.Get("Content-Type") + "\n"
		if current != nil && strings.HasPrefix(r.URL.Path, "/api/operations/") {
			identity += current.ActiveInstance + "\n"
		}
		fingerprint := sha256.Sum256(append([]byte(identity), body...))
		entry, owner, err := a.idempotency.acquire(scope+"\x00"+key, fingerprint)
		if err != nil {
			if errors.Is(err, errIdempotencyCapacity) {
				w.Header().Set("Retry-After", "60")
			}
			writeError(w, r, err)
			return
		}
		token := ""
		if isCreation {
			token = a.creationToken(scope+"\x00"+key, entry.tokenSeed)
		}
		if owner {
			if current != nil {
				r = r.WithContext(context.WithValue(r.Context(), sessionSnapshotKey{}, current))
			}
			if isCreation {
				r = r.WithContext(context.WithValue(r.Context(), creationTokenKey{}, token))
			}
			a.captureIdempotent(r, entry, next)
		} else {
			select {
			case <-entry.done:
			case <-r.Context().Done():
				// The caller disconnected or exhausted its request budget. The owner
				// keeps the reservation and publishes its result for a later retry.
				if errors.Is(r.Context().Err(), context.DeadlineExceeded) {
					writeError(w, r, errIdempotencyCapacity)
				}
				return
			}
		}
		if isCreation && entry.response.status == http.StatusCreated {
			if _, valid := a.sessions.get(sessionDigest(token)); !valid {
				writeError(w, r, errSessionRequired)
				return
			}
			a.setSessionCookie(w, r, token)
		}
		for name, values := range entry.response.header {
			w.Header()[name] = append([]string(nil), values...)
		}
		w.WriteHeader(entry.response.status)
		// The outer startedWriter logs transport failures with the request ID.
		_, _ = w.Write(entry.response.body)
	}
}

func (a *app) captureIdempotent(r *http.Request, entry *idempotencyEntry, next http.HandlerFunc) {
	capture := &capturingWriter{header: make(http.Header)}
	defer func() {
		if recovered := recover(); recovered != nil {
			// Keep a final failure even when the operation panics, so retries cannot
			// repeat an upstream write whose outcome is unknown.
			capture = &capturingWriter{header: make(http.Header)}
			writeError(capture, r, errInternal)
			a.idempotency.complete(entry, capture.response())
			panic(recovered)
		}
		if capture.overflow {
			capture = &capturingWriter{header: make(http.Header)}
			writeError(capture, r, errors.New("idempotency response exceeds size limit"))
		}
		// Session cookies are reconstructed from a server secret, never retained in the cache.
		capture.header.Del("Set-Cookie")
		a.idempotency.complete(entry, capture.response())
	}()
	next(capture, r)
}

// capturingWriter buffers a bounded response before publishing it atomically.
type capturingWriter struct {
	header   http.Header
	status   int
	body     bytes.Buffer
	overflow bool
}

func (w *capturingWriter) Header() http.Header { return w.header }

func (w *capturingWriter) WriteHeader(status int) {
	if w.status == 0 {
		w.status = status
	}
}

func (w *capturingWriter) Write(payload []byte) (int, error) {
	if w.status == 0 {
		w.WriteHeader(http.StatusOK)
	}
	if w.body.Len()+len(payload) > maxReplyBytes {
		w.overflow = true
		return 0, errors.New("idempotency response exceeds size limit")
	}
	return w.body.Write(payload)
}

func (w *capturingWriter) response() idempotentResponse {
	if w.status == 0 {
		w.status = http.StatusOK
	}
	return idempotentResponse{status: w.status, header: w.header.Clone(), body: bytes.Clone(w.body.Bytes())}
}
