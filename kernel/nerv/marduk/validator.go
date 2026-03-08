package marduk

import (
	"fmt"
)

// ValidateSubmissionPayload 校验问卷提交载荷
func ValidateSubmissionPayload(payload *IpipNeo120SubmissionPayload) error {
	if payload == nil {
		return &ValidationError{Field: "payload", Message: "不能为空"}
	}

	// 校验schema版本
	if payload.SchemaVersion != "IPIP-NEO-120-v1" {
		return &ValidationError{
			Field:   "schema_version",
			Message: fmt.Sprintf("无效的schema版本: %s, 期望: IPIP-NEO-120-v1", payload.SchemaVersion),
		}
	}

	// 校验被试信息
	if err := validateSubjectMeta(&payload.Subject); err != nil {
		return err
	}

	// 校验答案数量
	if len(payload.Answers) != 120 {
		return &ValidationError{
			Field:   "answers",
			Message: fmt.Sprintf("答案数量错误: %d, 期望: 120", len(payload.Answers)),
		}
	}

	// 校验每个答案
	questionSet := make(map[int]bool)
	for i, answer := range payload.Answers {
		if answer.Q < 1 || answer.Q > 120 {
			return &ValidationError{
				Field:   fmt.Sprintf("answers[%d].q", i),
				Message: fmt.Sprintf("题号超出范围: %d, 必须在1-120之间", answer.Q),
			}
		}
		if questionSet[answer.Q] {
			return &ValidationError{
				Field:   fmt.Sprintf("answers[%d].q", i),
				Message: fmt.Sprintf("题号重复: %d", answer.Q),
			}
		}
		questionSet[answer.Q] = true

		if answer.Score < 1 || answer.Score > 5 {
			return &ValidationError{
				Field:   fmt.Sprintf("answers[%d].score", i),
				Message: fmt.Sprintf("评分超出范围: %d, 必须在1-5之间", answer.Score),
			}
		}
	}

	return nil
}

// ValidatePersonaProfile 校验人格档案
func ValidatePersonaProfile(profile *IpipPersonaProfile) error {
	if profile == nil {
		return &ValidationError{Field: "profile", Message: "不能为空"}
	}

	// 校验schema版本
	if profile.SchemaVersion != "IPIP-NEO-120-v1" {
		return &ValidationError{
			Field:   "schemaVersion",
			Message: fmt.Sprintf("无效的schema版本: %s, 期望: IPIP-NEO-120-v1", profile.SchemaVersion),
		}
	}

	// 校验PersonaBase
	if err := validatePersonaBase(&profile.PersonaBase); err != nil {
		return err
	}

	return nil
}

// validateSubjectMeta 校验被试元信息
func validateSubjectMeta(subject *IpipNeo120SubjectMeta) error {
	if subject.ID == "" {
		return &ValidationError{Field: "subject.id", Message: "不能为空"}
	}
	if subject.Name == "" {
		return &ValidationError{Field: "subject.name", Message: "不能为空"}
	}
	if subject.Gender == "" {
		return &ValidationError{Field: "subject.gender", Message: "不能为空"}
	}
	if subject.Type != SubjectTypeHuman && subject.Type != SubjectTypeAIAgent {
		return &ValidationError{
			Field:   "subject.type",
			Message: fmt.Sprintf("无效的类型: %s, 必须是human或ai_agent", subject.Type),
		}
	}
	return nil
}

// validatePersonaBase 校验PersonaBase结构
func validatePersonaBase(base *PersonaBase) error {
	// 校验traits
	requiredTraits := []string{"O", "C", "E", "A", "N"}
	if len(base.Traits) != 5 {
		return &ValidationError{
			Field:   "personaBase.traits",
			Message: fmt.Sprintf("traits数量错误: %d, 期望: 5", len(base.Traits)),
		}
	}

	for _, trait := range requiredTraits {
		score, exists := base.Traits[trait]
		if !exists {
			return &ValidationError{
				Field:   "personaBase.traits",
				Message: fmt.Sprintf("缺少必需的trait: %s", trait),
			}
		}
		if score < 0 || score > 1 {
			return &ValidationError{
				Field:   fmt.Sprintf("personaBase.traits.%s", trait),
				Message: fmt.Sprintf("分数超出范围: %.2f, 必须在0-1之间", score),
			}
		}
	}

	// 校验facets数量
	if len(base.Facets) != 30 {
		return &ValidationError{
			Field:   "personaBase.facets",
			Message: fmt.Sprintf("facets数量错误: %d, 期望: 30", len(base.Facets)),
		}
	}

	// 校验每个facet的分数范围
	for key, score := range base.Facets {
		if score < 0 || score > 1 {
			return &ValidationError{
				Field:   fmt.Sprintf("personaBase.facets.%s", key),
				Message: fmt.Sprintf("分数超出范围: %.2f, 必须在0-1之间", score),
			}
		}
	}

	return nil
}
