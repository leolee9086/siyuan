package prompts

import "fmt"

// BuildTrinityIntrospectionInput 构建 Trinity 内省输入模板。
func BuildTrinityIntrospectionInput(melchior, balthazar, casper string) string {
	return fmt.Sprintf(`逻辑告诉我：%s

情绪告诉我：%s

直觉告诉我：%s`, melchior, balthazar, casper)
}
