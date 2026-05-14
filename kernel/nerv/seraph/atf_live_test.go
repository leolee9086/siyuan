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

// TestLiveATFSampling 使用真实 LLM 完成 ATF 采样全链路测试。
// 需要设置 SERAPH_ATF_LIVE=1 环境变量。
// LLM 配置从 .dev-workspace/conf/conf.json 读取。
func TestLiveATFSampling(t *testing.T) {
	if os.Getenv("SERAPH_ATF_LIVE") != "1" {
		t.Skip("set SERAPH_ATF_LIVE=1 to run live ATF sampling test")
	}

	// 从 dev-workspace conf.json 读取 AI 配置
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

	// 创建 ConfigManager（默认配置，含真实 MAGI 提示词）
	cfgManager := config.NewConfigManager("")
	cfgManager.SetPersonaProfile(marduk.GetReiPreset())
	t.Log("ConfigManager ready")

	// 创建三贤人（全部使用丽）
	melchior, err := sages.NewMelchior(cfgManager, client)
	if err != nil {
		t.Fatalf("NewMelchior: %v", err)
	}
	balthazar, err := sages.NewBalthazar(cfgManager, client)
	if err != nil {
		t.Fatalf("NewBalthazar: %v", err)
	}
	casper, err := sages.NewCasper(cfgManager, client)
	if err != nil {
		t.Fatalf("NewCasper: %v", err)
	}
	t.Logf("Sages: %s, %s, %s (all rei)", melchior.GetName(), balthazar.GetName(), casper.GetName())

	// 创建 Coordinator 和 Avatar
	coord := coordinator.NewCoordinator(60 * time.Second)
	payload := marduk.GetReiSubmissionPayload()
	avatar, err := dummysys.NewATFBaselineAvatar(client, payload.Descriptions.IntegratedDescription)
	if err != nil {
		t.Fatalf("NewATFBaselineAvatar: %v", err)
	}
	t.Log("Coordinator + Avatar ready")

	// 创建 Seraph 心理医生
	seraphTherapist, err := NewSeraphTherapist(client)
	if err != nil {
		t.Fatalf("NewSeraphTherapist: %v", err)
	}
	t.Log("Seraph therapist ready")

	// 创建 MAGIAnswerer 和 Monitor
	answerer := NewMAGIAnswerer(melchior, balthazar, casper, avatar, coord, seraphTherapist)
	opts := DefaultMonitorOptions()
	monitor := NewThreeBlindMonitor(answerer, &opts)
	subject := BuildReiSubject()
	t.Logf("Subject: %s, starting 1-round sampling...", subject.ID)

	ctx, cancel := context.WithTimeout(context.Background(), 1800*time.Second)
	defer cancel()

	telemetry, err := monitor.RunSamplingRounds(ctx, subject, 1, "melchior")
	if err != nil {
		t.Fatalf("RunSamplingRounds: %v", err)
	}

	round := telemetry.Rounds[0]
	fmt.Printf("C_int=%.6f C_ext=%.6f (C_int用作RawC) ρ=%.6f(%s) F_s=%.6f F_d=%.6f F=%.6f\n",
		round.CInt, round.CExt,
		round.SyncRate.Value, round.SyncRate.Zone,
		round.Strength.Static, round.Strength.Dynamic, round.Strength.Total)
	if round.SyncRate.Value < 0 {
		t.Fatal(fmt.Errorf("negative ρ: %f", round.SyncRate.Value))
	}
}
