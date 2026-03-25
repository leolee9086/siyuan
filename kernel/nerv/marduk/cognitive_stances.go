package marduk

import (
	"fmt"
	"strings"
)

// CognitiveStanceKey 档案立场键。
type CognitiveStanceKey string

const (
	CognitiveStanceProfession            CognitiveStanceKey = "profession"
	CognitiveStancePrimarySocialRelation CognitiveStanceKey = "primarySocialRelation"
	CognitiveStanceSelfName              CognitiveStanceKey = "selfName"
)

// Normalized 返回去除首尾空白后的立场副本。
func (s *SubjectCognitiveStances) Normalized() SubjectCognitiveStances {
	if s == nil {
		return SubjectCognitiveStances{}
	}
	return SubjectCognitiveStances{
		Profession:            strings.TrimSpace(s.Profession),
		PrimarySocialRelation: strings.TrimSpace(s.PrimarySocialRelation),
		SelfName:              strings.TrimSpace(s.SelfName),
	}
}

// LabelForKey 根据固定立场键返回对应标签。
func (s SubjectCognitiveStances) LabelForKey(key CognitiveStanceKey) string {
	switch key {
	case CognitiveStanceProfession:
		return strings.TrimSpace(s.Profession)
	case CognitiveStancePrimarySocialRelation:
		return strings.TrimSpace(s.PrimarySocialRelation)
	case CognitiveStanceSelfName:
		return strings.TrimSpace(s.SelfName)
	default:
		return ""
	}
}

// ResolveCognitiveStances 从人格档案中严格读取主导者选举所需的三元立场。
// 该流程禁止任何兜底填充，缺失就是错误。
func ResolveCognitiveStances(profile *IpipPersonaProfile) (SubjectCognitiveStances, error) {
	if profile == nil {
		return SubjectCognitiveStances{}, fmt.Errorf("persona profile is nil")
	}

	stances := profile.Subject.CognitiveStances.Normalized()
	missing := make([]string, 0, 3)
	if stances.Profession == "" {
		missing = append(missing, string(CognitiveStanceProfession))
	}
	if stances.PrimarySocialRelation == "" {
		missing = append(missing, string(CognitiveStancePrimarySocialRelation))
	}
	if stances.SelfName == "" {
		missing = append(missing, string(CognitiveStanceSelfName))
	}
	if len(missing) > 0 {
		return SubjectCognitiveStances{}, fmt.Errorf("subject cognitive stances are incomplete: missing %s", strings.Join(missing, ", "))
	}
	return stances, nil
}
