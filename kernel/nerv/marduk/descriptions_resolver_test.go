package marduk

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestResolvePersonaSeedDescriptionsForPreset(t *testing.T) {
	profile := GetReiPreset()
	descriptions := ResolvePersonaSeedDescriptions(t.TempDir(), profile)
	if descriptions.ProfessionalDescription == "" {
		t.Fatal("expected professionalDescription for rei preset")
	}
	if descriptions.IntegratedDescription == "" {
		t.Fatal("expected integratedDescription for rei preset")
	}
}

func TestResolvePersonaSeedDescriptionsForUnknownProfile(t *testing.T) {
	profile := &IpipPersonaProfile{
		Subject: IpipSubjectProfile{
			ID:   "custom-user",
			Name: "自定义用户",
		},
	}
	descriptions := ResolvePersonaSeedDescriptions(t.TempDir(), profile)
	if descriptions.ProfessionalDescription != "" ||
		descriptions.LifeDescription != "" ||
		descriptions.InstinctNeedsDescription != "" ||
		descriptions.IntegratedDescription != "" {
		t.Fatalf("expected empty descriptions for unknown profile, got: %+v", descriptions)
	}
}

func TestResolvePersonaSeedDescriptionsUsesLatestSampleBySubjectID(t *testing.T) {
	dataDir := t.TempDir()
	privateDir := filepath.Join(dataDir, "private")
	if err := os.MkdirAll(privateDir, 0755); err != nil {
		t.Fatal(err)
	}

	writeSamplePayload(t, privateDir, "zhi_ipip120_sample_1.json", "旧描述")
	writeSamplePayload(t, privateDir, "zhi_ipip120_sample_2.json", "新描述")

	profile := &IpipPersonaProfile{
		Subject: IpipSubjectProfile{
			ID:   "zhi",
			Name: "织",
		},
	}
	descriptions := ResolvePersonaSeedDescriptions(dataDir, profile)
	if descriptions.ProfessionalDescription != "新描述" {
		t.Fatalf("expected latest sample description, got %q", descriptions.ProfessionalDescription)
	}
}

func TestResolvePersonaSeedDescriptionsPrefersActiveSeedPointer(t *testing.T) {
	dataDir := t.TempDir()
	privateDir := filepath.Join(dataDir, "private")
	if err := os.MkdirAll(privateDir, 0755); err != nil {
		t.Fatal(err)
	}

	writeSamplePayload(t, privateDir, "zhi_ipip120_sample_1.json", "指针描述")
	writeSamplePayload(t, privateDir, "zhi_ipip120_sample_2.json", "最新描述")

	pointer := map[string]any{
		"schemaVersion":     "MAGI-ACTIVE-PERSONA-SEED-v1",
		"activeProfilePath": "/data/private/zhi_persona_profile_1.json",
		"updatedAt":         "2026-03-09T12:00:00Z",
	}
	pointerData, err := json.Marshal(pointer)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(privateDir, "magi_active_persona_seed.json"), pointerData, 0644); err != nil {
		t.Fatal(err)
	}

	profile := &IpipPersonaProfile{
		Subject: IpipSubjectProfile{
			ID:   "zhi",
			Name: "织",
		},
	}
	descriptions := ResolvePersonaSeedDescriptions(dataDir, profile)
	if descriptions.ProfessionalDescription != "指针描述" {
		t.Fatalf("expected pointer selected sample description, got %q", descriptions.ProfessionalDescription)
	}
}

func writeSamplePayload(t *testing.T, privateDir, fileName, professionalDescription string) {
	t.Helper()

	payload := &IpipNeo120SubmissionPayload{
		SchemaVersion: "IPIP-NEO-120-v1",
		Subject: IpipNeo120SubjectMeta{
			ID:     "zhi",
			Name:   "织",
			Gender: "未说明",
			Age:    0,
			Type:   SubjectTypeHuman,
		},
		Descriptions: IpipPersonaSeedDescriptions{
			ProfessionalDescription: professionalDescription,
		},
		Answers: make120Answers(),
	}

	data, err := json.Marshal(payload)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(privateDir, fileName), data, 0644); err != nil {
		t.Fatal(err)
	}
}
