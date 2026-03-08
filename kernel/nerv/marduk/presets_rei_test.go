package marduk

import (
	"testing"
)

func TestReiPreset(t *testing.T) {
	// 测试提交载荷
	payload := GetReiSubmissionPayload()
	if err := ValidateSubmissionPayload(payload); err != nil {
		t.Fatalf("Rei submission payload validation failed: %v", err)
	}

	// 验证答案数量
	if len(payload.Answers) != 120 {
		t.Errorf("Expected 120 answers, got %d", len(payload.Answers))
	}

	// 验证被试信息
	if payload.Subject.ID != "rei" {
		t.Errorf("Expected subject ID 'rei', got '%s'", payload.Subject.ID)
	}
	if payload.Subject.Name != "丽" {
		t.Errorf("Expected subject name '丽', got '%s'", payload.Subject.Name)
	}

	// 验证四轨描述不为空
	if payload.Descriptions.ProfessionalDescription == "" {
		t.Error("Professional description is empty")
	}
	if payload.Descriptions.LifeDescription == "" {
		t.Error("Life description is empty")
	}
	if payload.Descriptions.InstinctNeedsDescription == "" {
		t.Error("Instinct needs description is empty")
	}
	if payload.Descriptions.IntegratedDescription == "" {
		t.Error("Integrated description is empty")
	}

	// 测试人格档案
	profile := GetReiPreset()
	if err := ValidatePersonaProfile(profile); err != nil {
		t.Fatalf("Rei persona profile validation failed: %v", err)
	}

	// 验证traits（从答案计算得出的实际值）
	expectedTraits := map[string]float64{
		"O": 0.41,
		"C": 0.78,
		"E": 0.27,
		"A": 0.52,
		"N": 0.15,
	}
	for trait, expectedScore := range expectedTraits {
		if score, exists := profile.PersonaBase.Traits[trait]; !exists {
			t.Errorf("Missing trait %s", trait)
		} else if score != expectedScore {
			t.Errorf("Trait %s: expected %.2f, got %.2f", trait, expectedScore, score)
		}
	}

	// 验证facets数量
	if len(profile.PersonaBase.Facets) != 30 {
		t.Errorf("Expected 30 facets, got %d", len(profile.PersonaBase.Facets))
	}
}
