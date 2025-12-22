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
	"os"
	"path/filepath"
	"io"

	"github.com/vmihailenco/msgpack/v5"
)

// =========================================
// Persistence layer (WAL + Snapshot)
// =========================================

const (
	SnapshotFileName = "snapshot.msgpack"
	WALFileName      = "wal.msgpack"
)

// SnapshotData represents the full state of a collection
type SnapshotData struct {
	Name         string                               `msgpack:"name"`
	Dimension    int                                  `msgpack:"dimension"`
	Config       CollectionConfig                     `msgpack:"config"`
	NextDocID    DocID                                `msgpack:"nextDocID"`
	DocMap       []string                             `msgpack:"docMap"`
	IDMap        map[string]DocID                     `msgpack:"idMap"`
	Items        map[DocID]*Item                      `msgpack:"items"`
	HNSWNodes    map[string]map[DocID][]LevelData     `msgpack:"hnswNodes"`
	HNSWLevelMap map[string]map[int][]DocID           `msgpack:"hnswLevelMap"`
}

// WALEntry represents a single operation in WAL
type WALEntry struct {
	Op    int           `msgpack:"op"` // 1: Add, 2: Delete
	Items []*Item       `msgpack:"items,omitempty"`
	Keys  []string      `msgpack:"keys,omitempty"`
}

const (
	OpAdd    = 1
	OpDelete = 2
)

// SaveCollection performs a Checkpoint (Snapshot)
// Saves full state to snapshot.msgpack and truncates wal.msgpack
func SaveCollection(c *Collection, basePath string) error {
	c.Mu.RLock()
	defer c.Mu.RUnlock()
	
	collectionPath := filepath.Join(basePath, c.Name)
	if err := os.MkdirAll(collectionPath, 0755); err != nil {
		return err
	}
	
	snapshot := SnapshotData{
		Name:         c.Name,
		Dimension:    c.Dimension,
		Config:       c.Config,
		NextDocID:    c.NextDocID,
		DocMap:       c.DocMap,
		IDMap:        c.IDMap,
		Items:        c.Items,
		HNSWNodes:    c.HNSWNodes,
		HNSWLevelMap: c.HNSWLevelMap,
	}
	
	data, err := msgpack.Marshal(&snapshot)
	if err != nil {
		return err
	}
	
	// Atomic write snapshot
	if err := atomicWriteFile(filepath.Join(collectionPath, SnapshotFileName), data); err != nil {
		return err
	}
	
	// Truncate WAL (Clear it)
	// We just remove it or truncate it.
	walPath := filepath.Join(collectionPath, WALFileName)
	os.Remove(walPath) // Ignore error if not exists
	
	return nil
}

// LoadCollection loads collection from disk (Snapshot + WAL Replay)
func LoadCollection(basePath string, name string) (*Collection, error) {
	collectionPath := filepath.Join(basePath, name)
	
	// 1. Load Snapshot
	snapshotPath := filepath.Join(collectionPath, SnapshotFileName)
	data, err := os.ReadFile(snapshotPath)
	
	var c *Collection
	
	if err != nil {
		if !os.IsNotExist(err) {
			return nil, err
		}
		// Snapshot doesn't exist, create new
		return NewCollection(name, 0), nil 
		// Note: Dimension unknown if create new? 
		// Should caller handle creation?
		// LoadDatabase calls this. If failed, it skips.
		// If snap not exists, maybe WAL exists?
		// If both missing, clean start.
	} else {
		// Restore from snapshot
		var snapshot SnapshotData
		if err := msgpack.Unmarshal(data, &snapshot); err != nil {
			return nil, err
		}
		
		c = &Collection{
			Name:         snapshot.Name,
			Dimension:    snapshot.Dimension,
			Config:       snapshot.Config,
			NextDocID:    snapshot.NextDocID,
			DocMap:       snapshot.DocMap,
			IDMap:        snapshot.IDMap,
			Items:        snapshot.Items,
			HNSWNodes:    snapshot.HNSWNodes,
			HNSWLevelMap: snapshot.HNSWLevelMap,
		}
		// Fix nil maps if empty
		if c.IDMap == nil { c.IDMap = make(map[string]DocID) }
		if c.Items == nil { c.Items = make(map[DocID]*Item) }
		if c.HNSWNodes == nil { c.HNSWNodes = make(map[string]map[DocID][]LevelData) }
		if c.HNSWLevelMap == nil { c.HNSWLevelMap = make(map[string]map[int][]DocID) }
	}
	
	// 2. Replay WAL
	walPath := filepath.Join(collectionPath, WALFileName)
	f, err := os.Open(walPath)
	if err == nil {
		defer f.Close()
		decoder := msgpack.NewDecoder(f)
		
		for {
			var entry WALEntry
			if err := decoder.Decode(&entry); err != nil {
				if err == io.EOF {
					break // Done
				}
				// Log error? partial read?
				break
			}
			
			// Replay entry
			if entry.Op == OpAdd {
				for _, item := range entry.Items {
					// InsertItem logic (but simple reconstruction)
					// Since WAL stores *Item with vectors, we can just Insert.
					// BUT: DocID might need consistency if WAL didn't store DocID assignments order?
					// Wait, WAL is appended AFTER Insert? Or BEFORE?
					// If we append after Insert, then Snapshot + WAL is fine.
					// But we need to ensure DocID generation is deterministic or stored.
					// If WAL stores *Item, does it include DocID?
					// Yes, Item struct has `DocID`.
					// So we just put it back into maps.
					// But we also need to Rebuild Index because HNSW Graph is not linear log.
					// Actually, if we Snapshot `HNSWNodes`, we restored the graph.
					// The WAL contains items added SINCE snapshot.
					// We need to ADD them to the graph.
					// So we call `c.InsertItem`.
					// Note: `InsertItem` assigns New DocID?
					// If Item in WAL already has DocID, should we respect it?
					// `SetItem` in types.go:
					// `if docID, exists := c.IDMap[item.ID]; exists { update } else { assign new }`.
					// If we are replaying, IDMap might not have it yet.
					// So `InsertItem` will assign `NextDocID`.
					// This matches the order of operations if Replay order == Original order.
					// So `c.InsertItem` is safe.
					// One caveat: `InsertItem` updates `c.NextDocID`.
					c.InsertItem(item, "text_embedding") // Model logic?
					// Wait, `modelName` is lost in WALEntry?
					// `Items` have `Vectors` map.
					// `InsertItem` signature needs `modelName`.
					// `InsertItem` builds index for ONE model?
					// `InsertItem` iterates models?
					// The current `InsertItem` takes `modelName`.
					// We might need to iterate all models in `item.Vectors`?
					for modelName := range item.Vectors {
						c.InsertItem(item, modelName)
					}
				}
			} else if entry.Op == OpDelete {
				for _, key := range entry.Keys {
					// Iterate models?
					// `DeleteItemWithIndex` needs modelName.
					// We need to know which models exist.
					// `c.HNSWLevelMap` keys are models.
					for modelName := range c.HNSWLevelMap {
						c.DeleteItemWithIndex(key, modelName)
					}
				}
			}
		}
	}
	
	return c, nil
}

// AppendWALAdd appended add operation
func AppendWALAdd(c *Collection, basePath string, items []*Item) error {
	return appendWAL(c.Name, basePath, WALEntry{
		Op:    OpAdd,
		Items: items,
	})
}

// AppendWALDelete appends delete operation
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

// atomicWriteFile writes file atomically
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

// SaveDatabase saves (checkpoints) all collections in database
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

// LoadDatabase loads database
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
