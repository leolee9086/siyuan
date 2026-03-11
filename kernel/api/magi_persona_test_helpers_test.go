package api

import (
	"os"
	"strings"
	"testing"

	"github.com/siyuan-note/siyuan/kernel/nerv/marduk"
)

const magiLivePersonaPresetEnvKey = "MAGI_LIVE_PERSONA_PRESET"

type apiTestPersonaPreset struct {
	Name    string
	Profile *marduk.IpipPersonaProfile
}

func setupMagiPersonaPresetForAPITests(t *testing.T) apiTestPersonaPreset {
	t.Helper()

	requestedPreset := strings.TrimSpace(os.Getenv(magiLivePersonaPresetEnvKey))
	if requestedPreset == "" {
		requestedPreset = "式波"
	}

	profile, presetName, ok := marduk.GetPresetByName(requestedPreset)
	if !ok || profile == nil {
		t.Fatalf("无效人格预设: %q，可选值示例：式波/丽/薰/Jarvis", requestedPreset)
	}

	t.Setenv(marduk.TestPersonaPresetEnvKey, presetName)
	t.Logf("测试人格预设：%s（来源=%s）", presetName, requestedPreset)

	return apiTestPersonaPreset{
		Name:    presetName,
		Profile: profile,
	}
}

func TestSetupMagiPersonaPresetForAPITestsDefaultsToShikinami(t *testing.T) {
	t.Setenv(magiLivePersonaPresetEnvKey, "")

	preset := setupMagiPersonaPresetForAPITests(t)
	if preset.Name != "式波" {
		t.Fatalf("default preset name = %q, want %q", preset.Name, "式波")
	}
	if preset.Profile == nil || preset.Profile.Subject.ID != "shikinami" {
		t.Fatalf("default preset subject ID = %q, want %q", preset.Profile.Subject.ID, "shikinami")
	}
	if got := strings.TrimSpace(os.Getenv(marduk.TestPersonaPresetEnvKey)); got != "式波" {
		t.Fatalf("env %s = %q, want %q", marduk.TestPersonaPresetEnvKey, got, "式波")
	}
}

func TestSetupMagiPersonaPresetForAPITestsUsesSpecifiedPreset(t *testing.T) {
	t.Setenv(magiLivePersonaPresetEnvKey, "kaoru")

	preset := setupMagiPersonaPresetForAPITests(t)
	if preset.Name != "薰" {
		t.Fatalf("preset name = %q, want %q", preset.Name, "薰")
	}
	if preset.Profile == nil || preset.Profile.Subject.ID != "kaoru" {
		t.Fatalf("preset subject ID = %q, want %q", preset.Profile.Subject.ID, "kaoru")
	}
	if got := strings.TrimSpace(os.Getenv(marduk.TestPersonaPresetEnvKey)); got != "薰" {
		t.Fatalf("env %s = %q, want %q", marduk.TestPersonaPresetEnvKey, got, "薰")
	}
}
