package chatseqtrie

import "testing"

func TestDefaultSequencePolicyMovesSystemMessagesFirst(t *testing.T) {
	previous := []Message{
		{"role": "system", "content": "base"},
		{"role": "user", "content": "history"},
		{"role": "assistant", "content": "reply"},
	}
	current := append(append([]Message(nil), previous...), Message{"role": "system", "content": "dynamic-tail"})

	trie := New(WithFieldPolicy(nil))
	if _, err := trie.Insert("previous", previous); err != nil {
		t.Fatalf("Insert: %v", err)
	}
	match, err := trie.Match(current)
	if err != nil {
		t.Fatalf("Match: %v", err)
	}
	if match.CommonPrefixLen != 1 {
		t.Fatalf("默认 system-first 应在顶部 system 块分叉: got %d, want 1", match.CommonPrefixLen)
	}
}

func TestSequencePolicyPreserveOrderKeepsRawPrefix(t *testing.T) {
	previous := []Message{
		{"role": "system", "content": "base"},
		{"role": "user", "content": "history"},
	}
	current := append(append([]Message(nil), previous...), Message{"role": "system", "content": "dynamic-tail"})

	trie := New(WithFieldPolicy(nil), WithSequencePolicy(PreserveOrderSequencePolicy()))
	if _, err := trie.Insert("previous", previous); err != nil {
		t.Fatalf("Insert: %v", err)
	}
	match, err := trie.Match(current)
	if err != nil {
		t.Fatalf("Match: %v", err)
	}
	if match.CommonPrefixLen != len(previous) {
		t.Fatalf("preserve-order 应保留原始完整前缀: got %d, want %d", match.CommonPrefixLen, len(previous))
	}
}

func TestSystemMessagesFirstPolicyPreservesPinnedPrefix(t *testing.T) {
	previous := []Message{
		{"type": "tools_fingerprint", "content": "same"},
		{"role": "system", "content": "base"},
		{"role": "user", "content": "history"},
	}
	current := append(append([]Message(nil), previous...), Message{"role": "system", "content": "dynamic-tail"})

	trie := New(
		WithFieldPolicy(nil),
		WithSequencePolicy(SystemMessagesFirstSequencePolicy(1)),
	)
	if _, err := trie.Insert("previous", previous); err != nil {
		t.Fatalf("Insert: %v", err)
	}
	match, err := trie.Match(current)
	if err != nil {
		t.Fatalf("Match: %v", err)
	}
	const wantCommonPrefix = 2 // 固定工具指纹 + 已存在的 base system
	if match.CommonPrefixLen != wantCommonPrefix {
		t.Fatalf("固定前缀后 system-first 分叉位置 = %d, want %d", match.CommonPrefixLen, wantCommonPrefix)
	}
}

func TestSystemMessagesFirstPolicyIsStableWithinRolePartitions(t *testing.T) {
	policy := normalizeSequencePolicy(DefaultSequencePolicy())
	messages := []Message{
		{"role": "user", "content": "u1"},
		{"role": "system", "content": "s1"},
		{"role": "assistant", "content": "a1"},
		{"role": "system", "content": "s2"},
		{"role": "user", "content": "u2"},
	}
	projected := policy.project(messages)
	want := []string{"s1", "s2", "u1", "a1", "u2"}
	for i, content := range want {
		if projected[i]["content"] != content {
			t.Fatalf("稳定分区第 %d 条 = %v, want %s", i, projected[i]["content"], content)
		}
	}
}
