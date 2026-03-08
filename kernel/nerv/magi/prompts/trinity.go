package prompts

import "fmt"

const (
	// TrinityFallbackMelchior Trinity 内省中的逻辑侧兜底文本。
	TrinityFallbackMelchior = "我还在整理逻辑线索。"
	// TrinityFallbackBalthazar Trinity 内省中的情绪侧兜底文本。
	TrinityFallbackBalthazar = "我还在感受这件事的情绪波动。"
	// TrinityFallbackCasper Trinity 内省中的直觉侧兜底文本。
	TrinityFallbackCasper = "我暂时没有明确的本能倾向。"
)

// BuildTrinityIntrospectionInput 构建 Trinity 内省输入模板。
func BuildTrinityIntrospectionInput(melchior, balthazar, casper string) string {
	return fmt.Sprintf(`逻辑告诉我：%s

情绪告诉我：%s

直觉告诉我：%s`, melchior, balthazar, casper)
}
