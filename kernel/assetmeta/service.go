package assetmeta

import (
	"encoding/xml"
	"errors"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/88250/gulu"
	"github.com/siyuan-note/logging"
	"github.com/siyuan-note/siyuan/kernel/util"
	_ "golang.org/x/image/bmp"
	_ "golang.org/x/image/tiff"
	_ "golang.org/x/image/webp"
)

// AssetMetaService 负责协调 JSON 数据源和 SQL 索引
type AssetMetaService struct {
	manager *Manager
	mutex   sync.Mutex

	// 缓存标签信息 (读多写少)
	tagsCache map[string]TagInfo
}

var (
	Instance *AssetMetaService
	once     sync.Once
)

func NewInstance() *AssetMetaService {
	once.Do(func() {
		// 数据存储目录: data/storage/s-forge-asset-meta/assets
		rootDir := filepath.Join(util.DataDir, "storage", "s-forge-asset-meta", "assets")
		Instance = &AssetMetaService{
			manager: NewManager(rootDir),
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

	// 1. 初始化数据库
	InitIndexDB()

	// 2. 加载标签缓存
	if tags, err := s.manager.LoadTags(); err == nil {
		s.tagsCache = tags
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

// GetAssetFromIndex 从索引表获取素材元数据
// 这是前端 API 获取元数据的标准方式
func (s *AssetMetaService) GetAssetFromIndex(path string) (AssetMeta, bool) {
	return GetIndexAsset(path)
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
	assetsDir := filepath.Join(util.DataDir, "assets")
	if !gulu.File.IsExist(assetsDir) {
		return
	}

	// 1. 获取所有已索引的路径 (内存 Map 查询，比文件系统快得多)
	indexedPaths, err := GetAllPaths()
	if err != nil {
		logging.LogErrorf("scan assets failed: load indexed paths error: %s", err)
		return
	}

	// 2. 遍历物理文件
	var newAssets []AssetMeta
	filepath.Walk(assetsDir, func(path string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() {
			return nil
		}

		relPath, err := filepath.Rel(util.DataDir, path)
		if err != nil {
			return nil
		}
		relPath = filepath.ToSlash(relPath)

		// 优化：仅检查索引中不存在的文件
		if _, ok := indexedPaths[relPath]; ok {
			return nil
		}

		// 双重检查：物理 meta 文件是否存在 (避免索引没数据但文件已有的情况，虽然 Initialize 会重建)
		// 如果我们信任 RebuildIndex，这一步可以省略。但为了健壮性，我们可以 check 一下。
		// 考虑到性能，如果 indexedPaths 是从 RebuildIndex 来的，那就是准的。
		// 如果是从 DB 查的，且 DB 是准的，那也是准的。
		// 只有在 "DB 丢失但 JSON 文件存在" 的情况下，这里会误判为 New Asset。
		// 如果误判为 New Asset，SetAsset 会覆盖旧 JSON。
		// 所以，为了安全，必须检查 metaPath 是否存在。
		metaPath, pathErr := s.manager.getMetaPath(relPath)
		if pathErr != nil {
			// 路径逃逸，跳过此文件
			return nil
		}
		if gulu.File.IsExist(metaPath) {
			// 文件存在但索引还在 Syncing? 或者 DB 坏了?
			// 这种情况下，应该 Load 并 UpdateIndex，而不是覆盖。
			if meta, err := s.manager.LoadAsset(relPath); err == nil {
				UpdateIndexAsset(meta) // 修复索引
			}
			return nil
		}

		// 确实是新文件
		now := time.Now().Unix()
		meta := AssetMeta{
			Path:       relPath,
			Name:       info.Name(),
			Source:     "scan",
			ImportTime: now,
		}

		// 获取图片尺寸 (只对新文件做 IO)
		if w, h, err := getImageDimensions(path); err == nil {
			meta.Width = w
			meta.Height = h
		}

		newAssets = append(newAssets, meta)
		return nil
	})

	// 3. 批量处理新文件
	if len(newAssets) == 0 {
		return
	}

	// 3.1 批量写入 JSON 文件 (Disk IO)
	// 只有写入成功的才更新索引，保证数据一致性
	var validAssets []AssetMeta
	for _, meta := range newAssets {
		if err := s.manager.SaveAsset(meta); err != nil {
			logging.LogErrorf("scan save asset [%s] json failed: %s", meta.Path, err)
			continue
		}
		validAssets = append(validAssets, meta)
	}

	// 3.2 批量更新数据库索引 (DB IO - 单次事务)
	if err := BatchUpdateIndexAssets(validAssets); err != nil {
		logging.LogErrorf("scan batch update index failed: %s", err)
	}

	if len(validAssets) > 0 {
		logging.LogInfof("scanned and added %d new assets", len(validAssets))
	}
}

// HandleFileChange 处理文件变更 (新增/修改)
func (s *AssetMetaService) HandleFileChange(absPath string) {
	relPath, err := filepath.Rel(util.DataDir, absPath)
	if err != nil {
		return
	}
	relPath = filepath.ToSlash(relPath)

	// 安全验证：确保相对路径不包含逃逸
	if strings.HasPrefix(relPath, "..") || strings.Contains(relPath, "/../") {
		logging.LogWarnf("path traversal attempt detected in HandleFileChange: %s", absPath)
		return
	}

	info, err := os.Stat(absPath)
	if err != nil {
		return
	}

	// 尝试加载现有元数据
	meta, err := s.manager.LoadAsset(relPath)
	if err != nil {
		// 不存在或路径验证失败，视为新增
		if errors.Is(err, ErrPathTraversal) {
			logging.LogWarnf("path traversal attempt in LoadAsset: %s", relPath)
			return
		}
		meta = AssetMeta{
			Path:       relPath,
			Name:       info.Name(),
			Source:     "watch",
			ImportTime: time.Now().Unix(),
		}
	}

	// 始终更新物理属性
	if w, h, err := getImageDimensions(absPath); err == nil {
		// 如果尺寸变了，或者之前没尺寸
		if meta.Width != w || meta.Height != h {
			meta.Width = w
			meta.Height = h
			s.SetAsset(meta)
		}
	} else if meta.Source == "watch" {
		// 新文件且获取尺寸失败，但也保存 (至少有记录)
		s.SetAsset(meta)
	}
}

// HandleFileRemove 处理文件删除
func (s *AssetMetaService) HandleFileRemove(absPath string) {
	relPath, err := filepath.Rel(util.DataDir, absPath)
	if err != nil {
		return
	}
	relPath = filepath.ToSlash(relPath)

	// 安全验证：确保相对路径不包含逃逸
	if strings.HasPrefix(relPath, "..") || strings.Contains(relPath, "/../") {
		logging.LogWarnf("path traversal attempt detected in HandleFileRemove: %s", absPath)
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

// getImageDimensions 获取图片尺寸
func getImageDimensions(path string) (int, int, error) {
	f, err := os.Open(path)
	if err != nil {
		return 0, 0, err
	}
	defer f.Close()

	if strings.HasSuffix(strings.ToLower(path), ".svg") {
		return getSvgDimensions(f)
	}

	cfg, _, err := image.DecodeConfig(f)
	if err == nil {
		return cfg.Width, cfg.Height, nil
	}
	return 0, 0, err
}

func getSvgDimensions(r io.Reader) (int, int, error) {
	type svg struct {
		Width   string `xml:"width,attr"`
		Height  string `xml:"height,attr"`
		ViewBox string `xml:"viewBox,attr"`
	}
	var s svg
	if err := xml.NewDecoder(r).Decode(&s); err != nil {
		return 0, 0, err
	}

	w := parseDim(s.Width)
	h := parseDim(s.Height)

	if w == 0 || h == 0 {
		if s.ViewBox != "" {
			parts := strings.Fields(s.ViewBox)
			if len(parts) == 4 {
				if w == 0 {
					w = parseDim(parts[2])
				}
				if h == 0 {
					h = parseDim(parts[3])
				}
			}
		}
	}
	return w, h, nil
}

func parseDim(s string) int {
	s = strings.TrimSuffix(s, "px")
	d, _ := strconv.ParseFloat(s, 64)
	return int(d)
}

// ExtractAndStorePalette 提取素材调色板并存储
// 复用缩略图服务进行降采样，提升性能
// relPath: 相对于 data/ 的路径 (如 "assets/xxx.png")
// colorCount: 目标颜色数量，默认 8
func (s *AssetMetaService) ExtractAndStorePalette(relPath string, colorCount int) ([]Palette, error) {
	if colorCount <= 0 {
		colorCount = 8
	}

	// 构建绝对路径
	absPath := filepath.Join(util.DataDir, relPath)
	if !gulu.File.IsExist(absPath) {
		return nil, os.ErrNotExist
	}

	// 直接使用 MMCQ 提取（内部会自动降采样到 64px）
	palettes, err := ExtractPaletteFromImage(absPath, colorCount)
	if err != nil {
		return nil, err
	}

	// 更新元数据
	meta, loadErr := s.manager.LoadAsset(relPath)
	if loadErr != nil {
		// 如果不存在，创建新的
		if !errors.Is(loadErr, os.ErrNotExist) && !errors.Is(loadErr, ErrPathTraversal) {
			return palettes, loadErr
		}
		meta = AssetMeta{
			Path:       relPath,
			Name:       filepath.Base(relPath),
			Source:     "palette-extract",
			ImportTime: time.Now().Unix(),
		}
		// 补全物理属性
		if w, h, err := getImageDimensions(absPath); err == nil {
			meta.Width = w
			meta.Height = h
		}
		if info, statErr := os.Stat(absPath); statErr == nil {
			meta.FileSize = info.Size()
		}
	}

	meta.Palettes = palettes

	// 保存
	if saveErr := s.SetAsset(meta); saveErr != nil {
		logging.LogErrorf("save palette for [%s] failed: %s", relPath, saveErr)
		return palettes, saveErr
	}

	return palettes, nil
}

// ExtractPaletteOnly 仅提取调色板，不存储
// 适用于只需要获取颜色而不需要持久化的场景
func (s *AssetMetaService) ExtractPaletteOnly(relPath string, colorCount int) ([]Palette, error) {
	if colorCount <= 0 {
		colorCount = 8
	}

	absPath := filepath.Join(util.DataDir, relPath)
	return ExtractPaletteFromImage(absPath, colorCount)
}
