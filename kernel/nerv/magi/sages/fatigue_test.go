package sages

import (
	"strings"
	"testing"

	"github.com/siyuan-note/siyuan/kernel/nerv/magi/config"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
)

// ── 辅助构造 ──

func msgr(rid string, content string) types.ContextMessage {
	return types.ContextMessage{Role: types.RoleUser, Content: content, RoundID: rid}
}

func msgs(content string) types.ContextMessage {
	return types.ContextMessage{Role: types.RoleSystem, Content: content}
}

func msgNoRound(content string) types.ContextMessage {
	return types.ContextMessage{Role: types.RoleUser, Content: content}
}

// ── CalculateFatigue ──

func TestCalculateFatigue_NilStrategy(t *testing.T) {
	m := []types.ContextMessage{msgr("r1", "hello")}
	if got := CalculateFatigue(m, nil, "gpt-4o"); got != 0 {
		t.Errorf("nil strategy: got %f, want 0", got)
	}
}

func TestCalculateFatigue_EmptyMessages(t *testing.T) {
	s := &config.ContextStrategy{Type: "token_percent", Percent: 80}
	if got := CalculateFatigue(nil, s, "gpt-4o"); got != 0 {
		t.Errorf("nil messages: got %f, want 0", got)
	}
	if got := CalculateFatigue([]types.ContextMessage{}, s, "gpt-4o"); got != 0 {
		t.Errorf("empty messages: got %f, want 0", got)
	}
}

func TestCalculateFatigue_TokenPercent_ZeroPercent(t *testing.T) {
	m := []types.ContextMessage{msgr("r1", "hello")}
	s := &config.ContextStrategy{Type: "token_percent", Percent: 0}
	if got := CalculateFatigue(m, s, "gpt-4o"); got != 0 {
		t.Errorf("zero percent: got %f, want 0", got)
	}
}

func TestCalculateFatigue_TokenPercent_Estimation(t *testing.T) {
	// gpt-4o: max=128000, percent=80 → limit=102400
	// 1000 chars → estimated ~250 tokens → ratio=250/102400=0.00244
	// fatigue = 0.00244^1.5 × 100 ≈ 0.012
	m := []types.ContextMessage{msgr("r1", strings.Repeat("x", 1000))}
	s := &config.ContextStrategy{Type: "token_percent", Percent: 80}
	got := CalculateFatigue(m, s, "gpt-4o")
	if got < 0.005 || got > 0.05 {
		t.Errorf("token_percent 1000 chars: got %f, expected ~0.012", got)
	}
}

func TestCalculateFatigue_TokenPercent_AtLimit(t *testing.T) {
	// gpt-4o: max=128000, percent=80 → limit=102400
	// 102400*4=409600 chars → fatigue=100
	m := []types.ContextMessage{msgr("r1", strings.Repeat("x", 409600))}
	s := &config.ContextStrategy{Type: "token_percent", Percent: 80}
	got := CalculateFatigue(m, s, "gpt-4o")
	if got < 99 || got > 100 {
		t.Errorf("at limit: got %f, want ~100", got)
	}
}

func TestCalculateFatigue_TokenPercent_AboveLimit(t *testing.T) {
	m := []types.ContextMessage{msgr("r1", strings.Repeat("x", 1000000))}
	s := &config.ContextStrategy{Type: "token_percent", Percent: 80}
	got := CalculateFatigue(m, s, "gpt-4o")
	if got > 100 {
		t.Errorf("above limit: got %f, want capped at 100", got)
	}
}

func TestCalculateFatigue_RoundCount_Empty(t *testing.T) {
	s := &config.ContextStrategy{Type: "round_count", Count: 7}
	if got := CalculateFatigue([]types.ContextMessage{}, s, ""); got != 0 {
		t.Errorf("empty: got %f, want 0", got)
	}
}

func TestCalculateFatigue_RoundCount_NoRoundIDs(t *testing.T) {
	m := []types.ContextMessage{
		msgNoRound("hello"),
		msgNoRound("world"),
	}
	s := &config.ContextStrategy{Type: "round_count", Count: 7}
	got := CalculateFatigue(m, s, "")
	if got != 0 {
		t.Errorf("no round IDs: got %f, want 0", got)
	}
}

func TestCalculateFatigue_RoundCount_ZeroMax(t *testing.T) {
	m := []types.ContextMessage{msgr("r1", "hello")}
	s := &config.ContextStrategy{Type: "round_count", Count: 0}
	if got := CalculateFatigue(m, s, ""); got != 0 {
		t.Errorf("zero max rounds: got %f, want 0", got)
	}
}

func TestCalculateFatigue_RoundCount_Partial(t *testing.T) {
	m := []types.ContextMessage{
		msgr("r1", "a"),
		msgr("r2", "b"),
		msgr("r3", "c"),
	}
	s := &config.ContextStrategy{Type: "round_count", Count: 7}
	got := CalculateFatigue(m, s, "")
	// (3/7)^1.5 × 100 ≈ 28.06 (convex)
	if got < 27 || got > 29 {
		t.Errorf("3/7 rounds (^1.5): got %f, want ~28.06", got)
	}
}

func TestCalculateFatigue_RoundCount_AtMax(t *testing.T) {
	m := make([]types.ContextMessage, 7)
	for i := 0; i < 7; i++ {
		m[i] = msgr(string(rune('0'+i)), "content")
	}
	s := &config.ContextStrategy{Type: "round_count", Count: 7}
	got := CalculateFatigue(m, s, "")
	if got != 100 {
		t.Errorf("7/7 rounds: got %f, want 100", got)
	}
}

func TestCalculateFatigue_RoundCount_ExceedsMax(t *testing.T) {
	m := make([]types.ContextMessage, 10)
	for i := 0; i < 10; i++ {
		m[i] = msgr(string(rune('0'+i)), "content")
	}
	s := &config.ContextStrategy{Type: "round_count", Count: 7}
	got := CalculateFatigue(m, s, "")
	if got != 100 {
		t.Errorf("10 rounds with max 7: got %f, want 100 (capped)", got)
	}
}

func TestCalculateFatigue_RoundCount_DuplicateRounds(t *testing.T) {
	m := []types.ContextMessage{
		msgr("r1", "a"),
		msgr("r1", "b"),
		msgr("r1", "c"),
	}
	s := &config.ContextStrategy{Type: "round_count", Count: 7}
	got := CalculateFatigue(m, s, "")
	// 1 unique round: (1/7)^1.5 × 100 ≈ 5.40 (convex)
	if got < 5 || got > 6 {
		t.Errorf("1 unique round in 3 messages: got %f, want ~5.40", got)
	}
}

func TestCalculateFatigue_MessageCount_Exact(t *testing.T) {
	m := make([]types.ContextMessage, 5)
	for i := 0; i < 5; i++ {
		m[i] = msgNoRound("hello")
	}
	s := &config.ContextStrategy{Type: "message_count", Count: 10}
	got := CalculateFatigue(m, s, "")
	// (5/10)^1.5 × 100 ≈ 35.36 (convex)
	if got < 34 || got > 36 {
		t.Errorf("5/10 messages (^1.5): got %f, want ~35.36", got)
	}
}

func TestCalculateFatigue_MessageCount_SystemExcluded(t *testing.T) {
	m := []types.ContextMessage{
		msgs("system prompt"),
		msgNoRound("user msg"),
	}
	s := &config.ContextStrategy{Type: "message_count", Count: 10}
	got := CalculateFatigue(m, s, "")
	// 1 non-system: (1/10)^1.5 × 100 ≈ 3.16 (convex)
	if got < 3 || got > 4 {
		t.Errorf("1/10 (^1.5) with system ignored: got %f, want ~3.16", got)
	}
}

func TestCalculateFatigue_UnknownStrategy(t *testing.T) {
	m := []types.ContextMessage{msgr("r1", "hello")}
	s := &config.ContextStrategy{Type: "unknown_type", Percent: 80}
	if got := CalculateFatigue(m, s, "gpt-4o"); got != 0 {
		t.Errorf("unknown strategy: got %f, want 0", got)
	}
}

// ── CalculateWakefulness ──

func TestCalculateWakefulness_NilStrategy(t *testing.T) {
	m := []types.ContextMessage{msgr("r1", "hello")}
	if got := CalculateWakefulness(m, nil, "gpt-4o"); got != 0 {
		t.Errorf("nil strategy: got %f, want 0", got)
	}
}

func TestCalculateWakefulness_EmptyMessages(t *testing.T) {
	s := &config.ContextStrategy{Type: "token_percent", Percent: 80}
	if got := CalculateWakefulness(nil, s, "gpt-4o"); got != 0 {
		t.Errorf("nil: got %f, want 0", got)
	}
	if got := CalculateWakefulness([]types.ContextMessage{}, s, "gpt-4o"); got != 0 {
		t.Errorf("empty: got %f, want 0", got)
	}
}

func TestCalculateWakefulness_TokenPercent_Zero(t *testing.T) {
	s := &config.ContextStrategy{Type: "token_percent", Percent: 80}
	// System prompt only, very few tokens
	m := []types.ContextMessage{msgs("you are a helpful assistant")}
	got := CalculateWakefulness(m, s, "gpt-4o")
	if got >= 30 {
		t.Errorf("system-only wakefulness: got %f, want <30 (low)", got)
	}
}

func TestCalculateWakefulness_TokenPercent_AtIdeal(t *testing.T) {
	// gpt-4o: max=128000, percent=0.8, ideal=128000*0.8*0.5=51200
	// 51200*4=204800 chars → wakefulness=100
	m := []types.ContextMessage{msgr("r1", strings.Repeat("x", 204800))}
	s := &config.ContextStrategy{Type: "token_percent", Percent: 80}
	got := CalculateWakefulness(m, s, "gpt-4o")
	if got < 98 {
		t.Errorf("at ideal: got %f, want ~100", got)
	}
}

func TestCalculateWakefulness_TokenPercent_AboveIdeal(t *testing.T) {
	// Above ideal should cap at 100
	m := []types.ContextMessage{msgr("r1", strings.Repeat("x", 500000))}
	s := &config.ContextStrategy{Type: "token_percent", Percent: 80}
	got := CalculateWakefulness(m, s, "gpt-4o")
	if got > 100 {
		t.Errorf("above ideal: got %f, want capped at 100", got)
	}
}

func TestCalculateWakefulness_RoundCount_Empty(t *testing.T) {
	s := &config.ContextStrategy{Type: "round_count", Count: 7}
	if got := CalculateWakefulness([]types.ContextMessage{}, s, ""); got != 0 {
		t.Errorf("empty: got %f, want 0", got)
	}
}

func TestCalculateWakefulness_RoundCount_AtIdeal(t *testing.T) {
	// ideal = 7*0.5 = 3.5, so 3 or 4 rounds should be near 100
	// 3/3.5*100 ≈ 85.7, 4/3.5*100 capped at 100
	m := []types.ContextMessage{
		msgr("r1", "a"),
		msgr("r2", "b"),
		msgr("r3", "c"),
		msgr("r4", "d"),
	}
	s := &config.ContextStrategy{Type: "round_count", Count: 7}
	got := CalculateWakefulness(m, s, "")
	if got != 100 {
		t.Errorf("4 rounds (ideal=3.5): got %f, want 100", got)
	}
}

func TestCalculateWakefulness_RoundCount_Partial(t *testing.T) {
	// sweet = 7/3 ≈ 2.33, 2/2.33 = 0.857, sqrt(0.857) × 100 ≈ 92.58 (concave)
	m := []types.ContextMessage{
		msgr("r1", "a"),
		msgr("r2", "b"),
	}
	s := &config.ContextStrategy{Type: "round_count", Count: 7}
	got := CalculateWakefulness(m, s, "")
	if got < 91 || got > 94 {
		t.Errorf("2 rounds (sweet=7/3): got %f, want ~92.58", got)
	}
}

func TestCalculateWakefulness_MessageCount_Partial(t *testing.T) {
	// sweet = 10/3 ≈ 3.33, 3/3.33 = 0.9, sqrt(0.9) × 100 ≈ 94.87 (concave)
	m := make([]types.ContextMessage, 3)
	for i := 0; i < 3; i++ {
		m[i] = msgNoRound("hello")
	}
	s := &config.ContextStrategy{Type: "message_count", Count: 10}
	got := CalculateWakefulness(m, s, "")
	if got < 93 || got > 96 {
		t.Errorf("3/3.33 sweet (sqrt): got %f, want ~94.87", got)
	}
}

// ── FatigueLevel ──

func TestFatigueLevel_Thresholds(t *testing.T) {
	tests := []struct {
		value float64
		want  string
	}{
		{0, "正常"},
		{15, "正常"},
		{29.9, "正常"},
		{30, "较高"},
		{45, "较高"},
		{59.9, "较高"},
		{60, "很高"},
		{72.5, "很高"},
		{84.9, "很高"},
		{85, "极高"},
		{100, "极高"},
		{200, "极高"},
	}
	for _, tt := range tests {
		if got := FatigueLevel(tt.value); got != tt.want {
			t.Errorf("FatigueLevel(%f) = %q, want %q", tt.value, got, tt.want)
		}
	}
}

func TestWakefulnessLevel_Thresholds(t *testing.T) {
	tests := []struct {
		value float64
		want  string
	}{
		{0, "低"},
		{15, "低"},
		{29.9, "低"},
		{30, "正常"},
		{45, "正常"},
		{59.9, "正常"},
		{60, "较高"},
		{72.5, "较高"},
		{84.9, "较高"},
		{85, "高"},
		{100, "高"},
		{200, "高"},
	}
	for _, tt := range tests {
		if got := WakefulnessLevel(tt.value); got != tt.want {
			t.Errorf("WakefulnessLevel(%f) = %q, want %q", tt.value, got, tt.want)
		}
	}
}

// ── 综合场景 ──

func TestFatigueAndWakefulness_DeepRestScenario(t *testing.T) {
	// 模拟深度休息后：上下文已清理，仅剩 system prompt
	// 此时疲劳值应接近 0，唤醒值应较低
	m := []types.ContextMessage{msgs("You are Melchior, a rational decision-maker.")}
	s := &config.ContextStrategy{Type: "token_percent", Percent: 80}

	fatigue := CalculateFatigue(m, s, "gpt-4o")
	wakefulness := CalculateWakefulness(m, s, "gpt-4o")

	if fatigue > 5 {
		t.Errorf("deep rest fatigue: got %f, want <=5 (near zero)", fatigue)
	}
	if wakefulness >= 30 {
		t.Errorf("deep rest wakefulness: got %f, want <30 (low)", wakefulness)
	}
}

func TestFatigueAndWakefulness_HealthyState(t *testing.T) {
	// 正常工作状态：2 轮对话，疲劳低，唤醒值正常
	m := []types.ContextMessage{
		msgr("r1", "Today I need to review the design doc."),
		msgr("r2", "I've noted the issues and will follow up."),
	}
	s := &config.ContextStrategy{Type: "round_count", Count: 7}

	fatigue := CalculateFatigue(m, s, "")
	wakefulness := CalculateWakefulness(m, s, "")

	if fatigueLevel := FatigueLevel(fatigue); fatigueLevel != "正常" {
		t.Errorf("healthy fatigue: got %s, want 正常", fatigueLevel)
	}
	if wl := WakefulnessLevel(wakefulness); wl == "低" {
		t.Errorf("healthy wakefulness: should not be low, got %s", wl)
	}
	t.Logf("healthy — fatigue: %.2f (%s), wakefulness: %.2f (%s)",
		fatigue, FatigueLevel(fatigue), wakefulness, WakefulnessLevel(wakefulness))
}

func TestFatigueAndWakefulness_NearLimit(t *testing.T) {
	// 接近上限：大量轮次，信息过载
	m := make([]types.ContextMessage, 7)
	for i := 0; i < 7; i++ {
		m[i] = msgr(string(rune('0'+i)), strings.Repeat("data ", 50))
	}
	s := &config.ContextStrategy{Type: "round_count", Count: 7}

	fatigue := CalculateFatigue(m, s, "")
	wakefulness := CalculateWakefulness(m, s, "")

	if FatigueLevel(fatigue) != "极高" {
		t.Errorf("near limit fatigue: got %s, want 极高", FatigueLevel(fatigue))
	}
	// 7 rounds with ideal=3.5 → wakefulness capped at 100 → "高"
	if WakefulnessLevel(wakefulness) != "高" {
		t.Errorf("near limit wakefulness: got %s, want 高", WakefulnessLevel(wakefulness))
	}
}

func TestFatigueAndWakefulness_AfterDeepRest(t *testing.T) {
	// 深度休息后：context cleared, system prompt re-added
	// fatigue=0, wakefulness=low → both are negative signals in their own dimension
	m := []types.ContextMessage{msgs("You are Casper, an intuitive observer.")}
	s := &config.ContextStrategy{Type: "token_percent", Percent: 40}

	fatigue := CalculateFatigue(m, s, "gpt-4o")
	wakefulness := CalculateWakefulness(m, s, "gpt-4o")

	if FatigueLevel(fatigue) != "正常" {
		t.Errorf("after deep rest: fatigue should be 正常, got %s", FatigueLevel(fatigue))
	}
	if WakefulnessLevel(wakefulness) != "低" {
		t.Errorf("after deep rest: wakefulness should be 低, got %s", WakefulnessLevel(wakefulness))
	}
}

func TestFatigueAndWakefulness_DualNegative(t *testing.T) {
	// 高疲劳 + 低唤醒值 → 深度休息后的典型负面态（清理后信息不足）
	// 或者低疲劳 + 高唤醒值 → 理想态
	// 高疲劳 + 高唤醒值 → 信息丰富但即将遗忘（正面负面并存）

	// 模拟：context 刚被清理，system prompt 重新注入
	m := []types.ContextMessage{msgs("You are Balthazar, scientific thinker.")}
	s := &config.ContextStrategy{Type: "token_percent", Percent: 40}

	fatigue := CalculateFatigue(m, s, "gpt-4o")
	wakefulness := CalculateWakefulness(m, s, "gpt-4o")

	if FatigueLevel(fatigue) != "正常" {
		t.Errorf("after deep rest: fatigue should be 正常, got %s", FatigueLevel(fatigue))
	}
	if WakefulnessLevel(wakefulness) != "低" {
		t.Errorf("after deep rest: wakefulness should be 低, got %s", WakefulnessLevel(wakefulness))
	}
}

// ── 三贤人差异化策略 ──

func TestFatigue_MelchiorVsBalthazar(t *testing.T) {
	// 同样的内容，Melchior (80%) 应该比 Balthazar (40%) 疲劳值更低
	content := strings.Repeat("The quick brown fox jumps over the lazy dog. ", 200)
	m := []types.ContextMessage{msgr("r1", content)}

	melchior := &config.ContextStrategy{Type: "token_percent", Percent: 80}
	balthazar := &config.ContextStrategy{Type: "token_percent", Percent: 40}

	fMel := CalculateFatigue(m, melchior, "gpt-4o")
	fBal := CalculateFatigue(m, balthazar, "gpt-4o")

	if fMel >= fBal {
		t.Errorf("Melchior fatigue (%.2f) should be lower than Balthazar (%.2f) for same content", fMel, fBal)
	}
}

func TestWakefulness_BalthazarVsMelchior(t *testing.T) {
	// Balthazar 40% budget, ideal = max*0.4*0.5 = 0.2*max
	// Melchior 80% budget, ideal = max*0.8*0.5 = 0.4*max
	// Same content → Balthazar should have higher wakefulness (closer to his ideal)
	content := strings.Repeat("x", 50000)
	m := []types.ContextMessage{msgr("r1", content)}

	melchior := &config.ContextStrategy{Type: "token_percent", Percent: 80}
	balthazar := &config.ContextStrategy{Type: "token_percent", Percent: 40}

	wMel := CalculateWakefulness(m, melchior, "gpt-4o")
	wBal := CalculateWakefulness(m, balthazar, "gpt-4o")

	t.Logf("Melchior wakefulness: %.2f, Balthazar wakefulness: %.2f", wMel, wBal)
	// Both should be in reasonable range
	if wMel < 0 || wMel > 100 || wBal < 0 || wBal > 100 {
		t.Errorf("wakefulness out of range: Mel=%.2f, Bal=%.2f", wMel, wBal)
	}
}

func TestFatigue_CasperRoundCount(t *testing.T) {
	// Casper: 7 round_count strategy
	m := make([]types.ContextMessage, 4)
	for i := 0; i < 4; i++ {
		m[i] = msgr(string(rune('0'+i)), "observation notes here")
	}
	s := &config.ContextStrategy{Type: "round_count", Count: 7}

	fatigue := CalculateFatigue(m, s, "")
	// (4/7)^1.5 × 100 ≈ 43.19 → "较高"
	if level := FatigueLevel(fatigue); level != "较高" {
		t.Errorf("Casper 4/7 rounds: got %s, want 较高", level)
	}

	// Add 2 more rounds → (6/7)^1.5 × 100 ≈ 79.37 → "很高"
	m = append(m,
		msgr("r5", "more observations"),
		msgr("r6", "final notes"),
	)
	fatigue = CalculateFatigue(m, s, "")
	if level := FatigueLevel(fatigue); level != "很高" {
		t.Errorf("Casper 6/7 rounds (^1.5): got %s, want 很高", level)
	}
}

// ── 边界与稳定性 ──

func TestCalculateFatigue_NegativeValues(t *testing.T) {
	// Ensure no panics or NaN
	m := []types.ContextMessage{msgr("r1", "hello")}
	s := &config.ContextStrategy{Type: "token_percent", Percent: -50}
	got := CalculateFatigue(m, s, "gpt-4o")
	if got != 0 {
		t.Errorf("negative percent: got %f, want 0", got)
	}
}

func TestCalculateWakefulness_UnknownModel(t *testing.T) {
	m := []types.ContextMessage{msgr("r1", "hello")}
	s := &config.ContextStrategy{Type: "token_percent", Percent: 80}
	got := CalculateWakefulness(m, s, "nonexistent-model-v42")
	// Unknown model defaults to 128000 max tokens
	// No panic is the main test
	if got < 0 || got > 100 {
		t.Errorf("unknown model: got out of range %f", got)
	}
}

func TestFatigueAndWakefulness_Consistent(t *testing.T) {
	// 同一个输入多次调用应返回一致结果
	s := &config.ContextStrategy{Type: "token_percent", Percent: 80}
	m := []types.ContextMessage{msgr("r1", strings.Repeat("hello world ", 100))}

	f1 := CalculateFatigue(m, s, "gpt-4o")
	f2 := CalculateFatigue(m, s, "gpt-4o")
	w1 := CalculateWakefulness(m, s, "gpt-4o")
	w2 := CalculateWakefulness(m, s, "gpt-4o")

	if f1 != f2 {
		t.Errorf("fatigue inconsistent: %.10f vs %.10f", f1, f2)
	}
	if w1 != w2 {
		t.Errorf("wakefulness inconsistent: %.10f vs %.10f", w1, w2)
	}
}

func TestCalculateFatigue_SystemPromptIgnoredInRoundCount(t *testing.T) {
	m := []types.ContextMessage{
		msgs("You are a helpful assistant."),
		msgr("r1", "hello"),
		msgr("r2", "world"),
	}
	s := &config.ContextStrategy{Type: "round_count", Count: 7}
	got := CalculateFatigue(m, s, "")
	// 2 unique rounds: (2/7)^1.5 × 100 ≈ 15.27 (convex)
	if got < 15 || got > 16 {
		t.Errorf("system prompt ignored: got %f, want ~15.27", got)
	}
}

func TestWakefulness_SystemPromptMinimal(t *testing.T) {
	// Just system prompt, no conversation → very low wakefulness
	m := []types.ContextMessage{msgs("You are Melchior.")}
	s := &config.ContextStrategy{Type: "token_percent", Percent: 80}
	w := CalculateWakefulness(m, s, "gpt-4o")
	if l := WakefulnessLevel(w); l != "低" {
		t.Errorf("system-only: got %s, want 低", l)
	}
}

func TestFatigue_EmptyRoundID_NotCounted(t *testing.T) {
	m := []types.ContextMessage{
		msgNoRound("orphan message"),
		msgNoRound("another orphan"),
	}
	s := &config.ContextStrategy{Type: "round_count", Count: 7}
	got := CalculateFatigue(m, s, "")
	if got != 0 {
		t.Errorf("messages without RoundID: got %f, want 0", got)
	}
}

// ── 多语言字符估算 ──

func TestEstimateContextTokens_PureEnglish(t *testing.T) {
	m := []types.ContextMessage{
		msgr("r1", strings.Repeat("x", 400)),
	}
	got := estimateContextTokens(m)
	// 400 ASCII chars → 400/4 = 100 tokens
	if got != 100 {
		t.Errorf("pure English 400 chars: got %d, want 100", got)
	}
}

func TestEstimateContextTokens_PureChinese(t *testing.T) {
	m := []types.ContextMessage{
		msgr("r1", strings.Repeat("中", 200)),
	}
	got := estimateContextTokens(m)
	// 200 non-ASCII chars → 200/2 = 100 tokens
	if got != 100 {
		t.Errorf("pure Chinese 200 chars: got %d, want 100", got)
	}
}

func TestEstimateContextTokens_Mixed(t *testing.T) {
	// "hello世界" = 5 ASCII + 2 non-ASCII
	m := []types.ContextMessage{
		msgr("r1", "hello世界"),
	}
	got := estimateContextTokens(m)
	// ascii: 5/4 = 1, other: 2/2 = 1, total = 2
	if got != 2 {
		t.Errorf("mixed 'hello世界': got %d, want 2", got)
	}
}

func TestFatigue_ChineseVsEnglish_SameTokens(t *testing.T) {
	// 400 ASCII chars 和 200 中文字符估算 token 相同 → 疲劳值应相等
	mEn := []types.ContextMessage{msgr("r1", strings.Repeat("x", 400))}
	mZh := []types.ContextMessage{msgr("r1", strings.Repeat("中", 200))}
	s := &config.ContextStrategy{Type: "token_percent", Percent: 80}

	fEn := CalculateFatigue(mEn, s, "gpt-4o")
	fZh := CalculateFatigue(mZh, s, "gpt-4o")

	if fEn != fZh {
		t.Errorf("same estimated tokens should give same fatigue: en=%.4f zh=%.4f", fEn, fZh)
	}
}

func TestFatigue_ChineseUnderestimatesVsEnglish(t *testing.T) {
	// 旧算法 /4 下：200 中文 chars → 200/4=50 tokens（严重低估）
	// 新算法 /2 下：200 中文 chars → 200/2=100 tokens（更接近真实）
	// 英文字符数量相同时：400 英文字符 → 400/4=100 tokens
	mEn := []types.ContextMessage{msgr("r1", strings.Repeat("x", 400))}
	mZh := []types.ContextMessage{msgr("r1", strings.Repeat("中", 400))}
	s := &config.ContextStrategy{Type: "token_percent", Percent: 80}

	fEn := CalculateFatigue(mEn, s, "gpt-4o")
	fZh := CalculateFatigue(mZh, s, "gpt-4o")

	// 中文字符估算 token 是英文的 2 倍 (200 vs 100)
	// convex fatigue: 2^1.5 = 2.828
	expectedRatio := 2.828
	actualRatio := fZh / fEn
	if actualRatio < expectedRatio*0.9 || actualRatio > expectedRatio*1.1 {
		t.Errorf("Chinese/English fatigue ratio: got %.2f, want ~%.2f (en=%.2f zh=%.2f)",
			actualRatio, expectedRatio, fEn, fZh)
	}
}
