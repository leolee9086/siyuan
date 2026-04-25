package prompts

import (
	"strings"
	"testing"
)

func TestBuildDominantElectionSystemPrompt_AvoidsOutOfBandConcepts(t *testing.T) {
	prompt := BuildDominantElectionSystemPrompt("Melchior")

	disallowed := []string{
		"贤者",
		"三位一体",
		"人格切换",
		"投票机制",
		"幕后设定",
		"候选立场",
		`"stance"`,
		"只输出 JSON",
		`"candidate"`,
		`"score"`,
	}
	for _, token := range disallowed {
		if strings.Contains(prompt, token) {
			t.Fatalf("prompt should not contain %q, got: %s", token, prompt)
		}
	}

	required := []string{
		"打分",
		"reason 不超过 48 个字",
	}
	for _, token := range required {
		if !strings.Contains(prompt, token) {
			t.Fatalf("prompt should contain %q, got: %s", token, prompt)
		}
	}
}

func TestBuildDominantElectionUserInput_UsesDescriptionsInsteadOfStances(t *testing.T) {
	input := BuildDominantElectionUserInput(
		"当前收到新的外部消息。",
		"作为科学家的你",
		"作为母亲的你",
		"仅作为赤城直子本人的你",
	)

	if strings.Contains(input, "立场") {
		t.Fatalf("user input should avoid stance wording, got: %s", input)
	}
	required := []string{
		"作为科学家的你",
		"作为母亲的你",
		"仅作为赤城直子本人的你",
	}
	for _, token := range required {
		if !strings.Contains(input, token) {
			t.Fatalf("user input should contain %q, got: %s", token, input)
		}
	}
}
