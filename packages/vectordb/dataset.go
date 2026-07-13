package vectordb

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"
	"sync"

	"s-forge.local/vectordb/vamana"
)

// DefaultRRFConstant 是业界常用的 RRF 排名平滑常数。
const DefaultRRFConstant = 60

var (
	ErrDatasetNotFound    = errors.New("dataset not found")
	ErrDatasetExists      = errors.New("dataset already exists")
	ErrIndexViewNotFound  = errors.New("index view not found")
	ErrDatasetInvalid     = errors.New("invalid dataset definition")
	ErrFusionQueryInvalid = errors.New("invalid fusion query")
)

// EmbeddingSchema 定义命名嵌入字段的维度和度量契约。
type EmbeddingSchema struct {
	Dimension      int    `json:"dimension" msgpack:"dimension"`
	DistanceMetric string `json:"distance_metric" msgpack:"distanceMetric"`
}

// IndexViewOptions 定义嵌入字段到独立 ANN 引擎的物理投影。
type IndexViewOptions struct {
	Embedding       string                  `json:"embedding" msgpack:"embedding"`
	Engine          Engine                  `json:"engine" msgpack:"engine"`
	HNSWConfig      *CollectionConfig       `json:"hnsw_config,omitempty" msgpack:"hnswConfig,omitempty"`
	DiskBuildConfig *vamana.DiskBuildConfig `json:"disk_build_config,omitempty" msgpack:"diskBuildConfig,omitempty"`
}

// Entity 是共享稳定 ID、meta 和多个命名嵌入的数据实体。
type Entity struct {
	ID         string               `json:"id" msgpack:"id"`
	Embeddings map[string][]float32 `json:"embeddings" msgpack:"embeddings"`
	Meta       json.RawMessage      `json:"meta,omitempty" msgpack:"meta,omitempty"`
}

// DatasetOptions 定义数据集 schema、索引视图和初始实体。
type DatasetOptions struct {
	Embeddings map[string]EmbeddingSchema
	Indexes    map[string]IndexViewOptions
	Entities   []Entity
}

// FusionQuery 定义参与融合的一路索引查询。
type FusionQuery struct {
	Index   string
	Vector  []float32
	Weight  float64
	Options SearchOptions
}

// FusionSearchRequest 定义显式多路 RRF 查询。
type FusionSearchRequest struct {
	Queries      []FusionQuery
	TopK         int
	RRFConstant  int
	AllowPartial bool
}

// FusionSource 保留单路结果对融合实体的排名贡献。
type FusionSource struct {
	Index     string  `json:"index"`
	Embedding string  `json:"embedding"`
	Rank      int     `json:"rank"`
	Score     float32 `json:"score"`
	Distance  float32 `json:"distance"`
	Weight    float64 `json:"weight"`
}

// FusedSearchResult 是按实体 ID 去重后的 RRF 结果。
type FusedSearchResult struct {
	ID      string          `json:"id"`
	Score   float64         `json:"score"`
	Meta    json.RawMessage `json:"meta,omitempty"`
	Sources []FusionSource  `json:"sources"`
}

// FusionFailure 描述 AllowPartial 模式下失败的查询来源。
type FusionFailure struct {
	Index string `json:"index"`
	Error string `json:"error"`
}

// FusionSearchResponse 同时返回融合结果和可选的来源失败明细。
type FusionSearchResponse struct {
	Results  []FusedSearchResult `json:"results"`
	Failures []FusionFailure     `json:"failures,omitempty"`
}

// DatasetAPI 是多嵌入、多索引数据集的稳定操作面。
type DatasetAPI interface {
	Name() string
	Stats() DatasetStats
	UpsertEntities(ctx context.Context, entities []Entity, opts WriteOptions) (DatasetWriteResult, error)
	DeleteEntities(ctx context.Context, ids []string, opts WriteOptions) (DatasetWriteResult, error)
	AddIndex(name string, opts IndexViewOptions) error
	AddIndexContext(ctx context.Context, name string, opts IndexViewOptions) error
	DropIndex(name string) error
	ListIndexes() []DatasetIndexInfo
	FetchEntities(ids []string) ([]Entity, error)
	SearchIndex(index string, query []float32, opts SearchOptions) ([]SearchResult, error)
	SearchFusion(ctx context.Context, request FusionSearchRequest) (FusionSearchResponse, error)
	Checkpoint(ctx context.Context) error
	Close() error
}

// DatasetWriteResult 描述跨视图实体事务的提交结果。
type DatasetWriteResult struct {
	CommitSequence uint64
	Applied        int
	Committed      bool
	IndexHealthy   bool
}

// DatasetIndexInfo 描述一个已发布的 ANN 视图。
type DatasetIndexInfo struct {
	Name      string
	Embedding string
	Engine    Engine
}

// DatasetStats 返回实体数量以及完整的字段和视图配置。
type DatasetStats struct {
	Name                  string
	EntityCount           int
	CommitSequence        uint64
	MetadataWALBytes      int64
	CheckpointRecommended bool
	IndexBuilding         bool
	Embeddings            map[string]EmbeddingSchema
	Indexes               map[string]IndexViewOptions
}

// Dataset 管理实体真相、命名嵌入和多个物理 ANN 视图。
type Dataset struct {
	name             string
	path             string
	indexDB          *Database
	embeddings       map[string]EmbeddingSchema
	indexes          map[string]IndexViewOptions
	handles          map[string]CollectionAPI
	metas            map[string]json.RawMessage
	sequence         uint64
	mu               sync.RWMutex
	closed           bool
	recoveryRequired bool
	building         bool
	buildDone        chan struct{}
}

var _ DatasetAPI = (*Dataset)(nil)

// datasetIndexBuildHook 仅用于验证构建期间读路径不会被阻塞。
var datasetIndexBuildHook = func() {}

func (d *Dataset) lockForWrite() {
	_ = d.lockForWriteContext(context.Background())
}

func (d *Dataset) lockForWriteContext(ctx context.Context) error {
	if ctx == nil {
		ctx = context.Background()
	}
	for {
		d.mu.Lock()
		if !d.building {
			return nil
		}
		done := d.buildDone
		d.mu.Unlock()
		select {
		case <-done:
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

func (d *Dataset) beginIndexBuild() (chan struct{}, error) {
	return d.beginIndexBuildContext(context.Background())
}

func (d *Dataset) beginIndexBuildContext(ctx context.Context) (chan struct{}, error) {
	if ctx == nil {
		ctx = context.Background()
	}
	for {
		d.mu.Lock()
		if d.building {
			done := d.buildDone
			d.mu.Unlock()
			select {
			case <-done:
			case <-ctx.Done():
				return nil, ctx.Err()
			}
			continue
		}
		if d.closed {
			d.mu.Unlock()
			return nil, ErrCollectionClosed
		}
		if d.recoveryRequired {
			d.mu.Unlock()
			return nil, ErrIndexRecoveryRequired
		}
		d.building = true
		d.buildDone = make(chan struct{})
		done := d.buildDone
		d.mu.Unlock()
		return done, nil
	}
}

func (d *Dataset) endIndexBuild(done chan struct{}) {
	d.mu.Lock()
	if d.building && d.buildDone == done {
		d.building = false
		d.buildDone = nil
		close(done)
	}
	d.mu.Unlock()
}

func (d *Dataset) Name() string { return d.name }

// Stats 返回不会与内部状态共享 map 或配置指针的数据集描述。
func (d *Dataset) Stats() DatasetStats {
	d.mu.RLock()
	defer d.mu.RUnlock()
	walBytes := datasetMetaWALSize(d.path)
	return DatasetStats{
		Name: d.name, EntityCount: len(d.metas), CommitSequence: d.sequence,
		MetadataWALBytes:      walBytes,
		CheckpointRecommended: walBytes >= datasetMetaWALCheckpointBytes,
		IndexBuilding:         d.building,
		Embeddings:            cloneEmbeddingSchemas(d.embeddings), Indexes: cloneIndexViews(d.indexes),
	}
}

// ListIndexes 按名称返回所有已发布的索引视图。
func (d *Dataset) ListIndexes() []DatasetIndexInfo {
	d.mu.RLock()
	defer d.mu.RUnlock()
	indexes := make([]DatasetIndexInfo, 0, len(d.indexes))
	for name, view := range d.indexes {
		indexes = append(indexes, DatasetIndexInfo{Name: name, Embedding: view.Embedding, Engine: view.Engine})
	}
	sort.Slice(indexes, func(i, j int) bool { return indexes[i].Name < indexes[j].Name })
	return indexes
}

// FetchEntities 从每个字段的一个现有视图读取实体向量。
func (d *Dataset) FetchEntities(ids []string) ([]Entity, error) {
	d.mu.RLock()
	defer d.mu.RUnlock()
	if d.closed {
		return nil, ErrCollectionClosed
	}
	if d.recoveryRequired {
		return nil, ErrIndexRecoveryRequired
	}
	result := make([]Entity, 0, len(ids))
	for _, id := range ids {
		entity := Entity{ID: id, Meta: append(json.RawMessage(nil), d.metas[id]...), Embeddings: make(map[string][]float32)}
		for embedding := range d.embeddings {
			for indexName, view := range d.indexes {
				if view.Embedding != embedding {
					continue
				}
				points, err := d.handles[indexName].FetchPoints([]string{id})
				if err != nil {
					return nil, err
				}
				if len(points) > 0 {
					entity.Embeddings[embedding] = points[0].Vector
				}
				break
			}
		}
		if len(entity.Embeddings) > 0 {
			result = append(result, entity)
		}
	}
	return result, nil
}

// SearchIndex 查询指定的物理索引视图，并注入中央实体 meta。
func (d *Dataset) SearchIndex(index string, query []float32, opts SearchOptions) ([]SearchResult, error) {
	d.mu.RLock()
	defer d.mu.RUnlock()
	if d.closed {
		return nil, ErrCollectionClosed
	}
	if d.recoveryRequired {
		return nil, ErrIndexRecoveryRequired
	}
	handle := d.handles[index]
	if handle == nil {
		return nil, fmt.Errorf("%w: %s", ErrIndexViewNotFound, index)
	}
	requestedTopK := opts.TopK
	if requestedTopK < 1 {
		requestedTopK = 10
	}
	searchOptions := opts
	if opts.GroupBy != "" {
		multiplier := opts.CandidateMultiplier
		if multiplier < 1 {
			multiplier = 4
		}
		searchOptions.TopK = requestedTopK * multiplier
		searchOptions.GroupBy = ""
		searchOptions.MaxPerGroup = 0
	}
	results, err := handle.Search(query, searchOptions)
	if err != nil {
		return nil, err
	}
	for resultIndex := range results {
		meta := d.metas[results[resultIndex].ID]
		results[resultIndex].Meta = append(json.RawMessage(nil), meta...)
	}
	if opts.GroupBy != "" {
		maxPerGroup := opts.MaxPerGroup
		if maxPerGroup < 1 {
			maxPerGroup = 1
		}
		groupPath := strings.Split(opts.GroupBy, ".")
		groupCounts := make(map[string]int)
		filtered := results[:0]
		for _, result := range results {
			group := searchResultGroup(result, groupPath)
			if groupCounts[group] >= maxPerGroup {
				continue
			}
			groupCounts[group]++
			filtered = append(filtered, result)
			if len(filtered) == requestedTopK {
				break
			}
		}
		results = filtered
	}
	return results, nil
}

// SearchFusion 并行执行显式来源查询，并按实体 ID 应用加权 RRF。
func (d *Dataset) SearchFusion(ctx context.Context, request FusionSearchRequest) (FusionSearchResponse, error) {
	if ctx == nil {
		ctx = context.Background()
	}
	if request.TopK < 1 || len(request.Queries) == 0 {
		return FusionSearchResponse{}, ErrFusionQueryInvalid
	}
	rrfConstant := request.RRFConstant
	if rrfConstant == 0 {
		rrfConstant = DefaultRRFConstant
	}
	if rrfConstant < 0 {
		return FusionSearchResponse{}, ErrFusionQueryInvalid
	}

	type sourceResult struct {
		query     FusionQuery
		embedding string
		results   []SearchResult
		err       error
	}
	sources := make([]sourceResult, len(request.Queries))
	for queryIndex := range request.Queries {
		query := request.Queries[queryIndex]
		if query.Index == "" || query.Weight < 0 {
			return FusionSearchResponse{}, ErrFusionQueryInvalid
		}
		if query.Weight == 0 {
			query.Weight = 1
		}
		if query.Options.TopK < 1 {
			query.Options.TopK = request.TopK * 4
			if query.Options.TopK < request.TopK {
				query.Options.TopK = request.TopK
			}
		}
		d.mu.RLock()
		view, exists := d.indexes[query.Index]
		d.mu.RUnlock()
		if !exists {
			return FusionSearchResponse{}, fmt.Errorf("%w: %s", ErrIndexViewNotFound, query.Index)
		}
		sources[queryIndex].query = query
		sources[queryIndex].embedding = view.Embedding
	}
	var wait sync.WaitGroup
	for queryIndex := range sources {
		queryIndex := queryIndex
		query := sources[queryIndex].query
		wait.Add(1)
		go func() {
			defer wait.Done()
			if err := ctx.Err(); err != nil {
				sources[queryIndex].err = err
				return
			}
			sources[queryIndex].results, sources[queryIndex].err = d.SearchIndex(query.Index, query.Vector, query.Options)
		}()
	}
	wait.Wait()

	response := FusionSearchResponse{}
	for _, source := range sources {
		if source.err == nil {
			continue
		}
		response.Failures = append(response.Failures, FusionFailure{Index: source.query.Index, Error: source.err.Error()})
		if !request.AllowPartial {
			return response, fmt.Errorf("fusion source %q: %w", source.query.Index, source.err)
		}
	}

	byID := make(map[string]*FusedSearchResult)
	for _, source := range sources {
		if source.err != nil {
			continue
		}
		for resultIndex, result := range source.results {
			rank := resultIndex + 1
			fused := byID[result.ID]
			if fused == nil {
				fused = &FusedSearchResult{ID: result.ID, Meta: append(json.RawMessage(nil), result.Meta...)}
				byID[result.ID] = fused
			}
			fused.Score += source.query.Weight / float64(rrfConstant+rank)
			fused.Sources = append(fused.Sources, FusionSource{
				Index: source.query.Index, Embedding: source.embedding, Rank: rank,
				Score: result.Score, Distance: result.Distance, Weight: source.query.Weight,
			})
		}
	}
	response.Results = make([]FusedSearchResult, 0, len(byID))
	for _, result := range byID {
		response.Results = append(response.Results, *result)
	}
	sort.Slice(response.Results, func(i, j int) bool {
		if response.Results[i].Score == response.Results[j].Score {
			return response.Results[i].ID < response.Results[j].ID
		}
		return response.Results[i].Score > response.Results[j].Score
	})
	if len(response.Results) > request.TopK {
		response.Results = response.Results[:request.TopK]
	}
	if response.Results == nil {
		response.Results = []FusedSearchResult{}
	}
	return response, nil
}

// Checkpoint 将增量 meta WAL 合并为新的实体快照。
func (d *Dataset) Checkpoint(ctx context.Context) error {
	if ctx == nil {
		ctx = context.Background()
	}
	if err := ctx.Err(); err != nil {
		return err
	}
	if err := d.lockForWriteContext(ctx); err != nil {
		return err
	}
	defer d.mu.Unlock()
	if d.closed {
		return ErrCollectionClosed
	}
	if d.recoveryRequired {
		return ErrIndexRecoveryRequired
	}
	return d.checkpointMetadataLocked()
}

func (d *Dataset) checkpointMetadataLocked() error {
	if datasetMetaWALSize(d.path) == 0 {
		return nil
	}
	return checkpointDatasetMetadata(d.path, d.sequence, d.metas)
}

// Close 关闭数据集拥有的全部物理索引。
func (d *Dataset) Close() error {
	d.lockForWrite()
	if d.closed {
		d.mu.Unlock()
		return nil
	}
	d.closed = true
	var checkpointErr error
	if !d.recoveryRequired {
		checkpointErr = d.checkpointMetadataLocked()
	}
	d.mu.Unlock()
	closeErr := d.indexDB.Close()
	if checkpointErr != nil {
		return checkpointErr
	}
	return closeErr
}

func datasetPhysicalName(name string) string {
	return base64.RawURLEncoding.EncodeToString([]byte(name))
}

func indexPhysicalName(name string) string {
	return "index-" + datasetPhysicalName(name)
}
