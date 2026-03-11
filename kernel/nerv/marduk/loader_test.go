package marduk

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestGetPresetByName(t *testing.T) {
	tests := []struct {
		input        string
		wantID       string
		wantName     string
		expectPreset bool
	}{
		{input: "rei", wantID: "rei", wantName: "丽", expectPreset: true},
		{input: "薰", wantID: "kaoru", wantName: "薰", expectPreset: true},
		{input: "jarvis", wantID: "jarvis", wantName: "Jarvis", expectPreset: true},
		{input: "shikinami", wantID: "shikinami", wantName: "式波", expectPreset: true},
		{input: "式波明日香", wantID: "shikinami", wantName: "式波", expectPreset: true},
		{input: "unknown", expectPreset: false},
	}

	for _, tc := range tests {
		t.Run(tc.input, func(t *testing.T) {
			profile, presetName, ok := GetPresetByName(tc.input)
			if ok != tc.expectPreset {
				t.Fatalf("GetPresetByName(%q) ok=%v, want %v", tc.input, ok, tc.expectPreset)
			}
			if !tc.expectPreset {
				return
			}
			if profile == nil {
				t.Fatalf("GetPresetByName(%q) returned nil profile", tc.input)
			}
			if profile.Subject.ID != tc.wantID {
				t.Fatalf("GetPresetByName(%q) subject ID=%q, want %q", tc.input, profile.Subject.ID, tc.wantID)
			}
			if presetName != tc.wantName {
				t.Fatalf("GetPresetByName(%q) preset name=%q, want %q", tc.input, presetName, tc.wantName)
			}
		})
	}
}

func TestLoadPersonaProfileWithGenderFallbackUsesTestPresetOverride(t *testing.T) {
	t.Setenv(TestPersonaPresetEnvKey, "式波")

	profile, isComplete, presetName, err := LoadPersonaProfileWithGenderFallback(t.TempDir())
	if err != nil {
		t.Fatalf("LoadPersonaProfileWithGenderFallback() error = %v", err)
	}
	if profile == nil {
		t.Fatal("profile should not be nil")
	}
	if isComplete {
		t.Fatal("forced test preset should be treated as incomplete profile")
	}
	if presetName != "式波" {
		t.Fatalf("presetName = %q, want %q", presetName, "式波")
	}
	if profile.Subject.ID != "shikinami" {
		t.Fatalf("subject ID = %q, want %q", profile.Subject.ID, "shikinami")
	}
}

func TestLoadPersonaProfileUsesTestPresetOverride(t *testing.T) {
	t.Setenv(TestPersonaPresetEnvKey, "shikinami")

	profile, isComplete, err := LoadPersonaProfile(t.TempDir())
	if err != nil {
		t.Fatalf("LoadPersonaProfile() error = %v", err)
	}
	if profile == nil {
		t.Fatal("profile should not be nil")
	}
	if isComplete {
		t.Fatal("forced test preset should be treated as incomplete profile")
	}
	if profile.Subject.ID != "shikinami" {
		t.Fatalf("subject ID = %q, want %q", profile.Subject.ID, "shikinami")
	}
}

func TestLoadPersonaProfileWithGenderFallbackIgnoresInvalidTestPreset(t *testing.T) {
	t.Setenv(TestPersonaPresetEnvKey, "invalid-preset")

	dataDir := t.TempDir()
	if err := writeLegacyActiveProfile(dataDir, &IpipPersonaProfile{
		SchemaVersion: "IPIP-NEO-120-v1",
		Subject: IpipSubjectProfile{
			ID:     "custom-id",
			Name:   "自定义用户",
			Gender: stringPtr("男"),
		},
		PersonaBase: PersonaBase{
			Traits: map[string]float64{
				"O": 0.50,
				"C": 0.60,
				"E": 0.40,
				"A": 0.55,
				"N": 0.35,
			},
		},
		GeneratedAt: time.Now(),
	}); err != nil {
		t.Fatal(err)
	}

	profile, isComplete, presetName, err := LoadPersonaProfileWithGenderFallback(dataDir)
	if err != nil {
		t.Fatalf("LoadPersonaProfileWithGenderFallback() error = %v", err)
	}
	if profile == nil {
		t.Fatal("profile should not be nil")
	}
	if !isComplete {
		t.Fatal("complete user profile should be considered complete")
	}
	if presetName != "" {
		t.Fatalf("presetName = %q, want empty", presetName)
	}
	if profile.Subject.ID != "custom-id" {
		t.Fatalf("subject ID = %q, want %q", profile.Subject.ID, "custom-id")
	}
}

func writeLegacyActiveProfile(dataDir string, profile *IpipPersonaProfile) error {
	personaDir := filepath.Join(dataDir, "petal", "persona")
	if err := os.MkdirAll(personaDir, 0755); err != nil {
		return err
	}

	data, err := json.Marshal(profile)
	if err != nil {
		return err
	}

	return os.WriteFile(filepath.Join(personaDir, "active_profile.json"), data, 0644)
}

func stringPtr(v string) *string {
	return &v
}
