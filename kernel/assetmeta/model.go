package assetmeta

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"github.com/88250/gulu"
	"github.com/siyuan-note/logging"
)

// AssetMeta 对应单个素材的元数据
type AssetMeta struct {
	Path         string    `json:"path"`               // 相对路径 (assets/xxx.png)
	Name         string    `json:"name"`               // 显示名称
	Tags         []string  `json:"tags"`               // 标签
	Star         int       `json:"star"`               // 星级 0-5
	Annotation   string    `json:"annotation"`         // 注释
	BoundBlockID string    `json:"boundBlockId"`       // 绑定的思源块 ID (如果设置，Annotation 视为缓存)
	Source       string    `json:"source"`             // 来源 (eagle, local, etc)
	SourceID     string    `json:"sourceId"`           // 来源 ID (Eagle ID)
	ImportTime   int64     `json:"importTime"`         // 导入时间
	Width        int       `json:"width,omitempty"`    // 宽度
	Height       int       `json:"height,omitempty"`   // 高度
	FileSize     int64     `json:"fileSize,omitempty"` // 文件大小 (字节)
	Palettes     []Palette `json:"palettes,omitempty"` // 调色板
}

type Palette struct {
	Color [3]int  `json:"color"` // RGB
	Ratio float64 `json:"ratio"` // 0-1
	// HSL 用于快速筛选
	H int `json:"h"`
	S int `json:"s"`
	L int `json:"l"`
}

type TagInfo struct {
	Name  string `json:"name"`
	Color string `json:"color"`
}

type Manager struct {
	mutex    sync.RWMutex
	rootPath string // storage/s-forge-asset-meta/assets
}

func NewManager(rootPath string) *Manager {
	return &Manager{
		rootPath: rootPath,
	}
}

// ErrPathTraversal 路径逃逸错误
var ErrPathTraversal = errors.New("path traversal detected: path escapes allowed directory")

// getMetaPath 获取元数据文件路径
// 返回错误如果检测到路径逃逸攻击
func (m *Manager) getMetaPath(relPath string) (string, error) {
	// relPath e.g. "assets/2023/image.png"
	// metaPath e.g. rootPath + "/2023/image.png.json"
	// 简单起见，我们在 storage/assets 下镜像 assets 目录结构。
	metaPath := filepath.Join(m.rootPath, relPath+".json")

	// 安全验证：确保最终路径在 rootPath 内
	if !isPathInsideDir(metaPath, m.rootPath) {
		return "", ErrPathTraversal
	}

	return metaPath, nil
}

// isPathInsideDir 检查 targetPath 是否在 baseDir 目录内
// 使用 filepath.Rel 判断，如果相对路径以 ".." 开头则表示逃逸
func isPathInsideDir(targetPath, baseDir string) bool {
	// 规范化路径
	absTarget, err := filepath.Abs(targetPath)
	if err != nil {
		return false
	}
	absBase, err := filepath.Abs(baseDir)
	if err != nil {
		return false
	}

	// 计算相对路径
	rel, err := filepath.Rel(absBase, absTarget)
	if err != nil {
		return false
	}

	// 如果相对路径以 ".." 开头，说明目标不在基础目录内
	return !strings.HasPrefix(rel, "..") && !strings.HasPrefix(rel, string(filepath.Separator)+"..")
}

// LoadAsset 加载单个素材元数据
func (m *Manager) LoadAsset(relPath string) (AssetMeta, error) {
	path, err := m.getMetaPath(relPath)
	if err != nil {
		return AssetMeta{}, err
	}
	if !gulu.File.IsExist(path) {
		return AssetMeta{}, os.ErrNotExist
	}

	data, err := os.ReadFile(path)
	if err != nil {
		return AssetMeta{}, err
	}

	var meta AssetMeta
	if err := json.Unmarshal(data, &meta); err != nil {
		return AssetMeta{}, err
	}
	// 补全路径字段（万一 JSON 里没存）
	if meta.Path == "" {
		meta.Path = relPath
	}
	return meta, nil
}

// SaveAsset 保存单个素材元数据 (Atomic)
func (m *Manager) SaveAsset(meta AssetMeta) error {
	if meta.Path == "" {
		return os.ErrInvalid
	}

	path, err := m.getMetaPath(meta.Path)
	if err != nil {
		return err
	}
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	data, err := json.MarshalIndent(meta, "", "  ")
	if err != nil {
		return err
	}

	return writeFileAtomic(path, data)
}

// RemoveAsset 删除单个素材元数据
func (m *Manager) RemoveAsset(relPath string) error {
	path, err := m.getMetaPath(relPath)
	if err != nil {
		return err
	}
	if !gulu.File.IsExist(path) {
		return nil
	}
	return os.Remove(path)
}

// LoadAll 加载所有元数据 (用于重建索引)
func (m *Manager) LoadAll() ([]AssetMeta, error) {
	m.mutex.RLock()
	defer m.mutex.RUnlock()

	var metas []AssetMeta
	if !gulu.File.IsExist(m.rootPath) {
		return metas, nil
	}

	err := filepath.Walk(m.rootPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() {
			return nil
		}
		if filepath.Ext(path) != ".json" {
			return nil
		}

		data, err := os.ReadFile(path)
		if err != nil {
			logging.LogErrorf("read asset meta file [%s] failed: %s", path, err)
			return nil // 继续下一个
		}

		var meta AssetMeta
		if err := json.Unmarshal(data, &meta); err != nil {
			logging.LogErrorf("unmarshal asset meta file [%s] failed: %s", path, err)
			return nil
		}
		metas = append(metas, meta)
		return nil
	})

	return metas, err
}

// getTagsPath 获取标签元数据文件路径
func (m *Manager) getTagsPath() string {
	// storage/s-forge-asset-meta/tags.json
	return filepath.Join(filepath.Dir(m.rootPath), "tags.json")
}

// LoadTags 加载所有标签元数据
func (m *Manager) LoadTags() (map[string]TagInfo, error) {
	path := m.getTagsPath()
	if !gulu.File.IsExist(path) {
		return make(map[string]TagInfo), nil
	}

	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var tags map[string]TagInfo
	if err := json.Unmarshal(data, &tags); err != nil {
		return nil, err
	}
	return tags, nil
}

// SaveTags 保存所有标签元数据 (Atomic)
func (m *Manager) SaveTags(tags map[string]TagInfo) error {
	path := m.getTagsPath()
	data, err := json.MarshalIndent(tags, "", "  ")
	if err != nil {
		return err
	}
	return writeFileAtomic(path, data)
}

// writeFileAtomic 原子写入文件
func writeFileAtomic(path string, data []byte) error {
	dir := filepath.Dir(path)

	// 创建临时文件
	tmpFile, err := os.CreateTemp(dir, filepath.Base(path)+".*.tmp")
	if err != nil {
		return err
	}
	tmpPath := tmpFile.Name()

	// 确保清理临时文件 (如果成功 rename 这里 remove 会失败但无害)
	defer os.Remove(tmpPath)

	// 写入数据
	if _, err := tmpFile.Write(data); err != nil {
		tmpFile.Close()
		return err
	}

	// 强制刷盘
	if err := tmpFile.Sync(); err != nil {
		tmpFile.Close()
		return err
	}

	if err := tmpFile.Close(); err != nil {
		return err
	}

	// 原子替换
	return os.Rename(tmpPath, path)
}
