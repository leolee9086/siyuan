package seraph

import (
	"math"
	"testing"
)

func TestComputeStyleSimilarity_Identical(t *testing.T) {
	s := StyleMetrics{
		TypeTokenRatio:     0.6,
		AvgSentenceLength:  25.0,
		SentenceLengthStd:  10.0,
		PunctuationEntropy: 2.5,
	}
	sim := ComputeStyleSimilarity(s, s)
	if sim != 1.0 {
		t.Fatalf("identical metrics: got %f, want 1.0", sim)
	}
}

func TestComputeStyleSimilarity_MaximallyDifferent(t *testing.T) {
	minV := StyleMetrics{
		TypeTokenRatio:     0,
		AvgSentenceLength:  0,
		SentenceLengthStd:  0,
		PunctuationEntropy: 0,
	}
	maxV := StyleMetrics{
		TypeTokenRatio:     1.0,
		AvgSentenceLength:  100.0,
		SentenceLengthStd:  100.0,
		PunctuationEntropy: 10.0,
	}
	sim := ComputeStyleSimilarity(minV, maxV)
	if sim != -1.0 {
		t.Fatalf("maximally different: got %f, want -1.0", sim)
	}
}

func TestComputeStyleSimilarity_Partial(t *testing.T) {
	a := StyleMetrics{
		TypeTokenRatio:     0.5,
		AvgSentenceLength:  20.0,
		SentenceLengthStd:  8.0,
		PunctuationEntropy: 2.0,
	}
	b := StyleMetrics{
		TypeTokenRatio:     0.5,
		AvgSentenceLength:  30.0,
		SentenceLengthStd:  8.0,
		PunctuationEntropy: 2.0,
	}
	sim := ComputeStyleSimilarity(a, b)
	// Only AvgSentenceLength differs: 0.2 vs 0.3 in normalized space
	// distance = sqrt((0.2-0.3)^2) = 0.1, similarity = 2*(1-0.1/2)-1 = 0.9
	want := 2.0*(1.0-0.1/2.0) - 1.0
	if math.Abs(sim-want) > 1e-10 {
		t.Fatalf("partial diff: got %f, want %f", sim, want)
	}
}

func TestComputeStyleSimilarity_ClampAtMinusOne(t *testing.T) {
	// distance > maxDistance(2.0) → clamp to -1.0
	a := StyleMetrics{
		TypeTokenRatio:     0,
		AvgSentenceLength:  0,
		SentenceLengthStd:  0,
		PunctuationEntropy: 0,
	}
	b := StyleMetrics{
		TypeTokenRatio:     5.0,
		AvgSentenceLength:  0,
		SentenceLengthStd:  0,
		PunctuationEntropy: 0,
	}
	sim := ComputeStyleSimilarity(a, b)
	if sim != -1.0 {
		t.Fatalf("clamp: got %f, want -1.0", sim)
	}
}

func TestComputeStyleMetrics_EmptyText(t *testing.T) {
	m, err := ComputeStyleMetrics("")
	if err != nil {
		t.Fatalf("empty text: unexpected error: %v", err)
	}
	if m.TypeTokenRatio != 0 {
		t.Errorf("empty TTR: got %f, want 0", m.TypeTokenRatio)
	}
	if m.AvgSentenceLength != 0 {
		t.Errorf("empty avg len: got %f, want 0", m.AvgSentenceLength)
	}
	if m.SentenceLengthStd != 0 {
		t.Errorf("empty std: got %f, want 0", m.SentenceLengthStd)
	}
	if m.PunctuationEntropy != 0 {
		t.Errorf("empty punct entropy: got %f, want 0", m.PunctuationEntropy)
	}
}

func TestComputeStyleMetrics_SingleSentence(t *testing.T) {
	text := "今天天气很好。"
	m, err := ComputeStyleMetrics(text)
	if err != nil {
		t.Fatalf("single sentence: unexpected error: %v", err)
	}
	if m.TypeTokenRatio <= 0 || m.TypeTokenRatio > 1.0 {
		t.Errorf("TTR out of range: %f", m.TypeTokenRatio)
	}
	if m.AvgSentenceLength <= 0 {
		t.Errorf("avg len should be > 0: %f", m.AvgSentenceLength)
	}
	// Single punct type → entropy = -1*log2(1) = 0
	if m.PunctuationEntropy != 0 {
		t.Errorf("punct entropy should be 0 (single punct type): %f", m.PunctuationEntropy)
	}
}

func TestComputeStyleMetrics_MultiSentence(t *testing.T) {
	text := "今天天气很好。我去公园散步。那里的花开得很美！"
	m, err := ComputeStyleMetrics(text)
	if err != nil {
		t.Fatalf("multi sentence: unexpected error: %v", err)
	}
	if m.TypeTokenRatio <= 0 || m.TypeTokenRatio > 1.0 {
		t.Errorf("TTR out of range: %f", m.TypeTokenRatio)
	}
	if m.AvgSentenceLength <= 0 {
		t.Errorf("avg len should be > 0: %f", m.AvgSentenceLength)
	}
	// Three sentences: two 。+ one ！ → multi-type punct → entropy > 0
	if m.PunctuationEntropy <= 0 {
		t.Errorf("punct entropy should be > 0 (multi punct type): %f", m.PunctuationEntropy)
	}
}

func TestComputeStyleMetrics_SelfSimilarity(t *testing.T) {
	text := "今天天气很好。我去公园散步。那里的花开得很美！"
	m1, err := ComputeStyleMetrics(text)
	if err != nil {
		t.Fatalf("first metrics: %v", err)
	}
	m2, err := ComputeStyleMetrics(text)
	if err != nil {
		t.Fatalf("second metrics: %v", err)
	}
	sim := ComputeStyleSimilarity(m1, m2)
	if sim != 1.0 {
		t.Errorf("self similarity: got %f, want 1.0", sim)
	}
}

func TestComputeStyleMetrics_NoPunctuation(t *testing.T) {
	text := "今天天气很好"
	m, err := ComputeStyleMetrics(text)
	if err != nil {
		t.Fatalf("no punct: unexpected error: %v", err)
	}
	if m.PunctuationEntropy != 0 {
		t.Errorf("punct entropy: got %f, want 0", m.PunctuationEntropy)
	}
}

func TestComputeStyleSimilarity_Symmetric(t *testing.T) {
	a := StyleMetrics{TypeTokenRatio: 0.3, AvgSentenceLength: 15, SentenceLengthStd: 5, PunctuationEntropy: 1.5}
	b := StyleMetrics{TypeTokenRatio: 0.7, AvgSentenceLength: 40, SentenceLengthStd: 20, PunctuationEntropy: 3.0}
	ab := ComputeStyleSimilarity(a, b)
	ba := ComputeStyleSimilarity(b, a)
	if ab != ba {
		t.Fatalf("not symmetric: ab=%f ba=%f", ab, ba)
	}
}

func TestParseAnswersLenient_AnswersOnly(t *testing.T) {
	expected := []IpipNeo120Item{{Q: 1}, {Q: 2}}
	content := "1. 符合\n2. 非常符合"
	r := parseAnswersLenient(content, expected)
	if len(r.answers) != 2 {
		t.Fatalf("answers count: got %d, want 2", len(r.answers))
	}
	if r.answers[1] != 4 {
		t.Errorf("q1 score: got %d, want 4", r.answers[1])
	}
	if r.answers[2] != 5 {
		t.Errorf("q2 score: got %d, want 5", r.answers[2])
	}
	if r.reflection != "" {
		t.Errorf("unexpected reflection: %q", r.reflection)
	}
}

func TestParseAnswersLenient_WithReflection(t *testing.T) {
	expected := []IpipNeo120Item{{Q: 1}, {Q: 2}}
	content := "1. 符合\n2. 非常符合\n我感觉这个测评很准确，反映了我的性格特点。"
	r := parseAnswersLenient(content, expected)
	if len(r.answers) != 2 {
		t.Fatalf("answers count: got %d, want 2", len(r.answers))
	}
	if r.reflection == "" {
		t.Fatal("reflection should not be empty")
	}
}

func TestParseAnswersLenient_ReflectionOnlyAfterAllAnswered(t *testing.T) {
	expected := []IpipNeo120Item{{Q: 1}, {Q: 2}}
	content := "1. 符合\n反思：我认为第一题符合我。\n2. 非常符合\n反思：第二题也很有道理。"
	r := parseAnswersLenient(content, expected)
	if len(r.answers) != 2 {
		t.Fatalf("answers count: got %d, want 2", len(r.answers))
	}
	// "反思：第二题也很有道理。" appears after all 2 answered → should be in reflection
	if r.reflection == "" {
		t.Fatal("reflection should not be empty")
	}
}

func TestParseAnswersLenient_EmptyContent(t *testing.T) {
	r := parseAnswersLenient("", []IpipNeo120Item{{Q: 1}})
	if len(r.answers) != 0 {
		t.Errorf("answers count: got %d, want 0", len(r.answers))
	}
	if r.reflection != "" {
		t.Errorf("unexpected reflection: %q", r.reflection)
	}
}

func TestParseAnswersLenient_PartialMatch(t *testing.T) {
	expected := []IpipNeo120Item{{Q: 1}, {Q: 2}}
	content := "1. 符合\n二. 不符合"
	r := parseAnswersLenient(content, expected)
	if len(r.answers) != 1 {
		t.Fatalf("answers count: got %d, want 1", len(r.answers))
	}
	if r.reflection != "" {
		t.Errorf("unexpected reflection: %q", r.reflection)
	}
}

func TestParseAnswersLenient_MultiLineReflection(t *testing.T) {
	expected := []IpipNeo120Item{{Q: 1}}
	content := "1. 非常不符合\n我觉得这个测试很有意思。\n它让我思考了很多关于自己的事情。"
	r := parseAnswersLenient(content, expected)
	if len(r.answers) != 1 {
		t.Fatalf("answers count: got %d, want 1", len(r.answers))
	}
	if r.reflection == "" {
		t.Fatal("reflection should not be empty")
	}
}

func TestParseAnswersLenient_UnexpectedQuestionNumber(t *testing.T) {
	expected := []IpipNeo120Item{{Q: 5}}
	content := "5. 符合\n6. 不符合"
	r := parseAnswersLenient(content, expected)
	if len(r.answers) != 1 {
		t.Fatalf("answers count: got %d, want 1", len(r.answers))
	}
	if _, ok := r.answers[5]; !ok {
		t.Error("q5 should be in answers")
	}
	// Q6 is not in expected set; after Q5 matched, stray numbered lines go to reflection
	if r.reflection == "" {
		t.Error("unexpected-question line should appear in reflection after all matched")
	}
}

func TestParseAnswersLenient_ReflectionWithNumberedPatterns(t *testing.T) {
	expected := []IpipNeo120Item{{Q: 1}, {Q: 2}}
	content := "1. 非常符合\n2. 非常符合\n第一，这个测评很全面。第二，结果符合预期。"
	r := parseAnswersLenient(content, expected)
	if len(r.answers) != 2 {
		t.Fatalf("answers count: got %d, want 2", len(r.answers))
	}
	if r.reflection == "" {
		t.Fatal("reflection should not be empty")
	}
}
