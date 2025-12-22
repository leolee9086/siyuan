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

	"sync"
)

// =========================================
// 核心类型定义 (v2 API)
// =========================================

type DocID uint32

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

// Collection 向量集合
// 采用 "Point" 概念，不感知上层模型
type Collection struct {
	Name      string
	Dimension int
	Config    CollectionConfig

	// ID 映射 (External ID <-> Internal DocID)
	// ID 是任意字符串，DocID 是紧凑的整数索引
	IDMap  map[string]DocID
	DocMap []string // DocID -> External ID

	// 数据存储
	// Metas 存储原始 JSON bytes，解析由上层负责
	Metas [][]byte

	// 图结构 (HNSW)
	// Neighbors[docID][level] -> []neighborDocIDs
	Neighbors [][][]DocID
	Deleted   map[DocID]bool

	// 向量存储 (列式存储)
	Store *VectorStore

	// HNSW 入口点
	EntryPoint DocID
	MaxLayer   int

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

	return &Collection{
		Name:      name,
		Dimension: dimension,
		Config:    config,

		IDMap:     make(map[string]DocID),
		DocMap:    make([]string, 0),
		Metas:     make([][]byte, 0),
		Neighbors: make([][][]DocID, 0),
		Deleted:   make(map[DocID]bool),

		Store: store,

		EntryPoint: DocID(0xFFFFFFFF),
		MaxLayer:   -1,
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
	c.Mu.RLock()
	defer c.Mu.RUnlock()

	if int(docID) >= len(c.Neighbors) || c.Neighbors[docID] == nil {
		return -1
	}
	return len(c.Neighbors[docID]) - 1
}

// GetLevelNeighborIDs 获取指定层级的邻居
func (c *Collection) GetLevelNeighborIDs(docID DocID, level int) []DocID {
	// 注意：调用方应持有读锁或写锁
	// 这里为了性能不加锁，由调用方保证安全
	if int(docID) >= len(c.Neighbors) {
		return nil
	}
	if level < 0 || level >= len(c.Neighbors[docID]) {
		return nil
	}
	return c.Neighbors[docID][level]
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
	db.mu.Lock()
	defer db.mu.Unlock()

	if c, exists := db.Collections[name]; exists {
		if c.Dimension != dimension {
			// 维度不匹配警告或错误，目前简单返回旧的
			// 在实际应用中可能需要报错
		}
		return c, nil
	}

	c := NewCollection(name, dimension)
	db.Collections[name] = c
	return c, nil
}

// 兼容性辅助函数 (如果需要)
// Item struct is minimal now as it's not core anymore
type Item struct {
	ID      string
	DocID   DocID
	Meta    map[string]interface{}
}
