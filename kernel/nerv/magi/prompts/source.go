package prompts

import (
	"encoding/json"
	"fmt"
)

// BuildSourceAwareUserInput 构建带 request_source/source=user_message 封装的用户输入。
func BuildSourceAwareUserInput(userMessage string, sourcePayload map[string]interface{}) string {
	raw, err := json.Marshal(sourcePayload)
	if err != nil {
		return userMessage
	}
	return fmt.Sprintf("<request_source>%s</request_source>\n<source=user_message>\n%s\n</source>", string(raw), userMessage)
}
