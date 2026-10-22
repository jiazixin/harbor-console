package app

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"
)

func (a *app) handleConnect(w http.ResponseWriter, r *http.Request) {
	if !sameOrigin(r) {
		writeError(w, http.StatusForbidden, "请求来源无效", "请从当前控制台提交连接请求")
		return
	}
	if !a.loginLimits.allow(clientIP(r)) {
		writeError(w, http.StatusTooManyRequests, "连接尝试过于频繁", "请等待一分钟后重试")
		return
	}
	var input connectRequest
	if err := decodeJSON(w, r, &input); err != nil {
		writeError(w, http.StatusBadRequest, "连接信息无效", err.Error())
		return
	}
	candidate, status, err := a.prepareConnection(r.Context(), input)
	if err != nil {
		writeError(w, status, "无法连接 Harbor", err.Error())
		return
	}
	if err := a.sessions.create(candidate); err != nil {
		closeSessionClient(candidate)
		writeError(w, http.StatusInternalServerError, "无法创建会话", "随机会话标识生成失败")
		return
	}
	if previousID, ok := sessionIDFromRequest(r); ok {
		a.sessions.delete(previousID)
	}
	a.setSessionCookie(w, r, candidate.ID)
	writeJSON(w, http.StatusOK, sessionInfo(candidate))
}

func (a *app) prepareConnection(ctx context.Context, input connectRequest) (*session, int, error) {
	instanceURL, err := validateHarborURL(input.URL)
	if err != nil {
		return nil, http.StatusBadRequest, err
	}
	if strings.TrimSpace(input.Username) == "" || input.Password == "" {
		return nil, http.StatusBadRequest, errors.New("请输入 Harbor 用户名和密码")
	}
	if len(input.URL) > 2048 || len(input.Username) > 256 || len(input.Password) > 4096 {
		return nil, http.StatusBadRequest, errors.New("请检查 Harbor 地址和登录信息，字段长度超过限制")
	}
	candidate := &session{
		InstanceURL: instanceURL, Username: strings.TrimSpace(input.Username), Password: input.Password,
		SkipTLSVerify: input.SkipTLSVerify, Client: a.newClient(input.SkipTLSVerify),
	}
	// The projects endpoint permits anonymous access to public projects. Use the
	// protected current-user endpoint so a successful response proves the supplied
	// credentials are actually valid before creating or adding a session.
	var currentUser map[string]any
	if err := a.harborGetJSON(ctx, candidate, "/api/v2.0/users/current", nil, &currentUser); err != nil {
		closeSessionClient(candidate)
		status := http.StatusBadGateway
		if upstream, ok := errors.AsType[*upstreamError](err); ok && (upstream.StatusCode == http.StatusUnauthorized || upstream.StatusCode == http.StatusForbidden) {
			status = http.StatusUnauthorized
		}
		return nil, status, errors.New(friendlyUpstreamError(err))
	}
	return candidate, http.StatusOK, nil
}

func (a *app) handleDemo(w http.ResponseWriter, r *http.Request) {
	if !sameOrigin(r) {
		writeError(w, http.StatusForbidden, "请求来源无效", "请从当前控制台提交请求")
		return
	}
	if !a.loginLimits.allow(clientIP(r)) {
		writeError(w, http.StatusTooManyRequests, "请求过于频繁", "请等待一分钟后重试")
		return
	}
	demo := &session{InstanceURL: "https://harbor.demo.local", Username: "demo-admin", Demo: true, DemoData: newDemoState()}
	if err := a.sessions.create(demo); err != nil {
		writeError(w, http.StatusInternalServerError, "无法创建演示会话", "随机会话标识生成失败")
		return
	}
	if previousID, ok := sessionIDFromRequest(r); ok {
		a.sessions.delete(previousID)
	}
	a.setSessionCookie(w, r, demo.ID)
	writeJSON(w, http.StatusOK, sessionInfo(demo))
}

func (a *app) handleSession(w http.ResponseWriter, r *http.Request) {
	current, ok := a.currentSession(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "尚未连接 Harbor", "请先连接实例")
		return
	}
	writeJSON(w, http.StatusOK, sessionInfo(current))
}

func (a *app) handleInstances(w http.ResponseWriter, r *http.Request) {
	current, ok := a.currentSession(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "会话已失效", "请重新连接 Harbor")
		return
	}
	writeJSON(w, http.StatusOK, instancesInfo(current))
}

func (a *app) handleAddInstance(w http.ResponseWriter, r *http.Request) {
	if !sameOrigin(r) {
		writeError(w, http.StatusForbidden, "请求来源无效", "请从当前控制台提交连接请求")
		return
	}
	previous, ok := a.currentSession(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "会话已失效", "请重新连接 Harbor")
		return
	}
	if !a.loginLimits.allow(clientIP(r)) {
		writeError(w, http.StatusTooManyRequests, "连接尝试过于频繁", "请等待一分钟后重试")
		return
	}
	var input connectRequest
	if err := decodeJSON(w, r, &input); err != nil {
		writeError(w, http.StatusBadRequest, "连接信息无效", err.Error())
		return
	}
	candidate, status, err := a.prepareConnection(r.Context(), input)
	if err != nil {
		writeError(w, status, "无法连接 Harbor", err.Error())
		return
	}
	current, err := a.sessions.addInstance(previous.ID, candidate)
	if err != nil {
		closeSessionClient(candidate)
		writeInstanceStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, sessionInfo(current))
}

func (a *app) handleAddDemoInstance(w http.ResponseWriter, r *http.Request) {
	if !sameOrigin(r) {
		writeError(w, http.StatusForbidden, "请求来源无效", "请从当前控制台提交请求")
		return
	}
	current, ok := a.currentSession(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "会话已失效", "请重新连接 Harbor")
		return
	}
	demo := &session{InstanceURL: nextDemoInstanceURL(current), Username: "demo-admin", Demo: true, DemoData: newDemoState()}
	current, err := a.sessions.addInstance(current.ID, demo)
	if err != nil {
		writeInstanceStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, sessionInfo(current))
}

func nextDemoInstanceURL(current *session) string {
	connected := make(map[string]bool, len(current.Instances))
	for _, instance := range current.Instances {
		connected[instance.InstanceURL] = true
	}
	for index := 2; ; index++ {
		candidate := fmt.Sprintf("https://harbor-demo-%d.local", index)
		if !connected[candidate] {
			return candidate
		}
	}
}

func (a *app) handleSwitchInstance(w http.ResponseWriter, r *http.Request) {
	if !sameOrigin(r) {
		writeError(w, http.StatusForbidden, "请求来源无效", "请从当前控制台提交请求")
		return
	}
	sessionID, ok := sessionIDFromRequest(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "会话已失效", "请重新连接 Harbor")
		return
	}
	var input struct {
		ID string `json:"id"`
	}
	if err := decodeJSON(w, r, &input); err != nil || len(input.ID) != 64 {
		writeError(w, http.StatusBadRequest, "实例标识无效", "请选择已有 Harbor 实例")
		return
	}
	current, err := a.sessions.switchInstance(sessionID, input.ID)
	if err != nil {
		writeInstanceStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, sessionInfo(current))
}

func (a *app) handleDeleteInstance(w http.ResponseWriter, r *http.Request) {
	if !sameOrigin(r) {
		writeError(w, http.StatusForbidden, "请求来源无效", "请从当前控制台提交请求")
		return
	}
	sessionID, ok := sessionIDFromRequest(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "会话已失效", "请重新连接 Harbor")
		return
	}
	connectionID := strings.TrimSpace(r.PathValue("id"))
	if len(connectionID) != 64 {
		writeError(w, http.StatusBadRequest, "实例标识无效", "请选择已有 Harbor 实例")
		return
	}
	current, err := a.sessions.removeInstance(sessionID, connectionID)
	if err != nil {
		writeInstanceStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, sessionInfo(current))
}

func writeInstanceStoreError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, errSessionNotFound):
		writeError(w, http.StatusUnauthorized, "会话已失效", "请重新连接 Harbor")
	case errors.Is(err, errInstanceNotFound):
		writeError(w, http.StatusNotFound, "实例不存在", "该 Harbor 连接可能已被移除")
	case errors.Is(err, errInstanceExists):
		writeError(w, http.StatusConflict, "实例已经连接", "同一地址和账号无需重复添加")
	case errors.Is(err, errInstanceLimit):
		writeError(w, http.StatusConflict, "实例数量已达上限", fmt.Sprintf("每个会话最多连接 %d 个实例", maxInstances))
	case errors.Is(err, errLastInstance):
		writeError(w, http.StatusConflict, "不能移除最后一个实例", "如需结束会话，请使用断开连接")
	default:
		writeError(w, http.StatusInternalServerError, "实例操作失败", "无法更新当前会话")
	}
}

func (a *app) handleLogout(w http.ResponseWriter, r *http.Request) {
	if !sameOrigin(r) {
		writeError(w, http.StatusForbidden, "请求来源无效", "请从当前控制台提交请求")
		return
	}
	if cookie, err := r.Cookie(sessionCookie); err == nil {
		a.sessions.delete(cookie.Value)
	}
	http.SetCookie(w, &http.Cookie{
		Name: sessionCookie, Value: "", Path: "/", HttpOnly: true,
		SameSite: http.SameSiteStrictMode, Secure: requestIsTLS(r), MaxAge: -1,
	})
	w.WriteHeader(http.StatusNoContent)
}
