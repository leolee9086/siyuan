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
    // New fields
    Nodes        []NodeData                           `msgpack:"nodes"`
    Vectors      []float32                            `msgpack:"vectors"`
    // BBQ量化存储
    BBQQuantized   []byte                             `msgpack:"bbqQuantized"`
    BBQPacked      []byte                             `msgpack:"bbqPacked"`
    BBQCorrections []量化结果                          `msgpack:"bbqCorrections"`
    EntryPoint   DocID                                `msgpack:"entryPoint"`
    MaxLayer     int                                  `msgpack:"maxLayer"`
    
	// HNSWNodes    map[string]map[DocID][]LevelData     `msgpack:"hnswNodes"` // Deprecated
	// HNSWLevelMap map[string]map[int][]DocID           `msgpack:"hnswLevelMap"` // Deprecated
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
func SaveCollection(c *Collection, basePath string) error {
	c.Mu.RLock()
	defer c.Mu.RUnlock()
	
	collectionPath := filepath.Join(basePath, c.Name)
	if err := os.MkdirAll(collectionPath, 0755); err != nil {
		return err
	}
    
    // Lock store for read
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
	
	snapshot := SnapshotData{
		Name:           c.Name,
		Dimension:      c.Dimension,
		Config:         c.Config,
		NextDocID:      c.NextDocID,
		DocMap:         c.DocMap,
		IDMap:          c.IDMap,
		Items:          c.Items,
        Nodes:          c.Nodes,
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
	
	// Atomic write snapshot
	if err := atomicWriteFile(filepath.Join(collectionPath, SnapshotFileName), data); err != nil {
		return err
	}
    
    // ... rest same
    walPath := filepath.Join(collectionPath, WALFileName)
    os.Remove(walPath)
    
    return nil
}

// LoadCollection loads collection from disk
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
	} else {
		// Restore from snapshot
		var snapshot SnapshotData
		if err := msgpack.Unmarshal(data, &snapshot); err != nil {
			return nil, err
		}
		
        store := NewVectorStore(snapshot.Dimension)
        store.vectors = snapshot.Vectors
        store.bbqQuantized = snapshot.BBQQuantized
        store.bbqPacked = snapshot.BBQPacked
        store.bbqCorrections = snapshot.BBQCorrections
		
		c = &Collection{
			Name:         snapshot.Name,
			Dimension:    snapshot.Dimension,
			Config:       snapshot.Config,
			NextDocID:    snapshot.NextDocID,
			DocMap:       snapshot.DocMap,
			IDMap:        snapshot.IDMap,
			Items:        snapshot.Items,
            Nodes:        snapshot.Nodes,
            Store:        store,
            EntryPoint:   snapshot.EntryPoint,
            MaxLayer:     snapshot.MaxLayer,
		}
		// Fix nil maps if empty
		if c.IDMap == nil { c.IDMap = make(map[string]DocID) }
		if c.Items == nil { c.Items = make(map[DocID]*Item) }
        if c.Nodes == nil { c.Nodes = make([]NodeData, 0) }
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
				break
			}
			
			// Replay entry
			if entry.Op == OpAdd {
				for _, item := range entry.Items {
					// InsertItem logic
                    // We need modelName. Item struct doesn't strictly have a "Main Model".
                    // But InsertItem iterates models if we call it safely?
                    // Or we assume "text_embedding" or similar.
                    // For correctness, we should iterate keys in item.Vectors
                    if item.Vectors != nil {
                        for modelName := range item.Vectors {
                            c.InsertItem(item, modelName)
                        }
                    } else {
                        // fallback
                        c.InsertItem(item, "")
                    }
				}
			} else if entry.Op == OpDelete {
				for _, key := range entry.Keys {
                    c.DeleteItemWithIndex(key, "")
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
