package coordinator

import (
	"errors"
	"fmt"
	"strings"
)

var (
	// ErrSearchNotFound 表示 SEARCH 文本在文件中未找到任何匹配。
	// 调用方应使用 WrapSearchNotFoundError 构造包含上下文信息的错误。
	ErrSearchNotFound = errors.New("search text not found")

	// ErrMultipleMatches 表示 SEARCH 文本在文件中匹配到多处。
	ErrMultipleMatches = errors.New("search text matches multiple locations")
)

const (
	// maxSearchContextLines 是 0 次匹配错误信息中附带的最大上下文行数。
	maxSearchContextLines = 10
)

// applySearchReplace 执行 SEARCH/REPLACE 替换操作。
//
// 匹配规则（严格精确匹配，不做任何静默修正）：
//  1. 换行符归一化：\r\n → \n（仅此项，避免跨平台换行符导致匹配失败）
//  2. 精确字节匹配：strings.Contains(content, oldStr)
//  3. 无任何自动补全或尾空白忽略
//
// 匹配结果：
//   - 0 次匹配 → 返回 ErrSearchNotFound（调用方应使用 WrapSearchNotFoundError 附带行号/上下文）
//   - 1 次匹配 → 执行替换，返回替换后的完整内容
//   - ≥2 次匹配 → 返回 ErrMultipleMatches
//
// 此函数是纯函数，不涉及 I/O，可被未来任意编辑工具复用。
func applySearchReplace(content, oldStr, newStr string) (newContent string, applied bool, err error) {
	normalizedContent := normalizeForgeRepoText(content)
	normalizedOld := normalizeForgeRepoText(oldStr)

	if normalizedOld == "" {
		return "", false, errors.New("search text cannot be empty after normalization")
	}

	count := strings.Count(normalizedContent, normalizedOld)
	switch {
	case count == 0:
		return "", false, ErrSearchNotFound
	case count > 1:
		return "", false, ErrMultipleMatches
	}

	// 在归一化后的内容中执行替换，保留原始换行符风格
	result := strings.Replace(normalizedContent, normalizedOld, newStr, 1)
	return result, true, nil
}

// WrapSearchNotFoundError 构建附带上下文信息的搜索未匹配错误。
// content 是原始文件内容，oldStr 是搜索文本。
// 返回的错误中会附带模糊的行号范围和上下文摘要行，帮助调用方（LLM）修正 SEARCH 块。
func WrapSearchNotFoundError(content, oldStr string) error {
	normalizedContent := normalizeForgeRepoText(content)
	normalizedOld := normalizeForgeRepoText(oldStr)

	oldFirstLine := extractFirstLine(normalizedOld)

	lines := strings.Split(normalizedContent, "\n")
	contextLines := findBestMatchLines(lines, normalizedOld)

	msg := fmt.Sprintf("在文件中未找到指定内容")
	if oldFirstLine != "" {
		msg += fmt.Sprintf("，首行原文: %s", truncateSearchLine(oldFirstLine))
	}
	if contextLines.start > 0 {
		msg += fmt.Sprintf("，最接近的匹配在行 %d 附近", contextLines.start)
	}
	if contextLines.snippet != "" {
		msg += fmt.Sprintf("\n附近上下文:\n%s", contextLines.snippet)
	}

	return fmt.Errorf("%w: %s", ErrSearchNotFound, msg)
}

// searchContextLineRange 描述最佳匹配的位置和上下文片段。
type searchContextLineRange struct {
	start   int
	snippet string
}

// findBestMatchLines 在文件各行中寻找最接近指定文本的匹配位置。
// 返回匹配位置的行号和前后各 maxSearchContextLines 行的上下文片段。
func findBestMatchLines(lines []string, needle string) searchContextLineRange {
	needleLines := strings.Split(needle, "\n")
	if len(needleLines) == 0 {
		return searchContextLineRange{}
	}

	firstNeedleLine := strings.TrimSpace(needleLines[0])
	if firstNeedleLine == "" {
		return searchContextLineRange{}
	}

	// 寻找包含目标首行中非空白词的所在行
	bestScore := 0
	bestLineIdx := -1

	for idx, line := range lines {
		score := fuzzyMatchScore(line, firstNeedleLine)
		if score > bestScore {
			bestScore = score
			bestLineIdx = idx
		}
	}

	if bestLineIdx < 0 || bestScore < 2 {
		return searchContextLineRange{}
	}

	// 提取上下文
	start := bestLineIdx - maxSearchContextLines
	if start < 0 {
		start = 0
	}
	end := bestLineIdx + maxSearchContextLines
	if end >= len(lines) {
		end = len(lines) - 1
	}

	var builder strings.Builder
	for i := start; i <= end; i++ {
		if i >= 0 && i < len(lines) {
			builder.WriteString(fmt.Sprintf("%6d | %s\n", i+1, lines[i]))
		}
	}

	return searchContextLineRange{
		start:   bestLineIdx + 1,
		snippet: builder.String(),
	}
}

// fuzzyMatchScore 计算 line 与 target 的模糊匹配分数。
// 匹配一个非空白词段得 1 分；全匹配额外加分。
func fuzzyMatchScore(line, target string) int {
	if strings.TrimSpace(line) == "" || strings.TrimSpace(target) == "" {
		return 0
	}

	lineLower := strings.ToLower(strings.TrimSpace(line))
	targetLower := strings.ToLower(strings.TrimSpace(target))

	if lineLower == targetLower {
		return 100
	}

	score := 0
	targetTokens := strings.Fields(targetLower)
	for _, token := range targetTokens {
		if strings.Contains(lineLower, token) {
			score++
		}
	}

	return score
}

// extractFirstLine 提取多行文本的首个非空行。
func extractFirstLine(text string) string {
	lines := strings.Split(text, "\n")
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed != "" {
			return trimmed
		}
	}
	return ""
}

// truncateSearchLine 截断过长行用于错误信息展示。
func truncateSearchLine(line string) string {
	runes := []rune(strings.TrimSpace(line))
	if len(runes) <= 80 {
		return string(runes)
	}
	return string(runes[:80]) + "..."
}
