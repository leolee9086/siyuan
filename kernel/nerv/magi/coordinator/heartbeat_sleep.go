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
)

var persistMergedWannaSleepMemoryToNotebook = persistMergedWannaSleepMemoryEntryToNotebook

func (c *Coordinator) finalizeHeartbeatSleepRound(
	ctx context.Context,
	sessionID, roundID string,
	melchior, balthazar, casper, trinity *sages.Sage,
	responses []types.SageResponse,
) (string, error) {
	if c == nil {
		return "", fmt.Errorf("coordinator is nil")
	}
	if trinity == nil {
		return "", fmt.Errorf("trinity is nil")
	}

	melchiorResp, balthazarResp, casperResp, err := resolveHeartbeatSleepResponses(responses)
	if err != nil {
		return "", err
	}

	trinityResult, err := c.trinity.HandleTrinitySummary(
		ctx,
		sessionID,
		roundID,
		trinity,
		[]types.SageResponse{
			{
				Seel:    "melchior",
				Content: buildHeartbeatSleepNoteForTrinity("melchior", melchiorResp.SleepNote),
			},
			{
				Seel:    "balthazar",
				Content: buildHeartbeatSleepNoteForTrinity("balthazar", balthazarResp.SleepNote),
			},
			{
				Seel:    "casper",
				Content: buildHeartbeatSleepNoteForTrinity("casper", casperResp.SleepNote),
			},
		},
		prompts.BuildTrinityHeartbeatSleepTask(),
	)
	if err != nil {
		return "", fmt.Errorf("Trinity 睡前笔记统合失败: %w", err)
	}

	trinitySummary := strings.TrimSpace(trinityResult.Content)
	if trinitySummary == "" {
		return "", fmt.Errorf("Trinity 睡前笔记统合为空")
	}

	finalNote := buildMergedHeartbeatSleepNote(
		melchiorResp.SleepNote,
		balthazarResp.SleepNote,
		casperResp.SleepNote,
		trinitySummary,
	)
	sections := buildMergedWannaSleepSections(
		melchiorResp.SleepNote,
		balthazarResp.SleepNote,
		casperResp.SleepNote,
		trinitySummary,
	)
	sleepAt := toolResultMemoryNow()

	if _, err := persistMergedWannaSleepMemoryToNotebook(
		sessionID,
		roundID,
		melchiorResp.SleepNote,
		balthazarResp.SleepNote,
		casperResp.SleepNote,
		trinitySummary,
		finalNote,
		sleepAt,
	); err != nil {
		logging.LogWarnf("归档合并后的 wanna_sleep 记忆失败 [%s]: %v", roundID, err)
	}

	appendMergedWannaSleepHistory(sessionID, roundID, melchior, melchiorResp, finalNote, sections, sleepAt)
	appendMergedWannaSleepHistory(sessionID, roundID, balthazar, balthazarResp, finalNote, sections, sleepAt)
	appendMergedWannaSleepHistory(sessionID, roundID, casper, casperResp, finalNote, sections, sleepAt)

	return finalNote, nil
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

func buildHeartbeatSleepNoteForTrinity(sageName string, note *types.WannaSleepTool) string {
	if note == nil {
		return ""
	}

	parts := make([]string, 0, 2)
	switch strings.TrimSpace(sageName) {
	case "melchior":
		if note.Summary != "" {
			parts = append(parts, "本轮检查与思考："+strings.TrimSpace(note.Summary))
		}
		if note.NextStepPlan != "" {
			parts = append(parts, "下一步计划："+strings.TrimSpace(note.NextStepPlan))
		}
	case "balthazar":
		if note.Summary != "" {
			parts = append(parts, "本轮感受与印象："+strings.TrimSpace(note.Summary))
		}
		if note.DreamScene != "" {
			parts = append(parts, "画面式描述："+strings.TrimSpace(note.DreamScene))
		}
	default:
		parts = append(parts, "当前记录："+strings.TrimSpace(note.Summary))
	}

	return strings.TrimSpace(strings.Join(parts, "\n"))
}

func buildMergedHeartbeatSleepNote(
	melchiorNote, balthazarNote, casperNote *types.WannaSleepTool,
	trinitySummary string,
) string {
	sections := buildMergedWannaSleepSections(melchiorNote, balthazarNote, casperNote, trinitySummary)
	return strings.TrimSpace(strings.Join([]string{
		"当前的记录：\n" + sections["currentRecord"],
		"下一步的计划：\n" + sections["nextStepPlan"],
		"画面式的描述：\n" + sections["dreamScene"],
		"Trinity的综合整合描述：\n" + sections["trinity"],
	}, "\n\n"))
}

func buildMergedWannaSleepSections(
	melchiorNote, balthazarNote, casperNote *types.WannaSleepTool,
	trinitySummary string,
) map[string]string {
	return map[string]string{
		"currentRecord": strings.TrimSpace(casperNote.Summary),
		"nextStepPlan":  strings.TrimSpace(melchiorNote.NextStepPlan),
		"dreamScene":    strings.TrimSpace(balthazarNote.DreamScene),
		"trinity":       strings.TrimSpace(trinitySummary),
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
			"currentRecord": strings.TrimSpace(sections["currentRecord"]),
			"nextStepPlan":  strings.TrimSpace(sections["nextStepPlan"]),
			"dreamScene":    strings.TrimSpace(sections["dreamScene"]),
			"trinity":       strings.TrimSpace(sections["trinity"]),
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
	trinitySummary string,
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
		trinitySummary,
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
	trinitySummary string,
	finalNote string,
	sleepAt time.Time,
) map[string]interface{} {
	record := map[string]interface{}{
		"toolName": config.WannaSleepMergedRecordName,
		"summary":  strings.TrimSpace(finalNote),
		"sleepAt":  sleepAt.Format(time.RFC3339),
		"sections": map[string]interface{}{
			"currentRecord": strings.TrimSpace(casperNote.Summary),
			"nextStepPlan":  strings.TrimSpace(melchiorNote.NextStepPlan),
			"dreamScene":    strings.TrimSpace(balthazarNote.DreamScene),
			"trinity":       strings.TrimSpace(trinitySummary),
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
