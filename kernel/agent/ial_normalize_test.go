// SiYuan - Refactor your thinking
// Copyright (c) 2020-present, b3log.org
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

package agent

import (
	"strings"
	"testing"
)

// 本文件锁定 IAL 规范化与 scripts/upstream-sync/procedure-block.mjs 的
// canonicalizeKramdown 语义一致(核心不变量),防止"两套规范化规则漂移"。
//
// 所有期望输出均由 mjs 端预先计算并内嵌于此(生成方式:
//
//	node --input-type=module -e 'import {canonicalizeKramdown} from "./scripts/upstream-sync/procedure-block.mjs"; ...'
//
// 测试不依赖运行时执行 mjs)。样例输入避开首尾空白(已知差异①:Go 端
// normalizePromptSnapshot 整体保留 TrimSpace,mjs 无此步)。

// ialCanonicalCases 是 NormalizeIALAttributes 的交叉样例(输入已换行归一化,不含 \r)。
// 期望输出 = mjs canonicalizeKramdown 对同一输入(换行归一化后)的输出。
func ialCanonicalCases() []struct{ in, want string } {
	return []struct{ in, want string }{
		// 属性顺序不同 → 规范化后相同(核心回归)。
		{`before {: id="a" updated="b"} after`, `before {: id="a" updated="b"} after`},
		{`before {: updated="b" id="a"} after`, `before {: id="a" updated="b"} after`},
		{`x {: z="1" a="2" m="3"} y`, `x {: a="2" m="3" z="1"} y`},
		// 值含空格(双引号包裹)、转义引号、单引号、中文值 → 正确解析与排序。
		{`{: title="hello world" note="say \"hi\"" key='single value' 中文="值" id="x"}`,
			`{: id="x" key='single value' note="say \"hi\"" title="hello world" 中文="值"}`},
		// 空 IAL 与无 IAL 不受影响。
		{`{:}`, `{:}`},
		{`{: }`, `{:}`},
		{`no ial here`, `no ial here`},
		// 引用块 IAL、多属性 IAL。
		{`> {: id="x" updated="1"}`, `> {: id="x" updated="1"}`},
		{`{: id="x" updated="1" colgroup="|"}`, `{: colgroup="|" id="x" updated="1"}`},
		// 多个 IAL,各自独立排序。
		{`p {: id="p1" updated="t"}
{: updated="t2" id="p2"}`, `p {: id="p1" updated="t"}
{: id="p2" updated="t2"}`},
	}
}

func TestIALNormalizeMatchesCanonicalizeKramdown(t *testing.T) {
	for _, c := range ialCanonicalCases() {
		if got := NormalizeIALAttributes(c.in); got != c.want {
			t.Errorf("NormalizeIALAttributes(%q)\n got: %q\nwant: %q", c.in, got, c.want)
		}
	}
}

// TestIALNormalizePromptSnapshotMatchesCanonicalizeKramdown 覆盖带 \r\n 的输入:
// normalizePromptSnapshot(换行归一化 + IAL 排序 + TrimSpace)整体行为与
// mjs canonicalizeKramdown(先 \r\n? → \n,再 IAL 排序)一致。
func TestIALNormalizePromptSnapshotMatchesCanonicalizeKramdown(t *testing.T) {
	cases := []struct{ in, want string }{
		{`a` + "\r\n" + `{: b="2" a="1"}`, `a` + "\n" + `{: a="1" b="2"}`},
		{`p {: id="p1" updated="t"}` + "\r\n" + `{: updated="t2" id="p2"}`, `p {: id="p1" updated="t"}` + "\n" + `{: id="p2" updated="t2"}`},
		{`{: id="a" updated="b"}`, `{: id="a" updated="b"}`},
	}
	for _, c := range cases {
		if got := normalizePromptSnapshot(c.in); got != c.want {
			t.Errorf("normalizePromptSnapshot(%q)\n got: %q\nwant: %q", c.in, got, c.want)
		}
	}
}

// TestIALNormalizeHashStableAcrossAttributeOrder 是核心回归:
// IAL 属性顺序不同 → 规范化后 hash 相同。
func TestIALNormalizeHashStableAcrossAttributeOrder(t *testing.T) {
	a := `x {: z="1" a="2" m="3"} y`
	b := `x {: m="3" z="1" a="2"} y`
	if h1, h2 := promptSourceVersion(normalizePromptSnapshot(a)), promptSourceVersion(normalizePromptSnapshot(b)); h1 != h2 {
		t.Fatalf("hash drifted across attribute order: %s != %s", h1, h2)
	}
	// 真实内容变化(值不同)仍须改变 hash —— 不误伤真实变化检测。
	c := `x {: z="9" a="2" m="3"} y`
	if h3 := promptSourceVersion(normalizePromptSnapshot(c)); h3 == promptSourceVersion(normalizePromptSnapshot(a)) {
		t.Fatal("real content change did not change hash")
	}
}

// TestIALNormalizeIdempotent 强制幂等不变量:normalize(normalize(x)) == normalize(x)。
func TestIALNormalizeIdempotent(t *testing.T) {
	inputs := []string{
		`before {: updated="b" id="a"} after`,
		`{: title="hello world" note="say \"hi\"" key='single value' 中文="值" id="x"}`,
		`{:}`,
		`no ial here`,
		`x {: z="1" a="2" m="3"} y` + "\n" + `{: updated="t2" id="p2"}`,
	}
	for _, in := range inputs {
		once := NormalizeIALAttributes(in)
		twice := NormalizeIALAttributes(once)
		if once != twice {
			t.Errorf("NormalizeIALAttributes not idempotent for %q: %q != %q", in, once, twice)
		}
		if n1, n2 := normalizePromptSnapshot(in), normalizePromptSnapshot(normalizePromptSnapshot(in)); n1 != n2 {
			t.Errorf("normalizePromptSnapshot not idempotent for %q", in)
		}
	}
}

// TestIALNormalizeUnicodeWhitespace 锁定 JS \s 集合中的 Unicode 空白行为:
// 与 mjs 的 \s 一致,这些字符在 IAL 内均作为分隔符参与分词(全角空格、NBSP、
// 行分隔符等);Go 端通过展开 jsWhiteSpace 显式复刻,不允许退化为 RE2 的 ASCII \s。
// 期望输出按 ECMAScript WhiteSpace ∪ LineTerminator 语义推导(与 mjs 正则等价)。
func TestIALNormalizeUnicodeWhitespace(t *testing.T) {
	cases := []struct{ in, want string }{
		// 全角空格分隔属性。
		{"{: a=\"1\"\u3000b=\"2\"}", `{: a="1" b="2"}`},
		// NBSP 在 {: 之后。
		{"{:\u00a0id=\"x\" updated=\"y\"}", `{: id="x" updated="y"}`},
		// 行分隔符 U+2028 分隔属性。
		{"{: a=\"1\"\u2028b=\"2\"}", `{: a="1" b="2"}`},
		// 引号内的全角空格是值的一部分,不被分割。
		{"{: a=\"1\u30002\" b=\"2\"}", `{: a="1` + "\u3000" + `2" b="2"}`},
	}
	for _, c := range cases {
		if got := NormalizeIALAttributes(c.in); got != c.want {
			t.Errorf("NormalizeIALAttributes(%q)\n got: %q\nwant: %q", c.in, got, c.want)
		}
	}
}

// TestIALNormalizeDoesNotTouchNonIALText 确保规范化不触碰 IAL 之外的文本。
func TestIALNormalizeDoesNotTouchNonIALText(t *testing.T) {
	in := "普通文本 **加粗** `代码` [链接](https://example.com) 与 {: updated=\"b\" id=\"a\"} 混合\n- 列表项\n- 另一项"
	want := "普通文本 **加粗** `代码` [链接](https://example.com) 与 {: id=\"a\" updated=\"b\"} 混合\n- 列表项\n- 另一项"
	if got := NormalizeIALAttributes(in); got != want {
		t.Errorf("non-IAL text was modified\n got: %q\nwant: %q", got, want)
	}
}

// TestIALNormalizeMalformedIAL 畸形 IAL(不闭合、跨行)按 mjs 语义保持原样或仅处理可匹配部分:
// 模式要求属性区不含 {} 与换行;不闭合的 {: 不匹配。
func TestIALNormalizeMalformedIAL(t *testing.T) {
	cases := []struct{ in, want string }{
		{`{: id="a" updated="b"`, `{: id="a" updated="b"`},      // 不闭合:不匹配,原样。
		{`{: id="a" updated="b"} 尾部 {`, `{: id="a" updated="b"} 尾部 {`}, // 尾随 { 不影响。
		{"{: a=\"1\"\n b=\"2\"}", "{: a=\"1\"\n b=\"2\"}"},       // 跨行:不匹配,原样。
	}
	for _, c := range cases {
		if got := NormalizeIALAttributes(c.in); got != c.want {
			t.Errorf("NormalizeIALAttributes(%q)\n got: %q\nwant: %q", c.in, got, c.want)
		}
	}
}

// TestIALNormalizeIdempotentAcrossRealShapes 用真实文档形态(引用块、表格、列表缩进)
// 再验证一次幂等性。
func TestIALNormalizeIdempotentAcrossRealShapes(t *testing.T) {
	in := "> 引用 {: id=\"q1\" updated=\"t1\"}\n>\n{: id=\"q0\" updated=\"t0\"}\n\n|a|b|\n| -| -|\n{: id=\"tbl\" updated=\"t2\" colgroup=\"|\"}\n\n- {: updated=\"t3\" id=\"li1\"}项"
	once := NormalizeIALAttributes(in)
	twice := NormalizeIALAttributes(once)
	if once != twice {
		t.Errorf("not idempotent across real shapes\nonce : %q\ntwice: %q", once, twice)
	}
	if !strings.Contains(once, `{: id="li1" updated="t3"}`) {
		t.Errorf("list IAL not normalized: %q", once)
	}
}
