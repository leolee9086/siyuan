package cli

import (
	"fmt"
	"strings"
)

var allowlistReplacer = strings.NewReplacer(
	"<", "",
	">", "",
	"\"", "",
	"'", "",
	"&", "",
	"`", "",
)

func SanitizeField(s string) (string, error) {
	cleaned := strings.TrimSpace(s)
	if cleaned == "" {
		return "", fmt.Errorf("field is empty")
	}
	if len(cleaned) > 4096 {
		return "", fmt.Errorf("field too long (%d bytes)", len(cleaned))
	}
	rejected := allowlistReplacer.Replace(cleaned)
	if rejected != cleaned {
		return "", fmt.Errorf("field contains HTML special characters")
	}
	return cleaned, nil
}

func SanitizeText(s string) string {
	return allowlistReplacer.Replace(s)
}
