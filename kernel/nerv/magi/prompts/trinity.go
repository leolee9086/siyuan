package prompts

import "fmt"

// BuildTrinityIntrospectionInput 构建 Trinity 内省输入模板。
func BuildTrinityIntrospectionInput(melchior, balthazar, casper string) string {
	return fmt.Sprintf(`逻辑告诉我：%s

情绪告诉我：%s

直觉告诉我：%s`, melchior, balthazar, casper)
}

// BuildTrinityHeartbeatSleepTask 构建 Trinity 对三贤人睡前笔记的综合补充任务。
func BuildTrinityHeartbeatSleepTask() string {
	return "下面是你在同一轮心跳醒来后留下的三则睡前笔记。请只输出一段补充性的综合整合描述，把当前记录、下一步计划和画面式描述缝合起来，补出它们之间的联系、情绪和行动线索。不要逐条复述原文，不要输出标题、列表、JSON 或对外对话。"
}
