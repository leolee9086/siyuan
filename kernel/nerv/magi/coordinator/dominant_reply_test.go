package coordinator

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/sashabaranov/go-openai"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/config"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/sages"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
	"github.com/siyuan-note/siyuan/kernel/nerv/marduk"
)

type scriptedDominantClient struct {
	mu            sync.Mutex
	syncResponses []string
	streamTurns   []mockTurn
	syncIndex     int
	streamIndex   int
}

func (m *scriptedDominantClient) SendChatRequest(
	ctx context.Context,
	messages []types.ContextMessage,
	tools []openai.Tool,
	toolChoice any,
) (<-chan types.StreamChunk, error) {
	ch := make(chan types.StreamChunk, 4)
	go func() {
		defer close(ch)

		turn, ok := m.nextStreamTurn()
		if !ok {
			return
		}

		if turn.content != "" {
			select {
			case <-ctx.Done():
				return
			case ch <- types.StreamChunk{
				Choices: []types.ChunkChoice{
					{
						Delta: types.ChunkDelta{
							Content: turn.content,
						},
					},
				},
			}:
			}
		}
		if len(turn.toolCalls) > 0 {
			select {
			case <-ctx.Done():
				return
			case ch <- types.StreamChunk{
				Choices: []types.ChunkChoice{
					{
						Delta: types.ChunkDelta{
							ToolCalls: turn.toolCalls,
						},
					},
				},
			}:
			}
		}
	}()
	return ch, nil
}

func (m *scriptedDominantClient) SendChatRequestSync(
	ctx context.Context,
	messages []types.ContextMessage,
	tools []openai.Tool,
	toolChoice any,
) (string, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.syncIndex >= len(m.syncResponses) {
		return "", nil
	}
	response := m.syncResponses[m.syncIndex]
	m.syncIndex++
	return response, nil
}

func (m *scriptedDominantClient) GetModel() string {
	return "gpt-4"
}

func (m *scriptedDominantClient) nextStreamTurn() (mockTurn, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.streamIndex >= len(m.streamTurns) {
		return mockTurn{}, false
	}
	turn := m.streamTurns[m.streamIndex]
	m.streamIndex++
	return turn, true
}

func createDominantReplyTestSage(
	name,
	displayName string,
	profile *marduk.IpipPersonaProfile,
	client *scriptedDominantClient,
	toolDefs []config.ToolDef,
) *sages.Sage {
	cfg := &config.AgentConfig{
		SEELConfig: config.SEELConfig{
			Name: displayName,
		},
		Tools: toolDefs,
	}
	strategy := &config.ContextStrategy{
		Type:  "message_count",
		Count: 32,
	}
	sage := sages.NewSage(name, cfg, client, strategy)
	sage.SetProfile(profile)
	return sage
}

func buildDominantReplyTestProfile() *marduk.IpipPersonaProfile {
	return &marduk.IpipPersonaProfile{
		SchemaVersion: "IPIP-NEO-120-v1",
		Subject: marduk.IpipSubjectProfile{
			ID:   "naoko",
			Name: "赤城直子",
			CognitiveStances: &marduk.SubjectCognitiveStances{
				Profession:            "科学家",
				PrimarySocialRelation: "母亲",
				SelfName:              "赤城直子",
			},
		},
	}
}

func buildDominantVoteResponse(
	t *testing.T,
	candidates []dominantCandidate,
	profession int,
	socialRelation int,
	selfName int,
) string {
	t.Helper()

	payload := dominantVotePayload{
		Scores: []dominantVoteScore{
			{Candidate: candidates[0].PromptLabel, Score: profession},
			{Candidate: candidates[1].PromptLabel, Score: socialRelation},
			{Candidate: candidates[2].PromptLabel, Score: selfName},
		},
		Reason: "当前情境下该侧面更适合主导",
	}
	result, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("marshal dominant vote payload failed: %v", err)
	}
	return string(result)
}

func latestAssistantContent(messages []types.ContextMessage) string {
	for index := len(messages) - 1; index >= 0; index-- {
		if messages[index].Role != types.RoleAssistant {
			continue
		}
		content := strings.TrimSpace(messages[index].Content)
		if content != "" {
			return content
		}
	}
	return ""
}

func hasContextMessage(messages []types.ContextMessage, role types.MessageRole, content string) bool {
	for _, message := range messages {
		if message.Role == role && strings.TrimSpace(message.Content) == strings.TrimSpace(content) {
			return true
		}
	}
	return false
}

func hasToolContentContaining(messages []types.ContextMessage, needle string) bool {
	for _, message := range messages {
		if message.Role != types.RoleTool {
			continue
		}
		if strings.Contains(strings.TrimSpace(message.Content), needle) {
			return true
		}
	}
	return false
}

func TestCoordinateDominantDirectReply_SharesDominantReplyToAllSages(t *testing.T) {
	coordinator := NewCoordinator(5 * time.Second)
	profile := buildDominantReplyTestProfile()

	melchiorClient := &scriptedDominantClient{
		streamTurns: []mockTurn{
			completedSpeakTurn("由主导者直接回复"),
		},
	}
	balthazarClient := &scriptedDominantClient{}
	casperClient := &scriptedDominantClient{}

	melchior := createDominantReplyTestSage("melchior", "Melchior", profile, melchiorClient, nil)
	balthazar := createDominantReplyTestSage("balthazar", "Balthazar", profile, balthazarClient, nil)
	casper := createDominantReplyTestSage("casper", "Casper", profile, casperClient, nil)

	candidates, err := buildDominantCandidates(melchior, balthazar, casper)
	if err != nil {
		t.Fatalf("buildDominantCandidates() error = %v", err)
	}

	melchiorClient.syncResponses = []string{buildDominantVoteResponse(t, candidates, 95, 20, 10)}
	balthazarClient.syncResponses = []string{buildDominantVoteResponse(t, candidates, 80, 35, 25)}
	casperClient.syncResponses = []string{buildDominantVoteResponse(t, candidates, 75, 30, 40)}

	message, election, err := coordinator.coordinateDominantDirectReply(
		context.Background(),
		"session-dominant-direct",
		"round-dominant-direct",
		melchior,
		balthazar,
		casper,
		"外部消息",
		"外部消息",
		nil,
	)
	if err != nil {
		t.Fatalf("coordinateDominantDirectReply() error = %v", err)
	}
	if election == nil {
		t.Fatal("expected dominant election result")
	}
	if election.DominantSeelName != "melchior" {
		t.Fatalf("expected melchior to become dominant, got %s", election.DominantSeelName)
	}
	if message == nil || message.Content != "由主导者直接回复" {
		t.Fatalf("expected dominant reply content, got %#v", message)
	}
	if got := strings.TrimSpace(message.Meta["dominantSeel"].(string)); got != "melchior" {
		t.Fatalf("expected meta dominantSeel=melchior, got %s", got)
	}

	for _, sage := range []*sages.Sage{balthazar, casper} {
		contextMessages := sage.GetContextForSession("session-dominant-direct")
		if !hasContextMessage(contextMessages, types.RoleUser, "外部消息") {
			t.Fatalf("%s should receive shared user message, got %+v", sage.GetName(), contextMessages)
		}
		if got := latestAssistantContent(contextMessages); got != "由主导者直接回复" {
			t.Fatalf("%s should receive dominant reply in history, got %q", sage.GetName(), got)
		}
	}
}

func TestCoordinateDominantDirectReply_SanitizesMelchiorQueryHistoryForPeers(t *testing.T) {
	coordinator := NewCoordinator(5 * time.Second)
	profile := buildDominantReplyTestProfile()

	tempRepo := t.TempDir()
	if err := os.WriteFile(filepath.Join(tempRepo, "README.md"), []byte("hello"), 0o600); err != nil {
		t.Fatalf("write temp repo file failed: %v", err)
	}
	if err := os.Mkdir(filepath.Join(tempRepo, "kernel"), 0o755); err != nil {
		t.Fatalf("create temp repo dir failed: %v", err)
	}

	originalResolveForgeRoot := resolveForgeDevRepoRoot
	originalPersistQueryToolResult := persistQueryToolResultToNotebook
	resolveForgeDevRepoRoot = func() (string, error) {
		return tempRepo, nil
	}
	persistQueryToolResultToNotebook = func(
		sessionID, roundID string,
		sage *sages.Sage,
		toolCall types.ToolCall,
		assistantContent string,
		detailedResult string,
	) (*queryToolArchiveLocation, error) {
		return nil, nil
	}
	t.Cleanup(func() {
		resolveForgeDevRepoRoot = originalResolveForgeRoot
		persistQueryToolResultToNotebook = originalPersistQueryToolResult
	})

	melchiorClient := &scriptedDominantClient{
		streamTurns: []mockTurn{
			{
				content: "我先查看一下代码仓库目录。",
				toolCalls: []types.ToolCallDelta{
					toolCallDelta(0, config.ForgeDevRepoListToolName, `{"input":"path=.\nlimit=5"}`),
				},
			},
			completedSpeakTurn("目录已检查完毕。"),
		},
	}
	balthazarClient := &scriptedDominantClient{}
	casperClient := &scriptedDominantClient{}

	forgeToolDefs := []config.ToolDef{
		config.BuildForgeDevRepoListToolDef(),
		config.BuildForgeDevRepoReadToolDef(),
		config.BuildForgeDevRepoSearchToolDef(),
	}

	melchior := createDominantReplyTestSage("melchior", "Melchior", profile, melchiorClient, forgeToolDefs)
	balthazar := createDominantReplyTestSage("balthazar", "Balthazar", profile, balthazarClient, nil)
	casper := createDominantReplyTestSage("casper", "Casper", profile, casperClient, nil)

	candidates, err := buildDominantCandidates(melchior, balthazar, casper)
	if err != nil {
		t.Fatalf("buildDominantCandidates() error = %v", err)
	}

	melchiorClient.syncResponses = []string{buildDominantVoteResponse(t, candidates, 98, 10, 5)}
	balthazarClient.syncResponses = []string{buildDominantVoteResponse(t, candidates, 90, 30, 15)}
	casperClient.syncResponses = []string{buildDominantVoteResponse(t, candidates, 85, 20, 40)}

	_, election, err := coordinator.coordinateDominantDirectReply(
		context.Background(),
		"session-dominant-query",
		"round-dominant-query",
		melchior,
		balthazar,
		casper,
		"请先查看仓库",
		"请先查看仓库",
		nil,
	)
	if err != nil {
		t.Fatalf("coordinateDominantDirectReply() error = %v", err)
	}
	if election == nil || election.DominantSeelName != "melchior" {
		t.Fatalf("expected melchior to remain dominant, got %+v", election)
	}

	melchiorContext := melchior.GetContextForSession("session-dominant-query")
	if !hasToolContentContaining(melchiorContext, `"entries"`) {
		t.Fatalf("expected dominant melchior to keep detailed query result, got %+v", melchiorContext)
	}

	for _, sage := range []*sages.Sage{balthazar, casper} {
		sharedContext := sage.GetContextForSession("session-dominant-query")
		if hasToolContentContaining(sharedContext, `"entries"`) {
			t.Fatalf("%s should not receive raw query entries, got %+v", sage.GetName(), sharedContext)
		}
		if !hasToolContentContaining(sharedContext, `"paths"`) {
			t.Fatalf("%s should receive sanitized query summary, got %+v", sage.GetName(), sharedContext)
		}
	}
}
