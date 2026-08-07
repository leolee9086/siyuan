package assetmeta

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"io/fs"
	"path"
	"path/filepath"
	"runtime"
	"strings"
	"sync"

	"github.com/siyuan-note/logging"
	"github.com/siyuan-note/siyuan/kernel/fswalk"
)

// AssetMeta 对应单个素材的元数据
type AssetMeta struct {
	RootID       string    `json:"rootID,omitempty"`   // 文件浏览根；空值表示旧版 data 根
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

// LegacyDataRootID 是现有 assets API 使用的 data 目录身份。
const LegacyDataRootID = "data"

// AssetAddress 以授权根和根内相对路径标识一个文件或目录。
type AssetAddress struct {
	RootID string `json:"rootID"`
	Path   string `json:"path"`
}

// NewAssetAddress 验证并规范化一个不含操作系统绝对路径的元数据地址。
func NewAssetAddress(rootID, relative string) (AssetAddress, error) {
	rootID = strings.TrimSpace(rootID)
	if rootID == "" {
		rootID = LegacyDataRootID
	}
	relative = strings.TrimSpace(strings.ReplaceAll(relative, "\\", "/"))
	if relative == "" {
		if rootID == LegacyDataRootID {
			return AssetAddress{}, fs.ErrInvalid
		}
		return AssetAddress{RootID: rootID}, nil
	}
	if strings.HasPrefix(relative, "/") || filepath.IsAbs(filepath.FromSlash(relative)) {
		return AssetAddress{}, fs.ErrInvalid
	}
	clean := path.Clean(relative)
	if clean == "." || clean == ".." || strings.HasPrefix(clean, "../") {
		return AssetAddress{}, ErrPathTraversal
	}
	return AssetAddress{RootID: rootID, Path: clean}, nil
}

func assetAddressFromMeta(meta AssetMeta) (AssetAddress, error) {
	return NewAssetAddress(meta.RootID, meta.Path)
}

// storageKey 把外部根身份压缩为固定长度键，避免绝对路径、深目录或根 ID 进入存储路径。
func (a AssetAddress) storageKey() string {
	if a.RootID == LegacyDataRootID && a.Path != "" {
		return a.Path
	}
	encoded := a.identityKey()
	return path.Join("roots", encoded[:2], encoded)
}

func (a AssetAddress) identityKey() string {
	rootID, relative := a.RootID, a.Path
	if runtime.GOOS == "windows" || runtime.GOOS == "darwin" {
		rootID = strings.ToLower(rootID)
		relative = strings.ToLower(relative)
	}
	sum := sha256.Sum256([]byte(rootID + "\x00" + relative))
	return fmtHex(sum[:])
}

func fmtHex(value []byte) string {
	const alphabet = "0123456789abcdef"
	encoded := make([]byte, len(value)*2)
	for index, item := range value {
		encoded[index*2] = alphabet[item>>4]
		encoded[index*2+1] = alphabet[item&0x0f]
	}
	return string(encoded)
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
	mutex   sync.RWMutex
	assets  *fswalk.JSONStore
	tags    *fswalk.JSONStore
	initErr error
}

const assetMetaJSONLimit = int64(4 * 1024 * 1024)

// NewManager 把素材元数据和标签绑定到同一个授权根的两个逻辑命名空间。
// rootRelative 是相对授权根的存储目录，不是可直接访问的操作系统路径。
func NewManager(walker *fswalk.Walker, rootRelative string) *Manager {
	manager := &Manager{}
	if walker == nil {
		manager.initErr = fswalk.ErrRootUnavailable
		return manager
	}
	assets, err := walker.BindJSONStore(path.Join(rootRelative, "assets"), assetMetaJSONLimit)
	if err != nil {
		manager.initErr = err
		return manager
	}
	tags, err := walker.BindJSONStore(rootRelative, assetMetaJSONLimit)
	if err != nil {
		manager.initErr = err
		return manager
	}
	manager.assets = assets
	manager.tags = tags
	return manager
}

// ErrPathTraversal 保留领域层原有错误标识，但实际边界检查由 fswalk 完成。
var ErrPathTraversal = fswalk.ErrPathTraversal

func (m *Manager) available() error {
	if m == nil {
		return fswalk.ErrRootUnavailable
	}
	return m.initErr
}

func (m *Manager) loadAsset(ctx context.Context, relPath string) (AssetMeta, error) {
	address, err := NewAssetAddress(LegacyDataRootID, relPath)
	if err != nil {
		return AssetMeta{}, err
	}
	return m.loadAssetAt(ctx, address)
}

func (m *Manager) loadAssetAt(ctx context.Context, address AssetAddress) (AssetMeta, error) {
	if err := m.available(); err != nil {
		return AssetMeta{}, err
	}
	normalized, err := NewAssetAddress(address.RootID, address.Path)
	if err != nil {
		return AssetMeta{}, err
	}
	var meta AssetMeta
	if err := m.assets.Load(ctx, normalized.storageKey(), &meta); err != nil {
		return AssetMeta{}, err
	}
	if meta.Path == "" {
		meta.Path = normalized.Path
	}
	if meta.RootID == "" && normalized.RootID != LegacyDataRootID {
		meta.RootID = normalized.RootID
	}
	return meta, nil
}

// LoadAsset 加载单个素材元数据
func (m *Manager) LoadAsset(relPath string) (AssetMeta, error) {
	m.mutex.RLock()
	defer m.mutex.RUnlock()
	return m.loadAsset(context.Background(), relPath)
}

// LoadAssetAt 加载一个稳定根地址的元数据；外部根身份不会被解释为文件路径。
func (m *Manager) LoadAssetAt(address AssetAddress) (AssetMeta, error) {
	m.mutex.RLock()
	defer m.mutex.RUnlock()
	return m.loadAssetAt(context.Background(), address)
}

func (m *Manager) saveAsset(ctx context.Context, meta AssetMeta) error {
	if err := m.available(); err != nil {
		return err
	}
	address, err := assetAddressFromMeta(meta)
	if err != nil {
		return err
	}
	meta.Path = address.Path
	if meta.RootID != "" {
		meta.RootID = address.RootID
	}
	return m.assets.Save(ctx, address.storageKey(), meta)
}

// SaveAsset 保存单个素材元数据；目录创建和原子替换由绑定根存储完成。
func (m *Manager) SaveAsset(meta AssetMeta) error {
	m.mutex.Lock()
	defer m.mutex.Unlock()
	return m.saveAsset(context.Background(), meta)
}

// SaveAssetAt 保存根地址元数据；数据始终写入 Manager 绑定的工作空间存储。
func (m *Manager) SaveAssetAt(address AssetAddress, meta AssetMeta) error {
	m.mutex.Lock()
	defer m.mutex.Unlock()
	normalized, err := NewAssetAddress(address.RootID, address.Path)
	if err != nil {
		return err
	}
	meta.RootID = normalized.RootID
	meta.Path = normalized.Path
	return m.saveAsset(context.Background(), meta)
}

type assetSaveError struct {
	Path string
	Err  error
}

func (m *Manager) saveAssets(ctx context.Context, metas []AssetMeta) ([]AssetMeta, []assetSaveError) {
	m.mutex.Lock()
	defer m.mutex.Unlock()
	valid := make([]AssetMeta, 0, len(metas))
	failures := []assetSaveError{}
	for _, meta := range metas {
		if err := ctx.Err(); err != nil {
			failures = append(failures, assetSaveError{Path: meta.Path, Err: err})
			break
		}
		if err := m.saveAsset(ctx, meta); err != nil {
			failures = append(failures, assetSaveError{Path: meta.Path, Err: err})
			continue
		}
		valid = append(valid, meta)
	}
	return valid, failures
}

// RemoveAsset 删除单个素材元数据
func (m *Manager) RemoveAsset(relPath string) error {
	address, err := NewAssetAddress(LegacyDataRootID, relPath)
	if err != nil {
		return err
	}
	return m.RemoveAssetAt(address)
}

// RemoveAssetAt 删除一个根地址的元数据，不触碰被描述的真实文件。
func (m *Manager) RemoveAssetAt(address AssetAddress) error {
	m.mutex.Lock()
	defer m.mutex.Unlock()
	if err := m.available(); err != nil {
		return err
	}
	normalized, err := NewAssetAddress(address.RootID, address.Path)
	if err != nil {
		return err
	}
	_, err = m.assets.Remove(context.Background(), normalized.storageKey())
	return err
}

// LoadAll 加载所有元数据 (用于重建索引)
func (m *Manager) LoadAll() ([]AssetMeta, error) {
	m.mutex.RLock()
	defer m.mutex.RUnlock()
	if err := m.available(); err != nil {
		return nil, err
	}
	metas := []AssetMeta{}
	documents, err := m.assets.Visit(context.Background(), "", fswalk.JSONStoreQuery{}, func(document fswalk.JSONStoreDocument) error {
		var meta AssetMeta
		if decodeErr := json.Unmarshal(document.Bytes, &meta); decodeErr != nil {
			logging.LogErrorf("unmarshal asset meta file [%s] failed: %s", document.Key, decodeErr)
			return nil
		}
		if meta.Path == "" {
			if strings.HasPrefix(document.Key, "roots/") {
				if meta.RootID == "" {
					logging.LogErrorf("asset meta file [%s] is missing its stable root identity", document.Key)
					return nil
				}
			} else {
				meta.Path = document.Key
			}
		}
		if _, addressErr := assetAddressFromMeta(meta); addressErr != nil {
			logging.LogErrorf("asset meta file [%s] has an invalid address: %s", document.Key, addressErr)
			return nil
		}
		metas = append(metas, meta)
		return nil
	})
	if err != nil {
		return metas, err
	}
	for _, pathErr := range documents.FileErrors {
		logging.LogErrorf("read asset meta file [%s] failed: %s", pathErr.Path, pathErr.Err)
	}
	return metas, nil
}

// LoadTags 加载所有标签元数据
func (m *Manager) LoadTags() (map[string]TagInfo, error) {
	m.mutex.RLock()
	defer m.mutex.RUnlock()
	if err := m.available(); err != nil {
		return nil, err
	}
	var tags map[string]TagInfo
	if err := m.tags.Load(context.Background(), "tags", &tags); err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return make(map[string]TagInfo), nil
		}
		return nil, err
	}
	if tags == nil {
		tags = make(map[string]TagInfo)
	}
	return tags, nil
}

// SaveTags 保存所有标签元数据；原子写入由绑定根存储完成。
func (m *Manager) SaveTags(tags map[string]TagInfo) error {
	m.mutex.Lock()
	defer m.mutex.Unlock()
	if err := m.available(); err != nil {
		return err
	}
	return m.tags.Save(context.Background(), "tags", tags)
}
