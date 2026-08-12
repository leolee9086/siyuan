package externalprovidercontract

import (
	"errors"
	"net/http"
	"net/url"
	"testing"
)

func TestValidateEndpointTransport(t *testing.T) {
	tests := []struct {
		name      string
		endpoint  string
		confirmed bool
		want      error
	}{
		{name: "https public", endpoint: "https://storage.example.com"},
		{name: "http unconfirmed", endpoint: "http://127.0.0.1:9000", want: ErrInsecureTransportNotConfirmed},
		{name: "loopback", endpoint: "http://127.0.0.1:9000", confirmed: true},
		{name: "private ten", endpoint: "http://10.20.30.40", confirmed: true},
		{name: "private one seventy two", endpoint: "http://172.31.255.254", confirmed: true},
		{name: "private one ninety two", endpoint: "http://192.168.1.20", confirmed: true},
		{name: "link local", endpoint: "http://169.254.20.1", confirmed: true},
		{name: "localhost", endpoint: "http://localhost:5000", confirmed: true},
		{name: "ipv6 loopback", endpoint: "http://[::1]:5000", confirmed: true},
		{name: "ipv6 unique local", endpoint: "http://[fd00::10]", confirmed: true},
		{name: "ipv6 link local with zone", endpoint: "http://[fe80::1%25Ethernet]", confirmed: true},
		{name: "public ipv4", endpoint: "http://8.8.8.8", confirmed: true, want: ErrInsecureTransportHostNotPrivate},
		{name: "public hostname", endpoint: "http://storage.example.com", confirmed: true, want: ErrInsecureTransportHostNotPrivate},
		{name: "unspecified ipv4", endpoint: "http://0.0.0.0", confirmed: true, want: ErrInsecureTransportHostNotPrivate},
		{name: "unspecified ipv6", endpoint: "http://[::]", confirmed: true, want: ErrInsecureTransportHostNotPrivate},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			endpoint, err := url.Parse(test.endpoint)
			if err != nil {
				t.Fatal(err)
			}
			err = ValidateEndpointTransport(endpoint, test.confirmed)
			if !errors.Is(err, test.want) || (test.want == nil && err != nil) {
				t.Fatalf("ValidateEndpointTransport(%q, %t) = %v, want %v", test.endpoint, test.confirmed, err, test.want)
			}
		})
	}
}

func TestValidateEndpointRedirect(t *testing.T) {
	request := func(rawURL string) *http.Request {
		parsed, err := url.Parse(rawURL)
		if err != nil {
			t.Fatal(err)
		}
		return &http.Request{URL: parsed}
	}
	tests := []struct {
		name   string
		origin string
		target string
		want   error
	}{
		{name: "same HTTPS origin", origin: "https://storage.example.test:8443/start", target: "https://storage.example.test:8443/next"},
		{name: "same confirmed HTTP origin", origin: "http://192.168.1.20:8080/start", target: "http://192.168.1.20:8080/next"},
		{name: "upgrade", origin: "http://storage.example.test:8443/start", target: "https://storage.example.test:8443/next"},
		{name: "cross host", origin: "https://storage.example.test/start", target: "https://other.example.test/next", want: ErrInsecureTransportRedirect},
		{name: "cross port", origin: "https://storage.example.test:8443/start", target: "https://storage.example.test:9443/next", want: ErrInsecureTransportRedirect},
		{name: "TLS downgrade", origin: "https://storage.example.test:8443/start", target: "http://storage.example.test:8443/next", want: ErrInsecureTransportRedirect},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			err := ValidateEndpointRedirect(request(test.target), []*http.Request{request(test.origin)})
			if !errors.Is(err, test.want) || (test.want == nil && err != nil) {
				t.Fatalf("ValidateEndpointRedirect(%q, %q) = %v, want %v", test.origin, test.target, err, test.want)
			}
		})
	}
}
