package vectordb

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"

	"s-forge.local/vectordb/vamana"
)

type Engine string

const (
	EngineHNSW       Engine = "hnsw"
	EngineDiskVamana Engine = "disk-vamana"
)

var (
	ErrCollectionNotFound     = errors.New("collection not found")
	ErrUnsupportedEngine      = errors.New("unsupported vector engine")
	ErrDiskVamanaNeedsPoints  = errors.New("disk-vamana collection requires initial points")
	ErrVectorDimensionInvalid = errors.New("vector dimension invalid")
)

type CollectionOptions struct {
	Engine          Engine
	Dimension       int
	Meta            CollectionMeta
	Points          []Point
	DistanceMetric  string // 距离度量："l2"、"cosine"、"ip"；空字符串表示使用引擎默认
	DiskBuildConfig *vamana.DiskBuildConfig
}

// DB 是独立向量数据库包对宿主暴露的稳定入口。
type DB interface {
	CreateCollectionWithOptions(name string, opts CollectionOptions) (*CollectionHandle, error)
	OpenCollection(name string) (*CollectionHandle, error)
	DeleteCollection(name string) error
	ListCollectionStats() []CollectionStats
	Close() error
}

// CollectionAPI 是 HNSW 与 DiskVamana 共享的集合操作面。
type CollectionAPI interface {
	Name() string
	Engine() Engine
	Upsert(points []Point) error
	Search(query []float32, opts SearchOptions) ([]SearchResult, error)
	Delete(ids []string) error
	Flush() error
	Stats() CollectionStats
	Close() error
}

type SearchOptions struct {
	TopK           int
	EfSearch       int
	ScoreThreshold float32 // >=0 时仅返回 score >= threshold 的结果；0 或负数表示不启用阈值截断
}

type CollectionStats struct {
	Name      string `json:"name"`
	Engine    Engine `json:"engine"`
	Dimension int    `json:"dimension"`
	Count     int    `json:"count"`
}

type CollectionHandle struct {
	db  *Database
	col VectorCollection
}

var _ DB = (*Database)(nil)
var _ CollectionAPI = (*CollectionHandle)(nil)

func Open(path string) (*Database, error) {
	if err := os.MkdirAll(path, 0755); err != nil {
		return nil, err
	}

	db := NewDatabase(path)
	entries, err := os.ReadDir(path)
	if err != nil {
		return nil, err
	}

	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		name := entry.Name()
		if vc, err := OpenVamanaCollection(name, db.vamanaBasePath(name), CollectionMeta{}); err == nil {
			db.Collections[name] = vc
			continue
		}

		snapshotPath := filepath.Join(path, name, SnapshotFileName)
		if _, err := os.Stat(snapshotPath); err != nil {
			continue
		}
		c, err := LoadCollection(path, name)
		if err != nil {
			return nil, fmt.Errorf("open hnsw collection %q: %w", name, err)
		}
		db.Collections[name] = c
	}

	return db, nil
}

func (db *Database) CreateCollectionWithOptions(name string, opts CollectionOptions) (*CollectionHandle, error) {
	if name == "" {
		return nil, fmt.Errorf("collection name cannot be empty")
	}
	if opts.Engine == "" {
		opts.Engine = EngineHNSW
	}

	switch opts.Engine {
	case EngineHNSW:
		return db.createHNSWCollectionHandle(name, opts)
	case EngineDiskVamana:
		return db.createDiskVamanaCollectionHandle(name, opts)
	default:
		return nil, fmt.Errorf("%w: %s", ErrUnsupportedEngine, opts.Engine)
	}
}

func (db *Database) OpenCollection(name string) (*CollectionHandle, error) {
	db.mu.RLock()
	col := db.Collections[name]
	db.mu.RUnlock()
	if col != nil {
		return &CollectionHandle{db: db, col: col}, nil
	}

	if vc, err := OpenVamanaCollection(name, db.vamanaBasePath(name), CollectionMeta{}); err == nil {
		db.mu.Lock()
		db.Collections[name] = vc
		db.mu.Unlock()
		return &CollectionHandle{db: db, col: vc}, nil
	}

	snapshotPath := filepath.Join(db.Path, name, SnapshotFileName)
	if _, err := os.Stat(snapshotPath); err == nil {
		c, err := LoadCollection(db.Path, name)
		if err != nil {
			return nil, err
		}
		db.mu.Lock()
		db.Collections[name] = c
		db.mu.Unlock()
		return &CollectionHandle{db: db, col: c}, nil
	}

	return nil, fmt.Errorf("%w: %s", ErrCollectionNotFound, name)
}

func (db *Database) ListCollectionStats() []CollectionStats {
	db.mu.RLock()
	collections := make([]VectorCollection, 0, len(db.Collections))
	for _, col := range db.Collections {
		collections = append(collections, col)
	}
	db.mu.RUnlock()

	stats := make([]CollectionStats, 0, len(collections))
	for _, col := range collections {
		handle := &CollectionHandle{db: db, col: col}
		stats = append(stats, handle.Stats())
	}
	sort.Slice(stats, func(i, j int) bool {
		return stats[i].Name < stats[j].Name
	})
	return stats
}

func (db *Database) Close() error {
	db.mu.RLock()
	collections := make([]VectorCollection, 0, len(db.Collections))
	for _, col := range db.Collections {
		collections = append(collections, col)
	}
	db.mu.RUnlock()

	var firstErr error
	for _, col := range collections {
		if err := col.Close(); err != nil && firstErr == nil {
			firstErr = err
		}
	}
	return firstErr
}

func (db *Database) createHNSWCollectionHandle(name string, opts CollectionOptions) (*CollectionHandle, error) {
	dimension := opts.Dimension
	if dimension <= 0 && len(opts.Points) > 0 {
		dimension = len(opts.Points[0].Vector)
	}
	if dimension <= 0 {
		return nil, ErrVectorDimensionInvalid
	}

	col, err := db.CreateCollectionWithOptionsRaw(name, dimension, opts.Meta, opts.DistanceMetric)
	if err != nil {
		return nil, err
	}
	for _, point := range opts.Points {
		if err := col.InsertPoint(point); err != nil {
			return nil, err
		}
	}
	if err := SaveCollection(col, db.Path); err != nil {
		return nil, err
	}
	return &CollectionHandle{db: db, col: col}, nil
}

func (db *Database) createDiskVamanaCollectionHandle(name string, opts CollectionOptions) (*CollectionHandle, error) {
	if len(opts.Points) == 0 {
		return nil, ErrDiskVamanaNeedsPoints
	}

	dimension := len(opts.Points[0].Vector)
	if opts.Dimension > 0 && opts.Dimension != dimension {
		return nil, fmt.Errorf("%w: expected %d, got %d", ErrVectorDimensionInvalid, opts.Dimension, dimension)
	}
	for i, point := range opts.Points {
		if len(point.Vector) != dimension {
			return nil, fmt.Errorf("%w at point %d: expected %d, got %d", ErrVectorDimensionInvalid, i, dimension, len(point.Vector))
		}
	}

	config := vamana.DefaultDiskBuildConfig()
	if opts.DiskBuildConfig != nil {
		config = *opts.DiskBuildConfig
	}

	// 从 CollectionOptions 传递距离度量
	if opts.DistanceMetric != "" {
		sim, err := resolveSimilarity(opts.DistanceMetric)
		if err != nil {
			return nil, err
		}
		config.DistanceMetric = sim
	}

	basePath := db.vamanaBasePath(name)
	if err := os.MkdirAll(filepath.Dir(basePath), 0755); err != nil {
		return nil, err
	}

	vc, err := BuildVamanaCollection(name, opts.Points, basePath, config, opts.Meta)
	if err != nil {
		return nil, err
	}
	vc.BasePath = basePath
	vc.Config = config
	if err := SaveVamanaCollectionState(vc, basePath); err != nil {
		_ = vc.Close()
		return nil, err
	}

	db.mu.Lock()
	if old := db.Collections[name]; old != nil {
		_ = old.Close()
	}
	db.Collections[name] = vc
	db.mu.Unlock()

	return &CollectionHandle{db: db, col: vc}, nil
}

func (db *Database) vamanaBasePath(name string) string {
	return filepath.Join(db.Path, name, "vamana")
}

func (h *CollectionHandle) Name() string {
	return h.col.Name()
}

func (h *CollectionHandle) Engine() Engine {
	switch h.col.(type) {
	case *VamanaCollection:
		return EngineDiskVamana
	default:
		return EngineHNSW
	}
}

func (h *CollectionHandle) Upsert(points []Point) error {
	for i, point := range points {
		if len(point.Vector) != h.col.Dimension() {
			return fmt.Errorf("%w at point %d: expected %d, got %d", ErrVectorDimensionInvalid, i, h.col.Dimension(), len(point.Vector))
		}
		if err := h.col.InsertPoint(point); err != nil {
			return err
		}
	}
	return h.Flush()
}

func (h *CollectionHandle) Search(query []float32, opts SearchOptions) ([]SearchResult, error) {
	if len(query) != h.col.Dimension() {
		return nil, fmt.Errorf("%w: expected %d, got %d", ErrVectorDimensionInvalid, h.col.Dimension(), len(query))
	}
	topK := opts.TopK
	if topK <= 0 {
		topK = 10
	}
	results := h.col.Search(query, topK, opts.EfSearch)

	// 按 ScoreThreshold 过滤
	if opts.ScoreThreshold > 0 {
		filtered := results[:0]
		for _, r := range results {
			if r.Score >= opts.ScoreThreshold {
				filtered = append(filtered, r)
			}
		}
		results = filtered
	}

	return results, nil
}

func (h *CollectionHandle) Delete(ids []string) error {
	for _, id := range ids {
		h.col.DeleteItemWithIndex(id)
	}
	return h.Flush()
}

func (h *CollectionHandle) Stats() CollectionStats {
	info := h.col.Info()
	return CollectionStats{
		Name:      info.Name,
		Engine:    h.Engine(),
		Dimension: info.Dimension,
		Count:     info.Count,
	}
}

func (h *CollectionHandle) Flush() error {
	if h.db == nil {
		return nil
	}
	if vc, ok := h.col.(*VamanaCollection); ok {
		return vc.FlushToDisk(h.db.vamanaBasePath(vc.Name()))
	}
	return SaveCollection(h.col, h.db.Path)
}

func (h *CollectionHandle) FetchPoints(ids []string) ([]Point, error) {
	var points []Point
	for _, id := range ids {
		vec, ok := h.col.GetVectorByID(id)
		if !ok {
			continue
		}
		meta, _ := h.col.GetMetaByID(id)
		points = append(points, Point{ID: id, Vector: vec, Meta: meta})
	}
	return points, nil
}

func (h *CollectionHandle) Close() error {
	return h.col.Close()
}

func MarshalMeta(v any) json.RawMessage {
	if v == nil {
		return nil
	}
	data, err := json.Marshal(v)
	if err != nil {
		return nil
	}
	return json.RawMessage(data)
}
