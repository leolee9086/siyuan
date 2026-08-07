package assetmeta

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"regexp"
	"sort"
	"strings"
	"unicode"
)

// TagDefinitionsSnapshot 是标签定义的可比较快照。
// revision 由规范化后的内容计算，调用方可以用它进行乐观并发控制。
type TagDefinitionsSnapshot struct {
	Revision string    `json:"revision"`
	Items    []TagInfo `json:"items"`
}

// TagDefinitionsUpdate 用完整快照替换标签定义，避免暴露持久层的增删细节。
type TagDefinitionsUpdate struct {
	ExpectedRevision string    `json:"expectedRevision,omitempty"`
	Items            []TagInfo `json:"items"`
}

var (
	// ErrTagDefinitionsConflict 表示客户端基于过期快照提交了定义。
	ErrTagDefinitionsConflict = errors.New("tag definitions revision conflict")
	// ErrTagDefinitionInvalid 表示标签名或颜色不符合持久化契约。
	ErrTagDefinitionInvalid = errors.New("invalid tag definition")
)

const (
	maxTagDefinitions = 4096
	maxTagNameLength  = 128
)

var tagColorPattern = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)

// GetTagDefinitions 返回当前标签定义的稳定快照。
func (s *AssetMetaService) GetTagDefinitions() TagDefinitionsSnapshot {
	if s == nil {
		return TagDefinitionsSnapshot{Items: []TagInfo{}}
	}
	s.mutex.Lock()
	defer s.mutex.Unlock()
	return snapshotFromTagMap(s.tagsCache)
}

// UpdateTagDefinitions 以期望 revision 为前置条件原子替换完整定义集合。
func (s *AssetMetaService) UpdateTagDefinitions(update TagDefinitionsUpdate) (TagDefinitionsSnapshot, error) {
	if s == nil || s.manager == nil {
		return TagDefinitionsSnapshot{}, ErrTagDefinitionsUnavailable
	}
	normalized, err := normalizeTagDefinitions(update.Items)
	if err != nil {
		return TagDefinitionsSnapshot{}, err
	}

	s.mutex.Lock()
	defer s.mutex.Unlock()
	current := snapshotFromTagMap(s.tagsCache)
	if expected := strings.TrimSpace(update.ExpectedRevision); expected != "" && expected != current.Revision {
		return current, ErrTagDefinitionsConflict
	}
	if err = s.manager.SaveTags(normalized); err != nil {
		return TagDefinitionsSnapshot{}, err
	}
	s.tagsCache = normalized
	return snapshotFromTagMap(s.tagsCache), nil
}

// ErrTagDefinitionsUnavailable 表示标签定义绑定的工作空间存储不可用。
var ErrTagDefinitionsUnavailable = errors.New("tag definitions store unavailable")

func snapshotFromTagMap(values map[string]TagInfo) TagDefinitionsSnapshot {
	items := make([]TagInfo, 0, len(values))
	for _, value := range values {
		items = append(items, TagInfo{Name: strings.TrimSpace(value.Name), Color: normalizeTagColor(value.Color)})
	}
	sort.SliceStable(items, func(left, right int) bool {
		return strings.ToLower(items[left].Name) < strings.ToLower(items[right].Name)
	})
	return TagDefinitionsSnapshot{Revision: tagDefinitionsRevision(items), Items: items}
}

func tagDefinitionsRevision(items []TagInfo) string {
	// Items 已经排序；显式拼接长度和字段，避免分隔符出现在名称时产生碰撞。
	var builder strings.Builder
	for _, item := range items {
		fmt.Fprintf(&builder, "%d:%s%d:%s;", len([]rune(item.Name)), item.Name, len(item.Color), item.Color)
	}
	sum := sha256.Sum256([]byte(builder.String()))
	return hex.EncodeToString(sum[:])
}

func normalizeTagDefinitions(items []TagInfo) (map[string]TagInfo, error) {
	if len(items) > maxTagDefinitions {
		return nil, fmt.Errorf("%w: too many definitions", ErrTagDefinitionInvalid)
	}
	result := make(map[string]TagInfo, len(items))
	for _, item := range items {
		name := strings.TrimSpace(item.Name)
		if name == "" {
			return nil, fmt.Errorf("%w: name is empty", ErrTagDefinitionInvalid)
		}
		if len([]rune(name)) > maxTagNameLength || strings.IndexFunc(name, unicode.IsControl) >= 0 {
			return nil, fmt.Errorf("%w: invalid name %q", ErrTagDefinitionInvalid, name)
		}
		key := strings.ToLower(name)
		if _, exists := result[key]; exists {
			return nil, fmt.Errorf("%w: duplicate name %q", ErrTagDefinitionInvalid, name)
		}
		color, valid := validateTagColor(item.Color)
		if !valid {
			return nil, fmt.Errorf("%w: invalid color for %q", ErrTagDefinitionInvalid, name)
		}
		result[key] = TagInfo{Name: name, Color: color}
	}
	return result, nil
}

func normalizeTagColor(value string) string {
	color, valid := validateTagColor(value)
	if !valid {
		return ""
	}
	return color
}

func validateTagColor(value string) (string, bool) {
	value = strings.TrimSpace(value)
	if value == "" {
		return "", true
	}
	if !tagColorPattern.MatchString(value) {
		return "", false
	}
	return strings.ToUpper(value), true
}
