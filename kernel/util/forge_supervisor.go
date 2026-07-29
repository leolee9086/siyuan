// SiYuan - Refactor your thinking
// Copyright (c) 2020-present, b3log.org
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

package util

import (
	"bytes"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

const (
	ForgeSupervisorURLEnv      = "S_FORGE_SUPERVISOR_URL"
	ForgeSupervisorTokenEnv    = "S_FORGE_SUPERVISOR_TOKEN"
	ForgeSupervisorRootEnv     = "S_FORGE_SOURCE_ROOT"
	ForgeSupervisorTokenHeader = "X-S-Forge-Supervisor-Token"
	forgeSupervisorMaxResponse = 2 * 1024 * 1024
)

var forgeSupervisorHTTPClient = &http.Client{Timeout: 10 * time.Second}

// ForgeSupervisorHTTPError 保留 Supervisor 的 HTTP 状态与已经校验过的 JSON 响应。
type ForgeSupervisorHTTPError struct {
	StatusCode int
	Payload    json.RawMessage
}

func (err *ForgeSupervisorHTTPError) Error() string {
	return fmt.Sprintf("Forge Supervisor 请求失败 [HTTP %d]: %s", err.StatusCode, strings.TrimSpace(string(err.Payload)))
}

// ForgeSupervisorConnection 返回由源码启动器注入的本地控制面连接。
func ForgeSupervisorConnection() (controlURL, token string, ok bool) {
	if !IsForgeMode() {
		return "", "", false
	}
	controlURL = strings.TrimSpace(os.Getenv(ForgeSupervisorURLEnv))
	token = strings.TrimSpace(os.Getenv(ForgeSupervisorTokenEnv))
	if controlURL == "" || token == "" {
		return "", "", false
	}
	parsed, err := url.Parse(controlURL)
	if err != nil || parsed.Scheme != "http" || parsed.Hostname() == "" || !isLoopbackHost(parsed.Hostname()) {
		return "", "", false
	}
	return strings.TrimRight(controlURL, "/"), token, true
}

// CallForgeSupervisor 使用当前 Kernel 进程持有的内部连接调用本地 Supervisor。
// 调用方只能选择固定端点，控制地址和令牌不会进入公开 API 请求或响应。
func CallForgeSupervisor(method, endpoint string, body any) (json.RawMessage, error) {
	controlURL, token, ok := ForgeSupervisorConnection()
	if !ok {
		return nil, errors.New("Forge Supervisor 控制面未连接")
	}
	if !strings.HasPrefix(endpoint, "/") || strings.Contains(endpoint, "?") || strings.Contains(endpoint, "#") {
		return nil, errors.New("无效的 Forge Supervisor 端点")
	}
	var requestBody io.Reader
	if body != nil {
		encoded, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("编码 Supervisor 请求失败: %w", err)
		}
		requestBody = bytes.NewReader(encoded)
	}
	request, err := http.NewRequest(method, controlURL+endpoint, requestBody)
	if err != nil {
		return nil, fmt.Errorf("创建 Supervisor 请求失败: %w", err)
	}
	request.Header.Set(ForgeSupervisorTokenHeader, token)
	if body != nil {
		request.Header.Set("Content-Type", "application/json")
	}
	response, err := forgeSupervisorHTTPClient.Do(request)
	if err != nil {
		return nil, fmt.Errorf("连接 Forge Supervisor 失败: %w", err)
	}
	defer response.Body.Close()
	payload, err := io.ReadAll(io.LimitReader(response.Body, forgeSupervisorMaxResponse+1))
	if err != nil {
		return nil, fmt.Errorf("读取 Supervisor 响应失败: %w", err)
	}
	if len(payload) > forgeSupervisorMaxResponse {
		return nil, errors.New("Forge Supervisor 响应超过大小限制")
	}
	if !json.Valid(payload) {
		return nil, errors.New("Forge Supervisor 返回无效 JSON")
	}
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return nil, &ForgeSupervisorHTTPError{StatusCode: response.StatusCode, Payload: json.RawMessage(payload)}
	}
	return json.RawMessage(payload), nil
}

// IsForgeSupervisorRequest 校验控制请求仅来自回环地址且携带当前进程令牌。
func IsForgeSupervisorRequest(remoteAddr, providedToken string) bool {
	if !IsForgeMode() || !isLoopbackRemoteAddr(remoteAddr) {
		return false
	}
	expected := strings.TrimSpace(os.Getenv(ForgeSupervisorTokenEnv))
	providedToken = strings.TrimSpace(providedToken)
	if expected == "" || len(expected) != len(providedToken) {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(expected), []byte(providedToken)) == 1
}

func isLoopbackRemoteAddr(remoteAddr string) bool {
	host, _, err := net.SplitHostPort(strings.TrimSpace(remoteAddr))
	if err != nil {
		return false
	}
	return isLoopbackHost(host)
}

func isLoopbackHost(host string) bool {
	ip := net.ParseIP(strings.Trim(host, "[]"))
	return ip != nil && ip.IsLoopback()
}
