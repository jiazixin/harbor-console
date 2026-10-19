package app

import (
	"context"
	"fmt"
	"net/http"
	"testing"
)

func TestFriendlyUpstreamErrorDescribesHarborStatus(t *testing.T) {
	tests := []struct {
		name string
		err  error
		want string
	}{
		{
			name: "precondition failures are not described as deletions",
			err:  &upstreamError{StatusCode: http.StatusPreconditionFailed, Message: "No scanner is configured"},
			want: "Harbor 前置条件未满足：No scanner is configured",
		},
		{
			name: "server errors point to Harbor logs and external reachability",
			err:  &upstreamError{StatusCode: http.StatusInternalServerError, Message: "internal server error"},
			want: "Harbor 服务端错误（HTTP 500）：internal server error。请检查 Harbor 日志，以及 Harbor 能否访问所填写的外部地址",
		},
		{
			name: "other client errors keep the status and message",
			err:  &upstreamError{StatusCode: http.StatusRequestEntityTooLarge, Message: "too large"},
			want: "Harbor 返回 413: too large",
		},
		{
			name: "deadline errors are reported as timeouts",
			err:  fmt.Errorf("request: %w", context.DeadlineExceeded),
			want: "Harbor 请求超时，请稍后重试",
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := friendlyUpstreamError(test.err); got != test.want {
				t.Fatalf("friendlyUpstreamError() = %q, want %q", got, test.want)
			}
		})
	}
}
