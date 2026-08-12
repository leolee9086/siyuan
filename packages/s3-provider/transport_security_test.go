package s3provider

import (
	"context"
	"errors"
	"net/http"
	"net/url"
	"testing"

	externalprovider "github.com/siyuan-note/siyuan/packages/external-provider-contract"
)

func TestSessionTransportPolicyRunsBeforeCredentialsAndStore(t *testing.T) {
	tests := []struct {
		name            string
		endpoint        string
		confirmed       bool
		configuredAllow bool
		want            error
		wantStoreAllow  bool
	}{
		{name: "unconfirmed private HTTP", endpoint: "http://127.0.0.1:9000", want: externalprovider.ErrInsecureTransportNotConfirmed},
		{name: "confirmed public HTTP", endpoint: "http://8.8.8.8:9000", confirmed: true, want: externalprovider.ErrInsecureTransportHostNotPrivate},
		{name: "configured allow still rejects public HTTP", endpoint: "http://8.8.8.8:9000", configuredAllow: true, want: externalprovider.ErrInsecureTransportHostNotPrivate},
		{name: "confirmed private HTTP", endpoint: "http://10.0.0.20:9000", confirmed: true, wantStoreAllow: true},
		{name: "HTTPS needs no confirmation", endpoint: "https://s3.example.test"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			resolverCalls := 0
			factoryCalls := 0
			storeAllow := false
			provider, err := NewProviderWithFactory(Config{
				Bucket:            "bucket-one",
				AllowInsecureHTTP: test.configuredAllow,
				ResolveCredential: func(context.Context, string) (Credentials, error) {
					resolverCalls++
					return Credentials{AccessKey: "access", SecretKey: "secret"}, nil
				},
			}, func(_ context.Context, _ string, _ Credentials, config Config) (ObjectStore, error) {
				factoryCalls++
				storeAllow = config.AllowInsecureHTTP
				return newFakeStore(), nil
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
				if resolverCalls != 0 || factoryCalls != 0 {
					t.Fatalf("rejected transport touched credentials or store: resolver=%d factory=%d", resolverCalls, factoryCalls)
				}
				return
			}
			if err != nil {
				t.Fatal(err)
			}
			if resolverCalls != 1 || factoryCalls != 1 || storeAllow != test.wantStoreAllow {
				t.Fatalf("accepted transport chain mismatch: resolver=%d factory=%d allow=%t", resolverCalls, factoryCalls, storeAllow)
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
	client := safeHTTPClient(nil)
	if err := client.CheckRedirect(
		request("http://s3.example.test:9000/object"),
		[]*http.Request{request("https://s3.example.test:9000/object")},
	); !errors.Is(err, externalprovider.ErrInsecureTransportRedirect) {
		t.Fatalf("HTTPS downgrade redirect was accepted: %v", err)
	}
	if err := client.CheckRedirect(
		request("https://other.example.test/object"),
		[]*http.Request{request("https://s3.example.test/object")},
	); !errors.Is(err, externalprovider.ErrInsecureTransportRedirect) {
		t.Fatalf("cross-host credential redirect was accepted: %v", err)
	}
}
