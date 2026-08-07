package assetmeta

import (
	"context"
	"errors"
	"image"
	"io/fs"
	"path"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/siyuan-note/logging"
	"github.com/siyuan-note/siyuan/kernel/fswalk"
	"github.com/siyuan-note/siyuan/kernel/util"
)

// AssetMetaService 负责协调 JSON 数据源和 SQL 索引
type AssetMetaService struct {
	manager *Manager
	files   *fswalk.Walker
	mutex   sync.Mutex

	// 缓存标签信息 (读多写少)
	tagsCache map[string]TagInfo
}

var (
	Instance *AssetMetaService
	once     sync.Once
)

const assetMetaStoreRoot = "storage/s-forge-asset-meta"

func NewInstance() *AssetMetaService {
	once.Do(func() {
		files, err := fswalk.New(util.DataDir)
		if err != nil {
			logging.LogErrorf("bind asset metadata filesystem root failed: %s", err)
		}
		Instance = &AssetMetaService{
			files:     files,
			manager:   NewManager(files, assetMetaStoreRoot),
			tagsCache: make(map[string]TagInfo),
		}
		// 初始化数据库（确保在任何 API 调用前完成）
		InitIndexDB()
	})
	return Instance
}

// Initialize 初始化服务
func (s *AssetMetaService) Initialize() error {
	s.mutex.Lock()
	defer s.mutex.Unlock()
	if s == nil || s.manager == nil {
		return fswalk.ErrRootUnavailable
	}
	if err := s.manager.available(); err != nil {
		return err
	}

	// 1. 初始化数据库
	InitIndexDB()

	// 2. 加载标签缓存
	if tags, err := s.manager.LoadTags(); err == nil {
		if normalized, normalizeErr := normalizeTagMap(tags); normalizeErr == nil {
			s.tagsCache = normalized
		} else {
			logging.LogWarnf("ignore invalid asset tag definitions: %s", normalizeErr)
			s.tagsCache = make(map[string]TagInfo)
		}
	} else {
		s.tagsCache = make(map[string]TagInfo)
	}

	// 4. 重建索引 (从文件系统加载所有 meta)
	go func() {
		logging.LogInfof("loading asset metas for indexing...")
		metas, err := s.manager.LoadAll()
		if err != nil {
			logging.LogErrorf("load all asset metas failed: %s", err)
			return
		}

		if err := RebuildIndex(metas); err != nil {
			logging.LogErrorf("rebuild asset meta index failed: %s", err)
		} else {
			logging.LogInfof("asset meta index rebuilt, count: %d", len(metas))
		}

		// 5. 扫描物理文件，补全缺失的索引
		s.ScanAssets()
	}()

	return nil
}

func normalizeTagMap(tags map[string]TagInfo) (map[string]TagInfo, error) {
	keys := make([]string, 0, len(tags))
	for key := range tags {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	items := make([]TagInfo, 0, len(tags))
	for _, key := range keys {
		tag := tags[key]
		if strings.TrimSpace(tag.Name) == "" {
			tag.Name = key
		}
		items = append(items, tag)
	}
	return normalizeTagDefinitions(items)
}

// Shutdown 关闭服务
func (s *AssetMetaService) Shutdown() {
	CloseIndexDB()
}

// GetAsset 获取素材元数据 (从 JSON 文件读取)
// 注意：API 应使用 GetAssetFromIndex，此方法仅供内部使用
func (s *AssetMetaService) GetAsset(path string) (AssetMeta, bool) {
	meta, err := s.manager.LoadAsset(path)
	if err != nil {
		return AssetMeta{}, false
	}
	return meta, true
}

// GetAssetAt 从工作空间主数据存储读取一个文件浏览根地址。
func (s *AssetMetaService) GetAssetAt(address AssetAddress) (AssetMeta, bool) {
	meta, err := s.LoadAssetAt(address)
	return meta, err == nil
}

// LoadAssetAt 保留主数据读取错误，供批量属性端口区分不存在与损坏记录。
func (s *AssetMetaService) LoadAssetAt(address AssetAddress) (AssetMeta, error) {
	if s == nil || s.manager == nil {
		return AssetMeta{}, fswalk.ErrRootUnavailable
	}
	return s.manager.LoadAssetAt(address)
}

// GetAssetFromIndex 从索引表获取素材元数据
// 这是前端 API 获取元数据的标准方式
func (s *AssetMetaService) GetAssetFromIndex(path string) (AssetMeta, bool) {
	return GetIndexAsset(path)
}

// GetAssetFromIndexAt 从可重建索引读取一个稳定根地址。
func (s *AssetMetaService) GetAssetFromIndexAt(address AssetAddress) (AssetMeta, bool) {
	return GetIndexAssetAt(address)
}

// SetAsset 设置/更新素材元数据
func (s *AssetMetaService) SetAsset(meta AssetMeta) error {
	// 如果是更新文件属性，由于没有内存缓存，我们直接保存文件即可
	// 但如果是更新标签，可能需要更新标签缓存 (如果未来支持更新 TagInfo)
	if err := s.manager.SaveAsset(meta); err != nil {
		return err
	}

	// 更新索引
	if err := UpdateIndexAsset(meta); err != nil {
		logging.LogErrorf("update index for [%s] failed: %s", meta.Path, err)
	}

	return nil
}

// SetAssetAt 把元数据保存到工作空间主数据，并同步更新根地址索引。
func (s *AssetMetaService) SetAssetAt(address AssetAddress, meta AssetMeta) error {
	if s == nil || s.manager == nil {
		return fswalk.ErrRootUnavailable
	}
	normalized, err := NewAssetAddress(address.RootID, address.Path)
	if err != nil {
		return err
	}
	meta.RootID = normalized.RootID
	meta.Path = normalized.Path
	if err = s.manager.SaveAssetAt(normalized, meta); err != nil {
		return err
	}
	if err = UpdateIndexAsset(meta); err != nil {
		logging.LogErrorf("update index for [%s:%s] failed: %s", normalized.RootID, normalized.Path, err)
	}
	return nil
}

// GetTags 获取所有标签配置 (tags.json)
func (s *AssetMetaService) GetTags() map[string]TagInfo {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	// 复制 map 防止并发读写问题
	result := make(map[string]TagInfo, len(s.tagsCache))
	for k, v := range s.tagsCache {
		result[k] = v
	}
	return result
}

// QueryAssets 查询素材
func (s *AssetMetaService) QueryAssets(keyword string, limit int) []AssetMeta {
	paths, err := SearchAssets(keyword, limit)
	if err != nil {
		logging.LogErrorf("search assets failed: %s", err)
		return nil
	}

	var results []AssetMeta
	for _, path := range paths {
		if meta, err := s.manager.LoadAsset(path); err == nil {
			results = append(results, meta)
		}
	}
	return results
}

// ScanAssets 扫描 assets 目录，发现未索引的文件
func (s *AssetMetaService) ScanAssets() {
	if err := s.scanAssets(context.Background()); err != nil && !errors.Is(err, fswalk.ErrStartUnavailable) {
		logging.LogErrorf("scan assets failed: %s", err)
	}
}

func (s *AssetMetaService) scanAssets(ctx context.Context) error {
	if s == nil || s.files == nil || s.manager == nil {
		return fswalk.ErrRootUnavailable
	}
	// 1. 获取所有已索引的路径 (内存 Map 查询，比文件系统快得多)
	indexedPaths, err := GetAllPaths()
	if err != nil {
		logging.LogErrorf("scan assets failed: load indexed paths error: %s", err)
		return err
	}

	// 2. 深模块负责目录枚举、链接边界和图片头读取；领域只声明未索引文件选择。
	probed, err := s.files.ProbeImages(ctx, "assets", fswalk.ImageProbeQuery{
		Walk: fswalk.WalkOptions{SortEntries: true},
		SelectFile: func(entry fswalk.Metadata) bool {
			_, indexed := indexedPaths[entry.Path]
			return !indexed
		},
	})
	if err != nil {
		return err
	}

	// 3. 领域阶段只恢复对象、组装新对象和更新索引事务。
	var newAssets []AssetMeta
	for _, record := range probed.Files {
		relPath := record.Probe.Path
		if meta, loadErr := s.manager.LoadAsset(relPath); loadErr == nil {
			if indexErr := UpdateIndexAsset(meta); indexErr != nil {
				logging.LogErrorf("repair asset index [%s] failed: %s", relPath, indexErr)
			}
			continue
		} else if !errors.Is(loadErr, fs.ErrNotExist) {
			if errors.Is(loadErr, ErrPathTraversal) {
				logging.LogWarnf("path traversal attempt in LoadAsset: %s", relPath)
			} else {
				logging.LogErrorf("load existing asset meta [%s] failed: %s", relPath, loadErr)
			}
			continue
		}
		now := time.Now().Unix()
		meta := AssetMeta{
			Path:       relPath,
			Name:       record.Probe.Name,
			Source:     "scan",
			ImportTime: now,
			FileSize:   record.Probe.Size,
		}
		if record.Err == nil {
			meta.Width = record.Probe.Width
			meta.Height = record.Probe.Height
		}
		newAssets = append(newAssets, meta)
	}

	// 4. 批量处理新文件
	if len(newAssets) == 0 {
		return nil
	}

	// 4.1 存储模块执行批量对象保存；只有成功项进入索引事务。
	validAssets, saveErrors := s.manager.saveAssets(ctx, newAssets)
	for _, saveErr := range saveErrors {
		logging.LogErrorf("scan save asset [%s] json failed: %s", saveErr.Path, saveErr.Err)
	}

	// 4.2 批量更新数据库索引 (DB IO - 单次事务)
	if err := BatchUpdateIndexAssets(validAssets); err != nil {
		logging.LogErrorf("scan batch update index failed: %s", err)
	}

	if len(validAssets) > 0 {
		logging.LogInfof("scanned and added %d new assets", len(validAssets))
	}
	return nil
}

// HandleFileChange 处理文件变更 (新增/修改)
func (s *AssetMetaService) HandleFileChange(absPath string) {
	if s == nil || s.files == nil || s.manager == nil {
		return
	}
	relPath, err := s.files.RelativePath(context.Background(), absPath)
	if err != nil {
		return
	}
	probe, probeErr := s.files.ProbeImage(context.Background(), relPath)
	if probe.Name == "" {
		return
	}

	// 尝试加载现有元数据
	meta, err := s.manager.LoadAsset(relPath)
	if err != nil {
		if !errors.Is(err, fs.ErrNotExist) {
			logging.LogErrorf("load changed asset meta [%s] failed: %s", relPath, err)
			return
		}
		meta = AssetMeta{
			Path:       relPath,
			Name:       probe.Name,
			Source:     "watch",
			ImportTime: time.Now().Unix(),
		}
	}

	dirty := err != nil
	if probeErr == nil {
		if meta.Width != probe.Width || meta.Height != probe.Height {
			meta.Width = probe.Width
			meta.Height = probe.Height
			dirty = true
		}
	}
	if meta.FileSize != probe.Size {
		meta.FileSize = probe.Size
		dirty = true
	}
	if dirty {
		if saveErr := s.SetAsset(meta); saveErr != nil {
			logging.LogErrorf("save changed asset [%s] failed: %s", relPath, saveErr)
		}
	}
}

// HandleFileRemove 处理文件删除
func (s *AssetMetaService) HandleFileRemove(absPath string) {
	if s == nil || s.files == nil || s.manager == nil {
		return
	}
	relPath, err := s.files.RelativePath(context.Background(), absPath)
	if err != nil {
		return
	}

	s.mutex.Lock()
	defer s.mutex.Unlock()

	// 删除元数据文件 (内部也会验证路径)
	if removeErr := s.manager.RemoveAsset(relPath); removeErr != nil {
		if errors.Is(removeErr, ErrPathTraversal) {
			logging.LogWarnf("path traversal attempt in RemoveAsset: %s", relPath)
		}
		return
	}

	// 删除索引
	RemoveIndexAsset(relPath)
}

// ExtractAndStorePalette 提取素材调色板并存储
// 复用缩略图服务进行降采样，提升性能
// relPath: 相对于 data/ 的路径 (如 "assets/xxx.png")
// colorCount: 目标颜色数量，默认 8
// ExtractAndStorePalette 提取并存储调色板
// relPath: 相对于 data/ 的路径 (如 "assets/xxx.png")
// colorCount: 目标颜色数量，默认 8
// overwrite: 是否覆盖现有调色板
func (s *AssetMetaService) ExtractAndStorePalette(relPath string, colorCount int, overwrite bool) ([]Palette, error) {
	if colorCount <= 0 {
		colorCount = 8
	}

	if s == nil || s.files == nil || s.manager == nil {
		return nil, fswalk.ErrRootUnavailable
	}
	probe, probeErr := s.files.ProbeImage(context.Background(), relPath)
	if probe.Name == "" {
		return nil, probeErr
	}

	// 1. 加载现有元数据
	meta, loadErr := s.manager.LoadAsset(relPath)
	if loadErr != nil {
		if !errors.Is(loadErr, fs.ErrNotExist) {
			return nil, loadErr
		}
		meta = AssetMeta{
			Path:       relPath,
			Name:       path.Base(relPath),
			Source:     "palette-extract",
			ImportTime: time.Now().Unix(),
		}
	}

	// 2. 检查并补全物理属性 (无论是新建的还是已有的)
	isDirty := loadErr != nil // 如果是新建的，必然脏
	if meta.Width == 0 || meta.Height == 0 {
		if probeErr == nil {
			meta.Width = probe.Width
			meta.Height = probe.Height
			isDirty = true
		} else {
			logging.LogErrorf("get image dimensions for [%s] failed: %s", relPath, probeErr)
		}
	}
	if meta.FileSize != probe.Size {
		meta.FileSize = probe.Size
		isDirty = true
	}

	// 3. 提取调色板 (如果需要)
	var palettes []Palette
	if overwrite || len(meta.Palettes) == 0 {
		var decodeErr error
		_, decodeErr = s.files.DecodeImage(context.Background(), relPath, func(_ fswalk.ImageProbe, decoded image.Image) error {
			palettes = ExtractPaletteFromDecodedImage(decoded, colorCount)
			return nil
		})
		if decodeErr != nil {
			return nil, decodeErr
		}
		meta.Palettes = palettes
		isDirty = true
	} else {
		palettes = meta.Palettes
	}

	// 4. 保存 (只有数据变更才保存)
	if isDirty {
		if saveErr := s.SetAsset(meta); saveErr != nil {
			logging.LogErrorf("save palette for [%s] failed: %s", relPath, saveErr)
			return palettes, saveErr
		}
	}

	return palettes, nil
}

// ExtractPaletteOnly 仅提取调色板，不存储
// 适用于只需要获取颜色而不需要持久化的场景
func (s *AssetMetaService) ExtractPaletteOnly(relPath string, colorCount int) ([]Palette, error) {
	if colorCount <= 0 {
		colorCount = 8
	}

	if s == nil || s.files == nil {
		return nil, fswalk.ErrRootUnavailable
	}
	var palettes []Palette
	_, err := s.files.DecodeImage(context.Background(), relPath, func(_ fswalk.ImageProbe, decoded image.Image) error {
		palettes = ExtractPaletteFromDecodedImage(decoded, colorCount)
		return nil
	})
	return palettes, err
}
