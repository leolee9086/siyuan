// SiYuan - Refactor your thinking
// Copyright (c) 2020-present, b3log.org
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

package agent

import (
	"regexp"
	"sort"
	"strings"
)

// 本文件实现 Kramdown IAL(Inline Attribute List)节点的规范化,语义必须与
// scripts/upstream-sync/procedure-block.mjs 的 canonicalizeKramdown 保持一致。
// 该函数是仓库既有的"规范 hash"权威语义(上游同步工具与发布规程镜像均依赖),
// 本实现不得另立一套规则;任何规则变更须同步两处并补充交叉样例单测。
//
// 复刻目标(mjs):
//
//	ialTokenPattern = /[^\s=]+=(?:"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|[^\s]+)|[^\s]+/gu
//	canonicalizeKramdown = (value) => value
//	    .replace(/\r\n?/gu, "\n")
//	    .replace(/\{:\\s*([^{}\r\n]*)\}/gu, (_match, attributes) => {
//	        const tokens = attributes.match(ialTokenPattern) ?? [];
//	        return `{${tokens.length > 0 ? `: ${tokens.sort().join(" ")}` : ":"}}`;
//	    });

// jsWhiteSpace 复刻 ECMAScript 的 \s(WhiteSpace ∪ LineTerminator)字符集合。
// RE2 内建 \s 仅匹配 ASCII 空白,而 JS \s 匹配 Unicode 空白;若直接使用 RE2 \s,
// IAL 内出现全角空格(\u3000)、不换行空格(\u00a0)等时两端分词结果不同,形成
// "两套规范化规则漂移"。这里显式展开 JS \s 的完整集合,使 Go 端与 mjs 语义完全一致。
// 注意必须使用解释型字符串(非 raw string),让 Go 将 \u 转义解释为实际字符;
// 正则中的范围写法 "\u2000-\u200a" 保持 '-' 字面量,与 JS 的 \u2000-\u200a 一致。
//
// ECMAScript 集合(ES2018+):
//
//	WhiteSpace:     \u0009 \u000B \u000C \u0020 \u00A0 \uFEFF \u1680 \u2000-\u200A \u202F \u205F \u3000
//	LineTerminator: \u000A \u000D \u2028 \u2029
const jsWhiteSpace = "\t\n\v\f\r\u0020\u00a0\ufeff\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000"

var (
	// ialTokenPattern 复刻 mjs ialTokenPattern:
	// 匹配 IAL 属性 token —— name=value(name 不含空白与 '=';值可为双引号/单引号
	// 包裹、内含反斜杠转义,或非空白串),或裸 token(无 '=' 的片段)。
	// 字符串拼接仅为复用 jsWhiteSpace 集合,避免两处手写漂移。
	ialTokenPattern = regexp.MustCompile(`[^` + jsWhiteSpace + `=]+=(?:"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|[^` + jsWhiteSpace + `]+)|[^` + jsWhiteSpace + `]+`)

	// ialBlockPattern 复刻 canonicalizeKramdown 的 /\{:\\s*([^{}\r\n]*)\}/gu:
	// 匹配 {: ... } IAL 节点,属性区不含 {} 与换行(与 mjs 一致,不跨行、不嵌套)。
	ialBlockPattern = regexp.MustCompile(`\{:[` + jsWhiteSpace + `]*([^{}\r\n]*)\}`)
)

// NormalizeIALAttributes 将快照中每个 IAL 节点的属性按字典序排序;无属性时规整为 {:}。
// 语义与 mjs canonicalizeKramdown 的 IAL 替换步骤一致:
//   - 仅重排属性顺序,不增删属性、不触碰 IAL 之外的文本;
//   - 同一 IAL 内重复 key(异常数据)与 mjs 一样保留重复项(仅排序);
//   - 排序为 sort.Strings(UTF-8 字节序)。与 JS sort(UTF-16 code unit)的差异:
//     BMP 内字符(含全部 CJK)两者序一致;仅当属性名含非 BMP 字符(如 emoji)且
//     排序边界落在代理对内时才可能不同 —— 现实 IAL 属性名为 ASCII(id/updated/
//     colgroup/自定义),此差异不可达,以单测锁定行为(见 ial_normalize_test.go)。
//
// 幂等性不变量:NormalizeIALAttributes(NormalizeIALAttributes(x)) == NormalizeIALAttributes(x),
// 由测试强制保证。调用方(normalizePromptSnapshot)负责先做换行归一化。
func NormalizeIALAttributes(snapshot string) string {
	locs := ialBlockPattern.FindAllStringSubmatchIndex(snapshot, -1)
	if len(locs) == 0 {
		return snapshot
	}
	var b strings.Builder
	b.Grow(len(snapshot))
	last := 0
	for _, loc := range locs {
		b.WriteString(snapshot[last:loc[0]])
		attrs := snapshot[loc[2]:loc[3]]
		if tokens := ialTokenPattern.FindAllString(attrs, -1); len(tokens) > 0 {
			sort.Strings(tokens)
			b.WriteString("{: ")
			b.WriteString(strings.Join(tokens, " "))
			b.WriteString("}")
		} else {
			b.WriteString("{:}")
		}
		last = loc[1]
	}
	b.WriteString(snapshot[last:])
	return b.String()
}
