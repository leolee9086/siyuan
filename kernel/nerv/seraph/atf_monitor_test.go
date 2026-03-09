package seraph

import (
	"testing"
)

func TestQuestionSamplerTargetedRatio(t *testing.T) {
	sampler := NewQuestionSamplerWithSeed(42)
	questions := sampler.SampleForEntity(EntityMelchior, 10)
	if len(questions) != 10 {
		t.Fatalf("expected 10 questions, got %d", len(questions))
	}

	primary := 0
	for _, q := range questions {
		if GetDomainCategory(q.Domain) == CategoryCognitive {
			primary++
		}
	}
	if primary < 7 { // 80/20 抽样在离散情况下允许轻微偏差
		t.Fatalf("expected at least 7 cognitive questions, got %d", primary)
	}
}

// TestLiveATFMonitoringWithLLM 已禁用：OpenAIAnswerer 尚未实现
// TODO: 实现 OpenAIAnswerer 后重新启用此测试
/*
func TestLiveATFMonitoringWithLLM(t *testing.T) {
	if os.Getenv("SERAPH_ATF_LIVE") != "1" {
		t.Skip("set SERAPH_ATF_LIVE=1 to run live llm monitor test")
	}

	apiKey := os.Getenv("SERAPH_ATF_API_KEY")
	model := os.Getenv("SERAPH_ATF_MODEL")
	baseURL := os.Getenv("SERAPH_ATF_BASE_URL")
	if apiKey == "" || model == "" {
		t.Skip("SERAPH_ATF_API_KEY and SERAPH_ATF_MODEL are required")
	}

	answerer, err := NewOpenAIAnswerer(OpenAIAnswererConfig{
		APIKey:      apiKey,
		BaseURL:     baseURL,
		Model:       model,
		Temperature: 0.2,
		Timeout:     90 * time.Second,
	})
	if err != nil {
		t.Fatalf("create live answerer failed: %v", err)
	}

	opts := DefaultMonitorOptions()
	opts.QuestionsPerEntity = 4
	monitor := NewThreeBlindMonitor(answerer, &opts)

	ctx := context.Background()
	for _, subject := range []MonitorSubject{BuildReiSubject(), BuildKaoruSubject()} {
		telemetry, runErr := monitor.RunRounds(ctx, subject, 3)
		if runErr != nil {
			t.Fatalf("subject %s live run failed: %v", subject.ID, runErr)
		}
		last := telemetry.Rounds[len(telemetry.Rounds)-1]
		t.Logf("subject=%s rounds=%d rho=%.4f zone=%s F=%.4f", subject.ID, len(telemetry.Rounds), last.SyncRate.Value, last.SyncRate.Zone, last.Strength.Total)
	}
}
*/
