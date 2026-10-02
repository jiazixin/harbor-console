package app

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"harbor-console/internal/buildinfo"
)

const harborRequestTimeout = 18 * time.Second

func (a *app) harborJSON(ctx context.Context, current *session, method, path string, query url.Values, out any) error {
	response, err := a.harborRequest(ctx, current, method, path, query, nil, nil)
	if err != nil {
		return err
	}
	if len(response.Body) == 0 || out == nil {
		return nil
	}
	if err := json.Unmarshal(response.Body, out); err != nil {
		return fmt.Errorf("Harbor returned invalid JSON: %w", err)
	}
	return nil
}

type harborResponse struct {
	StatusCode int
	Header     http.Header
	Body       []byte
}

func (a *app) harborRequest(ctx context.Context, current *session, method, path string, query url.Values, body []byte, headers http.Header) (*harborResponse, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	endpoint := current.InstanceURL + path
	if encoded := query.Encode(); encoded != "" {
		endpoint += "?" + encoded
	}
	var requestBody io.Reader
	if body != nil {
		requestBody = bytes.NewReader(body)
	}
	req, err := http.NewRequestWithContext(ctx, method, endpoint, requestBody)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "Harbor-Console/"+buildinfo.Version)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	for key, values := range headers {
		for _, value := range values {
			req.Header.Add(key, value)
		}
	}
	if current.Username != "" || current.Password != "" {
		req.SetBasicAuth(current.Username, current.Password)
	}

	client := current.Client
	if client == nil {
		client = a.newClient(current.SkipTLSVerify)
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()
	responseBody, err := io.ReadAll(io.LimitReader(resp.Body, maxReplyBytes+1))
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}
	if len(responseBody) > maxReplyBytes {
		return nil, errors.New("Harbor response exceeds the configured limit")
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		message := strings.TrimSpace(http.StatusText(resp.StatusCode))
		var harborErr struct {
			Errors []struct {
				Message string `json:"message"`
			} `json:"errors"`
		}
		if json.Unmarshal(responseBody, &harborErr) == nil && len(harborErr.Errors) > 0 && harborErr.Errors[0].Message != "" {
			message = harborErr.Errors[0].Message
		}
		return nil, &upstreamError{StatusCode: resp.StatusCode, Message: message}
	}
	return &harborResponse{StatusCode: resp.StatusCode, Header: resp.Header.Clone(), Body: responseBody}, nil
}

func newHarborClient(skipTLSVerify bool) *http.Client {
	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.TLSClientConfig = &tls.Config{MinVersion: tls.VersionTLS12, InsecureSkipVerify: skipTLSVerify} //nolint:gosec -- explicitly selected per Harbor connection
	return &http.Client{
		Timeout:   harborRequestTimeout,
		Transport: transport,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 3 {
				return errors.New("too many redirects")
			}
			if req.URL.Host != via[0].URL.Host || req.URL.Scheme != via[0].URL.Scheme {
				return errors.New("cross-origin redirect refused")
			}
			return nil
		},
	}
}
