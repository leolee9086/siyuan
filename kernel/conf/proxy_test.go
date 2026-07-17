package conf

import "testing"

func TestEffectiveProxyURLUsesSystemPriority(t *testing.T) {
	system := &System{
		NetworkProxy:     &NetworkProxy{Scheme: "http", Host: "manual.proxy", Port: "8080"},
		AutoDetectProxy:  true,
		DetectedProxyURL: "http://detected.proxy:7890",
	}

	if got := EffectiveProxyURL(system); got != "http://manual.proxy:8080" {
		t.Fatalf("manual proxy=%q, want manual proxy", got)
	}

	system.NetworkProxy = &NetworkProxy{}
	if got := EffectiveProxyURL(system); got != "http://detected.proxy:7890" {
		t.Fatalf("detected proxy=%q, want detected proxy", got)
	}

	system.AutoDetectProxy = false
	if got := EffectiveProxyURL(system); got != "" {
		t.Fatalf("disabled auto-detect proxy=%q, want direct", got)
	}
}

func TestEffectiveProxyURLWithOverrideInheritsWhenEmpty(t *testing.T) {
	system := &System{
		NetworkProxy:    &NetworkProxy{Scheme: "http", Host: "system.proxy", Port: "8080"},
		AutoDetectProxy: false,
	}

	if got := EffectiveProxyURLWithOverride(system, " "); got != "http://system.proxy:8080" {
		t.Fatalf("empty override=%q, want system proxy", got)
	}
	if got := EffectiveProxyURLWithOverride(system, "http://component.proxy:9000"); got != "http://component.proxy:9000" {
		t.Fatalf("component override=%q, want component proxy", got)
	}
	if got := EffectiveProxyURLWithOverride(nil, ""); got != "" {
		t.Fatalf("nil system=%q, want direct", got)
	}
}

func TestAIProxyInheritsSystemUnlessOverridden(t *testing.T) {
	system := &System{
		NetworkProxy: &NetworkProxy{Scheme: "http", Host: "system.proxy", Port: "8080"},
	}
	ai := &AI{OpenAI: &OpenAI{}}
	if got := ai.EffectiveAPIProxy(system); got != "http://system.proxy:8080" {
		t.Fatalf("inherited AI proxy=%q, want system proxy", got)
	}
	ai.OpenAI.APIProxy = "http://ai.proxy:9000"
	if got := ai.EffectiveAPIProxy(system); got != "http://ai.proxy:9000" {
		t.Fatalf("AI override=%q, want AI proxy", got)
	}
}
