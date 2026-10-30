package app

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime"
	"net/http"
)

// decodeJSON reads exactly one JSON object of at most maxBodyBytes, rejecting
// other media types and unknown fields.
func decodeJSON(w http.ResponseWriter, r *http.Request, out any) error {
	mediaType, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if err != nil || mediaType != "application/json" {
		return errNotJSON
	}
	r.Body = http.MaxBytesReader(w, r.Body, maxBodyBytes)
	decoder := json.NewDecoder(r.Body)
	var payload json.RawMessage
	if err := decoder.Decode(&payload); err != nil {
		return decodeError(err)
	}
	if len(payload) == 0 || payload[0] != '{' {
		return invalidField("", "not_object", "request body must be a JSON object")
	}
	objectDecoder := json.NewDecoder(bytes.NewReader(payload))
	objectDecoder.DisallowUnknownFields()
	if err := objectDecoder.Decode(out); err != nil {
		return decodeError(err)
	}
	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		if err != nil {
			return decodeError(err)
		}
		return invalidField("", "invalid_json", "request body must contain exactly one JSON object")
	}
	return nil
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	if status == http.StatusNoContent {
		w.WriteHeader(status)
		return
	}
	body, err := json.Marshal(payload)
	if err != nil {
		// An unserializable response is a programming error. Recovery logs it and
		// returns 500 before any success headers have been committed.
		panic(fmt.Errorf("encode JSON response: %w", err))
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	// The outer startedWriter logs transport failures with the request ID.
	_, _ = w.Write(append(body, '\n'))
}
