package prompts

import (
	"strings"
	"testing"

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
	seq := BuildWakeupSequence(t.TempDir(), "trinity", nil)
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
	if !strings.Contains(joined, "我是一个高度理性、任务导向的个体") {
		t.Fatalf("expected trinity identity use IntegratedDescription, got: %s", joined)
	}
	if !strings.Contains(joined, "<source=trigger>") {
		t.Fatalf("expected trinity trigger message, got: %s", joined)
	}
}

func TestBuildWakeupIdentityUsesDifferentFacetBySage(t *testing.T) {
	dataDir := t.TempDir()
	profile := marduk.GetReiPreset()

	melchior := BuildWakeupSequence(dataDir, "melchior", profile)
	balthazar := BuildWakeupSequence(dataDir, "balthazar", profile)
	casper := BuildWakeupSequence(dataDir, "casper", profile)
	trinity := BuildWakeupSequence(dataDir, "trinity", profile)

	if !strings.Contains(melchior[7].Content, "作为专业人员，我的职责是执行收到任务") {
		t.Fatalf("melchior should use ProfessionalDescription, got: %s", melchior[7].Content)
	}
	if !strings.Contains(balthazar[7].Content, "我的基础需求是完成被赋予的使命") {
		t.Fatalf("balthazar should use InstinctNeedsDescription, got: %s", balthazar[7].Content)
	}
	if !strings.Contains(casper[7].Content, "我的日常生活简单而有序") {
		t.Fatalf("casper should use LifeDescription, got: %s", casper[7].Content)
	}
	if !strings.Contains(trinity[7].Content, "我是一个高度理性、任务导向的个体") {
		t.Fatalf("trinity should use IntegratedDescription, got: %s", trinity[7].Content)
	}
}
