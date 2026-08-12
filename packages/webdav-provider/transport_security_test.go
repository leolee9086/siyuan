package webdavprovider

import (
	"context"
	"errors"
	"net/http"
	"net/url"
	"testing"

	externalprovider "github.com/siyuan-note/siyuan/packages/external-provider-contract"
)

func TestSessionTransportPolicyRunsBeforeCredentialsAndClient(t *testing.T) {
	tests := []struct {
		name            string
		endpoint        string
		confirmed       bool
		configuredAllow bool
		want            error
	}{
		{name: "unconfirmed private HTTP", endpoint: "http://127.0.0.1:8080/dav", want: externalprovider.ErrInsecureTransportNotConfirmed},
		{name: "confirmed public HTTP", endpoint: "http://8.8.8.8:8080/dav", confirmed: true, want: externalprovider.ErrInsecureTransportHostNotPrivate},
		{name: "configured allow still rejects public HTTP", endpoint: "http://8.8.8.8:8080/dav", configuredAllow: true, want: externalprovider.ErrInsecureTransportHostNotPrivate},
		{name: "confirmed private HTTP", endpoint: "http://172.16.1.20:8080/dav", confirmed: true},
		{name: "HTTPS needs no confirmation", endpoint: "https://dav.example.test"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			resolverCalls := 0
			factoryCalls := 0
			provider := NewProviderWithOptions(Options{
				AllowInsecureHTTP: test.configuredAllow,
				ResolveCredential: func(context.Context, string) (Credentials, error) {
					resolverCalls++
					return Credentials{Username: "tester", Password: "secret"}, nil
				},
				ClientFactory: func(*http.Client, string, Credentials) (Client, error) {
					factoryCalls++
					return newFakeDAV(), nil
				},
			})
			session, err := provider.OpenSession(context.Background(), externalprovider.SessionRequest{
				Endpoint: test.endpoint, CredentialRef: "credential", InsecureHTTPConfirmed: test.confirmed,
			})
			if test.want != nil {
				if !errors.Is(err, test.want) {
					t.Fatalf("OpenSession() error = %v, want %v", err, test.want)
				}
				if resolverCalls != 0 || factoryCalls != 0 {
					t.Fatalf("rejected transport touched credentials or client: resolver=%d factory=%d", resolverCalls, factoryCalls)
				}
				return
			}
			if err != nil {
				t.Fatal(err)
			}
			if resolverCalls != 1 || factoryCalls != 1 {
				t.Fatalf("accepted transport did not establish the provider chain: resolver=%d factory=%d", resolverCalls, factoryCalls)
			}
			if err = session.Close(); err != nil {
				t.Fatal(err)
			}
		})
	}
}

func TestHTTPClientRejectsCredentialRedirectBoundaries(t *testing.T) {
	request := func(rawURL string) *http.Request {
		parsed, err := url.Parse(rawURL)
		if err != nil {
			t.Fatal(err)
		}
		return &http.Request{URL: parsed}
	}
	client := safeHTTPClient(http.DefaultClient)
	for _, target := range []string{
		"http://dav.example.test:8443/files",
		"https://other.example.test:8443/files",
	} {
		err := client.CheckRedirect(
			request(target),
			[]*http.Request{request("https://dav.example.test:8443/files")},
		)
		if !errors.Is(err, externalprovider.ErrInsecureTransportRedirect) {
			t.Fatalf("credential redirect to %q was accepted: %v", target, err)
		}
	}
}
