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

// DocID internal integer ID
type DocID uint32

// Item stores vector and metadata
type Item struct {
	ID      string                 `msgpack:"id"`      // Primary key (External)
	DocID   DocID                  `msgpack:"docId"`   // Internal key
	Meta    map[string]interface{} `msgpack:"meta"`    // Arbitrary metadata
	Vectors map[string][]float32   `msgpack:"vectors"` // Model name -> vector
	
	// Neighbors is REMOVED from Item. It is now stored in the Graph structure.
	// But for compatibility/simplicity during transition, we might keep it?
	// NO, "Industrial Strength" means we separate Data from Index.
}

// LevelData HNSW level data (Graph Node)
type LevelData struct {
	Type  int              `msgpack:"type"`  // Level number
	Items []NeighborRecord `msgpack:"items"` // Neighbor list
}

// NeighborRecord neighbor record
type NeighborRecord struct {
	ID       DocID   `msgpack:"id"`       // Neighbor DocID
	Distance float32 `msgpack:"distance"` // Pre-computed distance
}

// Collection dataset
type Collection struct {
	Name      string               `msgpack:"name"`      // Collection name
	Dimension int                  `msgpack:"dimension"` // Vector dimension
	Config    CollectionConfig     `msgpack:"config"`    // Config

	// 1. Primary Lookups (In-Memory)
	IDMap      map[string]DocID     `msgpack:"-"` // External ID -> DocID
	DocMap     []string             `msgpack:"-"` // DocID -> External ID (Index is DocID)
	NextDocID  DocID                `msgpack:"-"` // Auto-increment counter

	// 2. Data Store
	Items      map[DocID]*Item      `msgpack:"-"` // DocID -> Item (Data)
	
	// 3. Graph Index
	// Map[ModelName] -> Map[DocID] -> []LevelData
	// Optimization: slice of pointers if DocID is dense
	HNSWNodes  map[string]map[DocID][]LevelData `msgpack:"-"` 
	
	// Entry Points
	HNSWLevelMap map[string]map[int][]DocID  `msgpack:"hnswLevelMap"`

	Mu           sync.RWMutex       `msgpack:"-"`
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
		ID:      id,
		Meta:    make(map[string]interface{}),
		Vectors: make(map[string][]float32),
	}
}

// NewCollection creates new collection
func NewCollection(name string, dimension int) *Collection {
	return &Collection{
		Name:         name,
		Dimension:    dimension,
		Config:       DefaultCollectionConfig(),
		
		IDMap:        make(map[string]DocID),
		DocMap:       make([]string, 0),
		Items:        make(map[DocID]*Item),
		HNSWNodes:    make(map[string]map[DocID][]LevelData),
		HNSWLevelMap: make(map[string]map[int][]DocID),
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

// NOTE: Neighbors methods moved to Collection/Graph logic as Item no longer holds Neighbors

// =========================================
// Collection Methods
// =========================================

// GetItem gets item (thread-safe)
func (c *Collection) GetItem(id string) (*Item, bool) {
	c.Mu.RLock()
	defer c.Mu.RUnlock()
	docID, ok := c.IDMap[id]
	if !ok {
		return nil, false
	}
	item, ok := c.Items[docID]
	return item, ok
}

// GetDocID gets DocID by external ID
func (c *Collection) GetDocID(id string) (DocID, bool) {
    c.Mu.RLock()
    defer c.Mu.RUnlock()
    docID, ok := c.IDMap[id]
    return docID, ok
}

// GetExternalID gets external ID by DocID
func (c *Collection) GetExternalID(docID DocID) (string, bool) {
    c.Mu.RLock()
    defer c.Mu.RUnlock()
    if int(docID) >= len(c.DocMap) {
        return "", false
    }
    return c.DocMap[docID], true
}

// SetItem sets item (thread-safe) and manages ID mapping
func (c *Collection) SetItem(item *Item) {
	c.Mu.Lock()
	defer c.Mu.Unlock()
	
	// Check if exists
	if docID, exists := c.IDMap[item.ID]; exists {
	    // Update existing
	    item.DocID = docID
	    c.Items[docID] = item
	} else {
	    // Assign new DocID
	    docID = c.NextDocID
	    c.NextDocID++
	    
	    item.DocID = docID
	    c.IDMap[item.ID] = docID
	    c.DocMap = append(c.DocMap, item.ID)
	    c.Items[docID] = item
	}
}

// DeleteItem deletes item (thread-safe) (Soft Delete)
// In HNSW, hard delete is complex. We usually just remove from IDMap and mark as deleted.
// For now, removing from Items and IDMap. Graph links remain but point to non-existent Item?
// We need a proper delete in HNSW.
func (c *Collection) DeleteItem(id string) bool {
	c.Mu.Lock()
	defer c.Mu.Unlock()
	
	docID, ok := c.IDMap[id]
	if !ok {
	    return false
	}
	
	delete(c.Items, docID)
	delete(c.IDMap, id)
	// We don't remove from DocMap to keep DocIDs stable (sparse array)
	// c.DocMap[docID] = "" // Mark as empty?
	
	return true
}

// ItemCount gets item count
func (c *Collection) ItemCount() int {
	c.Mu.RLock()
	defer c.Mu.RUnlock()
	return len(c.Items)
}

// InitLevelMap initializes level mapping for model
func (c *Collection) InitLevelMap(modelName string) {
	c.Mu.Lock()
	defer c.Mu.Unlock()
	if c.HNSWLevelMap[modelName] == nil {
		c.HNSWLevelMap[modelName] = make(map[int][]DocID)
	}
    if c.HNSWNodes[modelName] == nil {
        c.HNSWNodes[modelName] = make(map[DocID][]LevelData)
    }
}

