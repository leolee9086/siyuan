package coordinator

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strings"

	"github.com/siyuan-note/siyuan/kernel/nerv/magi/config"
)

var blockRefRe = regexp.MustCompile(`\(\([^\)]+\)\)`)

const minBidirectionalLinks = 3

func countBidirectionalLinks(content string) int {
	matches := blockRefRe.FindAllString(content, -1)
	total := 0
	for _, m := range matches {
		inner := m[2 : len(m)-2]
		quoteIdx := strings.IndexAny(inner, "'\"")
		var idPart string
		if quoteIdx >= 0 {
			idPart = inner[:quoteIdx]
		} else {
			idPart = inner
		}
		ids := strings.Fields(idPart)
		total += len(ids)
	}
	return total
}

func isActiveNoteWriteToolName(toolName string) bool {
	switch strings.TrimSpace(toolName) {
	case config.CreateNoteDocumentToolName,
		config.AppendNoteBlocksToolName,
		config.ModifyNoteBlockToolName,
		config.WriteDiaryToolName:
		return true
	default:
		return false
	}
}

func extractContentArg(toolName string, rawArgs string) (string, error) {
	toolName = strings.TrimSpace(toolName)
	rawArgs = strings.TrimSpace(rawArgs)
	if rawArgs == "" {
		return "", fmt.Errorf("%s 参数为空", toolName)
	}

	var args struct {
		Content  string `json:"content"`
		Markdown string `json:"markdown"`
	}
	if err := json.Unmarshal([]byte(rawArgs), &args); err != nil {
		return "", fmt.Errorf("%s 参数解析失败: %w", toolName, err)
	}

	switch toolName {
	case config.WriteDiaryToolName:
		return strings.TrimSpace(args.Markdown), nil
	default:
		return strings.TrimSpace(args.Content), nil
	}
}

func buildLinkRequirementInstruction(toolName string, currentCount int) string {
	return fmt.Sprintf(
		"笔记内容至少需要包含%d个双向链接（使用 ((块ID \"显示文字\")) 格式引用其他笔记块），当前只有%d个，请补充双向链接后重新调用 %s。",
		minBidirectionalLinks,
		currentCount,
		toolName,
	)
}

func marshalLinkInsufficientResult(toolName string, currentCount int) string {
	payload := map[string]interface{}{
		"ok":           false,
		"state":        "link_insufficient",
		"currentLinks": currentCount,
		"required":     minBidirectionalLinks,
		"instruction":  buildLinkRequirementInstruction(toolName, currentCount),
	}
	raw, _ := json.Marshal(payload)
	return string(raw)
}

func isLinkInsufficientResult(rawResult string) (bool, string) {
	var payload struct {
		State       string `json:"state"`
		Instruction string `json:"instruction"`
	}
	if err := json.Unmarshal([]byte(strings.TrimSpace(rawResult)), &payload); err != nil {
		return false, ""
	}
	if payload.State == "link_insufficient" {
		return true, strings.TrimSpace(payload.Instruction)
	}
	return false, ""
}

func validateNoteToolContent(toolName string, rawArgs string) (linksCount int, isValid bool) {
	content, err := extractContentArg(toolName, rawArgs)
	if err != nil {
		return 0, false
	}
	count := countBidirectionalLinks(content)
	return count, count >= minBidirectionalLinks
}
