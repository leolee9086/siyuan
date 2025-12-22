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

	"github.com/vmihailenco/msgpack/v5"
)

// =========================================
// Persistence layer
// =========================================

// CollectionMeta collection metadata for persistence
type CollectionMeta struct {
	Name         string                      `msgpack:"name"`
	Dimension    int                         `msgpack:"dimension"`
	Config       CollectionConfig            `msgpack:"config"`
	HNSWLevelMap map[string]map[int][]string `msgpack:"hnswLevelMap"`
	ItemCount    int                         `msgpack:"itemCount"`
}

// SaveCollection saves collection to disk
func SaveCollection(c *Collection, basePath string) error {
	collectionPath := filepath.Join(basePath, c.Name)
	if err := os.MkdirAll(collectionPath, 0755); err != nil {
		return err
	}

	meta := CollectionMeta{
		Name:         c.Name,
		Dimension:    c.Dimension,
		Config:       c.Config,
		HNSWLevelMap: c.HNSWLevelMap,
		ItemCount:    c.ItemCount(),
	}
	if err := saveMetadata(collectionPath, &meta); err != nil {
		return err
	}

	c.Mu.RLock()
	defer c.Mu.RUnlock()

	for id, item := range c.Items {
		if err := saveItem(collectionPath, id, item); err != nil {
			return err
		}
	}

	return nil
}

// LoadCollection loads collection from disk
func LoadCollection(basePath string, name string) (*Collection, error) {
	collectionPath := filepath.Join(basePath, name)

	meta, err := loadMetadata(collectionPath)
	if err != nil {
		return nil, err
	}

	c := &Collection{
		Name:         meta.Name,
		Dimension:    meta.Dimension,
		Config:       meta.Config,
		HNSWLevelMap: meta.HNSWLevelMap,
		Items:        make(map[string]*Item),
	}

	itemsPath := filepath.Join(collectionPath, "items")
	entries, err := os.ReadDir(itemsPath)
	if err != nil {
		if os.IsNotExist(err) {
			return c, nil
		}
		return nil, err
	}

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		if filepath.Ext(entry.Name()) != ".msgpack" {
			continue
		}

		id := entry.Name()[:len(entry.Name())-8]
		item, err := loadItem(collectionPath, id)
		if err != nil {
			continue
		}
		c.Items[item.ID] = item
	}

	return c, nil
}

func saveMetadata(collectionPath string, meta *CollectionMeta) error {
	data, err := msgpack.Marshal(meta)
	if err != nil {
		return err
	}
	return atomicWriteFile(filepath.Join(collectionPath, "meta.msgpack"), data)
}

func loadMetadata(collectionPath string) (*CollectionMeta, error) {
	data, err := os.ReadFile(filepath.Join(collectionPath, "meta.msgpack"))
	if err != nil {
		return nil, err
	}

	var meta CollectionMeta
	if err := msgpack.Unmarshal(data, &meta); err != nil {
		return nil, err
	}
	return &meta, nil
}

func saveItem(collectionPath string, id string, item *Item) error {
	itemsPath := filepath.Join(collectionPath, "items")
	if err := os.MkdirAll(itemsPath, 0755); err != nil {
		return err
	}

	data, err := msgpack.Marshal(item)
	if err != nil {
		return err
	}

	return atomicWriteFile(filepath.Join(itemsPath, id+".msgpack"), data)
}

// atomicWriteFile writes file atomically
// Writes to temp file first, then renames for data consistency
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

func loadItem(collectionPath string, id string) (*Item, error) {
	itemPath := filepath.Join(collectionPath, "items", id+".msgpack")
	data, err := os.ReadFile(itemPath)
	if err != nil {
		return nil, err
	}

	var item Item
	if err := msgpack.Unmarshal(data, &item); err != nil {
		return nil, err
	}
	return &item, nil
}

// DeleteItemFile deletes item file
func DeleteItemFile(collectionPath string, id string) error {
	itemPath := filepath.Join(collectionPath, "items", id+".msgpack")
	return os.Remove(itemPath)
}

// =========================================
// Database persistence
// =========================================

// SaveDatabase saves database
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
