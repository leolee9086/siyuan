// SiYuan - Refactor your thinking
// Copyright (c) 2020-present, b3log.org
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

package util

import (
	"crypto/subtle"
	"net"
	"net/url"
	"os"
	"strings"
)

const (
	ForgeSupervisorURLEnv      = "S_FORGE_SUPERVISOR_URL"
	ForgeSupervisorTokenEnv    = "S_FORGE_SUPERVISOR_TOKEN"
	ForgeSupervisorRootEnv     = "S_FORGE_SOURCE_ROOT"
	ForgeSupervisorTokenHeader = "X-S-Forge-Supervisor-Token"
)

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
