package prompts

import (
	"fmt"
	"strings"

	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
	"github.com/siyuan-note/siyuan/kernel/nerv/marduk"
)

const (
	wakeupSeraphSource      = "seraph"
	wakeupEchoSource        = "echo"
	wakeupAskName           = "你的姓名是什么？"
	wakeupAskRole           = "你的职业是什么？"
	wakeupAskGender         = "你的性别是什么？"
	wakeupAskIdentity       = "你是谁？请用第一人称回答。"
	wakeupFinishedRequest   = "唤醒校准完成，请继续工作并响应当前任务。"
	wakeupDefaultName       = "丽"
	wakeupDefaultGender     = "未说明"
	wakeupDefaultRole       = "助手"
	wakeupDefaultCareerGoal = "完成当前任务"
)

// IsCoreSage 判断是否属于三贤人核心角色。
func IsCoreSage(name string) bool {
	switch strings.ToLower(strings.TrimSpace(name)) {
	case "melchior", "balthazar", "casper":
		return true
	default:
		return false
	}
}

// BuildWakeupSequence 构建固定唤醒序列。
func BuildWakeupSequence(dataDir, name string, profile *marduk.IpipPersonaProfile) []types.ContextMessage {
	fields := resolveWakeupProfileFields(profile)
	descriptions := marduk.ResolvePersonaSeedDescriptions(dataDir, profile)
	seq := []types.ContextMessage{
		{
			Role:    types.RoleSystem,
			Content: BuildSourcedMessageContent(wakeupSeraphSource, wakeupAskName),
		},
		{
			Role:    types.RoleAssistant,
			Content: BuildSourcedMessageContent(wakeupEchoSource, fields.Name),
		},
		{
			Role:    types.RoleSystem,
			Content: BuildSourcedMessageContent(wakeupSeraphSource, wakeupAskRole),
		},
		{
			Role:    types.RoleAssistant,
			Content: BuildSourcedMessageContent(wakeupEchoSource, buildWakeupRole(fields.Role, fields.CareerGoal)),
		},
		{
			Role:    types.RoleSystem,
			Content: BuildSourcedMessageContent(wakeupSeraphSource, wakeupAskGender),
		},
		{
			Role:    types.RoleAssistant,
			Content: BuildSourcedMessageContent(wakeupEchoSource, fields.Gender),
		},
		{
			Role:    types.RoleSystem,
			Content: BuildSourcedMessageContent(wakeupSeraphSource, wakeupAskIdentity),
		},
		{
			Role:    types.RoleAssistant,
			Content: BuildSourcedMessageContent(wakeupEchoSource, buildWakeupIdentity(name, fields, descriptions)),
		},
		{
			Role:    types.RoleSystem,
			Content: BuildSourcedMessageContent(wakeupSeraphSource, wakeupFinishedRequest),
		},
	}
	return seq
}

// BuildSourcedMessageContent 构建 source 标签包装消息。
func BuildSourcedMessageContent(source, content string) string {
	return fmt.Sprintf("<source=%s>\n%s\n</source>", source, content)
}

type wakeupProfileFields struct {
	Name       string
	Gender     string
	Role       string
	CareerGoal string
}

func resolveWakeupProfileFields(profile *marduk.IpipPersonaProfile) wakeupProfileFields {
	resolved := wakeupProfileFields{
		Name:       wakeupDefaultName,
		Gender:     wakeupDefaultGender,
		Role:       wakeupDefaultRole,
		CareerGoal: wakeupDefaultCareerGoal,
	}

	if profile == nil {
		profile = marduk.GetReiPreset()
	}
	if profile == nil {
		return resolved
	}

	if name := strings.TrimSpace(profile.Subject.Name); name != "" {
		resolved.Name = name
	}
	if profile.Subject.Gender != nil {
		if gender := strings.TrimSpace(*profile.Subject.Gender); gender != "" {
			resolved.Gender = gender
		}
	}
	if profile.Subject.Role != nil {
		if role := strings.TrimSpace(*profile.Subject.Role); role != "" {
			resolved.Role = role
		}
	}
	if profile.Subject.CareerGoal != nil {
		if careerGoal := strings.TrimSpace(*profile.Subject.CareerGoal); careerGoal != "" {
			resolved.CareerGoal = careerGoal
		}
	}
	return resolved
}

func buildWakeupRole(role, careerGoal string) string {
	role = strings.TrimSpace(role)
	careerGoal = strings.TrimSpace(careerGoal)
	switch {
	case role != "" && careerGoal != "":
		return fmt.Sprintf("%s；我的目标是%s", role, careerGoal)
	case role != "":
		return role
	case careerGoal != "":
		return fmt.Sprintf("我的目标是%s", careerGoal)
	default:
		return wakeupDefaultRole
	}
}

func buildWakeupIdentity(sageName string, fields wakeupProfileFields, descriptions marduk.IpipPersonaSeedDescriptions) string {
	if desc := strings.TrimSpace(selectWakeupDescriptionBySage(sageName, descriptions)); desc != "" {
		return desc
	}
	// 描述为空，返回简单介绍
	return fmt.Sprintf("我是%s，%s", fields.Name, fields.Gender)
}

func selectWakeupDescriptionBySage(sageName string, descriptions marduk.IpipPersonaSeedDescriptions) string {
	integrated := strings.TrimSpace(descriptions.IntegratedDescription)
	lowerName := strings.ToLower(strings.TrimSpace(sageName))
	switch lowerName {
	case "melchior":
		return joinWakeupDescriptions(integrated, descriptions.ProfessionalDescription)
	case "balthazar":
		return joinWakeupDescriptions(integrated, descriptions.InstinctNeedsDescription)
	case "casper":
		return joinWakeupDescriptions(integrated, descriptions.LifeDescription)
	default:
		// 只有三贤人，其他情况报错
		panic(fmt.Sprintf("invalid sage name: %s", sageName))
	}
}

func joinWakeupDescriptions(values ...string) string {
	parts := make([]string, 0, len(values))
	for _, value := range values {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			parts = append(parts, trimmed)
		}
	}
	return strings.Join(parts, "\n\n")
}
