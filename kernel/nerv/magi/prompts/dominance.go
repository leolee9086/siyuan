package prompts

import "fmt"

// BuildDominantElectionSystemPrompt 构建主导者选举评分提示。
func BuildDominantElectionSystemPrompt(displayName string) string {
	return fmt.Sprintf(`你是 %s。
你现在只需要根据当前情景，判断接下来给出的三段“对你自己的描述”分别有多适合由你优先采取行动。

严格要求：
1. 三段描述都会直接给出，你只能对这三段描述打分，不允许改写、补充或发明新的描述。
2. 只输出 JSON，格式固定为 {"scores":[{"candidate":"给定描述原文","score":0-100}],"reason":"一句中文理由"}。
3. scores 必须正好包含全部 3 条给定描述，candidate 必须逐字复用给定原文，score 必须是 0 到 100 的整数。
4. 分数越高，表示该描述下的你越适合在当前情景中优先采取行动。
5. reason 不超过 48 个字。`, displayName)
}

// BuildDominantElectionUserInput 构建主导者选举用户输入。
func BuildDominantElectionUserInput(
	situation string,
	professionLabel string,
	socialRelationLabel string,
	selfLabel string,
) string {
	return fmt.Sprintf(`当前情境：
%s

下面给出三段对你自己的描述，请分别判断它们在当前情境下有多适合由你优先采取行动：
1. %s
2. %s
3. %s

请给出三项 0-100 的评分，并说明一句理由。`, situation, professionLabel, socialRelationLabel, selfLabel)
}

// BuildDominantSleepSynthesisPrompt 构建睡前整合提示。
func BuildDominantSleepSynthesisPrompt(string) string {
	return `请只输出一段补充性的整理描述，把三则笔记里的行动线索、情绪线索和接下来的方向自然连起来。
不要逐条复述原文，不要输出标题、列表、JSON、代码块或对外说话口吻。`
}

// BuildDominantSleepSynthesisInput 构建主导者睡前整合输入。
func BuildDominantSleepSynthesisInput(
	professionLabel string,
	socialRelationLabel string,
	selfLabel string,
	currentRecord string,
	nextStepPlan string,
	dreamScene string,
) string {
	return fmt.Sprintf(`以下是三则睡前笔记：

[ %s ]
%s

[ %s ]
%s

[ %s ]
%s`, professionLabel, nextStepPlan, socialRelationLabel, dreamScene, selfLabel, currentRecord)
}

// BuildDominantConsensusSynthesisPrompt 构建最终答复提示。
func BuildDominantConsensusSynthesisPrompt(string) string {
	return `请根据给定材料直接写出最终答复。
只输出答复本身。
如果原始任务要求固定格式、分项作答或问卷格式，必须严格保留该格式。`
}

// BuildDominantConsensusSynthesisInput 构建主导者综合输入。
func BuildDominantConsensusSynthesisInput(
	professionLabel string,
	socialRelationLabel string,
	selfLabel string,
	originalTask string,
	melchiorContent string,
	balthazarContent string,
	casperContent string,
) string {
	return fmt.Sprintf(`原始任务：
%s

参考材料：

[ %s ]
%s

[ %s ]
%s

[ %s ]
%s

请直接给出最终答复。`,
		originalTask,
		professionLabel,
		melchiorContent,
		socialRelationLabel,
		balthazarContent,
		selfLabel,
		casperContent,
	)
}
