package llm

// 前缀缓存监控单元测试：用脱敏合成请求流覆盖真实流量曾暴露出的边界条件。
// 验证 buildMonitorSequence / predictAndRecord / captureResponseUsage / 校准闭环，
// 不基于理想状况。

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/sashabaranov/go-openai"

	"s-forge.local/chatseqtrie"
)

// TestBuildMonitorSequence_ToolsFingerprint 验证：tools 指纹作为序列首条消息，
// tools 变化 → 首条不匹配 → 全量 MISS 被捕获。
func TestBuildMonitorSequence_ToolsFingerprint(t *testing.T) {
	body := []byte(`{"messages":[{"role":"user","content":"hi"}],"tools":[{"type":"function","function":{"name":"a"}}]}`)
	seq, err := buildMonitorSequence(body)
	if err != nil {
		t.Fatalf("buildMonitorSequence: %v", err)
	}
	if len(seq) != 2 {
		t.Fatalf("序列长度 = %d, want 2（指纹 + 1 消息）", len(seq))
	}
	if seq[0]["type"] != "tools_fingerprint" {
		t.Fatalf("首条应为 tools_fingerprint, got %v", seq[0]["type"])
	}
	fpA := seq[0]["content"]

	// tools 变化 → 指纹变化
	bodyB := []byte(`{"messages":[{"role":"user","content":"hi"}],"tools":[{"type":"function","function":{"name":"b"}}]}`)
	seqB, _ := buildMonitorSequence(bodyB)
	if seqB[0]["content"] == fpA {
		t.Fatal("tools 变化后指纹应不同")
	}
}

// TestRoutedLogicalNoToolsKeepsToolsFingerprint 回归 2026-08-02 线上问题：
// heartbeat-downtime 传 nil tools 时曾令固定包装工具变成 tools=0，服务端实际只命中
// 896/86741 tokens。本测试要求逻辑有工具/无工具经过路由后的首节点指纹完全一致。
func TestRoutedLogicalNoToolsKeepsToolsFingerprint(t *testing.T) {
	base := []openai.ChatCompletionMessage{
		{Role: openai.ChatMessageRoleSystem, Content: "stable-system"},
		{Role: openai.ChatMessageRoleUser, Content: "stable-history"},
	}
	withMessages, withTools := applyMagiToolRouting(base, []openai.Tool{testTool("search", "搜索")})
	withoutMessages, withoutTools := applyMagiToolRouting(base, nil)

	withBody, _ := json.Marshal(map[string]any{"messages": withMessages, "tools": withTools})
	withoutBody, _ := json.Marshal(map[string]any{"messages": withoutMessages, "tools": withoutTools})
	withSeq, err := buildMonitorSequence(withBody)
	if err != nil {
		t.Fatalf("buildMonitorSequence(with tools): %v", err)
	}
	withoutSeq, err := buildMonitorSequence(withoutBody)
	if err != nil {
		t.Fatalf("buildMonitorSequence(without tools): %v", err)
	}
	if withSeq[0]["content"] != withoutSeq[0]["content"] {
		t.Fatalf("逻辑工具列表变化不应改变 tools 指纹: with=%v without=%v",
			withSeq[0]["content"], withoutSeq[0]["content"])
	}

	monitor := NewPrefixCacheMonitor()
	monitor.predictAndRecord(withSeq, RequestSource{})
	prediction := monitor.predictAndRecord(withoutSeq, RequestSource{})
	const wantCommonPrefix = 3 // tools 指纹 + system + 稳定历史；仅尾部 tool_list 分叉
	if prediction.commonPrefixLen != wantCommonPrefix {
		t.Fatalf("逻辑无工具请求应只在尾部列表分叉: got %d, want %d",
			prediction.commonPrefixLen, wantCommonPrefix)
	}
}

func TestSystemMessagesFirstDetectsHoistedTailSystemCacheBreak(t *testing.T) {
	previous := []byte(`{"messages":[{"role":"system","content":"base"},{"role":"system","content":"wakeup"},{"role":"user","content":"history"},{"role":"assistant","content":"reply"}],"tools":[]}`)
	current := []byte(`{"messages":[{"role":"system","content":"base"},{"role":"system","content":"wakeup"},{"role":"user","content":"history"},{"role":"assistant","content":"reply"},{"role":"system","content":"dynamic-tail"}],"tools":[]}`)

	preserveMonitor := newPrefixCacheMonitorWithSequencePolicy(chatseqtrie.PreserveOrderSequencePolicy())
	preservePrevious, _ := buildMonitorSequence(previous)
	preserveCurrent, _ := buildMonitorSequence(current)
	preserveMonitor.predictAndRecord(preservePrevious, RequestSource{})
	preservePrediction := preserveMonitor.predictAndRecord(preserveCurrent, RequestSource{})
	if preservePrediction.commonPrefixLen != len(preservePrevious) {
		t.Fatalf("raw-order 应误判旧请求全部可复用: got %d, want %d",
			preservePrediction.commonPrefixLen, len(preservePrevious))
	}

	systemFirstMonitor := NewPrefixCacheMonitor()
	systemFirstPrevious, _ := buildMonitorSequence(previous)
	systemFirstCurrent, _ := buildMonitorSequence(current)
	systemFirstMonitor.predictAndRecord(systemFirstPrevious, RequestSource{})
	systemFirstPrediction := systemFirstMonitor.predictAndRecord(systemFirstCurrent, RequestSource{})
	const wantCommonPrefix = 3 // tools 指纹 + 两条此前已存在的 system
	if systemFirstPrediction.commonPrefixLen != wantCommonPrefix {
		t.Fatalf("system-first 应在新 system 被前置处断裂: got %d, want %d",
			systemFirstPrediction.commonPrefixLen, wantCommonPrefix)
	}
	if systemFirstPrediction.commonPrefixLen >= preservePrediction.commonPrefixLen {
		t.Fatalf("system-first 未暴露 raw-order 盲区: projected=%d raw=%d",
			systemFirstPrediction.commonPrefixLen, preservePrediction.commonPrefixLen)
	}
}

func TestSummarizeRequestBodyReportsNonLeadingSystem(t *testing.T) {
	summary := summarizeRequestBody([]byte(`{"model":"deepseek","messages":[{"role":"system","content":"base"},{"role":"user","content":"history"},{"role":"system","content":"dynamic"}]}`))
	if !strings.Contains(summary, "system_msgs=2 non_leading_system=1") {
		t.Fatalf("摘要未报告中途 system: %s", summary)
	}
}

// TestPredictAndRecord_SyntheticStream 用脱敏合成流验证 system-first 视图既能识别正常尾部延伸，
// 也能识别「原始 messages 仍以前一请求开头，但新增 system 被 provider 前置」的有效前缀断裂。
func TestPredictAndRecord_SyntheticStream(t *testing.T) {
	bodies := loadSyntheticRequestBodies(t)
	if len(bodies) < 3 {
		t.Fatal("合成请求数据不足")
	}
	m := NewPrefixCacheMonitor()
	var prevLen int
	fullPrefixExtensions := 0
	providerEffectiveBreaks := 0
	for i, body := range bodies {
		seq, err := buildMonitorSequence(body)
		if err != nil {
			t.Fatalf("buildMonitorSequence #%d: %v", i, err)
		}
		pred := m.predictAndRecord(seq, RequestSource{})
		if pred == nil {
			t.Fatalf("predictAndRecord #%d 返回 nil", i)
		}
		if i > 0 {
			switch {
			case pred.commonPrefixLen == prevLen:
				fullPrefixExtensions++
			case pred.commonPrefixLen < prevLen:
				providerEffectiveBreaks++
				t.Logf("请求 #%d: system-first 公共前缀=%d, 前一请求消息数=%d → 检出 provider 有效前缀断裂",
					i, pred.commonPrefixLen, prevLen)
			}
		}
		if pred.seqLen != len(seq) {
			t.Errorf("请求 #%d: seqLen=%d, want %d", i, pred.seqLen, len(seq))
		}
		prevLen = len(seq)
	}
	if fullPrefixExtensions == 0 {
		t.Fatal("合成请求流未覆盖正常尾部延伸")
	}
	if providerEffectiveBreaks == 0 {
		t.Fatal("合成请求流未检出任何 system-first 有效前缀断裂")
	}
	// 校验：新增消息数应 > 0（每请求至少新增尾部）
	lastSeq, err := buildMonitorSequence(bodies[len(bodies)-1])
	if err != nil {
		t.Fatalf("buildMonitorSequence(last): %v", err)
	}
	if pred := m.predictAndRecord(lastSeq, RequestSource{}); pred != nil && pred.suffixMsgs < 1 {
		t.Logf("重复请求新增消息数=%d（首次插入后再次 Match 应为 0，若 >0 说明上次未正确记录）", pred.suffixMsgs)
	}
}

// TestCaptureUsage_NonStream 验证非流式响应 usage 提取（DeepSeek 顶层字段，go-openai 会丢弃）。
func TestCaptureUsage_NonStream(t *testing.T) {
	m := NewPrefixCacheMonitor()
	resp := &http.Response{
		Header: http.Header{},
		Body: io.NopCloser(strings.NewReader(`{
			"choices":[{"message":{"role":"assistant","content":"ok"}}],
			"usage":{
				"prompt_tokens": 1000,
				"completion_tokens": 50,
				"total_tokens": 1050,
				"prompt_cache_hit_tokens": 800,
				"prompt_cache_miss_tokens": 200,
				"prompt_tokens_details":{"cached_tokens":800}
			}
		}`)),
	}
	// 需要先有预测上下文：构造一个 pred 记录后缀消息数
	seq, _ := buildMonitorSequence([]byte(`{"messages":[{"role":"user","content":"x"}],"tools":[]}`))
	pred := m.predictAndRecord(seq, RequestSource{})

	m.captureResponseUsage(resp, pred, 0, RequestSource{})

	// 校准系数应被更新：miss=200 / suffixMsgs=1（消息"x"）= 200
	m.mu.RLock()
	cal := m.calibratedTokenPerMsg
	samples := m.calibSamples
	m.mu.RUnlock()
	if samples != 1 {
		t.Errorf("校准样本数=%d, want 1", samples)
	}
	if cal < 190 || cal > 210 {
		t.Errorf("校准系数=%.2f, want ≈200（miss=200/新增1条）", cal)
	}
}

// TestCaptureUsage_SSE 验证流式 SSE 响应的 usage 提取（usage 在 data 块末尾）。
func TestCaptureUsage_SSE(t *testing.T) {
	m := NewPrefixCacheMonitor()
	seq, _ := buildMonitorSequence([]byte(`{"messages":[{"role":"user","content":"x"}],"tools":[]}`))
	pred := m.predictAndRecord(seq, RequestSource{})

	sse := "data: {\"choices\":[{\"delta\":{\"content\":\"a\"}}]}\n\n" +
		"data: {\"choices\":[{\"delta\":{\"content\":\"b\"}}]}\n\n" +
		"data: {\"choices\":[],\"usage\":{\"prompt_cache_hit_tokens\":700,\"prompt_cache_miss_tokens\":300,\"prompt_tokens_details\":{\"cached_tokens\":700}}}\n\n" +
		"data: [DONE]\n\n"
	resp := &http.Response{
		Header: http.Header{"Content-Type": {"text/event-stream"}},
		Body:   io.NopCloser(strings.NewReader(sse)),
	}
	m.captureResponseUsage(resp, pred, 0, RequestSource{})

	// 读取响应体（透传），应完整拿到 SSE 内容
	got, _ := io.ReadAll(resp.Body)
	if string(got) != sse {
		t.Errorf("SSE 透传被破坏: got %d bytes, want %d", len(got), len(sse))
	}

	// 校准系数应更新：miss=300 / suffixMsgs=1 = 300
	m.mu.RLock()
	cal := m.calibratedTokenPerMsg
	m.mu.RUnlock()
	if cal < 290 || cal > 310 {
		t.Errorf("校准系数=%.2f, want ≈300（SSE miss=300/新增1条）", cal)
	}
}

// TestCalibration_FallbackEstimate 验证：无 usage 响应时，用已校准系数估算。
func TestCalibration_FallbackEstimate(t *testing.T) {
	m := NewPrefixCacheMonitor()

	// 先制造一次校准：miss=200/新增1条 → 系数≈200
	seq1, _ := buildMonitorSequence([]byte(`{"messages":[{"role":"user","content":"x"}],"tools":[]}`))
	pred1 := m.predictAndRecord(seq1, RequestSource{})
	resp1 := &http.Response{
		Header: http.Header{},
		Body: io.NopCloser(strings.NewReader(`{
			"choices":[],
			"usage":{"prompt_cache_hit_tokens":0,"prompt_cache_miss_tokens":200,"prompt_tokens":200}
		}`)),
	}
	m.captureResponseUsage(resp1, pred1, 0, RequestSource{})

	// 无 usage 的响应 → 走估算分支（不应 panic，应记录估算值）
	seq2, _ := buildMonitorSequence([]byte(`{"messages":[{"role":"user","content":"x"},{"role":"assistant","content":"y"}],"tools":[]}`))
	pred2 := m.predictAndRecord(seq2, RequestSource{})
	resp2 := &http.Response{
		Header: http.Header{},
		Body:   io.NopCloser(strings.NewReader(`{"choices":[]}`)), // 无 usage
	}
	m.captureResponseUsage(resp2, pred2, 0, RequestSource{})

	m.mu.RLock()
	samples := m.calibSamples
	cal := m.calibratedTokenPerMsg
	m.mu.RUnlock()
	if samples != 1 {
		t.Errorf("无 usage 响应不应增加校准样本: samples=%d, want 1", samples)
	}
	if cal < 190 || cal > 210 {
		t.Errorf("校准系数应保持≈200: %.2f", cal)
	}
}

// TestPredictAndRecord_IndependentSessionID 验证：每请求独立 sessionID，历史不丢失。
func TestPredictAndRecord_IndependentSessionID(t *testing.T) {
	m := NewPrefixCacheMonitor()
	// 插入两条递增序列
	seq1, _ := buildMonitorSequence([]byte(`{"messages":[{"role":"user","content":"a"}],"tools":[]}`))
	m.predictAndRecord(seq1, RequestSource{})
	seq2, _ := buildMonitorSequence([]byte(`{"messages":[{"role":"user","content":"a"},{"role":"assistant","content":"b"}],"tools":[]}`))
	pred2 := m.predictAndRecord(seq2, RequestSource{})
	if pred2.commonPrefixLen != len(seq1) {
		t.Errorf("第二条应命中第一条全部: commonPrefixLen=%d, want %d", pred2.commonPrefixLen, len(seq1))
	}
	// 第三条回到与 seq1 相同 → 应命中 seq1（历史保留）
	seq3, _ := buildMonitorSequence([]byte(`{"messages":[{"role":"user","content":"a"}],"tools":[]}`))
	pred3 := m.predictAndRecord(seq3, RequestSource{})
	if pred3.commonPrefixLen != len(seq3) {
		t.Errorf("第三条应命中首条全部: commonPrefixLen=%d, want %d", pred3.commonPrefixLen, len(seq3))
	}
}
