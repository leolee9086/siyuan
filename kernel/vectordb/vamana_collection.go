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
	"encoding/json"
	"sort"
	"sync"

	"github.com/siyuan-note/siyuan/kernel/vectordb/vamana"
)

// VamanaCollection wraps a disk-resident Vamana index with external ID mapping
// and per-node JSON metadata, providing the same CRUD surface as Collection.
//
// Unlike Collection (HNSW-based, fully in-memory), VamanaCollection is designed
// for large-scale datasets where vectors reside on disk via mmap.
//
// All methods are safe for concurrent use.
type VamanaCollection struct {
	ColName   string
	ColDim    int
	Meta      CollectionMeta

	Index *vamana.DiskVamanaIndex

	IDMap  map[string]uint64 // external string ID → internal node ID
	DocMap map[uint64]string // internal node ID → external string ID
	Metas  map[uint64][]byte // internal node ID → raw JSON metadata

	Mu sync.RWMutex
}

// NewVamanaCollection wraps an existing DiskVamanaIndex with ID mapping and metadata.
// The caller is responsible for providing the correct name, dimension, and meta.
func NewVamanaCollection(name string, dimension int, idx *vamana.DiskVamanaIndex, meta CollectionMeta) *VamanaCollection {
	return &VamanaCollection{
		ColName:   name,
		ColDim:    dimension,
		Meta:      meta,
		Index:     idx,
		IDMap:     make(map[string]uint64),
		DocMap:    make(map[uint64]string),
		Metas:     make(map[uint64][]byte),
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

	oldNodeID, exists := vc.IDMap[point.ID]
	if exists {
		// Soft-delete the old node. The old nodeID is not reusable;
		// insert a fresh node and remap.
		var delErr error
		if !vc.Index.IsDeleted(oldNodeID) {
			delErr = vc.Index.Delete(oldNodeID)
		}
		delete(vc.IDMap, point.ID)
		delete(vc.DocMap, oldNodeID)
		delete(vc.Metas, oldNodeID)
		vc.Mu.Unlock()

		if delErr != nil {
			return delErr
		}
	} else {
		vc.Mu.Unlock()
	}

	nodeID, err := vc.Index.Insert(point.Vector)
	if err != nil {
		return err
	}

	vc.Mu.Lock()
	vc.IDMap[point.ID] = nodeID
	vc.DocMap[nodeID] = point.ID
	if len(point.Meta) > 0 {
		metaCopy := make([]byte, len(point.Meta))
		copy(metaCopy, point.Meta)
		vc.Metas[nodeID] = metaCopy
	}
	vc.Mu.Unlock()

	return nil
}

// Search searches for k nearest neighbors in the Vamana index, enriching
// results with external string IDs, normalized scores, and metadata.
func (vc *VamanaCollection) Search(queryVec []float32, k int, efSearch int) []SearchResult {
	rawResults, err := vc.Index.Search(queryVec, k, efSearch)
	if err != nil || rawResults == nil {
		return []SearchResult{}
	}

	vc.Mu.RLock()
	defer vc.Mu.RUnlock()

	results := make([]SearchResult, 0, len(rawResults))
	for _, r := range rawResults {
		externalID, ok := vc.DocMap[r.ID]
		if !ok {
			continue
		}

		score := vamanaDistanceToScore(r.Distance)

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

	return results
}

// DeleteItemWithIndex removes a point by external string ID.
func (vc *VamanaCollection) DeleteItemWithIndex(id string) {
	vc.Mu.Lock()
	nodeID, ok := vc.IDMap[id]
	if !ok {
		vc.Mu.Unlock()
		return
	}
	delete(vc.IDMap, id)
	delete(vc.DocMap, nodeID)
	delete(vc.Metas, nodeID)
	vc.Mu.Unlock()

	_ = vc.Index.Delete(nodeID)
}

// RebuildIndex is not supported for disk-based Vamana collections.
// Use Compact() instead to reclaim space from deleted nodes.
func (vc *VamanaCollection) RebuildIndex() error {
	return nil
}

// vamanaDistanceToScore converts a Vamana Euclidean distance to a score in [0, 1].
//
// Vamana uses euclideanDistance (‖a-b‖²) or dotProduct distance internally.
// The distance is un-normalized, so we use a clamped inverse transform:
//
//	score = 1.0 / (1.0 + distance)
//
// Clamped to [0, 1].
func vamanaDistanceToScore(distance float32) float32 {
	if distance < 1e-6 {
		return 1.0
	}
	score := 1.0 / (1.0 + distance)
	if score < 0 {
		score = 0
	}
	if score > 1 {
		score = 1
	}
	return score
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
func OpenVamanaCollection(name string, basePath string, meta CollectionMeta) (*VamanaCollection, error) {
	idx, err := vamana.Open(basePath)
	if err != nil {
		return nil, err
	}

	vc := NewVamanaCollection(name, int(idx.Dimension()), idx, meta)
	return vc, nil
}

func (vc *VamanaCollection) Close() error {
	return vc.Index.Close()
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

func (vc *VamanaCollection) Name() string   { return vc.ColName }
func (vc *VamanaCollection) Dimension() int { return vc.ColDim }

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
