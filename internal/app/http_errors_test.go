package app

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestWriteErrorFieldError(t *testing.T) {
	recorder := httptest.NewRecorder()
	writeError(recorder, httptest.NewRequest(http.MethodGet, "/api/sessions/current", nil), nestField("rules.0", invalidField("tag_selectors", "invalid_count", "must contain 1 to 32 selectors")))
	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("got status %d, want %d", recorder.Code, http.StatusBadRequest)
	}
	var body struct {
		Error struct {
			Code    string `json:"code"`
			Details struct {
				Fields []struct {
					Path   string `json:"path"`
					Reason string `json:"reason"`
				} `json:"fields"`
			} `json:"details"`
		} `json:"error"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	fields := body.Error.Details.Fields
	if body.Error.Code != "invalid_argument" || len(fields) != 1 || fields[0].Path != "rules.0.tag_selectors" || fields[0].Reason != "invalid_count" {
		t.Fatalf("got %s, want invalid_argument for rules.0.tag_selectors", recorder.Body.String())
	}
}

func TestWriteErrorHidesUnknownErrors(t *testing.T) {
	recorder := httptest.NewRecorder()
	writeError(recorder, httptest.NewRequest(http.MethodGet, "/api/sessions/current", nil), errors.New("secret internal detail"))
	if recorder.Code != http.StatusInternalServerError || strings.Contains(recorder.Body.String(), "secret") {
		t.Fatalf("got %d %s, want 500 without the internal text", recorder.Code, recorder.Body.String())
	}
}

func TestDecodeErrorReportsUnknownField(t *testing.T) {
	request := jsonRequest(http.MethodPost, "/", strings.NewReader(`{"url":"https://harbor.test","extra":true}`))
	var input connectRequest
	err := decodeJSON(httptest.NewRecorder(), request, &input)
	field, ok := errors.AsType[*fieldError](err)
	if !ok || field.Path != "extra" || field.Reason != "unknown_field" {
		t.Fatalf("got %v, want unknown_field for extra", err)
	}
}
