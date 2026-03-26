package marduk

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
	"sync/atomic"
	"testing"
	"time"
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

func TestResolvePersonaSeedDescriptionsForShikinamiPreset(t *testing.T) {
	profile := GetShikinamiPreset()
	descriptions := ResolvePersonaSeedDescriptions(t.TempDir(), profile)
	if descriptions.ProfessionalDescription == "" {
		t.Fatal("expected professionalDescription for shikinami preset")
	}
	if descriptions.IntegratedDescription == "" {
		t.Fatal("expected integratedDescription for shikinami preset")
	}
}

func TestResolvePersonaSeedDescriptionsForJarvisPreset(t *testing.T) {
	profile := GetJarvisPreset()
	descriptions := ResolvePersonaSeedDescriptions(t.TempDir(), profile)
	if descriptions.ProfessionalDescription == "" {
		t.Fatal("expected professionalDescription for jarvis preset")
	}
	if descriptions.IntegratedDescription == "" {
		t.Fatal("expected integratedDescription for jarvis preset")
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
	resetPersonaSeedDescriptionsResolverStateForTests()
	t.Cleanup(resetPersonaSeedDescriptionsResolverStateForTests)

	dataDir := t.TempDir()
	privateDir := filepath.Join(dataDir, "private")
	if err := os.MkdirAll(privateDir, 0755); err != nil {
		t.Fatal(err)
	}

	writeSamplePayload(t, privateDir, "zhi_ipip120_sample_1.json", "指针描述")
	writeSamplePayload(t, privateDir, "zhi_ipip120_sample_2.json", "最新描述")
	writeActiveSeedPointer(t, privateDir, "/data/private/zhi_persona_profile_1.json", "2026-03-09T12:00:00Z")

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

func TestResolvePersonaSeedDescriptionsCollapsesConcurrentInitialLoad(t *testing.T) {
	resetPersonaSeedDescriptionsResolverStateForTests()
	t.Cleanup(resetPersonaSeedDescriptionsResolverStateForTests)

	dataDir := t.TempDir()
	privateDir := filepath.Join(dataDir, "private")
	if err := os.MkdirAll(privateDir, 0755); err != nil {
		t.Fatal(err)
	}

	writeSamplePayload(t, privateDir, "zhi_ipip120_sample_1.json", "并发描述")
	writeActiveSeedPointer(t, privateDir, "/data/private/zhi_persona_profile_1.json", "2026-03-09T12:00:00Z")

	originalLoader := resolvePersonaSeedDescriptionsMissLoader
	var missCount atomic.Int32
	resolvePersonaSeedDescriptionsMissLoader = func(dataDir string, subjectID string) IpipPersonaSeedDescriptions {
		missCount.Add(1)
		time.Sleep(40 * time.Millisecond)
		return resolvePersonaSeedDescriptionsUncached(dataDir, subjectID)
	}
	t.Cleanup(func() {
		resolvePersonaSeedDescriptionsMissLoader = originalLoader
	})

	profile := &IpipPersonaProfile{
		Subject: IpipSubjectProfile{
			ID:   "zhi",
			Name: "织",
		},
	}

	var wg sync.WaitGroup
	results := make(chan string, 8)
	for range 8 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			descriptions := ResolvePersonaSeedDescriptions(dataDir, profile)
			results <- descriptions.ProfessionalDescription
		}()
	}
	wg.Wait()
	close(results)

	for got := range results {
		if got != "并发描述" {
			t.Fatalf("expected shared cached description, got %q", got)
		}
	}
	if got := missCount.Load(); got != 1 {
		t.Fatalf("expected exactly one cold load, got %d", got)
	}
}

func TestResolvePersonaSeedDescriptionsRefreshesAfterActiveSeedChange(t *testing.T) {
	resetPersonaSeedDescriptionsResolverStateForTests()
	t.Cleanup(resetPersonaSeedDescriptionsResolverStateForTests)

	dataDir := t.TempDir()
	privateDir := filepath.Join(dataDir, "private")
	if err := os.MkdirAll(privateDir, 0755); err != nil {
		t.Fatal(err)
	}

	writeSamplePayload(t, privateDir, "zhi_ipip120_sample_1.json", "旧指针描述")
	writeSamplePayload(t, privateDir, "zhi_ipip120_sample_2.json", "新指针描述")
	writeActiveSeedPointer(t, privateDir, "/data/private/zhi_persona_profile_1.json", "2026-03-09T12:00:00Z")

	profile := &IpipPersonaProfile{
		Subject: IpipSubjectProfile{
			ID:   "zhi",
			Name: "织",
		},
	}

	if got := ResolvePersonaSeedDescriptions(dataDir, profile).ProfessionalDescription; got != "旧指针描述" {
		t.Fatalf("expected initial pointer description, got %q", got)
	}

	writeActiveSeedPointer(t, privateDir, "/data/private/zhi_persona_profile_2.json", "2026-03-10T12:00:00Z")

	waitForProfessionalDescription(t, dataDir, profile, "新指针描述")
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

func writeActiveSeedPointer(t *testing.T, privateDir, activeProfilePath, updatedAt string) {
	t.Helper()

	pointer := map[string]any{
		"schemaVersion":     "MAGI-ACTIVE-PERSONA-SEED-v1",
		"activeProfilePath": activeProfilePath,
		"updatedAt":         updatedAt,
	}
	pointerData, err := json.Marshal(pointer)
	if err != nil {
		t.Fatal(err)
	}
	if err = os.WriteFile(filepath.Join(privateDir, "magi_active_persona_seed.json"), pointerData, 0644); err != nil {
		t.Fatal(err)
	}
}

func waitForProfessionalDescription(t *testing.T, dataDir string, profile *IpipPersonaProfile, expected string) {
	t.Helper()

	deadline := time.Now().Add(2 * time.Second)
	for {
		got := ResolvePersonaSeedDescriptions(dataDir, profile).ProfessionalDescription
		if got == expected {
			return
		}
		if time.Now().After(deadline) {
			t.Fatalf("wait for updated description timed out, got %q want %q", got, expected)
		}
		time.Sleep(20 * time.Millisecond)
	}
}
