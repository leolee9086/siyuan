// 验证 chatseqtrie 匹配（消息内容键）与实际序列化字节的一致性。
// 核心问题：chatseqtrie 认为「相同」的两条消息，go-openai 序列化后的字节是否也相同？
// 若 chatseqtrie key 相同但字节不同，则服务端（字节级最长公共前缀匹配）不会命中，
// 而本地预测（chatseqtrie 内容键匹配）会高估——这就是预测命中 32 条但实际只命中 896 的根源。
package llm

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"os"
	"testing"

	"github.com/sashabaranov/go-openai"
	"s-forge.local/chatseqtrie"
)

// TestChatSeqTrieKeyVsWireBytes 对比 chatseqtrie 内容键与 go-openai 序列化字节。
// 用真实请求流（testdata/real_requests.json）的相邻请求，逐条检查：
//  1. chatseqtrie ComputeKey（全字段策略）相同？
//  2. go-openai 序列化后的 JSON 字节相同？
//
// 若 1 成立而 2 不成立 → 找到「同 JSON 序列产生的字节序列不同」的确凿证据。
func TestChatSeqTrieKeyVsWireBytes(t *testing.T) {
	data, err := os.ReadFile("../../../../packages/chatseqtrie/testdata/real_requests.json")
	if err != nil {
		t.Skipf("真实请求数据不可用: %v", err)
	}
	var reqs []struct {
		TS        string           `json:"ts"`
		Seq       int64            `json:"seq"`
		Sage      string           `json:"sage"`
		ToolCount int              `json:"toolCount"`
		Messages  []map[string]any `json:"messages"`
		Tools     []any            `json:"tools"`
	}
	if err := json.Unmarshal(data, &reqs); err != nil {
		t.Fatalf("解析真实请求数据失败: %v", err)
	}
	if len(reqs) < 2 {
		t.Fatal("请求数据不足")
	}

	trie := chatseqtrie.New(
		chatseqtrie.WithFieldPolicy(nil),
		chatseqtrie.WithSequencePolicy(chatseqtrie.SystemMessagesFirstSequencePolicy(1)),
	) // 与 prefixmonitor 一致：全字段 + tools 指纹固定 + system-first

	// 对每对相邻请求（同一 sage 的连续请求）：
	//   先 Insert 前一条，再 Match 后一条，得到 CommonPrefixLen（消息级命中数）
	//   再逐字节对比两条请求的 go-openai 序列化 messages，得到字节级公共前缀消息数
	//   若消息级命中 > 字节级命中 → chatseqtrie 高估 → 根因证据
	type pairResult struct {
		tsA, tsB   string
		commonLen  int // chatseqtrie 消息级命中
		byteCommon int // 字节级命中消息数
		mismatchAt int // 第一个字节不同的消息索引（-1=全同）
		diffA      string
		diffB      string
	}
	var results []pairResult

	for i := 0; i < len(reqs)-1; i++ {
		prev := reqs[i]
		curr := reqs[i+1]
		// 只对比同一 sage 的相邻请求（前缀稳定性验证）
		if prev.Sage != curr.Sage {
			continue
		}

		prevMsgs := toOpenAIMessagesFromRaw(prev.Messages)
		currMsgs := toOpenAIMessagesFromRaw(curr.Messages)

		// chatseqtrie 序列（用 buildMonitorSequence 相同逻辑：tools 指纹 + ConvertOpenAIMessages）
		prevSeq := buildSeqFromRaw(prev.Messages, prev.Tools)
		currSeq := buildSeqFromRaw(curr.Messages, curr.Tools)
		if _, err := trie.Insert("prev", prevSeq); err != nil {
			t.Fatalf("Insert 失败: %v", err)
		}
		match, err := trie.Match(currSeq)
		if err != nil {
			t.Fatalf("Match 失败: %v", err)
		}

		// 字节级公共前缀：逐条对比 go-openai 序列化后的 JSON 字节
		byteCommon := 0
		mismatchAt := -1
		n := len(prevMsgs)
		if len(currMsgs) < n {
			n = len(currMsgs)
		}
		for j := 0; j < n; j++ {
			prevBytes, _ := json.Marshal(prevMsgs[j])
			currBytes, _ := json.Marshal(currMsgs[j])
			if string(prevBytes) != string(currBytes) {
				mismatchAt = j
				results = append(results, pairResult{
					tsA: prev.TS, tsB: curr.TS,
					commonLen:  match.CommonPrefixLen - 1, // 减 tools 指纹
					byteCommon: byteCommon,
					mismatchAt: j,
					diffA:      string(prevBytes),
					diffB:      string(currBytes),
				})
				break
			}
			byteCommon++
		}
		if mismatchAt < 0 {
			results = append(results, pairResult{
				tsA: prev.TS, tsB: curr.TS,
				commonLen:  match.CommonPrefixLen - 1,
				byteCommon: byteCommon,
				mismatchAt: -1,
			})
		}
	}

	t.Logf("对比请求对总数: %d", len(results))
	disagree := 0
	for _, r := range results {
		agree := r.commonLen == r.byteCommon
		status := "一致"
		if !agree {
			status = "★不一致"
			disagree++
		}
		t.Logf("%s → %s: chatseqtrie命中=%d 字节命中=%d 首个字节差异@%d %s",
			r.tsA, r.tsB, r.commonLen, r.byteCommon, r.mismatchAt, status)
		if !agree && r.mismatchAt >= 0 {
			t.Logf("  差异消息 A: %.160s", r.diffA)
			t.Logf("  差异消息 B: %.160s", r.diffB)
		}
	}
	if disagree > 0 {
		t.Logf(">>> 发现 %d/%d 对请求 chatseqtrie 命中与字节命中不一致", disagree, len(results))
	} else {
		t.Logf(">>> 全部一致：chatseqtrie 命中与字节命中吻合")
	}
}

// toOpenAIMessagesFromRaw 模拟 convertToOpenAIMessages：assistant reasoning_content 空 → " "
func toOpenAIMessagesFromRaw(msgs []map[string]any) []openai.ChatCompletionMessage {
	out := make([]openai.ChatCompletionMessage, 0, len(msgs))
	for _, m := range msgs {
		role, _ := m["role"].(string)
		content, _ := m["content"].(string)
		reasoning, _ := m["reasoning_content"].(string)
		if reasoning == "" && role == "assistant" {
			reasoning = " "
		}
		o := openai.ChatCompletionMessage{Role: role, Content: content, ReasoningContent: reasoning}
		out = append(out, o)
	}
	return out
}

// buildSeqFromRaw 模拟 buildMonitorSequence：tools 指纹 + ConvertOpenAIMessages
func buildSeqFromRaw(msgs []map[string]any, tools []any) []chatseqtrie.Message {
	toolsJSON, _ := json.Marshal(tools)
	sum := sha256Sum(toolsJSON)
	seq := []chatseqtrie.Message{{"type": "tools_fingerprint", "content": sum}}
	return append(seq, chatseqtrie.ConvertOpenAIMessages(msgs)...)
}

func sha256Sum(b []byte) string {
	h := sha256.Sum256(b)
	return hex.EncodeToString(h[:])
}
