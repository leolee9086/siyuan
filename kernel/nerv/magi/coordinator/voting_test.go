package coordinator

import (
	"context"
	"testing"
	"time"

	"github.com/sashabaranov/go-openai"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/config"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/sages"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
)

// mockVoteClient 模拟投票客户端
type mockVoteClient struct {
	response   string
	shouldFail bool
	delay      time.Duration
}

func (m *mockVoteClient) SendChatRequest(ctx context.Context, messages []types.ContextMessage, tools []openai.Tool) (<-chan types.StreamChunk, error) {
	return nil, nil
}

func (m *mockVoteClient) SendChatRequestSync(ctx context.Context, messages []types.ContextMessage, tools []openai.Tool) (string, error) {
	if m.delay > 0 {
		select {
		case <-time.After(m.delay):
		case <-ctx.Done():
			return "", ctx.Err()
		}
	}

	if m.shouldFail {
		return "", context.DeadlineExceeded
	}

	return m.response, nil
}

func (m *mockVoteClient) GetModel() string {
	return "gpt-4"
}

func createVoteMockSage(name string, client *mockVoteClient) *sages.Sage {
	cfg := &config.AgentConfig{
		SEELConfig: config.SEELConfig{
			Name: name,
		},
	}
	return sages.NewSage(name, cfg, client, nil)
}

// TestProcessVoting_BothApprove 测试两个贤者都批准
func TestProcessVoting_BothApprove(t *testing.T) {
	balthazarClient := &mockVoteClient{response: `{"decision":"批准","reason":"逻辑合理"}`}
	casperClient := &mockVoteClient{response: `{"decision":"批准","reason":"直觉认同"}`}

	balthazar := createVoteMockSage("Balthazar", balthazarClient)
	casper := createVoteMockSage("Casper", casperClient)

	result, err := ProcessVoting(
		context.Background(),
		"test-session",
		"test-round",
		balthazar,
		casper,
		"测试提案",
		VoteContext{UserMessage: "用户输入", MelchiorConclusion: "Melchior判断"},
	)

	if err != nil {
		t.Fatalf("ProcessVoting失败: %v", err)
	}

	if result.Melchior != voteApprove {
		t.Errorf("Melchior应该批准，实际: %s", result.Melchior)
	}
	if result.Balthazar != voteApprove {
		t.Errorf("Balthazar应该批准，实际: %s", result.Balthazar)
	}
	if result.Casper != voteApprove {
		t.Errorf("Casper应该批准，实际: %s", result.Casper)
	}
	if !result.Passed {
		t.Error("投票应该通过（3/3批准）")
	}
}

// TestProcessVoting_PartialApprove 测试部分批准（2/3通过）
func TestProcessVoting_PartialApprove(t *testing.T) {
	balthazarClient := &mockVoteClient{response: `{"decision":"批准","reason":"可以接受"}`}
	casperClient := &mockVoteClient{response: `{"decision":"否决","reason":"有风险"}`}

	balthazar := createVoteMockSage("Balthazar", balthazarClient)
	casper := createVoteMockSage("Casper", casperClient)

	result, err := ProcessVoting(
		context.Background(),
		"test-session",
		"test-round",
		balthazar,
		casper,
		"测试提案",
		VoteContext{UserMessage: "用户输入", MelchiorConclusion: "Melchior判断"},
	)

	if err != nil {
		t.Fatalf("ProcessVoting失败: %v", err)
	}

	if result.Balthazar != voteApprove {
		t.Errorf("Balthazar应该批准，实际: %s", result.Balthazar)
	}
	if result.Casper != voteReject {
		t.Errorf("Casper应该否决，实际: %s", result.Casper)
	}
	if !result.Passed {
		t.Error("投票应该通过（2/3批准）")
	}
}

// TestProcessVoting_BothReject 测试两个贤者都否决
func TestProcessVoting_BothReject(t *testing.T) {
	balthazarClient := &mockVoteClient{response: `{"decision":"否决","reason":"逻辑不通"}`}
	casperClient := &mockVoteClient{response: `{"decision":"否决","reason":"直觉反对"}`}

	balthazar := createVoteMockSage("Balthazar", balthazarClient)
	casper := createVoteMockSage("Casper", casperClient)

	result, err := ProcessVoting(
		context.Background(),
		"test-session",
		"test-round",
		balthazar,
		casper,
		"测试提案",
		VoteContext{UserMessage: "用户输入", MelchiorConclusion: "Melchior判断"},
	)

	if err != nil {
		t.Fatalf("ProcessVoting失败: %v", err)
	}

	if result.Balthazar != voteReject {
		t.Errorf("Balthazar应该否决，实际: %s", result.Balthazar)
	}
	if result.Casper != voteReject {
		t.Errorf("Casper应该否决，实际: %s", result.Casper)
	}
	if result.Passed {
		t.Error("投票不应该通过（1/3批准）")
	}
}

// TestProcessVoting_Timeout 测试超时处理（D-005）
func TestProcessVoting_Timeout(t *testing.T) {
	balthazarClient := &mockVoteClient{delay: 35 * time.Second}
	casperClient := &mockVoteClient{response: `{"decision":"批准","reason":"正常"}`}

	balthazar := createVoteMockSage("Balthazar", balthazarClient)
	casper := createVoteMockSage("Casper", casperClient)

	result, err := ProcessVoting(
		context.Background(),
		"test-session",
		"test-round",
		balthazar,
		casper,
		"测试提案",
		VoteContext{UserMessage: "用户输入", MelchiorConclusion: "Melchior判断"},
	)

	if err != nil {
		t.Fatalf("ProcessVoting失败: %v", err)
	}

	// D-005: 超时视为否决票
	if result.Balthazar != voteReject {
		t.Errorf("Balthazar超时应该视为否决，实际: %s", result.Balthazar)
	}
	if result.Casper != voteApprove {
		t.Errorf("Casper应该批准，实际: %s", result.Casper)
	}
	if !result.Passed {
		t.Error("投票应该通过（2/3批准）")
	}
}

// TestParseDecision_JSONFormat 测试JSON格式解析
func TestParseDecision_JSONFormat(t *testing.T) {
	tests := []struct {
		name     string
		content  string
		expected string
	}{
		{"批准JSON", `{"decision":"批准","reason":"测试"}`, voteApprove},
		{"否决JSON", `{"decision":"否决","reason":"测试"}`, voteReject},
		{"文本批准", "我认为应该批准这个提案", voteApprove},
		{"文本否决", "我认为应该否决这个提案", voteReject},
		{"无关键词", "这是一个测试", voteReject},
		{"空字符串", "", voteReject},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := parseDecision(tt.content)
			if result != tt.expected {
				t.Errorf("parseDecision(%q) = %q, 期望 %q", tt.content, result, tt.expected)
			}
		})
	}
}

// TestComputePassed 测试投票通过计算
func TestComputePassed(t *testing.T) {
	tests := []struct {
		name       string
		result     *VoteResult
		shouldPass bool
	}{
		{"全部批准", &VoteResult{Melchior: voteApprove, Balthazar: voteApprove, Casper: voteApprove}, true},
		{"两票批准", &VoteResult{Melchior: voteApprove, Balthazar: voteApprove, Casper: voteReject}, true},
		{"一票批准", &VoteResult{Melchior: voteApprove, Balthazar: voteReject, Casper: voteReject}, false},
		{"全部否决", &VoteResult{Melchior: voteReject, Balthazar: voteReject, Casper: voteReject}, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			passed := computePassed(tt.result)
			if passed != tt.shouldPass {
				t.Errorf("computePassed() = %v, 期望 %v", passed, tt.shouldPass)
			}
		})
	}
}

// TestBuildVoteSystemPrompt 测试系统提示词构建
func TestBuildVoteSystemPrompt(t *testing.T) {
	prompt := buildVoteSystemPrompt("Balthazar")

	if !contains(prompt, "Balthazar") {
		t.Error("系统提示词应该包含贤者名称")
	}
	if !contains(prompt, "批准") || !contains(prompt, "否决") {
		t.Error("系统提示词应该包含投票选项")
	}
	if !contains(prompt, "JSON") {
		t.Error("系统提示词应该要求JSON格式")
	}
}

// TestBuildVoteUserInput 测试用户输入构建
func TestBuildVoteUserInput(t *testing.T) {
	voteCtx := VoteContext{
		UserMessage:        "用户测试输入",
		MelchiorConclusion: "Melchior测试判断",
	}

	input := buildVoteUserInput("测试提案", voteCtx)

	if !contains(input, "用户测试输入") {
		t.Error("用户输入应该包含用户消息")
	}
	if !contains(input, "Melchior测试判断") {
		t.Error("用户输入应该包含Melchior判断")
	}
	if !contains(input, "测试提案") {
		t.Error("用户输入应该包含提案内容")
	}
}

func contains(s, substr string) bool {
	return len(s) > 0 && len(substr) > 0 && (s == substr || len(s) > len(substr) && findSubstring(s, substr))
}

func findSubstring(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

// TestProcessVoting_Failure 测试失败处理（D-005）
func TestProcessVoting_Failure(t *testing.T) {
	balthazarClient := &mockVoteClient{shouldFail: true}
	casperClient := &mockVoteClient{response: `{"decision":"批准","reason":"正常"}`}

	balthazar := createVoteMockSage("Balthazar", balthazarClient)
	casper := createVoteMockSage("Casper", casperClient)

	result, err := ProcessVoting(
		context.Background(),
		"test-session",
		"test-round",
		balthazar,
		casper,
		"测试提案",
		VoteContext{UserMessage: "用户输入", MelchiorConclusion: "Melchior判断"},
	)

	if err != nil {
		t.Fatalf("ProcessVoting失败: %v", err)
	}

	// D-005: 失败视为否决票
	if result.Balthazar != voteReject {
		t.Errorf("Balthazar失败应该视为否决，实际: %s", result.Balthazar)
	}
	if result.Casper != voteApprove {
		t.Errorf("Casper应该批准，实际: %s", result.Casper)
	}
	if !result.Passed {
		t.Error("投票应该通过（2/3批准）")
	}
}
