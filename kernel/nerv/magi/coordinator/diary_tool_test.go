package coordinator

import (
	"strings"
	"testing"

	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
	"github.com/siyuan-note/siyuan/kernel/util"
)

func TestBuildDiaryCalloutMarkdown_ProducesNativeCalloutContainer(t *testing.T) {
	args := &types.WriteDiaryTool{
		Markdown: "# 标题\n\n任意 **Markdown** 内容\n\n- 列表项1\n- 列表项2\n\n```go\nfmt.Println(\"hi\")\n```",
	}

	markdown := buildDiaryCalloutMarkdown(args)
	if !strings.HasPrefix(markdown, "> [!NOTE]\n") {
		t.Fatalf("期望生成 NOTE callout 头，实际=%q", markdown)
	}

	dom := util.NewLute().Md2BlockDOM(markdown, false)
	for _, needle := range []string{
		`data-type="NodeCallout"`,
		`class="callout-content"`,
		`data-type="NodeHeading"`,
		`data-type="NodeList"`,
		`data-type="NodeCodeBlock"`,
	} {
		if !strings.Contains(dom, needle) {
			t.Fatalf("期望 DOM 包含 %s，实际=%s", needle, dom)
		}
	}
}

func TestBuildDiaryCalloutMarkdown_PreservesBlankLinesAndTitle(t *testing.T) {
	args := &types.WriteDiaryTool{
		Markdown:    "第一行\n\n第二行",
		CalloutType: "WARNING",
		Title:       " 今日记录 ",
	}

	got := buildDiaryCalloutMarkdown(args)
	want := "> [!WARNING] 今日记录\n> 第一行\n>\n> 第二行"
	if got != want {
		t.Fatalf("期望生成的 markdown 为 %q，实际=%q", want, got)
	}
}
