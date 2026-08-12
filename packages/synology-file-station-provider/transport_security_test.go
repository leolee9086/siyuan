package synologyfilestation

import (
	"context"
	"errors"
	"net/http"
	"net/url"
	"testing"

	externalprovider "github.com/siyuan-note/siyuan/packages/external-provider-contract"
)

func TestSessionTransportPolicyRunsBeforeCredentialsClientAndLogin(t *testing.T) {
	tests := []struct {
		name            string
		endpoint        string
		confirmed       bool
		configuredAllow bool
		want            error
	}{
		{name: "unconfirmed private HTTP", endpoint: "http://127.0.0.1:5000", want: externalprovider.ErrInsecureTransportNotConfirmed},
		{name: "confirmed public HTTP", endpoint: "http://8.8.8.8:5000", confirmed: true, want: externalprovider.ErrInsecureTransportHostNotPrivate},
		{name: "configured allow still rejects public HTTP", endpoint: "http://8.8.8.8:5000", configuredAllow: true, want: externalprovider.ErrInsecureTransportHostNotPrivate},
		{name: "confirmed private HTTP", endpoint: "http://192.168.1.20:5000", confirmed: true},
		{name: "HTTPS needs no confirmation", endpoint: "https://nas.example.test"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			resolverCalls := 0
			factoryCalls := 0
			client := newFakeClient()
			provider, err := NewProviderWithFactory(Config{
				RootPath:          "/share",
				AllowInsecureHTTP: test.configuredAllow,
				ResolveCredential: func(context.Context, string) (Credentials, error) {
					resolverCalls++
					return Credentials{Account: "tester", Password: "secret"}, nil
				},
			}, func(*http.Client, string) (Client, error) {
				factoryCalls++
				return client, nil
			})
			if err != nil {
				t.Fatal(err)
			}
			session, err := provider.OpenSession(context.Background(), externalprovider.SessionRequest{
				Endpoint: test.endpoint, CredentialRef: "credential", InsecureHTTPConfirmed: test.confirmed,
			})
			if test.want != nil {
				if !errors.Is(err, test.want) {
					t.Fatalf("OpenSession() error = %v, want %v", err, test.want)
				}
				if resolverCalls != 0 || factoryCalls != 0 || client.loggedIn {
					t.Fatalf("rejected transport touched credentials or network: resolver=%d factory=%d login=%t", resolverCalls, factoryCalls, client.loggedIn)
				}
				return
			}
			if err != nil {
				t.Fatal(err)
			}
			if resolverCalls != 1 || factoryCalls != 1 || !client.loggedIn {
				t.Fatalf("accepted transport did not establish the real provider chain: resolver=%d factory=%d login=%t", resolverCalls, factoryCalls, client.loggedIn)
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
	clientValue, err := newHTTPClient(nil, "https://nas.example.test:5001")
	if err != nil {
		t.Fatal(err)
	}
	client := clientValue.(*httpClient).client
	for _, target := range []string{
		"http://nas.example.test:5001/webapi/auth.cgi",
		"https://other.example.test:5001/webapi/auth.cgi",
	} {
		err = client.CheckRedirect(
			request(target),
			[]*http.Request{request("https://nas.example.test:5001/webapi/auth.cgi")},
		)
		if !errors.Is(err, externalprovider.ErrInsecureTransportRedirect) {
			t.Fatalf("credential redirect to %q was accepted: %v", target, err)
		}
	}
}
