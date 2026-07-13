package vectordb

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"

	"github.com/vmihailenco/msgpack/v5"
)

type datasetTransaction struct {
	Sequence uint64   `msgpack:"sequence"`
	Upserts  []Entity `msgpack:"upserts,omitempty"`
	Deletes  []string `msgpack:"deletes,omitempty"`
}

// UpsertEntities 以替换语义将实体同步写入其所有索引视图。
func (d *Dataset) UpsertEntities(ctx context.Context, entities []Entity, opts WriteOptions) (DatasetWriteResult, error) {
	if ctx == nil {
		ctx = context.Background()
	}
	if len(entities) == 0 {
		return DatasetWriteResult{}, ErrInvalidWriteBatch
	}
	if err := validateDatasetWriteOptions(opts); err != nil {
		return DatasetWriteResult{}, err
	}
	if err := d.lockForWriteContext(ctx); err != nil {
		return DatasetWriteResult{}, err
	}
	defer d.mu.Unlock()
	if d.closed {
		return DatasetWriteResult{}, ErrCollectionClosed
	}
	if err := d.recoverPendingLocked(); err != nil {
		return DatasetWriteResult{}, err
	}
	if err := validateDatasetEntities(d.embeddings, entities); err != nil {
		return DatasetWriteResult{}, err
	}
	transaction := datasetTransaction{Sequence: d.sequence + 1, Upserts: cloneEntities(entities)}
	if err := saveDatasetTransaction(d.path, transaction); err != nil {
		return DatasetWriteResult{IndexHealthy: true}, err
	}
	if err := d.applyTransactionLocked(ctx, transaction, opts); err != nil {
		d.recoveryRequired = true
		return DatasetWriteResult{CommitSequence: transaction.Sequence, Committed: true, IndexHealthy: false},
			fmt.Errorf("%w: dataset transaction %d requires recovery: %v", ErrIndexRecoveryRequired, transaction.Sequence, err)
	}
	return DatasetWriteResult{CommitSequence: transaction.Sequence, Applied: len(entities), Committed: true, IndexHealthy: true}, nil
}

// DeleteEntities 从实体真相和所有索引视图中同步删除 ID。
func (d *Dataset) DeleteEntities(ctx context.Context, ids []string, opts WriteOptions) (DatasetWriteResult, error) {
	if ctx == nil {
		ctx = context.Background()
	}
	if len(ids) == 0 {
		return DatasetWriteResult{}, ErrInvalidWriteBatch
	}
	if err := validateDatasetWriteOptions(opts); err != nil {
		return DatasetWriteResult{}, err
	}
	for _, id := range ids {
		if id == "" {
			return DatasetWriteResult{}, ErrPointIDInvalid
		}
	}
	if err := d.lockForWriteContext(ctx); err != nil {
		return DatasetWriteResult{}, err
	}
	defer d.mu.Unlock()
	if d.closed {
		return DatasetWriteResult{}, ErrCollectionClosed
	}
	if err := d.recoverPendingLocked(); err != nil {
		return DatasetWriteResult{}, err
	}
	transaction := datasetTransaction{Sequence: d.sequence + 1, Deletes: append([]string(nil), ids...)}
	if err := saveDatasetTransaction(d.path, transaction); err != nil {
		return DatasetWriteResult{IndexHealthy: true}, err
	}
	if err := d.applyTransactionLocked(ctx, transaction, opts); err != nil {
		d.recoveryRequired = true
		return DatasetWriteResult{CommitSequence: transaction.Sequence, Committed: true, IndexHealthy: false},
			fmt.Errorf("%w: dataset transaction %d requires recovery: %v", ErrIndexRecoveryRequired, transaction.Sequence, err)
	}
	return DatasetWriteResult{CommitSequence: transaction.Sequence, Applied: len(ids), Committed: true, IndexHealthy: true}, nil
}

func (d *Dataset) applyTransactionLocked(ctx context.Context, transaction datasetTransaction, opts WriteOptions) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if transaction.Sequence == 0 || transaction.Sequence < d.sequence || transaction.Sequence > d.sequence+1 {
		return fmt.Errorf("%w: invalid pending dataset transaction sequence %d after %d", ErrStorageCorrupted, transaction.Sequence, d.sequence)
	}
	for indexName, view := range d.indexes {
		if datasetCollectionAppliedSequence(d.handles[indexName], d.indexSequenceBases[indexName]) >= transaction.Sequence {
			continue
		}
		operations := make([]WriteOperation, 0, len(transaction.Upserts)+len(transaction.Deletes))
		for _, entity := range transaction.Upserts {
			vector, exists := entity.Embeddings[view.Embedding]
			if exists {
				point := Point{ID: entity.ID, Vector: vector}
				operations = append(operations, WriteOperation{Point: &point})
			} else {
				operations = append(operations, WriteOperation{DeleteID: entity.ID})
			}
		}
		for _, id := range transaction.Deletes {
			operations = append(operations, WriteOperation{DeleteID: id})
		}
		if len(operations) == 0 {
			continue
		}
		if _, err := d.handles[indexName].Write(ctx, WriteBatch{Operations: operations}, opts); err != nil {
			return fmt.Errorf("apply dataset transaction to index %q: %w", indexName, err)
		}
	}
	if d.sequence < transaction.Sequence {
		if err := appendDatasetMetaWAL(d.path, transaction.Sequence, transaction.Upserts, transaction.Deletes); err != nil {
			return err
		}
	}
	for _, entity := range transaction.Upserts {
		d.metas[entity.ID] = append(d.metas[entity.ID][:0], entity.Meta...)
	}
	for _, id := range transaction.Deletes {
		delete(d.metas, id)
	}
	d.sequence = transaction.Sequence
	if datasetMetaWALSize(d.path) >= datasetMetaWALCheckpointBytes {
		if err := checkpointDatasetMetadata(d.path, d.sequence, d.metas); err != nil {
			return err
		}
	}
	if err := removeDatasetTransaction(d.path); err != nil {
		return err
	}
	d.recoveryRequired = false
	return nil
}

func datasetCollectionAppliedSequence(handle CollectionAPI, base uint64) uint64 {
	if typed, ok := handle.(*CollectionHandle); ok {
		sequence := collectionCommitSequence(typed.col)
		if sequence > ^uint64(0)-base {
			return ^uint64(0)
		}
		return base + sequence
	}
	return 0
}

func (d *Dataset) recoverPendingLocked() error {
	transaction, exists, err := loadDatasetTransaction(d.path)
	if err != nil {
		return err
	}
	if !exists {
		d.recoveryRequired = false
		return nil
	}
	if transaction.Sequence == 0 {
		transaction.Sequence = d.sequence + 1
	}
	if err := d.applyTransactionLocked(context.Background(), transaction, WriteOptions{Durability: DurabilitySync}); err != nil {
		return fmt.Errorf("%w: dataset transaction recovery failed: %v", ErrIndexRecoveryRequired, err)
	}
	return nil
}

// AddIndex 从同字段现有视图读取向量并原子发布新 ANN 视图。
func (d *Dataset) AddIndex(name string, opts IndexViewOptions) error {
	return d.AddIndexContext(context.Background(), name, opts)
}

// AddIndexContext 支持在等待其他构建或开始构建前取消新增索引。
func (d *Dataset) AddIndexContext(ctx context.Context, name string, opts IndexViewOptions) error {
	if ctx == nil {
		ctx = context.Background()
	}
	done, err := d.beginIndexBuildContext(ctx)
	if err != nil {
		return err
	}
	defer d.endIndexBuild(done)
	if err := ctx.Err(); err != nil {
		return err
	}
	datasetIndexBuildHook()

	d.mu.RLock()
	if name == "" {
		d.mu.RUnlock()
		return ErrDatasetInvalid
	}
	if _, exists := d.indexes[name]; exists {
		d.mu.RUnlock()
		return fmt.Errorf("%w: %s", ErrDatasetExists, name)
	}
	schema, exists := d.embeddings[opts.Embedding]
	if !exists {
		d.mu.RUnlock()
		return fmt.Errorf("%w: embedding %q", ErrDatasetInvalid, opts.Embedding)
	}
	if opts.Engine == "" {
		opts.Engine = EngineHNSW
	}
	if opts.Engine != EngineHNSW && opts.Engine != EngineDiskVamana {
		d.mu.RUnlock()
		return fmt.Errorf("%w: %s", ErrUnsupportedEngine, opts.Engine)
	}
	var source CollectionAPI
	for indexName, view := range d.indexes {
		if view.Embedding == opts.Embedding {
			candidate := d.handles[indexName]
			if source == nil || source.Engine() != EngineHNSW && candidate.Engine() == EngineHNSW {
				source = candidate
			}
		}
	}
	if source == nil {
		d.mu.RUnlock()
		return fmt.Errorf("%w: no source index for embedding %q", ErrIndexViewNotFound, opts.Embedding)
	}
	ids := make([]string, 0, len(d.metas))
	for id := range d.metas {
		ids = append(ids, id)
	}
	d.mu.RUnlock()
	if err := ctx.Err(); err != nil {
		return err
	}
	physicalName := indexPhysicalName(name)
	if _, openErr := d.indexDB.OpenCollection(physicalName); openErr == nil {
		if err := d.indexDB.DeleteCollection(physicalName); err != nil {
			return fmt.Errorf("remove unpublished index view %q: %w", name, err)
		}
	} else if !errors.Is(openErr, ErrCollectionNotFound) {
		return openErr
	}
	var handle CollectionAPI
	if opts.Engine == EngineHNSW {
		handle, err = d.buildHNSWIndexView(ctx, physicalName, schema, opts, source, ids)
	} else {
		points, fetchErr := fetchDatasetIndexBuildPoints(ctx, source, ids)
		if fetchErr != nil {
			return fetchErr
		}
		handle, err = d.indexDB.CreateCollectionWithOptions(physicalName, CollectionOptions{
			Engine: opts.Engine, Dimension: schema.Dimension, DistanceMetric: schema.DistanceMetric,
			Points: points, DiskBuildConfig: opts.DiskBuildConfig, HNSWConfig: opts.HNSWConfig,
		})
	}
	if err != nil {
		return err
	}
	clonedOption := cloneIndexViews(map[string]IndexViewOptions{name: opts})
	d.mu.Lock()
	newIndexes := cloneIndexViews(d.indexes)
	newIndexes[name] = clonedOption[name]
	newSequenceBases := cloneDatasetSequenceBases(d.indexSequenceBases)
	newSequenceBases[name] = d.sequence
	manifest := datasetManifest{
		FormatMajor: CurrentFormatMajor, FormatMinor: CurrentFormatMinor, Name: d.name,
		Embeddings: cloneEmbeddingSchemas(d.embeddings), Indexes: newIndexes, IndexSequenceBases: newSequenceBases,
	}
	published, publishErr := publishDatasetManifest(d.path, manifest)
	if !published {
		d.mu.Unlock()
		_ = d.indexDB.DeleteCollection(physicalName)
		return publishErr
	}
	d.indexes = newIndexes
	d.indexSequenceBases = newSequenceBases
	d.handles[name] = handle
	d.mu.Unlock()
	return publishErr
}

const datasetHNSWBuildBatchBytes = 8 << 20

var datasetHNSWBuildMaxBatchPoints = 4096

func fetchDatasetIndexBuildPoints(ctx context.Context, source CollectionAPI, ids []string) ([]Point, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	datasetIndexBuildFetchHook(len(ids))
	return source.FetchPoints(ids)
}

func (d *Dataset) buildHNSWIndexView(
	ctx context.Context,
	physicalName string,
	schema EmbeddingSchema,
	opts IndexViewOptions,
	source CollectionAPI,
	ids []string,
) (CollectionAPI, error) {
	batchSize := datasetHNSWIndexBuildBatchSize(schema.Dimension)
	var sums []float64
	var count uint64
	if sourceHandle, ok := source.(*CollectionHandle); ok {
		if sourceCollection, ok := sourceHandle.col.(*Collection); ok {
			sums, count = sourceCollection.Store.bbqCentroidSums()
		}
	}
	if sums == nil {
		sums = make([]float64, schema.Dimension)
		for offset := 0; offset < len(ids); offset += batchSize {
			end := min(offset+batchSize, len(ids))
			points, err := fetchDatasetIndexBuildPoints(ctx, source, ids[offset:end])
			if err != nil {
				return nil, err
			}
			for _, point := range points {
				for dimension, value := range point.Vector {
					sums[dimension] += float64(value)
				}
				count++
			}
		}
	}
	handle, err := d.indexDB.CreateCollectionWithOptions(physicalName, CollectionOptions{
		Engine: EngineHNSW, Dimension: schema.Dimension, DistanceMetric: schema.DistanceMetric,
		HNSWConfig: opts.HNSWConfig, skipInitialSave: true,
	})
	if err != nil {
		return nil, err
	}
	success := false
	defer func() {
		if !success {
			_ = d.indexDB.DeleteCollection(physicalName)
		}
	}()
	collection := handle.(*CollectionHandle).col.(*Collection)
	if count > 0 {
		if err := collection.Store.trainBBQCentroidFromSums(sums, count); err != nil {
			return nil, err
		}
	}
	inserted := uint64(0)
	for offset := 0; offset < len(ids); offset += batchSize {
		end := min(offset+batchSize, len(ids))
		points, err := fetchDatasetIndexBuildPoints(ctx, source, ids[offset:end])
		if err != nil {
			return nil, err
		}
		for _, point := range points {
			if err := collection.insertPreparedPoint(point); err != nil {
				return nil, err
			}
			inserted++
		}
	}
	if inserted != count {
		return nil, fmt.Errorf("%w: HNSW source changed during index build", ErrStorageCorrupted)
	}
	if err := SaveCollection(collection, d.indexDB.Path); err != nil {
		return nil, err
	}
	success = true
	return handle, nil
}

func datasetHNSWIndexBuildBatchSize(dimension int) int {
	batchSize := datasetHNSWBuildMaxBatchPoints
	if batchSize < 1 {
		batchSize = 1
	}
	if dimension > datasetHNSWBuildBatchBytes/4 {
		return 1
	}
	if byBytes := datasetHNSWBuildBatchBytes / (dimension * 4); byBytes < batchSize {
		return max(1, byBytes)
	}
	return batchSize
}

// DropIndex 删除一个视图，但拒绝删除嵌入字段的最后一个视图。
func (d *Dataset) DropIndex(name string) error {
	d.lockForWrite()
	defer d.mu.Unlock()
	if d.closed {
		return ErrCollectionClosed
	}
	view, exists := d.indexes[name]
	if !exists {
		return fmt.Errorf("%w: %s", ErrIndexViewNotFound, name)
	}
	count := 0
	for _, candidate := range d.indexes {
		if candidate.Embedding == view.Embedding {
			count++
		}
	}
	if count == 1 {
		return fmt.Errorf("%w: embedding %q must retain an index view", ErrDatasetInvalid, view.Embedding)
	}
	newIndexes := cloneIndexViews(d.indexes)
	delete(newIndexes, name)
	newSequenceBases := cloneDatasetSequenceBases(d.indexSequenceBases)
	delete(newSequenceBases, name)
	published, publishErr := publishDatasetManifest(d.path, datasetManifest{
		FormatMajor: CurrentFormatMajor, FormatMinor: CurrentFormatMinor, Name: d.name,
		Embeddings: d.embeddings, Indexes: newIndexes, IndexSequenceBases: newSequenceBases,
	})
	if !published {
		return publishErr
	}
	d.indexes = newIndexes
	d.indexSequenceBases = newSequenceBases
	delete(d.handles, name)
	deleteErr := d.indexDB.DeleteCollection(indexPhysicalName(name))
	return errors.Join(publishErr, deleteErr)
}

func cloneDatasetSequenceBases(input map[string]uint64) map[string]uint64 {
	output := make(map[string]uint64, len(input))
	for name, sequence := range input {
		output[name] = sequence
	}
	return output
}

func validateDatasetEntities(schemas map[string]EmbeddingSchema, entities []Entity) error {
	seen := make(map[string]struct{}, len(entities))
	for _, entity := range entities {
		if entity.ID == "" {
			return ErrPointIDInvalid
		}
		if _, exists := seen[entity.ID]; exists {
			return fmt.Errorf("%w: duplicate entity %q", ErrDatasetInvalid, entity.ID)
		}
		seen[entity.ID] = struct{}{}
		if len(entity.Embeddings) == 0 {
			return fmt.Errorf("%w: entity %q has no embeddings", ErrDatasetInvalid, entity.ID)
		}
		for name, vector := range entity.Embeddings {
			schema, exists := schemas[name]
			if !exists || len(vector) != schema.Dimension {
				return fmt.Errorf("%w: entity %q embedding %q", ErrVectorDimensionInvalid, entity.ID, name)
			}
			if _, err := prepareVectorForMetric(vector, schema.DistanceMetric); err != nil {
				return err
			}
		}
	}
	return nil
}

func validateDatasetWriteOptions(opts WriteOptions) error {
	if opts.Durability == "" || opts.Durability == DurabilitySync {
		return nil
	}
	return fmt.Errorf("%w: dataset transactions require %s", ErrUnsupportedDurability, DurabilitySync)
}

func cloneEntities(entities []Entity) []Entity {
	result := make([]Entity, len(entities))
	for index, entity := range entities {
		result[index] = Entity{ID: entity.ID, Meta: append([]byte(nil), entity.Meta...), Embeddings: make(map[string][]float32, len(entity.Embeddings))}
		for name, vector := range entity.Embeddings {
			result[index].Embeddings[name] = append([]float32(nil), vector...)
		}
	}
	return result
}

func saveDatasetTransaction(path string, transaction datasetTransaction) error {
	data, err := msgpack.Marshal(&transaction)
	if err != nil {
		return err
	}
	return atomicWriteFile(filepath.Join(path, datasetTransactionName), data)
}

func loadDatasetTransaction(path string) (datasetTransaction, bool, error) {
	data, err := os.ReadFile(filepath.Join(path, datasetTransactionName))
	if os.IsNotExist(err) {
		return datasetTransaction{}, false, nil
	}
	if err != nil {
		return datasetTransaction{}, false, err
	}
	var transaction datasetTransaction
	if err := msgpack.Unmarshal(data, &transaction); err != nil {
		return datasetTransaction{}, false, fmt.Errorf("%w: decode dataset transaction: %v", ErrStorageCorrupted, err)
	}
	return transaction, true, nil
}

func removeDatasetTransaction(path string) error {
	err := os.Remove(filepath.Join(path, datasetTransactionName))
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		return err
	}
	return syncParentDirectory(filepath.Join(path, datasetTransactionName))
}
