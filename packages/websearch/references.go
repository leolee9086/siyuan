package websearch

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/url"
	"regexp"
	"strings"
)

var searchReferenceURLPattern = regexp.MustCompile(`https?://[^\s<>\]\)"']+`)

// IsSearchResultURL accepts only absolute HTTP(S) URLs with a host.
// Search adapters may return malformed hrefs; those must never become user-visible sources.
func IsSearchResultURL(raw string) bool {
	value := strings.TrimSpace(raw)
	if value == "" || strings.ContainsAny(value, "\r\n\t") {
		return false
	}
	parsed, err := url.ParseRequestURI(value)
	if err != nil || parsed.Host == "" {
		return false
	}
	return parsed.Scheme == "http" || parsed.Scheme == "https"
}

// ProtectSearchResponse replaces source URLs with opaque ref tokens for AI tools.
// The returned LinkMap is intended for the UI renderer; it is removed before the
// protected response is sent back into model context.
func ProtectSearchResponse(response *SearchResponse) {
	if response == nil {
		return
	}
	linkMap := make(map[string]string)
	for index := range response.Results {
		result := &response.Results[index]
		if token, ok := protectSearchURL(result.URL, linkMap); ok {
			result.URL = token
		} else {
			result.URL = ""
		}
		// A model can copy a URL from a title or snippet even when the
		// structured URL field is protected.
		result.Title = replaceSearchURLs(result.Title, linkMap)
		result.Snippet = replaceSearchURLs(result.Snippet, linkMap)
		result.FullSnippet = replaceSearchURLs(result.FullSnippet, linkMap)
		result.Suggestion = replaceSearchURLs(result.Suggestion, linkMap)
	}
	response.Text = replaceSearchURLs(response.Text, linkMap)
	if len(linkMap) > 0 {
		response.LinkMap = linkMap
	} else {
		response.LinkMap = nil
	}
}

// RemoveSearchLinkMap removes renderer-only targets while preserving ref tokens.
// It is used by MAGI after archiving the detailed response and before adding the
// result to a sage context.
func RemoveSearchLinkMap(raw string) string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return raw
	}
	var payload map[string]interface{}
	if err := json.Unmarshal([]byte(trimmed), &payload); err != nil {
		return raw
	}
	if _, ok := payload["linkMap"]; !ok {
		return raw
	}
	delete(payload, "linkMap")
	encoded, err := json.Marshal(payload)
	if err != nil {
		return raw
	}
	return string(encoded)
}

func protectSearchURL(raw string, linkMap map[string]string) (string, bool) {
	value := strings.TrimSpace(raw)
	if !IsSearchResultURL(value) {
		return "", false
	}
	sum := sha256.Sum256([]byte(value))
	token := "ref:web-" + hex.EncodeToString(sum[:8])
	linkMap[token] = value
	return token, true
}

func replaceSearchURLs(text string, linkMap map[string]string) string {
	if strings.TrimSpace(text) == "" {
		return text
	}
	return searchReferenceURLPattern.ReplaceAllStringFunc(text, func(raw string) string {
		trailing := ""
		value := raw
		for len(value) > 0 && strings.ContainsRune(".,;:!?]}", rune(value[len(value)-1])) {
			trailing = value[len(value)-1:] + trailing
			value = value[:len(value)-1]
		}
		token, ok := protectSearchURL(value, linkMap)
		if !ok {
			return raw
		}
		return token + trailing
	})
}
