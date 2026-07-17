package coordinator

import (
	"encoding/json"
	"strings"

	"github.com/siyuan-note/siyuan/kernel/nerv/magi/sages"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
	shared "github.com/siyuan-note/siyuan/packages/websearch"
)

const webSearchLinksMetaKey = "webSearchLinks"

// searchLinkMapFromResult extracts only links issued by the shared search
// service. The map is display metadata; it is never placed in an LLM prompt.
func searchLinkMapFromResult(raw string) map[string]string {
	var payload struct {
		LinkMap map[string]string `json:"linkMap"`
	}
	if err := json.Unmarshal([]byte(strings.TrimSpace(raw)), &payload); err != nil {
		return nil
	}
	links := make(map[string]string, len(payload.LinkMap))
	for token, target := range payload.LinkMap {
		if !strings.HasPrefix(token, "ref:web-") || !shared.IsSearchResultURL(target) {
			continue
		}
		links[token] = target
	}
	if len(links) == 0 {
		return nil
	}
	return links
}

func webSearchMetaFromResult(raw string) map[string]interface{} {
	links := searchLinkMapFromResult(raw)
	if len(links) == 0 {
		return nil
	}
	return map[string]interface{}{webSearchLinksMetaKey: links}
}

func webSearchMetaFromSage(sage *sages.Sage, sessionID string) map[string]interface{} {
	if sage == nil {
		return nil
	}
	links := make(map[string]string)
	for _, message := range sage.GetContextForSession(sessionID) {
		if message.Meta != nil {
			mergeWebSearchLinks(links, message.Meta[webSearchLinksMetaKey])
		}
	}
	if len(links) == 0 {
		return nil
	}
	return map[string]interface{}{webSearchLinksMetaKey: links}
}

func collectWebSearchMetaFromSages(sessionID string, sages ...*sages.Sage) map[string]interface{} {
	links := make(map[string]string)
	for _, sage := range sages {
		if meta := webSearchMetaFromSage(sage, sessionID); meta != nil {
			mergeWebSearchLinks(links, meta[webSearchLinksMetaKey])
		}
	}
	if len(links) == 0 {
		return nil
	}
	return map[string]interface{}{webSearchLinksMetaKey: links}
}

func mergeWebSearchLinks(dst map[string]string, value interface{}) {
	switch links := value.(type) {
	case map[string]string:
		for token, target := range links {
			if strings.HasPrefix(token, "ref:web-") && shared.IsSearchResultURL(target) {
				dst[token] = target
			}
		}
	case map[string]interface{}:
		for token, rawTarget := range links {
			target, ok := rawTarget.(string)
			if ok && strings.HasPrefix(token, "ref:web-") && shared.IsSearchResultURL(target) {
				dst[token] = target
			}
		}
	}
}

func attachWebSearchMeta(message *types.Message, meta map[string]interface{}) {
	if message == nil || len(meta) == 0 {
		return
	}
	if message.Meta == nil {
		message.Meta = make(map[string]interface{})
	}
	message.Meta[webSearchLinksMetaKey] = meta[webSearchLinksMetaKey]
}
