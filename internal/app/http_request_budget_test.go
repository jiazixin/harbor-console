package app

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"harbor-console/internal/config"
)

func newRequestBudgetTestApp(t *testing.T, writeTimeout time.Duration) *app {
	t.Helper()
	runtimeConfig := config.Default()
	runtimeConfig.Server.WriteTimeout = config.Duration(writeTimeout)
	application, err := newAppWithConfig(runtimeConfig, nil)
	if err != nil {
		t.Fatal(err)
	}
	return application
}

func requestBudgetTestResponse(request *http.Request, body string) *http.Response {
	return &http.Response{
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": {"application/json"}},
		Body:       io.NopCloser(strings.NewReader(body)),
		Request:    request,
	}
}

func TestCredentialStagesShareEarlierRequestDeadline(t *testing.T) {
	for _, test := range []struct {
		operation string
		body      string
	}{
		{operation: "current-user-password", body: `{"old_password":"password","new_password":"NewPassword2"}`},
		{operation: "current-user-cli-secret", body: `{"secret":"NewPassword2"}`},
	} {
		t.Run(test.operation, func(t *testing.T) {
			application := newRequestBudgetTestApp(t, 250*time.Millisecond)
			ctx, cancel := context.WithTimeout(t.Context(), 120*time.Millisecond)
			defer cancel()
			wantDeadline, _ := ctx.Deadline()
			deadlines := make([]time.Time, 0, 2)
			client := &http.Client{Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
				deadline, ok := request.Context().Deadline()
				if !ok {
					t.Fatal("upstream stage has no deadline")
				}
				deadlines = append(deadlines, deadline)
				if request.Method == http.MethodGet {
					timer := time.NewTimer(40 * time.Millisecond)
					defer timer.Stop()
					select {
					case <-timer.C:
						return requestBudgetTestResponse(request, `{"user_id":7}`), nil
					case <-request.Context().Done():
						return nil, request.Context().Err()
					}
				}
				<-request.Context().Done()
				return nil, request.Context().Err()
			})}
			current := createTestSession(t, application, client, false)
			request := httptest.NewRequest(http.MethodPut, "/api/control/"+test.operation+"?id=7", strings.NewReader(test.body)).WithContext(ctx)
			request.AddCookie(&http.Cookie{Name: sessionCookie, Value: current.ID})
			response := httptest.NewRecorder()
			application.routes().ServeHTTP(response, request)
			if response.Code != http.StatusGatewayTimeout || len(deadlines) != 2 {
				t.Fatalf("slow credential update response = %d, stages = %d, body = %s", response.Code, len(deadlines), response.Body.String())
			}
			for _, deadline := range deadlines {
				if !deadline.Equal(wantDeadline) {
					t.Fatalf("upstream deadline = %s, want unchanged parent deadline %s", deadline, wantDeadline)
				}
			}
		})
	}
}

func TestCredentialPreflightExpiryDoesNotStartWrite(t *testing.T) {
	for _, test := range []struct {
		name             string
		explicitlyCancel bool
		lateSuccess      bool
	}{
		{name: "budget exhausted"},
		{name: "budget exhausted with late preflight success", lateSuccess: true},
		{name: "request canceled", explicitlyCancel: true},
		{name: "request canceled with late preflight success", explicitlyCancel: true, lateSuccess: true},
	} {
		t.Run(test.name, func(t *testing.T) {
			application := newRequestBudgetTestApp(t, 100*time.Millisecond)
			ctx, cancel := context.WithCancel(t.Context())
			defer cancel()
			requestCount := 0
			client := &http.Client{Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
				requestCount++
				if request.Method != http.MethodGet {
					t.Fatal("write started after preflight exhausted its budget")
				}
				if test.explicitlyCancel {
					cancel()
				}
				<-request.Context().Done()
				if test.lateSuccess {
					// A custom RoundTripper can ignore cancellation and return a
					// late 200; the next stage must still stop before client.Do.
					return requestBudgetTestResponse(request, `{"user_id":7}`), nil
				}
				return nil, request.Context().Err()
			})}
			current := createTestSession(t, application, client, false)
			request := httptest.NewRequest(http.MethodPut, "/api/control/current-user-password?id=7", strings.NewReader(`{"old_password":"password","new_password":"NewPassword2"}`)).WithContext(ctx)
			request.AddCookie(&http.Cookie{Name: sessionCookie, Value: current.ID})
			response := httptest.NewRecorder()
			application.routes().ServeHTTP(response, request)
			wantStatus := http.StatusGatewayTimeout
			if test.explicitlyCancel {
				wantStatus = http.StatusBadGateway
			}
			if requestCount != 1 || response.Code != wantStatus {
				t.Fatalf("expired preflight response = %d, upstream requests = %d", response.Code, requestCount)
			}
			if strings.Contains(response.Body.String(), "已接受写入") {
				t.Fatal("preflight failure claimed that Harbor accepted a write")
			}
		})
	}
}

func TestAllowlistReadbackExpiryReportsAcceptedWriteWithoutRetry(t *testing.T) {
	application := newRequestBudgetTestApp(t, 180*time.Millisecond)
	deadlines := make([]time.Time, 0, 3)
	requestCount, writeCount := 0, 0
	client := &http.Client{Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
		requestCount++
		deadline, ok := request.Context().Deadline()
		if !ok {
			t.Fatal("allowlist stage has no deadline")
		}
		deadlines = append(deadlines, deadline)
		if requestCount == 3 {
			<-request.Context().Done()
			return nil, request.Context().Err()
		}
		timer := time.NewTimer(20 * time.Millisecond)
		defer timer.Stop()
		select {
		case <-timer.C:
		case <-request.Context().Done():
			return nil, request.Context().Err()
		}
		if request.Method == http.MethodPut {
			writeCount++
			return requestBudgetTestResponse(request, `{}`), nil
		}
		return requestBudgetTestResponse(request, `{"id":1,"project_id":0,"expires_at":null,"items":[]}`), nil
	})}
	current := createTestSession(t, application, client, false)
	request := httptest.NewRequest(http.MethodPut, "/api/control/system-cve-allowlist", strings.NewReader(`{"expires_at":null,"items":[]}`))
	request.AddCookie(&http.Cookie{Name: sessionCookie, Value: current.ID})
	response := httptest.NewRecorder()
	started := time.Now()
	application.routes().ServeHTTP(response, request)
	if response.Code != http.StatusGatewayTimeout || requestCount != 3 || writeCount != 1 {
		t.Fatalf("allowlist confirmation response = %d, requests = %d, writes = %d", response.Code, requestCount, writeCount)
	}
	if elapsed := time.Since(started); elapsed > time.Second {
		t.Fatalf("allowlist stages exceeded the shared request budget: %s", elapsed)
	}
	for _, deadline := range deadlines {
		if !deadline.Equal(deadlines[0]) {
			t.Fatal("allowlist stage reset the request deadline")
		}
	}
	var failure apiError
	if err := json.Unmarshal(response.Body.Bytes(), &failure); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(failure.Error, "已接受写入") || !strings.Contains(failure.Error, "最终状态未确认") || !strings.Contains(failure.Details, "先刷新回读确认") {
		t.Fatalf("write confirmation failure was misleading: %#v", failure)
	}
	if strings.Contains(failure.Details, "请稍后重试") {
		t.Fatal("write confirmation failure recommended retrying before checking state")
	}
}

func TestUpstreamRequestBudgetLeavesStaticRequestsUntouched(t *testing.T) {
	ctx, cancel := context.WithCancel(t.Context())
	defer cancel()
	handler := upstreamRequestBudget(http.HandlerFunc(func(_ http.ResponseWriter, request *http.Request) {
		if request.Context() != ctx {
			t.Fatal("static request received an API deadline")
		}
	}), time.Second)
	handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/bundles/app-Ab12cd34.js", nil).WithContext(ctx))
}
