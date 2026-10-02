package app

import (
	"context"
	"errors"
	"net/http"
	"strconv"
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

func writeUpstreamError(w http.ResponseWriter, err error) {
	status := http.StatusBadGateway
	if errors.Is(err, context.DeadlineExceeded) {
		status = http.StatusGatewayTimeout
	}
	if _, ok := errors.AsType[*writeConfirmationError](err); ok {
		writeError(w, status, "Harbor 已接受写入，最终状态未确认", friendlyUpstreamError(err))
		return
	}
	if upstream, ok := errors.AsType[*upstreamError](err); ok {
		switch upstream.StatusCode {
		case http.StatusBadRequest, http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound,
			http.StatusMethodNotAllowed, http.StatusConflict, http.StatusPreconditionFailed,
			http.StatusUnprocessableEntity, http.StatusTooManyRequests:
			status = upstream.StatusCode
		}
	}
	writeError(w, status, "Harbor 请求失败", friendlyUpstreamError(err))
}

func friendlyUpstreamError(err error) string {
	if confirmation, ok := errors.AsType[*writeConfirmationError](err); ok {
		reason := friendlyUpstreamError(confirmation.err)
		switch {
		case errors.Is(confirmation.err, context.DeadlineExceeded):
			reason = "确认请求超时"
		case errors.Is(confirmation.err, context.Canceled):
			reason = "确认请求已取消"
		}
		return "请先刷新回读确认，再决定是否重试。确认失败原因：" + reason
	}
	if errors.Is(err, context.DeadlineExceeded) {
		return "Harbor 请求超时，请稍后重试"
	}
	if errors.Is(err, context.Canceled) {
		return "Harbor 请求已取消"
	}
	if upstream, ok := errors.AsType[*upstreamError](err); ok {
		switch upstream.StatusCode {
		case http.StatusUnauthorized:
			return "用户名或密码无效"
		case http.StatusForbidden:
			return "当前 Harbor 账号没有访问该资源的权限"
		case http.StatusNotFound:
			return "Harbor 未找到请求的资源"
		case http.StatusBadRequest:
			return "请求不符合 Harbor API 要求：" + upstream.Message
		case http.StatusMethodNotAllowed:
			return "当前 Harbor 版本或资源状态不允许该操作"
		case http.StatusConflict:
			return "资源已存在或当前状态发生冲突：" + upstream.Message
		case http.StatusPreconditionFailed:
			return "资源当前不可删除或前置条件未满足：" + upstream.Message
		case http.StatusUnprocessableEntity:
			return "Harbor 无法处理该操作：" + upstream.Message
		case http.StatusTooManyRequests:
			return "Harbor 请求过于频繁，请稍后重试"
		default:
			return "Harbor 返回 " + strconv.Itoa(upstream.StatusCode) + ": " + upstream.Message
		}
	}
	message := err.Error()
	switch {
	case strings.Contains(message, "invalid JSON"):
		return "Harbor 返回的数据格式无效"
	case strings.Contains(message, "too many redirects"):
		return "Harbor 地址发生了过多重定向"
	case strings.Contains(message, "cross-origin redirect refused"):
		return "Harbor 将请求重定向到其他域名或协议，已为保护凭据而拒绝"
	case strings.Contains(message, "certificate"):
		return "Harbor 证书验证失败；请检查证书，或仅在可信内网启用自签名证书选项"
	case strings.Contains(message, "request failed"):
		return "无法访问 Harbor 实例，请检查地址、网络和端口"
	case strings.Contains(message, "read response"):
		return "读取 Harbor 响应失败，请稍后重试"
	default:
		return "Harbor 连接出现未知错误，请检查实例状态后重试"
	}
}
