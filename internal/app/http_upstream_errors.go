package app

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
)

func writeUpstreamError(w http.ResponseWriter, err error) {
	status := http.StatusBadGateway
	var upstream *upstreamError
	if errors.As(err, &upstream) {
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
	var upstream *upstreamError
	if errors.As(err, &upstream) {
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
