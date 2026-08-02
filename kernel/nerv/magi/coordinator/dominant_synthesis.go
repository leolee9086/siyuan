package coordinator

import (
	"context"
	"fmt"
	"strings"

	"github.com/siyuan-note/siyuan/kernel/nerv/magi/llm"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/prompts"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/sages"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
	"github.com/siyuan-note/siyuan/kernel/nerv/marduk"
)

type DominantSynthesisResult struct {
	Content                string
	DominantElectionResult *DominantElectionResult
}

func (c *Coordinator) SynthesizeResponsesWithDominant(
	ctx context.Context,
	sessionID string,
	melchior, balthazar, casper *sages.Sage,
	originalTask string,
	responses []types.SageResponse,
) (*DominantSynthesisResult, error) {
	if len(responses) == 0 {
		return nil, fmt.Errorf("dominant synthesis responses are empty")
	}

	election, err := electDominantSage(
		ctx,
		sessionID,
		melchior,
		balthazar,
		casper,
		buildDominantConsensusSituation(originalTask, responses),
	)
	if err != nil {
		return nil, fmt.Errorf("dominant synthesis election failed: %w", err)
	}

	dominantSage, err := resolveDominantSage(election, melchior, balthazar, casper)
	if err != nil {
		return nil, err
	}

	workingSage := dominantSage.CloneWithFreshContext()
	if workingSage == nil {
		return nil, fmt.Errorf("dominant synthesis sage clone is nil")
	}

	stances, err := marduk.ResolveCognitiveStances(dominantSage.GetProfile())
	if err != nil {
		return nil, fmt.Errorf("resolve cognitive stances failed: %w", err)
	}

	requestMessages := workingSage.BuildRequestMessagesForSession(
		sessionID,
		types.ContextMessage{
			Role:    types.RoleUser,
			Content: prompts.BuildDominantConsensusSynthesisPrompt(election.DominantStance),
		},
		types.ContextMessage{
			Role: types.RoleUser,
			Content: prompts.BuildDominantConsensusSynthesisInput(
				buildDominantPromptLabel(marduk.CognitiveStanceProfession, stances.Profession),
				buildDominantPromptLabel(marduk.CognitiveStancePrimarySocialRelation, stances.PrimarySocialRelation),
				buildDominantPromptLabel(marduk.CognitiveStanceSelfName, stances.SelfName),
				originalTask,
				findDominantSynthesisResponseContent(responses, "melchior"),
				findDominantSynthesisResponseContent(responses, "balthazar"),
				findDominantSynthesisResponseContent(responses, "casper"),
			),
		},
	)

	// 注入请求来源（主导合成路径），供前缀缓存监控日志定位调用方。
	ctx = llm.WithRequestSource(ctx, llm.RequestSource{
		SageName:    workingSage.GetName(),
		DisplayName: workingSage.GetDisplayName(),
		RequestType: "dominant-synthesis",
		SessionID:   sessionID,
	})
	content, err := workingSage.GetLLMClient().SendChatRequestSync(ctx, requestMessages, nil, nil)
	if err != nil {
		return nil, err
	}
	content = strings.TrimSpace(content)
	if content == "" {
		return nil, fmt.Errorf("dominant synthesis content is empty")
	}

	return &DominantSynthesisResult{
		Content:                content,
		DominantElectionResult: election,
	}, nil
}

func buildDominantConsensusSituation(
	originalTask string,
	responses []types.SageResponse,
) string {
	return strings.TrimSpace(strings.Join([]string{
		"当前需要给出一份单一最终答复。",
		"原始任务：",
		strings.TrimSpace(originalTask),
		"三份已有判断：",
		"[melchior] " + findDominantSynthesisResponseContent(responses, "melchior"),
		"[balthazar] " + findDominantSynthesisResponseContent(responses, "balthazar"),
		"[casper] " + findDominantSynthesisResponseContent(responses, "casper"),
	}, "\n"))
}

func findDominantSynthesisResponseContent(responses []types.SageResponse, seel string) string {
	for _, response := range responses {
		if strings.EqualFold(strings.TrimSpace(response.Seel), strings.TrimSpace(seel)) {
			return strings.TrimSpace(response.Content)
		}
	}
	return ""
}
