// SiYuan - Refactor your thinking
// Copyright (c) 2020-present, b3log.org
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

package agent

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/88250/gulu"
)

// 本文件覆盖:
//   - validatePromptSource 存量兼容垫片(旧语义 hash 双字段联合兜底);
//   - 新语义校验与篡改拒绝;
//   - 真实回归 fixture(样本取自会话 20260802000942-o33x6gg 的快照内容,内嵌于本文件,
//     不依赖运行环境会话目录),验证规范化确定性。

// legacyShimSample 的旧语义(仅换行归一化,无 IAL 排序)hash 必须与新语义 hash 不同,
// 否则该样本无法触发垫片分支(垫片测试前提)。
const legacyShimSample = "x {: z=\"1\" a=\"2\" m=\"3\"} y\n{: updated=\"b\" id=\"a\"}"

func legacyShimSource(snapshot, version string, capturedAt int64) PromptSource {
	return PromptSource{
		Kind:           PromptSourceKindDocument,
		DocumentID:     "20260715120010-abcdefg",
		NotebookID:     "20260715120011-abcdefg",
		TitleSnapshot:  "Rules",
		PromptSnapshot: snapshot,
		SourceVersion:  version,
		ContentHash:    strings.TrimPrefix(version, "sha256:"),
		CapturedAt:     capturedAt,
	}
}

// TestValidatePromptSourceLegacyShim 验证存量兼容垫片:
// 修复前写入的存量快照(旧语义 hash)必须通过校验(加载不报错),且不自动重写;
// 新语义数据按新语义校验;篡改仍被拒绝。
func TestValidatePromptSourceLegacyShim(t *testing.T) {
	legacyVersion := promptSourceVersion(normalizePromptSnapshotLegacy(legacyShimSample))
	newVersion := promptSourceVersion(normalizePromptSnapshot(legacyShimSample))
	if legacyVersion == newVersion {
		t.Fatalf("test precondition failed: legacy and new semantics produce the same hash")
	}

	// 旧语义 hash 的存量快照:垫片命中,校验通过。
	source := legacyShimSource(legacyShimSample, legacyVersion, 10)
	if err := validatePromptSource(source); err != nil {
		t.Fatalf("legacy snapshot rejected (compat shim should hit): %v", err)
	}

	// 新语义 hash 的数据:按新语义正常通过。
	fresh := legacyShimSource(legacyShimSample, newVersion, 10)
	if err := validatePromptSource(fresh); err != nil {
		t.Fatalf("new-semantics snapshot rejected: %v", err)
	}

	// 篡改 contentHash:双字段不配对(无论新/旧语义) → 拒绝。
	forged := legacyShimSource(legacyShimSample, legacyVersion, 10)
	forged.ContentHash = strings.Repeat("0", 64)
	if err := validatePromptSource(forged); err == nil {
		t.Fatal("tampered content hash accepted")
	}

	// 篡改快照内容:任何语义都不匹配 → 拒绝。
	tampered := legacyShimSource(legacyShimSample+"\ntampered", legacyVersion, 10)
	if err := validatePromptSource(tampered); err == nil {
		t.Fatal("tampered snapshot accepted")
	}

	// 仅 sourceVersion 匹配而 contentHash 不匹配(单字段兜底) → 仍拒绝(双字段联合)。
	half := legacyShimSource(legacyShimSample, legacyVersion, 10)
	half.ContentHash = strings.TrimPrefix(newVersion, "sha256:")
	if err := validatePromptSource(half); err == nil {
		t.Fatal("half-matched fingerprint accepted (must require same-semantics pair)")
	}
}

// TestValidatePromptSourceDefaultKind 确保 default 分支不受垫片影响。
func TestValidatePromptSourceDefaultKind(t *testing.T) {
	if err := validatePromptSource(defaultPromptSource()); err != nil {
		t.Fatalf("default prompt source rejected: %v", err)
	}
	if err := validatePromptSource(PromptSource{Kind: PromptSourceKindDefault, DocumentID: "x"}); err == nil {
		t.Fatal("invalid default prompt source accepted")
	}
}

// realFixtureSnippet 节选自会话 20260802000942-o33x6gg 的快照内容
// (promptSnapshot 字段,源文档《上游语义同步Agent系统提示词》)。
// 该快照是修复前的真实存量数据:同一文档内 IAL 属性顺序不一致
// (既有 id 在前,也有 updated 在前),正是本修复要消除的噪声来源。
// 节选保留了引用的乱序 IAL、引用块 IAL、表格多属性 IAL 与列表缩进 IAL;
// 反引号与部分正文已略去(不影响 IAL 规范化行为),完整快照见
// data/storage/ai/agent/sessions/20260802000942-o33x6gg/session.json。
const realFixtureSnippet = `# 上游语义同步 Agent 系统提示词
{: id="20260802000714-ryt0hgj" updated="20260802000714"}

> 本提示词用于指引 AI agent 在 S-Forge 仓库中持续执行"语义化跟进上游"流程。
> {: id="20260802000714-x5vda9r" updated="20260802000714"}
>
{: id="20260802000714-bbs2u66" updated="20260802000714"}

2. {: updated="20260802000714" id="20260802000714-mrq5vuy"}读 reconciliation.json（由工具重新计算的逐 SHA 对账账本），找最早仍需动作的完整记录；topologyLag 是剩余量。
   {: updated="20260802000714" id="20260802000714-4snhwgx"}

|L0|本轮同步的 S-Forge 固定起点（完整 SHA）|
| -----------| ------------------------------------------------------------|
{: id="20260802000714-4l2ddpy" updated="20260802000714" colgroup="|"}`

// TestPromptSnapshotNormalizationRealFixture 真实回归 fixture:
// 对同一快照内容连续规范化两次,结果必须一致(确定性,即修复后的核心行为),
// 且乱序 IAL 被正确排序。
func TestPromptSnapshotNormalizationRealFixture(t *testing.T) {
	first := normalizePromptSnapshot(realFixtureSnippet)
	second := normalizePromptSnapshot(first)
	if first != second {
		t.Fatalf("normalization not deterministic on real fixture")
	}
	// 已是规范形态:再次规范化结果不变(幂等)。
	if second != normalizePromptSnapshot(second) {
		t.Fatal("normalization not idempotent on real fixture")
	}

	// 原快照中的乱序 IAL(updated 在前)必须被排序为 id 在前。
	if !strings.Contains(first, `{: id="20260802000714-mrq5vuy" updated="20260802000714"}`) {
		t.Errorf("out-of-order IAL not sorted: %q", first)
	}
	if strings.Contains(first, `{: updated="20260802000714" id="20260802000714-mrq5vuy"}`) {
		t.Errorf("out-of-order IAL still present: %q", first)
	}
	// 引用块 IAL 保持属性顺序已稳定。
	if !strings.Contains(first, `{: id="20260802000714-x5vda9r" updated="20260802000714"}`) {
		t.Errorf("blockquote IAL not preserved: %q", first)
	}
	// 表格多属性 IAL 按字典序排序(colgroup < id < updated)。
	if !strings.Contains(first, `{: colgroup="|" id="20260802000714-4l2ddpy" updated="20260802000714"}`) {
		t.Errorf("table IAL attributes not sorted: %q", first)
	}
	// 列表缩进 IAL 同样排序。
	if !strings.Contains(first, `   {: id="20260802000714-4snhwgx" updated="20260802000714"}`) {
		t.Errorf("indented list IAL not sorted: %q", first)
	}
	// 正文(IAL 之外)不被触碰。
	if !strings.Contains(first, "读 reconciliation.json（由工具重新计算的逐 SHA 对账账本）") {
		t.Errorf("non-IAL body was modified: %q", first)
	}
}

// TestGetPromptSourceStateLoadsLegacyRealSession 复现 TTT 验证项:
// 修复前写入的存量会话(会话 20260802000942-o33x6gg 的形态:真实快照内容 +
// 旧语义 hash,双字段配对)在修复后加载必须不报错(兼容垫片生效),
// 且状态正确计算为 bound(会话未锁定、无对话记录、targetKind 为 native-agent)。
// 与真实会话的唯一差异:快照为节选(见 realFixtureSnippet),故 hash 按节选内容
// 以旧语义动态计算,走的是与真实会话完全相同的 validate → 垫片代码路径。
func TestGetPromptSourceStateLoadsLegacyRealSession(t *testing.T) {
	useTestDataDir(t)
	legacyVersion := promptSourceVersion(normalizePromptSnapshotLegacy(realFixtureSnippet))
	// SaveSession 会过滤客户端传入的 promptSource(服务端拥有该字段),
	// 因此先创建会话目录,再直接覆写 session.json,模拟真实磁盘上的存量会话。
	if _, err := SaveSession(marshalSession(t, map[string]any{
		"id":        testSessionID,
		"title":     "智能体",
		"createdAt": int64(1785600582191),
		"updatedAt": int64(1785600626368),
		"entries":   []any{},
	})); err != nil {
		t.Fatal(err)
	}
	session := map[string]any{
		"id":         testSessionID,
		"title":      "智能体",
		"createdAt":  int64(1785600582191),
		"updatedAt":  int64(1785600626368),
		"entries":    []any{},
		"targetKind": "native-agent",
		"promptSource": map[string]any{
			"kind":           PromptSourceKindDocument,
			"documentId":     "20260802000714-0rl16ck",
			"notebookId":     "20260731223542-xdn67ao",
			"titleSnapshot":  "上游语义同步Agent系统提示词",
			"contentHash":    strings.TrimPrefix(legacyVersion, "sha256:"),
			"sourceVersion":  legacyVersion,
			"capturedAt":     int64(1785600609771),
			"promptSnapshot": realFixtureSnippet,
			"keptVersion":    "sha256:6bb83df929ae6a8997493e0b4c017bf7546a899a7fe6e48764ccfa4747ebac29",
			"keptAt":         int64(1785600626368),
		},
	}
	data, err := gulu.JSON.MarshalIndentJSON(session, "", "\t")
	if err != nil {
		t.Fatal(err)
	}
	if err = os.WriteFile(filepath.Join(sessionsDir(), testSessionID, "session.json"), data, 0o644); err != nil {
		t.Fatal(err)
	}
	// 连续多次加载(对应修复后对绑定会话反复查询),状态必须稳定为 bound 且不报错。
	for i := 0; i < 3; i++ {
		state, err := GetPromptSourceState(testSessionID)
		if err != nil {
			t.Fatalf("legacy session rejected on load (shim must hit): %v", err)
		}
		if state.State != PromptBindingStateBound {
			t.Fatalf("unexpected state: %s", state.State)
		}
		if state.Source.DocumentID != "20260802000714-0rl16ck" {
			t.Fatalf("unexpected document: %s", state.Source.DocumentID)
		}
	}
}

// TestNewDocumentPromptSourceStableAcrossAttributeOrder 端到端回归:
// 同一文档内容、仅 IAL 属性顺序不同,绑定产生的 sourceVersion/contentHash 必须一致。
func TestNewDocumentPromptSourceStableAcrossAttributeOrder(t *testing.T) {
	a := "标题\n{: id=\"a\" updated=\"t\"}\n\n正文 {: z=\"1\" a=\"2\" m=\"3\"} 内容"
	b := "标题\n{: updated=\"t\" id=\"a\"}\n\n正文 {: m=\"3\" z=\"1\" a=\"2\"} 内容"
	sa, err := NewDocumentPromptSource("20260715120020-abcdefg", "20260715120021-abcdefg", "T", a, 10)
	if err != nil {
		t.Fatal(err)
	}
	sb, err := NewDocumentPromptSource("20260715120020-abcdefg", "20260715120021-abcdefg", "T", b, 10)
	if err != nil {
		t.Fatal(err)
	}
	if sa.SourceVersion != sb.SourceVersion || sa.ContentHash != sb.ContentHash {
		t.Fatalf("binding hash drifted across attribute order: %s != %s", sa.SourceVersion, sb.SourceVersion)
	}
	// 绑定结果本身必须能通过 validate(新语义)。
	if err := validatePromptSource(sa); err != nil {
		t.Fatalf("bound source rejected: %v", err)
	}
}
