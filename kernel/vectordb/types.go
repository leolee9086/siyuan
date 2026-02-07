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

	"github.com/siyuan-note/siyuan/kernel/vectordb/hnsw"
)

// =========================================
// 核心类型定义 (v2 API)
// =========================================

type DocID = uint32

// CollectionConfig 集合配置
type CollectionConfig struct {
	M              int    `msgpack:"m"`
	EfConstruction int    `msgpack:"ef_construction"`
	EfSearch       int    `msgpack:"ef_search"`
	MaxLevel       int    `msgpack:"max_level"`
	MetricType     string `msgpack:"metric"`
}

// Point 表示一个数据点 (API交互用)
type Point struct {
	ID     string          `json:"id"`
	Vector []float32       `json:"vector"`
	Meta   json.RawMessage `json:"meta,omitempty"` // 任意 JSON 对象
}

// NeighborRecord 邻居记录 (Graph Edge)
type NeighborRecord struct {
	ID       DocID   `msgpack:"id"`
	Distance float32 `msgpack:"distance"`
}

// CollectionMeta 集合级别元数据
// 用于存储集合的全局信息，不依赖于单个向量点
type CollectionMeta struct {
	Model   string                 `json:"model" msgpack:"model"`           // 模型名
	Dataset string                 `json:"dataset" msgpack:"dataset"`       // 数据集名
	Type    string                 `json:"type" msgpack:"type"`             // 类型: blocks 或 assets
	Created int64                  `json:"created" msgpack:"created"`       // 创建时间戳 (Unix秒)
	Updated int64                  `json:"updated" msgpack:"updated"`       // 最后修改时间戳 (Unix秒)
	Extra   map[string]interface{} `json:"extra,omitempty" msgpack:"extra"` // 扩展字段
}

// Collection 向量集合
// 采用 "Point" 概念，不感知上层模型
type Collection struct {
	Name      string
	Dimension int
	Config    CollectionConfig
	Meta      CollectionMeta // 集合级别元数据

	// ID 映射 (External ID <-> Internal DocID)
	// ID 是任意字符串，DocID 是紧凑的整数索引
	IDMap  map[string]DocID
	DocMap []string // DocID -> External ID

	// 数据存储
	// Metas 存储原始 JSON bytes，解析由上层负责
	Metas [][]byte

	// HNSW 图索引（委托给 hnsw 子包）
	HNSWIdx *hnsw.HNSWIndex

	// 向量存储 (列式存储)
	Store *VectorStore

	Mu sync.RWMutex
}

// Database 数据库 (包含多个集合)
type Database struct {
	Path        string
	Collections map[string]*Collection
	mu          sync.RWMutex
}

// =========================================
// 构造函数
// =========================================

func NewDatabase(path string) *Database {
	return &Database{
		Path:        path,
		Collections: make(map[string]*Collection),
	}
}

func NewCollection(name string, dimension int) *Collection {
	config := DefaultConfig()
	// 如果是新建，初始化 Store
	store := NewVectorStore(dimension)

	hnswConfig := hnsw.Config{
		M:              config.M,
		EfConstruction: config.EfConstruction,
		EfSearch:       config.EfSearch,
		MaxLevel:       config.MaxLevel,
		MetricType:     config.MetricType,
	}

	return &Collection{
		Name:      name,
		Dimension: dimension,
		Config:    config,

		IDMap:  make(map[string]DocID),
		DocMap: make([]string, 0),
		Metas:  make([][]byte, 0),

		HNSWIdx: hnsw.NewHNSWIndex(dimension, hnswConfig, store),
		Store:   store,
	}
}

func DefaultConfig() CollectionConfig {
	return CollectionConfig{
		M:              16,
		EfConstruction: 200,
		EfSearch:       64, // 针对 1-bit 查询优化
		MaxLevel:       16,
		MetricType:     "cosine",
	}
}

// =========================================
// 核心方法
// =========================================

// GetDocID 获取内部 DocID
func (c *Collection) GetDocID(id string) (DocID, bool) {
	c.Mu.RLock()
	defer c.Mu.RUnlock()
	docID, ok := c.IDMap[id]
	return docID, ok
}

// GetExternalID 获取外部 ID
func (c *Collection) GetExternalID(docID DocID) (string, bool) {
	c.Mu.RLock()
	defer c.Mu.RUnlock()
	if int(docID) >= len(c.DocMap) {
		return "", false
	}
	return c.DocMap[docID], true
}

// GetMeta 获取元数据 (Raw JSON)
func (c *Collection) GetMeta(docID DocID) (json.RawMessage, bool) {
	c.Mu.RLock()
	defer c.Mu.RUnlock()
	if int(docID) >= len(c.Metas) {
		return nil, false
	}
	return json.RawMessage(c.Metas[docID]), true
}

// GetNodeLevel 获取节点最大层级
func (c *Collection) GetNodeLevel(docID DocID) int {
	return c.HNSWIdx.GetItemLevel(docID)
}

// GetLevelNeighborIDs 获取指定层级的邻居
func (c *Collection) GetLevelNeighborIDs(docID DocID, level int) []DocID {
	return c.HNSWIdx.GetLevelNeighborIDs(docID, level)
}

// ItemCount 返回有效项目数量
func (c *Collection) ItemCount() int {
	c.Mu.RLock()
	defer c.Mu.RUnlock()
	return len(c.IDMap)
}

// Database Helper
func (db *Database) GetCollection(name string) *Collection {
	db.mu.RLock()
	defer db.mu.RUnlock()
	return db.Collections[name]
}

func (db *Database) CreateCollection(name string, dimension int) (*Collection, error) {
	return db.CreateCollectionWithMeta(name, dimension, CollectionMeta{})
}

// CreateCollectionWithMeta 创建带元数据的集合
func (db *Database) CreateCollectionWithMeta(name string, dimension int, meta CollectionMeta) (*Collection, error) {
	db.mu.Lock()
	defer db.mu.Unlock()

	if c, exists := db.Collections[name]; exists {
		if c.Dimension != dimension {
			return nil, fmt.Errorf("collection %s already exists with dimension %d, requested %d", name, c.Dimension, dimension)
		}
		return c, nil
	}

	c := NewCollection(name, dimension)
	// 设置元数据，并确保创建时间
	if meta.Created == 0 {
		meta.Created = time.Now().Unix()
	}
	meta.Updated = meta.Created
	c.Meta = meta

	db.Collections[name] = c
	return c, nil
}

// DeleteCollection 删除集合及其持久化文件
func (db *Database) DeleteCollection(name string) error {
	db.mu.Lock()
	defer db.mu.Unlock()

	if _, exists := db.Collections[name]; !exists {
		return fmt.Errorf("collection %s not found", name)
	}

	delete(db.Collections, name)

	// 删除持久化文件目录
	collectionPath := filepath.Join(db.Path, name)
	if err := os.RemoveAll(collectionPath); err != nil {
		// 集合已从内存移除，文件删除失败只记录警告
		return fmt.Errorf("collection removed from memory but failed to delete files: %w", err)
	}

	return nil
}

// CollectionInfo 集合信息摘要
type CollectionInfo struct {
	Name      string `json:"name"`
	Dimension int    `json:"dimension"`
	Count     int    `json:"count"`
}

// ListCollections 列出所有集合
func (db *Database) ListCollections() []CollectionInfo {
	db.mu.RLock()
	defer db.mu.RUnlock()

	result := make([]CollectionInfo, 0, len(db.Collections))
	for name, col := range db.Collections {
		result = append(result, CollectionInfo{
			Name:      name,
			Dimension: col.Dimension,
			Count:     len(col.IDMap),
		})
	}
	return result
}

// 兼容性辅助函数 (如果需要)
// Item struct is minimal now as it's not core anymore
type Item struct {
	ID    string
	DocID DocID
	Meta  map[string]interface{}
}
