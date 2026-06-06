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
	"sync"

	"github.com/siyuan-note/siyuan/kernel/vectordb/bbq"
	"github.com/siyuan-note/siyuan/kernel/vectordb/hnsw"
	"github.com/vmihailenco/msgpack/v5"
)

// =========================================
// Persistence layer
// =========================================

const (
	SnapshotFileName = "snapshot.msgpack"
	WALFileName      = "wal.msgpack"
)

type SnapshotData struct {
	Name      string           `msgpack:"name"`
	Dimension int              `msgpack:"dimension"`
	Config    CollectionConfig `msgpack:"config"`
	Meta      CollectionMeta   `msgpack:"meta"`

	DocMap []string         `msgpack:"docMap"`
	IDMap  map[string]DocID `msgpack:"idMap"`

	Metas [][]byte `msgpack:"metas"`

	Neighbors [][][]DocID    `msgpack:"neighbors"`
	Deleted   map[DocID]bool `msgpack:"deleted"`

	Vectors        []float32                `msgpack:"vectors"`
	BBQQuantized   []byte                   `msgpack:"bbqQuantized"`
	BBQPacked      []byte                   `msgpack:"bbqPacked"`
	BBQCorrections []bbq.QuantizationResult `msgpack:"bbqCorrections"`

	EntryPoint DocID `msgpack:"entryPoint"`
	MaxLayer   int   `msgpack:"maxLayer"`
}

type WALEntry struct {
	Op     int      `msgpack:"op"`
	Points []Point  `msgpack:"points,omitempty"`
	Keys   []string `msgpack:"keys,omitempty"`
}

const (
	OpAdd    = 1
	OpDelete = 2
)

// SaveCollection saves a collection snapshot.
// For HNSW-backed collections: msgpack snapshot.
// For Vamana-backed collections: no-op (data is already on disk).
func SaveCollection(vc VectorCollection, basePath string) error {
	c, ok := vc.(*Collection)
	if !ok {
		return nil
	}

	c.Mu.RLock()
	defer c.Mu.RUnlock()

	collectionPath := filepath.Join(basePath, c.ColName)
	if err := os.MkdirAll(collectionPath, 0755); err != nil {
		return err
	}

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

	c.HNSWIdx.Mu.RLock()
	neighbors := make([][][]DocID, len(c.HNSWIdx.Neighbors))
	for i, levels := range c.HNSWIdx.Neighbors {
		neighbors[i] = make([][]DocID, len(levels))
		for j, records := range levels {
			ids := make([]DocID, len(records))
			for k, r := range records {
				ids[k] = r.ID
			}
			neighbors[i][j] = ids
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
		Name:           c.ColName,
		Dimension:      c.ColDim,
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

	walPath := filepath.Join(collectionPath, WALFileName)
	os.Remove(walPath)

	return nil
}

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

	store := NewVectorStore(snapshot.Dimension, snapshot.Config.MetricType)
	store.vectors = snapshot.Vectors
	store.bbqQuantized = snapshot.BBQQuantized
	store.bbqPacked = snapshot.BBQPacked
	store.bbqCorrections = snapshot.BBQCorrections

	hnswNeighbors := make([][][]hnsw.NeighborRecord, len(snapshot.Neighbors))
	for i, levels := range snapshot.Neighbors {
		hnswNeighbors[i] = make([][]hnsw.NeighborRecord, len(levels))
		for j, ids := range levels {
			records := make([]hnsw.NeighborRecord, len(ids))
			for k, id := range ids {
				records[k] = hnsw.NeighborRecord{ID: id, Distance: 0}
			}
			hnswNeighbors[i][j] = records
		}
	}

	deleted := snapshot.Deleted
	if deleted == nil {
		deleted = make(map[DocID]bool)
	}

	hnswConfig := hnsw.Config{
		M:              snapshot.Config.M,
		EfConstruction: snapshot.Config.EfConstruction,
		EfSearch:       snapshot.Config.EfSearch,
		MaxLevel:       snapshot.Config.MaxLevel,
		MetricType:     snapshot.Config.MetricType,
	}

	hnswIdx := hnsw.NewHNSWIndex(snapshot.Dimension, hnswConfig, store)
	hnswIdx.Neighbors = hnswNeighbors
	hnswIdx.Deleted = deleted
	hnswIdx.EntryPoint = snapshot.EntryPoint
	hnswIdx.MaxLayer = snapshot.MaxLayer

	nodeLocks := make([]sync.Mutex, len(hnswNeighbors))
	hnswIdx.SetNodeLocks(nodeLocks)

	idMap := snapshot.IDMap
	if idMap == nil {
		idMap = make(map[string]DocID)
	}

	c = &Collection{
		ColName: snapshot.Name,
		ColDim:  snapshot.Dimension,
		Config:  snapshot.Config,
		Meta:    snapshot.Meta,
		IDMap:   idMap,
		DocMap:  snapshot.DocMap,
		Store:   store,
		Metas:   snapshot.Metas,
		HNSWIdx: hnswIdx,
	}

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

func AppendWALAdd(c *Collection, basePath string, points []Point) error {
	return appendWAL(c.ColName, basePath, WALEntry{Op: OpAdd, Points: points})
}

func AppendWALDelete(c *Collection, basePath string, keys []string) error {
	return appendWAL(c.ColName, basePath, WALEntry{Op: OpDelete, Keys: keys})
}

func appendWAL(name string, basePath string, entry WALEntry) error {
	collectionPath := filepath.Join(basePath, name)
	if err := os.MkdirAll(collectionPath, 0755); err != nil {
		return err
	}

	walPath := filepath.Join(collectionPath, WALFileName)
	f, err := os.OpenFile(walPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return err
	}
	defer f.Close()

	encoder := msgpack.NewEncoder(f)
	return encoder.Encode(entry)
}

func atomicWriteFile(path string, data []byte) (err error) {
	dir := filepath.Dir(path)
	tmpFile, err := os.CreateTemp(dir, ".snapshot-*.tmp")
	if err != nil {
		return err
	}

	success := false
	defer func() {
		tmpFile.Close()
		if !success {
			os.Remove(tmpFile.Name())
		}
	}()

	if _, err := tmpFile.Write(data); err != nil {
		return err
	}
	if err := tmpFile.Sync(); err != nil {
		return err
	}
	if err := tmpFile.Close(); err != nil {
		return err
	}

	if err := os.Rename(tmpFile.Name(), path); err != nil {
		return err
	}

	success = true
	return nil
}

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
		db.Collections[collection.ColName] = collection
	}

	return db, nil
}
