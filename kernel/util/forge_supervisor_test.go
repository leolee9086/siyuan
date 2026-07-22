package util

import (
	"os"
	"testing"
)

func TestForgeSupervisorConnectionRequiresForgeAndLoopback(t *testing.T) {
	previousMode := Mode
	previousURL := os.Getenv(ForgeSupervisorURLEnv)
	previousToken := os.Getenv(ForgeSupervisorTokenEnv)
	t.Cleanup(func() {
		Mode = previousMode
		_ = os.Setenv(ForgeSupervisorURLEnv, previousURL)
		_ = os.Setenv(ForgeSupervisorTokenEnv, previousToken)
	})

	Mode = ModeProd
	_ = os.Setenv(ForgeSupervisorURLEnv, "http://127.0.0.1:1234")
	_ = os.Setenv(ForgeSupervisorTokenEnv, "token")
	if _, _, ok := ForgeSupervisorConnection(); ok {
		t.Fatal("supervisor connection exposed outside forge mode")
	}

	Mode = ModeForge
	_ = os.Setenv(ForgeSupervisorURLEnv, "http://example.com:1234")
	if _, _, ok := ForgeSupervisorConnection(); ok {
		t.Fatal("non-loopback supervisor URL accepted")
	}

	_ = os.Setenv(ForgeSupervisorURLEnv, "http://127.0.0.1:1234")
	controlURL, token, ok := ForgeSupervisorConnection()
	if !ok || controlURL != "http://127.0.0.1:1234" || token != "token" {
		t.Fatalf("unexpected supervisor connection: url=%q token=%q ok=%v", controlURL, token, ok)
	}
}

func TestIsForgeSupervisorRequestRequiresLoopbackAndExactToken(t *testing.T) {
	previousMode := Mode
	previousToken := os.Getenv(ForgeSupervisorTokenEnv)
	t.Cleanup(func() {
		Mode = previousMode
		_ = os.Setenv(ForgeSupervisorTokenEnv, previousToken)
	})
	Mode = ModeForge
	_ = os.Setenv(ForgeSupervisorTokenEnv, "exact-token")

	if !IsForgeSupervisorRequest("127.0.0.1:4321", "exact-token") {
		t.Fatal("valid loopback supervisor request rejected")
	}
	if IsForgeSupervisorRequest("192.0.2.10:4321", "exact-token") {
		t.Fatal("non-loopback supervisor request accepted")
	}
	if IsForgeSupervisorRequest("127.0.0.1:4321", "wrong-token") {
		t.Fatal("invalid supervisor token accepted")
	}
}
