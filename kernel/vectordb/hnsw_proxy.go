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

	"github.com/siyuan-note/siyuan/kernel/vectordb/hnsw"
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

// InsertPoint inserts a point into HNSW index
func (c *Collection) InsertPoint(point Point) error {
	config := c.Config

	var docID DocID
	exists := false

	c.Mu.Lock()
	if existingID, ok := c.IDMap[point.ID]; ok {
		docID = existingID
		exists = true
	} else {
		docID = DocID(len(c.DocMap))
		c.IDMap[point.ID] = docID
		c.DocMap = append(c.DocMap, point.ID)
		if len(c.Metas) < len(c.DocMap) {
			c.Metas = append(c.Metas, make([][]byte, len(c.DocMap)-len(c.Metas))...)
		}
	}

	// Update Meta
	if int(docID) < len(c.Metas) {
		c.Metas[docID] = point.Meta
	} else {
		c.Metas = append(c.Metas, point.Meta)
	}
	c.Mu.Unlock()

	// Set Vector to Store
	c.Store.Set(docID, point.Vector)

	// Insert into HNSW index if new
	if !exists {
		c.HNSWIdx.Insert(docID)
	}

	_ = config
	return nil
}

// Search searches for k nearest neighbors
func (c *Collection) Search(queryVec []float32, k int, efSearch int) []SearchResult {
	// Delegate to HNSWIndex
	hnswResults := c.HNSWIdx.Search(queryVec, k, efSearch)
	if hnswResults == nil {
		return []SearchResult{}
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

	return searchResults
}

// DeleteItemWithIndex deletes an item and updates the HNSW index
func (c *Collection) DeleteItemWithIndex(id string) {
	docID, ok := c.GetDocID(id)
	if !ok {
		return
	}

	// Delegate graph deletion to HNSWIndex
	c.HNSWIdx.Delete(docID)

	// Clean up ID mapping
	c.Mu.Lock()
	delete(c.IDMap, id)
	c.Mu.Unlock()
}

// RebuildIndex rebuilds the HNSW index
func (c *Collection) RebuildIndex() error {
	// Collect all valid points
	points := make([]Point, 0)

	c.Mu.RLock()
	for i, id := range c.DocMap {
		docID := DocID(i)
		if c.HNSWIdx.Deleted[docID] {
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
		c.Store = NewVectorStore(c.Dimension)
		c.HNSWIdx = hnsw.NewHNSWIndex(c.Dimension, c.hnswConfig(), c.Store)
		c.Mu.Unlock()
		return nil
	}

	// Reset collection structure
	c.Mu.Lock()
	c.IDMap = make(map[string]DocID)
	c.DocMap = make([]string, 0)
	c.Metas = make([][]byte, 0)
	c.Store = NewVectorStore(c.Dimension)
	c.HNSWIdx = hnsw.NewHNSWIndex(c.Dimension, c.hnswConfig(), c.Store)
	c.Mu.Unlock()

	// Re-insert all points
	for _, point := range points {
		c.InsertPoint(point)
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

// distanceToScore converts distance to a score in [0, 1]
func distanceToScore(distance float32, metricType string) float32 {
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
