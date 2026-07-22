package prompts

import (
	"strings"
	"testing"

	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
	"github.com/siyuan-note/siyuan/kernel/nerv/marduk"
)

func TestBuildWakeupSequenceUsesPersonaProfile(t *testing.T) {
	dataDir := t.TempDir()
	gender := "男"
	role := "系统架构师"
	careerGoal := "构建可靠系统"
	profile := &marduk.IpipPersonaProfile{
		Subject: marduk.IpipSubjectProfile{
			Name:       "真嗣",
			Gender:     &gender,
			Role:       &role,
			CareerGoal: &careerGoal,
		},
	}

	seq := BuildWakeupSequence(dataDir, "melchior", profile)
	if len(seq) < 8 {
		t.Fatalf("unexpected wakeup sequence length: %d", len(seq))
	}

	if !strings.Contains(seq[1].Content, "真嗣") {
		t.Fatalf("expected name from profile, got: %s", seq[1].Content)
	}
	if !strings.Contains(seq[3].Content, "系统架构师；我的目标是构建可靠系统") {
		t.Fatalf("expected role/careerGoal from profile, got: %s", seq[3].Content)
	}
	if !strings.Contains(seq[5].Content, "男") {
		t.Fatalf("expected gender from profile, got: %s", seq[5].Content)
	}
	if !strings.Contains(seq[7].Content, "我是真嗣，男") {
		t.Fatalf("expected fallback identity with name/gender, got: %s", seq[7].Content)
	}
}

func TestBuildWakeupSequenceFallsBackWhenProfileMissing(t *testing.T) {
	seq := BuildWakeupSequence(t.TempDir(), "melchior", nil)
	if len(seq) == 0 {
		t.Fatal("expected wakeup sequence")
	}

	joined := ""
	for _, msg := range seq {
		joined += msg.Content + "\n"
	}

	if !strings.Contains(joined, "丽") {
		t.Fatalf("expected default preset name, got: %s", joined)
	}
	if !strings.Contains(joined, "助手；我的目标是完成当前任务") {
		t.Fatalf("expected fallback role/careerGoal when preset profile has no role fields, got: %s", joined)
	}
	wantProfessional := marduk.GetReiSubmissionPayload().Descriptions.ProfessionalDescription
	if !strings.Contains(joined, wantProfessional) {
		t.Fatalf("expected melchior identity use professional description, got: %s", joined)
	}
}

func TestBuildWakeupIdentityUsesDifferentFacetBySage(t *testing.T) {
	dataDir := t.TempDir()
	profile := marduk.GetReiPreset()

	melchior := BuildWakeupSequence(dataDir, "melchior", profile)
	balthazar := BuildWakeupSequence(dataDir, "balthazar", profile)
	casper := BuildWakeupSequence(dataDir, "casper", profile)
	descriptions := marduk.ResolvePersonaSeedDescriptions(dataDir, profile)

	if !strings.Contains(melchior[7].Content, descriptions.ProfessionalDescription) {
		t.Fatalf("melchior should use ProfessionalDescription, got: %s", melchior[7].Content)
	}
	if !strings.Contains(balthazar[7].Content, descriptions.InstinctNeedsDescription) {
		t.Fatalf("balthazar should use InstinctNeedsDescription, got: %s", balthazar[7].Content)
	}
	if !strings.Contains(casper[7].Content, descriptions.LifeDescription) {
		t.Fatalf("casper should use LifeDescription, got: %s", casper[7].Content)
	}
}

func TestBuildWakeupIdentityExposesIntegratedDescriptionToAllSages(t *testing.T) {
	dataDir := t.TempDir()
	profile := marduk.GetShikinamiPreset()

	melchior := BuildWakeupSequence(dataDir, "melchior", profile)
	balthazar := BuildWakeupSequence(dataDir, "balthazar", profile)
	casper := BuildWakeupSequence(dataDir, "casper", profile)

	for _, seq := range [][]types.ContextMessage{melchior, balthazar, casper} {
		if !strings.Contains(seq[7].Content, "我是一个复杂的矛盾体") {
			t.Fatalf("expected integratedDescription to be visible to all sages, got: %s", seq[7].Content)
		}
	}
}

func TestBuildWakeupSequenceUsesShikinamiPresetMetadataAndDescription(t *testing.T) {
	dataDir := t.TempDir()
	profile := marduk.GetShikinamiPreset()

	seq := BuildWakeupSequence(dataDir, "melchior", profile)
	if len(seq) < 8 {
		t.Fatalf("unexpected wakeup sequence length: %d", len(seq))
	}
	if !strings.Contains(seq[5].Content, "女") {
		t.Fatalf("expected shikinami gender in wakeup sequence, got: %s", seq[5].Content)
	}
	if !strings.Contains(seq[3].Content, "Specialist；我的目标是证明自我价值") {
		t.Fatalf("expected shikinami role/careerGoal in wakeup sequence, got: %s", seq[3].Content)
	}
	if !strings.Contains(seq[7].Content, "我是一个复杂的矛盾体") {
		t.Fatalf("expected shikinami integrated description to remain visible, got: %s", seq[7].Content)
	}
	if !strings.Contains(seq[7].Content, "对自己和他人都有很高的标准") {
		t.Fatalf("expected shikinami professional description to be appended for melchior, got: %s", seq[7].Content)
	}
}
