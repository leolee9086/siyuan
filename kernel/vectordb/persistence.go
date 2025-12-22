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

	// ID 映射
	DocMap []string         `msgpack:"docMap"`
	IDMap  map[string]DocID `msgpack:"idMap"`

	// 元数据 (Raw JSON)
	Metas [][]byte `msgpack:"metas"`

	// 图结构
	// Neighbors[nodeID][level] -> []DocID
	Neighbors [][][]DocID `msgpack:"neighbors"`
	Deleted   map[DocID]bool `msgpack:"deleted"`

	// 向量存储
	Vectors        []float32    `msgpack:"vectors"`
	BBQQuantized   []byte       `msgpack:"bbqQuantized"`
	BBQPacked      []byte       `msgpack:"bbqPacked"`
	BBQCorrections []量化结果   `msgpack:"bbqCorrections"`

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
	bbqCorrections := make([]量化结果, len(c.Store.bbqCorrections))
	copy(bbqCorrections, c.Store.bbqCorrections)
	c.Store.mu.RUnlock()

	// 转换 Neighbors 格式
	neighbors := make([][][]DocID, len(c.Neighbors))
	for i, levels := range c.Neighbors {
		neighbors[i] = make([][]DocID, len(levels))
		for j, ids := range levels {
			neighbors[i][j] = make([]DocID, len(ids))
			copy(neighbors[i][j], ids)
		}
	}

	snapshot := SnapshotData{
		Name:           c.Name,
		Dimension:      c.Dimension,
		Config:         c.Config,
		DocMap:         c.DocMap,
		IDMap:          c.IDMap,
		Metas:          c.Metas,
		Neighbors:      neighbors,
		Deleted:        c.Deleted,
		Vectors:        vectors,
		BBQQuantized:   bbqQuantized,
		BBQPacked:      bbqPacked,
		BBQCorrections: bbqCorrections,
		EntryPoint:     c.EntryPoint,
		MaxLayer:       c.MaxLayer,
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

	c = &Collection{
		Name:       snapshot.Name,
		Dimension:  snapshot.Dimension,
		Config:     snapshot.Config,
		IDMap:      snapshot.IDMap,
		DocMap:     snapshot.DocMap,
		Store:      store,
		Metas:      snapshot.Metas,
		Neighbors:  neighbors,
		Deleted:    snapshot.Deleted,
		EntryPoint: snapshot.EntryPoint,
		MaxLayer:   snapshot.MaxLayer,
	}

	// 修复空 map
	if c.IDMap == nil {
		c.IDMap = make(map[string]DocID)
	}
	if c.Deleted == nil {
		c.Deleted = make(map[DocID]bool)
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
