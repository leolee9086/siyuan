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
	"io"
	"os"
	"path/filepath"

	"github.com/siyuan-note/siyuan/kernel/vectordb/bbq"
	"github.com/siyuan-note/siyuan/kernel/vectordb/hnsw"
	"github.com/vmihailenco/msgpack/v5"
)

// =========================================
// 持久化层 (简化版)
// =========================================

const (
	SnapshotFileName = "snapshot.msgpack"
	WALFileName      = "wal.msgpack"
)

// SnapshotData 快照数据
type SnapshotData struct {
	Name      string           `msgpack:"name"`
	Dimension int              `msgpack:"dimension"`
	Config    CollectionConfig `msgpack:"config"`
	Meta      CollectionMeta   `msgpack:"meta"` // 集合元数据

	// ID 映射
	DocMap []string         `msgpack:"docMap"`
	IDMap  map[string]DocID `msgpack:"idMap"`

	// 元数据 (Raw JSON)
	Metas [][]byte `msgpack:"metas"`

	// 图结构
	// Neighbors[nodeID][level] -> []DocID
	Neighbors [][][]DocID    `msgpack:"neighbors"`
	Deleted   map[DocID]bool `msgpack:"deleted"`

	// 向量存储
	Vectors        []float32                `msgpack:"vectors"`
	BBQQuantized   []byte                   `msgpack:"bbqQuantized"`
	BBQPacked      []byte                   `msgpack:"bbqPacked"`
	BBQCorrections []bbq.QuantizationResult `msgpack:"bbqCorrections"`

	// 入口点
	EntryPoint DocID `msgpack:"entryPoint"`
	MaxLayer   int   `msgpack:"maxLayer"`
}

// WALEntry WAL 条目
type WALEntry struct {
	Op     int      `msgpack:"op"`
	Points []Point  `msgpack:"points,omitempty"`
	Keys   []string `msgpack:"keys,omitempty"`
}

const (
	OpAdd    = 1
	OpDelete = 2
)

// SaveCollection 保存集合快照
func SaveCollection(c *Collection, basePath string) error {
	c.Mu.RLock()
	defer c.Mu.RUnlock()

	collectionPath := filepath.Join(basePath, c.Name)
	if err := os.MkdirAll(collectionPath, 0755); err != nil {
		return err
	}

	// 复制向量存储
	c.Store.mu.RLock()
	vectors := make([]float32, len(c.Store.vectors))
	copy(vectors, c.Store.vectors)
	bbqQuantized := make([]byte, len(c.Store.bbqQuantized))
	copy(bbqQuantized, c.Store.bbqQuantized)
	bbqPacked := make([]byte, len(c.Store.bbqPacked))
	copy(bbqPacked, c.Store.bbqPacked)
	bbqCorrections := make([]bbq.QuantizationResult, len(c.Store.bbqCorrections))
	copy(bbqCorrections, c.Store.bbqCorrections)
	c.Store.mu.RUnlock()

	// 从 HNSWIdx 复制图结构
	c.HNSWIdx.Mu.RLock()
	neighbors := make([][][]DocID, len(c.HNSWIdx.Neighbors))
	for i, levels := range c.HNSWIdx.Neighbors {
		neighbors[i] = make([][]DocID, len(levels))
		for j, ids := range levels {
			neighbors[i][j] = make([]DocID, len(ids))
			copy(neighbors[i][j], ids)
		}
	}
	deleted := make(map[DocID]bool, len(c.HNSWIdx.Deleted))
	for k, v := range c.HNSWIdx.Deleted {
		deleted[k] = v
	}
	entryPoint := c.HNSWIdx.EntryPoint
	maxLayer := c.HNSWIdx.MaxLayer
	c.HNSWIdx.Mu.RUnlock()

	snapshot := SnapshotData{
		Name:           c.Name,
		Dimension:      c.Dimension,
		Config:         c.Config,
		Meta:           c.Meta,
		DocMap:         c.DocMap,
		IDMap:          c.IDMap,
		Metas:          c.Metas,
		Neighbors:      neighbors,
		Deleted:        deleted,
		Vectors:        vectors,
		BBQQuantized:   bbqQuantized,
		BBQPacked:      bbqPacked,
		BBQCorrections: bbqCorrections,
		EntryPoint:     entryPoint,
		MaxLayer:       maxLayer,
	}

	data, err := msgpack.Marshal(&snapshot)
	if err != nil {
		return err
	}

	if err := atomicWriteFile(filepath.Join(collectionPath, SnapshotFileName), data); err != nil {
		return err
	}

	// 清除 WAL
	walPath := filepath.Join(collectionPath, WALFileName)
	os.Remove(walPath)

	return nil
}

// LoadCollection 加载集合
func LoadCollection(basePath string, name string) (*Collection, error) {
	collectionPath := filepath.Join(basePath, name)

	snapshotPath := filepath.Join(collectionPath, SnapshotFileName)
	data, err := os.ReadFile(snapshotPath)

	var c *Collection

	if err != nil {
		if !os.IsNotExist(err) {
			return nil, err
		}
		return NewCollection(name, 0), nil
	}

	var snapshot SnapshotData
	if err := msgpack.Unmarshal(data, &snapshot); err != nil {
		return nil, err
	}

	store := NewVectorStore(snapshot.Dimension)
	store.vectors = snapshot.Vectors
	store.bbqQuantized = snapshot.BBQQuantized
	store.bbqPacked = snapshot.BBQPacked
	store.bbqCorrections = snapshot.BBQCorrections

	// 转换 Neighbors 格式
	neighbors := make([][][]DocID, len(snapshot.Neighbors))
	for i, levels := range snapshot.Neighbors {
		neighbors[i] = make([][]DocID, len(levels))
		for j, ids := range levels {
			neighbors[i][j] = ids
		}
	}

	// 修复空 map
	deleted := snapshot.Deleted
	if deleted == nil {
		deleted = make(map[DocID]bool)
	}

	// 构建 hnsw.Config
	hnswConfig := hnsw.Config{
		M:              snapshot.Config.M,
		EfConstruction: snapshot.Config.EfConstruction,
		EfSearch:       snapshot.Config.EfSearch,
		MaxLevel:       snapshot.Config.MaxLevel,
		MetricType:     snapshot.Config.MetricType,
	}

	// 创建 HNSWIndex 并恢复状态
	hnswIdx := hnsw.NewHNSWIndex(snapshot.Dimension, hnswConfig, store)
	hnswIdx.Neighbors = neighbors
	hnswIdx.Deleted = deleted
	hnswIdx.EntryPoint = snapshot.EntryPoint
	hnswIdx.MaxLayer = snapshot.MaxLayer

	idMap := snapshot.IDMap
	if idMap == nil {
		idMap = make(map[string]DocID)
	}

	c = &Collection{
		Name:      snapshot.Name,
		Dimension: snapshot.Dimension,
		Config:    snapshot.Config,
		Meta:      snapshot.Meta,
		IDMap:     idMap,
		DocMap:    snapshot.DocMap,
		Store:     store,
		Metas:     snapshot.Metas,
		HNSWIdx:   hnswIdx,
	}

	// 重放 WAL
	walPath := filepath.Join(collectionPath, WALFileName)
	f, err := os.Open(walPath)
	if err == nil {
		defer f.Close()
		decoder := msgpack.NewDecoder(f)

		for {
			var entry WALEntry
			if err := decoder.Decode(&entry); err != nil {
				if err == io.EOF {
					break
				}
				break
			}

			if entry.Op == OpAdd {
				for _, point := range entry.Points {
					c.InsertPoint(point)
				}
			} else if entry.Op == OpDelete {
				for _, key := range entry.Keys {
					c.DeleteItemWithIndex(key)
				}
			}
		}
	}

	return c, nil
}

// AppendWALAdd 追加添加操作
func AppendWALAdd(c *Collection, basePath string, points []Point) error {
	return appendWAL(c.Name, basePath, WALEntry{
		Op:     OpAdd,
		Points: points,
	})
}

// AppendWALDelete 追加删除操作
func AppendWALDelete(c *Collection, basePath string, keys []string) error {
	return appendWAL(c.Name, basePath, WALEntry{
		Op:   OpDelete,
		Keys: keys,
	})
}

func appendWAL(collectionName string, basePath string, entry WALEntry) error {
	collectionPath := filepath.Join(basePath, collectionName)
	if err := os.MkdirAll(collectionPath, 0755); err != nil {
		return err
	}

	f, err := os.OpenFile(filepath.Join(collectionPath, WALFileName), os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return err
	}
	defer f.Close()

	enc := msgpack.NewEncoder(f)
	return enc.Encode(entry)
}

func atomicWriteFile(path string, data []byte) error {
	dir := filepath.Dir(path)
	tmpFile, err := os.CreateTemp(dir, ".tmp-")
	if err != nil {
		return err
	}
	tmpPath := tmpFile.Name()

	success := false
	defer func() {
		if !success {
			os.Remove(tmpPath)
		}
	}()

	if _, err := tmpFile.Write(data); err != nil {
		tmpFile.Close()
		return err
	}

	if err := tmpFile.Sync(); err != nil {
		tmpFile.Close()
		return err
	}

	if err := tmpFile.Close(); err != nil {
		return err
	}

	if err := os.Rename(tmpPath, path); err != nil {
		return err
	}

	success = true
	return nil
}

// =========================================
// Database persistence
// =========================================

func SaveDatabase(db *Database) error {
	if err := os.MkdirAll(db.Path, 0755); err != nil {
		return err
	}

	db.mu.RLock()
	defer db.mu.RUnlock()

	for _, collection := range db.Collections {
		if err := SaveCollection(collection, db.Path); err != nil {
			return err
		}
	}

	return nil
}

func LoadDatabase(path string) (*Database, error) {
	db := NewDatabase(path)

	entries, err := os.ReadDir(path)
	if err != nil {
		if os.IsNotExist(err) {
			return db, nil
		}
		return nil, err
	}

	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		collection, err := LoadCollection(path, entry.Name())
		if err != nil {
			continue
		}
		db.Collections[collection.Name] = collection
	}

	return db, nil
}
