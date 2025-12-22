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
	"net/http"

	"github.com/gin-gonic/gin"
)

// =========================================
// HTTP API
// =========================================

// Global storage instance (initialized by Init)
var storage *VectorStorage

// Init initializes vector database
func Init(publicPath, pluginPath, tempPath string) error {
	storage = NewVectorStorage()

	// Load or create databases
	if publicPath != "" {
		db, err := LoadDatabase(publicPath)
		if err != nil {
			db = NewDatabase(publicPath)
		}
		storage.Databases["public"] = db
	}

	if pluginPath != "" {
		db, err := LoadDatabase(pluginPath)
		if err != nil {
			db = NewDatabase(pluginPath)
		}
		storage.Databases["plugin"] = db
	}

	if tempPath != "" {
		db, err := LoadDatabase(tempPath)
		if err != nil {
			db = NewDatabase(tempPath)
		}
		storage.Databases["temp"] = db
	}

	return nil
}

// RegisterRoutes registers HTTP routes
func RegisterRoutes(router *gin.RouterGroup) {
	router.POST("/collections/build", handleBuildCollection)
	router.POST("/add", handleAddVectors)
	router.POST("/delete", handleDeleteVectors)
	router.POST("/query", handleQuery)
	router.POST("/keys", handleKeys)
	router.POST("/state", handleState)
	router.POST("/rebuild", handleRebuild)
}

// =========================================
// Request/Response structures
// =========================================

type buildCollectionRequest struct {
	Database       string `json:"database"`
	CollectionName string `json:"collection_name"`
	Dimension      int    `json:"dimension"`
}

type addVectorsRequest struct {
	Database       string       `json:"database"`
	CollectionName string       `json:"collection_name"`
	Vectors        []VectorData `json:"vectors"`
}

type VectorData struct {
	ID     string                       `json:"id"`
	Meta   map[string]interface{}       `json:"meta"`
	Vector map[string][]float32         `json:"vector"`
}

type deleteVectorsRequest struct {
	Database       string   `json:"database"`
	CollectionName string   `json:"collection_name"`
	Keys           []string `json:"keys"`
}

type queryRequest struct {
	Database       string    `json:"database"`
	CollectionName string    `json:"collection_name"`
	VectorName     string    `json:"vector_name"`
	Vector         []float32 `json:"vector"`
	Limit          int       `json:"limit"`
	EfSearch       int       `json:"ef_search"`
}

type keysRequest struct {
	Database       string `json:"database"`
	CollectionName string `json:"collection_name"`
	WithMeta       bool   `json:"with_meta"`
}

type stateRequest struct {
	Database       string `json:"database"`
	CollectionName string `json:"collection_name"`
}

type rebuildRequest struct {
	Database       string `json:"database"`
	CollectionName string `json:"collection_name"`
	VectorName     string `json:"vector_name"`
}

// =========================================
// Handler implementations
// =========================================

func handleBuildCollection(c *gin.Context) {
	var req buildCollectionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": -1, "msg": err.Error()})
		return
	}

	db := GetDatabase(req.Database)
	if db == nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": -1, "msg": "database not found"})
		return
	}

	db.mu.Lock()
	collection, exists := db.Collections[req.CollectionName]
	if !exists {
		collection = NewCollection(req.CollectionName, req.Dimension)
		db.Collections[req.CollectionName] = collection
	}
	db.mu.Unlock()

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"data": gin.H{
			"collection_name": collection.Name,
			"dimension":       collection.Dimension,
			"item_count":      collection.ItemCount(),
		},
	})
}

func handleAddVectors(c *gin.Context) {
	var req addVectorsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": -1, "msg": err.Error()})
		return
	}

	collection := GetCollection(req.Database, req.CollectionName)
	if collection == nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": -1, "msg": "collection not found"})
		return
	}

	addedCount := 0
	for _, vd := range req.Vectors {
		item := NewItem(vd.ID)
		item.Meta = vd.Meta

		for modelName, vec := range vd.Vector {
			item.SetVector(modelName, vec)
			collection.InitLevelMap(modelName)
			if err := collection.InsertItem(item, modelName); err != nil {
				continue
			}
		}
		addedCount++
	}

	db := GetDatabase(req.Database)
	if db != nil {
		SaveCollection(collection, db.Path)
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"data": gin.H{
			"added_count": addedCount,
		},
	})
}

func handleDeleteVectors(c *gin.Context) {
	var req deleteVectorsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": -1, "msg": err.Error()})
		return
	}

	collection := GetCollection(req.Database, req.CollectionName)
	if collection == nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": -1, "msg": "collection not found"})
		return
	}

	deletedCount := 0
	for _, key := range req.Keys {
		// HNSWLevelMap is deprecated. Assumes single model or handles internally.
		collection.DeleteItemWithIndex(key, "")
		deletedCount++
	}

	db := GetDatabase(req.Database)
	if db != nil {
		SaveCollection(collection, db.Path)
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"data": gin.H{
			"deleted_count": deletedCount,
		},
	})
}

func handleQuery(c *gin.Context) {
	var req queryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": -1, "msg": err.Error()})
		return
	}

	collection := GetCollection(req.Database, req.CollectionName)
	if collection == nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": -1, "msg": "collection not found"})
		return
	}

	limit := req.Limit
	if limit <= 0 {
		limit = 10
	}

	results := collection.Search(req.Vector, req.VectorName, limit, req.EfSearch)

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"data": results,
	})
}

func handleKeys(c *gin.Context) {
	var req keysRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": -1, "msg": err.Error()})
		return
	}

	collection := GetCollection(req.Database, req.CollectionName)
	if collection == nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": -1, "msg": "collection not found"})
		return
	}

	collection.Mu.RLock()
	defer collection.Mu.RUnlock()

	if req.WithMeta {
		result := make([]map[string]interface{}, 0, len(collection.DocMap))
		for i, id := range collection.DocMap {
			if collection.Deleted[DocID(i)] {
				continue
			}
			meta := map[string]interface{}{}
			if i < len(collection.Metas) {
				meta = collection.Metas[i]
			}
			result = append(result, map[string]interface{}{
				"id":   id,
				"meta": meta,
			})
		}
		c.JSON(http.StatusOK, gin.H{"code": 0, "data": result})
	} else {
		keys := make([]string, 0, len(collection.DocMap))
		for i, id := range collection.DocMap {
			if collection.Deleted[DocID(i)] {
				continue
			}
			keys = append(keys, id)
		}
		c.JSON(http.StatusOK, gin.H{"code": 0, "data": keys})
	}
}

func handleState(c *gin.Context) {
	var req stateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": -1, "msg": err.Error()})
		return
	}

	collection := GetCollection(req.Database, req.CollectionName)
	if collection == nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": -1, "msg": "collection not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"data": gin.H{
			"name":       collection.Name,
			"dimension":  collection.Dimension,
			"item_count": collection.ItemCount(),
			"models":     getModelNames(collection),
		},
	})
}

func handleRebuild(c *gin.Context) {
	var req rebuildRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": -1, "msg": err.Error()})
		return
	}

	collection := GetCollection(req.Database, req.CollectionName)
	if collection == nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": -1, "msg": "collection not found"})
		return
	}

	if err := collection.RebuildIndex(req.VectorName); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": -1, "msg": err.Error()})
		return
	}

	db := GetDatabase(req.Database)
	if db != nil {
		SaveCollection(collection, db.Path)
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"msg":  "index rebuilt",
	})
}

// =========================================
// Helper functions
// =========================================

func GetDatabase(name string) *Database {
	if storage == nil {
		return nil
	}
	if name == "" {
		name = "public"
	}
	storage.mu.RLock()
	defer storage.mu.RUnlock()
	return storage.Databases[name]
}

func GetCollection(dbName, collectionName string) *Collection {
	db := GetDatabase(dbName)
	if db == nil {
		return nil
	}
	db.mu.RLock()
	defer db.mu.RUnlock()
	return db.Collections[collectionName]
}

func getModelNames(c *Collection) []string {
	return []string{"default"}
}
