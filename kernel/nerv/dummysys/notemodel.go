package dummysys

import (
	"fmt"
	"strings"
	"sync"
	"time"
)

// 笔记读取函数，由上层（server/coordinator）通过 InitNoteProvider 注入
var (
	getBlockMd   = func(id, mode string) string { return "" }
	resolveBox   = func() (string, error) { return "", fmt.Errorf("not initialized") }
	searchModel  = func(boxID, modelID string) (string, error) {
		return "", fmt.Errorf("not initialized")
	}
)

// InitNoteProvider 初始化笔记提供者引用 kernel/model 函数。
func InitNoteProvider(
	fnGetBlockMd func(id, mode string) string,
	fnResolveBox func() (string, error),
	fnSearchModel func(boxID, modelID string) (string, error),
) {
	getBlockMd = fnGetBlockMd
	resolveBox = fnResolveBox
	searchModel = fnSearchModel
}

type noteCacheEntry struct {
	content   string
	updatedAt time.Time
	hash      string
	name      string
}

var (
	noteCacheMu sync.RWMutex
	noteCache   = map[string]*noteCacheEntry{}
)

// ResolveModelNoteID 根据型号 ID 在 AI 主笔记本中查找对应的笔记块 ID。
func ResolveModelNoteID(modelID AvatarModelID) (string, error) {
	boxID, err := resolveBox()
	if err != nil {
		return "", fmt.Errorf("resolve ai main notebook: %w", err)
	}
	return searchModel(boxID, string(modelID))
}

// LoadModelFromNote 从笔记中读取型号定义。
// forceRefresh=true 时忽略缓存强制重新读取。
func LoadModelFromNote(modelID AvatarModelID, forceRefresh bool) (*AvatarModel, error) {
	noteID, err := ResolveModelNoteID(modelID)
	if err != nil {
		return nil, err
	}

	noteCacheMu.RLock()
	cached, has := noteCache[noteID]
	noteCacheMu.RUnlock()

	if has && !forceRefresh {
		return &AvatarModel{
			ID:          modelID,
			Name:        cached.name,
			Description: cached.content,
		}, nil
	}

	content := getBlockMd(noteID, "md")
	if strings.TrimSpace(content) == "" {
		return nil, fmt.Errorf("avatar model note %q is empty", noteID)
	}

	name := extractNameFromNote(content, string(modelID))

	noteCacheMu.Lock()
	noteCache[noteID] = &noteCacheEntry{
		content:   content,
		updatedAt: time.Now(),
		hash:      quickHash(content),
		name:      name,
	}
	noteCacheMu.Unlock()

	return &AvatarModel{
		ID:          modelID,
		Name:        name,
		Description: content,
	}, nil
}

// CheckNoteChanged 通过哈希对比检查笔记是否已变更。
func CheckNoteChanged(noteID string) bool {
	current := getBlockMd(noteID, "md")
	noteCacheMu.RLock()
	cached, ok := noteCache[noteID]
	noteCacheMu.RUnlock()
	if !ok {
		return true
	}
	return quickHash(current) != cached.hash
}

func extractNameFromNote(md string, fallback string) string {
	for _, line := range strings.SplitN(md, "\n", 3) {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "# ") {
			return strings.TrimSpace(trimmed[2:])
		}
	}
	return fallback
}

func quickHash(s string) string {
	h := 0
	for _, c := range s {
		h = h*31 + int(c)
	}
	return fmt.Sprintf("%x", h)
}
