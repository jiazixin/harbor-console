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
)

const (
	harborRequestTimeout = 18 * time.Second
	maxHarborConnections = 16
)

// harborGetJSON reads a Harbor resource and decodes its JSON body into out.
func (a *app) harborGetJSON(ctx context.Context, options harborJSONRequest) error {
	current, path, query, out := options.current, options.path, options.query, options.out
	response, err := a.harborRequest(ctx, harborRequestOptions{current: current, method: http.MethodGet, path: path, query: query, body: nil, headers: nil})
	if err != nil {
		return err
	}
	if len(response.Body) == 0 || out == nil {
		return nil
	}
	if err := json.Unmarshal(response.Body, out); err != nil {
		return fmt.Errorf("decode Harbor response: %w", err)
	}
	return nil
}

type harborResponse struct {
	StatusCode int
	Header     http.Header
	Body       []byte
}

func (a *app) harborRequest(ctx context.Context, options harborRequestOptions) (*harborResponse, error) {
	current, method, path, query, body, headers := options.current, options.method, options.path, options.query, options.body, options.headers
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
	req.Header.Set("User-Agent", "Harbor-Console/"+a.version())
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
	// The response is read to EOF below; closing releases transport resources.
	defer resp.Body.Close()
	responseBody, err := io.ReadAll(io.LimitReader(resp.Body, maxReplyBytes+1))
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}
	if len(responseBody) > maxReplyBytes {
		return nil, errors.New("response from Harbor exceeds the configured limit")
	}
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
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
	transport.MaxConnsPerHost = maxHarborConnections
	// Skipping verification is an explicit per-connection choice for Harbor
	// instances with self-signed certificates.
	transport.TLSClientConfig = &tls.Config{MinVersion: tls.VersionTLS12, InsecureSkipVerify: skipTLSVerify}
	return &http.Client{
		Timeout:   harborRequestTimeout,
		Transport: transport,
		CheckRedirect: func(_ *http.Request, _ []*http.Request) error {
			// Credentials must never be forwarded, even to another path on this host.
			return http.ErrUseLastResponse
		},
	}
}

type harborJSONRequest struct {
	current *session
	path    string
	query   url.Values
	out     any
}
type harborRequestOptions struct {
	current *session
	method  string
	path    string
	query   url.Values
	body    []byte
	headers http.Header
}
