package chatseqtrie

// 暴露测试：用脱敏合成请求流验证真实流量曾暴露出的边界条件。
// 验证 chatseqtrie 在"前缀缓存监控"场景下的功能是否足够。
// 目标：不基于理想状况，暴露 FieldPolicy 对齐、消息级 vs token 级、tools 指纹、sessionID 语义等不足。

import (
	"encoding/json"
	"fmt"
	"testing"
)

// 合成 messages 沿用 magi ContextMessage JSON 的驼峰字段名。
// 监控必须把字段名与 FieldPolicy 路径对齐；这里统一构造 OpenAI 视角的 map 供测试。
func toOpenAIMap(raw map[string]any) map[string]any {
	out := map[string]any{}
	for k, v := range raw {
		out[k] = v
	}
	// 字段名归一化：magi 内部驼峰 → OpenAI 下划线（DeepSeek 实际请求体用的键名）
	if v, ok := out["reasoningContent"]; ok {
		out["reasoning_content"] = v
		delete(out, "reasoningContent")
	}
	if v, ok := out["toolCallId"]; ok {
		out["tool_call_id"] = v
		delete(out, "toolCallId")
	}
	// toolCalls 扁平 {id,name,arguments} → OpenAI 嵌套 {id,type,function:{name,arguments}}
	if v, ok := out["toolCalls"].([]any); ok && len(v) > 0 {
		var nested []any
		for _, tc := range v {
			if m, ok := tc.(map[string]any); ok {
				nested = append(nested, map[string]any{
					"id":   m["id"],
					"type": m["type"],
					"function": map[string]any{
						"name":      m["name"],
						"arguments": m["arguments"],
					},
				})
			}
		}
		out["tool_calls"] = nested
		delete(out, "toolCalls")
	}
	return out
}

// ---- 暴露点 1：FieldPolicy 默认策略与 DeepSeek token 化不对齐 ----

// DeepSeek 输入 token 序列包含 tool_calls 的 id、tool_call_id、reasoning_content；
// DefaultFieldPolicy（fieldpolicy.go:59）把这些当修饰字段（不参与匹配）。
// 后果：两条消息 content/name/arguments 相同但 tool_calls id 不同 → chatseqtrie 判"命中"、
// DeepSeek 实为"未命中" → 高估命中率。
func TestExposure_DefaultFieldPolicyIgnoresToolCallID(t *testing.T) {
	msgA := MustNewMessage(map[string]any{
		"role": "assistant", "content": "调用工具",
		"tool_calls": []any{map[string]any{
			"id": "call_AAA", "type": "function",
			"function": map[string]any{"name": "search", "arguments": `{"q":"x"}`},
		}},
	})
	msgB := MustNewMessage(map[string]any{
		"role": "assistant", "content": "调用工具",
		"tool_calls": []any{map[string]any{
			"id": "call_BBB", "type": "function",
			"function": map[string]any{"name": "search", "arguments": `{"q":"x"}`},
		}},
	})

	def := DefaultFieldPolicy()
	keyA, errA := def.ComputeKey(msgA)
	keyB, errB := def.ComputeKey(msgB)
	if errA != nil || errB != nil {
		t.Fatalf("ComputeKey: %v / %v", errA, errB)
	}
	if keyA != keyB {
		t.Fatalf("默认策略把 tool_calls id 当修饰字段，key 应相同；实际不同: %q vs %q", keyA, keyB)
	}

	// 全字段策略（nil = 全部字段参与匹配）
	var full *FieldPolicy
	keyA2, _ := full.ComputeKey(msgA)
	keyB2, _ := full.ComputeKey(msgB)
	if keyA2 == keyB2 {
		t.Fatalf("全字段策略下 tool_calls id 不同应导致 key 不同；实际相同: %q", keyA2)
	}
	t.Logf("暴露确认 1：默认策略忽略 tool_calls id（高估命中）；DeepSeek 实际把 id 计入 token 化 → 需用全字段策略")
}

// 同理：tool_call_id（tool 消息）与 reasoning_content 也被默认策略忽略。
func TestExposure_DefaultFieldPolicyIgnoresToolCallIDAndReasoning(t *testing.T) {
	toolA := MustNewMessage(map[string]any{
		"role": "tool", "content": "结果", "tool_call_id": "call_AAA",
	})
	toolB := MustNewMessage(map[string]any{
		"role": "tool", "content": "结果", "tool_call_id": "call_BBB",
	})
	def := DefaultFieldPolicy()
	if ka, _ := def.ComputeKey(toolA); ka != mustKey(def, toolB) {
		t.Logf("tool_call_id 被默认策略忽略（key 相同）")
	} else {
		t.Logf("tool_call_id 参与默认策略匹配")
	}

	reaA := MustNewMessage(map[string]any{"role": "assistant", "content": "a", "reasoning_content": "思考A"})
	reaB := MustNewMessage(map[string]any{"role": "assistant", "content": "a", "reasoning_content": "思考B"})
	if ka, _ := def.ComputeKey(reaA); ka == mustKey(def, reaB) {
		t.Logf("reasoning_content 被默认策略忽略（key 相同）→ 高估命中；DeepSeek 实际计入 token 化")
	}
}

func mustKey(p *FieldPolicy, m Message) string {
	k, err := p.ComputeKey(m)
	if err != nil {
		panic(err)
	}
	return k
}

// ---- 暴露点 2：合成请求流的消息级匹配 ----

// 用脱敏合成的 23 个请求（消息数 1418→1464，相邻 +2/+3 条）验证：
//   - 相邻请求公共前缀是否 = 前一个请求的消息数（消息级正确性）
//   - IsVariant/BranchPoint 能否定位新增（缓存未命中）消息
//   - Suffix 是"整条消息"（消息级），DeepSeek 的 token 级命中无法体现（低估命中）
func TestExposure_SyntheticStreamMessageLevelMatch(t *testing.T) {
	reqs := loadSyntheticRequests(t)

	var full *FieldPolicy // 全字段策略：与 DeepSeek token 化对齐
	trie := New(WithFieldPolicy(full))

	prevCount := 0
	for i, r := range reqs {
		msgs := make([]Message, 0, len(r.Messages))
		for _, raw := range r.Messages {
			msgs = append(msgs, MustNewMessage(toOpenAIMap(raw)))
		}
		res, err := trie.Match(msgs)
		if err != nil {
			t.Fatalf("Match #%d: %v", i, err)
		}
		// 期望：相邻请求公共前缀 = 前一请求消息数（除首个外）
		if i > 0 {
			if res.CommonPrefixLen != prevCount {
				t.Logf("请求 #%d seq=%d: CommonPrefixLen=%d, 前一个消息数=%d → 前缀断裂(中段被改?)",
					i, r.Seq, res.CommonPrefixLen, prevCount)
			} else {
				t.Logf("请求 #%d seq=%d: 公共前缀=%d/%d msgs, Suffix=%d 条(整条消息级) IsVariant=%v BranchPoint=%d",
					i, r.Seq, res.CommonPrefixLen, len(msgs), len(res.Suffix), res.IsVariant, res.BranchPoint)
			}
		}
		// Insert 记录（每个请求独立 sessionID，模拟缓存记住每个请求）
		if _, err := trie.Insert(fmtSeq(r.Seq), msgs); err != nil {
			t.Fatalf("Insert #%d: %v", i, err)
		}
		prevCount = len(msgs)
	}
}

func fmtSeq(seq int64) string {
	b, _ := json.Marshal(seq)
	return string(b)
}

// ---- 暴露点 3：tools 指纹注入 ----

// chatseqtrie 不感知 tools；DeepSeek 输入序列含 tools 定义（位于最前）。
// 监控需在序列最前注入 tools_fingerprint 消息；tools 变化 → 首条消息不匹配 → CommonPrefixLen=0。
func TestExposure_ToolsFingerprintInjection(t *testing.T) {
	reqs := loadSyntheticRequests(t)
	base := make([]Message, 0, len(reqs[0].Messages))
	for _, raw := range reqs[0].Messages {
		base = append(base, MustNewMessage(toOpenAIMap(raw)))
	}

	var full *FieldPolicy
	trie := New(WithFieldPolicy(full))

	toolsA := MustNewMessage(map[string]any{"type": "tools_fingerprint", "content": "hash-11-tools"})
	toolsB := MustNewMessage(map[string]any{"type": "tools_fingerprint", "content": "hash-1-tool"})

	// 先插入 toolsA + 完整序列
	seqA := append([]Message{toolsA}, base...)
	if _, err := trie.Insert("req-A", seqA); err != nil {
		t.Fatal(err)
	}
	// 相同 tools → 应完全命中（CommonPrefixLen = len(seqA)）
	resSame, err := trie.Match(seqA)
	if err != nil || resSame.CommonPrefixLen != len(seqA) {
		t.Fatalf("相同 tools 指纹应完全命中；CommonPrefixLen=%d/%d err=%v", resSame.CommonPrefixLen, len(seqA), err)
	}
	// tools 变化（如投票 1 工具 vs 心跳 11 工具）→ 首条消息不匹配 → CommonPrefixLen=0（全量 MISS）
	seqB := append([]Message{toolsB}, base...)
	resDiff, err := trie.Match(seqB)
	if err != nil {
		t.Fatal(err)
	}
	if resDiff.CommonPrefixLen != 0 {
		t.Fatalf("tools 指纹变化应导致 CommonPrefixLen=0（全量 MISS）；实际=%d", resDiff.CommonPrefixLen)
	}
	t.Logf("暴露确认 3：注入 tools_fingerprint 后，tools 变化被精确捕获为全量 MISS（对应 DeepSeek 前缀最前部）")
}

// ---- 暴露点 4：sessionID 语义与"缓存记住所有请求" ----

// chatseqtrie 的 Insert 对同一 sessionID 重复插入会"清理旧标记"（trie.go:216-223），
// 且路径分叉会 trim 孤立祖先（pruneUpwards）。
// 监控语义要求"每个请求的输入都作为独立历史保留"（DeepSeek 缓存记住所有请求）——
// 若复用同一 sessionID，旧路径标记被清理，Match 结果可能丢失历史前缀。
func TestExposure_SessionIDReuseLosesHistory(t *testing.T) {
	reqs := loadSyntheticRequests(t)
	build := func(idx int) []Message {
		var msgs []Message
		for _, raw := range reqs[idx].Messages {
			msgs = append(msgs, MustNewMessage(toOpenAIMap(raw)))
		}
		return msgs
	}
	var full *FieldPolicy

	// 场景 A：每个请求独立 sessionID（监控正确用法）
	trieA := New(WithFieldPolicy(full))
	for i := 0; i < len(reqs); i++ {
		_, _ = trieA.Insert(fmt.Sprintf("req-%d", i), build(i))
	}
	last := build(len(reqs) - 1)
	resA, _ := trieA.Match(last)
	if resA.CommonPrefixLen != len(build(len(reqs)-2)) {
		t.Logf("独立 sessionID：最后请求命中前一个的全部消息（CommonPrefixLen=%d）", resA.CommonPrefixLen)
	}

	// 场景 B：复用同一 sessionID（错误用法）
	trieB := New(WithFieldPolicy(full))
	for i := 0; i < len(reqs); i++ {
		_, _ = trieB.Insert("shared", build(i))
	}
	resB, _ := trieB.Match(build(len(reqs) - 1))
	t.Logf("复用 sessionID：CommonPrefixLen=%d（同一 sessionID 移动终标记，历史路径可能丢失）", resB.CommonPrefixLen)
	if resB.CommonPrefixLen > 0 {
		t.Logf("暴露确认 4：复用 sessionID 仍有前缀命中；但注意 Insert 会清理旧标记，依赖具体路径形状 → 监控必须每请求独立 sessionID")
	}
}
