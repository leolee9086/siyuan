// SiYuan - Refactor your thinking
// Copyright (c) 2020-present, b3log.org

package cronjob

import (
	"strings"
	"testing"
)

// TestCompileDocumentContent 测试文档编译器的代码块连接逻辑
func TestCompileDocumentContent(t *testing.T) {
	// 模拟文档块列表：段落 + Go代码 + 段落 + Go代码
	testBlocks := []文档块{
		{类型: "paragraph", 内容: "这是一个定时任务的说明文档。"},
		{类型: "code_block", 代码语言: "go", 内容: `package main

var Name = "自动水印任务"
var Schedule = "*/5 * * * *"`},
		{类型: "paragraph", 内容: "下面是核心逻辑："},
		{类型: "code_block", 代码语言: "go", 内容: `func Run(ctx *定时任务上下文) error {
    // 执行任务
    return nil
}`},
		{类型: "paragraph", 内容: "任务完成。"},
	}

	// 执行编译
	result := 编译文档内容(testBlocks)

	// 验证结果
	t.Logf("编译结果:\n%s", result)

	// 检查1：Go代码块应该被保留
	if !strings.Contains(result, "package main") {
		t.Error("编译结果应该包含 package main")
	}
	if !strings.Contains(result, `var Name = "自动水印任务"`) {
		t.Error("编译结果应该包含 Name 变量定义")
	}
	if !strings.Contains(result, "func Run") {
		t.Error("编译结果应该包含 Run 函数")
	}

	// 检查2：非代码块应该变成注释
	if !strings.Contains(result, "// 这是一个定时任务的说明文档") {
		t.Error("段落应该被转换为注释")
	}
	if !strings.Contains(result, "// 下面是核心逻辑") {
		t.Error("段落应该被转换为注释")
	}

	// 检查3：代码块内容应该直接输出，不加注释前缀
	lines := strings.Split(result, "\n")
	hasPackageLine := false
	for _, line := range lines {
		if strings.TrimSpace(line) == "package main" {
			hasPackageLine = true
			break
		}
	}
	if !hasPackageLine {
		t.Error("package main 行不应该有注释前缀")
	}
}

// TestCompileWithMixedLanguages 测试混合语言代码块
func TestCompileWithMixedLanguages(t *testing.T) {
	testBlocks := []文档块{
		{类型: "code_block", 代码语言: "go", 内容: "package main"},
		{类型: "code_block", 代码语言: "javascript", 内容: "console.log('hello')"},
		{类型: "code_block", 代码语言: "go", 内容: "func main() {}"},
	}

	result := 编译文档内容(testBlocks)

	// Go代码应该保留
	if !strings.Contains(result, "package main") {
		t.Error("Go代码应该被保留")
	}
	if !strings.Contains(result, "func main()") {
		t.Error("Go函数应该被保留")
	}

	// JavaScript代码应该变成注释（只有内容，无语言标识）
	if !strings.Contains(result, "// console.log") {
		t.Error("非Go代码块内容应该变成注释")
	}
}

// TestIsomorphicCompile 同构测试：无论源内容从哪里来，编译结果应该一致
func TestIsomorphicCompile(t *testing.T) {
	// 场景1：手动构造的块列表
	manualBlocks := []文档块{
		{类型: "paragraph", 内容: "测试文档"},
		{类型: "code_block", 代码语言: "go", 内容: "package main\n\nvar X = 1"},
	}

	// 场景2：模拟从笔记解析出的块列表（内容完全相同）
	parsedBlocks := []文档块{
		{类型: "paragraph", 内容: "测试文档"},
		{类型: "code_block", 代码语言: "go", 内容: "package main\n\nvar X = 1"},
	}

	result1 := 编译文档内容(manualBlocks)
	result2 := 编译文档内容(parsedBlocks)

	// 同构：相同输入应产生相同输出
	if result1 != result2 {
		t.Errorf("同构测试失败：\n手动结果:\n%s\n解析结果:\n%s", result1, result2)
	}

	t.Logf("同构测试通过，输出长度: %d 字符", len(result1))
}

// TestLanguageMatching 测试语言匹配逻辑
func TestLanguageMatching(t *testing.T) {
	cases := []struct {
		codeBlockLang string
		targetLang    string
		shouldMatch   bool
	}{
		{"go", "go", true},
		{"golang", "go", true},
		{"Go", "go", true},
		{"GOLANG", "go", true},
		{"javascript", "go", false},
		{"python", "go", false},
		{"", "go", false},
	}

	for _, c := range cases {
		result := 语言匹配(c.codeBlockLang, c.targetLang)
		if result != c.shouldMatch {
			t.Errorf("语言匹配(%q, %q) = %v, 期望 %v", c.codeBlockLang, c.targetLang, result, c.shouldMatch)
		}
	}
}
