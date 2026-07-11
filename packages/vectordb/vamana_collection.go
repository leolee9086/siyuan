// SiYuan - Refactor your thinking
// Copyright (c) 2020-present, b3log.org
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

package vectordb

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"sync"
	"sync/atomic"

	"github.com/vmihailenco/msgpack/v5"
	"s-forge.local/vectordb/bbq"
	"s-forge.local/vectordb/storage"
	"s-forge.local/vectordb/vamana"
)

// VamanaCollection wraps a disk-resident Vamana index with external ID mapping
// and per-node JSON metadata, providing the same CRUD surface as Collection.
//
// Unlike Collection (HNSW-based, fully in-memory), VamanaCollection is designed
// for large-scale datasets where vectors reside on disk via mmap.
//
// All methods are safe for concurrent use.
type VamanaCollection struct {
	ColName            string
	ColDim             int
	Meta               CollectionMeta
	RootPath           string
	BasePath           string
	Config             vamana.DiskBuildConfig
	WALCheckpointBytes int64
	// LastCommitSequence 是最近一次成功公开提交的线性化序号。
	LastCommitSequence uint64

	Index *vamana.DiskVamanaIndex

	IDMap          map[string]uint64    // external string ID → internal node ID
	DocMap         map[uint64]string    // internal node ID → external string ID
	Metas          map[uint64][]byte    // internal node ID → raw JSON metadata
	PendingVectors map[string][]float32 // vectors inserted after the last durable rebuild

	Mu               sync.RWMutex
	flushMu          sync.Mutex
	walFile          *os.File // 由 flushMu 保护，集合生命周期内复用以降低同步写系统调用开销
	walBytes         int64
	checkpointNeeded atomic.Bool
}

type vamanaCollectionState struct {
	Name               string                 `msgpack:"name"`
	Dimension          int                    `msgpack:"dimension"`
	CommitSequence     uint64                 `msgpack:"commitSequence"`
	Meta               CollectionMeta         `msgpack:"meta"`
	Config             vamana.DiskBuildConfig `msgpack:"config,omitempty"`
	IDMap              map[string]uint64      `msgpack:"idMap"`
	DocMap             map[uint64]string      `msgpack:"docMap"`
	Metas              map[uint64][]byte      `msgpack:"metas"`
	PendingVectors     map[string][]float32   `msgpack:"pendingVectors"`
	WALCheckpointBytes int64                  `msgpack:"walCheckpointBytes,omitempty"`
}

const VamanaStateFileExt = ".ids.msgpack"

const DefaultVamanaCheckpointWALBytes = int64(64 << 20)

// NewVamanaCollection wraps an existing DiskVamanaIndex with ID mapping and metadata.
// The caller is responsible for providing the correct name, dimension, and meta.
func NewVamanaCollection(name string, dimension int, idx *vamana.DiskVamanaIndex, meta CollectionMeta) *VamanaCollection {
	return &VamanaCollection{
		ColName:            name,
		ColDim:             dimension,
		Meta:               meta,
		Config:             vamana.DefaultDiskBuildConfig(),
		Index:              idx,
		IDMap:              make(map[string]uint64),
		DocMap:             make(map[uint64]string),
		Metas:              make(map[uint64][]byte),
		PendingVectors:     make(map[string][]float32),
		WALCheckpointBytes: DefaultVamanaCheckpointWALBytes,
	}
}

// ItemCount returns the number of live (non-deleted) mapped points.
func (vc *VamanaCollection) ItemCount() int {
	vc.Mu.RLock()
	defer vc.Mu.RUnlock()
	return len(vc.IDMap)
}

// GetDocID returns the internal node ID for an external string ID.
func (vc *VamanaCollection) GetDocID(id string) (uint64, bool) {
	vc.Mu.RLock()
	defer vc.Mu.RUnlock()
	nodeID, ok := vc.IDMap[id]
	return nodeID, ok
}

// GetExternalID returns the external string ID for an internal node ID.
func (vc *VamanaCollection) GetExternalID(nodeID uint64) (string, bool) {
	vc.Mu.RLock()
	defer vc.Mu.RUnlock()
	id, ok := vc.DocMap[nodeID]
	return id, ok
}

// GetMeta returns the JSON metadata for an internal node ID.
func (vc *VamanaCollection) GetMeta(nodeID uint64) (json.RawMessage, bool) {
	vc.Mu.RLock()
	defer vc.Mu.RUnlock()
	meta, ok := vc.Metas[nodeID]
	if !ok {
		return nil, false
	}
	return json.RawMessage(meta), true
}

// InsertPoint inserts or updates a point in the Vamana disk index.
//
// For new IDs: calls idx.Insert to allocate a new node, records the mapping.
// For existing IDs: soft-deletes the old node and inserts a new one, updating
// the ID mapping to point to the new node.
func (vc *VamanaCollection) InsertPoint(point Point) error {
	vc.Mu.Lock()
	defer vc.Mu.Unlock()

	oldNodeID, exists := vc.IDMap[point.ID]
	if exists && !vc.Index.IsDeleted(oldNodeID) {
		if err := vc.Index.Delete(oldNodeID); err != nil {
			return err
		}
	}

	nodeID, err := vc.Index.Insert(point.Vector)
	if err != nil {
		return err
	}

	if exists && oldNodeID != nodeID {
		delete(vc.DocMap, oldNodeID)
		delete(vc.Metas, oldNodeID)
	}
	vc.IDMap[point.ID] = nodeID
	vc.DocMap[nodeID] = point.ID
	if len(point.Meta) > 0 {
		metaCopy := make([]byte, len(point.Meta))
		copy(metaCopy, point.Meta)
		vc.Metas[nodeID] = metaCopy
	} else {
		delete(vc.Metas, nodeID)
	}
	vectorCopy := make([]float32, len(point.Vector))
	copy(vectorCopy, point.Vector)
	vc.PendingVectors[point.ID] = vectorCopy

	return nil
}

// Search searches for k nearest neighbors and preserves the legacy no-error API.
func (vc *VamanaCollection) Search(queryVec []float32, k int, efSearch int) []SearchResult {
	results, _ := vc.SearchWithError(queryVec, k, efSearch)
	return results
}

// SearchWithError searches for k nearest neighbors and propagates disk index failures.
func (vc *VamanaCollection) SearchWithError(queryVec []float32, k int, efSearch int) ([]SearchResult, error) {
	vc.Mu.RLock()
	defer vc.Mu.RUnlock()

	rawResults, err := vc.Index.Search(queryVec, k, efSearch)
	if err != nil {
		return nil, classifyPublicError(err)
	}
	if rawResults == nil {
		return []SearchResult{}, nil
	}

	results := make([]SearchResult, 0, len(rawResults))
	for _, r := range rawResults {
		externalID, ok := vc.DocMap[r.ID]
		if !ok {
			continue
		}

		score := vamanaDistanceToScore(r.Distance, vc.Index.DistanceMetric())

		var meta json.RawMessage
		if metaBytes, metaOk := vc.Metas[r.ID]; metaOk {
			meta = json.RawMessage(metaBytes)
		}

		results = append(results, SearchResult{
			ID:       externalID,
			Score:    score,
			Distance: r.Distance,
			Meta:     meta,
		})
	}

	sort.Slice(results, func(i, j int) bool {
		return results[i].Score > results[j].Score
	})

	return results, nil
}

func (vc *VamanaCollection) Engine() Engine { return EngineDiskVamana }

// DeletePoint removes a point and preserves the legacy no-error API.
func (vc *VamanaCollection) DeletePoint(id string) {
	_ = vc.DeletePointWithError(id)
}

// DeletePointWithError removes a point and only updates mappings after the index deletion succeeds.
func (vc *VamanaCollection) DeletePointWithError(id string) error {
	vc.Mu.Lock()
	defer vc.Mu.Unlock()

	nodeID, ok := vc.IDMap[id]
	if !ok {
		return nil
	}
	if !vc.Index.IsDeleted(nodeID) {
		if err := vc.Index.Delete(nodeID); err != nil {
			return classifyPublicError(err)
		}
	}
	delete(vc.IDMap, id)
	delete(vc.DocMap, nodeID)
	delete(vc.Metas, nodeID)
	delete(vc.PendingVectors, id)
	return nil
}

// DeleteItemWithIndex 保留旧名称，委托给 DeletePoint。
func (vc *VamanaCollection) DeleteItemWithIndex(id string) { vc.DeletePoint(id) }

// RebuildIndex 通过原生 Vamana compaction 发布新的 generation。
func (vc *VamanaCollection) RebuildIndex() error {
	_, err := vc.Checkpoint(context.Background())
	return err
}

// vamanaDistanceToScore 将 Vamana 的内部距离转换为 [0,1] 分数，度量感知版。
//
// 与 HNSW 的 distanceToScore 对齐：
//   - cosine:  score = 1.0 - distance/2.0（cosine distance 范围 [0,2]，余弦距离≠余弦相似度）
//   - l2/euclidean: score = 1.0 / (1.0 + distance)
//   - ip: 缩放后映射到 [0, +∞)
func vamanaDistanceToScore(distance float32, metric bbq.SimilarityType) float32 {
	switch metric {
	case bbq.CosineSimilarity:
		s := 1.0 - distance/2.0
		if s < 0 {
			s = 0
		}
		return s
	case bbq.MaxInnerProduct:
		s := 1.0 - distance
		if s < 0 {
			return 1.0 / (1.0 - s)
		}
		return s + 1.0
	default:
		// Euclidean / L2
		if distance < 1e-6 {
			return 1.0
		}
		s := 1.0 / (1.0 + distance)
		if s < 0 {
			s = 0
		}
		if s > 1 {
			s = 1
		}
		return s
	}
}

// BuildVamanaCollection builds a new disk-based Vamana index from a set of
// points and returns a VamanaCollection wrapping it.
//
// BuildFromVectors assigns sequential node IDs (0, 1, 2, ...) in the order
// the vectors are provided. This function records the mapping from external
// string IDs to those sequential node IDs.
//
// basePath is the file path prefix (without extension) for the index files.
func BuildVamanaCollection(
	name string, points []Point, basePath string,
	config vamana.DiskBuildConfig, meta CollectionMeta,
) (*VamanaCollection, error) {
	ensureDiskVamanaReader()

	if len(points) == 0 {
		return nil, nil
	}

	dimension := len(points[0].Vector)

	vectors := make([][]float32, len(points))
	for i, p := range points {
		vectors[i] = p.Vector
	}

	_, err := vamana.BuildFromVectors(basePath, vectors, config)
	if err != nil {
		return nil, err
	}

	idx, err := vamana.Open(basePath)
	if err != nil {
		return nil, err
	}

	vc := NewVamanaCollection(name, dimension, idx, meta)
	vc.RootPath = basePath
	vc.BasePath = basePath
	vc.Config = config

	// BuildFromVectors assigns sequential node IDs in input order.
	for i, p := range points {
		nodeID := uint64(i)
		vc.IDMap[p.ID] = nodeID
		vc.DocMap[nodeID] = p.ID
		if len(p.Meta) > 0 {
			metaCopy := make([]byte, len(p.Meta))
			copy(metaCopy, p.Meta)
			vc.Metas[nodeID] = metaCopy
		}
	}

	return vc, nil
}

// OpenVamanaCollection opens an existing disk-based Vamana index.
//
// ID mapping and metadata must be loaded separately (not yet supported).
func OpenVamanaCollection(name string, rootPath string, meta CollectionMeta) (*VamanaCollection, error) {
	ensureDiskVamanaReader()
	basePath, err := resolveVamanaGeneration(rootPath)
	if err != nil {
		return nil, err
	}
	return openVamanaCollectionGeneration(name, rootPath, basePath, meta)
}

func openVamanaCollectionGeneration(name, rootPath, basePath string, meta CollectionMeta) (*VamanaCollection, error) {
	idx, err := vamana.Open(basePath)
	if err != nil {
		return nil, err
	}

	vc := NewVamanaCollection(name, int(idx.Dimension()), idx, meta)
	vc.RootPath = rootPath
	vc.BasePath = basePath
	if err := LoadVamanaCollectionState(vc, basePath); err != nil {
		_ = idx.Close()
		return nil, err
	}
	if basePath != rootPath {
		manifest, err := readVamanaGenerationManifest(rootPath)
		if err != nil && !os.IsNotExist(err) {
			_ = idx.Close()
			return nil, err
		}
		if err == nil && manifest.Generation == filepath.Base(basePath) && manifest.CommitSequence != vc.LastCommitSequence {
			_ = idx.Close()
			return nil, fmt.Errorf("%w: DiskVamana manifest sequence %d does not match state sequence %d", storage.ErrCorruptedFile, manifest.CommitSequence, vc.LastCommitSequence)
		}
	}
	if err := LoadVamanaWAL(vc); err != nil {
		_ = idx.Close()
		return nil, err
	}
	vc.walBytes = fileSizeOrZero(basePath + VamanaWALFileExt)
	vc.checkpointNeeded.Store(vc.walBytes >= vc.WALCheckpointBytes)
	return vc, nil
}

func SaveVamanaCollectionState(vc *VamanaCollection, basePath string) error {
	vc.Mu.RLock()
	defer vc.Mu.RUnlock()
	return saveVamanaCollectionStateLocked(vc, basePath)
}

func saveVamanaCollectionStateLocked(vc *VamanaCollection, basePath string) error {
	state := vamanaCollectionState{
		Name:               vc.ColName,
		Dimension:          vc.ColDim,
		CommitSequence:     vc.LastCommitSequence,
		Meta:               vc.Meta,
		Config:             vc.Config,
		IDMap:              make(map[string]uint64, len(vc.IDMap)),
		DocMap:             make(map[uint64]string, len(vc.DocMap)),
		Metas:              make(map[uint64][]byte, len(vc.Metas)),
		PendingVectors:     make(map[string][]float32, len(vc.PendingVectors)),
		WALCheckpointBytes: vc.WALCheckpointBytes,
	}
	for id, nodeID := range vc.IDMap {
		state.IDMap[id] = nodeID
	}
	for nodeID, id := range vc.DocMap {
		state.DocMap[nodeID] = id
	}
	for nodeID, meta := range vc.Metas {
		metaCopy := make([]byte, len(meta))
		copy(metaCopy, meta)
		state.Metas[nodeID] = metaCopy
	}
	for id, vec := range vc.PendingVectors {
		vecCopy := make([]float32, len(vec))
		copy(vecCopy, vec)
		state.PendingVectors[id] = vecCopy
	}

	data, err := msgpack.Marshal(&state)
	if err != nil {
		return err
	}
	return atomicWriteFile(basePath+VamanaStateFileExt, data)
}

func LoadVamanaCollectionState(vc *VamanaCollection, basePath string) error {
	data, err := os.ReadFile(basePath + VamanaStateFileExt)
	if err != nil {
		return err
	}

	var state vamanaCollectionState
	if err := msgpack.Unmarshal(data, &state); err != nil {
		return err
	}

	vc.Mu.Lock()
	if state.Name != "" {
		vc.ColName = state.Name
	}
	if state.Dimension > 0 {
		vc.ColDim = state.Dimension
	}
	vc.LastCommitSequence = state.CommitSequence
	vc.Meta = state.Meta
	if state.Config.R > 0 {
		vc.Config = state.Config
	}
	vc.IDMap = state.IDMap
	vc.DocMap = state.DocMap
	vc.Metas = state.Metas
	vc.PendingVectors = state.PendingVectors
	vc.WALCheckpointBytes = state.WALCheckpointBytes
	if vc.WALCheckpointBytes <= 0 {
		vc.WALCheckpointBytes = DefaultVamanaCheckpointWALBytes
	}
	if vc.IDMap == nil {
		vc.IDMap = make(map[string]uint64)
	}
	if vc.DocMap == nil {
		vc.DocMap = make(map[uint64]string)
	}
	if vc.Metas == nil {
		vc.Metas = make(map[uint64][]byte)
	}
	if vc.PendingVectors == nil {
		vc.PendingVectors = make(map[string][]float32)
	}
	if err := vc.restorePendingVectorsLocked(); err != nil {
		vc.Mu.Unlock()
		return err
	}
	vc.Mu.Unlock()
	return nil
}

func (vc *VamanaCollection) restorePendingVectorsLocked() error {
	if len(vc.PendingVectors) == 0 {
		return nil
	}
	type pendingPoint struct {
		id     string
		oldID  uint64
		vector []float32
	}
	pending := make([]pendingPoint, 0, len(vc.PendingVectors))
	for id, vector := range vc.PendingVectors {
		oldID, ok := vc.IDMap[id]
		if !ok {
			continue
		}
		pending = append(pending, pendingPoint{id: id, oldID: oldID, vector: vector})
	}
	sort.Slice(pending, func(i, j int) bool { return pending[i].oldID < pending[j].oldID })
	diskPoints := vc.Index.NumPointsTotal()
	for _, point := range pending {
		if point.oldID < diskPoints {
			if !vc.Index.IsDeleted(point.oldID) {
				if err := vc.Index.Delete(point.oldID); err != nil {
					return err
				}
			}
		}
		nodeID, err := vc.Index.Insert(point.vector)
		if err != nil {
			return err
		}
		if nodeID == point.oldID {
			continue
		}
		delete(vc.DocMap, point.oldID)
		vc.IDMap[point.id] = nodeID
		vc.DocMap[nodeID] = point.id
		if meta, ok := vc.Metas[point.oldID]; ok {
			delete(vc.Metas, point.oldID)
			vc.Metas[nodeID] = meta
		}
	}
	return nil
}

func (vc *VamanaCollection) FlushToDisk(basePath string) error {
	vc.Mu.RLock()
	rootPath := vc.RootPath
	activePath := vc.BasePath
	vc.Mu.RUnlock()
	if rootPath == "" {
		rootPath = activePath
	}
	if basePath == "" || basePath == rootPath || basePath == activePath {
		_, err := vc.Checkpoint(context.Background())
		return err
	}

	vc.flushMu.Lock()
	defer vc.flushMu.Unlock()

	vc.Mu.Lock()
	defer vc.Mu.Unlock()

	if basePath == "" {
		basePath = vc.BasePath
	}
	if basePath == "" {
		return nil
	}

	points, err := vc.extractLivePointsLocked()
	if err != nil {
		return err
	}
	if len(points) == 0 {
		return saveVamanaCollectionStateLocked(vc, basePath)
	}

	tmpBasePath := basePath + ".rebuild"
	if err := removeVamanaFiles(tmpBasePath); err != nil {
		return err
	}

	config := vc.Config
	if config.R == 0 {
		config = vamana.DefaultDiskBuildConfig()
	}

	next, err := BuildVamanaCollection(vc.ColName, points, tmpBasePath, config, vc.Meta)
	if err != nil {
		return err
	}
	next.BasePath = basePath
	next.Config = config
	next.LastCommitSequence = vc.LastCommitSequence
	next.PendingVectors = make(map[string][]float32)
	if err := SaveVamanaCollectionState(next, tmpBasePath); err != nil {
		_ = next.Close()
		return err
	}
	if err := next.Close(); err != nil {
		return err
	}

	if vc.Index != nil {
		if err := vc.Index.Close(); err != nil {
			return err
		}
	}
	if err := vc.closeWALLocked(); err != nil {
		return err
	}
	if err := replaceVamanaFiles(tmpBasePath, basePath); err != nil {
		return err
	}

	reopened, err := OpenVamanaCollection(vc.ColName, basePath, vc.Meta)
	if err != nil {
		return err
	}
	reopened.Config = config
	reopened.BasePath = basePath

	vc.ColDim = reopened.ColDim
	vc.Meta = reopened.Meta
	vc.RootPath = reopened.RootPath
	vc.BasePath = reopened.BasePath
	vc.Config = reopened.Config
	vc.Index = reopened.Index
	vc.IDMap = reopened.IDMap
	vc.DocMap = reopened.DocMap
	vc.Metas = reopened.Metas
	vc.PendingVectors = make(map[string][]float32)

	return nil
}

func (vc *VamanaCollection) extractLivePoints() ([]Point, error) {
	vc.Mu.RLock()
	defer vc.Mu.RUnlock()
	return vc.extractLivePointsLocked()
}

func (vc *VamanaCollection) extractLivePointsLocked() ([]Point, error) {
	ids := make([]string, 0, len(vc.IDMap))
	for id := range vc.IDMap {
		ids = append(ids, id)
	}
	sort.Strings(ids)

	type liveRef struct {
		id      string
		nodeID  uint64
		meta    []byte
		pending []float32
	}
	refs := make([]liveRef, 0, len(ids))
	for _, id := range ids {
		nodeID := vc.IDMap[id]
		refs = append(refs, liveRef{
			id:      id,
			nodeID:  nodeID,
			meta:    vc.Metas[nodeID],
			pending: vc.PendingVectors[id],
		})
	}

	points := make([]Point, 0, len(refs))
	for _, ref := range refs {
		var vec []float32
		if ref.pending != nil {
			vec = make([]float32, len(ref.pending))
			copy(vec, ref.pending)
		} else {
			readVec, err := vc.Index.ReadVector(ref.nodeID)
			if err != nil {
				return nil, err
			}
			vec = readVec
		}
		metaCopy := make([]byte, len(ref.meta))
		copy(metaCopy, ref.meta)
		points = append(points, Point{ID: ref.id, Vector: vec, Meta: json.RawMessage(metaCopy)})
	}
	return points, nil
}

func removeVamanaFiles(basePath string) error {
	for _, path := range vamanaFileSet(basePath) {
		if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
			return err
		}
	}
	return nil
}

func replaceVamanaFiles(tmpBasePath, basePath string) error {
	if err := removeVamanaFiles(basePath); err != nil {
		return err
	}
	for _, ext := range []string{".index", ".bbq", ".deleted", VamanaStateFileExt} {
		src := tmpBasePath + ext
		if _, err := os.Stat(src); err != nil {
			if os.IsNotExist(err) {
				continue
			}
			return err
		}
		if err := os.MkdirAll(filepath.Dir(basePath+ext), 0755); err != nil {
			return err
		}
		if err := os.Rename(src, basePath+ext); err != nil {
			return err
		}
	}
	return nil
}

func vamanaFileSet(basePath string) []string {
	return []string{
		basePath + ".index",
		basePath + ".bbq",
		basePath + ".deleted",
		basePath + VamanaStateFileExt,
		basePath + VamanaWALFileExt,
	}
}

func (vc *VamanaCollection) Close() error {
	vc.flushMu.Lock()
	defer vc.flushMu.Unlock()

	vc.Mu.Lock()
	defer vc.Mu.Unlock()
	if vc.Index == nil {
		return nil
	}
	if err := vc.syncWALLocked(); err != nil {
		return err
	}
	if err := vc.Index.Close(); err != nil {
		return err
	}
	return vc.closeWALLocked()
}

func (vc *VamanaCollection) GetVectorByID(id string) ([]float32, bool) {
	vc.Mu.RLock()
	defer vc.Mu.RUnlock()
	nodeID, ok := vc.IDMap[id]
	if !ok {
		return nil, false
	}
	vec, err := vc.Index.ReadVector(nodeID)
	if err != nil || vec == nil {
		return nil, false
	}
	return vec, true
}

func (vc *VamanaCollection) GetMetaByID(id string) (json.RawMessage, bool) {
	vc.Mu.RLock()
	defer vc.Mu.RUnlock()
	nodeID, ok := vc.IDMap[id]
	if !ok {
		return nil, false
	}
	meta, ok := vc.Metas[nodeID]
	if !ok {
		return nil, false
	}
	return json.RawMessage(meta), true
}

// =========================================
// VectorCollection interface methods
// =========================================

func (vc *VamanaCollection) Name() string {
	vc.Mu.RLock()
	defer vc.Mu.RUnlock()
	return vc.ColName
}

func (vc *VamanaCollection) Dimension() int {
	vc.Mu.RLock()
	defer vc.Mu.RUnlock()
	return vc.ColDim
}

func (vc *VamanaCollection) Flush() error {
	return SyncVamanaWAL(vc)
}

func (vc *VamanaCollection) FetchPoints(ids []string) ([]Point, error) {
	vc.Mu.RLock()
	defer vc.Mu.RUnlock()

	points := make([]Point, 0, len(ids))
	for _, id := range ids {
		nodeID, ok := vc.IDMap[id]
		if !ok {
			continue
		}
		vec, err := vc.Index.ReadVector(nodeID)
		if err != nil {
			continue
		}
		metaBytes := vc.Metas[nodeID]
		meta := make([]byte, len(metaBytes))
		copy(meta, metaBytes)
		points = append(points, Point{ID: id, Vector: vec, Meta: json.RawMessage(meta)})
	}
	return points, nil
}

func (vc *VamanaCollection) ListIDs() []string {
	vc.Mu.RLock()
	defer vc.Mu.RUnlock()
	ids := make([]string, 0, len(vc.IDMap))
	for id := range vc.IDMap {
		ids = append(ids, id)
	}
	return ids
}

func (vc *VamanaCollection) ForEachID(fn func(id string, docID uint64, meta []byte) bool) {
	vc.Mu.RLock()
	defer vc.Mu.RUnlock()
	for nodeID, id := range vc.DocMap {
		if vc.Index.IsDeleted(nodeID) {
			continue
		}
		meta := vc.Metas[nodeID]
		if !fn(id, nodeID, meta) {
			return
		}
	}
}

func (vc *VamanaCollection) Info() CollectionInfo {
	vc.Mu.RLock()
	defer vc.Mu.RUnlock()
	return CollectionInfo{
		Name:      vc.ColName,
		Dimension: vc.ColDim,
		Count:     len(vc.IDMap),
	}
}
