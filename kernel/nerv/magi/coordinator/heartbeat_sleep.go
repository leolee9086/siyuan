package coordinator

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/siyuan-note/logging"
	"github.com/siyuan-note/siyuan/kernel/model"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/config"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/prompts"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/sages"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
	"github.com/siyuan-note/siyuan/kernel/nerv/marduk"
)

var persistMergedWannaSleepMemoryToNotebook = persistMergedWannaSleepMemoryEntryToNotebook

func (c *Coordinator) finalizeHeartbeatSleepRound(
	ctx context.Context,
	sessionID, roundID string,
	melchior, balthazar, casper *sages.Sage,
	responses []types.SageResponse,
) (string, *DominantElectionResult, error) {
	if c == nil {
		return "", nil, fmt.Errorf("coordinator is nil")
	}

	melchiorResp, balthazarResp, casperResp, err := resolveHeartbeatSleepResponses(responses)
	if err != nil {
		return "", nil, err
	}

	dominantResult, err := electDominantSage(
		ctx,
		sessionID,
		melchior,
		balthazar,
		casper,
		buildHeartbeatSleepDominantSituation(
			melchiorResp.SleepNote,
			balthazarResp.SleepNote,
			casperResp.SleepNote,
		),
	)
	if err != nil {
		return "", nil, fmt.Errorf("睡眠轮次主导者选举失败: %w", err)
	}

	dominantSage, err := resolveDominantSage(dominantResult, melchior, balthazar, casper)
	if err != nil {
		return "", nil, err
	}

	dominantSummary, err := synthesizeHeartbeatSleepWithDominant(
		ctx,
		sessionID,
		dominantSage,
		dominantResult,
		melchiorResp.SleepNote,
		balthazarResp.SleepNote,
		casperResp.SleepNote,
	)
	if err != nil {
		return "", nil, fmt.Errorf("主导者睡前笔记统合失败: %w", err)
	}

	finalNote := buildMergedHeartbeatSleepNote(
		melchiorResp.SleepNote,
		balthazarResp.SleepNote,
		casperResp.SleepNote,
		dominantSummary,
	)
	sections := buildMergedWannaSleepSections(
		melchiorResp.SleepNote,
		balthazarResp.SleepNote,
		casperResp.SleepNote,
		dominantSummary,
	)
	sleepAt := toolResultMemoryNow()

	if _, err := persistMergedWannaSleepMemoryToNotebook(
		sessionID,
		roundID,
		melchiorResp.SleepNote,
		balthazarResp.SleepNote,
		casperResp.SleepNote,
		dominantSummary,
		finalNote,
		sleepAt,
	); err != nil {
		logging.LogWarnf("归档合并后的 wanna_sleep 记忆失败 [%s]: %v", roundID, err)
	}

	appendMergedWannaSleepHistory(sessionID, roundID, melchior, melchiorResp, finalNote, sections, sleepAt)
	appendMergedWannaSleepHistory(sessionID, roundID, balthazar, balthazarResp, finalNote, sections, sleepAt)
	appendMergedWannaSleepHistory(sessionID, roundID, casper, casperResp, finalNote, sections, sleepAt)

	return finalNote, dominantResult, nil
}

func resolveHeartbeatSleepResponses(responses []types.SageResponse) (melchior, balthazar, casper *types.SageResponse, err error) {
	for i := range responses {
		resp := &responses[i]
		switch strings.TrimSpace(resp.Seel) {
		case "melchior":
			melchior = resp
		case "balthazar":
			balthazar = resp
		case "casper":
			casper = resp
		}
	}

	switch {
	case melchior == nil:
		return nil, nil, nil, fmt.Errorf("缺少 Melchior 的睡前笔记")
	case balthazar == nil:
		return nil, nil, nil, fmt.Errorf("缺少 Balthazar 的睡前笔记")
	case casper == nil:
		return nil, nil, nil, fmt.Errorf("缺少 Casper 的睡前笔记")
	case !melchior.WantsSleep || melchior.SleepNote == nil:
		return nil, nil, nil, fmt.Errorf("Melchior 未提供有效的 wanna_sleep 笔记")
	case !balthazar.WantsSleep || balthazar.SleepNote == nil:
		return nil, nil, nil, fmt.Errorf("Balthazar 未提供有效的 wanna_sleep 笔记")
	case !casper.WantsSleep || casper.SleepNote == nil:
		return nil, nil, nil, fmt.Errorf("Casper 未提供有效的 wanna_sleep 笔记")
	default:
		return melchior, balthazar, casper, nil
	}
}

func buildHeartbeatSleepDominantSituation(
	melchiorNote, balthazarNote, casperNote *types.WannaSleepTool,
) string {
	return strings.TrimSpace(strings.Join([]string{
		"当前处于心跳轮次的睡眠整理阶段。",
		"已有三则待连接的睡前笔记：",
		"1. 当前记录：" + strings.TrimSpace(casperNote.Summary),
		"2. 下一步计划：" + strings.TrimSpace(melchiorNote.NextStepPlan),
		"3. 画面式描述：" + strings.TrimSpace(balthazarNote.DreamScene),
	}, "\n"))
}

func synthesizeHeartbeatSleepWithDominant(
	ctx context.Context,
	sessionID string,
	dominantSage *sages.Sage,
	dominantResult *DominantElectionResult,
	melchiorNote, balthazarNote, casperNote *types.WannaSleepTool,
) (string, error) {
	if dominantSage == nil {
		return "", fmt.Errorf("dominant sage is nil")
	}
	if dominantResult == nil {
		return "", fmt.Errorf("dominant election result is nil")
	}

	stances, err := marduk.ResolveCognitiveStances(dominantSage.GetProfile())
	if err != nil {
		return "", err
	}

	requestMessages := dominantSage.BuildRequestMessagesForSession(
		sessionID,
		types.ContextMessage{
			Role:    types.RoleSystem,
			Content: prompts.BuildDominantSleepSynthesisPrompt(dominantResult.DominantStance),
		},
		types.ContextMessage{
			Role: types.RoleUser,
			Content: prompts.BuildDominantSleepSynthesisInput(
				buildDominantPromptLabel(marduk.CognitiveStanceProfession, stances.Profession),
				buildDominantPromptLabel(marduk.CognitiveStancePrimarySocialRelation, stances.PrimarySocialRelation),
				buildDominantPromptLabel(marduk.CognitiveStanceSelfName, stances.SelfName),
				strings.TrimSpace(casperNote.Summary),
				strings.TrimSpace(melchiorNote.NextStepPlan),
				strings.TrimSpace(balthazarNote.DreamScene),
			),
		},
	)

	content, err := dominantSage.GetLLMClient().SendChatRequestSync(ctx, requestMessages, nil, nil)
	if err != nil {
		return "", err
	}
	content = strings.TrimSpace(content)
	if content == "" {
		return "", fmt.Errorf("dominant sleep synthesis is empty")
	}
	return content, nil
}

func buildMergedHeartbeatSleepNote(
	melchiorNote, balthazarNote, casperNote *types.WannaSleepTool,
	dominantSummary string,
) string {
	sections := buildMergedWannaSleepSections(melchiorNote, balthazarNote, casperNote, dominantSummary)
	return strings.TrimSpace(strings.Join([]string{
		"当前的记录：\n" + sections["currentRecord"],
		"下一步的计划：\n" + sections["nextStepPlan"],
		"画面式的描述：\n" + sections["dreamScene"],
		"补充整理描述：\n" + sections["supplementalSummary"],
	}, "\n\n"))
}

func buildMergedWannaSleepSections(
	melchiorNote, balthazarNote, casperNote *types.WannaSleepTool,
	dominantSummary string,
) map[string]string {
	return map[string]string{
		"currentRecord":       strings.TrimSpace(casperNote.Summary),
		"nextStepPlan":        strings.TrimSpace(melchiorNote.NextStepPlan),
		"dreamScene":          strings.TrimSpace(balthazarNote.DreamScene),
		"supplementalSummary": strings.TrimSpace(dominantSummary),
	}
}

func appendMergedWannaSleepHistory(
	sessionID, roundID string,
	sage *sages.Sage,
	response *types.SageResponse,
	finalNote string,
	sections map[string]string,
	sleepAt time.Time,
) {
	if sage == nil || response == nil || response.SleepNote == nil {
		return
	}

	assistantContent := strings.TrimSpace(response.SleepAssistantDraft)
	if assistantContent == "" {
		assistantContent = " "
	}
	toolCall := buildHeartbeatSleepHistoryToolCall(roundID, response)

	sage.AddToContextWithSession(sessionID, types.ContextMessage{
		Role:      types.RoleAssistant,
		Content:   assistantContent,
		ToolCalls: []types.ToolCall{toolCall},
	})
	sage.AddToContextWithSession(sessionID, types.ContextMessage{
		Role:    types.RoleTool,
		Content: buildMergedWannaSleepToolResult(finalNote, sections, sleepAt),
		ToolID:  toolCall.ID,
	})
}

func buildMergedWannaSleepToolResult(
	finalNote string,
	sections map[string]string,
	sleepAt time.Time,
) string {
	payload := map[string]interface{}{
		"ok":      true,
		"state":   "sleeping",
		"summary": strings.TrimSpace(finalNote),
		"sleepAt": sleepAt.Format(time.RFC3339),
		"sections": map[string]interface{}{
			"currentRecord":       strings.TrimSpace(sections["currentRecord"]),
			"nextStepPlan":        strings.TrimSpace(sections["nextStepPlan"]),
			"dreamScene":          strings.TrimSpace(sections["dreamScene"]),
			"supplementalSummary": strings.TrimSpace(sections["supplementalSummary"]),
		},
	}

	if result, err := json.Marshal(payload); err == nil {
		return string(result)
	}
	return fmt.Sprintf(`{"ok":true,"state":"sleeping","summary":%q,"sleepAt":%q}`, strings.TrimSpace(finalNote), sleepAt.Format(time.RFC3339))
}

func buildHeartbeatSleepHistoryToolCall(roundID string, response *types.SageResponse) types.ToolCall {
	if response != nil && response.SleepToolCall != nil {
		return *response.SleepToolCall
	}

	arguments := "{}"
	seel := ""
	if response != nil {
		seel = strings.TrimSpace(response.Seel)
		if response.SleepNote != nil {
			if buf, err := json.Marshal(response.SleepNote); err == nil {
				arguments = string(buf)
			}
		}
	}

	return types.ToolCall{
		ID:   fmt.Sprintf("heartbeat-sleep-%s-%s", strings.TrimSpace(roundID), seel),
		Type: "function",
		Function: types.ToolCallFunction{
			Name:      config.ResolveWannaSleepToolNameForSage(seel),
			Arguments: arguments,
		},
	}
}

func persistMergedWannaSleepMemoryEntryToNotebook(
	sessionID, roundID string,
	melchiorNote, balthazarNote, casperNote *types.WannaSleepTool,
	dominantSummary string,
	finalNote string,
	sleepAt time.Time,
) (*wannaSleepMemoryLocation, error) {
	accessScope, _ := resolveWorkspaceAIMainNotebookAccessScope()
	if accessScope == nil || accessScope.ActiveNotebook == nil || strings.TrimSpace(accessScope.ActiveNotebook.ID) == "" {
		return nil, nil
	}

	docID, docHPath, err := ensureMagiMemoryDoc(accessScope.ActiveNotebook.ID, sleepAt)
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(docID) == "" {
		return nil, fmt.Errorf("未能定位 MAGI 记忆文档")
	}

	record := buildMergedWannaSleepMemoryRecord(
		sessionID,
		roundID,
		melchiorNote,
		balthazarNote,
		casperNote,
		dominantSummary,
		finalNote,
		sleepAt,
	)
	recordJSON, err := json.MarshalIndent(record, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("序列化合并后的 wanna_sleep 记忆失败: %w", err)
	}

	markdown := "```json\n" + string(recordJSON) + "\n```"
	blockID, err := appendMarkdownBlock(docID, markdown)
	if err != nil {
		return nil, err
	}

	attrs := map[string]string{
		magiMemoryBlockAttr: "true",
		magiMemoryKindAttr:  config.WannaSleepMergedRecordName,
		magiToolNameAttr:    config.WannaSleepMergedRecordName,
		magiSleepAtAttr:     sleepAt.Format(time.RFC3339),
		magiSageAttr:        "all",
	}
	if strings.TrimSpace(roundID) != "" {
		attrs[magiRoundIDAttr] = strings.TrimSpace(roundID)
	}
	if strings.TrimSpace(sessionID) != "" {
		attrs[magiSessionIDAttr] = strings.TrimSpace(sessionID)
	}
	if err := model.SetBlockAttrs(blockID, attrs); err != nil {
		return nil, fmt.Errorf("设置合并后的 wanna_sleep 记忆块属性失败: %w", err)
	}

	return &wannaSleepMemoryLocation{
		BlockID:  blockID,
		DocID:    docID,
		DocHPath: docHPath,
	}, nil
}

func buildMergedWannaSleepMemoryRecord(
	sessionID, roundID string,
	melchiorNote, balthazarNote, casperNote *types.WannaSleepTool,
	dominantSummary string,
	finalNote string,
	sleepAt time.Time,
) map[string]interface{} {
	record := map[string]interface{}{
		"toolName": config.WannaSleepMergedRecordName,
		"summary":  strings.TrimSpace(finalNote),
		"sleepAt":  sleepAt.Format(time.RFC3339),
		"sections": map[string]interface{}{
			"currentRecord":       strings.TrimSpace(casperNote.Summary),
			"nextStepPlan":        strings.TrimSpace(melchiorNote.NextStepPlan),
			"dreamScene":          strings.TrimSpace(balthazarNote.DreamScene),
			"supplementalSummary": strings.TrimSpace(dominantSummary),
		},
		"rawNotes": map[string]interface{}{
			"melchior":  melchiorNote,
			"balthazar": balthazarNote,
			"casper":    casperNote,
		},
	}
	if strings.TrimSpace(sessionID) != "" {
		record["sessionId"] = strings.TrimSpace(sessionID)
	}
	if strings.TrimSpace(roundID) != "" {
		record["roundId"] = strings.TrimSpace(roundID)
	}
	return record
}
