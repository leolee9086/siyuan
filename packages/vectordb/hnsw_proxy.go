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
	"fmt"
	"sort"

	"s-forge.local/vectordb/hnsw"
)

// =========================================
// HNSW 代理层
// Collection 的 HNSW 方法委托给 hnsw.HNSWIndex
// 保持外部 API 签名完全不变
// =========================================

// SearchResult represents a search result
type SearchResult struct {
	ID       string          `json:"id"`
	Score    float32         `json:"score"`
	Distance float32         `json:"distance"`
	Meta     json.RawMessage `json:"meta"`
}

// InsertPoint inserts or updates a point in the HNSW index.
func (c *Collection) InsertPoint(point Point) error {
	if point.ID == "" {
		return ErrPointIDInvalid
	}
	if len(point.Vector) != c.ColDim {
		return fmt.Errorf("%w: expected %d, got %d", ErrVectorDimensionInvalid, c.ColDim, len(point.Vector))
	}
	prepared, err := prepareVectorForMetric(point.Vector, c.Config.MetricType)
	if err != nil {
		return err
	}
	point.Vector = prepared
	return c.insertPreparedPoint(point)
}

func (c *Collection) insertPreparedPoint(point Point) error {
	c.Mu.Lock()
	defer c.Mu.Unlock()

	docID, exists := c.IDMap[point.ID]
	if !exists {
		if freeCount := len(c.freeDocIDs); freeCount > 0 {
			docID = c.freeDocIDs[freeCount-1]
			c.freeDocIDs = c.freeDocIDs[:freeCount-1]
			c.IDMap[point.ID] = docID
			c.DocMap[docID] = point.ID
		} else {
			if uint64(len(c.DocMap)) >= uint64(hnsw.InvalidEntryPoint) {
				return ErrCollectionCapacity
			}
			docID = DocID(len(c.DocMap))
			c.IDMap[point.ID] = docID
			c.DocMap = append(c.DocMap, point.ID)
			if len(c.Metas) < len(c.DocMap) {
				c.Metas = append(c.Metas, make([][]byte, len(c.DocMap)-len(c.Metas))...)
			}
		}
	}

	if int(docID) < len(c.Metas) {
		c.Metas[docID] = point.Meta
	} else {
		c.Metas = append(c.Metas, point.Meta)
	}

	if exists {
		c.HNSWIdx.Delete(docID)
	}
	c.Store.Set(docID, point.Vector)
	c.HNSWIdx.Insert(docID)
	return nil
}

func (c *Collection) borrowPointsForIndexBuild(ids []string) []Point {
	c.Mu.RLock()
	defer c.Mu.RUnlock()
	c.Store.mu.RLock()
	defer c.Store.mu.RUnlock()
	points := make([]Point, 0, len(ids))
	for _, id := range ids {
		docID, exists := c.IDMap[id]
		if !exists {
			continue
		}
		offset := int(docID) * c.ColDim
		end := offset + c.ColDim
		if end > len(c.Store.vectors) {
			continue
		}
		vector := c.Store.vectors[offset:end:end]
		var meta json.RawMessage
		if int(docID) < len(c.Metas) {
			meta = append(json.RawMessage(nil), c.Metas[docID]...)
		}
		points = append(points, Point{ID: id, Vector: vector, Meta: meta})
	}
	return points
}

func (c *Collection) orderedIDsForIndexBuild() []string {
	c.Mu.RLock()
	defer c.Mu.RUnlock()
	ids := make([]string, 0, len(c.IDMap))
	for _, id := range c.DocMap {
		if id != "" {
			ids = append(ids, id)
		}
	}
	return ids
}

// Search searches for k nearest neighbors.
func (c *Collection) Search(queryVec []float32, k int, efSearch int) []SearchResult {
	results, _ := c.SearchWithError(queryVec, k, efSearch)
	return results
}

// SearchWithError searches for k nearest neighbors and preserves the common error-aware collection contract.
func (c *Collection) SearchWithError(queryVec []float32, k int, efSearch int) ([]SearchResult, error) {
	if len(queryVec) != c.ColDim {
		return nil, fmt.Errorf("%w: expected %d, got %d", ErrVectorDimensionInvalid, c.ColDim, len(queryVec))
	}
	queryVec, err := prepareVectorForMetric(queryVec, c.Config.MetricType)
	if err != nil {
		return nil, err
	}
	// Delegate to HNSWIndex
	hnswResults := c.HNSWIdx.Search(queryVec, k, efSearch)
	if hnswResults == nil {
		return []SearchResult{}, nil
	}

	config := c.Config

	// Convert hnsw.SearchResult -> vectordb.SearchResult
	searchResults := make([]SearchResult, 0, len(hnswResults))
	for _, r := range hnswResults {
		externalID, _ := c.GetExternalID(r.ID)

		// Convert distance to score (0 to 1)
		score := distanceToScore(r.Distance, config.MetricType)

		meta, _ := c.GetMeta(r.ID)

		searchResults = append(searchResults, SearchResult{
			ID:       externalID,
			Score:    score,
			Distance: r.Distance,
			Meta:     meta,
		})
	}

	// Sort by score descending
	sort.Slice(searchResults, func(i, j int) bool {
		return searchResults[i].Score > searchResults[j].Score
	})

	return searchResults, nil
}

// DeletePoint deletes an item and preserves the legacy no-error API.
func (c *Collection) DeletePoint(id string) {
	_ = c.DeletePointWithError(id)
}

// DeletePointWithError deletes an item and reports failures through the common collection contract.
func (c *Collection) DeletePointWithError(id string) error {
	c.Mu.Lock()
	defer c.Mu.Unlock()

	docID, ok := c.IDMap[id]
	if !ok {
		return nil
	}

	c.HNSWIdx.Delete(docID)
	c.Store.Delete(docID)
	delete(c.IDMap, id)
	if int(docID) < len(c.DocMap) {
		c.DocMap[docID] = ""
		c.freeDocIDs = append(c.freeDocIDs, docID)
	}
	if int(docID) < len(c.Metas) {
		c.Metas[docID] = nil
	}
	return nil
}

// DeleteItemWithIndex 保留旧名称供外部调用，委托给 DeletePoint。
func (c *Collection) DeleteItemWithIndex(id string) { c.DeletePoint(id) }

// RebuildIndex rebuilds the HNSW index
func (c *Collection) RebuildIndex() error {
	// Collect all valid points
	points := make([]Point, 0)

	c.Mu.RLock()
	for i, id := range c.DocMap {
		docID := DocID(i)
		if c.HNSWIdx.IsDeleted(docID) {
			continue
		}

		vec, ok := c.Store.GetUnsafe(docID)
		if !ok {
			continue
		}

		vecCopy := make([]float32, len(vec))
		copy(vecCopy, vec)

		var meta json.RawMessage
		if int(docID) < len(c.Metas) {
			meta = c.Metas[docID]
		}

		points = append(points, Point{
			ID:     id,
			Vector: vecCopy,
			Meta:   meta,
		})
	}
	c.Mu.RUnlock()

	if len(points) == 0 {
		c.Mu.Lock()
		c.IDMap = make(map[string]DocID)
		c.DocMap = make([]string, 0)
		c.Metas = make([][]byte, 0)
		c.freeDocIDs = nil
		c.Store = NewVectorStore(c.ColDim, c.Config.MetricType)
		c.HNSWIdx = hnsw.NewHNSWIndex(c.ColDim, c.hnswConfig(), c.Store)
		c.Mu.Unlock()
		return nil
	}

	// Reset collection structure
	c.Mu.Lock()
	c.IDMap = make(map[string]DocID)
	c.DocMap = make([]string, 0)
	c.Metas = make([][]byte, 0)
	c.freeDocIDs = nil
	c.Store = NewVectorStore(c.ColDim, c.Config.MetricType)
	c.HNSWIdx = hnsw.NewHNSWIndex(c.ColDim, c.hnswConfig(), c.Store)
	c.Mu.Unlock()

	for _, point := range points {
		if err := c.InsertPoint(point); err != nil {
			return err
		}
	}
	return nil
}

// hnswConfig converts CollectionConfig to hnsw.Config
func (c *Collection) hnswConfig() hnsw.Config {
	return hnsw.Config{
		M:              c.Config.M,
		EfConstruction: c.Config.EfConstruction,
		EfSearch:       c.Config.EfSearch,
		MaxLevel:       c.Config.MaxLevel,
		MetricType:     c.Config.MetricType,
	}
}

// =========================================
// VectorCollection interface methods
// =========================================

func (c *Collection) Name() string { return c.ColName }

func (c *Collection) Dimension() int { return c.ColDim }

func (c *Collection) Engine() Engine { return EngineHNSW }

func (c *Collection) ListIDs() []string {
	c.Mu.RLock()
	defer c.Mu.RUnlock()
	ids := make([]string, 0, len(c.DocMap))
	for _, id := range c.DocMap {
		if id != "" {
			ids = append(ids, id)
		}
	}
	return ids
}

func (c *Collection) ForEachID(fn func(id string, docID uint64, meta []byte) bool) {
	c.Mu.RLock()
	defer c.Mu.RUnlock()
	for docID, id := range c.DocMap {
		if id == "" {
			continue
		}
		if c.HNSWIdx.IsDeleted(DocID(docID)) {
			continue
		}
		var meta []byte
		if docID < len(c.Metas) {
			meta = c.Metas[docID]
		}
		if !fn(id, uint64(docID), meta) {
			return
		}
	}
}

func (c *Collection) Info() CollectionInfo {
	c.Mu.RLock()
	defer c.Mu.RUnlock()
	return CollectionInfo{
		Name:      c.ColName,
		Dimension: c.ColDim,
		Count:     len(c.IDMap),
	}
}

func (c *Collection) Close() error { return nil }

func (c *Collection) Flush() error { return nil }

func (c *Collection) FetchPoints(ids []string) ([]Point, error) {
	points := make([]Point, 0, len(ids))
	for _, id := range ids {
		vec, ok := c.GetVectorByID(id)
		if !ok {
			continue
		}
		meta, _ := c.GetMetaByID(id)
		points = append(points, Point{ID: id, Vector: vec, Meta: meta})
	}
	return points, nil
}

func (c *Collection) GetVectorByID(id string) ([]float32, bool) {
	c.Mu.RLock()
	defer c.Mu.RUnlock()
	docID, ok := c.IDMap[id]
	if !ok {
		return nil, false
	}
	vec, ok := c.Store.GetUnsafe(docID)
	if !ok {
		return nil, false
	}
	vecCopy := make([]float32, len(vec))
	copy(vecCopy, vec)
	return vecCopy, true
}

func (c *Collection) GetMetaByID(id string) (json.RawMessage, bool) {
	c.Mu.RLock()
	defer c.Mu.RUnlock()
	docID, ok := c.IDMap[id]
	if !ok {
		return nil, false
	}
	if int(docID) >= len(c.Metas) {
		return nil, false
	}
	return json.RawMessage(c.Metas[docID]), true
}

func (c *Collection) ExtractPoints() []Point {
	c.Mu.RLock()
	defer c.Mu.RUnlock()
	points := make([]Point, 0, len(c.IDMap))
	for id, docID := range c.IDMap {
		if c.HNSWIdx.IsDeleted(docID) {
			continue
		}
		vec, ok := c.Store.GetUnsafe(docID)
		if !ok {
			continue
		}
		vecCopy := make([]float32, len(vec))
		copy(vecCopy, vec)
		var meta json.RawMessage
		if int(docID) < len(c.Metas) {
			meta = json.RawMessage(c.Metas[docID])
		}
		points = append(points, Point{ID: id, Vector: vecCopy, Meta: meta})
	}
	return points
}

// distanceToScore converts distance to a score in [0, 1]
func distanceToScore(distance float32, metricType string) float32 {
	if metricType == "ip" || metricType == "dot" || metricType == "innerproduct" {
		return -distance
	}
	var score float32
	if metricType == "cosine" {
		score = 1.0 - distance/2.0
	} else {
		if distance < 1e-6 {
			score = 1.0
		} else {
			score = 1.0 / (1.0 + distance)
		}
	}

	if score < 0 {
		score = 0
	}
	if score > 1 {
		score = 1
	}
	return score
}
