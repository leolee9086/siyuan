package coordinator

import (
	"strings"
	"testing"

	"github.com/siyuan-note/siyuan/kernel/nerv/magi/config"
)

func TestCountBidirectionalLinks_Empty(t *testing.T) {
	if n := countBidirectionalLinks(""); n != 0 {
		t.Fatalf("expected 0, got %d", n)
	}
}

func TestCountBidirectionalLinks_NoLinks(t *testing.T) {
	if n := countBidirectionalLinks("这是一段普通文本，没有链接"); n != 0 {
		t.Fatalf("expected 0, got %d", n)
	}
}

func TestCountBidirectionalLinks_SingleStatic(t *testing.T) {
	content := `参考 ((20201105103725-dd01qas "思源笔记")) 中的相关内容`
	if n := countBidirectionalLinks(content); n != 1 {
		t.Fatalf("expected 1, got %d", n)
	}
}

func TestCountBidirectionalLinks_SingleDynamic(t *testing.T) {
	content := `参考 ((20201105103725-dd01qas '思源笔记')) 中的相关内容`
	if n := countBidirectionalLinks(content); n != 1 {
		t.Fatalf("expected 1, got %d", n)
	}
}

func TestCountBidirectionalLinks_NoAnchor(t *testing.T) {
	content := `参考 ((20201105103725-dd01qas)) 中的相关内容`
	if n := countBidirectionalLinks(content); n != 1 {
		t.Fatalf("expected 1, got %d", n)
	}
}

func TestCountBidirectionalLinks_Multiple(t *testing.T) {
	content := `对比 ((id1 "文档A")) 和 ((id2 "文档B")) 以及 ((id3 '文档C')) 的差异`
	if n := countBidirectionalLinks(content); n != 3 {
		t.Fatalf("expected 3, got %d", n)
	}
}

func TestCountBidirectionalLinks_MultiID(t *testing.T) {
	content := `参考 ((id1 id2 "合并文档")) 中的内容`
	if n := countBidirectionalLinks(content); n != 2 {
		t.Fatalf("expected 2, got %d", n)
	}
}

func TestCountBidirectionalLinks_MultiID_ThreeIDs(t *testing.T) {
	content := `参考 ((id1 id2 id3 "综合文档")) 的内容`
	if n := countBidirectionalLinks(content); n != 3 {
		t.Fatalf("expected 3, got %d", n)
	}
}

func TestCountBidirectionalLinks_MultiID_DynamicText(t *testing.T) {
	content := `参考 ((id1 id2 id3 '综合文档')) 的内容`
	if n := countBidirectionalLinks(content); n != 3 {
		t.Fatalf("expected 3, got %d", n)
	}
}

func TestCountBidirectionalLinks_MultiID_NoText(t *testing.T) {
	content := `参考 ((id1 id2)) 中的内容`
	if n := countBidirectionalLinks(content); n != 2 {
		t.Fatalf("expected 2, got %d", n)
	}
}

func TestCountBidirectionalLinks_MultiID_Adjacent(t *testing.T) {
	content := `((id1 id2 "a"))((id3 "b"))`
	if n := countBidirectionalLinks(content); n != 3 {
		t.Fatalf("expected 3, got %d", n)
	}
}

func TestCountBidirectionalLinks_Unclosed(t *testing.T) {
	content := `这是一个未闭合的 ((id1 "text"`
	if n := countBidirectionalLinks(content); n != 0 {
		t.Fatalf("expected 0, got %d", n)
	}
}

func TestCountBidirectionalLinks_NestedParens(t *testing.T) {
	content := `((id1 "text with ) paren"))`
	// 当前正则 `\(\([^\)]+\)\)` 不支持 ) 出现在引号内的情况
	if n := countBidirectionalLinks(content); n != 0 {
		t.Fatalf("expected 0 (regex limitation), got %d", n)
	}
}

func TestCountBidirectionalLinks_Adjacent(t *testing.T) {
	content := `((id1 "a"))((id2 "b"))((id3 "c"))`
	if n := countBidirectionalLinks(content); n != 3 {
		t.Fatalf("expected 3, got %d", n)
	}
}

func TestIsActiveNoteWriteToolName_AllTools(t *testing.T) {
	tests := []struct {
		name string
		want bool
	}{
		{config.CreateNoteDocumentToolName, true},
		{config.AppendNoteBlocksToolName, true},
		{config.ModifyNoteBlockToolName, true},
		{config.WriteDiaryToolName, true},
		{config.WannaSleepRecordToolName, false},
		{config.WannaSleepPlanToolName, false},
		{config.WannaSleepDreamToolName, false},
		{config.NoteKeywordSearchToolName, false},
		{config.NoteByIDReadToolName, false},
		{config.ForgeDevRepoEditToolName, false},
		{config.RevertNoteBlockToolName, false},
		{config.WannaSpeakStartToolName, false},
		{"", false},
		{"unknown_tool", false},
	}
	for _, tt := range tests {
		got := isActiveNoteWriteToolName(tt.name)
		if got != tt.want {
			t.Errorf("isActiveNoteWriteToolName(%q) = %v, want %v", tt.name, got, tt.want)
		}
	}
}

func TestExtractContentArg_CreateDocument(t *testing.T) {
	content, err := extractContentArg(config.CreateNoteDocumentToolName, `{"title":"t","content":"hello world"}`)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if content != "hello world" {
		t.Fatalf("expected 'hello world', got %q", content)
	}
}

func TestExtractContentArg_AppendBlocks(t *testing.T) {
	content, err := extractContentArg(config.AppendNoteBlocksToolName, `{"parent_id":"p","content":"block content"}`)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if content != "block content" {
		t.Fatalf("expected 'block content', got %q", content)
	}
}

func TestExtractContentArg_ModifyBlock(t *testing.T) {
	content, err := extractContentArg(config.ModifyNoteBlockToolName, `{"block_id":"b","content":"updated content"}`)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if content != "updated content" {
		t.Fatalf("expected 'updated content', got %q", content)
	}
}

func TestExtractContentArg_WriteDiary(t *testing.T) {
	content, err := extractContentArg(config.WriteDiaryToolName, `{"markdown":"diary entry","motivation":"test"}`)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if content != "diary entry" {
		t.Fatalf("expected 'diary entry', got %q", content)
	}
}

func TestExtractContentArg_EmptyArgs(t *testing.T) {
	_, err := extractContentArg(config.CreateNoteDocumentToolName, "")
	if err == nil {
		t.Fatal("expected error for empty args")
	}
}

func TestExtractContentArg_InvalidJSON(t *testing.T) {
	_, err := extractContentArg(config.CreateNoteDocumentToolName, "{invalid}")
	if err == nil {
		t.Fatal("expected error for invalid JSON")
	}
}

func TestExtractContentArg_WhitespaceTrimmed(t *testing.T) {
	content, err := extractContentArg(config.CreateNoteDocumentToolName, `{"content":"  spaced  "}`)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if content != "spaced" {
		t.Fatalf("expected 'spaced', got %q", content)
	}
}

func TestValidateNoteToolContent_EnoughLinks(t *testing.T) {
	args := `{"content":"参考 ((id1 \"文档A\"))、((id2 \"文档B\")) 和 ((id3 \"文档C\")) 的差异"}`
	count, valid := validateNoteToolContent(config.CreateNoteDocumentToolName, args)
	if !valid {
		t.Fatalf("expected valid, got invalid (count=%d)", count)
	}
	if count < 3 {
		t.Fatalf("expected count >= 3, got %d", count)
	}
}

func TestValidateNoteToolContent_TooFewLinks(t *testing.T) {
	args := `{"content":"只引用了 ((id1 \"一份文档\"))"}`
	count, valid := validateNoteToolContent(config.CreateNoteDocumentToolName, args)
	if valid {
		t.Fatalf("expected invalid, got valid (count=%d)", count)
	}
	if count != 1 {
		t.Fatalf("expected count=1, got %d", count)
	}
}

func TestValidateNoteToolContent_ZeroLinks(t *testing.T) {
	args := `{"content":"完全没有链接的笔记内容"}`
	count, valid := validateNoteToolContent(config.CreateNoteDocumentToolName, args)
	if valid {
		t.Fatalf("expected invalid, got valid (count=%d)", count)
	}
	if count != 0 {
		t.Fatalf("expected count=0, got %d", count)
	}
}

func TestValidateNoteToolContent_MultiIDSingleMatch(t *testing.T) {
	args := `{"content":"汇总 ((id1 id2 id3 \"三份文档\")) 的要点"}`
	count, valid := validateNoteToolContent(config.CreateNoteDocumentToolName, args)
	if !valid {
		t.Fatalf("expected valid (1 match × 3 IDs = 3), got invalid (count=%d)", count)
	}
	if count != 3 {
		t.Fatalf("expected count=3, got %d", count)
	}
}

func TestValidateNoteToolContent_Diary(t *testing.T) {
	args := `{"markdown":"参考 ((id1 \"a\"))、((id2 \"b\")) 和 ((id3 \"c\"))","motivation":"test"}`
	count, valid := validateNoteToolContent(config.WriteDiaryToolName, args)
	if !valid {
		t.Fatalf("expected valid, got invalid (count=%d)", count)
	}
	if count < 3 {
		t.Fatalf("expected count >= 3, got %d", count)
	}
}

func TestMarshalLinkInsufficientResult(t *testing.T) {
	result := marshalLinkInsufficientResult(config.WriteDiaryToolName, 1)
	retry, instruction := isLinkInsufficientResult(result)
	if !retry {
		t.Fatal("expected link_insufficient state")
	}
	if instruction == "" {
		t.Fatal("expected non-empty instruction")
	}
}

func TestIsLinkInsufficientResult_NotMatch(t *testing.T) {
	retry, instruction := isLinkInsufficientResult(`{"ok":true,"state":"written"}`)
	if retry {
		t.Fatal("expected not link_insufficient")
	}
	if instruction != "" {
		t.Fatalf("expected empty instruction, got %q", instruction)
	}
}

func TestIsLinkInsufficientResult_InvalidJSON(t *testing.T) {
	retry, instruction := isLinkInsufficientResult("not json")
	if retry {
		t.Fatal("expected not link_insufficient for invalid JSON")
	}
	if instruction != "" {
		t.Fatalf("expected empty instruction, got %q", instruction)
	}
}

func TestBuildLinkRequirementInstruction(t *testing.T) {
	inst := buildLinkRequirementInstruction(config.CreateNoteDocumentToolName, 1)
	if inst == "" {
		t.Fatal("expected non-empty instruction")
	}
	if !strings.Contains(inst, config.CreateNoteDocumentToolName) {
		t.Fatalf("instruction should contain tool name %q", config.CreateNoteDocumentToolName)
	}
}

func TestRoundtrip_MarshalAndParse(t *testing.T) {
	result := marshalLinkInsufficientResult(config.ModifyNoteBlockToolName, 0)
	retry, instruction := isLinkInsufficientResult(result)
	if !retry {
		t.Fatal("roundtrip failed: expected link_insufficient")
	}
	if instruction == "" {
		t.Fatal("roundtrip failed: expected non-empty instruction")
	}
}
