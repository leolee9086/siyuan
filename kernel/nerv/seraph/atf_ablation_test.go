package seraph

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/siyuan-note/siyuan/kernel/conf"
	"github.com/siyuan-note/siyuan/kernel/nerv/dummysys"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/config"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/coordinator"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/llm"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/sages"
	"github.com/siyuan-note/siyuan/kernel/nerv/marduk"
)

// TestAblationThreePersonas 消融测试：使用三个完全不同人格（绫波/式波/薰）验证 C_int 显著降低。
// 三个 OCEAN profile：
//   绫波（低E/高C/低N），式波（高E/高C/低A），薰（高O/高A/低N）
// 预期：C_int 应明显低于全 Rei 测试的 0.95，接近 ~0.6–0.7。
func TestAblationThreePersonas(t *testing.T) {
	if os.Getenv("SERAPH_ATF_LIVE") != "1" {
		t.Skip("set SERAPH_ATF_LIVE=1 to run ablation test")
	}

	client, cfgManager := setupATFLiveEnv(t)
	dominantDesc := marduk.GetReiSubmissionPayload().Descriptions.IntegratedDescription

	type personaSlot struct {
		name    string
		profile *marduk.IpipPersonaProfile
	}
	slots := []personaSlot{
		{name: "melchior", profile: marduk.GetReiPreset()},
		{name: "balthazar", profile: marduk.GetShikinamiPreset()},
		{name: "casper", profile: marduk.GetKaoruPreset()},
	}

	var melchior, balthazar, casper *sages.Sage
	for _, s := range slots {
		sage := createSage(t, cfgManager, client, s.name)
		sage.SetProfile(s.profile)
		switch s.name {
		case "melchior":
			melchior = sage
		case "balthazar":
			balthazar = sage
		case "casper":
			casper = sage
		}
	}
	t.Logf("Sages: melchior=%s, balthazar=%s, casper=%s",
		marduk.GetReiPreset().Subject.Name, marduk.GetShikinamiPreset().Subject.Name, marduk.GetKaoruPreset().Subject.Name)

	avatar, err := dummysys.NewATFBaselineAvatar(client, dominantDesc)
	if err != nil {
		t.Fatalf("NewATFBaselineAvatar: %v", err)
	}

	coord := coordinator.NewCoordinator(60 * time.Second)
	seraphTherapist, err := NewSeraphTherapist(client)
	if err != nil {
		t.Fatalf("NewSeraphTherapist: %v", err)
	}

	answerer := NewMAGIAnswerer(melchior, balthazar, casper, avatar, coord, seraphTherapist)
	opts := DefaultMonitorOptions()
	monitor := NewThreeBlindMonitor(answerer, &opts)
	subject := BuildReiSubject()

	ctx, cancel := context.WithTimeout(context.Background(), 1800*time.Second)
	defer cancel()

	telemetry, err := monitor.RunSamplingRounds(ctx, subject, 1, "melchior")
	if err != nil {
		t.Fatalf("RunSamplingRounds: %v", err)
	}

	round := telemetry.Rounds[0]
	fmt.Printf("C_int=%.6f C_ext=%.6f ρ=%.6f(%s)\n",
		round.CInt, round.CExt, round.SyncRate.Value, round.SyncRate.Zone)

	if round.CInt > 0.85 {
		t.Errorf("C_int=%.6f — 三个不同人格(Rei/Shikinami/Kaoru)应显著低于全Rei基线(0.95), 期望~0.65, 当前未有效区分", round.CInt)
	}
}

// TestAblationSamePersonaControl 对照测试：同一人格（全 Rei）验证 C_int 接近 1.0。
// 与 TestLiveATFSampling 逻辑相同，用于对比基线。
func TestAblationSamePersonaControl(t *testing.T) {
	if os.Getenv("SERAPH_ATF_LIVE") != "1" {
		t.Skip("set SERAPH_ATF_LIVE=1 to run control test")
	}

	client, cfgManager := setupATFLiveEnv(t)
	reiDesc := marduk.GetReiSubmissionPayload().Descriptions.IntegratedDescription

	melchior := createSage(t, cfgManager, client, "melchior")
	balthazar := createSage(t, cfgManager, client, "balthazar")
	casper := createSage(t, cfgManager, client, "casper")
	t.Log("Sages: all rei (control)")

	avatar, err := dummysys.NewATFBaselineAvatar(client, reiDesc)
	if err != nil {
		t.Fatalf("NewATFBaselineAvatar: %v", err)
	}

	coord := coordinator.NewCoordinator(60 * time.Second)
	seraphTherapist, err := NewSeraphTherapist(client)
	if err != nil {
		t.Fatalf("NewSeraphTherapist: %v", err)
	}

	answerer := NewMAGIAnswerer(melchior, balthazar, casper, avatar, coord, seraphTherapist)
	opts := DefaultMonitorOptions()
	monitor := NewThreeBlindMonitor(answerer, &opts)
	subject := BuildReiSubject()

	ctx, cancel := context.WithTimeout(context.Background(), 1800*time.Second)
	defer cancel()

	telemetry, err := monitor.RunSamplingRounds(ctx, subject, 1, "melchior")
	if err != nil {
		t.Fatalf("RunSamplingRounds: %v", err)
	}

	round := telemetry.Rounds[0]
	fmt.Printf("C_int=%.6f C_ext=%.6f ρ=%.6f(%s)\n",
		round.CInt, round.CExt, round.SyncRate.Value, round.SyncRate.Zone)

	if round.CInt < 0.85 {
		t.Errorf("C_int=%.6f — 同一人格应接近1.0", round.CInt)
	}
}

// --- shared helpers ---

// setupATFLiveEnv 创建 LLM client 和 ConfigManager（Rei 基调）。
func setupATFLiveEnv(t *testing.T) (llm.Client, *config.ConfigManager) {
	t.Helper()

	cwd, _ := os.Getwd()
	confPath := filepath.Join(cwd, "..", "..", "..", ".dev-workspace", "conf", "conf.json")
	data, err := os.ReadFile(confPath)
	if err != nil {
		t.Fatalf("read conf.json: %v", err)
	}
	var raw struct {
		AI *struct {
			OpenAI *conf.OpenAI `json:"openAI"`
		} `json:"ai"`
	}
	if err := json.Unmarshal(data, &raw); err != nil {
		t.Fatalf("parse conf.json: %v", err)
	}
	if raw.AI == nil || raw.AI.OpenAI == nil {
		t.Fatal("ai.openAI not found in conf.json")
	}
	openAICfg := raw.AI.OpenAI
	t.Logf("LLM config: model=%s provider=%s", openAICfg.APIModel, openAICfg.APIProvider)

	client := llm.NewClientFromConf(openAICfg)
	if client == nil {
		t.Fatal("failed to create LLM client")
	}
	t.Log("LLM client created")

	cfgManager := config.NewConfigManager("")
	cfgManager.SetPersonaProfile(marduk.GetReiPreset())
	t.Log("ConfigManager ready")
	return client, cfgManager
}

// createSage 根据名称创建贤者实例（使用 cfgManager 的全局基调）。
func createSage(t *testing.T, cfgManager *config.ConfigManager, client llm.Client, name string) *sages.Sage {
	t.Helper()

	var sage *sages.Sage
	var err error
	switch name {
	case "melchior":
		sage, err = sages.NewMelchior(cfgManager, client)
	case "balthazar":
		sage, err = sages.NewBalthazar(cfgManager, client)
	case "casper":
		sage, err = sages.NewCasper(cfgManager, client)
	default:
		t.Fatalf("unknown sage name: %s", name)
	}
	if err != nil {
		t.Fatalf("New%s: %v", name, err)
	}
	return sage
}
