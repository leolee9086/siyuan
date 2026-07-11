package vectordb

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"

	"s-forge.local/vectordb/storage"
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
	ErrCollectionClosed       = errors.New("collection closed")
	ErrStorageCorrupted       = errors.New("vector storage corrupted")
	ErrCollectionBusy         = errors.New("collection busy")
	ErrCollectionReadOnly     = errors.New("collection read-only")
	ErrPersistenceFailed      = errors.New("vector persistence failed")
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
	CreateCollectionWithOptions(name string, opts CollectionOptions) (CollectionAPI, error)
	OpenCollection(name string) (CollectionAPI, error)
	DeleteCollection(name string) error
	ListCollectionStats() []CollectionStats
	Close() error
}

// CollectionAPI 是 HNSW 与 DiskVamana 共享的集合操作面。
type CollectionAPI interface {
	Name() string
	Engine() Engine
	Write(ctx context.Context, batch WriteBatch, opts WriteOptions) (WriteResult, error)
	Upsert(points []Point) error
	Search(query []float32, opts SearchOptions) ([]SearchResult, error)
	Delete(ids []string) error
	Flush() error
	Stats() CollectionStats
	FetchPoints(ids []string) ([]Point, error)
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

var persistWriteCollection = func(h *CollectionHandle, operations []WriteOperation, sequence uint64) error {
	return h.persistWrite(operations, sequence)
}

var persistWriteAsyncCollection = func(h *CollectionHandle, operations []WriteOperation, sequence uint64) error {
	if collection, ok := h.col.(*Collection); ok {
		return AppendWALBatchAsync(collection, h.db.Path, operations, sequence)
	}
	return nil
}

var asyncFlushCollection = func(h *CollectionHandle) {
	state := h.db.writeState(h.Name())
	state.scheduleAsync(func() error {
		if collection, ok := h.col.(*Collection); ok {
			return SyncCollectionWAL(collection, h.db.Path)
		}
		return h.col.Flush()
	})
}

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
		vamanaBasePath := db.vamanaBasePath(name)
		if _, statErr := os.Stat(vamanaBasePath + ".index"); statErr == nil {
			vc, openErr := OpenVamanaCollection(name, vamanaBasePath, CollectionMeta{})
			if openErr != nil {
				return nil, classifyPublicError(openErr)
			}
			db.Collections[name] = vc
			db.ensureWriteStateLocked(name).sequence = collectionCommitSequence(vc)
			continue
		} else if !os.IsNotExist(statErr) {
			return nil, fmt.Errorf("%w: %w", ErrPersistenceFailed, statErr)
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
		db.ensureWriteStateLocked(name).sequence = collectionCommitSequence(c)
	}

	return db, nil
}

func (db *Database) CreateCollectionWithOptions(name string, opts CollectionOptions) (CollectionAPI, error) {
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

func (db *Database) OpenCollection(name string) (CollectionAPI, error) {
	db.mu.RLock()
	col := db.Collections[name]
	db.mu.RUnlock()
	if col != nil {
		return &CollectionHandle{db: db, col: col}, nil
	}

	vamanaBasePath := db.vamanaBasePath(name)
	if _, statErr := os.Stat(vamanaBasePath + ".index"); statErr == nil {
		vc, openErr := OpenVamanaCollection(name, vamanaBasePath, CollectionMeta{})
		if openErr != nil {
			return nil, classifyPublicError(openErr)
		}
		db.mu.Lock()
		db.Collections[name] = vc
		db.ensureWriteStateLocked(name).sequence = collectionCommitSequence(vc)
		db.mu.Unlock()
		return &CollectionHandle{db: db, col: vc}, nil
	} else if !os.IsNotExist(statErr) {
		return nil, fmt.Errorf("%w: %w", ErrPersistenceFailed, statErr)
	}

	snapshotPath := filepath.Join(db.Path, name, SnapshotFileName)
	if _, err := os.Stat(snapshotPath); err == nil {
		c, err := LoadCollection(db.Path, name)
		if err != nil {
			return nil, err
		}
		db.mu.Lock()
		db.Collections[name] = c
		db.ensureWriteStateLocked(name).sequence = collectionCommitSequence(c)
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
	handles := make([]*CollectionHandle, 0, len(db.Collections))
	for _, col := range db.Collections {
		handles = append(handles, &CollectionHandle{db: db, col: col})
	}
	db.mu.RUnlock()

	var firstErr error
	for _, handle := range handles {
		if err := handle.Close(); err != nil && firstErr == nil {
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
	db.ensureWriteStateLocked(name)
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
	return h.col.Engine()
}

func (h *CollectionHandle) Write(ctx context.Context, batch WriteBatch, opts WriteOptions) (WriteResult, error) {
	if ctx == nil {
		ctx = context.Background()
	}
	if h.db == nil {
		return WriteResult{}, fmt.Errorf("%w: collection is detached from its database", ErrPersistenceFailed)
	}

	normalizedOptions, err := normalizeWriteOptions(opts)
	if err != nil {
		return WriteResult{}, err
	}
	operations, err := validateWriteBatch(ctx, h.col.Dimension(), batch)
	if err != nil {
		return WriteResult{}, err
	}

	state := h.db.writeState(h.Name())
	state.mu.Lock()
	defer state.mu.Unlock()
	if state.closed {
		return WriteResult{}, ErrCollectionClosed
	}
	if err := ctx.Err(); err != nil {
		return WriteResult{}, err
	}

	rollback := h.captureWriteRollback(operations)
	nextSequence := state.sequence + 1
	if normalizedOptions.OnProgress != nil {
		normalizedOptions.OnProgress(WriteProgress{Stage: "applying", Total: len(operations)})
	}
	applied, err := h.applyWriteOperations(ctx, operations, normalizedOptions.OnProgress)
	if err != nil {
		if rollbackErr := h.applyWriteRollback(rollback, applied); rollbackErr != nil {
			return WriteResult{Applied: applied, Durability: normalizedOptions.Durability, Committed: true, IndexHealthy: false}, fmt.Errorf("%w: apply failed: %v; rollback failed: %w", ErrIndexRecoveryRequired, err, classifyPublicError(rollbackErr))
		}
		return WriteResult{Applied: applied, Durability: normalizedOptions.Durability, IndexHealthy: true}, fmt.Errorf("%w: %w", ErrBatchApplyFailed, classifyPublicError(err))
	}

	if normalizedOptions.OnProgress != nil && normalizedOptions.Durability == DurabilitySync {
		normalizedOptions.OnProgress(WriteProgress{Stage: "persisting", Completed: applied, Total: applied})
	}
	if normalizedOptions.Durability == DurabilityAsync {
		if err := persistWriteAsyncCollection(h, operations, nextSequence); err != nil {
			if rollbackErr := h.applyWriteRollback(rollback, applied); rollbackErr != nil {
				return WriteResult{Applied: applied, Durability: normalizedOptions.Durability, Committed: true, IndexHealthy: false}, fmt.Errorf("%w: %w", ErrIndexRecoveryRequired, classifyPublicError(err))
			}
			return WriteResult{Applied: applied, Durability: normalizedOptions.Durability, IndexHealthy: true}, classifyPublicError(err)
		}
	}
	if normalizedOptions.Durability == DurabilitySync {
		if err := persistWriteCollection(h, operations, nextSequence); err != nil {
			if rollbackErr := h.applyWriteRollback(rollback, len(rollback)); rollbackErr != nil {
				return WriteResult{Applied: applied, Durability: normalizedOptions.Durability, Committed: true, IndexHealthy: false}, fmt.Errorf("%w: %w", ErrIndexRecoveryRequired, classifyPublicError(err))
			}
			return WriteResult{Applied: applied, Durability: normalizedOptions.Durability, IndexHealthy: true}, classifyPublicError(err)
		}
	}

	state.sequence = nextSequence
	setCollectionCommitSequence(h.col, nextSequence)
	result := WriteResult{
		CommitSequence: nextSequence,
		Applied:        applied,
		Durability:     normalizedOptions.Durability,
		Committed:      true,
		IndexHealthy:   true,
	}
	if normalizedOptions.Durability == DurabilityAsync {
		h.flushAsync()
	}

	if normalizedOptions.OnProgress != nil {
		normalizedOptions.OnProgress(WriteProgress{Stage: "committed", Completed: applied, Total: applied})
	}
	return result, nil
}

func (h *CollectionHandle) Upsert(points []Point) error {
	if len(points) == 0 {
		return nil
	}
	operations := make([]WriteOperation, len(points))
	for i := range points {
		point := points[i]
		operations[i] = WriteOperation{Point: &point}
	}
	_, err := h.Write(context.Background(), WriteBatch{Operations: operations}, WriteOptions{Durability: DurabilitySync})
	return err
}

func (h *CollectionHandle) Search(query []float32, opts SearchOptions) ([]SearchResult, error) {
	state := h.db.writeState(h.Name())
	state.mu.RLock()
	defer state.mu.RUnlock()
	if state.closed {
		return nil, ErrCollectionClosed
	}

	if len(query) != h.col.Dimension() {
		return nil, fmt.Errorf("%w: expected %d, got %d", ErrVectorDimensionInvalid, h.col.Dimension(), len(query))
	}
	topK := opts.TopK
	if topK <= 0 {
		topK = 10
	}
	results, err := h.col.SearchWithError(query, topK, opts.EfSearch)
	if err != nil {
		return nil, err
	}

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
	if len(ids) == 0 {
		return nil
	}
	operations := make([]WriteOperation, len(ids))
	for i, id := range ids {
		operations[i] = WriteOperation{DeleteID: id}
	}
	_, err := h.Write(context.Background(), WriteBatch{Operations: operations}, WriteOptions{Durability: DurabilitySync})
	return err
}

func (h *CollectionHandle) applyWriteOperations(ctx context.Context, operations []WriteOperation, progress func(WriteProgress)) (int, error) {
	for index, operation := range operations {
		if err := ctx.Err(); err != nil {
			return index, err
		}
		if operation.Point != nil {
			if err := h.col.InsertPoint(*operation.Point); err != nil {
				return index, err
			}
		} else if err := h.col.DeletePointWithError(operation.DeleteID); err != nil {
			return index, err
		}
		if progress != nil {
			progress(WriteProgress{Stage: "applying", Completed: index + 1, Total: len(operations)})
		}
	}
	return len(operations), nil
}

func (h *CollectionHandle) flushAsync() {
	asyncFlushCollection(h)
}

func (h *CollectionHandle) Stats() CollectionStats {
	state := h.db.writeState(h.Name())
	state.mu.RLock()
	defer state.mu.RUnlock()

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
		return fmt.Errorf("%w: collection is detached from its database", ErrPersistenceFailed)
	}
	state := h.db.writeState(h.Name())
	state.mu.Lock()
	defer state.mu.Unlock()
	if state.closed {
		return ErrCollectionClosed
	}
	state.waitAsync()

	var err error
	if _, ok := h.col.(*Collection); ok {
		err = SaveCollection(h.col, h.db.Path)
	} else {
		err = h.col.Flush()
	}
	if err != nil {
		return classifyPublicError(err)
	}
	return nil
}

func (h *CollectionHandle) persistWrite(operations []WriteOperation, sequence uint64) error {
	if collection, ok := h.col.(*Collection); ok {
		return AppendWALBatchSync(collection, h.db.Path, operations, sequence)
	}
	previousSequence := collectionCommitSequence(h.col)
	setCollectionCommitSequence(h.col, sequence)
	if err := h.col.Flush(); err != nil {
		setCollectionCommitSequence(h.col, previousSequence)
		return err
	}
	return nil
}

func (h *CollectionHandle) FetchPoints(ids []string) ([]Point, error) {
	state := h.db.writeState(h.Name())
	state.mu.RLock()
	defer state.mu.RUnlock()
	if state.closed {
		return nil, ErrCollectionClosed
	}

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
	if h.db == nil {
		return fmt.Errorf("%w: collection is detached from its database", ErrPersistenceFailed)
	}
	state := h.db.writeState(h.Name())
	state.mu.Lock()
	defer state.mu.Unlock()
	if state.closed {
		return nil
	}
	state.waitAsync()
	if err := h.col.Close(); err != nil {
		return classifyPublicError(err)
	}
	state.closed = true
	return nil
}

func classifyPublicError(err error) error {
	if err == nil {
		return nil
	}
	switch {
	case errors.Is(err, vamana.ErrDiskIndexClosed), errors.Is(err, storage.ErrIndexClosed):
		return fmt.Errorf("%w: %w", ErrCollectionClosed, err)
	case errors.Is(err, vamana.ErrVectorDimensionMismatch), errors.Is(err, storage.ErrDimensionMismatch):
		return fmt.Errorf("%w: %w", ErrVectorDimensionInvalid, err)
	case errors.Is(err, storage.ErrCorruptedFile), errors.Is(err, storage.ErrInvalidMagic),
		errors.Is(err, storage.ErrVersionMismatch), errors.Is(err, vamana.ErrBBQMagicMismatch),
		errors.Is(err, vamana.ErrBBQVersionMismatch), errors.Is(err, vamana.ErrBBQDimensionMismatch):
		return fmt.Errorf("%w: %w", ErrStorageCorrupted, err)
	case errors.Is(err, vamana.ErrCompactionInProgress):
		return fmt.Errorf("%w: %w", ErrCollectionBusy, err)
	case errors.Is(err, storage.ErrReadOnly):
		return fmt.Errorf("%w: %w", ErrCollectionReadOnly, err)
	}
	return fmt.Errorf("%w: %w", ErrPersistenceFailed, err)
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
