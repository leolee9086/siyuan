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

// Package vectordb provides embedded vector database for SiYuan
// Based on HNSW algorithm for efficient approximate nearest neighbor search
package vectordb

import (
	"sync"
)

// =========================================
// Core Data Structures
// =========================================

// Item stores vector and metadata
type Item struct {
	ID        string                    `msgpack:"id"`        // Primary key
	Meta      map[string]interface{}    `msgpack:"meta"`      // Arbitrary metadata
	Vectors   map[string][]float32      `msgpack:"vectors"`   // Model name -> vector
	Neighbors map[string][]LevelData    `msgpack:"neighbors"` // HNSW adjacency list
}

// LevelData HNSW level data
type LevelData struct {
	Type  int              `msgpack:"type"`  // Level number (0, 1, 2, ...)
	Items []NeighborRecord `msgpack:"items"` // Neighbor list
}

// NeighborRecord neighbor record
type NeighborRecord struct {
	ID       string  `msgpack:"id"`       // Neighbor ID
	Distance float32 `msgpack:"distance"` // Pre-computed distance
}

// Collection dataset
type Collection struct {
	Name         string                       `msgpack:"name"`          // Collection name
	Dimension    int                          `msgpack:"dimension"`     // Vector dimension
	Items        map[string]*Item             `msgpack:"-"`             // ID -> Item (runtime only)
	HNSWLevelMap map[string]map[int][]string  `msgpack:"hnswLevelMap"`  // Level mapping
	Config       CollectionConfig             `msgpack:"config"`        // Config

	Mu           sync.RWMutex                 `msgpack:"-"`             // Thread safety (exported)
}

// CollectionConfig collection config
type CollectionConfig struct {
	M              int    `msgpack:"m"`              // Max neighbors per level (default 16)
	EfConstruction int    `msgpack:"efConstruction"` // Candidate list size during construction (default 200)
	EfSearch       int    `msgpack:"efSearch"`       // Candidate list size during search (default 100)
	MaxLevel       int    `msgpack:"maxLevel"`       // Max level count (default 16)
	MetricType     string `msgpack:"metricType"`     // Distance type: "cosine" or "l2"
}

// Database database
type Database struct {
	Path        string                 `msgpack:"path"`        // Storage path
	Collections map[string]*Collection `msgpack:"-"`           // Name -> Collection
	
	mu          sync.RWMutex           `msgpack:"-"`
}

// VectorStorage vector storage root
type VectorStorage struct {
	Databases map[string]*Database `msgpack:"-"` // public, plugin, temp
	
	mu        sync.RWMutex         `msgpack:"-"`
}

// =========================================
// Default Config
// =========================================

// DefaultCollectionConfig returns default config
func DefaultCollectionConfig() CollectionConfig {
	return CollectionConfig{
		M:              16,
		EfConstruction: 200,
		EfSearch:       100,
		MaxLevel:       16,
		MetricType:     "cosine",
	}
}

// =========================================
// Constructors
// =========================================

// NewItem creates new item
func NewItem(id string) *Item {
	return &Item{
		ID:        id,
		Meta:      make(map[string]interface{}),
		Vectors:   make(map[string][]float32),
		Neighbors: make(map[string][]LevelData),
	}
}

// NewCollection creates new collection
func NewCollection(name string, dimension int) *Collection {
	return &Collection{
		Name:         name,
		Dimension:    dimension,
		Items:        make(map[string]*Item),
		HNSWLevelMap: make(map[string]map[int][]string),
		Config:       DefaultCollectionConfig(),
	}
}

// NewDatabase creates new database
func NewDatabase(path string) *Database {
	return &Database{
		Path:        path,
		Collections: make(map[string]*Collection),
	}
}

// NewVectorStorage creates vector storage root
func NewVectorStorage() *VectorStorage {
	return &VectorStorage{
		Databases: make(map[string]*Database),
	}
}

// =========================================
// Item Methods
// =========================================

// GetVector gets vector for specified model
func (item *Item) GetVector(modelName string) ([]float32, bool) {
	vec, ok := item.Vectors[modelName]
	return vec, ok
}

// SetVector sets vector
func (item *Item) SetVector(modelName string, vector []float32) {
	item.Vectors[modelName] = vector
}

// GetHNSWNeighbors gets HNSW adjacency list
func (item *Item) GetHNSWNeighbors(modelName string) []LevelData {
	key := modelName + "_hnsw"
	return item.Neighbors[key]
}

// SetHNSWNeighbors sets HNSW adjacency list
func (item *Item) SetHNSWNeighbors(modelName string, levels []LevelData) {
	key := modelName + "_hnsw"
	item.Neighbors[key] = levels
}

// GetLevelNeighbors gets neighbors at specified level
func (item *Item) GetLevelNeighbors(modelName string, level int) *LevelData {
	neighbors := item.GetHNSWNeighbors(modelName)
	for i := range neighbors {
		if neighbors[i].Type == level {
			return &neighbors[i]
		}
	}
	return nil
}

// =========================================
// Collection Methods
// =========================================

// GetItem gets item (thread-safe)
func (c *Collection) GetItem(id string) (*Item, bool) {
	c.Mu.RLock()
	defer c.Mu.RUnlock()
	item, ok := c.Items[id]
	return item, ok
}

// SetItem sets item (thread-safe)
func (c *Collection) SetItem(item *Item) {
	c.Mu.Lock()
	defer c.Mu.Unlock()
	c.Items[item.ID] = item
}

// DeleteItem deletes item (thread-safe)
func (c *Collection) DeleteItem(id string) bool {
	c.Mu.Lock()
	defer c.Mu.Unlock()
	if _, ok := c.Items[id]; ok {
		delete(c.Items, id)
		return true
	}
	return false
}

// ItemCount gets item count
func (c *Collection) ItemCount() int {
	c.Mu.RLock()
	defer c.Mu.RUnlock()
	return len(c.Items)
}

// GetLevelMap gets level mapping
func (c *Collection) GetLevelMap(modelName string) map[int][]string {
	c.Mu.RLock()
	defer c.Mu.RUnlock()
	return c.HNSWLevelMap[modelName]
}

// InitLevelMap initializes level mapping for model
func (c *Collection) InitLevelMap(modelName string) {
	c.Mu.Lock()
	defer c.Mu.Unlock()
	if c.HNSWLevelMap[modelName] == nil {
		c.HNSWLevelMap[modelName] = make(map[int][]string)
	}
}
