package seraph

import (
	"testing"
)

func TestScoreIpipNeo120PersonaBase(t *testing.T) {
	// 创建测试答案（全部答3分-中立）
	answers := make([]RawAnswer, 120)
	for i := 0; i < 120; i++ {
		answers[i] = RawAnswer{
			Q:     i + 1,
			Score: 3,
		}
	}

	// 使用标准题库计分
	personaBase, err := ScoreIpipNeo120PersonaBase(answers, IpipNeo120QuestionBank)
	if err != nil {
		t.Fatalf("计分失败: %v", err)
	}

	// 验证traits数量
	if len(personaBase.Traits) != 5 {
		t.Errorf("Traits数量错误，期望5，实际%d", len(personaBase.Traits))
	}

	// 验证facets数量
	if len(personaBase.Facets) != 30 {
		t.Errorf("Facets数量错误，期望30，实际%d", len(personaBase.Facets))
	}

	// 全部答3分，归一化后应该接近0.5
	for trait, score := range personaBase.Traits {
		if score < 0.4 || score > 0.6 {
			t.Errorf("Trait %s分数异常: %.2f (期望接近0.5)", trait, score)
		}
	}
}

func TestValidation(t *testing.T) {
	// 测试答案数量不足
	answers := []RawAnswer{{Q: 1, Score: 3}}
	_, err := ScoreIpipNeo120PersonaBase(answers, IpipNeo120QuestionBank)
	if err == nil {
		t.Error("答案数量不足应该报错")
	}

	// 测试重复题号
	answers = make([]RawAnswer, 120)
	for i := 0; i < 120; i++ {
		answers[i] = RawAnswer{Q: 1, Score: 3} // 全部题号为1
	}
	_, err = ScoreIpipNeo120PersonaBase(answers, IpipNeo120QuestionBank)
	if err == nil {
		t.Error("重复题号应该报错")
	}
}
