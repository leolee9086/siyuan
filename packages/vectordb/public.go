package vectordb

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"s-forge.local/vectordb/bbq"
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
	ErrDatabaseLocked         = errors.New("vector database is locked by another process")
	ErrDatabaseClosed         = errors.New("vector database closed")
	ErrPointIDInvalid         = errors.New("vector point ID invalid")
	ErrCollectionCapacity     = errors.New("vector collection capacity exceeded")
	ErrVectorValueInvalid     = errors.New("vector contains an invalid value")
	ErrMetricUnsupported      = errors.New("distance metric unsupported by engine")
)

type CollectionOptions struct {
	Engine          Engine
	Dimension       int
	Meta            CollectionMeta
	Points          []Point
	DistanceMetric  string // 距离度量："l2"、"cosine"、"ip"；空字符串表示使用引擎默认
	DiskBuildConfig *vamana.DiskBuildConfig
	// WALCheckpointBytes 达到该大小后 Stats 会建议执行 checkpoint；零值使用默认阈值。
	WALCheckpointBytes int64
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
	Checkpoint(ctx context.Context) (CheckpointResult, error)
	Stats() CollectionStats
	FetchPoints(ids []string) ([]Point, error)
	Close() error
}

type SearchOptions struct {
	TopK           int
	EfSearch       int
	ScoreThreshold float32 // >=0 时仅返回 score >= threshold 的结果；0 或负数表示不启用阈值截断
	// ExcludeIDs 从结果中排除指定外部 ID，适合相似内容推荐时排除查询来源。
	ExcludeIDs []string
	// GroupBy 按 Meta 中的 JSON 字段分组；支持使用点号访问嵌套字段。
	GroupBy string
	// MaxPerGroup 限制每组结果数；GroupBy 非空且该值小于 1 时默认为 1。
	MaxPerGroup int
	// CandidateMultiplier 控制分组搜索的候选放大倍数；零值默认为 4。
	CandidateMultiplier int
}

type CollectionStats struct {
	Name                  string `json:"name"`
	Engine                Engine `json:"engine"`
	Dimension             int    `json:"dimension"`
	Count                 int    `json:"count"`
	TotalCount            int    `json:"total_count,omitempty"`
	DeletedCount          int    `json:"deleted_count,omitempty"`
	PendingCount          int    `json:"pending_count,omitempty"`
	WALBytes              int64  `json:"wal_bytes,omitempty"`
	CheckpointRecommended bool   `json:"checkpoint_recommended,omitempty"`
	ActiveGeneration      string `json:"active_generation,omitempty"`
	MaintenanceError      string `json:"maintenance_error,omitempty"`
}

// CheckpointResult 描述快照发布和日志回收结果。
type CheckpointResult struct {
	Engine          Engine `json:"engine"`
	CommitSequence  uint64 `json:"commit_sequence"`
	OriginalPoints  uint64 `json:"original_points"`
	RemainingPoints uint64 `json:"remaining_points"`
	ReclaimedPoints uint64 `json:"reclaimed_points"`
	WALBytesBefore  int64  `json:"wal_bytes_before"`
	CleanupPending  bool   `json:"cleanup_pending"`
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
	if collection, ok := h.col.(*VamanaCollection); ok {
		return AppendVamanaWAL(collection, operations, sequence, false)
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
	if err := db.ensureDatabaseLock(); err != nil {
		return nil, err
	}
	success := false
	defer func() {
		if !success {
			db.closeAfterOpenFailure()
		}
	}()
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
		hasVamana, statErr := hasVamanaCollection(vamanaBasePath)
		if statErr != nil {
			return nil, fmt.Errorf("%w: %w", ErrPersistenceFailed, statErr)
		}
		if hasVamana {
			vc, openErr := OpenVamanaCollection(name, vamanaBasePath, CollectionMeta{})
			if openErr != nil {
				return nil, classifyPublicError(openErr)
			}
			db.Collections[name] = vc
			db.ensureWriteStateLocked(name).sequence = collectionCommitSequence(vc)
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
		db.ensureWriteStateLocked(name).sequence = collectionCommitSequence(c)
	}

	success = true
	return db, nil
}

func (db *Database) CreateCollectionWithOptions(name string, opts CollectionOptions) (CollectionAPI, error) {
	if err := db.ensureDatabaseLock(); err != nil {
		return nil, err
	}
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
	if err := db.ensureDatabaseLock(); err != nil {
		return nil, err
	}
	db.mu.RLock()
	col := db.Collections[name]
	db.mu.RUnlock()
	if col != nil {
		return &CollectionHandle{db: db, col: col}, nil
	}

	vamanaBasePath := db.vamanaBasePath(name)
	hasVamana, statErr := hasVamanaCollection(vamanaBasePath)
	if statErr != nil {
		return nil, fmt.Errorf("%w: %w", ErrPersistenceFailed, statErr)
	}
	if hasVamana {
		vc, openErr := OpenVamanaCollection(name, vamanaBasePath, CollectionMeta{})
		if openErr != nil {
			return nil, classifyPublicError(openErr)
		}
		db.mu.Lock()
		db.Collections[name] = vc
		db.ensureWriteStateLocked(name).sequence = collectionCommitSequence(vc)
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
	if err := db.releaseDatabaseLock(); err != nil && firstErr == nil {
		firstErr = err
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
	metric := opts.DistanceMetric
	if metric == "" {
		metric = "cosine"
	}
	points, err := normalizeInitialPoints(opts.Points, dimension, metric)
	if err != nil {
		return nil, err
	}

	col, err := db.CreateCollectionWithOptionsRaw(name, dimension, opts.Meta, opts.DistanceMetric)
	if err != nil {
		return nil, err
	}
	if len(points) > 0 {
		vectors := make([][]float32, len(points))
		for index := range points {
			vectors[index] = points[index].Vector
		}
		if centroidErr := col.(*Collection).Store.TrainBBQCentroid(vectors); centroidErr != nil {
			return nil, centroidErr
		}
	}
	for _, point := range points {
		if err := col.(*Collection).insertPreparedPoint(point); err != nil {
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
	if dimension <= 0 {
		return nil, ErrVectorDimensionInvalid
	}
	if opts.Dimension > 0 && opts.Dimension != dimension {
		return nil, fmt.Errorf("%w: expected %d, got %d", ErrVectorDimensionInvalid, opts.Dimension, dimension)
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
	if config.DistanceMetric == bbq.MaxInnerProduct {
		return nil, fmt.Errorf("%w: %s does not implement the MIPS graph transform", ErrMetricUnsupported, EngineDiskVamana)
	}
	points, err := normalizeInitialPoints(opts.Points, dimension, similarityMetricName(config.DistanceMetric))
	if err != nil {
		return nil, err
	}

	basePath := db.vamanaBasePath(name)
	if err := os.MkdirAll(filepath.Dir(basePath), 0755); err != nil {
		return nil, err
	}

	vc, err := buildPreparedVamanaCollection(name, points, basePath, config, opts.Meta)
	if err != nil {
		return nil, err
	}
	vc.BasePath = basePath
	vc.Config = config
	if opts.WALCheckpointBytes > 0 {
		vc.WALCheckpointBytes = opts.WALCheckpointBytes
	}
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

func normalizeInitialPoints(points []Point, dimension int, metric string) ([]Point, error) {
	lastIndex := make(map[string]int, len(points))
	prepared := make([]Point, len(points))
	for index, point := range points {
		if point.ID == "" {
			return nil, fmt.Errorf("%w at point %d", ErrPointIDInvalid, index)
		}
		if len(point.Vector) != dimension {
			return nil, fmt.Errorf("%w at point %d: expected %d, got %d", ErrVectorDimensionInvalid, index, dimension, len(point.Vector))
		}
		vector, err := prepareVectorForMetric(point.Vector, metric)
		if err != nil {
			return nil, fmt.Errorf("point %d: %w", index, err)
		}
		point.Vector = vector
		prepared[index] = point
		lastIndex[point.ID] = index
	}
	if len(lastIndex) == len(points) {
		return prepared, nil
	}
	normalized := make([]Point, 0, len(lastIndex))
	for index, point := range prepared {
		if lastIndex[point.ID] == index {
			normalized = append(normalized, point)
		}
	}
	return normalized, nil
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
	operations, err := validateWriteBatch(ctx, h.col.Dimension(), collectionMetricName(h.col), batch)
	if err != nil {
		return WriteResult{}, err
	}

	state := h.db.writeState(h.Name())
	state.mu.Lock()
	defer state.mu.Unlock()
	if state.closed || state.closing {
		return WriteResult{}, ErrCollectionClosed
	}
	if state.recoveryRequired {
		return WriteResult{IndexHealthy: false}, ErrIndexRecoveryRequired
	}
	if err := ctx.Err(); err != nil {
		return WriteResult{}, err
	}

	nextSequence := state.sequence + 1
	if normalizedOptions.Durability != DurabilityMemory {
		return h.writeDurableLocked(ctx, state, operations, normalizedOptions, nextSequence)
	}

	rollback := h.captureWriteRollback(operations)
	if normalizedOptions.OnProgress != nil {
		normalizedOptions.OnProgress(WriteProgress{Stage: "applying", Total: len(operations)})
	}
	applied, err := h.applyWriteOperations(ctx, operations, normalizedOptions.OnProgress)
	if err != nil {
		if rollbackErr := h.applyWriteRollback(rollback, applied); rollbackErr != nil {
			state.recoveryRequired = true
			return WriteResult{Applied: applied, Durability: normalizedOptions.Durability, Committed: true, IndexHealthy: false}, fmt.Errorf("%w: apply failed: %v; rollback failed: %w", ErrIndexRecoveryRequired, err, classifyPublicError(rollbackErr))
		}
		return WriteResult{Applied: applied, Durability: normalizedOptions.Durability, IndexHealthy: true}, fmt.Errorf("%w: %w", ErrBatchApplyFailed, classifyPublicError(err))
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
	if normalizedOptions.OnProgress != nil {
		normalizedOptions.OnProgress(WriteProgress{Stage: "committed", Completed: applied, Total: applied})
	}
	return result, nil
}

// writeDurableLocked 先把完整批次写入 WAL，再修改索引；调用方持有集合写状态锁。
// WAL 达到请求的持久性级别后成为提交点，提交后即使上下文取消也必须完成内存发布。
func (h *CollectionHandle) writeDurableLocked(ctx context.Context, state *collectionWriteState, operations []WriteOperation, options WriteOptions, sequence uint64) (WriteResult, error) {
	if options.OnProgress != nil {
		options.OnProgress(WriteProgress{Stage: "persisting", Total: len(operations)})
	}
	if err := ctx.Err(); err != nil {
		return WriteResult{Durability: options.Durability, IndexHealthy: true}, err
	}
	var err error
	if options.Durability == DurabilitySync {
		err = persistWriteCollection(h, operations, sequence)
	} else {
		err = persistWriteAsyncCollection(h, operations, sequence)
	}
	if err != nil {
		return WriteResult{Durability: options.Durability, IndexHealthy: true}, classifyPublicError(err)
	}

	if options.OnProgress != nil {
		options.OnProgress(WriteProgress{Stage: "applying", Total: len(operations)})
	}
	applied, applyErr := h.applyWriteOperations(context.Background(), operations, options.OnProgress)
	if applyErr != nil {
		state.recoveryRequired = true
		return WriteResult{
			CommitSequence: sequence,
			Applied:        applied,
			Durability:     options.Durability,
			Committed:      true,
			IndexHealthy:   false,
		}, fmt.Errorf("%w: committed WAL sequence %d could not be applied: %v", ErrIndexRecoveryRequired, sequence, classifyPublicError(applyErr))
	}

	state.sequence = sequence
	setCollectionCommitSequence(h.col, sequence)
	result := WriteResult{
		CommitSequence: sequence,
		Applied:        applied,
		Durability:     options.Durability,
		Committed:      true,
		IndexHealthy:   true,
	}
	if options.Durability == DurabilityAsync {
		h.flushAsync()
	}
	h.scheduleAutoCheckpointLocked(state)
	if options.OnProgress != nil {
		options.OnProgress(WriteProgress{Stage: "committed", Completed: applied, Total: applied})
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
	if state.closed || state.closing {
		return nil, ErrCollectionClosed
	}
	if state.recoveryRequired {
		return nil, ErrIndexRecoveryRequired
	}

	if len(query) != h.col.Dimension() {
		return nil, fmt.Errorf("%w: expected %d, got %d", ErrVectorDimensionInvalid, h.col.Dimension(), len(query))
	}
	topK := opts.TopK
	if topK <= 0 {
		topK = 10
	}
	diversified := len(opts.ExcludeIDs) > 0 || opts.GroupBy != ""
	if !diversified {
		results, err := h.col.SearchWithError(query, topK, opts.EfSearch)
		if err != nil || opts.ScoreThreshold <= 0 {
			return results, err
		}
		filtered := results[:0]
		for _, result := range results {
			if result.Score >= opts.ScoreThreshold {
				filtered = append(filtered, result)
			}
		}
		return filtered, nil
	}

	count := h.col.ItemCount()
	candidateTopK := min(topK, count)
	if excludedCount := len(opts.ExcludeIDs); excludedCount >= count-candidateTopK {
		candidateTopK = count
	} else {
		candidateTopK += excludedCount
	}
	if opts.GroupBy != "" {
		multiplier := opts.CandidateMultiplier
		if multiplier < 1 {
			multiplier = 4
		}
		expanded := count
		if topK <= count/multiplier {
			expanded = topK * multiplier
		}
		if expanded > candidateTopK {
			candidateTopK = expanded
		}
	}
	results, err := h.col.SearchWithError(query, candidateTopK, opts.EfSearch)
	if err != nil {
		return nil, err
	}
	var excluded map[string]struct{}
	if len(opts.ExcludeIDs) > 0 {
		excluded = make(map[string]struct{}, len(opts.ExcludeIDs))
		for _, id := range opts.ExcludeIDs {
			excluded[id] = struct{}{}
		}
	}
	maxPerGroup := opts.MaxPerGroup
	var groupPath []string
	var groupCounts map[string]int
	if opts.GroupBy != "" {
		if maxPerGroup < 1 {
			maxPerGroup = 1
		}
		groupPath = strings.Split(opts.GroupBy, ".")
		groupCounts = make(map[string]int)
	}
	filtered := results[:0]
	for _, result := range results {
		if opts.ScoreThreshold > 0 && result.Score < opts.ScoreThreshold {
			continue
		}
		if _, skip := excluded[result.ID]; skip {
			continue
		}
		if opts.GroupBy != "" {
			group := searchResultGroup(result, groupPath)
			if groupCounts[group] >= maxPerGroup {
				continue
			}
			groupCounts[group]++
		}
		filtered = append(filtered, result)
		if len(filtered) == topK {
			break
		}
	}
	return filtered, nil
}

func searchResultGroup(result SearchResult, path []string) string {
	var value interface{}
	decoder := json.NewDecoder(bytes.NewReader(result.Meta))
	decoder.UseNumber()
	if len(result.Meta) == 0 || decoder.Decode(&value) != nil {
		return "\x00" + result.ID
	}
	for _, component := range path {
		object, ok := value.(map[string]interface{})
		if !ok {
			return "\x00" + result.ID
		}
		value, ok = object[component]
		if !ok {
			return "\x00" + result.ID
		}
	}
	encoded, err := json.Marshal(value)
	if err != nil {
		return "\x00" + result.ID
	}
	return string(encoded)
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
	preparedInserter, hasPreparedInserter := h.col.(interface{ insertPreparedPoint(Point) error })
	for index, operation := range operations {
		if err := ctx.Err(); err != nil {
			return index, err
		}
		if operation.Point != nil {
			var err error
			if hasPreparedInserter {
				err = preparedInserter.insertPreparedPoint(*operation.Point)
			} else {
				err = h.col.InsertPoint(*operation.Point)
			}
			if err != nil {
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

// scheduleAutoCheckpointLocked 在 WAL 超过阈值后安排后台 checkpoint；调用方持有 state.mu。
func (h *CollectionHandle) scheduleAutoCheckpointLocked(state *collectionWriteState) {
	collection, ok := h.col.(*VamanaCollection)
	if !ok || !collection.AutoCheckpointNeeded() || state.closing || state.closed {
		return
	}
	if !state.checkpointRunning.CompareAndSwap(false, true) {
		return
	}
	state.checkpointWG.Add(1)
	go func() {
		defer state.checkpointWG.Done()
		state.mu.Lock()
		defer func() {
			state.checkpointRunning.Store(false)
			state.mu.Unlock()
		}()
		if state.closed || state.closing || state.recoveryRequired || !collection.AutoCheckpointNeeded() {
			return
		}
		_, err := collection.Checkpoint(context.Background())
		state.checkpointErr = err
	}()
}

func (h *CollectionHandle) Stats() CollectionStats {
	state := h.db.writeState(h.Name())
	state.mu.RLock()
	defer state.mu.RUnlock()

	info := h.col.Info()
	stats := CollectionStats{
		Name:      info.Name,
		Engine:    h.Engine(),
		Dimension: info.Dimension,
		Count:     info.Count,
	}
	if collection, ok := h.col.(*Collection); ok {
		collection.Mu.RLock()
		stats.TotalCount = len(collection.DocMap)
		stats.DeletedCount = stats.TotalCount - len(collection.IDMap)
		collection.Mu.RUnlock()
		if h.db != nil {
			stats.WALBytes = fileSizeOrZero(filepath.Join(h.db.Path, h.Name(), WALFileName))
		}
	} else if collection, ok := h.col.(*VamanaCollection); ok {
		maintenance := collection.MaintenanceStats()
		stats.TotalCount = int(maintenance.TotalPoints)
		stats.DeletedCount = int(maintenance.DeletedPoints)
		stats.PendingCount = maintenance.PendingPoints
		stats.WALBytes = maintenance.WALBytes
		stats.CheckpointRecommended = maintenance.CheckpointRecommended
		stats.ActiveGeneration = maintenance.ActiveGeneration
	}
	if state.checkpointErr != nil {
		stats.MaintenanceError = state.checkpointErr.Error()
	}
	return stats
}

func (h *CollectionHandle) Flush() error {
	if h.db == nil {
		return fmt.Errorf("%w: collection is detached from its database", ErrPersistenceFailed)
	}
	state := h.db.writeState(h.Name())
	state.mu.Lock()
	defer state.mu.Unlock()
	if state.closed || state.closing {
		return ErrCollectionClosed
	}
	if state.recoveryRequired {
		return ErrIndexRecoveryRequired
	}
	state.waitAsync()

	var err error
	if _, ok := h.col.(*Collection); ok {
		err = SaveCollection(h.col, h.db.Path)
	} else if collection, ok := h.col.(*VamanaCollection); ok && collection.MaintenanceStats().CheckpointRecommended {
		_, err = collection.Checkpoint(context.Background())
		state.checkpointErr = err
	} else {
		err = h.col.Flush()
	}
	if err != nil {
		return classifyPublicError(err)
	}
	return nil
}

func (h *CollectionHandle) Checkpoint(ctx context.Context) (CheckpointResult, error) {
	if ctx == nil {
		ctx = context.Background()
	}
	if h.db == nil {
		return CheckpointResult{}, fmt.Errorf("%w: collection is detached from its database", ErrPersistenceFailed)
	}
	state := h.db.writeState(h.Name())
	state.mu.Lock()
	defer state.mu.Unlock()
	if state.closed || state.closing {
		return CheckpointResult{}, ErrCollectionClosed
	}
	if state.recoveryRequired {
		return CheckpointResult{}, ErrIndexRecoveryRequired
	}
	if err := ctx.Err(); err != nil {
		return CheckpointResult{}, err
	}
	state.waitAsync()
	if collection, ok := h.col.(*VamanaCollection); ok {
		result, err := collection.Checkpoint(ctx)
		state.checkpointErr = err
		if err != nil {
			return CheckpointResult{}, classifyPublicError(err)
		}
		return result, nil
	}
	info := h.col.Info()
	walPath := filepath.Join(h.db.Path, h.Name(), WALFileName)
	walBytes := fileSizeOrZero(walPath)
	if err := SaveCollection(h.col, h.db.Path); err != nil {
		return CheckpointResult{}, classifyPublicError(err)
	}
	return CheckpointResult{
		Engine:          h.Engine(),
		CommitSequence:  state.sequence,
		OriginalPoints:  uint64(info.Count),
		RemainingPoints: uint64(info.Count),
		WALBytesBefore:  walBytes,
	}, nil
}

func (h *CollectionHandle) persistWrite(operations []WriteOperation, sequence uint64) error {
	if collection, ok := h.col.(*Collection); ok {
		return AppendWALBatchSync(collection, h.db.Path, operations, sequence)
	}
	if collection, ok := h.col.(*VamanaCollection); ok {
		return AppendVamanaWAL(collection, operations, sequence, true)
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
	if state.closed || state.closing {
		return nil, ErrCollectionClosed
	}
	if state.recoveryRequired {
		return nil, ErrIndexRecoveryRequired
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
	if state.closed {
		state.mu.Unlock()
		return nil
	}
	if !state.closing {
		state.closing = true
	}
	state.mu.Unlock()

	// closing 在 state.mu 下阻止新的后台任务登记，因此此处等待不会与 WaitGroup.Add 并发。
	state.checkpointWG.Wait()

	state.mu.Lock()
	defer state.mu.Unlock()
	if state.closed {
		return nil
	}
	state.waitAsync()
	var checkpointErr error
	if collection, ok := h.col.(*VamanaCollection); ok && collection.MaintenanceStats().CheckpointRecommended {
		if _, err := collection.Checkpoint(context.Background()); err != nil {
			state.checkpointErr = err
			checkpointErr = classifyPublicError(err)
		} else {
			state.checkpointErr = nil
		}
	}
	if err := h.col.Close(); err != nil {
		return classifyPublicError(err)
	}
	state.closed = true
	if checkpointErr != nil {
		return checkpointErr
	}
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
