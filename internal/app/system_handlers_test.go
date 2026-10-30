package app

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestInfoBuildDateUsesCanonicalUTCAndOmitsUnknown(t *testing.T) {
	t.Parallel()
	for _, test := range []struct{ input, want string }{
		{input: "2026-10-31T08:15:30+08:00", want: "2026-10-31T00:15:30.000Z"},
		{input: "", want: ""},
	} {
		t.Run(test.input, func(t *testing.T) {
			t.Parallel()
			application, err := newApp()
			if err != nil {
				t.Fatal(err)
			}
			application.build.Time = test.input
			response := httptest.NewRecorder()
			application.routes().ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/info", nil))
			var payload struct {
				Console map[string]json.RawMessage `json:"console"`
			}
			if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
				t.Fatal(err)
			}
			date, exists := payload.Console["build_date"]
			if test.want == "" {
				if exists {
					t.Fatalf("unknown build date must be omitted, got %s", date)
				}
				return
			}
			var got string
			if err := json.Unmarshal(date, &got); err != nil || got != test.want {
				t.Fatalf("got %q, %v; want %q", got, err, test.want)
			}
		})
	}
}
