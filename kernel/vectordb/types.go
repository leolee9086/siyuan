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
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/siyuan-note/logging"
	"github.com/siyuan-note/siyuan/kernel/vectordb/hnsw"
	"github.com/siyuan-note/siyuan/kernel/vectordb/vamana"
)

// =========================================
// Migration
// =========================================

const MigrationThreshold = 500000

var IsSSD bool

// =========================================
// Core types (v2 API)
// =========================================

type DocID = uint32

type CollectionConfig struct {
	M              int    `msgpack:"m"`
	EfConstruction int    `msgpack:"ef_construction"`
	EfSearch       int    `msgpack:"ef_search"`
	MaxLevel       int    `msgpack:"max_level"`
	MetricType     string `msgpack:"metric"`
}

type Point struct {
	ID     string          `json:"id"`
	Vector []float32       `json:"vector"`
	Meta   json.RawMessage `json:"meta,omitempty"`
}

type NeighborRecord struct {
	ID       DocID   `msgpack:"id"`
	Distance float32 `msgpack:"distance"`
}

type CollectionMeta struct {
	Model   string                 `json:"model" msgpack:"model"`
	Dataset string                 `json:"dataset" msgpack:"dataset"`
	Type    string                 `json:"type" msgpack:"type"`
	Created int64                  `json:"created" msgpack:"created"`
	Updated int64                  `json:"updated" msgpack:"updated"`
	Extra   map[string]interface{} `json:"extra,omitempty" msgpack:"extra"`
}

// Collection is an HNSW-based in-memory vector collection.
type Collection struct {
	ColName   string
	ColDim    int
	Config    CollectionConfig
	Meta      CollectionMeta

	IDMap  map[string]DocID
	DocMap []string
	Metas  [][]byte

	HNSWIdx *hnsw.HNSWIndex
	Store   *VectorStore

	Mu sync.RWMutex
}

// CollectionInfo holds summary info for a collection.
type CollectionInfo struct {
	Name      string `json:"name"`
	Dimension int    `json:"dimension"`
	Count     int    `json:"count"`
}

// Database holds multiple named collections.
type Database struct {
	Path        string
	Collections map[string]VectorCollection
	mu          sync.RWMutex
}

// VectorCollection is the common interface for both HNSW Collection and VamanaCollection.
type VectorCollection interface {
	InsertPoint(point Point) error
	Search(queryVec []float32, k int, efSearch int) []SearchResult
	DeleteItemWithIndex(id string)
	RebuildIndex() error

	Name() string
	Dimension() int
	ItemCount() int

	ListIDs() []string
	ForEachID(fn func(id string, docID uint64, meta []byte) bool)
	GetMetaByID(id string) (json.RawMessage, bool)
	Info() CollectionInfo

	Close() error
}

// =========================================
// Constructors
// =========================================

func NewDatabase(path string) *Database {
	return &Database{
		Path:        path,
		Collections: make(map[string]VectorCollection),
	}
}

func NewCollection(name string, dimension int) *Collection {
	config := DefaultConfig()
	store := NewVectorStore(dimension)

	hnswConfig := hnsw.Config{
		M:              config.M,
		EfConstruction: config.EfConstruction,
		EfSearch:       config.EfSearch,
		MaxLevel:       config.MaxLevel,
		MetricType:     config.MetricType,
	}

	return &Collection{
		ColName:   name,
		ColDim:    dimension,
		Config:    config,
		IDMap:     make(map[string]DocID),
		DocMap:    make([]string, 0),
		Metas:     make([][]byte, 0),
		HNSWIdx:   hnsw.NewHNSWIndex(dimension, hnswConfig, store),
		Store:     store,
	}
}

func DefaultConfig() CollectionConfig {
	return CollectionConfig{
		M:              16,
		EfConstruction: 200,
		EfSearch:       64,
		MaxLevel:       16,
		MetricType:     "cosine",
	}
}

// =========================================
// Collection internal methods
// =========================================

func (c *Collection) GetDocID(id string) (DocID, bool) {
	c.Mu.RLock()
	defer c.Mu.RUnlock()
	docID, ok := c.IDMap[id]
	return docID, ok
}

func (c *Collection) GetExternalID(docID DocID) (string, bool) {
	c.Mu.RLock()
	defer c.Mu.RUnlock()
	if int(docID) >= len(c.DocMap) {
		return "", false
	}
	return c.DocMap[docID], true
}

func (c *Collection) GetMeta(docID DocID) (json.RawMessage, bool) {
	c.Mu.RLock()
	defer c.Mu.RUnlock()
	if int(docID) >= len(c.Metas) {
		return nil, false
	}
	return json.RawMessage(c.Metas[docID]), true
}

func (c *Collection) GetNodeLevel(docID DocID) int {
	return c.HNSWIdx.GetItemLevel(docID)
}

func (c *Collection) GetLevelNeighborIDs(docID DocID, level int) []DocID {
	return c.HNSWIdx.GetLevelNeighborIDs(docID, level)
}

func (c *Collection) ItemCount() int {
	c.Mu.RLock()
	defer c.Mu.RUnlock()
	return len(c.IDMap)
}

// =========================================
// Database methods
// =========================================

func (db *Database) GetCollection(name string) VectorCollection {
	db.mu.RLock()
	defer db.mu.RUnlock()
	return db.Collections[name]
}

func (db *Database) GetHNSWCollection(name string) *Collection {
	db.mu.RLock()
	defer db.mu.RUnlock()
	c, _ := db.Collections[name].(*Collection)
	return c
}

func (db *Database) CreateCollection(name string, dimension int) (VectorCollection, error) {
	return db.CreateCollectionWithMeta(name, dimension, CollectionMeta{})
}

func (db *Database) CreateCollectionWithMeta(name string, dimension int, meta CollectionMeta) (VectorCollection, error) {
	db.mu.Lock()
	defer db.mu.Unlock()

	if c, exists := db.Collections[name]; exists {
		if c.Dimension() != dimension {
			return nil, fmt.Errorf("collection %s already exists with dimension %d, requested %d", name, c.Dimension(), dimension)
		}
		return c, nil
	}

	c := NewCollection(name, dimension)
	if meta.Created == 0 {
		meta.Created = time.Now().Unix()
	}
	meta.Updated = meta.Created
	c.Meta = meta

	db.Collections[name] = c
	return c, nil
}

func (db *Database) DeleteCollection(name string) error {
	db.mu.Lock()
	defer db.mu.Unlock()

	c, exists := db.Collections[name]
	if !exists {
		return fmt.Errorf("collection %s not found", name)
	}

	if cl, ok := c.(interface{ Close() error }); ok {
		cl.Close()
	}
	delete(db.Collections, name)

	collectionPath := filepath.Join(db.Path, name)
	if err := os.RemoveAll(collectionPath); err != nil {
		return fmt.Errorf("collection removed from memory but failed to delete files: %w", err)
	}
	return nil
}

func (db *Database) ListCollections() []CollectionInfo {
	db.mu.RLock()
	defer db.mu.RUnlock()

	result := make([]CollectionInfo, 0, len(db.Collections))
	for _, col := range db.Collections {
		result = append(result, col.Info())
	}
	return result
}

// =========================================
// Migration: HNSW -> DiskVamana
// =========================================

func (db *Database) MigrateToDisk(name string) (VectorCollection, error) {
	db.mu.RLock()
	old := db.Collections[name]
	db.mu.RUnlock()

	if old == nil {
		return nil, fmt.Errorf("collection %q not found", name)
	}
	if _, ok := old.(*VamanaCollection); ok {
		return old, nil
	}

	hnswCol, ok := old.(*Collection)
	if !ok {
		return nil, fmt.Errorf("collection %q is not HNSW-backed", name)
	}
	if !IsSSD {
		logging.LogWarnf("vectordb: migration skipped for %q (not on SSD)", name)
		return hnswCol, nil
	}

	logging.LogInfof("vectordb: migrating %q (%d items) to disk...", name, hnswCol.ItemCount())

	points := hnswCol.ExtractPoints()
	if len(points) == 0 {
		return hnswCol, nil
	}

	indexPath := filepath.Join(db.Path, name, "vamana")

	// Ensure directory exists for the disk index.
	if err := os.MkdirAll(filepath.Dir(indexPath), 0755); err != nil {
		return nil, fmt.Errorf("migrate %q: mkdir failed: %w", name, err)
	}

	config := vamanaConfigFromHNSW(hnswCol.Config)

	vc, err := BuildVamanaCollection(name, points, indexPath, config, hnswCol.Meta)
	if err != nil {
		return nil, fmt.Errorf("migrate %q: build failed: %w", name, err)
	}

	db.mu.Lock()
	db.Collections[name] = vc
	db.mu.Unlock()

	logging.LogInfof("vectordb: migrated %q to disk (%d items)", name, vc.ItemCount())
	return vc, nil
}

func (db *Database) MaybeMigrate(name string) {
	if !IsSSD {
		return
	}
	db.mu.RLock()
	col := db.Collections[name]
	db.mu.RUnlock()
	if col == nil {
		return
	}
	if _, isDisk := col.(*VamanaCollection); isDisk {
		return
	}
	if col.ItemCount() < MigrationThreshold {
		return
	}
	go func() {
		if _, err := db.MigrateToDisk(name); err != nil {
			logging.LogWarnf("vectordb: auto-migration for %q failed: %v", name, err)
		}
	}()
}

type Item struct {
	ID    string
	DocID DocID
	Meta  map[string]interface{}
}

func vamanaConfigFromHNSW(cfg CollectionConfig) vamana.DiskBuildConfig {
	d := vamana.DefaultDiskBuildConfig()
	d.R = cfg.M * 2
	d.L = cfg.EfConstruction
	return d
}
