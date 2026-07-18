package api

import (
	"os"
	"strings"
	"testing"
	"time"

	"github.com/siyuan-note/siyuan/kernel/nerv/marduk"
	"github.com/siyuan-note/siyuan/kernel/util"
)

const magiLivePersonaPresetEnvKey = "MAGI_LIVE_PERSONA_PRESET"

type apiTestPersonaPreset struct {
	Name    string
	Profile *marduk.IpipPersonaProfile
}

func setupMagiLiveIdentityStoreForTests(t *testing.T, confDir string) {
	t.Helper()

	oldConfDir := util.ConfDir
	oldStore := globalMagiIdentityStore
	util.ConfDir = confDir
	globalMagiIdentityStore = &magiIdentityStore{}
	t.Cleanup(func() {
		globalMagiIdentityStore = oldStore
		util.ConfDir = oldConfDir
	})
}

func issueLiveArmorTokenForIdentity(t *testing.T, identityID, nickname string) string {
	t.Helper()

	if strings.TrimSpace(identityID) == "" {
		t.Fatal("identityID is required")
	}
	if strings.TrimSpace(nickname) == "" {
		nickname = identityID
	}

	_, err := globalMagiIdentityStore.upsert(identityID, identityID, nickname, "live-pass", magiRouteClassGuardian, true, 0, nil)
	if err != nil {
		t.Fatalf("failed to upsert live test identity %q: %v", identityID, err)
	}

	now := time.Now().Unix()
	token, signErr := signMagiArmorToken(magiArmorClaimsV1{
		Sub: identityID,
		Chn: magiRequestChannelMainUI,
		Ws:  magiWorkspaceBinding(),
		Rtc: magiRouteClassGuardian,
		Nck: nickname,
		Iat: now,
		Exp: now + 1800,
		Jti: "live-" + identityID,
	})
	if signErr != nil {
		t.Fatalf("failed to sign live test armor token for %q: %v", identityID, signErr)
	}
	return token
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
