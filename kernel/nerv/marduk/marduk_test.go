package marduk

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestValidateSubmissionPayload(t *testing.T) {
	tests := []struct {
		name    string
		payload *IpipNeo120SubmissionPayload
		wantErr bool
		errMsg  string
	}{
		{
			name: "有效的提交载荷",
			payload: &IpipNeo120SubmissionPayload{
				SchemaVersion: "IPIP-NEO-120-v1",
				Subject: IpipNeo120SubjectMeta{
					ID:     "test_user",
					Name:   "测试用户",
					Gender: "无",
					Age:    0,
					Type:   SubjectTypeHuman,
				},
				Answers: make120Answers(),
			},
			wantErr: false,
		},
		{
			name:    "空载荷",
			payload: nil,
			wantErr: true,
			errMsg:  "不能为空",
		},
		{
			name: "错误的schema版本",
			payload: &IpipNeo120SubmissionPayload{
				SchemaVersion: "INVALID",
				Subject: IpipNeo120SubjectMeta{
					ID:     "test",
					Name:   "test",
					Gender: "无",
					Age:    0,
					Type:   SubjectTypeHuman,
				},
				Answers: make120Answers(),
			},
			wantErr: true,
			errMsg:  "无效的schema版本",
		},
		{
			name: "答案数量不足",
			payload: &IpipNeo120SubmissionPayload{
				SchemaVersion: "IPIP-NEO-120-v1",
				Subject: IpipNeo120SubjectMeta{
					ID:     "test",
					Name:   "test",
					Gender: "无",
					Age:    0,
					Type:   SubjectTypeHuman,
				},
				Answers: []IpipNeo120RawAnswer{{Q: 1, Score: 3}},
			},
			wantErr: true,
			errMsg:  "答案数量错误",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateSubmissionPayload(tt.payload)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateSubmissionPayload() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if err != nil && tt.errMsg != "" {
				if !contains(err.Error(), tt.errMsg) {
					t.Errorf("错误信息不匹配: got %v, want contains %v", err.Error(), tt.errMsg)
				}
			}
		})
	}
}

func TestValidatePersonaProfile(t *testing.T) {
	tests := []struct {
		name    string
		profile *IpipPersonaProfile
		wantErr bool
		errMsg  string
	}{
		{
			name: "有效的人格档案",
			profile: &IpipPersonaProfile{
				SchemaVersion: "IPIP-NEO-120-v1",
				Subject: IpipSubjectProfile{
					ID:   "test",
					Name: "测试",
				},
				PersonaBase: PersonaBase{
					Traits: map[string]float64{
						"O": 0.7,
						"C": 0.8,
						"E": 0.6,
						"A": 0.9,
						"N": 0.3,
					},
					Facets: make30Facets(),
				},
				GeneratedAt: time.Now(),
			},
			wantErr: false,
		},
		{
			name: "缺少必需的trait",
			profile: &IpipPersonaProfile{
				SchemaVersion: "IPIP-NEO-120-v1",
				Subject: IpipSubjectProfile{
					ID:   "test",
					Name: "测试",
				},
				PersonaBase: PersonaBase{
					Traits: map[string]float64{
						"O": 0.7,
						"C": 0.8,
					},
					Facets: make30Facets(),
				},
			},
			wantErr: true,
			errMsg:  "traits数量错误",
		},
		{
			name: "trait分数超出范围",
			profile: &IpipPersonaProfile{
				SchemaVersion: "IPIP-NEO-120-v1",
				Subject: IpipSubjectProfile{
					ID:   "test",
					Name: "测试",
				},
				PersonaBase: PersonaBase{
					Traits: map[string]float64{
						"O": 1.5,
						"C": 0.8,
						"E": 0.6,
						"A": 0.9,
						"N": 0.3,
					},
					Facets: make30Facets(),
				},
			},
			wantErr: true,
			errMsg:  "分数超出范围",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidatePersonaProfile(tt.profile)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidatePersonaProfile() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if err != nil && tt.errMsg != "" {
				if !contains(err.Error(), tt.errMsg) {
					t.Errorf("错误信息不匹配: got %v, want contains %v", err.Error(), tt.errMsg)
				}
			}
		})
	}
}

func TestStorageLoadPersonaProfile(t *testing.T) {
	// 创建临时目录
	tmpDir := t.TempDir()
	privateDir := filepath.Join(tmpDir, "private")
	if err := os.MkdirAll(privateDir, 0755); err != nil {
		t.Fatal(err)
	}

	// 创建测试文件
	profile := &IpipPersonaProfile{
		SchemaVersion: "IPIP-NEO-120-v1",
		Subject: IpipSubjectProfile{
			ID:   "test_user",
			Name: "测试用户",
		},
		PersonaBase: PersonaBase{
			Traits: map[string]float64{
				"O": 0.7,
				"C": 0.8,
				"E": 0.6,
				"A": 0.9,
				"N": 0.3,
			},
			Facets: make30Facets(),
		},
		GeneratedAt: time.Now(),
	}

	data, err := json.Marshal(profile)
	if err != nil {
		t.Fatal(err)
	}

	testFile := filepath.Join(privateDir, "test_user_persona_profile_1.json")
	if err := os.WriteFile(testFile, data, 0644); err != nil {
		t.Fatal(err)
	}

	// 测试加载
	storage := NewStorage(tmpDir)
	loaded, err := storage.LoadPersonaProfile("/data/private/test_user_persona_profile_1.json")
	if err != nil {
		t.Fatalf("LoadPersonaProfile() error = %v", err)
	}

	if loaded.Subject.ID != "test_user" {
		t.Errorf("Subject.ID = %v, want test_user", loaded.Subject.ID)
	}
}

// 辅助函数
func make120Answers() []IpipNeo120RawAnswer {
	answers := make([]IpipNeo120RawAnswer, 120)
	for i := 0; i < 120; i++ {
		answers[i] = IpipNeo120RawAnswer{
			Q:     i + 1,
			Text:  "测试题目",
			Score: 3,
		}
	}
	return answers
}

func make30Facets() map[string]float64 {
	facets := make(map[string]float64)
	domains := []string{"N", "E", "O", "A", "C"}
	facetNames := [][]string{
		{"Anxiety", "Anger", "Depression", "SelfConsciousness", "Immoderation", "Vulnerability"},
		{"Friendliness", "Gregariousness", "Assertiveness", "ActivityLevel", "ExcitementSeeking", "Cheerfulness"},
		{"Imagination", "ArtisticInterests", "Emotionality", "Adventurousness", "Intellect", "Liberalism"},
		{"Trust", "Morality", "Altruism", "Cooperation", "Modesty", "Sympathy"},
		{"SelfEfficacy", "Orderliness", "Dutifulness", "AchievementStriving", "SelfDiscipline", "Cautiousness"},
	}

	for i, domain := range domains {
		for j, name := range facetNames[i] {
			key := domain + string(rune('1'+j)) + "_" + name
			facets[key] = 0.5
		}
	}
	return facets
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > len(substr) && containsSubstring(s, substr))
}

func containsSubstring(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
