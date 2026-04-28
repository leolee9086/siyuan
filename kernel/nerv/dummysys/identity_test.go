package dummysys

import (
	"strings"
	"testing"
)

func TestResolveAvatarModel(t *testing.T) {
	tests := []struct {
		id       AvatarModelID
		wantName string
		wantOK   bool
	}{
		{AvatarModelZHI, "织", true},
		{AvatarModelREI, "丽", true},
		{AvatarModelKAORU, "薰", true},
		{"INVALID", "", false},
		{"", "", false},
	}

	for _, tt := range tests {
		t.Run(string(tt.id), func(t *testing.T) {
			model, ok := ResolveAvatarModel(tt.id)
			if ok != tt.wantOK {
				t.Errorf("ResolveAvatarModel(%q) ok=%v, want %v", tt.id, ok, tt.wantOK)
			}
			if ok && model.Name != tt.wantName {
				t.Errorf("model.Name = %q, want %q", model.Name, tt.wantName)
			}
		})
	}
}

func TestIsValidAvatarModelID(t *testing.T) {
	if !IsValidAvatarModelID(AvatarModelZHI) {
		t.Error("ZHI-01 should be valid")
	}
	if !IsValidAvatarModelID(AvatarModelREI) {
		t.Error("REI-01 should be valid")
	}
	if !IsValidAvatarModelID(AvatarModelKAORU) {
		t.Error("KAORU-02 should be valid")
	}
	if IsValidAvatarModelID("FAKE-99") {
		t.Error("FAKE-99 should be invalid")
	}
}

func TestAvatarModelData(t *testing.T) {
	if ModelZHI.Name != "织" {
		t.Errorf("ModelZHI.Name = %q, want 织", ModelZHI.Name)
	}
	if ModelZHI.Archetype != "妹妹" {
		t.Errorf("ModelZHI.Archetype = %q, want 妹妹", ModelZHI.Archetype)
	}
	if len(ModelZHI.Traits) == 0 {
		t.Error("ModelZHI.Traits should not be empty")
	}

	if ModelREI.Name != "丽" {
		t.Errorf("ModelREI.Name = %q, want 丽", ModelREI.Name)
	}
	if ModelREI.Archetype != "人造人" {
		t.Errorf("ModelREI.Archetype = %q, want 人造人", ModelREI.Archetype)
	}

	if ModelKAORU.Name != "薰" {
		t.Errorf("ModelKAORU.Name = %q, want 薰", ModelKAORU.Name)
	}
	if ModelKAORU.Archetype != "使徒" {
		t.Errorf("ModelKAORU.Archetype = %q, want 使徒", ModelKAORU.Archetype)
	}
}

func TestBuildIdentityPrompt_ContainsIdentityAnchor(t *testing.T) {
	identity := AvatarIdentity{
		ModelID:  AvatarModelZHI,
		Instance: 3,
		Channel:  AvatarChannelGuardian,
	}

	prompt := identity.BuildIdentityPrompt()
	if prompt == "" {
		t.Fatal("identity prompt should not be empty")
	}

	checks := []struct {
		keyword string
		reason  string
	}{
		{"身份锚定", "should contain identity anchor header"},
		{"织", "should contain persona name"},
		{"ZHI-01", "should contain model ID"},
		{"第 3 号化身", "should contain instance number"},
		{"Guardian", "should contain channel name"},
		{"不可变更", "should indicate non-overridable"},
		{"不可覆盖", "should state override constraint"},
		{"不可否认", "should state undeniable constraint"},
	}

	for _, c := range checks {
		if !strings.Contains(prompt, c.keyword) {
			t.Errorf("identity prompt %s: missing %q", c.reason, c.keyword)
		}
	}
}

func TestBuildIdentityPrompt_DifferentPersonas(t *testing.T) {
	tests := []struct {
		name     string
		identity AvatarIdentity
		wantName string
		wantID   string
	}{
		{
			name: "织实例",
			identity: AvatarIdentity{
				ModelID: AvatarModelZHI, Instance: 1, Channel: AvatarChannelUnknown,
			},
			wantName: "织", wantID: "ZHI-01",
		},
		{
			name: "丽实例",
			identity: AvatarIdentity{
				ModelID: AvatarModelREI, Instance: 2, Channel: AvatarChannelExternalAgent,
			},
			wantName: "丽", wantID: "REI-01",
		},
		{
			name: "薰实例",
			identity: AvatarIdentity{
				ModelID: AvatarModelKAORU, Instance: 5, Channel: AvatarChannelSystemCron,
			},
			wantName: "薰", wantID: "KAORU-02",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			prompt := tt.identity.BuildIdentityPrompt()
			if !strings.Contains(prompt, tt.wantName) {
				t.Errorf("prompt missing name %q: \n%s", tt.wantName, prompt)
			}
			if !strings.Contains(prompt, tt.wantID) {
				t.Errorf("prompt missing ID %q: \n%s", tt.wantID, prompt)
			}
		})
	}
}

func TestBuildIdentityPrompt_InvalidModel(t *testing.T) {
	identity := AvatarIdentity{
		ModelID:  "FAKE-99",
		Instance: 1,
		Channel:  AvatarChannelUnknown,
	}
	prompt := identity.BuildIdentityPrompt()
	if prompt != "" {
		t.Error("identity prompt should be empty for invalid model")
	}
}

func TestAvatarConfig_HasIdentity(t *testing.T) {
	cfgWithIdentity := AvatarConfig{
		Identity: AvatarIdentity{
			ModelID: AvatarModelZHI, Instance: 1, Channel: AvatarChannelGuardian,
		},
	}
	if !cfgWithIdentity.HasIdentity() {
		t.Error("HasIdentity() should be true when valid identity is set")
	}

	cfgWithInvalidIdentity := AvatarConfig{
		Identity: AvatarIdentity{
			ModelID: "FAKE", Instance: 1, Channel: AvatarChannelUnknown,
		},
	}
	if cfgWithInvalidIdentity.HasIdentity() {
		t.Error("HasIdentity() should be false for invalid model ID")
	}

	cfgWithoutIdentity := AvatarConfig{}
	if cfgWithoutIdentity.HasIdentity() {
		t.Error("HasIdentity() should be false when no identity is set")
	}
}

func TestNewAvatar_WithIdentity(t *testing.T) {
	client := &mockLLMClient{}
	config := AvatarConfig{
		AvatarRoleID: "zhi-avatar-01",
		AvatarNumber: 1,
		Channel:      AvatarChannelGuardian,
		SystemPrompt: "You are a helpful AI.",
		Identity: AvatarIdentity{
			ModelID: AvatarModelZHI, Instance: 3, Channel: AvatarChannelGuardian,
		},
	}

	avatar, err := NewAvatar(config, client)
	if err != nil {
		t.Fatalf("NewAvatar() error = %v", err)
	}

	ctx := avatar.GetContext()

	// First message must be identity prompt
	if len(ctx) < 2 {
		t.Fatalf("context should have at least 2 messages (identity + system), got %d", len(ctx))
	}
	if ctx[0].Role != "system" {
		t.Errorf("first message role = %q, want system", ctx[0].Role)
	}
	if !strings.Contains(ctx[0].Content, "身份锚定") {
		t.Errorf("first message should be identity prompt, got: %q", ctx[0].Content)
	}
	if !strings.Contains(ctx[0].Content, "织") {
		t.Errorf("identity prompt should contain persona name '织'")
	}
	if !strings.Contains(ctx[0].Content, "第 3 号化身") {
		t.Errorf("identity prompt should contain instance number")
	}

	// Second message should be the external system prompt
	if ctx[1].Role != "system" {
		t.Errorf("second message role = %q, want system", ctx[1].Role)
	}
	if ctx[1].Content != "You are a helpful AI." {
		t.Errorf("second message content = %q, want 'You are a helpful AI.'", ctx[1].Content)
	}
}

func TestNewAvatar_IdentityOnly_NoSystemPrompt(t *testing.T) {
	client := &mockLLMClient{}
	config := AvatarConfig{
		AvatarRoleID: "zhi-only-01",
		AvatarNumber: 1,
		Channel:      AvatarChannelUnknown,
		SystemPrompt: "",
		Identity: AvatarIdentity{
			ModelID: AvatarModelZHI, Instance: 1, Channel: AvatarChannelUnknown,
		},
	}

	avatar, err := NewAvatar(config, client)
	if err != nil {
		t.Fatalf("NewAvatar() error = %v", err)
	}

	ctx := avatar.GetContext()
	if len(ctx) != 1 {
		t.Fatalf("context should have 1 message (identity only), got %d", len(ctx))
	}
	if !strings.Contains(ctx[0].Content, "身份锚定") {
		t.Error("context should contain identity prompt")
	}
}

func TestNewAvatar_WithoutIdentity_RequiresSystemPrompt(t *testing.T) {
	client := &mockLLMClient{}
	config := AvatarConfig{
		AvatarRoleID: "no-identity",
		AvatarNumber: 1,
		Channel:      AvatarChannelUnknown,
	}

	_, err := NewAvatar(config, client)
	if err == nil {
		t.Error("NewAvatar() should fail without systemPrompt and without identity")
	}
}

func TestIdentityDisplay(t *testing.T) {
	client := &mockLLMClient{}
	config := AvatarConfig{
		AvatarRoleID: "display-test",
		AvatarNumber: 1,
		Channel:      AvatarChannelGuardian,
		SystemPrompt: "test",
		Identity: AvatarIdentity{
			ModelID: AvatarModelZHI, Instance: 7, Channel: AvatarChannelGuardian,
		},
	}

	avatar, err := NewAvatar(config, client)
	if err != nil {
		t.Fatalf("NewAvatar() error = %v", err)
	}

	display := avatar.IdentityDisplay()
	if !strings.Contains(display, "织") {
		t.Errorf("IdentityDisplay should contain persona name '织', got: %q", display)
	}
	if !strings.Contains(display, "ZHI-01") {
		t.Errorf("IdentityDisplay should contain model ID, got: %q", display)
	}
}

func TestIdentity_AllModelsHaveUniqueIDs(t *testing.T) {
	ids := map[AvatarModelID]bool{}
	for _, id := range []AvatarModelID{AvatarModelZHI, AvatarModelREI, AvatarModelKAORU} {
		if ids[id] {
			t.Errorf("duplicate model ID: %s", id)
		}
		ids[id] = true
	}
}

func TestIdentity_AllModelsHaveNonEmptyFields(t *testing.T) {
	models := []AvatarModel{ModelZHI, ModelREI, ModelKAORU}
	for _, m := range models {
		if m.Name == "" {
			t.Errorf("model %s has empty Name", m.ID)
		}
		if m.Archetype == "" {
			t.Errorf("model %s has empty Archetype", m.ID)
		}
		if m.Description == "" {
			t.Errorf("model %s has empty Description", m.ID)
		}
		if len(m.Traits) == 0 {
			t.Errorf("model %s has empty Traits", m.ID)
		}
	}
}
