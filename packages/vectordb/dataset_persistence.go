package vectordb

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/vmihailenco/msgpack/v5"
)

const (
	datasetsDirectoryName  = ".datasets"
	datasetManifestName    = "manifest.msgpack"
	datasetStateName       = "entities.msgpack"
	datasetIndexesName     = "indexes"
	datasetTransactionName = "pending.msgpack"
	datasetDeletePrefix    = ".delete-"
)

type datasetManifest struct {
	FormatMajor uint32                      `msgpack:"formatMajor"`
	FormatMinor uint32                      `msgpack:"formatMinor"`
	Name        string                      `msgpack:"name"`
	Embeddings  map[string]EmbeddingSchema  `msgpack:"embeddings"`
	Indexes     map[string]IndexViewOptions `msgpack:"indexes"`
}

type datasetState struct {
	Metas map[string]json.RawMessage `msgpack:"metas"`
}

// CreateDataset 原子发布一个包含多个嵌入字段和索引视图的数据集。
func (db *Database) CreateDataset(name string, opts DatasetOptions) (DatasetAPI, error) {
	if err := db.ensureDatabaseLock(); err != nil {
		return nil, err
	}
	opts.Embeddings = cloneEmbeddingSchemas(opts.Embeddings)
	for embedding, schema := range opts.Embeddings {
		if schema.DistanceMetric == "" {
			schema.DistanceMetric = "cosine"
			opts.Embeddings[embedding] = schema
		}
	}
	opts.Indexes = cloneIndexViews(opts.Indexes)
	opts.Entities = cloneEntities(opts.Entities)
	if err := validateDatasetOptions(name, opts); err != nil {
		return nil, err
	}
	db.mu.Lock()
	if db.Datasets[name] != nil || db.datasetsCreating[name] {
		db.mu.Unlock()
		return nil, fmt.Errorf("%w: %s", ErrDatasetExists, name)
	}
	db.datasetsCreating[name] = true
	db.mu.Unlock()
	registered := false
	defer func() {
		if !registered {
			db.mu.Lock()
			delete(db.datasetsCreating, name)
			db.mu.Unlock()
		}
	}()

	path := filepath.Join(db.Path, datasetsDirectoryName, datasetPhysicalName(name))
	if _, err := os.Stat(filepath.Join(path, datasetManifestName)); err == nil {
		return nil, fmt.Errorf("%w: %s", ErrDatasetExists, name)
	} else if !os.IsNotExist(err) {
		return nil, err
	}
	if _, err := os.Stat(path); err == nil {
		if err := os.RemoveAll(path); err != nil {
			return nil, err
		}
	} else if !os.IsNotExist(err) {
		return nil, err
	}
	if err := os.MkdirAll(filepath.Join(path, datasetIndexesName), 0755); err != nil {
		return nil, err
	}
	indexDB, err := Open(filepath.Join(path, datasetIndexesName))
	if err != nil {
		return nil, err
	}
	dataset := &Dataset{
		name: name, path: path, indexDB: indexDB, embeddings: opts.Embeddings,
		indexes: opts.Indexes, handles: make(map[string]CollectionAPI, len(opts.Indexes)),
		metas: make(map[string]json.RawMessage, len(opts.Entities)),
	}
	success := false
	defer func() {
		if !success {
			_ = indexDB.Close()
		}
	}()

	for indexName, view := range opts.Indexes {
		points := pointsForEmbedding(opts.Entities, view.Embedding)
		schema := opts.Embeddings[view.Embedding]
		handle, createErr := indexDB.CreateCollectionWithOptions(indexPhysicalName(indexName), CollectionOptions{
			Engine: view.Engine, Dimension: schema.Dimension, Points: points,
			DistanceMetric: schema.DistanceMetric, DiskBuildConfig: view.DiskBuildConfig, HNSWConfig: view.HNSWConfig,
		})
		if createErr != nil {
			return nil, fmt.Errorf("create index view %q: %w", indexName, createErr)
		}
		dataset.handles[indexName] = handle
	}
	for _, entity := range opts.Entities {
		dataset.metas[entity.ID] = append(json.RawMessage(nil), entity.Meta...)
	}
	if err := saveDatasetState(path, dataset.metas); err != nil {
		return nil, err
	}
	if err := saveDatasetManifest(path, datasetManifest{
		FormatMajor: CurrentFormatMajor, FormatMinor: CurrentFormatMinor, Name: name,
		Embeddings: dataset.embeddings, Indexes: dataset.indexes,
	}); err != nil {
		return nil, err
	}
	db.mu.Lock()
	db.Datasets[name] = dataset
	delete(db.datasetsCreating, name)
	db.mu.Unlock()
	registered = true
	success = true
	return dataset, nil
}

// OpenDataset 返回已经由 Open 验证和恢复的数据集。
func (db *Database) OpenDataset(name string) (DatasetAPI, error) {
	if err := db.ensureDatabaseLock(); err != nil {
		return nil, err
	}
	db.mu.RLock()
	dataset := db.Datasets[name]
	db.mu.RUnlock()
	if dataset == nil {
		return nil, fmt.Errorf("%w: %s", ErrDatasetNotFound, name)
	}
	return dataset, nil
}

// DeleteDataset 先发布删除意图，再关闭并清理全部物理视图。
func (db *Database) DeleteDataset(name string) error {
	if err := db.ensureDatabaseLock(); err != nil {
		return err
	}
	db.mu.Lock()
	dataset := db.Datasets[name]
	if dataset == nil {
		db.mu.Unlock()
		return fmt.Errorf("%w: %s", ErrDatasetNotFound, name)
	}
	root := filepath.Join(db.Path, datasetsDirectoryName)
	markerPath := filepath.Join(root, datasetDeletePrefix+datasetPhysicalName(name))
	if err := atomicWriteFile(markerPath, []byte(name)); err != nil {
		db.mu.Unlock()
		return err
	}
	delete(db.Datasets, name)
	db.mu.Unlock()
	if err := dataset.Close(); err != nil {
		return err
	}
	if err := os.RemoveAll(dataset.path); err != nil {
		return err
	}
	if err := os.Remove(markerPath); err != nil {
		return err
	}
	return syncParentDirectory(markerPath)
}

func (db *Database) loadDatasets() error {
	root := filepath.Join(db.Path, datasetsDirectoryName)
	entries, err := os.ReadDir(root)
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		return err
	}
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasPrefix(entry.Name(), datasetDeletePrefix) {
			continue
		}
		encodedName := strings.TrimPrefix(entry.Name(), datasetDeletePrefix)
		decodedName, decodeErr := base64.RawURLEncoding.DecodeString(encodedName)
		if decodeErr != nil || len(decodedName) == 0 || datasetPhysicalName(string(decodedName)) != encodedName {
			return fmt.Errorf("%w: invalid dataset deletion marker", ErrStorageCorrupted)
		}
		if err := os.RemoveAll(filepath.Join(root, encodedName)); err != nil {
			return err
		}
		if err := os.Remove(filepath.Join(root, entry.Name())); err != nil {
			return err
		}
		if err := syncParentDirectory(filepath.Join(root, entry.Name())); err != nil {
			return err
		}
	}
	entries, err = os.ReadDir(root)
	if err != nil {
		return err
	}
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		path := filepath.Join(root, entry.Name())
		manifestBytes, readErr := os.ReadFile(filepath.Join(path, datasetManifestName))
		if os.IsNotExist(readErr) {
			continue
		}
		if readErr != nil {
			return readErr
		}
		var manifest datasetManifest
		if err := msgpack.Unmarshal(manifestBytes, &manifest); err != nil {
			return fmt.Errorf("%w: decode dataset manifest: %v", ErrStorageCorrupted, err)
		}
		if entry.Name() != datasetPhysicalName(manifest.Name) {
			return fmt.Errorf("%w: dataset directory does not match manifest name %q", ErrStorageCorrupted, manifest.Name)
		}
		if err := validateDatasetOptions(manifest.Name, DatasetOptions{Embeddings: manifest.Embeddings, Indexes: manifest.Indexes}); err != nil {
			return fmt.Errorf("%w: dataset manifest %q: %v", ErrStorageCorrupted, manifest.Name, err)
		}
		if _, err := CheckFormatCompatibility(manifest.FormatMajor, manifest.FormatMinor, 0, 0); err != nil {
			return err
		}
		stateBytes, err := os.ReadFile(filepath.Join(path, datasetStateName))
		if err != nil {
			return err
		}
		var state datasetState
		if err := msgpack.Unmarshal(stateBytes, &state); err != nil {
			return fmt.Errorf("%w: decode dataset state: %v", ErrStorageCorrupted, err)
		}
		indexDB, err := Open(filepath.Join(path, datasetIndexesName))
		if err != nil {
			return err
		}
		dataset := &Dataset{
			name: manifest.Name, path: path, indexDB: indexDB,
			embeddings: manifest.Embeddings, indexes: manifest.Indexes,
			handles: make(map[string]CollectionAPI, len(manifest.Indexes)), metas: state.Metas,
		}
		if dataset.metas == nil {
			dataset.metas = make(map[string]json.RawMessage)
		}
		for indexName := range manifest.Indexes {
			handle, openErr := indexDB.OpenCollection(indexPhysicalName(indexName))
			if openErr != nil {
				_ = indexDB.Close()
				return fmt.Errorf("open dataset %q index %q: %w", manifest.Name, indexName, openErr)
			}
			dataset.handles[indexName] = handle
		}
		if err := dataset.recoverPendingLocked(); err != nil {
			_ = indexDB.Close()
			return fmt.Errorf("open dataset %q: %w", manifest.Name, err)
		}
		db.Datasets[manifest.Name] = dataset
	}
	return nil
}

func validateDatasetOptions(name string, opts DatasetOptions) error {
	if name == "" || len(opts.Embeddings) == 0 || len(opts.Indexes) == 0 {
		return ErrDatasetInvalid
	}
	covered := make(map[string]bool, len(opts.Embeddings))
	for embedding, schema := range opts.Embeddings {
		if embedding == "" || schema.Dimension < 1 {
			return fmt.Errorf("%w: embedding %q", ErrDatasetInvalid, embedding)
		}
		if _, err := resolveSimilarity(schema.DistanceMetric); err != nil {
			return fmt.Errorf("%w: embedding %q: %v", ErrDatasetInvalid, embedding, err)
		}
	}
	for indexName, view := range opts.Indexes {
		if indexName == "" {
			return ErrDatasetInvalid
		}
		if _, exists := opts.Embeddings[view.Embedding]; !exists {
			return fmt.Errorf("%w: index %q references embedding %q", ErrDatasetInvalid, indexName, view.Embedding)
		}
		if view.Engine == "" {
			view.Engine = EngineHNSW
			opts.Indexes[indexName] = view
		}
		if view.Engine != EngineHNSW && view.Engine != EngineDiskVamana {
			return fmt.Errorf("%w: index %q: %w", ErrDatasetInvalid, indexName, ErrUnsupportedEngine)
		}
		covered[view.Embedding] = true
	}
	for embedding := range opts.Embeddings {
		if !covered[embedding] {
			return fmt.Errorf("%w: embedding %q has no index view", ErrDatasetInvalid, embedding)
		}
	}
	seen := make(map[string]struct{}, len(opts.Entities))
	for _, entity := range opts.Entities {
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
		for embedding, vector := range entity.Embeddings {
			schema, exists := opts.Embeddings[embedding]
			if !exists || len(vector) != schema.Dimension {
				return fmt.Errorf("%w: entity %q embedding %q: %w", ErrDatasetInvalid, entity.ID, embedding, ErrVectorDimensionInvalid)
			}
			if _, err := prepareVectorForMetric(vector, schema.DistanceMetric); err != nil {
				return fmt.Errorf("%w: entity %q embedding %q: %v", ErrDatasetInvalid, entity.ID, embedding, err)
			}
		}
	}
	return nil
}

func pointsForEmbedding(entities []Entity, embedding string) []Point {
	points := make([]Point, 0, len(entities))
	for _, entity := range entities {
		if vector, exists := entity.Embeddings[embedding]; exists {
			points = append(points, Point{ID: entity.ID, Vector: vector})
		}
	}
	return points
}

func saveDatasetManifest(path string, manifest datasetManifest) error {
	data, err := msgpack.Marshal(&manifest)
	if err != nil {
		return err
	}
	return atomicWriteFile(filepath.Join(path, datasetManifestName), data)
}

func saveDatasetState(path string, metas map[string]json.RawMessage) error {
	data, err := msgpack.Marshal(&datasetState{Metas: metas})
	if err != nil {
		return err
	}
	return atomicWriteFile(filepath.Join(path, datasetStateName), data)
}

func cloneEmbeddingSchemas(input map[string]EmbeddingSchema) map[string]EmbeddingSchema {
	output := make(map[string]EmbeddingSchema, len(input))
	for name, schema := range input {
		output[name] = schema
	}
	return output
}

func cloneIndexViews(input map[string]IndexViewOptions) map[string]IndexViewOptions {
	output := make(map[string]IndexViewOptions, len(input))
	for name, view := range input {
		if view.Engine == "" {
			view.Engine = EngineHNSW
		}
		if view.HNSWConfig != nil {
			config := *view.HNSWConfig
			view.HNSWConfig = &config
		}
		if view.DiskBuildConfig != nil {
			config := *view.DiskBuildConfig
			view.DiskBuildConfig = &config
		}
		output[name] = view
	}
	return output
}
