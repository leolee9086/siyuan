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
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/llm"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/prompts"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/sages"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
	"github.com/siyuan-note/siyuan/kernel/nerv/marduk"
)

var persistMergedWannaSleepMemoryToNotebook = persistMergedWannaSleepMemoryEntryToNotebook
var persistMergedWannaRestMemoryToNotebook = persistMergedWannaRestMemoryEntryToNotebook

func (c *Coordinator) finalizeHeartbeatSleepRound(
	ctx context.Context,
	sessionID, roundID string,
	melchior, balthazar, casper *sages.Sage,
	responses []types.SageResponse,
) (string, *DominantElectionResult, error) {
	if c == nil {
		return "", nil, fmt.Errorf("coordinator is nil")
	}

	melchiorResp, balthazarResp, casperResp, err := resolveHeartbeatDowntimeResponses(responses)
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
			melchiorResp.DowntimeNote,
			balthazarResp.DowntimeNote,
			casperResp.DowntimeNote,
		),
	)
	if err != nil {
		return "", nil, fmt.Errorf("睡眠轮次主导者选举失败: %w", err)
	}

	dominantSage, err := resolveDominantSage(dominantResult, melchior, balthazar, casper)
	if err != nil {
		return "", nil, err
	}

	dominantSummary, err := synthesizeHeartbeatDowntimeWithDominant(
		ctx,
		sessionID,
		dominantSage,
		dominantResult,
		melchiorResp.DowntimeNote,
		balthazarResp.DowntimeNote,
		casperResp.DowntimeNote,
	)
	if err != nil {
		return "", nil, fmt.Errorf("主导者睡前笔记统合失败: %w", err)
	}

	finalNote := buildMergedHeartbeatSleepNote(
		melchiorResp.DowntimeNote,
		balthazarResp.DowntimeNote,
		casperResp.DowntimeNote,
		dominantSummary,
	)
	sections := buildMergedWannaSleepSections(
		melchiorResp.DowntimeNote,
		balthazarResp.DowntimeNote,
		casperResp.DowntimeNote,
		dominantSummary,
	)
	sleepAt := toolResultMemoryNow()

	if _, err := persistMergedWannaSleepMemoryToNotebook(
		sessionID,
		roundID,
		melchiorResp.DowntimeNote,
		balthazarResp.DowntimeNote,
		casperResp.DowntimeNote,
		dominantSummary,
		finalNote,
		sleepAt,
	); err != nil {
		logging.LogWarnf("归档合并后的 wanna_sleep 记忆失败 [%s]: %v", roundID, err)
	}

	// 深度休息：清理请求 deep=true 的贤人的上下文
	for _, entry := range []struct {
		sage *sages.Sage
		resp *types.SageResponse
	}{
		{melchior, melchiorResp},
		{balthazar, balthazarResp},
		{casper, casperResp},
	} {
		if entry.resp.DowntimeNote != nil && entry.resp.DowntimeNote.Deep {
			entry.sage.ClearContextSession(sessionID)
			_ = entry.sage.AddToContextWithSession(sessionID, types.ContextMessage{
				Role:    types.RoleSystem,
				Content: entry.sage.GetSystemPrompt(),
			})
		}
	}

	appendMergedWannaSleepHistory(sessionID, roundID, melchior, melchiorResp, finalNote, sections, sleepAt)
	appendMergedWannaSleepHistory(sessionID, roundID, balthazar, balthazarResp, finalNote, sections, sleepAt)
	appendMergedWannaSleepHistory(sessionID, roundID, casper, casperResp, finalNote, sections, sleepAt)

	return finalNote, dominantResult, nil
}

func (c *Coordinator) finalizeHeartbeatRestRound(
	ctx context.Context,
	sessionID, roundID string,
	melchior, balthazar, casper *sages.Sage,
	responses []types.SageResponse,
) (string, *DominantElectionResult, error) {
	if c == nil {
		return "", nil, fmt.Errorf("coordinator is nil")
	}

	melchiorResp, balthazarResp, casperResp, err := resolveHeartbeatDowntimeResponses(responses)
	if err != nil {
		return "", nil, err
	}

	dominantResult, err := electDominantSage(
		ctx,
		sessionID,
		melchior,
		balthazar,
		casper,
		buildHeartbeatRestDominantSituation(
			melchiorResp.DowntimeNote,
			balthazarResp.DowntimeNote,
			casperResp.DowntimeNote,
		),
	)
	if err != nil {
		return "", nil, fmt.Errorf("工作日志轮次主导者选举失败: %w", err)
	}

	dominantSage, err := resolveDominantSage(dominantResult, melchior, balthazar, casper)
	if err != nil {
		return "", nil, err
	}

	dominantSummary, err := synthesizeHeartbeatDowntimeWithDominant(
		ctx,
		sessionID,
		dominantSage,
		dominantResult,
		melchiorResp.DowntimeNote,
		balthazarResp.DowntimeNote,
		casperResp.DowntimeNote,
	)
	if err != nil {
		return "", nil, fmt.Errorf("主导者工作日志统合失败: %w", err)
	}

	finalNote := buildMergedHeartbeatRestNote(
		melchiorResp.DowntimeNote,
		balthazarResp.DowntimeNote,
		casperResp.DowntimeNote,
		dominantSummary,
	)
	sections := buildMergedWannaRestSections(
		melchiorResp.DowntimeNote,
		balthazarResp.DowntimeNote,
		casperResp.DowntimeNote,
		dominantSummary,
	)
	sleepAt := toolResultMemoryNow()

	if _, err := persistMergedWannaRestMemoryToNotebook(
		sessionID,
		roundID,
		melchiorResp.DowntimeNote,
		balthazarResp.DowntimeNote,
		casperResp.DowntimeNote,
		dominantSummary,
		finalNote,
		sleepAt,
	); err != nil {
		logging.LogWarnf("归档合并后的 wanna_rest 记忆失败 [%s]: %v", roundID, err)
	}

	// 深度休息：清理请求 deep=true 的贤人的上下文
	for _, entry := range []struct {
		sage *sages.Sage
		resp *types.SageResponse
	}{
		{melchior, melchiorResp},
		{balthazar, balthazarResp},
		{casper, casperResp},
	} {
		if entry.resp.DowntimeNote != nil && entry.resp.DowntimeNote.Deep {
			entry.sage.ClearContextSession(sessionID)
			_ = entry.sage.AddToContextWithSession(sessionID, types.ContextMessage{
				Role:    types.RoleSystem,
				Content: entry.sage.GetSystemPrompt(),
			})
		}
	}

	appendMergedWannaRestHistory(sessionID, roundID, melchior, melchiorResp, finalNote, sections, sleepAt)
	appendMergedWannaRestHistory(sessionID, roundID, balthazar, balthazarResp, finalNote, sections, sleepAt)
	appendMergedWannaRestHistory(sessionID, roundID, casper, casperResp, finalNote, sections, sleepAt)

	if melchiorResp.DowntimeNote != nil {
		c.collector.workLogHistory.append(sessionID, "melchior", melchiorResp.DowntimeNote.Summary)
	}
	if balthazarResp.DowntimeNote != nil {
		c.collector.workLogHistory.append(sessionID, "balthazar", balthazarResp.DowntimeNote.Summary)
	}
	if casperResp.DowntimeNote != nil {
		c.collector.workLogHistory.append(sessionID, "casper", casperResp.DowntimeNote.Summary)
	}

	return finalNote, dominantResult, nil
}

func resolveHeartbeatDowntimeResponses(responses []types.SageResponse) (melchior, balthazar, casper *types.SageResponse, err error) {
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
	case !melchior.WantsDowntime || melchior.DowntimeNote == nil:
		return nil, nil, nil, fmt.Errorf("Melchior 未提供有效的 wanna_sleep 笔记")
	case !balthazar.WantsDowntime || balthazar.DowntimeNote == nil:
		return nil, nil, nil, fmt.Errorf("Balthazar 未提供有效的 wanna_sleep 笔记")
	case !casper.WantsDowntime || casper.DowntimeNote == nil:
		return nil, nil, nil, fmt.Errorf("Casper 未提供有效的 wanna_sleep 笔记")
	default:
		return melchior, balthazar, casper, nil
	}
}

func buildHeartbeatSleepDominantSituation(
	melchiorNote, balthazarNote, casperNote *types.HeartbeatDowntimeTool,
) string {
	return strings.TrimSpace(strings.Join([]string{
		"当前处于心跳轮次的睡眠整理阶段。",
		"已有三则待连接的睡前笔记：",
		"1. 当前记录：" + strings.TrimSpace(casperNote.Summary),
		"2. 下一步计划：" + strings.TrimSpace(melchiorNote.NextStepPlan),
		"3. 画面式描述：" + strings.TrimSpace(balthazarNote.DreamScene),
	}, "\n"))
}

func buildHeartbeatRestDominantSituation(
	melchiorNote, balthazarNote, casperNote *types.HeartbeatDowntimeTool,
) string {
	return strings.TrimSpace(strings.Join([]string{
		"当前处于心跳轮次的工作日志整理阶段。",
		"已有三则待连接的工作日志：",
		"1. 当前记录：" + strings.TrimSpace(casperNote.Summary),
		"2. 下一步计划：" + strings.TrimSpace(melchiorNote.NextStepPlan),
		"3. 心情描述：" + strings.TrimSpace(balthazarNote.Mood),
	}, "\n"))
}

func synthesizeHeartbeatDowntimeWithDominant(
	ctx context.Context,
	sessionID string,
	dominantSage *sages.Sage,
	dominantResult *DominantElectionResult,
	melchiorNote, balthazarNote, casperNote *types.HeartbeatDowntimeTool,
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

	// 注入请求来源（心跳休眠合成路径），供前缀缓存监控日志定位调用方。
	ctx = llm.WithRequestSource(ctx, llm.RequestSource{
		SageName:    dominantSage.GetName(),
		DisplayName: dominantSage.GetDisplayName(),
		RequestType: "heartbeat-downtime",
		SessionID:   sessionID,
	})
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
	melchiorNote, balthazarNote, casperNote *types.HeartbeatDowntimeTool,
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
	melchiorNote, balthazarNote, casperNote *types.HeartbeatDowntimeTool,
	dominantSummary string,
) map[string]string {
	return map[string]string{
		"currentRecord":       strings.TrimSpace(casperNote.Summary),
		"nextStepPlan":        strings.TrimSpace(melchiorNote.NextStepPlan),
		"dreamScene":          strings.TrimSpace(balthazarNote.DreamScene),
		"supplementalSummary": strings.TrimSpace(dominantSummary),
	}
}

func buildMergedHeartbeatRestNote(
	melchiorNote, balthazarNote, casperNote *types.HeartbeatDowntimeTool,
	dominantSummary string,
) string {
	sections := buildMergedWannaRestSections(melchiorNote, balthazarNote, casperNote, dominantSummary)
	return strings.TrimSpace(strings.Join([]string{
		"当前的记录:\n" + sections["currentRecord"],
		"下一步的计划:\n" + sections["nextStepPlan"],
		"心情描述:\n" + sections["mood"],
		"补充整理描述:\n" + sections["supplementalSummary"],
	}, "\n\n"))
}

func buildMergedWannaRestSections(
	melchiorNote, balthazarNote, casperNote *types.HeartbeatDowntimeTool,
	dominantSummary string,
) map[string]string {
	return map[string]string{
		"currentRecord":       strings.TrimSpace(casperNote.Summary),
		"nextStepPlan":        strings.TrimSpace(melchiorNote.NextStepPlan),
		"mood":                strings.TrimSpace(balthazarNote.Mood),
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
	if sage == nil || response == nil || response.DowntimeNote == nil {
		return
	}

	assistantContent := strings.TrimSpace(response.DowntimeAssistantDraft)
	if assistantContent == "" {
		assistantContent = " "
	}
	toolCall := buildHeartbeatDowntimeHistoryToolCall(roundID, response)

	_ = sage.AddToContextWithSession(sessionID, types.ContextMessage{
		Role:             types.RoleAssistant,
		Content:          assistantContent,
		ReasoningContent: response.DowntimeReasoningDraft,
		ToolCalls:        []types.ToolCall{toolCall},
	})
	_ = sage.AddToContextWithSession(sessionID, types.ContextMessage{
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

func appendMergedWannaRestHistory(
	sessionID, roundID string,
	sage *sages.Sage,
	response *types.SageResponse,
	finalNote string,
	sections map[string]string,
	sleepAt time.Time,
) {
	if sage == nil || response == nil || response.DowntimeNote == nil {
		return
	}

	assistantContent := strings.TrimSpace(response.DowntimeAssistantDraft)
	if assistantContent == "" {
		assistantContent = " "
	}
	toolCall := buildHeartbeatDowntimeHistoryToolCall(roundID, response)

	_ = sage.AddToContextWithSession(sessionID, types.ContextMessage{
		Role:             types.RoleAssistant,
		Content:          assistantContent,
		ReasoningContent: response.DowntimeReasoningDraft,
		ToolCalls:        []types.ToolCall{toolCall},
	})
	_ = sage.AddToContextWithSession(sessionID, types.ContextMessage{
		Role:    types.RoleTool,
		Content: buildMergedWannaRestToolResult(finalNote, sections, sleepAt),
		ToolID:  toolCall.ID,
	})
}

func buildMergedWannaRestToolResult(
	finalNote string,
	sections map[string]string,
	sleepAt time.Time,
) string {
	payload := map[string]interface{}{
		"ok":      true,
		"state":   "rested",
		"summary": strings.TrimSpace(finalNote),
		"restAt":  sleepAt.Format(time.RFC3339),
		"sections": map[string]interface{}{
			"currentRecord":       strings.TrimSpace(sections["currentRecord"]),
			"nextStepPlan":        strings.TrimSpace(sections["nextStepPlan"]),
			"mood":                strings.TrimSpace(sections["mood"]),
			"supplementalSummary": strings.TrimSpace(sections["supplementalSummary"]),
		},
	}

	if result, err := json.Marshal(payload); err == nil {
		return string(result)
	}
	return fmt.Sprintf(`{"ok":true,"state":"rested","summary":%q,"restAt":%q}`, strings.TrimSpace(finalNote), sleepAt.Format(time.RFC3339))
}

func buildHeartbeatDowntimeHistoryToolCall(roundID string, response *types.SageResponse) types.ToolCall {
	if response != nil && response.DowntimeToolCall != nil {
		return *response.DowntimeToolCall
	}

	arguments := "{}"
	seel := ""
	if response != nil {
		seel = strings.TrimSpace(response.Seel)
		if response.DowntimeNote != nil {
			if buf, err := json.Marshal(response.DowntimeNote); err == nil {
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
	melchiorNote, balthazarNote, casperNote *types.HeartbeatDowntimeTool,
	dominantSummary string,
	finalNote string,
	sleepAt time.Time,
) (*downtimeMemoryLocation, error) {
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

	markdown := buildMergedSleepNoteCalloutMarkdown(
		sessionID,
		roundID,
		melchiorNote,
		balthazarNote,
		casperNote,
		dominantSummary,
		finalNote,
		sleepAt,
	)
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

	return &downtimeMemoryLocation{
		BlockID:  blockID,
		DocID:    docID,
		DocHPath: docHPath,
	}, nil
}

func buildMergedSleepNoteCalloutMarkdown(
	sessionID, roundID string,
	melchiorNote, balthazarNote, casperNote *types.HeartbeatDowntimeTool,
	dominantSummary string,
	finalNote string,
	sleepAt time.Time,
) string {
	fields := []CalloutField{
		{Label: "当前记录", Value: strings.TrimSpace(casperNote.Summary)},
		{Label: "下一步计划", Value: strings.TrimSpace(melchiorNote.NextStepPlan)},
		{Label: "画面式描述", Value: strings.TrimSpace(balthazarNote.DreamScene)},
		{Label: "补充整理描述", Value: strings.TrimSpace(dominantSummary)},
		{Label: "睡眠时间", Value: sleepAt.Format(time.RFC3339)},
	}
	if strings.TrimSpace(sessionID) != "" {
		fields = append(fields, CalloutField{Label: "会话", Value: strings.TrimSpace(sessionID)})
	}
	if strings.TrimSpace(roundID) != "" {
		fields = append(fields, CalloutField{Label: "轮次", Value: strings.TrimSpace(roundID)})
	}
	return BuildCalloutMarkdown("DREAM", "🌙 合并睡前笔记", fields...)
}

func persistMergedWannaRestMemoryEntryToNotebook(
	sessionID, roundID string,
	melchiorNote, balthazarNote, casperNote *types.HeartbeatDowntimeTool,
	dominantSummary string,
	finalNote string,
	sleepAt time.Time,
) (*downtimeMemoryLocation, error) {
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

	markdown := buildMergedRestNoteCalloutMarkdown(
		sessionID,
		roundID,
		melchiorNote,
		balthazarNote,
		casperNote,
		dominantSummary,
		finalNote,
		sleepAt,
	)
	blockID, err := appendMarkdownBlock(docID, markdown)
	if err != nil {
		return nil, err
	}

	attrs := map[string]string{
		magiMemoryBlockAttr: "true",
		magiMemoryKindAttr:  config.WannaRestMergedRecordName,
		magiToolNameAttr:    config.WannaRestMergedRecordName,
		magiRestAtAttr:      sleepAt.Format(time.RFC3339),
		magiSageAttr:        "all",
	}
	if strings.TrimSpace(roundID) != "" {
		attrs[magiRoundIDAttr] = strings.TrimSpace(roundID)
	}
	if strings.TrimSpace(sessionID) != "" {
		attrs[magiSessionIDAttr] = strings.TrimSpace(sessionID)
	}
	if err := model.SetBlockAttrs(blockID, attrs); err != nil {
		return nil, fmt.Errorf("设置合并后的 wanna_rest 记忆块属性失败: %w", err)
	}

	return &downtimeMemoryLocation{
		BlockID:  blockID,
		DocID:    docID,
		DocHPath: docHPath,
	}, nil
}

func buildMergedRestNoteCalloutMarkdown(
	sessionID, roundID string,
	melchiorNote, balthazarNote, casperNote *types.HeartbeatDowntimeTool,
	dominantSummary string,
	finalNote string,
	sleepAt time.Time,
) string {
	fields := []CalloutField{
		{Label: "当前记录", Value: strings.TrimSpace(casperNote.Summary)},
		{Label: "下一步计划", Value: strings.TrimSpace(melchiorNote.NextStepPlan)},
		{Label: "心情描述", Value: strings.TrimSpace(balthazarNote.Mood)},
		{Label: "补充整理描述", Value: strings.TrimSpace(dominantSummary)},
		{Label: "记录时间", Value: sleepAt.Format(time.RFC3339)},
	}
	if strings.TrimSpace(sessionID) != "" {
		fields = append(fields, CalloutField{Label: "会话", Value: strings.TrimSpace(sessionID)})
	}
	if strings.TrimSpace(roundID) != "" {
		fields = append(fields, CalloutField{Label: "轮次", Value: strings.TrimSpace(roundID)})
	}
	return BuildCalloutMarkdown("NOTE", "📋 合并工作日志", fields...)
}

// FinalizeHeartbeatInterrupted 提取被中断的心跳轮次中各贤者的工具调用摘要。
// 不要求三个贤者都完成，只提取已成功收集的部分。
// 每个贤者的字段策略与完整轮次一致：
//
//	Melchior - wanna_sleep_plan / wanna_rest_plan → nextStepPlan
//	Balthazar - wanna_sleep_dream / wanna_rest_dream → dreamScene / mood
//	Casper   - wanna_sleep_record / wanna_rest_record → summary
func FinalizeHeartbeatInterrupted(responses []types.SageResponse) string {
	var parts []string
	for _, resp := range responses {
		if resp.DowntimeNote == nil {
			continue
		}
		note := resp.DowntimeNote
		seel := strings.TrimSpace(resp.Seel)
		summary := strings.TrimSpace(note.Summary)
		switch seel {
		case "melchior":
			plan := strings.TrimSpace(note.NextStepPlan)
			if summary != "" {
				parts = append(parts, "Melchior: "+summary)
			}
			if plan != "" {
				parts = append(parts, "Melchior 计划: "+plan)
			}
		case "balthazar":
			dream := strings.TrimSpace(note.DreamScene)
			mood := strings.TrimSpace(note.Mood)
			if summary != "" {
				parts = append(parts, "Balthazar: "+summary)
			}
			if dream != "" {
				parts = append(parts, "Balthazar 画面: "+dream)
			}
			if mood != "" {
				parts = append(parts, "Balthazar 心情: "+mood)
			}
		case "casper":
			if summary != "" {
				parts = append(parts, "Casper: "+summary)
			}
		}
	}
	if len(parts) == 0 {
		return "心跳轮次因外部消息中断，未收集到落盘记录。"
	}
	return "心跳轮次因外部消息中断，已记录：\n" + strings.Join(parts, "\n")
}
