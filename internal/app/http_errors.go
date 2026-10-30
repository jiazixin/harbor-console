package app

import (
	"encoding/json"
	"errors"
	"maps"
	"net/http"
	"strings"
)

// apiError is the body of every failed API response. Code is the only value
// clients branch on; Message is English text for developers and is never shown
// to users. See 代码规范.md section 5.3.
type apiError struct {
	Error apiErrorBody `json:"error"`
}

type apiErrorBody struct {
	Code    string         `json:"code"`
	Message string         `json:"message"`
	Details map[string]any `json:"details,omitzero"`
}

// apiFailure is an error reported to the client with a fixed status and code.
type apiFailure struct {
	status  int
	code    string
	message string
	details map[string]any
}

func (e *apiFailure) Error() string { return e.code + ": " + e.message }

func failure(status int, code, message string) *apiFailure {
	return &apiFailure{status: status, code: code, message: message}
}

// with returns a copy of the failure with one more details entry.
func (e *apiFailure) with(key string, value any) *apiFailure {
	details := maps.Clone(e.details)
	if details == nil {
		details = make(map[string]any)
	}
	details[key] = value
	copied := *e
	copied.details = details
	return &copied
}

// fieldError reports an invalid request field or parameter. writeError turns
// it into a 400 invalid_argument response listing the path and reason.
type fieldError struct {
	// Path is the dotted request path, with array indexes as numbers
	// ("rules.0.tag_selectors"); it is empty when the whole body is invalid.
	Path string
	// Reason is the snake_case reason code clients map to text.
	Reason  string
	Message string
}

func (e *fieldError) Error() string {
	if e.Path == "" {
		return e.Message
	}
	return e.Path + ": " + e.Message
}

func invalidField(path, reason, message string) error {
	return &fieldError{Path: path, Reason: reason, Message: message}
}

// nestField prefixes the path of a field error with prefix, so errors from a
// nested validator point at their place in the whole request. Other errors are
// returned unchanged.
func nestField(prefix string, err error) error {
	field, ok := errors.AsType[*fieldError](err)
	if !ok {
		return err
	}
	path := prefix
	if field.Path != "" {
		path += "." + field.Path
	}
	return &fieldError{Path: path, Reason: field.Reason, Message: field.Message}
}

// Shared failures of the session, origin and rate limit checks.
var (
	errSessionRequired   = failure(http.StatusUnauthorized, "unauthenticated", "session expired or missing")
	errOriginRejected    = failure(http.StatusForbidden, "permission_denied", "cross-origin request rejected")
	errRateLimited       = failure(http.StatusTooManyRequests, "rate_limited", "too many requests")
	errQueryTooLong      = failure(http.StatusBadRequest, "query_too_long", "query string too long")
	errInvalidInstanceID = failure(http.StatusBadRequest, "invalid_instance_id", "select an existing Harbor instance")

	errDemoDataMissing   = failure(http.StatusNotFound, "demo_data_missing", "no demo data for this resource")
	errInvalidHarborJSON = failure(http.StatusServiceUnavailable, "harbor_invalid_response", "Harbor did not return valid JSON")
	errNotFound          = failure(http.StatusNotFound, "not_found", "no such API endpoint")
	errMethodNotAllowed  = failure(http.StatusMethodNotAllowed, "method_not_allowed", "method not allowed")
	errNotJSON           = failure(http.StatusUnsupportedMediaType, "unsupported_media_type", "request body must be application/json")
	errKeyReused         = failure(http.StatusConflict, "idempotency_key_reused", "Idempotency-Key was used with a different request")
	errInternal          = failure(http.StatusInternalServerError, "internal", "internal error")
)

// writeError writes err as the JSON error response. Field errors become 400
// invalid_argument; errors without a known mapping become 500 internal, are
// logged with the request ID and do not expose their text.
func writeError(w http.ResponseWriter, r *http.Request, err error) {
	body := apiErrorBody{Code: errInternal.code, Message: errInternal.message}
	status := http.StatusInternalServerError
	if known, ok := errors.AsType[*apiFailure](err); ok {
		status, body = known.status, apiErrorBody{Code: known.code, Message: known.message, Details: known.details}
	} else if field, ok := errors.AsType[*fieldError](err); ok {
		status = http.StatusBadRequest
		body = apiErrorBody{
			Code:    "invalid_argument",
			Message: field.Error(),
			Details: map[string]any{"fields": []map[string]string{{"path": field.Path, "reason": field.Reason}}},
		}
	} else if _, ok := errors.AsType[*http.MaxBytesError](err); ok {
		status, body = http.StatusRequestEntityTooLarge, apiErrorBody{Code: "payload_too_large", Message: "request body too large"}
	} else {
		requestLogger(r).Error("request_failed", "method", r.Method, "path", r.URL.Path, "error", err)
	}
	if status == http.StatusTooManyRequests && w.Header().Get("Retry-After") == "" {
		w.Header().Set("Retry-After", "60")
	}
	writeJSON(w, status, apiError{Error: body})
}

// decodeError converts an error from decoding a JSON request body into a
// field error or a payload_too_large failure.
func decodeError(err error) error {
	if _, ok := errors.AsType[*http.MaxBytesError](err); ok {
		return err
	}
	if typeError, ok := errors.AsType[*json.UnmarshalTypeError](err); ok {
		return invalidField(typeError.Field, "invalid_type", "has the wrong JSON type")
	}
	if field, ok := strings.CutPrefix(err.Error(), "json: unknown field "); ok {
		return invalidField(strings.Trim(field, `"`), "unknown_field", "is not an allowed field")
	}
	return invalidField("", "invalid_json", "request body must be one valid JSON object")
}
