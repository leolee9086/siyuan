package util

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCallForgeSupervisorUsesOnlyInjectedLoopbackControlPlane(t *testing.T) {
	previousMode := Mode
	t.Cleanup(func() {
		Mode = previousMode
	})
	Mode = ModeForge
	const token = "forge-supervisor-test-token"
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.Method != http.MethodPost || request.URL.Path != "/restart" {
			t.Fatalf("unexpected request: %s %s", request.Method, request.URL.Path)
		}
		if got := request.Header.Get(ForgeSupervisorTokenHeader); got != token {
			t.Fatalf("Supervisor token = %q", got)
		}
		data, err := io.ReadAll(request.Body)
		if err != nil {
			t.Fatal(err)
		}
		if string(data) != `{"reason":"verified"}` {
			t.Fatalf("request body = %s", data)
		}
		writer.Header().Set("Content-Type", "application/json")
		writer.WriteHeader(http.StatusAccepted)
		_, _ = writer.Write([]byte(`{"job":{"id":"job-1","state":"queued"}}`))
	}))
	t.Cleanup(server.Close)
	t.Setenv(ForgeSupervisorURLEnv, server.URL)
	t.Setenv(ForgeSupervisorTokenEnv, token)

	payload, err := CallForgeSupervisor(http.MethodPost, "/restart", map[string]string{"reason": "verified"})
	if err != nil {
		t.Fatal(err)
	}
	if !json.Valid(payload) || string(payload) != `{"job":{"id":"job-1","state":"queued"}}` {
		t.Fatalf("unexpected response: %s", payload)
	}
}
func TestCallForgeSupervisorRejectsInvalidEndpointsAndResponses(t *testing.T) {
	previousMode := Mode
	t.Cleanup(func() {
		Mode = previousMode
	})
	Mode = ModeForge
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		switch request.URL.Path {
		case "/conflict":
			writer.WriteHeader(http.StatusConflict)
			_, _ = writer.Write([]byte(`{"error":"job mismatch"}`))
		case "/invalid-json":
			_, _ = writer.Write([]byte("not-json"))
		default:
			writer.WriteHeader(http.StatusNotFound)
			_, _ = writer.Write([]byte(`{"error":"not found"}`))
		}
	}))
	t.Cleanup(server.Close)
	t.Setenv(ForgeSupervisorURLEnv, server.URL)
	t.Setenv(ForgeSupervisorTokenEnv, "forge-supervisor-test-token")

	if _, err := CallForgeSupervisor(http.MethodGet, "relative", nil); err == nil {
		t.Fatal("relative endpoint was accepted")
	}
	if _, err := CallForgeSupervisor(http.MethodGet, "/status?token=leak", nil); err == nil {
		t.Fatal("endpoint with a query was accepted")
	}
	_, err := CallForgeSupervisor(http.MethodGet, "/conflict", nil)
	var responseError *ForgeSupervisorHTTPError
	if !errors.As(err, &responseError) || responseError.StatusCode != http.StatusConflict ||
		string(responseError.Payload) != `{"error":"job mismatch"}` {
		t.Fatalf("unexpected HTTP error: %#v", err)
	}
	if _, err := CallForgeSupervisor(http.MethodGet, "/invalid-json", nil); err == nil {
		t.Fatal("invalid JSON response was accepted")
	}
}
