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

// Package vectordb 提供嵌入式向量数据库
// 基于 HNSW 算法实现高效近似最近邻搜索
// 设计参考: toread/src/vector.optimized.ts
package vectordb

import (
	"sync"
)

// =========================================
// 核心类型定义 (简化版)
// =========================================

// DocID 内部整数 ID，用于数组索引
type DocID uint32

// =========================================
// Collection 数据集 (简化版)
// 参考 TS 实现: vectors[], norms[], neighbors[][][]
// =========================================

// Collection 向量集合
type Collection struct {
	Name      string           `msgpack:"name"`
	Dimension int              `msgpack:"dimension"`
	Config    CollectionConfig `msgpack:"config"`

	// === ID 映射 ===
	IDMap  map[string]DocID `msgpack:"-"` // 外部ID -> DocID
	DocMap []string         `msgpack:"-"` // DocID -> 外部ID (索引即 DocID)

	// === 向量存储 (统一存储，无冗余) ===
	Store *VectorStore `msgpack:"-"`

	// === 元数据 (简化存储) ===
	// 使用 slice 而非 map，DocID 直接索引
	Metas []map[string]interface{} `msgpack:"-"`

	// === 图索引 ===
	// neighbors[nodeID][level] -> []DocID
	// 参考 TS: const neighbors: number[][][] = []
	Neighbors [][]docIDSlice `msgpack:"-"`

	// === 删除标记 ===
	Deleted map[DocID]bool `msgpack:"-"`

	// === 入口点 ===
	EntryPoint DocID `msgpack:"entryPoint"`
	MaxLayer   int   `msgpack:"maxLayer"`

	// === 同步 ===
	Mu sync.RWMutex `msgpack:"-"`
}

// docIDSlice 邻居 ID 列表 (避免 [][]DocID 的类型别名问题)
type docIDSlice []DocID

// NeighborRecord 邻居记录 (搜索时使用)
type NeighborRecord struct {
	ID       DocID
	Distance float32
}

// CollectionConfig 配置
type CollectionConfig struct {
	M              int    `msgpack:"m"`
	EfConstruction int    `msgpack:"efConstruction"`
	EfSearch       int    `msgpack:"efSearch"`
	MaxLevel       int    `msgpack:"maxLevel"`
	MetricType     string `msgpack:"metricType"`
}

// DefaultCollectionConfig 默认配置
func DefaultCollectionConfig() CollectionConfig {
	return CollectionConfig{
		M:              16,
		EfConstruction: 200,
		EfSearch:       64,
		MaxLevel:       16,
		MetricType:     "cosine",
	}
}

// =========================================
// Database 与 Storage
// =========================================

// Database 数据库
type Database struct {
	Path        string                 `msgpack:"path"`
	Collections map[string]*Collection `msgpack:"-"`
	mu          sync.RWMutex           `msgpack:"-"`
}

// VectorStorage 根存储
type VectorStorage struct {
	Databases map[string]*Database `msgpack:"-"`
	mu        sync.RWMutex         `msgpack:"-"`
}

// =========================================
// 构造函数
// =========================================

// NewCollection 创建新集合
func NewCollection(name string, dimension int) *Collection {
	return &Collection{
		Name:      name,
		Dimension: dimension,
		Config:    DefaultCollectionConfig(),

		IDMap:     make(map[string]DocID),
		DocMap:    make([]string, 0, 1000),
		Store:     NewVectorStore(dimension),
		Metas:     make([]map[string]interface{}, 0, 1000),
		Neighbors: make([][]docIDSlice, 0, 1000),
		Deleted:   make(map[DocID]bool),

		EntryPoint: DocID(0xFFFFFFFF), // 无效 ID
		MaxLayer:   -1,
	}
}

// NewDatabase 创建新数据库
func NewDatabase(path string) *Database {
	return &Database{
		Path:        path,
		Collections: make(map[string]*Collection),
	}
}

// NewVectorStorage 创建根存储
func NewVectorStorage() *VectorStorage {
	return &VectorStorage{
		Databases: make(map[string]*Database),
	}
}

// =========================================
// Collection 方法
// =========================================

// ItemCount 返回有效项目数
func (c *Collection) ItemCount() int {
	c.Mu.RLock()
	defer c.Mu.RUnlock()
	return len(c.DocMap) - len(c.Deleted)
}

// IsValidNode 检查节点是否有效
func (c *Collection) IsValidNode(docID DocID) bool {
	return int(docID) < len(c.DocMap) && !c.Deleted[docID]
}

// GetDocID 通过外部 ID 获取 DocID
func (c *Collection) GetDocID(id string) (DocID, bool) {
	c.Mu.RLock()
	defer c.Mu.RUnlock()
	docID, ok := c.IDMap[id]
	return docID, ok
}

// GetExternalID 通过 DocID 获取外部 ID
func (c *Collection) GetExternalID(docID DocID) (string, bool) {
	c.Mu.RLock()
	defer c.Mu.RUnlock()
	if int(docID) >= len(c.DocMap) {
		return "", false
	}
	return c.DocMap[docID], true
}

// GetMeta 获取元数据
func (c *Collection) GetMeta(docID DocID) (map[string]interface{}, bool) {
	c.Mu.RLock()
	defer c.Mu.RUnlock()
	if int(docID) >= len(c.Metas) {
		return nil, false
	}
	return c.Metas[docID], true
}

// GetLevelNeighborIDs 获取指定层级的邻居 (零分配版本)
func (c *Collection) GetLevelNeighborIDs(docID DocID, level int) []DocID {
	if int(docID) >= len(c.Neighbors) {
		return nil
	}
	if level >= len(c.Neighbors[docID]) {
		return nil
	}
	return c.Neighbors[docID][level]
}

// SetLevelNeighbors 设置指定层级的邻居
func (c *Collection) SetLevelNeighbors(docID DocID, level int, neighborIDs []DocID) {
	// 确保邻居数组足够大
	for int(docID) >= len(c.Neighbors) {
		c.Neighbors = append(c.Neighbors, nil)
	}
	// 确保层级数组足够大
	for level >= len(c.Neighbors[docID]) {
		c.Neighbors[docID] = append(c.Neighbors[docID], nil)
	}
	c.Neighbors[docID][level] = neighborIDs
}

// GetNodeLevel 获取节点最大层级
func (c *Collection) GetNodeLevel(docID DocID) int {
	if int(docID) >= len(c.Neighbors) {
		return -1
	}
	return len(c.Neighbors[docID]) - 1
}

// =========================================
// 兼容性 (逐步移除)
// =========================================

// Item 简化版 (仅用于 API 兼容)
type Item struct {
	ID      string
	DocID   DocID
	Meta    map[string]interface{}
	Vectors map[string][]float32 // 兼容旧 API
}

// NewItem 创建新 Item
func NewItem(id string) *Item {
	return &Item{
		ID:      id,
		Meta:    make(map[string]interface{}),
		Vectors: make(map[string][]float32),
	}
}

// GetVector 获取向量 (兼容方法)
func (item *Item) GetVector(modelName string) ([]float32, bool) {
	vec, ok := item.Vectors[modelName]
	return vec, ok
}

// SetVector 设置向量 (兼容方法)
func (item *Item) SetVector(modelName string, vector []float32) {
	item.Vectors[modelName] = vector
}

// SetItem 设置项目 (兼容方法)
func (c *Collection) SetItem(item *Item) {
	c.Mu.Lock()
	defer c.Mu.Unlock()

	// 检查是否已存在
	if docID, exists := c.IDMap[item.ID]; exists {
		// 更新现有项
		item.DocID = docID
		if int(docID) < len(c.Metas) {
			c.Metas[docID] = item.Meta
		}
	} else {
		// 分配新 DocID
		docID := DocID(len(c.DocMap))
		item.DocID = docID

		c.IDMap[item.ID] = docID
		c.DocMap = append(c.DocMap, item.ID)
		c.Metas = append(c.Metas, item.Meta)
	}
}

// 兼容方法 - 逐步移除
func (c *Collection) GetItem(id string) (*Item, bool) {
	c.Mu.RLock()
	defer c.Mu.RUnlock()

	docID, ok := c.IDMap[id]
	if !ok {
		return nil, false
	}

	item := &Item{
		ID:    id,
		DocID: docID,
	}
	if int(docID) < len(c.Metas) {
		item.Meta = c.Metas[docID]
	}
	return item, true
}

// DeleteItem 删除项目 (软删除)
func (c *Collection) DeleteItem(id string) bool {
	c.Mu.Lock()
	defer c.Mu.Unlock()

	docID, ok := c.IDMap[id]
	if !ok {
		return false
	}

	c.Deleted[docID] = true
	delete(c.IDMap, id)
	return true
}

// InitLevelMap 兼容方法 (no-op)
func (c *Collection) InitLevelMap(modelName string) {}
