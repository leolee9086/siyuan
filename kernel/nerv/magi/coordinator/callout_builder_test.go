package coordinator

import (
	"testing"
)

func TestBuildCalloutMarkdown_StructuredFields(t *testing.T) {
	got := BuildCalloutMarkdown("NOTE", "测试笔记",
		CalloutField{Label: "字段A", Value: "值A"},
		CalloutField{Label: "字段B", Value: "值B"},
	)
	want := "> [!NOTE] 测试笔记\n> **字段A**: 值A\n> **字段B**: 值B"
	if got != want {
		t.Fatalf("期望:\n%q\n实际:\n%q", want, got)
	}
}

func TestBuildCalloutMarkdown_MultiLineValue(t *testing.T) {
	got := BuildCalloutMarkdown("DREAM", "🌙 合并睡前笔记",
		CalloutField{Label: "当前记录", Value: "第一行\n第二行\n第三行"},
		CalloutField{Label: "补充整理描述", Value: "段落1\n\n段落3"},
	)
	want := "> [!DREAM] 🌙 合并睡前笔记\n> **当前记录**: 第一行\n> 第二行\n> 第三行\n> **补充整理描述**: 段落1\n>\n> 段落3"
	if got != want {
		t.Fatalf("期望:\n%q\n实际:\n%q", want, got)
	}
}

func TestBuildCalloutMarkdown_RawContent(t *testing.T) {
	got := BuildCalloutMarkdown("NOTE", "",
		CalloutField{Value: "# 标题\n\n任意 **Markdown** 内容\n\n- 列表项1\n- 列表项2"},
	)
	want := "> [!NOTE]\n> # 标题\n>\n> 任意 **Markdown** 内容\n>\n> - 列表项1\n> - 列表项2"
	if got != want {
		t.Fatalf("期望:\n%q\n实际:\n%q", want, got)
	}
}

func TestBuildCalloutMarkdown_EmptyValueSkipped(t *testing.T) {
	got := BuildCalloutMarkdown("NOTE", "测试",
		CalloutField{Label: "字段A", Value: ""},
		CalloutField{Label: "字段B", Value: "值B"},
		CalloutField{Label: "字段C", Value: ""},
	)
	want := "> [!NOTE] 测试\n> **字段B**: 值B"
	if got != want {
		t.Fatalf("期望:\n%q\n实际:\n%q", want, got)
	}
}

func TestBuildCalloutMarkdown_EmptyTitle(t *testing.T) {
	got := BuildCalloutMarkdown("WARNING", "",
		CalloutField{Label: "字段", Value: "值"},
	)
	want := "> [!WARNING]\n> **字段**: 值"
	if got != want {
		t.Fatalf("期望:\n%q\n实际:\n%q", want, got)
	}
}

func TestBuildCalloutMarkdown_OnlyHeader(t *testing.T) {
	got := BuildCalloutMarkdown("NOTE", "无字段")
	want := "> [!NOTE] 无字段"
	if got != want {
		t.Fatalf("期望:\n%q\n实际:\n%q", want, got)
	}
}

func TestBuildCalloutMarkdown_CRLFNormalization(t *testing.T) {
	got := BuildCalloutMarkdown("NOTE", "测试",
		CalloutField{Label: "字段", Value: "行1\r\n行2\r行3"},
	)
	want := "> [!NOTE] 测试\n> **字段**: 行1\n> 行2\n> 行3"
	if got != want {
		t.Fatalf("期望:\n%q\n实际:\n%q", want, got)
	}
}

func TestBuildCalloutMarkdown_MixedFields(t *testing.T) {
	got := BuildCalloutMarkdown("QUERY_RESULT", "笔记关键词搜索",
		CalloutField{Label: "查询", Value: "关键词"},
		CalloutField{Label: "匹配块数", Value: "2（共 5 个命中）"},
		CalloutField{Label: "结果", Value: "{{ select * from blocks where id in ('block1', 'block2') }}"},
	)
	want := "> [!QUERY_RESULT] 笔记关键词搜索\n> **查询**: 关键词\n> **匹配块数**: 2（共 5 个命中）\n> **结果**: {{ select * from blocks where id in ('block1', 'block2') }}"
	if got != want {
		t.Fatalf("期望:\n%q\n实际:\n%q", want, got)
	}
}
