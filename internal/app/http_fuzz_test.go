package app

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
)

func FuzzDecodeJSON(f *testing.F) {
	f.Fuzz(func(t *testing.T, payload string) {
		var input connectRequest
		request := jsonRequest(http.MethodPost, "/api/sessions", strings.NewReader(payload))
		err := decodeJSON(httptest.NewRecorder(), request, &input)
		if err == nil && !strings.HasPrefix(strings.TrimSpace(payload), "{") {
			t.Fatalf("accepted non-object %q", payload)
		}
	})
}

func FuzzHarborURL(f *testing.F) {
	f.Fuzz(func(t *testing.T, input string) {
		normalized, err := validateHarborURL(input)
		if err != nil {
			return
		}
		parsed, err := url.Parse(normalized)
		if err != nil || parsed.User != nil || parsed.RawQuery != "" || parsed.Fragment != "" || (parsed.Scheme != "http" && parsed.Scheme != "https") {
			t.Fatalf("accepted unsafe URL %q", normalized)
		}
	})
}
