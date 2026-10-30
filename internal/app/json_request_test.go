package app

import (
	"io"
	"net/http"
	"net/http/httptest"
)

// jsonRequest returns a test request whose body is sent as application/json.
func jsonRequest(method, target string, body io.Reader) *http.Request {
	request := httptest.NewRequest(method, target, body)
	request.Header.Set("Content-Type", "application/json")
	return request
}
