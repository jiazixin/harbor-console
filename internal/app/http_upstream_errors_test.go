package app

import (
	"context"
	"fmt"
	"net/http"
	"testing"
)

func TestUpstreamFailureDescribesHarborStatus(t *testing.T) {
	for _, tc := range []struct {
		name          string
		err           error
		wantStatus    int
		wantCode      string
		wantHarborMsg any
	}{
		{
			name:       "precondition failures keep the Harbor status without upstream text",
			err:        &upstreamError{StatusCode: http.StatusPreconditionFailed, Message: "No scanner is configured"},
			wantStatus: http.StatusPreconditionFailed,
			wantCode:   "harbor_precondition_failed",
		},
		{
			name:       "server errors become 503 without upstream text",
			err:        &upstreamError{StatusCode: http.StatusInternalServerError, Message: "internal server error"},
			wantStatus: http.StatusServiceUnavailable,
			wantCode:   "harbor_server_error",
		},
		{
			name:       "unknown upstream errors omit internal text",
			err:        &upstreamError{StatusCode: http.StatusRequestEntityTooLarge, Message: "too large"},
			wantStatus: http.StatusServiceUnavailable,
			wantCode:   "harbor_error",
		},
		{
			name:       "deadline errors are reported as timeouts",
			err:        fmt.Errorf("request: %w", context.DeadlineExceeded),
			wantStatus: http.StatusServiceUnavailable,
			wantCode:   "harbor_timeout",
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			got := upstreamFailure(tc.err)
			if got.status != tc.wantStatus || got.code != tc.wantCode || got.details["harbor_message"] != tc.wantHarborMsg {
				t.Fatalf("got %d %s %v, want %d %s %v", got.status, got.code, got.details, tc.wantStatus, tc.wantCode, tc.wantHarborMsg)
			}
		})
	}
}
