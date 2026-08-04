package app

import (
	"errors"
	"net/http"
	"sync"
	"time"
)

const (
	sessionCookie = "harbor_console_sid"
	sessionTTL    = 12 * time.Hour
	maxBodyBytes  = 1 << 20
	maxReplyBytes = 8 << 20
	maxSessions   = 1000
	maxInstances  = 20
	maxQueryBytes = 8 << 10

	projectAssetPageSize       = 100
	dashboardProjectPageSize   = 100
	maxConcurrentProjectAssets = 8
)

type session struct {
	ID             string
	InstanceURL    string
	Username       string
	Password       string
	SkipTLSVerify  bool
	Demo           bool
	CreatedAt      time.Time
	ExpiresAt      time.Time
	LastAccessedAt time.Time
	Client         *http.Client
	DemoData       *demoState
	ActiveInstance string
	Instances      map[string]*harborConnection
}

type harborConnection struct {
	ID            string
	InstanceURL   string
	Username      string
	Password      string
	SkipTLSVerify bool
	Demo          bool
	AddedAt       time.Time
	Client        *http.Client
	DemoData      *demoState
}

type sessionStore struct {
	mu       sync.RWMutex
	sessions map[string]*session
}

type rateLimiter struct {
	mu      sync.Mutex
	entries map[string][]time.Time
	limit   int
	window  time.Duration
}

func newRateLimiter(limit int, window time.Duration) *rateLimiter {
	return &rateLimiter{entries: make(map[string][]time.Time), limit: limit, window: window}
}

func (l *rateLimiter) allow(key string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := time.Now()
	cutoff := now.Add(-l.window)
	if len(l.entries) > 2048 {
		for entryKey, entryValues := range l.entries {
			if len(entryValues) == 0 || entryValues[len(entryValues)-1].Before(cutoff) {
				delete(l.entries, entryKey)
			}
		}
	}
	values := l.entries[key]
	kept := values[:0]
	for _, value := range values {
		if value.After(cutoff) {
			kept = append(kept, value)
		}
	}
	if len(kept) >= l.limit {
		l.entries[key] = kept
		return false
	}
	l.entries[key] = append(kept, now)
	return true
}

func newSessionStore() *sessionStore {
	return &sessionStore{sessions: make(map[string]*session)}
}

func (s *sessionStore) create(value *session) error {
	id, err := randomID()
	if err != nil {
		return err
	}
	connectionID, err := randomID()
	if err != nil {
		return err
	}
	now := time.Now()
	value.ID = id
	value.CreatedAt = now
	value.LastAccessedAt = now
	value.ExpiresAt = now.Add(sessionTTL)
	value.ActiveInstance = connectionID
	value.Instances = map[string]*harborConnection{connectionID: connectionFromSession(connectionID, value, now)}
	s.mu.Lock()
	for key, existing := range s.sessions {
		if now.After(existing.ExpiresAt) {
			closeSessionClient(existing)
			delete(s.sessions, key)
		}
	}
	if len(s.sessions) >= maxSessions {
		var oldestID string
		var oldestTime time.Time
		for key, existing := range s.sessions {
			if oldestID == "" || existing.LastAccessedAt.Before(oldestTime) {
				oldestID = key
				oldestTime = existing.LastAccessedAt
			}
		}
		closeSessionClient(s.sessions[oldestID])
		delete(s.sessions, oldestID)
	}
	s.sessions[id] = value
	s.mu.Unlock()
	return nil
}

func (s *sessionStore) get(id string) (*session, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	value, ok := s.sessions[id]
	if !ok || time.Now().After(value.ExpiresAt) {
		closeSessionClient(value)
		delete(s.sessions, id)
		return nil, false
	}
	value.LastAccessedAt = time.Now()
	return cloneSession(value), true
}

func (s *sessionStore) delete(id string) {
	s.mu.Lock()
	closeSessionClient(s.sessions[id])
	delete(s.sessions, id)
	s.mu.Unlock()
}

func (s *sessionStore) updateActivePassword(sessionID, password string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	current, ok := s.sessions[sessionID]
	if !ok || time.Now().After(current.ExpiresAt) {
		return errSessionNotFound
	}
	connection, ok := current.Instances[current.ActiveInstance]
	if !ok {
		return errInstanceNotFound
	}
	current.Password = password
	connection.Password = password
	current.LastAccessedAt = time.Now()
	return nil
}

var (
	errSessionNotFound  = errors.New("session not found")
	errInstanceNotFound = errors.New("instance not found")
	errInstanceExists   = errors.New("instance already exists")
	errInstanceLimit    = errors.New("instance limit reached")
	errLastInstance     = errors.New("last instance cannot be removed")
)

func (s *sessionStore) addInstance(sessionID string, candidate *session) (*session, error) {
	connectionID, err := randomID()
	if err != nil {
		return nil, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	current, ok := s.sessions[sessionID]
	if !ok || time.Now().After(current.ExpiresAt) {
		return nil, errSessionNotFound
	}
	if len(current.Instances) >= maxInstances {
		return nil, errInstanceLimit
	}
	for _, existing := range current.Instances {
		if existing.InstanceURL == candidate.InstanceURL && existing.Username == candidate.Username {
			return nil, errInstanceExists
		}
	}
	connection := connectionFromSession(connectionID, candidate, time.Now())
	current.Instances[connectionID] = connection
	current.ActiveInstance = connectionID
	applyConnection(current, connection)
	current.LastAccessedAt = time.Now()
	return cloneSession(current), nil
}

func (s *sessionStore) switchInstance(sessionID, connectionID string) (*session, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	current, ok := s.sessions[sessionID]
	if !ok || time.Now().After(current.ExpiresAt) {
		return nil, errSessionNotFound
	}
	connection, ok := current.Instances[connectionID]
	if !ok {
		return nil, errInstanceNotFound
	}
	current.ActiveInstance = connectionID
	applyConnection(current, connection)
	current.LastAccessedAt = time.Now()
	return cloneSession(current), nil
}

func (s *sessionStore) removeInstance(sessionID, connectionID string) (*session, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	current, ok := s.sessions[sessionID]
	if !ok || time.Now().After(current.ExpiresAt) {
		return nil, errSessionNotFound
	}
	connection, ok := current.Instances[connectionID]
	if !ok {
		return nil, errInstanceNotFound
	}
	if len(current.Instances) <= 1 {
		return nil, errLastInstance
	}
	if connection.Client != nil {
		connection.Client.CloseIdleConnections()
	}
	delete(current.Instances, connectionID)
	if current.ActiveInstance == connectionID {
		var next *harborConnection
		for _, candidate := range current.Instances {
			if next == nil || candidate.AddedAt.Before(next.AddedAt) {
				next = candidate
			}
		}
		current.ActiveInstance = next.ID
		applyConnection(current, next)
	}
	current.LastAccessedAt = time.Now()
	return cloneSession(current), nil
}

func cloneSession(current *session) *session {
	copy := *current
	copy.Instances = make(map[string]*harborConnection, len(current.Instances))
	for id, connection := range current.Instances {
		connectionCopy := *connection
		copy.Instances[id] = &connectionCopy
	}
	return &copy
}

func connectionFromSession(id string, current *session, addedAt time.Time) *harborConnection {
	return &harborConnection{
		ID: id, InstanceURL: current.InstanceURL, Username: current.Username, Password: current.Password,
		SkipTLSVerify: current.SkipTLSVerify, Demo: current.Demo, AddedAt: addedAt, Client: current.Client, DemoData: current.DemoData,
	}
}

func applyConnection(current *session, connection *harborConnection) {
	current.InstanceURL = connection.InstanceURL
	current.Username = connection.Username
	current.Password = connection.Password
	current.SkipTLSVerify = connection.SkipTLSVerify
	current.Demo = connection.Demo
	current.Client = connection.Client
	current.DemoData = connection.DemoData
}

func closeSessionClient(current *session) {
	if current == nil {
		return
	}
	if len(current.Instances) > 0 {
		for _, connection := range current.Instances {
			if connection.Client != nil {
				connection.Client.CloseIdleConnections()
			}
		}
		return
	}
	if current.Client != nil {
		current.Client.CloseIdleConnections()
	}
}
