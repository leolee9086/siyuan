package coordinator

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/sashabaranov/go-openai"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/config"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/prompts"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/sages"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
	"github.com/siyuan-note/siyuan/kernel/nerv/marduk"
)

const dominantElectionTimeout = 30 * time.Second

type dominantCandidate struct {
	Key         marduk.CognitiveStanceKey
	SeelName    string
	DisplayName string
	Stance      string
	PromptLabel string
}

type dominantVoteScore struct {
	Candidate string `json:"candidate"`
	Score     int    `json:"score"`
}

type dominantVotePayload struct {
	Scores []dominantVoteScore `json:"scores"`
	Reason string              `json:"reason"`
}

type DominantElectionVote struct {
	VoterSeelName    string
	VoterDisplayName string
	Profession       int
	SocialRelation   int
	SelfName         int
	Reason           string
}

type DominantElectionResult struct {
	DominantSeelName    string
	DominantDisplayName string
	DominantStance      string
	AggregatedScores    map[string]int
	Votes               []DominantElectionVote
}

func electDominantSage(
	ctx context.Context,
	sessionID string,
	melchior, balthazar, casper *sages.Sage,
	situation string,
) (*DominantElectionResult, error) {
	return electDominantSageWithExclusionsAndSituations(ctx, sessionID, melchior, balthazar, casper, situation, nil, nil)
}

func buildDominantCandidates(
	melchior, balthazar, casper *sages.Sage,
) ([]dominantCandidate, error) {
	return buildDominantCandidatesWithExclusions(melchior, balthazar, casper, nil)
}

func electDominantSageWithExclusions(
	ctx context.Context,
	sessionID string,
	melchior, balthazar, casper *sages.Sage,
	situation string,
	excludedSeels map[string]struct{},
) (*DominantElectionResult, error) {
	return electDominantSageWithExclusionsAndSituations(
		ctx,
		sessionID,
		melchior,
		balthazar,
		casper,
		situation,
		nil,
		excludedSeels,
	)
}

func electDominantSageWithExclusionsAndSituations(
	ctx context.Context,
	sessionID string,
	melchior, balthazar, casper *sages.Sage,
	defaultSituation string,
	situationBySeel map[string]string,
	excludedSeels map[string]struct{},
) (*DominantElectionResult, error) {
	candidates, err := buildDominantCandidatesWithExclusions(melchior, balthazar, casper, excludedSeels)
	if err != nil {
		return nil, err
	}
	if len(candidates) == 0 {
		return nil, fmt.Errorf("dominant election has no available candidates")
	}
	if len(candidates) == 1 {
		winner := candidates[0]
		return &DominantElectionResult{
			DominantSeelName:    winner.SeelName,
			DominantDisplayName: winner.DisplayName,
			DominantStance:      winner.Stance,
			AggregatedScores: map[string]int{
				string(winner.Key): 100,
			},
		}, nil
	}

	voters := []*sages.Sage{melchior, balthazar, casper}
	votes := make([]DominantElectionVote, 0, len(voters))
	totals := map[string]int{}
	for _, candidate := range candidates {
		totals[string(candidate.Key)] = 0
	}

	for _, voter := range voters {
		if voter == nil {
			return nil, fmt.Errorf("dominant election voter is nil")
		}

		vote, voteErr := scoreDominantCandidate(
			ctx,
			sessionID,
			voter,
			resolveDominantSituationForSage(voter, defaultSituation, situationBySeel),
			candidates,
		)
		if voteErr != nil {
			return nil, voteErr
		}
		votes = append(votes, *vote)
		for _, candidate := range candidates {
			totals[string(candidate.Key)] += dominantVoteScoreForCandidate(*vote, candidate.Key)
		}
	}

	winner := candidates[0]
	winnerScore := totals[string(winner.Key)]
	for _, candidate := range candidates[1:] {
		score := totals[string(candidate.Key)]
		if score > winnerScore {
			winner = candidate
			winnerScore = score
		}
	}

	return &DominantElectionResult{
		DominantSeelName:    winner.SeelName,
		DominantDisplayName: winner.DisplayName,
		DominantStance:      winner.Stance,
		AggregatedScores:    totals,
		Votes:               votes,
	}, nil
}

func resolveDominantSituationForSage(
	voter *sages.Sage,
	defaultSituation string,
	situationBySeel map[string]string,
) string {
	if voter == nil || len(situationBySeel) == 0 {
		return defaultSituation
	}
	if situation := strings.TrimSpace(situationBySeel[strings.TrimSpace(voter.GetName())]); situation != "" {
		return situation
	}
	return defaultSituation
}

func buildDominantCandidatesWithExclusions(
	melchior, balthazar, casper *sages.Sage,
	excludedSeels map[string]struct{},
) ([]dominantCandidate, error) {
	if melchior == nil || balthazar == nil || casper == nil {
		return nil, fmt.Errorf("dominant candidates require melchior, balthazar and casper")
	}

	stances, err := marduk.ResolveCognitiveStances(melchior.GetProfile())
	if err != nil {
		return nil, fmt.Errorf("resolve cognitive stances failed: %w", err)
	}

	allCandidates := []dominantCandidate{
		{
			Key:         marduk.CognitiveStanceProfession,
			SeelName:    melchior.GetName(),
			DisplayName: melchior.GetDisplayName(),
			Stance:      stances.LabelForKey(marduk.CognitiveStanceProfession),
			PromptLabel: buildDominantPromptLabel(marduk.CognitiveStanceProfession, stances.LabelForKey(marduk.CognitiveStanceProfession)),
		},
		{
			Key:         marduk.CognitiveStancePrimarySocialRelation,
			SeelName:    balthazar.GetName(),
			DisplayName: balthazar.GetDisplayName(),
			Stance:      stances.LabelForKey(marduk.CognitiveStancePrimarySocialRelation),
			PromptLabel: buildDominantPromptLabel(marduk.CognitiveStancePrimarySocialRelation, stances.LabelForKey(marduk.CognitiveStancePrimarySocialRelation)),
		},
		{
			Key:         marduk.CognitiveStanceSelfName,
			SeelName:    casper.GetName(),
			DisplayName: casper.GetDisplayName(),
			Stance:      stances.LabelForKey(marduk.CognitiveStanceSelfName),
			PromptLabel: buildDominantPromptLabel(marduk.CognitiveStanceSelfName, stances.LabelForKey(marduk.CognitiveStanceSelfName)),
		},
	}

	if len(excludedSeels) == 0 {
		return allCandidates, nil
	}

	filtered := make([]dominantCandidate, 0, len(allCandidates))
	for _, candidate := range allCandidates {
		if _, excluded := excludedSeels[strings.TrimSpace(candidate.SeelName)]; excluded {
			continue
		}
		filtered = append(filtered, candidate)
	}
	return filtered, nil
}

func scoreDominantCandidate(
	ctx context.Context,
	sessionID string,
	voter *sages.Sage,
	situation string,
	candidates []dominantCandidate,
) (*DominantElectionVote, error) {
	if voter == nil {
		return nil, fmt.Errorf("dominant election voter is nil")
	}
	if len(candidates) < 2 || len(candidates) > 3 {
		return nil, fmt.Errorf("dominant election expects 2 or 3 candidates, got %d", len(candidates))
	}

	timeoutCtx, cancel := context.WithTimeout(ctx, dominantElectionTimeout)
	defer cancel()

	messages := voter.BuildRequestMessagesForSession(
		sessionID,
		types.ContextMessage{
			Role:    types.RoleSystem,
			Content: prompts.BuildDominantElectionSystemPrompt(voter.GetDisplayName()),
		},
		types.ContextMessage{
			Role:    types.RoleUser,
			Content: prompts.BuildDominantElectionUserInputForCandidates(situation, collectDominantPromptLabels(candidates)...),
		},
	)

	toolDef := config.BuildDominantElectionToolDef()
	tools := []openai.Tool{buildRuntimeTool(toolDef)}
	toolChoice := buildRequiredFunctionToolChoice(config.DominantElectionToolName)

	result, err := voter.GetLLMClient().SendChatRequestSyncDetailed(timeoutCtx, messages, tools, toolChoice)
	if err != nil {
		return nil, fmt.Errorf("[%s] dominant election request failed: %w", voter.GetDisplayName(), err)
	}

	payload, err := parseDominantElectionToolCall(result, voter.GetDisplayName(), candidates)
	if err != nil {
		return nil, err
	}

	scoreByKey, err := validateDominantVotePayload(*payload, candidates)
	if err != nil {
		return nil, fmt.Errorf("[%s] dominant election payload invalid: %w", voter.GetDisplayName(), err)
	}

	return &DominantElectionVote{
		VoterSeelName:    voter.GetName(),
		VoterDisplayName: voter.GetDisplayName(),
		Profession:       scoreByKey[string(marduk.CognitiveStanceProfession)],
		SocialRelation:   scoreByKey[string(marduk.CognitiveStancePrimarySocialRelation)],
		SelfName:         scoreByKey[string(marduk.CognitiveStanceSelfName)],
		Reason:           strings.TrimSpace(payload.Reason),
	}, nil
}

func parseDominantElectionToolCall(result *types.SyncChatResult, displayName string, candidates []dominantCandidate) (*dominantVotePayload, error) {
	if result == nil {
		return nil, fmt.Errorf("[%s] dominant election result is nil", displayName)
	}
	if len(result.ToolCalls) != 1 {
		return nil, fmt.Errorf("[%s] dominant election must call %s exactly once, got %d", displayName, config.DominantElectionToolName, len(result.ToolCalls))
	}

	toolCall := result.ToolCalls[0]
	if strings.TrimSpace(toolCall.Function.Name) != config.DominantElectionToolName {
		return nil, fmt.Errorf("[%s] dominant election unexpected tool call: %s", displayName, toolCall.Function.Name)
	}

	rawArgs := strings.TrimSpace(toolCall.Function.Arguments)
	if rawArgs == "" {
		return nil, fmt.Errorf("[%s] dominant election tool call arguments are empty", displayName)
	}

	var payload dominantVotePayload
	if err := json.Unmarshal([]byte(rawArgs), &payload); err != nil {
		return nil, fmt.Errorf("[%s] dominant election parse failed: %w | raw=%s", displayName, err, rawArgs)
	}

	return &payload, nil
}

func resolveDominantSage(
	election *DominantElectionResult,
	melchior, balthazar, casper *sages.Sage,
) (*sages.Sage, error) {
	if election == nil {
		return nil, fmt.Errorf("dominant election result is nil")
	}

	switch strings.TrimSpace(election.DominantSeelName) {
	case strings.TrimSpace(melchior.GetName()):
		return melchior, nil
	case strings.TrimSpace(balthazar.GetName()):
		return balthazar, nil
	case strings.TrimSpace(casper.GetName()):
		return casper, nil
	default:
		return nil, fmt.Errorf("unknown dominant seel: %s", election.DominantSeelName)
	}
}

func buildDominantPromptLabel(key marduk.CognitiveStanceKey, stance string) string {
	switch key {
	case marduk.CognitiveStanceSelfName:
		return fmt.Sprintf("仅作为%s本人的你", strings.TrimSpace(stance))
	default:
		return fmt.Sprintf("作为%s的你", strings.TrimSpace(stance))
	}
}

func validateDominantVotePayload(
	payload dominantVotePayload,
	candidates []dominantCandidate,
) (map[string]int, error) {
	if len(payload.Scores) != len(candidates) {
		return nil, fmt.Errorf("scores length mismatch: got %d want %d", len(payload.Scores), len(candidates))
	}

	expected := make(map[string]dominantCandidate, len(candidates))
	for _, candidate := range candidates {
		expected[candidate.PromptLabel] = candidate
	}
	resolved := make(map[string]int, len(candidates))

	for _, scoreItem := range payload.Scores {
		label := strings.TrimSpace(scoreItem.Candidate)
		candidate, ok := expected[label]
		if !ok {
			return nil, fmt.Errorf("unexpected candidate label: %s", label)
		}
		if scoreItem.Score < 0 || scoreItem.Score > 100 {
			return nil, fmt.Errorf("score out of range for %s: %d", label, scoreItem.Score)
		}
		key := string(candidate.Key)
		if _, exists := resolved[key]; exists {
			return nil, fmt.Errorf("duplicate candidate label: %s", label)
		}
		resolved[key] = scoreItem.Score
	}

	for _, candidate := range candidates {
		key := string(candidate.Key)
		if _, ok := resolved[key]; !ok {
			return nil, fmt.Errorf("missing candidate label: %s", candidate.PromptLabel)
		}
	}

	return resolved, nil
}

func dominantVoteScoreForCandidate(vote DominantElectionVote, key marduk.CognitiveStanceKey) int {
	switch key {
	case marduk.CognitiveStanceProfession:
		return vote.Profession
	case marduk.CognitiveStancePrimarySocialRelation:
		return vote.SocialRelation
	case marduk.CognitiveStanceSelfName:
		return vote.SelfName
	default:
		return 0
	}
}

func collectDominantPromptLabels(candidates []dominantCandidate) []string {
	ret := make([]string, 0, len(candidates))
	for _, candidate := range candidates {
		if label := strings.TrimSpace(candidate.PromptLabel); label != "" {
			ret = append(ret, label)
		}
	}
	return ret
}
