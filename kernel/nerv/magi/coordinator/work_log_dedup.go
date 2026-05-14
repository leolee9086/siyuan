package coordinator

import (
	"fmt"
	"strings"
	"sync"

	dl "github.com/leolee9086/string-metrics-damerau-levenshtein"
)

const maxWorkLogHistory = 6

type workLogEntry struct {
	sageName string
	summary  string
}

func newWorkLogHistory() *workLogHistoryStore {
	return &workLogHistoryStore{
		entries: map[string][]workLogEntry{},
	}
}

type workLogHistoryStore struct {
	mu      sync.RWMutex
	entries map[string][]workLogEntry
}

func (s *workLogHistoryStore) isNovel(sessionID, sageName, summary string) (bool, string) {
	if summary == "" {
		return false, "工作日志摘要为空"
	}

	key := sessionID + ":" + sageName

	s.mu.RLock()
	history := s.entries[key]
	s.mu.RUnlock()

	for _, entry := range history {
		if tooSimilar(entry.summary, summary) {
			return false, "禁止反复记录重复的内容敷衍，请输入与近期工作日志有实质差异的新内容。"
		}
	}

	return true, ""
}

func (s *workLogHistoryStore) append(sessionID, sageName, summary string) {
	if summary == "" {
		return
	}

	key := sessionID + ":" + sageName
	entry := workLogEntry{sageName: sageName, summary: summary}

	s.mu.Lock()
	defer s.mu.Unlock()

	s.entries[key] = append(s.entries[key], entry)
	if len(s.entries[key]) > maxWorkLogHistory {
		s.entries[key] = s.entries[key][len(s.entries[key])-maxWorkLogHistory:]
	}
}

func buildSessionSageKey(sessionID, sageName string) string {
	return fmt.Sprintf("%s:%s", strings.TrimSpace(sessionID), strings.TrimSpace(sageName))
}

func tooSimilar(a, b string) bool {
	dist := dl.ComputeDistance(a, b)
	aRunes := len([]rune(a))
	bRunes := len([]rune(b))
	maxLen := aRunes
	if bRunes > maxLen {
		maxLen = bRunes
	}
	if maxLen == 0 {
		return true
	}

	return float64(dist) < 3 || float64(dist)/float64(maxLen) < 0.15
}
