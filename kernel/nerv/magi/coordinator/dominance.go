package coordinator

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

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
	candidates, err := buildDominantCandidates(melchior, balthazar, casper)
	if err != nil {
		return nil, err
	}

	voters := []*sages.Sage{melchior, balthazar, casper}
	votes := make([]DominantElectionVote, 0, len(voters))
	totals := map[string]int{
		string(marduk.CognitiveStanceProfession):            0,
		string(marduk.CognitiveStancePrimarySocialRelation): 0,
		string(marduk.CognitiveStanceSelfName):              0,
	}

	for _, voter := range voters {
		if voter == nil {
			return nil, fmt.Errorf("dominant election voter is nil")
		}

		vote, voteErr := scoreDominantCandidate(ctx, sessionID, voter, situation, candidates)
		if voteErr != nil {
			return nil, voteErr
		}
		votes = append(votes, *vote)
		totals[string(marduk.CognitiveStanceProfession)] += vote.Profession
		totals[string(marduk.CognitiveStancePrimarySocialRelation)] += vote.SocialRelation
		totals[string(marduk.CognitiveStanceSelfName)] += vote.SelfName
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

func buildDominantCandidates(
	melchior, balthazar, casper *sages.Sage,
) ([]dominantCandidate, error) {
	if melchior == nil || balthazar == nil || casper == nil {
		return nil, fmt.Errorf("dominant candidates require melchior, balthazar and casper")
	}

	stances, err := marduk.ResolveCognitiveStances(melchior.GetProfile())
	if err != nil {
		return nil, fmt.Errorf("resolve cognitive stances failed: %w", err)
	}

	return []dominantCandidate{
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
	}, nil
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
	if len(candidates) != 3 {
		return nil, fmt.Errorf("dominant election expects exactly 3 candidates, got %d", len(candidates))
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
			Role: types.RoleUser,
			Content: prompts.BuildDominantElectionUserInput(
				situation,
				candidates[0].PromptLabel,
				candidates[1].PromptLabel,
				candidates[2].PromptLabel,
			),
		},
	)

	content, err := voter.GetLLMClient().SendChatRequestSync(timeoutCtx, messages, nil, nil)
	if err != nil {
		return nil, fmt.Errorf("[%s] dominant election request failed: %w", voter.GetDisplayName(), err)
	}

	var payload dominantVotePayload
	if err := decodeJSONObject(strings.TrimSpace(content), &payload); err != nil {
		return nil, fmt.Errorf("[%s] dominant election parse failed: %w", voter.GetDisplayName(), err)
	}

	scoreByKey, err := validateDominantVotePayload(payload, candidates)
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

func decodeJSONObject(raw string, target interface{}) error {
	cleaned := strings.TrimSpace(raw)
	cleaned = strings.TrimPrefix(cleaned, "```json")
	cleaned = strings.TrimPrefix(cleaned, "```")
	cleaned = strings.TrimSuffix(cleaned, "```")
	cleaned = strings.TrimSpace(cleaned)
	if cleaned == "" {
		return fmt.Errorf("empty JSON payload")
	}
	if err := json.Unmarshal([]byte(cleaned), target); err != nil {
		return fmt.Errorf("unmarshal JSON payload failed: %w | raw=%s", err, raw)
	}
	return nil
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
