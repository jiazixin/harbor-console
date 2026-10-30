package app

import (
	"context"
	"errors"
	"net/http"
	"strings"
)

type writeConfirmationError struct {
	err error
}

func (e *writeConfirmationError) Error() string {
	return "Harbor accepted write but confirmation failed: " + e.err.Error()
}

func (e *writeConfirmationError) Unwrap() error {
	return e.err
}

func writeUpstreamError(w http.ResponseWriter, r *http.Request, err error) {
	requestLogger(r).Warn("harbor_request_failed", "method", r.Method, "path", r.URL.Path, "status", upstreamFailure(err).status)
	writeError(w, r, upstreamFailure(err))
}

// upstreamFailure maps an error from a Harbor request to the failure reported
// to the client. Upstream text is deliberately excluded from the wire response.
func upstreamFailure(err error) *apiFailure {
	status := http.StatusServiceUnavailable
	if errors.Is(err, context.DeadlineExceeded) {
		status = http.StatusServiceUnavailable
	}
	if confirmation, ok := errors.AsType[*writeConfirmationError](err); ok {
		cause := upstreamFailure(confirmation.err)
		unconfirmed := failure(status, "harbor_write_unconfirmed", "Harbor accepted the write but confirmation failed: "+cause.message).
			with("reason", cause.code)
		return unconfirmed
	}
	if known, ok := errors.AsType[*apiFailure](err); ok {
		return known
	}
	if errors.Is(err, context.DeadlineExceeded) {
		return failure(status, "harbor_timeout", "Harbor request timed out")
	}
	if errors.Is(err, context.Canceled) {
		return failure(status, "harbor_canceled", "Harbor request canceled")
	}
	if upstream, ok := errors.AsType[*upstreamError](err); ok {
		return harborStatusFailure(upstream.StatusCode)
	}
	message := err.Error()
	switch {
	case strings.Contains(message, "invalid JSON"):
		return failure(status, "harbor_invalid_response", "Harbor returned invalid JSON")
	case strings.Contains(message, "too many redirects"):
		return failure(status, "harbor_too_many_redirects", "Harbor redirected too many times")
	case strings.Contains(message, "cross-origin redirect refused"):
		return failure(status, "harbor_redirect_refused", "cross-origin Harbor redirect refused to protect credentials")
	case strings.Contains(message, "certificate"):
		return failure(status, "harbor_certificate_invalid", "Harbor certificate verification failed")
	case strings.Contains(message, "request failed"):
		return failure(status, "harbor_unreachable", "cannot reach the Harbor instance")
	case strings.Contains(message, "read response"):
		return failure(status, "harbor_read_failed", "reading the Harbor response failed")
	default:
		return failure(status, "harbor_unknown_error", "unexpected Harbor connection error")
	}
}

// harborStatusFailure maps an HTTP error status returned by Harbor, keeping
// supported client statuses and mapping upstream failures to 503.
func harborStatusFailure(harborStatus int) *apiFailure {
	status := http.StatusServiceUnavailable
	code, message := "harbor_error", "Harbor returned an error"
	switch harborStatus {
	case http.StatusBadRequest:
		code, message = "harbor_bad_request", "request rejected by the Harbor API"
	case http.StatusUnauthorized:
		code, message = "harbor_unauthorized", "Harbor rejected the credentials"
	case http.StatusForbidden:
		code, message = "harbor_forbidden", "Harbor account lacks permission"
	case http.StatusNotFound:
		code, message = "harbor_not_found", "Harbor resource not found"
	case http.StatusMethodNotAllowed:
		code, message = "harbor_method_not_allowed", "operation not allowed by this Harbor version or resource state"
	case http.StatusConflict:
		code, message = "harbor_conflict", "Harbor reports a conflict"
	case http.StatusPreconditionFailed:
		code, message = "harbor_precondition_failed", "Harbor precondition failed"
	case http.StatusUnprocessableEntity:
		code, message = "harbor_unprocessable", "Harbor cannot process the operation"
	case http.StatusTooManyRequests:
		code, message = "harbor_rate_limited", "Harbor rate limit exceeded"
	default:
		if harborStatus >= http.StatusInternalServerError {
			// Harbor reports failures of services it calls on the user's behalf,
			// such as an unreachable scanner adapter or registry, as HTTP 500.
			code, message = "harbor_server_error", "Harbor server error"
		}
	}
	switch harborStatus {
	case http.StatusBadRequest, http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound,
		http.StatusMethodNotAllowed, http.StatusConflict, http.StatusPreconditionFailed,
		http.StatusUnprocessableEntity, http.StatusTooManyRequests:
		status = harborStatus
	}
	if status == http.StatusUnprocessableEntity {
		status = http.StatusBadRequest
	}
	return failure(status, code, message).with("harbor_status", harborStatus)
}
