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
	d.lockForWrite()
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
	d.lockForWrite()
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
	done, err := d.beginIndexBuild()
	if err != nil {
		return err
	}
	defer d.endIndexBuild(done)
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
			source = d.handles[indexName]
			break
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
	points, err := source.FetchPoints(ids)
	if err != nil {
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
	handle, err := d.indexDB.CreateCollectionWithOptions(physicalName, CollectionOptions{
		Engine: opts.Engine, Dimension: schema.Dimension, DistanceMetric: schema.DistanceMetric,
		Points: points, DiskBuildConfig: opts.DiskBuildConfig, HNSWConfig: opts.HNSWConfig,
	})
	if err != nil {
		return err
	}
	clonedOption := cloneIndexViews(map[string]IndexViewOptions{name: opts})
	d.mu.Lock()
	newIndexes := cloneIndexViews(d.indexes)
	newIndexes[name] = clonedOption[name]
	manifest := datasetManifest{FormatMajor: CurrentFormatMajor, FormatMinor: CurrentFormatMinor, Name: d.name, Embeddings: cloneEmbeddingSchemas(d.embeddings), Indexes: newIndexes}
	if err := saveDatasetManifest(d.path, manifest); err != nil {
		d.mu.Unlock()
		_ = d.indexDB.DeleteCollection(physicalName)
		return err
	}
	d.indexes = newIndexes
	d.handles[name] = handle
	d.mu.Unlock()
	return nil
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
	if err := saveDatasetManifest(d.path, datasetManifest{FormatMajor: CurrentFormatMajor, FormatMinor: CurrentFormatMinor, Name: d.name, Embeddings: d.embeddings, Indexes: newIndexes}); err != nil {
		return err
	}
	d.indexes = newIndexes
	delete(d.handles, name)
	if err := d.indexDB.DeleteCollection(indexPhysicalName(name)); err != nil {
		return err
	}
	return nil
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
