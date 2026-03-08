// Package marduk 提供人格档案存储、校验和注入功能
// 命名来源：EVA中的MARDUK机关，负责选拔EVA驾驶员
package marduk

import "time"

// SubjectType 被试类型
type SubjectType string

const (
	SubjectTypeHuman   SubjectType = "human"
	SubjectTypeAIAgent SubjectType = "ai_agent"
)

// IpipNeo120RawAnswer IPIP-NEO-120原始答案条目
type IpipNeo120RawAnswer struct {
	Q     int    `json:"q"`     // 题号 1-120
	Text  string `json:"text"`  // 题目文本
	Score int    `json:"score"` // 评分 1-5
}

// IpipNeo120SubjectMeta 被试元信息
type IpipNeo120SubjectMeta struct {
	ID           string      `json:"id"`
	Name         string      `json:"name"`
	Gender       string      `json:"gender"` // 性别，必填，可为任意字符串
	Age          int         `json:"age"`    // 年龄，必填，可为任意整数（包括负数）
	Type         SubjectType `json:"type"`
	Organization string      `json:"organization"`
	Role         string      `json:"role"`
	CareerGoal   string      `json:"careerGoal"`
}

// IpipPersonaSeedDescriptions 人格种子四轨描述
type IpipPersonaSeedDescriptions struct {
	ProfessionalDescription  string `json:"professionalDescription"`
	LifeDescription          string `json:"lifeDescription"`
	InstinctNeedsDescription string `json:"instinctNeedsDescription"`
	IntegratedDescription    string `json:"integratedDescription"`
}

// IpipNeo120SubmissionPayload 问卷提交载荷（原始答案）
type IpipNeo120SubmissionPayload struct {
	SchemaVersion string                      `json:"schema_version"` // "IPIP-NEO-120-v1"
	Subject       IpipNeo120SubjectMeta       `json:"subject"`
	Date          string                      `json:"date"`
	Descriptions  IpipPersonaSeedDescriptions `json:"descriptions"`
	Answers       []IpipNeo120RawAnswer       `json:"answers"`
}

// PersonaBase 人格基底（计算结果）
type PersonaBase struct {
	Traits map[string]float64 `json:"traits"` // O, C, E, A, N
	Facets map[string]float64 `json:"facets"` // 30个子维度
}

// IpipSubjectProfile 被试档案信息
type IpipSubjectProfile struct {
	ID           string  `json:"id"`
	Name         string  `json:"name"`
	Age          *int    `json:"age,omitempty"`
	Gender       *string `json:"gender,omitempty"`
	Organization *string `json:"organization,omitempty"`
	Role         *string `json:"role,omitempty"`
	CareerGoal   *string `json:"careerGoal,omitempty"`
}

// IpipPersonaProfile 人格档案（计算后的完整档案）
type IpipPersonaProfile struct {
	SchemaVersion string             `json:"schemaVersion"` // "IPIP-NEO-120-v1"
	Subject       IpipSubjectProfile `json:"subject"`
	PersonaBase   PersonaBase        `json:"personaBase"`
	GeneratedAt   time.Time          `json:"generatedAt"`
}

// ValidationError 校验错误
type ValidationError struct {
	Field   string
	Message string
}

func (e *ValidationError) Error() string {
	return e.Field + ": " + e.Message
}
