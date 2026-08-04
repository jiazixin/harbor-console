package app

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"sort"
	"time"
)

func (a *app) currentSession(r *http.Request) (*session, bool) {
	sessionID, ok := sessionIDFromRequest(r)
	if !ok {
		return nil, false
	}
	return a.sessions.get(sessionID)
}

func sessionIDFromRequest(r *http.Request) (string, bool) {
	cookie, err := r.Cookie(sessionCookie)
	if err != nil || cookie.Value == "" {
		return "", false
	}
	return cookie.Value, true
}

func (a *app) setSessionCookie(w http.ResponseWriter, r *http.Request, id string) {
	http.SetCookie(w, &http.Cookie{
		Name: sessionCookie, Value: id, Path: "/", HttpOnly: true,
		SameSite: http.SameSiteStrictMode, Secure: requestIsTLS(r), MaxAge: int(sessionTTL.Seconds()),
	})
}

func sessionInfo(current *session) map[string]any {
	return map[string]any{
		"connection_id":  current.ActiveInstance,
		"instance_url":   current.InstanceURL,
		"username":       current.Username,
		"demo":           current.Demo,
		"instance_count": len(current.Instances),
		"expires_at":     current.ExpiresAt.UTC().Format(time.RFC3339),
	}
}

func instancesInfo(current *session) map[string]any {
	items := make([]*harborConnection, 0, len(current.Instances))
	for _, connection := range current.Instances {
		items = append(items, connection)
	}
	sort.SliceStable(items, func(left, right int) bool {
		return items[left].AddedAt.Before(items[right].AddedAt)
	})
	payload := make([]map[string]any, 0, len(items))
	for _, connection := range items {
		payload = append(payload, map[string]any{
			"connection_id": connection.ID,
			"instance_url":  connection.InstanceURL,
			"username":      connection.Username,
			"demo":          connection.Demo,
			"active":        connection.ID == current.ActiveInstance,
			"added_at":      connection.AddedAt.UTC().Format(time.RFC3339),
		})
	}
	return map[string]any{"active_id": current.ActiveInstance, "items": payload, "expires_at": current.ExpiresAt.UTC().Format(time.RFC3339)}
}

func randomID() (string, error) {
	buffer := make([]byte, 32)
	if _, err := rand.Read(buffer); err != nil {
		return "", err
	}
	return hex.EncodeToString(buffer), nil
}
