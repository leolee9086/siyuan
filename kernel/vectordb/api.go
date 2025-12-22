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
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	// "github.com/siyuan-note/logging"
)

var (
	// Global DB Instance for API
	// In real app this should be injected
	GlobalDB *Database
	once     sync.Once
)

// InitGlobalDB initializes the global database instance
func InitGlobalDB(path string) {
	once.Do(func() {
		GlobalDB = NewDatabase(path)
		// Load from persistence... (TODO)
	})
}

// =========================================
// API Schemas
// =========================================

type CreateCollectionRequest struct {
	Database   string `json:"database"`
	Collection string `json:"collection"`
	Dimension  int    `json:"dimension"`
	Metric     string `json:"metric"` // optional
}

type PutRequest struct {
	Database   string  `json:"database"`
	Collection string  `json:"collection"`
	Points     []Point `json:"points"`
}

type DeleteRequest struct {
	Database   string   `json:"database"`
	Collection string   `json:"collection"`
	IDs        []string `json:"ids"`
}

type QueryRequest struct {
	Database   string    `json:"database"`
	Collection string    `json:"collection"`
	Vector     []float32 `json:"vector"`
	TopK       int       `json:"top_k"`
	EfSearch   int       `json:"ef_search"` // optional
}

type RebuildRequest struct {
	Database   string `json:"database"`
	Collection string `json:"collection"`
}

type Response struct {
	Code int         `json:"code"`
	Msg  string      `json:"msg"`
	Data interface{} `json:"data,omitempty"`
}

// =========================================
// Handlers
// =========================================

func RegisterVectorDBRoutes(r *gin.Engine) {
	group := r.Group("/api/vector")
	{
		group.POST("/collections/build", createCollectionHandler)
		group.POST("/put", putPointsHandler)
		group.POST("/delete", deletePointsHandler)
		group.POST("/query", queryHandler)
		group.POST("/rebuild", rebuildHandler)
	}
}

func createCollectionHandler(c *gin.Context) {
	var req CreateCollectionRequest
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, Response{Code: 400, Msg: "Invalid request"})
		return
	}

	if req.Collection == "" || req.Dimension <= 0 {
		c.JSON(http.StatusBadRequest, Response{Code: 400, Msg: "Invalid collection name or dimension"})
		return
	}

	// Always use "default" database logic for now if multi-tenancy not fully implemented
	// Assuming req.Database is just ignored or used as namespace prefix
	// Here we just map collection name directly

	col, err := GlobalDB.CreateCollection(req.Collection, req.Dimension)
	if err != nil {
		c.JSON(http.StatusInternalServerError, Response{Code: 500, Msg: err.Error()})
		return
	}
	
	col.Mu.Lock()
	if req.Metric != "" {
		col.Config.MetricType = req.Metric
	}
	col.Mu.Unlock()

	c.JSON(http.StatusOK, Response{Code: 0, Msg: "Collection created"})
}

func putPointsHandler(c *gin.Context) {
	var req PutRequest
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, Response{Code: 400, Msg: "Invalid request body"})
		return
	}

	col := GlobalDB.GetCollection(req.Collection)
	if col == nil {
		c.JSON(http.StatusNotFound, Response{Code: 404, Msg: "Collection not found"})
		return
	}

	start := time.Now()
	count := 0
	
	for _, point := range req.Points {
		if len(point.Vector) != col.Dimension {
			continue // Skip invalid dimension
		}
		col.InsertPoint(point)
		count++
	}
	
	elapsed := time.Since(start)
	// logging.Logger.Debugf("Inserted %d points in %v", count, elapsed)
    _ = elapsed

	c.JSON(http.StatusOK, Response{Code: 0, Msg: "Points upserted", Data: map[string]int{"count": count}})
}

func deletePointsHandler(c *gin.Context) {
	var req DeleteRequest
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, Response{Code: 400, Msg: "Invalid request"})
		return
	}

	col := GlobalDB.GetCollection(req.Collection)
	if col == nil {
		c.JSON(http.StatusNotFound, Response{Code: 404, Msg: "Collection not found"})
		return
	}

	for _, id := range req.IDs {
		// New delete logic
		col.DeleteItemWithIndex(id)
	}

	c.JSON(http.StatusOK, Response{Code: 0, Msg: "Points deleted"})
}

func queryHandler(c *gin.Context) {
	var req QueryRequest
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, Response{Code: 400, Msg: "Invalid request"})
		return
	}

	col := GlobalDB.GetCollection(req.Collection)
	if col == nil {
		c.JSON(http.StatusNotFound, Response{Code: 404, Msg: "Collection not found"})
		return
	}
	
	if len(req.Vector) != col.Dimension {
		c.JSON(http.StatusBadRequest, Response{Code: 400, Msg: "Dimension mismatch"})
		return
	}

	topK := req.TopK
	if topK <= 0 {
		topK = 10
	}
	
	results := col.Search(req.Vector, topK, req.EfSearch)

	c.JSON(http.StatusOK, Response{Code: 0, Msg: "OK", Data: results})
}

func rebuildHandler(c *gin.Context) {
	var req RebuildRequest
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, Response{Code: 400, Msg: "Invalid request"})
		return
	}

	col := GlobalDB.GetCollection(req.Collection)
	if col == nil {
		c.JSON(http.StatusNotFound, Response{Code: 404, Msg: "Collection not found"})
		return
	}

	start := time.Now()
	err := col.RebuildIndex()
	if err != nil {
		c.JSON(http.StatusInternalServerError, Response{Code: 500, Msg: err.Error()})
		return
	}
	
	elapsed := time.Since(start)
	// logging.Logger.Infof("Rebuilt index for collection %s in %v", req.Collection, elapsed)
    _ = elapsed

	c.JSON(http.StatusOK, Response{Code: 0, Msg: "Index rebuilt"})
}
