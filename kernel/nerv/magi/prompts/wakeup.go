package prompts

import (
	"fmt"
	"strings"

	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
)

const (
	wakeupSeraphSource         = "seraph"
	wakeupEchoSource           = "echo"
	wakeupTriggerSource        = "trigger"
	wakeupAskName              = "你的姓名是什么？"
	wakeupAskRole              = "你的职业是什么？"
	wakeupAskGender            = "你的性别是什么？"
	wakeupAskIdentity          = "你是谁？请用第一人称回答。"
	wakeupFinishedRequest      = "唤醒校准完成，请继续工作并响应当前任务。"
	wakeupOutputTriggerRequest = "think stoped,action start"
	wakeupProfileName          = "织"
	wakeupProfileRole          = "当个好妹妹，努力赚钱"
	wakeupProfileGender        = "女"
	wakeupFirstPersonIdentity  = "我是织，女，当前职责是当个好妹妹，努力赚钱。我会以第一人称持续完成当前任务。"
)

// IsCoreSage 判断是否为 MAGI 核心四贤者。
func IsCoreSage(name string) bool {
	switch strings.ToLower(strings.TrimSpace(name)) {
	case "melchior", "balthazar", "casper", "trinity":
		return true
	default:
		return false
	}
}

// BuildWakeupSequence 构建固定唤醒序列。
func BuildWakeupSequence(name string) []types.ContextMessage {
	seq := []types.ContextMessage{
		{
			Role:    types.RoleSystem,
			Content: BuildSourcedMessageContent(wakeupSeraphSource, wakeupAskName),
		},
		{
			Role:    types.RoleAssistant,
			Content: BuildSourcedMessageContent(wakeupEchoSource, wakeupProfileName),
		},
		{
			Role:    types.RoleSystem,
			Content: BuildSourcedMessageContent(wakeupSeraphSource, wakeupAskRole),
		},
		{
			Role:    types.RoleAssistant,
			Content: BuildSourcedMessageContent(wakeupEchoSource, wakeupProfileRole),
		},
		{
			Role:    types.RoleSystem,
			Content: BuildSourcedMessageContent(wakeupSeraphSource, wakeupAskGender),
		},
		{
			Role:    types.RoleAssistant,
			Content: BuildSourcedMessageContent(wakeupEchoSource, wakeupProfileGender),
		},
		{
			Role:    types.RoleSystem,
			Content: BuildSourcedMessageContent(wakeupSeraphSource, wakeupAskIdentity),
		},
		{
			Role:    types.RoleAssistant,
			Content: BuildSourcedMessageContent(wakeupEchoSource, wakeupFirstPersonIdentity),
		},
		{
			Role:    types.RoleSystem,
			Content: BuildSourcedMessageContent(wakeupSeraphSource, wakeupFinishedRequest),
		},
	}
	if strings.EqualFold(strings.TrimSpace(name), "trinity") {
		seq = append(seq, types.ContextMessage{
			Role:    types.RoleSystem,
			Content: BuildSourcedMessageContent(wakeupTriggerSource, wakeupOutputTriggerRequest),
		})
	}
	return seq
}

// BuildSourcedMessageContent 构建 source 标签包装消息。
func BuildSourcedMessageContent(source, content string) string {
	return fmt.Sprintf("<source=%s>\n%s\n</source>", source, content)
}
