package app

import (
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"slices"

	"harbor-console/internal/timefmt"
)

type sessionSnapshotKey struct{}

func (a *app) currentSession(r *http.Request) (*session, bool) {
	if current, ok := r.Context().Value(sessionSnapshotKey{}).(*session); ok {
		return current, true
	}
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
	return sessionDigest(cookie.Value), true
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
		"expires_at":     timefmt.Time(current.ExpiresAt),
	}
}

func instancesInfo(current *session) map[string]any {
	items := make([]*harborConnection, 0, len(current.Instances))
	for _, connection := range current.Instances {
		items = append(items, connection)
	}
	slices.SortStableFunc(items, func(left, right *harborConnection) int { return left.AddedAt.Compare(right.AddedAt) })
	payload := make([]map[string]any, 0, len(items))
	for _, connection := range items {
		payload = append(payload, map[string]any{
			"connection_id": connection.ID,
			"instance_url":  connection.InstanceURL,
			"username":      connection.Username,
			"demo":          connection.Demo,
			"active":        connection.ID == current.ActiveInstance,
			"added_at":      timefmt.Time(connection.AddedAt),
		})
	}
	return map[string]any{"active_id": current.ActiveInstance, "items": payload, "expires_at": timefmt.Time(current.ExpiresAt)}
}

// sessionDigest is the only representation of a session token kept in storage.
func sessionDigest(token string) string {
	digest := sha256.Sum256([]byte(token))
	return hex.EncodeToString(digest[:])
}
