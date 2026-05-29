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
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	// "github.com/siyuan-note/logging"
)

// isEmbeddingReservedCollection 检查是否为 embedding 专用集合
// 这些集合只能通过 embedding 包的接口修改，通用 API 禁止直接操作
func isEmbeddingReservedCollection(name string) bool {
	return strings.HasPrefix(name, "blocks_embedding_") ||
		strings.HasPrefix(name, "assets_embedding_")
}

var (
	// Global DB Instance for API
	// In real app this should be injected
	GlobalDB   *Database
	once       sync.Once
	dbLoading  bool   // 数据库是否正在加载
	dbLoadErr  error  // 加载错误（如果有）
	dbLoadPath string // 数据库路径
)

// IsDBLoading 返回数据库是否正在加载
func IsDBLoading() bool {
	return dbLoading
}

// GetDBLoadError 返回数据库加载错误（如果有）
func GetDBLoadError() error {
	return dbLoadErr
}

// InitGlobalDB initializes the global database instance
// 从持久化存储加载数据库，如果加载失败则创建新数据库
func InitGlobalDB(path string) {
	once.Do(func() {
		dbLoading = true
		dbLoadPath = path
		defer func() { dbLoading = false }()

		db, err := LoadDatabase(path)
		if err != nil {
			dbLoadErr = err
			GlobalDB = NewDatabase(path)
			return
		}
		GlobalDB = db
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

	if req.Metric != "" {
		if hc, ok := col.(*Collection); ok {
			hc.Mu.Lock()
			hc.Config.MetricType = req.Metric
			hc.Mu.Unlock()
		}
	}

	c.JSON(http.StatusOK, Response{Code: 0, Msg: "Collection created"})
}

func putPointsHandler(c *gin.Context) {
	var req PutRequest
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, Response{Code: 400, Msg: "Invalid request body"})
		return
	}

	// 保护 embedding 专用集合
	if isEmbeddingReservedCollection(req.Collection) {
		c.JSON(http.StatusForbidden, Response{Code: 403, Msg: "Embedding collections are protected. Use /api/embedding/* endpoints."})
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
		if len(point.Vector) != col.Dimension() {
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

	// 保护 embedding 专用集合
	if isEmbeddingReservedCollection(req.Collection) {
		c.JSON(http.StatusForbidden, Response{Code: 403, Msg: "Embedding collections are protected. Use /api/embedding/* endpoints."})
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

	if len(req.Vector) != col.Dimension() {
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
