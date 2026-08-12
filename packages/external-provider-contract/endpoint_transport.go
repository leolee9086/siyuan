package externalprovidercontract

import (
	"net"
	"net/http"
	"net/url"
	"strings"
)

// ValidateEndpointTransport 校验凭据型 provider 的传输边界。HTTPS 不需要确认；
// HTTP 必须同时得到显式确认，并使用无需 DNS 解析即可证明为私网的地址。
func ValidateEndpointTransport(endpoint *url.URL, insecureHTTPConfirmed bool) error {
	if endpoint == nil {
		return ErrInvalidRequest
	}
	switch strings.ToLower(endpoint.Scheme) {
	case "https":
		return nil
	case "http":
		if !insecureHTTPConfirmed {
			return ErrInsecureTransportNotConfirmed
		}
		if !isPrivateHTTPHost(endpoint.Hostname()) {
			return ErrInsecureTransportHostNotPrivate
		}
		return nil
	default:
		return ErrInvalidRequest
	}
}

// ValidateEndpointRedirect 防止认证请求通过重定向跨越主机边界或从 TLS
// 降级到明文 HTTP。调用方可在通过后继续执行自己已有的重定向策略。
func ValidateEndpointRedirect(request *http.Request, via []*http.Request) error {
	if request == nil || request.URL == nil {
		return ErrInvalidRequest
	}
	if len(via) == 0 {
		return nil
	}
	origin := via[0]
	if origin == nil || origin.URL == nil {
		return ErrInvalidRequest
	}
	if !strings.EqualFold(origin.URL.Host, request.URL.Host) ||
		(strings.EqualFold(origin.URL.Scheme, "https") && strings.EqualFold(request.URL.Scheme, "http")) {
		return ErrInsecureTransportRedirect
	}
	return nil
}

func isPrivateHTTPHost(host string) bool {
	if strings.EqualFold(host, "localhost") {
		return true
	}
	if zone := strings.LastIndexByte(host, '%'); zone > 0 && strings.Contains(host[:zone], ":") {
		host = host[:zone]
	}
	ip := net.ParseIP(host)
	return ip != nil && !ip.IsUnspecified() &&
		(ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast())
}
